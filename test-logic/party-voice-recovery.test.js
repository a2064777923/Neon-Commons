const test = require("node:test");
const assert = require("node:assert/strict");

const { __testing: directoryTesting } = require("../lib/rooms/directory");
const { getDefaultAvailabilityControls } = require("../lib/shared/availability");

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

test("startup-timeout promotes party rooms into relay-required diagnostics", (t) => {
  resetPartyRoomState();
  t.after(resetPartyRoomState);

  const { getPartyRoomManager } = loadFreshModule("../lib/party/manager");
  const manager = getPartyRoomManager();
  const owner = { id: 1201, username: "owner1201", displayName: "Owner 1201" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });

  manager.reportVoiceTransport(room.roomNo, owner.id, {
    reason: "startup-timeout"
  });

  const serialized = manager.serializeRoom(room, owner.id);

  assert.equal(serialized.voiceDiagnostics.mode, "relay-required");
  assert.equal(serialized.voiceDiagnostics.stickyRelay, true);
  assert.equal(serialized.voiceDiagnostics.runtimeState, "degraded");
  assert.equal(serialized.voiceDiagnostics.lastReasonCode, "voice-startup-timeout");
  assert.ok(serialized.voiceDiagnostics.lastTransitionAt);
  assert.equal(serialized.voiceDiagnostics.lastRecoveredAt, null);
  assert.equal(serialized.voiceDiagnostics.resumeMutedOnRecovery, true);
  assert.equal(serialized.voiceDiagnostics.reconnectGraceSeconds, 45);
});

test("persistent disconnect keeps relay sticky across reconnects for the same room visit", (t) => {
  resetPartyRoomState();
  t.after(resetPartyRoomState);

  const { getPartyRoomManager } = loadFreshModule("../lib/party/manager");
  const manager = getPartyRoomManager();
  manager.reconnectGraceMs = 25;

  const owner = { id: 1202, username: "owner1202", displayName: "Owner 1202" };
  const guest = { id: 1203, username: "guest1203", displayName: "Guest 1203" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });

  manager.joinRoom(room.roomNo, guest);
  manager.registerSocket(room.roomNo, guest.id, createSocket("party-voice-sticky-1"));
  manager.voiceJoin(room.roomNo, guest.id, false);
  manager.reportVoiceTransport(room.roomNo, guest.id, {
    reason: "persistent-disconnect"
  });
  manager.unregisterSocket("party-voice-sticky-1");
  manager.registerSocket(room.roomNo, guest.id, createSocket("party-voice-sticky-2"));

  const serialized = manager.serializeRoom(room, guest.id);

  assert.equal(serialized.voiceDiagnostics.mode, "relay-required");
  assert.equal(serialized.voiceDiagnostics.lastReasonCode, "voice-persistent-disconnect");
  assert.equal(serialized.viewer.voiceRecovery.autoResumeEligible, true);
  assert.equal(serialized.viewer.voiceRecovery.lastMode, "relay-required");
});

test("reconnect within grace keeps muted auto-resume eligibility and stamps recovery time on rejoin", (t) => {
  resetPartyRoomState();
  t.after(resetPartyRoomState);

  const { getPartyRoomManager } = loadFreshModule("../lib/party/manager");
  const manager = getPartyRoomManager();
  manager.reconnectGraceMs = 25;

  const owner = { id: 1204, username: "owner1204", displayName: "Owner 1204" };
  const guest = { id: 1205, username: "guest1205", displayName: "Guest 1205" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });

  manager.joinRoom(room.roomNo, guest);
  manager.registerSocket(room.roomNo, guest.id, createSocket("party-voice-recover-1"));
  manager.voiceJoin(room.roomNo, guest.id, false);
  manager.reportVoiceTransport(room.roomNo, guest.id, {
    reason: "startup-timeout"
  });
  manager.unregisterSocket("party-voice-recover-1");

  const serializedAfterDisconnect = manager.serializeRoom(room, guest.id);
  assert.deepEqual(serializedAfterDisconnect.viewer.voiceRecovery, {
    autoResumeEligible: true,
    resumeMuted: true,
    rejoinBy: room.players.find((player) => player.userId === guest.id).reconnectGraceEndsAt,
    lastMode: "relay-required"
  });
  assert.equal(serializedAfterDisconnect.voiceDiagnostics.lastRecoveredAt, null);

  manager.registerSocket(room.roomNo, guest.id, createSocket("party-voice-recover-2"));
  assert.equal(manager.serializeRoom(room, guest.id).viewer.voiceRecovery.autoResumeEligible, true);

  manager.voiceJoin(room.roomNo, guest.id, true);

  const serializedAfterRecovery = manager.serializeRoom(room, guest.id);
  assert.equal(serializedAfterRecovery.viewer.voiceRecovery.autoResumeEligible, false);
  assert.ok(serializedAfterRecovery.voiceDiagnostics.lastRecoveredAt);
});

