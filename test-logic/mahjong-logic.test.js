const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

// These imports will fail until implementation exists — that's the RED gate
let getMahjongRoomManager, MahjongRoomManager;
let SOCKET_EVENTS, API_ROUTE_PATTERNS, API_ROUTES;

try {
  ({ getMahjongRoomManager, MahjongRoomManager } = require("../lib/card/mahjong-manager"));
} catch (e) {
  // Expected during RED phase
}

try {
  ({ SOCKET_EVENTS, API_ROUTE_PATTERNS, API_ROUTES } = require("../lib/shared/network-contract"));
} catch (e) {
  // Expected during RED phase
}

function createTestUser(id, name) {
  return { id, username: name, displayName: name };
}

describe("Network Contract - Mahjong entries", () => {
  it("SOCKET_EVENTS.mahjong has all required events", () => {
    const events = SOCKET_EVENTS.mahjong;
    assert.ok(events, "mahjong socket events should exist");
    assert.equal(events.subscribe, "mahjong:subscribe");
    assert.equal(events.ready, "mahjong:ready");
    assert.equal(events.draw, "mahjong:draw");
    assert.equal(events.discard, "mahjong:discard");
    assert.equal(events.claim, "mahjong:claim");
    assert.equal(events.passClaim, "mahjong:pass-claim");
    assert.equal(events.update, "mahjong:update");
    assert.equal(events.error, "mahjong:error");
  });

  it("API_ROUTE_PATTERNS.mahjongRooms has list, detail, join routes", () => {
    const routes = API_ROUTE_PATTERNS.mahjongRooms;
    assert.ok(routes, "mahjongRooms route patterns should exist");
    assert.equal(routes.list, "/api/mahjong/rooms");
    assert.equal(routes.detail, "/api/mahjong/rooms/:roomNo");
    assert.equal(routes.join, "/api/mahjong/rooms/:roomNo/join");
  });

  it("API_ROUTES.mahjongRooms has list, create, detail, join methods", () => {
    const routes = API_ROUTES.mahjongRooms;
    assert.ok(routes, "mahjongRooms API routes should exist");
    assert.equal(routes.list(), "/api/mahjong/rooms");
    assert.equal(routes.create(), "/api/mahjong/rooms");
    assert.equal(routes.detail("1234"), "/api/mahjong/rooms/1234");
    assert.equal(routes.join("1234"), "/api/mahjong/rooms/1234/join");
  });
});

