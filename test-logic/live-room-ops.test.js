const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

function createSnapshotQueryMock(snapshotStore) {
  return async (text, params = []) => {
    const sql = String(text);

    if (sql.includes("INSERT INTO room_directory_snapshots")) {
      const row = {
        room_no: params[0],
        family_key: params[1],
        game_key: params[2],
        title: params[3],
        strapline: params[4],
        detail_route: params[5],
        join_route: params[6],
        visibility: params[7],
        owner_id: params[8],
        room_state: params[9],
        supports_share_link: params[10],
        guest_allowed: params[11],
        member_ids: JSON.parse(params[12]),
        last_active_at: params[13],
        source: params[14],
        restored_at: params[15],
        updated_at: new Date().toISOString()
      };
      snapshotStore.set(row.room_no, row);
      return { rowCount: 1, rows: [row] };
    }

    if (sql.includes("DELETE FROM room_directory_snapshots WHERE room_no = $1")) {
      const deleted = snapshotStore.delete(params[0]);
      return { rowCount: deleted ? 1 : 0, rows: [] };
    }

    if (sql.trim() === "DELETE FROM room_directory_snapshots") {
      const count = snapshotStore.size;
      snapshotStore.clear();
      return { rowCount: count, rows: [] };
    }

    throw new Error(`Unexpected query in live-room-ops.test.js: ${sql}`);
  };
}

function createCardTemplate(roomVisibility = "public") {
  return {
    id: 903,
    name: "phase10-live-room-ops",
    title: "Phase 10 Live Ops",
    mode: "CLASSIC",
    settings: {
      baseScore: 40,
      countdownSeconds: 18,
      autoTrusteeMinSeconds: 2,
      autoTrusteeMaxSeconds: 5,
      roomVisibility
    }
  };
}

function loadModules() {
  const root = path.resolve(__dirname, "..");
  const snapshotStore = new Map();
  const resolvedDbPath = require.resolve(path.join(root, "lib/db.js"));
  const modulePaths = [
    path.join(root, "lib/rooms/directory.js"),
    path.join(root, "lib/game/room-manager.js"),
    path.join(root, "lib/party/manager.js"),
    path.join(root, "lib/board/manager.js"),
    path.join(root, "lib/admin/live-room-ops.js")
  ];

  delete global.neonCommonsRoomDirectory;
  delete global.ddzRoomManager;
  delete global.partyRoomManager;
  delete global.boardRoomManager;

  for (const modulePath of modulePaths) {
    delete require.cache[require.resolve(modulePath)];
  }

  require.cache[resolvedDbPath] = {
    id: resolvedDbPath,
    filename: resolvedDbPath,
    loaded: true,
    exports: {
      query: createSnapshotQueryMock(snapshotStore)
    }
  };

  const directory = require(path.join(root, "lib/rooms/directory.js"));
  const roomManagerModule = require(path.join(root, "lib/game/room-manager.js"));
  const partyManagerModule = require(path.join(root, "lib/party/manager.js"));
  const liveRoomOps = require(path.join(root, "lib/admin/live-room-ops.js"));

  return {
    directory,
    roomManagerModule,
    partyManagerModule,
    liveRoomOps,
    snapshotStore,
    cleanup() {
      delete global.neonCommonsRoomDirectory;
      delete global.ddzRoomManager;
      delete global.partyRoomManager;
      delete global.boardRoomManager;

      for (const modulePath of modulePaths) {
        delete require.cache[require.resolve(modulePath)];
      }
      delete require.cache[resolvedDbPath];
    }
  };
}

