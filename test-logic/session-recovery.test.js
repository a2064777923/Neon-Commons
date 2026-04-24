const test = require("node:test");
const assert = require("node:assert/strict");

const {
  __testing: directoryTesting,
  resolveRoomEntry
} = require("../lib/rooms/directory");
const { getRoomManager } = require("../lib/game/room-manager");
const { getPartyRoomManager } = require("../lib/party/manager");
const { getBoardRoomManager } = require("../lib/board/manager");

function createSocket(id) {
  return {
    id,
    join() {}
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createCardTemplate(roomVisibility = "public") {
  return {
    id: 701,
    name: "phase7-recovery",
    title: "Phase 7 Recovery",
    mode: "CLASSIC",
    settings: {
      baseScore: 50,
      countdownSeconds: 18,
      autoTrusteeMinSeconds: 2,
      autoTrusteeMaxSeconds: 5,
      roomVisibility
    }
  };
}

function clearReconnectTimers(manager) {
  if (!manager?.reconnectTimers) {
    return;
  }

  for (const timer of manager.reconnectTimers.values()) {
    clearTimeout(timer);
  }
  manager.reconnectTimers.clear();
}

function clearRoomExpiryTimers(manager) {
  if (!manager?.roomExpiryTimers) {
    return;
  }

  for (const timer of manager.roomExpiryTimers.values()) {
    clearTimeout(timer);
  }
  manager.roomExpiryTimers.clear();
}

function resetLiveRoomState() {
  clearReconnectTimers(global.ddzRoomManager);
  clearReconnectTimers(global.partyRoomManager);
  clearReconnectTimers(global.boardRoomManager);
  clearRoomExpiryTimers(global.ddzRoomManager);
  clearRoomExpiryTimers(global.partyRoomManager);
  clearRoomExpiryTimers(global.boardRoomManager);
  directoryTesting.resetRoomDirectory();
  delete global.ddzRoomManager;
  delete global.partyRoomManager;
  delete global.boardRoomManager;
}

test("card room seats move through reconnecting before disconnected and reconnect without duplicates", async (t) => {
  resetLiveRoomState();
  t.after(resetLiveRoomState);

  const manager = getRoomManager();
  manager.reconnectGraceMs = 25;

  const owner = { id: 201, username: "owner201", displayName: "Owner 201" };
  const joiner = { id: 202, username: "joiner202", displayName: "Joiner 202" };
  const room = manager.createRoom(owner, createCardTemplate(), {});
  manager.joinRoom(room.roomNo, joiner);

  manager.registerSocket(room.roomNo, joiner.id, createSocket("card-socket-1"));
  manager.unregisterSocket("card-socket-1");

  assert.deepEqual(
    pickRecoveryFields(
      manager.serializeRoom(room).players.find((player) => player.userId === joiner.id)
    ),
    {
      connected: false,
      presenceState: "reconnecting",
      reconnectGraceEndsAt: room.players.find((player) => player.userId === joiner.id).reconnectGraceEndsAt
    }
  );

  manager.registerSocket(room.roomNo, joiner.id, createSocket("card-socket-2"));

  assert.equal(room.players.filter((player) => player.userId === joiner.id).length, 1);
  assert.deepEqual(
    pickRecoveryFields(
      manager.serializeRoom(room).players.find((player) => player.userId === joiner.id)
    ),
    {
      connected: true,
      presenceState: "connected",
      reconnectGraceEndsAt: null
    }
  );
  assert.equal(
    resolveRoomEntry(room.roomNo).memberIds.filter((memberId) => memberId === joiner.id).length,
    1
  );

  manager.unregisterSocket("card-socket-2");
  await sleep(40);

  assert.deepEqual(
    pickRecoveryFields(
      manager.serializeRoom(room).players.find((player) => player.userId === joiner.id)
    ),
    {
      connected: false,
      presenceState: "disconnected",
      reconnectGraceEndsAt: null
    }
  );
});

test("party room reconnect grace applies only to human seats and reconnect restores the same guest seat", async (t) => {
  resetLiveRoomState();
  t.after(resetLiveRoomState);

  const manager = getPartyRoomManager();
  manager.reconnectGraceMs = 25;

  const owner = { id: 211, username: "owner211", displayName: "Owner 211" };
  const guest = { id: "guest_party_recovery", username: "guest_party_recovery", displayName: "Guest Party" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });
  manager.joinRoom(room.roomNo, guest);
  manager.addBot(room.roomNo, owner.id, 1);

  manager.registerSocket(room.roomNo, guest.id, createSocket("party-socket-1"));
  manager.voiceJoin(room.roomNo, guest.id, false);
  manager.unregisterSocket("party-socket-1");

  const serializedAfterDisconnect = manager.serializeRoom(room, guest.id);
  const guestSeatAfterDisconnect = serializedAfterDisconnect.players.find(
    (player) => player.userId === guest.id
  );
  const botSeat = serializedAfterDisconnect.players.find((player) => player.isBot);
  const reconnectGraceEndsAt = room.players.find((player) => player.userId === guest.id).reconnectGraceEndsAt;

  assert.equal(serializedAfterDisconnect.voiceTransport.mode, "direct-preferred");
  assert.equal(serializedAfterDisconnect.voiceTransport.reconnectGraceSeconds, 45);
  assert.deepEqual(serializedAfterDisconnect.viewer.voiceRecovery, {
    autoResumeEligible: true,
    resumeMuted: true,
    rejoinBy: reconnectGraceEndsAt,
    lastMode: "direct-preferred"
  });
  assert.deepEqual(pickRecoveryFields(guestSeatAfterDisconnect), {
    connected: false,
    presenceState: "reconnecting",
    reconnectGraceEndsAt
  });
  assert.deepEqual(pickRecoveryFields(botSeat), {
    connected: true,
    presenceState: "connected",
    reconnectGraceEndsAt: null
  });
  assert.equal(botSeat.recoveryEligible, false);

  manager.registerSocket(room.roomNo, guest.id, createSocket("party-socket-2"));

  assert.equal(room.players.filter((player) => player.userId === guest.id).length, 1);
  assert.deepEqual(
    pickRecoveryFields(manager.serializeRoom(room, guest.id).viewer),
    {
      connected: true,
      presenceState: "connected",
      reconnectGraceEndsAt: null
    }
  );
  assert.deepEqual(manager.serializeRoom(room, guest.id).viewer.voiceRecovery, {
    autoResumeEligible: true,
    resumeMuted: true,
    rejoinBy: reconnectGraceEndsAt,
    lastMode: "direct-preferred"
  });

  manager.voiceJoin(room.roomNo, guest.id, true);

  assert.deepEqual(manager.serializeRoom(room, guest.id).viewer.voiceRecovery, {
    autoResumeEligible: false,
    resumeMuted: true,
    rejoinBy: null,
    lastMode: "direct-preferred"
  });
});

test("party voice recovery intent expires with the reconnect window", async (t) => {
  resetLiveRoomState();
  t.after(resetLiveRoomState);

  const manager = getPartyRoomManager();
  manager.reconnectGraceMs = 25;

  const owner = { id: 212, username: "owner212", displayName: "Owner 212" };
  const guest = { id: "guest_party_voice_expiry", username: "guest_party_voice_expiry", displayName: "Guest Voice Expiry" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });
  manager.joinRoom(room.roomNo, guest);

  manager.registerSocket(room.roomNo, guest.id, createSocket("party-socket-expiry-1"));
  manager.voiceJoin(room.roomNo, guest.id, false);
  manager.unregisterSocket("party-socket-expiry-1");

  assert.equal(manager.serializeRoom(room, guest.id).viewer.voiceRecovery.autoResumeEligible, true);

  await sleep(40);

  assert.deepEqual(manager.serializeRoom(room, guest.id).viewer.voiceRecovery, {
    autoResumeEligible: false,
    resumeMuted: true,
    rejoinBy: null,
    lastMode: "direct-preferred"
  });
});