describe("MahjongRoomManager", () => {
  let manager;

  beforeEach(() => {
    // Reset singleton for each test
    global.mahjongRoomManager = null;
    manager = getMahjongRoomManager();
    // Mock io
    manager.io = {
      to: () => ({ emit: () => {} })
    };
  });

  afterEach(() => {
    // Clean up all timers to prevent process hanging
    if (manager) {
      for (const room of manager.rooms.values()) {
        clearTimeout(room.turnTimer);
        if (room.round?.pendingClaim?.timer) {
          clearTimeout(room.round.pendingClaim.timer);
        }
      }
      for (const timer of manager.reconnectTimers.values()) {
        clearTimeout(timer);
      }
      for (const timer of manager.roomExpiryTimers.values()) {
        clearTimeout(timer);
      }
      manager.reconnectTimers.clear();
      manager.roomExpiryTimers.clear();
      manager.rooms.clear();
    }
  });

  it("getMahjongRoomManager returns singleton", () => {
    const m1 = getMahjongRoomManager();
    const m2 = getMahjongRoomManager();
    assert.strictEqual(m1, m2);
    assert.ok(m1 instanceof MahjongRoomManager);
  });

  it("createRoom creates room with correct structure", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});

    assert.equal(room.gameKey, "mahjong");
    assert.equal(room.familyKey, "card");
    assert.equal(room.state, "waiting");
    assert.equal(room.ownerId, "u1");
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].userId, "u1");
    assert.equal(room.players[0].seatIndex, 0);
    assert.ok(room.roomNo);
    assert.equal(room.round, null);
  });

  it("joinRoom adds players up to MAX_PLAYERS=4", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));
    manager.joinRoom(roomNo, createTestUser("u3", "Charlie"));
    manager.joinRoom(roomNo, createTestUser("u4", "Dave"));

    assert.equal(room.players.length, 4);

    // 5th player should fail
    assert.throws(() => {
      manager.joinRoom(roomNo, createTestUser("u5", "Eve"));
    }, /已滿/);
  });

  it("setReady triggers startGame when all 4 ready", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));
    manager.joinRoom(roomNo, createTestUser("u3", "Charlie"));
    manager.joinRoom(roomNo, createTestUser("u4", "Dave"));

    manager.setReady(roomNo, "u1", true);
    manager.setReady(roomNo, "u2", true);
    manager.setReady(roomNo, "u3", true);
    assert.equal(room.state, "waiting"); // Not yet

    manager.setReady(roomNo, "u4", true);
    assert.equal(room.state, "playing");
    assert.ok(room.round);
  });

  it("startGame deals 13 tiles to each player", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));
    manager.joinRoom(roomNo, createTestUser("u3", "Charlie"));
    manager.joinRoom(roomNo, createTestUser("u4", "Dave"));

    manager.setReady(roomNo, "u1", true);
    manager.setReady(roomNo, "u2", true);
    manager.setReady(roomNo, "u3", true);
    manager.setReady(roomNo, "u4", true);

    assert.ok(room.round);
    assert.equal(room.round.stage, "playing");
    assert.equal(room.round.hands.length, 4);
    for (const hand of room.round.hands) {
      assert.equal(hand.length, 13);
    }
    assert.ok(room.round.wall.length > 0);
    // Dead wall starts at 14 but may be reduced by flower replacement during dealing
    assert.ok(room.round.deadWall.length <= 14);
    assert.equal(room.round.currentTurn, 0); // East starts
  });

  it("drawTile draws from wall and auto-replaces flowers", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));
    manager.joinRoom(roomNo, createTestUser("u3", "Charlie"));
    manager.joinRoom(roomNo, createTestUser("u4", "Dave"));

    manager.setReady(roomNo, "u1", true);
    manager.setReady(roomNo, "u2", true);
    manager.setReady(roomNo, "u3", true);
    manager.setReady(roomNo, "u4", true);

    // Draw a tile for current player
    const handBefore = room.round.hands[0].length;
    manager.drawTile(roomNo, "u1");
    const handAfter = room.round.hands[0].length;

    // After draw, player should have 14 tiles (unless flowers were drawn)
    assert.ok(handAfter >= handBefore, "hand should not decrease");
    assert.ok(room.round.hasDrawn === true, "should track that player has drawn");
  });

  it("discardTile removes tile and starts claim window", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));
    manager.joinRoom(roomNo, createTestUser("u3", "Charlie"));
    manager.joinRoom(roomNo, createTestUser("u4", "Dave"));

    manager.setReady(roomNo, "u1", true);
    manager.setReady(roomNo, "u2", true);
    manager.setReady(roomNo, "u3", true);
    manager.setReady(roomNo, "u4", true);

    // Draw first
    manager.drawTile(roomNo, "u1");

    const tileToDiscard = room.round.hands[0][0];
    manager.discardTile(roomNo, "u1", tileToDiscard.id);

    // Tile should be in discard pile
    assert.ok(room.round.discards[0].length > 0);
    // Hand should be back to 13
    assert.equal(room.round.hands[0].length, 13);
    // Either a pending claim is set (if claims possible) or turn advanced
    const hasPendingClaim = room.round.pendingClaim !== null;
    const turnAdvanced = room.round.currentTurn !== 0;
    assert.ok(hasPendingClaim || turnAdvanced, "claim window opened or turn advanced");
  });

  it("serializeRoom shows viewer's own hand only (per-seat privacy)", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));
    manager.joinRoom(roomNo, createTestUser("u3", "Charlie"));
    manager.joinRoom(roomNo, createTestUser("u4", "Dave"));

    manager.setReady(roomNo, "u1", true);
    manager.setReady(roomNo, "u2", true);
    manager.setReady(roomNo, "u3", true);
    manager.setReady(roomNo, "u4", true);

    const viewForU1 = manager.serializeRoom(room, "u1");
    const viewForU2 = manager.serializeRoom(room, "u2");

    // Viewer should see own hand
    assert.ok(viewForU1.hands.length === 13 || viewForU1.hands.length === 14);
    assert.ok(viewForU2.hands.length === 13 || viewForU2.hands.length === 14);

    // Other players should only show count
    const otherPlayer = viewForU1.players.find((p) => p.userId === "u2");
    assert.ok(otherPlayer.handCount !== undefined);
    assert.ok(otherPlayer.hand === undefined);
  });

  it("registerSocket and unregisterSocket handle reconnection", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    const mockSocket = { id: "socket-1", join: () => {} };
    manager.registerSocket(roomNo, "u1", mockSocket);

    const seat = room.players[0];
    assert.ok(seat.socketIds.has("socket-1"));

    manager.unregisterSocket("socket-1");
    assert.ok(!seat.socketIds.has("socket-1"));
  });
});