test("live-room ops list shows live and snapshot-only rooms with actionable detail states", async (t) => {
  const { directory, roomManagerModule, liveRoomOps, cleanup } = loadModules();
  t.after(cleanup);

  const {
    ROOM_DIRECTORY_SNAPSHOT_SOURCES,
    __testing: directoryTesting,
    registerRoomEntry
  } = directory;
  const { getRoomManager } = roomManagerModule;
  const { getLiveRoomDetail, listLiveRooms } = liveRoomOps;

  const manager = getRoomManager();
  const owner = { id: 501, username: "owner501", displayName: "Owner 501" };
  const liveRoom = manager.createRoom(owner, createCardTemplate("private"), {});
  await directoryTesting.flushPersistence();

  registerRoomEntry({
    roomNo: "931001",
    familyKey: "party",
    gameKey: "werewolf",
    title: "Recovered Snapshot",
    strapline: "Single-node restart",
    detailRoute: "/party/931001",
    joinRoute: "/api/party/rooms/931001/join",
    visibility: "private",
    ownerId: 777,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: true,
    memberIds: [777, "guest_snapshot_931001"],
    source: ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT,
    restoredAt: new Date().toISOString()
  });

  const items = listLiveRooms();
  assert.equal(items.some((item) => item.roomNo === liveRoom.roomNo && item.availability === "live"), true);
  assert.equal(items.some((item) => item.roomNo === "931001" && item.availability === "snapshot-only"), true);

  const snapshotDetail = getLiveRoomDetail("931001");
  assert.equal(snapshotDetail.actions.drain, false);
  assert.equal(snapshotDetail.actions.close, false);
  assert.equal(snapshotDetail.occupants.length, 2);
});

test("snapshot room detail keeps owner badge when member ids are stored as strings", async (t) => {
  const { directory, liveRoomOps, cleanup } = loadModules();
  t.after(cleanup);

  const {
    ROOM_DIRECTORY_SNAPSHOT_SOURCES,
    registerRoomEntry
  } = directory;
  const { getLiveRoomDetail } = liveRoomOps;

  registerRoomEntry({
    roomNo: "931002",
    familyKey: "party",
    gameKey: "undercover",
    title: "Recovered String Owner",
    strapline: "Owner id normalization",
    detailRoute: "/undercover/931002",
    joinRoute: "/api/party/rooms/931002/join",
    visibility: "private",
    ownerId: 901,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: true,
    memberIds: ["901", "guest_snapshot_931002"],
    source: ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT,
    restoredAt: new Date().toISOString()
  });

  const snapshotDetail = getLiveRoomDetail("931002");
  assert.equal(snapshotDetail.occupants[0].occupantId, "901");
  assert.equal(snapshotDetail.occupants[0].isOwner, true);
});

test("drain blocks new joins and close returns a closed detail payload", async (t) => {
  const { directory, partyManagerModule, liveRoomOps, cleanup } = loadModules();
  t.after(cleanup);

  const { __testing: directoryTesting } = directory;
  const { getPartyRoomManager } = partyManagerModule;
  const { ROOM_ACTIONS, getLiveRoomDetail, performRoomAction } = liveRoomOps;

  const manager = getPartyRoomManager();
  const owner = { id: 511, username: "owner511", displayName: "Owner 511" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });
  await directoryTesting.flushPersistence();

  const drained = performRoomAction(room.roomNo, ROOM_ACTIONS.DRAIN);
  assert.equal(drained.availability, "draining");
  assert.equal(getLiveRoomDetail(room.roomNo).availability, "draining");

  assert.throws(
    () =>
      manager.joinRoom(room.roomNo, {
        id: 512,
        username: "joiner512",
        displayName: "Joiner 512"
      }),
    /排空中/
  );

  const closed = performRoomAction(room.roomNo, ROOM_ACTIONS.CLOSE);
  assert.equal(closed.availability, "closed");
  assert.equal(manager.getRoom(room.roomNo), undefined);
});