test("reconnect after grace clears muted auto-resume eligibility", async (t) => {
  resetPartyRoomState();
  t.after(resetPartyRoomState);

  const { getPartyRoomManager } = loadFreshModule("../lib/party/manager");
  const manager = getPartyRoomManager();
  manager.reconnectGraceMs = 25;

  const owner = { id: 1206, username: "owner1206", displayName: "Owner 1206" };
  const guest = { id: 1207, username: "guest1207", displayName: "Guest 1207" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });

  manager.joinRoom(room.roomNo, guest);
  manager.registerSocket(room.roomNo, guest.id, createSocket("party-voice-expire-1"));
  manager.voiceJoin(room.roomNo, guest.id, false);
  manager.unregisterSocket("party-voice-expire-1");

  await sleep(40);

  const serialized = manager.serializeRoom(room, guest.id);
  assert.deepEqual(serialized.viewer.voiceRecovery, {
    autoResumeEligible: false,
    resumeMuted: true,
    rejoinBy: null,
    lastMode: "direct-preferred"
  });
  assert.equal(serialized.voiceDiagnostics.lastRecoveredAt, null);
});

test("operator-blocked voice prevents joins even after relay fallback is available", async (t) => {
  resetPartyRoomState();
  t.after(resetPartyRoomState);

  const controls = getDefaultAvailabilityControls();
  controls.families.party.voice = {
    state: "blocked",
    reasonCode: "party-voice-maintenance",
    message: "語音維護中，請先文字溝通。",
    safeActions: ["continue-text-only", "wait"],
    configured: true
  };

  await withPatchedModuleExports(
    [
      [
        "../lib/admin/control-plane",
        {
          getAvailabilityControlsSync: () => controls
        }
      ]
    ],
    async () => {
      const { getPartyRoomManager } = loadFreshModule("../lib/party/manager");
      const manager = getPartyRoomManager();
      const owner = { id: 1208, username: "owner1208", displayName: "Owner 1208" };
      const room = manager.createRoom(owner, "werewolf", {
        visibility: "private",
        maxPlayers: 8
      });

      manager.reportVoiceTransport(room.roomNo, owner.id, {
        reason: "startup-timeout"
      });

      assert.throws(() => {
        manager.voiceJoin(room.roomNo, owner.id, false);
      }, /語音|文字溝通/);

      const serialized = manager.serializeRoom(room, owner.id);
      assert.equal(serialized.voiceDiagnostics.mode, "relay-required");
      assert.equal(serialized.degradedState.subsystems.voice.state, "blocked");
    }
  );
});

function loadFreshModule(modulePath) {
  const resolved = require.resolve(modulePath, { paths: [__dirname] });
  delete require.cache[resolved];
  return require(resolved);
}

async function withPatchedModuleExports(patches, run) {
  const originals = [];

  try {
    for (const [modulePath, overrides] of patches) {
      const resolved = require.resolve(modulePath, { paths: [__dirname] });
      const loaded = require(resolved);
      const snapshot = {};

      for (const [key, value] of Object.entries(overrides)) {
        snapshot[key] = loaded[key];
        loaded[key] = value;
      }

      originals.push({ loaded, snapshot });
    }

    return await run();
  } finally {
    for (const { loaded, snapshot } of originals.reverse()) {
      for (const [key, value] of Object.entries(snapshot)) {
        loaded[key] = value;
      }
    }
  }
}

function clearTimerMap(timerMap) {
  if (!timerMap) {
    return;
  }

  for (const timer of timerMap.values()) {
    clearTimeout(timer);
  }
  timerMap.clear();
}

function resetPartyRoomState() {
  clearTimerMap(global.partyRoomManager?.reconnectTimers);
  clearTimerMap(global.partyRoomManager?.roomExpiryTimers);
  directoryTesting.resetRoomDirectory();
  delete global.partyRoomManager;
}