test("board room seats expire from reconnecting to disconnected after the grace window", async (t) => {
  resetLiveRoomState();
  t.after(resetLiveRoomState);

  const manager = getBoardRoomManager();
  manager.reconnectGraceMs = 25;

  const owner = { id: 221, username: "owner221", displayName: "Owner 221" };
  const guest = { id: "guest_board_recovery", username: "guest_board_recovery", displayName: "Guest Board" };
  const room = manager.createRoom(owner, "gomoku", {
    visibility: "private",
    maxPlayers: 2
  });
  manager.joinRoom(room.roomNo, guest);

  manager.registerSocket(room.roomNo, guest.id, createSocket("board-socket-1"));
  manager.unregisterSocket("board-socket-1");

  assert.deepEqual(
    pickRecoveryFields(manager.serializeRoom(room, guest.id).viewer),
    {
      connected: false,
      presenceState: "reconnecting",
      reconnectGraceEndsAt: room.players.find((player) => player.userId === guest.id).reconnectGraceEndsAt
    }
  );

  await sleep(40);

  assert.deepEqual(
    pickRecoveryFields(manager.serializeRoom(room, guest.id).viewer),
    {
      connected: false,
      presenceState: "disconnected",
      reconnectGraceEndsAt: null
    }
  );
});

function pickRecoveryFields(value) {
  return {
    connected: value.connected,
    presenceState: value.presenceState,
    reconnectGraceEndsAt: value.reconnectGraceEndsAt
  };
}
