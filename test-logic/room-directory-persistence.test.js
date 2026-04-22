const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

function createCardTemplate(roomVisibility = "public") {
  return {
    id: 901,
    name: "phase9-snapshot",
    title: "Phase 9 Snapshot",
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

    throw new Error(`Unexpected query in room-directory-persistence.test.js: ${sql}`);
  };
}

function loadModules() {
  const root = path.resolve(__dirname, "..");
  const snapshotStore = new Map();
  const resolvedDbPath = require.resolve(path.join(root, "lib/db.js"));
  const modulePaths = [
    path.join(root, "lib/rooms/directory.js"),
    path.join(root, "lib/game/room-manager.js")
  ];

  delete global.neonCommonsRoomDirectory;
  delete global.ddzRoomManager;

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

  return {
    directory,
    roomManagerModule,
    snapshotStore
  };
}

test("room directory snapshots reload into memory and preserve shareable discovery after reset", async () => {
  const { directory, snapshotStore } = loadModules();
  const {
    registerRoomEntry,
    resolveRoomEntry,
    listShareableRoomsForUser,
    loadRoomDirectorySnapshots,
    ROOM_DIRECTORY_SNAPSHOT_SOURCES,
    __testing: directoryTesting
  } = directory;

  registerRoomEntry({
    roomNo: "901001",
    familyKey: "party",
    gameKey: "werewolf",
    title: "Snapshot Party",
    strapline: "Rehydrate test",
    detailRoute: "/party/901001",
    joinRoute: "/api/party/rooms/901001/join",
    visibility: "private",
    ownerId: 77,
    state: "waiting",
    supportsShareLink: true,
    guestAllowed: true,
    memberIds: [77, "guest_snapshot_901001"],
    updatedAt: "2026-04-22T13:45:00.000Z"
  });

  await directoryTesting.flushPersistence();
  assert.equal(snapshotStore.size, 1);

  directoryTesting.resetRoomDirectory();
  assert.equal(resolveRoomEntry("901001"), null);

  const loadedEntries = await loadRoomDirectorySnapshots();
  assert.equal(loadedEntries.length, 1);
  assert.equal(loadedEntries[0].source, ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT);

  const restored = resolveRoomEntry("901001");
  assert.equal(restored.familyKey, "party");
  assert.equal(restored.gameKey, "werewolf");
  assert.equal(restored.detailRoute, "/party/901001");
  assert.equal(restored.joinRoute, "/api/party/rooms/901001/join");
  assert.equal(restored.source, ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT);
  assert.equal(listShareableRoomsForUser(77)[0].roomNo, "901001");
  assert.equal(listShareableRoomsForUser("guest_snapshot_901001")[0].roomNo, "901001");
});

test("snapshot bootstrap restores shared directory metadata without recreating live manager rooms", async () => {
  const { directory, roomManagerModule, snapshotStore } = loadModules();
  const { loadRoomDirectorySnapshots, resolveRoomEntry, __testing: directoryTesting } = directory;
  const { getRoomManager } = roomManagerModule;

  const manager = getRoomManager();
  const owner = { id: 301, username: "owner301", displayName: "Owner 301" };
  const room = manager.createRoom(owner, createCardTemplate(), {});

  await directoryTesting.flushPersistence();
  assert.equal(snapshotStore.has(room.roomNo), true);

  directoryTesting.resetRoomDirectory();
  delete global.ddzRoomManager;

  const freshManager = getRoomManager();
  assert.equal(freshManager.getRoom(room.roomNo), undefined);

  const loadedEntries = await loadRoomDirectorySnapshots();
  const restored = loadedEntries.find((entry) => entry.roomNo === room.roomNo);

  assert.ok(restored);
  assert.equal(restored.source, "snapshot");
  assert.equal(resolveRoomEntry(room.roomNo).detailRoute, `/room/${room.roomNo}`);
  assert.equal(getRoomManager().getRoom(room.roomNo), undefined);
});
