const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { getBigTwoRoomManager } = require("../lib/card/bigtwo-manager");

function createTestUser(id, name) {
  return { id, username: name, displayName: name };
}

describe("BigTwoRoomManager", () => {
  let manager;

  beforeEach(() => {
    global.bigTwoRoomManager = null;
    manager = getBigTwoRoomManager();
    manager.io = {
      to: () => ({ emit: () => {} })
    };
  });

  afterEach(() => {
    if (manager) {
      for (const room of manager.rooms.values()) {
        clearTimeout(room.turnTimer);
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

  it("createRoom creates room with correct gameKey, familyKey, state", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});

    assert.equal(room.gameKey, "bigtwo");
    assert.equal(room.familyKey, "card");
    assert.equal(room.state, "waiting");
    assert.equal(room.ownerId, "u1");
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].userId, "u1");
    assert.equal(room.players[0].seatIndex, 0);
    assert.ok(room.roomNo);
    assert.equal(room.round, null);
  });

  it("4 players can join and start game", () => {
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
    assert.equal(room.round.hands.length, 4);
    for (const hand of room.round.hands) {
      assert.equal(hand.length, 13);
    }
    assert.ok(typeof room.round.currentTurn === "number");
  });

  it("full round produces a winner", () => {
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

    // Drive the game to completion
    // Strategy: each player plays their lowest single card, or passes if can't beat
    let safety = 500;
    while (room.round && safety-- > 0) {
      const turn = room.round.currentTurn;
      const userId = room.players[turn].userId;
      const hand = room.round.hands[turn];
      const table = room.round.table;

      if (hand.length === 0) break;

      // Sort hand by sortValue (ascending)
      const sorted = [...hand].sort((a, b) => a.sortValue - b.sortValue);

      // If we're leading (no previous play or we're the lead seat), play lowest card
      if (!table.lastPlay || table.leadSeat === turn) {
        try {
          manager.playHand(roomNo, userId, [sorted[0].id]);
        } catch {
          // If can't play, break
          break;
        }
        continue;
      }

      // Otherwise, try to beat with lowest card that's higher
      let played = false;
      for (const card of sorted) {
        if (card.sortValue > table.lastPlay.cards[0].sortValue) {
          try {
            manager.playHand(roomNo, userId, [card.id]);
            played = true;
            break;
          } catch {
            // Try next card
          }
        }
      }

      if (played) continue;

      // Can't beat, pass
      try {
        manager.passTurn(roomNo, userId);
      } catch {
        break;
      }
    }

    assert.ok(room.lastResult, "should have lastResult");
    assert.ok(room.lastResult.headline, "should have headline");
    assert.ok(typeof room.lastResult.winnerSeat === "number", "should have winnerSeat");
  });

  it("reconnection recovers hand state after mid-game disconnect", () => {
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

    // Capture hand before disconnect
    const handBefore = [...room.round.hands[0]];

    // Register socket
    const mockSocket1 = { id: "recon-1", join: () => {} };
    manager.registerSocket(roomNo, "u1", mockSocket1);

    // Unregister socket (simulate disconnect)
    manager.unregisterSocket("recon-1");
    const seat = room.players[0];
    assert.equal(seat.connected, false, "seat should be disconnected");

    // Reconnect with new socket
    const mockSocket2 = { id: "recon-2", join: () => {} };
    manager.registerSocket(roomNo, "u1", mockSocket2);

    assert.equal(seat.connected, true, "seat should be reconnected");
    assert.equal(seat.reconnectGraceEndsAt, null, "reconnect grace should be cleared");
    assert.deepEqual(room.round.hands[0], handBefore, "hand should be preserved after reconnect");
  });
});
