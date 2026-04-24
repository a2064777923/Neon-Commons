const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

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

    if (sql.includes("DELETE FROM room_directory_snapshots") && sql.includes("RETURNING room_no")) {
      const cutoffMs = Date.parse(params[0]);
      const rows = [];
      for (const [roomNo, row] of [...snapshotStore.entries()]) {
        if (Date.parse(row.last_active_at) < cutoffMs) {
          rows.push({ room_no: roomNo });
          snapshotStore.delete(roomNo);
        }
      }
      return { rowCount: rows.length, rows };
    }

    if (sql.trim() === "DELETE FROM room_directory_snapshots") {
      const count = snapshotStore.size;
      snapshotStore.clear();
      return { rowCount: count, rows: [] };
    }

    if (
      sql.includes("UPDATE room_directory_snapshots") &&
      sql.includes("SET source = $1, restored_at = NOW()") &&
      sql.includes("RETURNING")
    ) {
      const restoredAt = new Date().toISOString();
      const rows = [...snapshotStore.values()].map((row) => {
        const updated = {
          ...row,
          source: params[0],
          restored_at: restoredAt
        };
        snapshotStore.set(updated.room_no, updated);
        return updated;
      });
      return { rowCount: rows.length, rows };
    }

    throw new Error(`Unexpected query in room-expiry.test.js: ${sql}`);
  };
}