test("removing an occupant rewrites room detail without duplicating survivors", async (t) => {
  const { directory, roomManagerModule, liveRoomOps, cleanup } = loadModules();
  t.after(cleanup);

  const { __testing: directoryTesting } = directory;
  const { getRoomManager } = roomManagerModule;
  const { getLiveRoomDetail, removeRoomOccupant } = liveRoomOps;

  const manager = getRoomManager();
  const owner = { id: 521, username: "owner521", displayName: "Owner 521" };
  const joiner = { id: 522, username: "joiner522", displayName: "Joiner 522" };
  const room = manager.createRoom(owner, createCardTemplate("private"), {});
  manager.joinRoom(room.roomNo, joiner);
  await directoryTesting.flushPersistence();

  const detail = removeRoomOccupant(room.roomNo, joiner.id);
  assert.equal(detail.availability, "live");
  assert.equal(detail.occupants.length, 1);
  assert.equal(detail.occupants[0].occupantId, String(owner.id));
  assert.equal(
    getLiveRoomDetail(room.roomNo).occupants.filter(
      (occupant) => occupant.occupantId === String(owner.id)
    ).length,
    1
  );
});

test("live-room detail marks reconnecting occupants and runtime counters consistently", async (t) => {
  const { directory, roomManagerModule, liveRoomOps, cleanup } = loadModules();
  t.after(cleanup);

  const { __testing: directoryTesting } = directory;
  const { getRoomManager } = roomManagerModule;
  const { getLiveRoomDetail } = liveRoomOps;

  const manager = getRoomManager();
  const owner = { id: 531, username: "owner531", displayName: "Owner 531" };
  const joiner = { id: 532, username: "joiner532", displayName: "Joiner 532" };
  const room = manager.createRoom(owner, createCardTemplate("private"), {});
  manager.joinRoom(room.roomNo, joiner);
  manager.registerSocket(room.roomNo, joiner.id, {
    id: "socket-reconnect-532",
    join() {}
  });
  manager.unregisterSocket("socket-reconnect-532");
  await directoryTesting.flushPersistence();

  const detail = getLiveRoomDetail(room.roomNo);
  const reconnectingOccupant = detail.occupants.find(
    (occupant) => occupant.occupantId === String(joiner.id)
  );

  assert.equal(reconnectingOccupant?.presenceState, "reconnecting");
  assert.equal(detail.runtimeHealth.reconnectingHumans, 1);
  assert.equal(detail.runtimeHealth.disconnectedHumans, 0);
});

test("party live-room detail exposes operator-safe voice diagnostics", async (t) => {
  const { directory, partyManagerModule, liveRoomOps, cleanup } = loadModules();
  t.after(cleanup);

  const { __testing: directoryTesting } = directory;
  const { getPartyRoomManager } = partyManagerModule;
  const { getLiveRoomDetail } = liveRoomOps;

  const manager = getPartyRoomManager();
  const owner = { id: 541, username: "owner541", displayName: "Owner 541" };
  const joiner = { id: 542, username: "joiner542", displayName: "Joiner 542" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8,
    voiceEnabled: true
  });
  manager.joinRoom(room.roomNo, joiner);
  manager.reportVoiceTransport(room.roomNo, owner.id, { reason: "ice-failed" });
  await directoryTesting.flushPersistence();

  const detail = getLiveRoomDetail(room.roomNo);
  assert.equal(detail.familyKey, "party");
  assert.equal(detail.voiceDiagnostics.mode, "relay-required");
  assert.equal(detail.voiceDiagnostics.runtimeState, "degraded");
  assert.equal(detail.voiceDiagnostics.lastReasonCode, "voice-ice-failed");
  assert.equal(detail.voiceDiagnostics.reconnectGraceSeconds > 0, true);
  assert.equal(detail.voiceDiagnostics.degradedState.state, "degraded");
  assert.equal(detail.voiceDiagnostics.degradedState.reasonCode, "voice-ice-failed");
  assert.equal(Array.isArray(detail.voiceDiagnostics.degradedState.safeActions), true);
  assert.equal("iceServers" in detail.voiceDiagnostics, false);
});
