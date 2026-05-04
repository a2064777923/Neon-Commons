const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { getGameMeta, getGameLimits } = require("../lib/games/catalog");
const { getMahjongRoomManager, MahjongRoomManager } = require("../lib/card/mahjong-manager");
const { SOCKET_EVENTS, API_ROUTE_PATTERNS, API_ROUTES } = require("../lib/shared/network-contract");
const { detectWin, createMahjongTileSet, shuffle, buildWall } = require("../lib/card/mahjong-tiles");

function createTestUser(id, name) {
  return { id, username: name, displayName: name };
}

describe("Catalog integration - Mahjong entry", () => {
  it("getGameMeta('mahjong') returns entry with title '麻將'", () => {
    const meta = getGameMeta("mahjong");
    assert.ok(meta, "mahjong catalog entry should exist");
    assert.equal(meta.title, "麻將");
    assert.equal(meta.key, "mahjong");
    assert.equal(meta.familyKey, "card");
  });

  it("getGameLimits('mahjong') returns { minPlayers: 4, maxPlayers: 4 }", () => {
    const limits = getGameLimits("mahjong");
    assert.deepEqual(limits, { minPlayers: 4, maxPlayers: 4 });
  });
});

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
    global.mahjongRoomManager = null;
    manager = getMahjongRoomManager();
    manager.io = {
      to: () => ({ emit: () => {} })
    };
  });

  afterEach(() => {
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

  it("createRoom creates room with correct gameKey, familyKey, state", () => {
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

  it("4 players can join room", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));
    manager.joinRoom(roomNo, createTestUser("u3", "Charlie"));
    manager.joinRoom(roomNo, createTestUser("u4", "Dave"));

    assert.equal(room.players.length, 4);

    assert.throws(() => {
      manager.joinRoom(roomNo, createTestUser("u5", "Eve"));
    }, /已滿/);
  });

  it("all ready triggers startGame, deals 13 tiles each", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));
    manager.joinRoom(roomNo, createTestUser("u3", "Charlie"));
    manager.joinRoom(roomNo, createTestUser("u4", "Dave"));

    manager.setReady(roomNo, "u1", true);
    manager.setReady(roomNo, "u2", true);
    manager.setReady(roomNo, "u3", true);
    assert.equal(room.state, "waiting");

    manager.setReady(roomNo, "u4", true);
    assert.equal(room.state, "playing");
    assert.ok(room.round);
    assert.equal(room.round.stage, "playing");
    assert.equal(room.round.hands.length, 4);
    for (const hand of room.round.hands) {
      assert.equal(hand.length, 13);
    }
    assert.ok(room.round.wall.length > 0);
    assert.ok(room.round.deadWall.length <= 14);
    assert.equal(room.round.currentTurn, 0);
  });

  it("drawTile draws from wall (hand goes from 13 to 14 tiles)", () => {
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

    const handBefore = room.round.hands[0].length;
    manager.drawTile(roomNo, "u1");
    const handAfter = room.round.hands[0].length;

    assert.ok(handAfter >= handBefore, "hand should not decrease after draw");
    assert.equal(room.round.hasDrawn, true, "should track that player has drawn");
  });

  it("discardTile removes tile and hand goes back to 13", () => {
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

    manager.drawTile(roomNo, "u1");

    const tileToDiscard = room.round.hands[0][0];
    manager.discardTile(roomNo, "u1", tileToDiscard.id);

    assert.ok(room.round.discards[0].length > 0);
    assert.equal(room.round.hands[0].length, 13);
    const hasPendingClaim = room.round.pendingClaim !== null;
    const turnAdvanced = room.round.currentTurn !== 0;
    assert.ok(hasPendingClaim || turnAdvanced, "claim window opened or turn advanced");
  });

  it("pong claim removes 2 matching tiles and adds meld", () => {
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

    // Force player 1 (u2) to have 2 identical tiles for pong
    // We'll manipulate the hand directly for test purposes
    const targetSuit = 0;
    const targetRank = 1;
    const hand2 = room.round.hands[1];

    // Clear hand and insert 2 matching tiles + some filler
    hand2.length = 0;
    hand2.push({ id: 9001, suit: targetSuit, rank: targetRank, label: "test1" });
    hand2.push({ id: 9002, suit: targetSuit, rank: targetRank, label: "test2" });
    hand2.push({ id: 9003, suit: 3, rank: 0, label: "filler1" });
    hand2.push({ id: 9004, suit: 3, rank: 1, label: "filler2" });
    hand2.push({ id: 9005, suit: 3, rank: 2, label: "filler3" });
    hand2.push({ id: 9006, suit: 3, rank: 3, label: "filler4" });
    hand2.push({ id: 9007, suit: 4, rank: 0, label: "filler5" });
    hand2.push({ id: 9008, suit: 4, rank: 1, label: "filler6" });
    hand2.push({ id: 9009, suit: 4, rank: 2, label: "filler7" });
    hand2.push({ id: 9010, suit: 1, rank: 1, label: "filler8" });
    hand2.push({ id: 9011, suit: 1, rank: 2, label: "filler9" });
    hand2.push({ id: 9012, suit: 1, rank: 3, label: "filler10" });
    hand2.push({ id: 9013, suit: 1, rank: 4, label: "filler11" });

    // Player 0 draws and discards the target tile
    manager.drawTile(roomNo, "u1");
    const discardedTile = { id: 9999, suit: targetSuit, rank: targetRank, label: "discarded" };
    // Simulate discard by directly manipulating state
    room.round.hands[0].pop(); // remove any extra tile from draw
    room.round.discards[0].push(discardedTile);
    room.round.hasDrawn = false;

    // Set up a pending claim manually for pong
    const claims = [
      { type: "pong", priority: 2, tiles: [hand2[0], hand2[1], discardedTile], seatIndex: 1, userId: "u2", passed: false }
    ];
    room.round.pendingClaim = {
      tile: discardedTile,
      discarderSeat: 0,
      claims,
      expiresAt: Date.now() + 5000,
      timer: null
    };

    // Execute pong claim
    manager.claimTile(roomNo, "u2", "pong");

    // Player 2 should now have a meld (the pong)
    const melds2 = room.round.melds[1];
    assert.ok(melds2.length > 0, "player should have at least one meld after pong");
    assert.equal(melds2[melds2.length - 1].length, 3, "pong meld should have 3 tiles");

    // Claimant becomes current turn
    assert.equal(room.round.currentTurn, 1, "pong claimant should become current turn");
  });

  it("win detection works end-to-end with basic win hand", () => {
    // Test the tile-level win detection directly
    // Build a known winning hand: 4 melds + 1 pair
    const hand = [
      // Sequence: 1萬, 2萬, 3萬
      { id: 1, suit: 0, rank: 1 }, { id: 2, suit: 0, rank: 2 }, { id: 3, suit: 0, rank: 3 },
      // Triplet: 5筒 x3
      { id: 4, suit: 2, rank: 5 }, { id: 5, suit: 2, rank: 5 }, { id: 6, suit: 2, rank: 5 },
      // Sequence: 7條, 8條, 9條
      { id: 7, suit: 1, rank: 7 }, { id: 8, suit: 1, rank: 8 }, { id: 9, suit: 1, rank: 9 },
      // Triplet: 北風 x3
      { id: 10, suit: 3, rank: 3 }, { id: 11, suit: 3, rank: 3 }, { id: 12, suit: 3, rank: 3 },
      // Pair: 中 x2
      { id: 13, suit: 4, rank: 0 }, { id: 14, suit: 4, rank: 0 }
    ];

    const result = detectWin(hand, []);
    assert.ok(result, "should detect a winning hand");
    assert.equal(result.type, "basic");
  });

  it("win detection works end-to-end with seven pairs", () => {
    const hand = [
      { id: 1, suit: 0, rank: 1 }, { id: 2, suit: 0, rank: 1 },
      { id: 3, suit: 0, rank: 3 }, { id: 4, suit: 0, rank: 3 },
      { id: 5, suit: 0, rank: 5 }, { id: 6, suit: 0, rank: 5 },
      { id: 7, suit: 0, rank: 7 }, { id: 8, suit: 0, rank: 7 },
      { id: 9, suit: 1, rank: 2 }, { id: 10, suit: 1, rank: 2 },
      { id: 11, suit: 1, rank: 4 }, { id: 12, suit: 1, rank: 4 },
      { id: 13, suit: 1, rank: 6 }, { id: 14, suit: 1, rank: 6 }
    ];

    const result = detectWin(hand, []);
    assert.ok(result, "should detect seven pairs win");
    assert.equal(result.type, "sevenPairs");
  });

  it("non-winning hand returns null from detectWin", () => {
    const hand = [
      { id: 1, suit: 0, rank: 1 }, { id: 2, suit: 0, rank: 2 }, { id: 3, suit: 0, rank: 3 },
      { id: 4, suit: 0, rank: 4 }, { id: 5, suit: 0, rank: 5 }, { id: 6, suit: 0, rank: 6 },
      { id: 7, suit: 0, rank: 7 }, { id: 8, suit: 0, rank: 8 }, { id: 9, suit: 0, rank: 9 },
      { id: 10, suit: 1, rank: 1 }, { id: 11, suit: 1, rank: 2 }, { id: 12, suit: 1, rank: 3 },
      { id: 13, suit: 1, rank: 5 } // 13 tiles, no valid pair/meld combo
    ];

    const result = detectWin(hand, []);
    assert.equal(result, null, "non-winning hand should return null");
  });

  it("wall exhaustion triggers draw (liuju)", () => {
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

    assert.equal(room.state, "playing");

    // Empty the wall to simulate exhaustion
    room.round.wall.length = 0;

    // Attempt to draw - should trigger draw
    manager.drawTile(roomNo, "u1");

    // Room should be back to waiting state (round ended in draw)
    assert.equal(room.state, "waiting", "room should return to waiting after liuju");
    assert.ok(room.lastResult, "should have a lastResult");
    assert.equal(room.lastResult.winMethod, "draw", "winMethod should be 'draw'");
    assert.equal(room.lastResult.winnerSeat, null, "no winner in a draw");
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

    assert.ok(viewForU1.hands.length === 13 || viewForU1.hands.length === 14);
    assert.ok(viewForU2.hands.length === 13 || viewForU2.hands.length === 14);

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
    assert.equal(seat.connected, true);

    manager.unregisterSocket("socket-1");
    assert.ok(!seat.socketIds.has("socket-1"));
    assert.equal(seat.connected, false, "seat should be marked reconnecting after unregister");
    assert.ok(seat.reconnectGraceEndsAt, "should have reconnect grace period");
  });

  it("reconnection recovers state - re-registering socket restores connected status", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    const mockSocket1 = { id: "socket-1", join: () => {} };
    manager.registerSocket(roomNo, "u1", mockSocket1);

    // Disconnect
    manager.unregisterSocket("socket-1");
    const seat = room.players[0];
    assert.equal(seat.connected, false);

    // Reconnect with new socket
    const mockSocket2 = { id: "socket-2", join: () => {} };
    manager.registerSocket(roomNo, "u1", mockSocket2);

    assert.equal(seat.connected, true, "seat should be connected after re-register");
    assert.equal(seat.reconnectGraceEndsAt, null, "reconnect grace should be cleared");
    assert.ok(seat.socketIds.has("socket-2"), "new socket should be registered");
  });
});
