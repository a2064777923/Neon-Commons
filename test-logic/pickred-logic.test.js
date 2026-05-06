const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");

const { getPickRedRoomManager } = require("../lib/card/pickred-manager");

function createTestUser(id, name) {
  return { id, username: name, displayName: name };
}

describe("PickRedRoomManager", () => {
  let manager;

  beforeEach(() => {
    global.pickRedRoomManager = null;
    manager = getPickRedRoomManager();
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

    assert.equal(room.gameKey, "pickred");
    assert.equal(room.familyKey, "card");
    assert.equal(room.state, "waiting");
    assert.equal(room.ownerId, "u1");
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].userId, "u1");
    assert.equal(room.players[0].seatIndex, 0);
    assert.ok(room.roomNo);
    assert.equal(room.round, null);
  });

  it("2 players can join and start game", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));

    manager.setReady(roomNo, "u1", true);
    assert.equal(room.state, "waiting");

    manager.setReady(roomNo, "u2", true);
    assert.equal(room.state, "playing");
    assert.ok(room.round);
    assert.equal(room.round.hands.length, 2);
    assert.equal(room.round.hands[0].length, 8);
    assert.equal(room.round.hands[1].length, 8);
    assert.equal(room.round.tableCards.length, 4);
    assert.equal(room.round.currentTurn, 0);
  });

  it("full round produces a winner", () => {
    const owner = createTestUser("u1", "Alice");
    const room = manager.createRoom(owner, {});
    const roomNo = room.roomNo;

    manager.joinRoom(roomNo, createTestUser("u2", "Bob"));
    manager.setReady(roomNo, "u1", true);
    manager.setReady(roomNo, "u2", true);

    assert.equal(room.state, "playing");

    // Drive the game to completion
    let safety = 300;
    while (room.round && safety-- > 0) {
      const turn = room.round.currentTurn;
      const userId = room.players[turn].userId;
      const hand = room.round.hands[turn];
      const tableCards = room.round.tableCards;

      if (hand.length === 0) break;

      // Try to find a match (hand card + table card = 10)
      let matched = false;
      for (const hc of hand) {
        for (const tc of tableCards) {
          if (hc.rank + tc.rank === 10) {
            manager.matchPair(roomNo, userId, hc.id, tc.id);
            matched = true;
            break;
          }
        }
        if (matched) break;
      }

      if (matched) continue;

      // No match possible: draw if deck has cards, else discard
      if (room.round && room.round.deck.length > 0) {
        manager.drawCard(roomNo, userId);
      } else if (room.round) {
        manager.discardCard(roomNo, userId, hand[0].id);
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
    manager.setReady(roomNo, "u1", true);
    manager.setReady(roomNo, "u2", true);

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