function createCardTemplate(roomVisibility = "public") {
  return {
    id: 902,
    name: "phase9-expiry",
    title: "Phase 9 Expiry",
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

function loadModules(roomExpiryMs = 30) {
  const root = path.resolve(__dirname, "..");
  const snapshotStore = new Map();
  const resolvedDbPath = require.resolve(path.join(root, "lib/db.js"));
  const resolvedSystemConfigPath = require.resolve(path.join(root, "lib/system-config.js"));
  const modulePaths = [
    path.join(root, "lib/rooms/directory.js"),
    path.join(root, "lib/game/room-manager.js"),
    path.join(root, "lib/party/manager.js"),
    path.join(root, "lib/board/manager.js")
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

  require.cache[resolvedSystemConfigPath] = {
    id: resolvedSystemConfigPath,
    filename: resolvedSystemConfigPath,
    loaded: true,
    exports: {
      getRoomExpiryMs: () => roomExpiryMs,
      getPartyVoiceTransportConfig: () => ({
        stickyRelay: true,
        startupProbeMs: 4000,
        persistentFailureMs: 6000,
        reconnectGraceSeconds: 45,
        resumeMutedOnRecovery: true,
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" }
        ]
      })
    }
  };

  const directory = require(path.join(root, "lib/rooms/directory.js"));
  const roomManagerModule = require(path.join(root, "lib/game/room-manager.js"));
  const partyManagerModule = require(path.join(root, "lib/party/manager.js"));
  const boardManagerModule = require(path.join(root, "lib/board/manager.js"));

  return {
    directory,
    roomManagerModule,
    partyManagerModule,
    boardManagerModule,
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
      delete require.cache[resolvedSystemConfigPath];
    }
  };
}

async function flushAndSleep(directoryTesting, ms) {
  await sleep(ms);
  await directoryTesting.flushPersistence();
}

test("waiting card rooms expire after reconnect grace plus shared room-expiry window", async (t) => {
  const { directory, roomManagerModule, snapshotStore, cleanup } = loadModules(25);
  t.after(cleanup);

  const { resolveRoomEntry, __testing: directoryTesting } = directory;
  const { getRoomManager } = roomManagerModule;

  const manager = getRoomManager();
  manager.reconnectGraceMs = 20;

  const owner = { id: 401, username: "owner401", displayName: "Owner 401" };
  const room = manager.createRoom(owner, createCardTemplate(), {});

  await directoryTesting.flushPersistence();
  assert.equal(snapshotStore.has(room.roomNo), true);

  manager.registerSocket(room.roomNo, owner.id, createSocket("card-expiry-1"));
  manager.unregisterSocket("card-expiry-1");

  await flushAndSleep(directoryTesting, 15);
  assert.notEqual(manager.getRoom(room.roomNo), undefined);
  assert.equal(snapshotStore.has(room.roomNo), true);

  await flushAndSleep(directoryTesting, 45);
  assert.equal(manager.getRoom(room.roomNo), undefined);
  assert.equal(resolveRoomEntry(room.roomNo), null);
  assert.equal(snapshotStore.has(room.roomNo), false);
});

test("completed board rooms still close immediately once reconnect grace fully expires", async (t) => {
  const { directory, boardManagerModule, snapshotStore, cleanup } = loadModules(80);
  t.after(cleanup);

  const { __testing: directoryTesting } = directory;
  const { getBoardRoomManager } = boardManagerModule;

  const manager = getBoardRoomManager();
  manager.reconnectGraceMs = 20;

  const owner = { id: 411, username: "owner411", displayName: "Owner 411" };
  const room = manager.createRoom(owner, "gomoku", {
    visibility: "private",
    maxPlayers: 2
  });
  room.lastResult = { winnerUserId: owner.id };

  await directoryTesting.flushPersistence();
  manager.registerSocket(room.roomNo, owner.id, createSocket("board-expiry-1"));
  manager.unregisterSocket("board-expiry-1");

  await flushAndSleep(directoryTesting, 35);
  assert.equal(manager.getRoom(room.roomNo), undefined);
  assert.equal(snapshotStore.has(room.roomNo), false);
});

test("party rooms cancel stale expiry when a human reconnects before the timer fires", async (t) => {
  const { directory, partyManagerModule, snapshotStore, cleanup } = loadModules(30);
  t.after(cleanup);

  const { resolveRoomEntry, __testing: directoryTesting } = directory;
  const { getPartyRoomManager } = partyManagerModule;

  const manager = getPartyRoomManager();
  manager.reconnectGraceMs = 20;

  const owner = { id: 421, username: "owner421", displayName: "Owner 421" };
  const room = manager.createRoom(owner, "werewolf", {
    visibility: "private",
    maxPlayers: 8
  });

  await directoryTesting.flushPersistence();
  manager.registerSocket(room.roomNo, owner.id, createSocket("party-expiry-1"));
  manager.unregisterSocket("party-expiry-1");

  await flushAndSleep(directoryTesting, 28);
  manager.registerSocket(room.roomNo, owner.id, createSocket("party-expiry-2"));

  await flushAndSleep(directoryTesting, 40);
  assert.notEqual(manager.getRoom(room.roomNo), undefined);
  assert.notEqual(resolveRoomEntry(room.roomNo), null);
  assert.equal(snapshotStore.has(room.roomNo), true);
});

test("pruneRoomDirectorySnapshots removes stale in-memory and persisted snapshot entries together", async (t) => {
  const { directory, snapshotStore, cleanup } = loadModules(30);
  t.after(cleanup);

  const {
    registerRoomEntry,
    resolveRoomEntry,
    pruneRoomDirectorySnapshots,
    __testing: directoryTesting
  } = directory;

  registerRoomEntry({
    roomNo: "940001",
    familyKey: "party",
    gameKey: "werewolf",
    title: "Expired Snapshot",
    strapline: "Old room",
    detailRoute: "/party/940001",
    joinRoute: "/api/party/rooms/940001/join",
    visibility: "private",
    ownerId: 77,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: true,
    memberIds: [77],
    updatedAt: "2026-04-22T10:00:00.000Z",
    lastActiveAt: "2026-04-22T10:00:00.000Z"
  });

  registerRoomEntry({
    roomNo: "940002",
    familyKey: "board",
    gameKey: "gomoku",
    title: "Fresh Snapshot",
    strapline: "Live enough",
    detailRoute: "/board/940002",
    joinRoute: "/api/board/rooms/940002/join",
    visibility: "public",
    ownerId: 78,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: true,
    memberIds: [78],
    updatedAt: "2026-04-22T12:45:00.000Z",
    lastActiveAt: "2026-04-22T12:45:00.000Z"
  });

  await directoryTesting.flushPersistence();
  assert.equal(snapshotStore.size, 2);

  const removedRoomNos = await pruneRoomDirectorySnapshots(
    30 * 60 * 1000,
    Date.parse("2026-04-22T13:00:00.000Z")
  );

  assert.deepEqual(removedRoomNos, ["940001"]);
  assert.equal(resolveRoomEntry("940001"), null);
  assert.notEqual(resolveRoomEntry("940002"), null);
  assert.equal(snapshotStore.has("940001"), false);
  assert.equal(snapshotStore.has("940002"), true);
});
