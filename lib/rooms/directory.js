const { query } = require("../db");

const ROOM_DIRECTORY_SNAPSHOT_SOURCES = Object.freeze({
  LIVE: "live",
  SNAPSHOT: "snapshot"
});

function getRoomDirectoryStore() {
  if (!global.neonCommonsRoomDirectory) {
    global.neonCommonsRoomDirectory = {
      entries: new Map(),
      pendingWrites: new Set(),
      lastLoadedAt: null
    };
  }

  return global.neonCommonsRoomDirectory;
}

function allocateRoomNo() {
  const store = getRoomDirectoryStore();
  let roomNo = "";

  do {
    roomNo = String(Math.floor(100000 + Math.random() * 900000));
  } while (store.entries.has(roomNo));

  return roomNo;
}

function registerRoomEntry(entry) {
  const normalized = normalizeRoomEntry({
    ...entry,
    source: entry?.source || ROOM_DIRECTORY_SNAPSHOT_SOURCES.LIVE,
    restoredAt: entry?.source === ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT ? entry?.restoredAt : null
  });
  getRoomDirectoryStore().entries.set(normalized.roomNo, normalized);
  queueSnapshotWrite(persistRoomEntrySnapshot(normalized));
  return cloneRoomEntry(normalized);
}

function updateRoomEntry(roomNo, updates = {}) {
  const store = getRoomDirectoryStore();
  const current = store.entries.get(String(roomNo || "").trim());
  if (!current) {
    return null;
  }

  const normalized = normalizeRoomEntry({
    ...current,
    ...updates,
    roomNo: current.roomNo,
    source: updates?.source || ROOM_DIRECTORY_SNAPSHOT_SOURCES.LIVE,
    restoredAt:
      (updates?.source || ROOM_DIRECTORY_SNAPSHOT_SOURCES.LIVE) ===
      ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT
        ? updates?.restoredAt || current.restoredAt || null
        : null
  });
  store.entries.set(normalized.roomNo, normalized);
  queueSnapshotWrite(persistRoomEntrySnapshot(normalized));
  return cloneRoomEntry(normalized);
}

function unregisterRoomEntry(roomNo) {
  const normalizedRoomNo = String(roomNo || "").trim();
  const removed = getRoomDirectoryStore().entries.delete(normalizedRoomNo);
  if (normalizedRoomNo) {
    queueSnapshotWrite(deleteRoomEntrySnapshot(normalizedRoomNo));
  }
  return removed;
}

function resolveRoomEntry(roomNo, options = {}) {
  const entry = getRoomDirectoryStore().entries.get(String(roomNo || "").trim());
  if (!entry) {
    return null;
  }

  const gameKeyHint = String(options.gameKeyHint || "").trim();
  if (gameKeyHint && entry.gameKey !== gameKeyHint) {
    return null;
  }

  return cloneRoomEntry(entry);
}

function getRoomEntryAvailability(entry) {
  return entry?.source === ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT
    ? "snapshot-only"
    : "live";
}

function listPublicRoomEntries() {
  return [...getRoomDirectoryStore().entries.values()]
    .filter((entry) => entry.visibility !== "private")
    .map((entry) => cloneRoomEntry(entry));
}

function listShareableRoomsForUser(userId) {
  if (userId === undefined || userId === null || userId === "") {
    return [];
  }

  return [...getRoomDirectoryStore().entries.values()]
    .filter(
      (entry) =>
        entry.supportsShareLink &&
        (entry.ownerId === userId || entry.memberIds.some((memberId) => memberId === userId))
    )
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))
    .map((entry) => cloneRoomEntry(entry));
}

function normalizeRoomEntry(entry = {}) {
  const roomNo = String(entry.roomNo || "").trim();
  if (!roomNo) {
    throw new Error("roomNo 為必填");
  }

  const updatedAt = normalizeIsoTimestamp(entry.updatedAt);
  const lastActiveAt = normalizeIsoTimestamp(entry.lastActiveAt || updatedAt);
  const source =
    String(entry.source || "").trim() === ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT
      ? ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT
      : ROOM_DIRECTORY_SNAPSHOT_SOURCES.LIVE;

  return {
    roomNo,
    familyKey: String(entry.familyKey || "").trim(),
    gameKey: String(entry.gameKey || "").trim(),
    title: String(entry.title || "").trim(),
    strapline: String(entry.strapline || "").trim(),
    detailRoute: String(entry.detailRoute || "").trim(),
    joinRoute: String(entry.joinRoute || "").trim(),
    visibility: entry.visibility === "private" ? "private" : "public",
    ownerId: entry.ownerId ?? null,
    state: String(entry.state || "waiting").trim(),
    supportsShareLink: Boolean(entry.supportsShareLink),
    guestAllowed: Boolean(entry.guestAllowed),
    memberIds: dedupeIds(entry.memberIds || []),
    updatedAt,
    lastActiveAt,
    source,
    restoredAt:
      source === ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT
        ? normalizeOptionalIsoTimestamp(entry.restoredAt)
        : null
  };
}

function dedupeIds(values) {
  const seen = new Set();
  const deduped = [];

  for (const value of Array.isArray(values) ? values : []) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    const key = `${typeof value}:${String(value)}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(value);
  }

  return deduped;
}

function cloneRoomEntry(entry) {
  return {
    ...entry,
    memberIds: [...entry.memberIds]
  };
}

function normalizeIsoTimestamp(value) {
  const parsed = Date.parse(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  return new Date().toISOString();
}

function normalizeOptionalIsoTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function restoreStoredScalar(value) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  return /^\d+$/.test(value) ? Number(value) : value;
}

function queueSnapshotWrite(promise) {
  const store = getRoomDirectoryStore();
  store.pendingWrites.add(promise);
  promise.finally(() => {
    store.pendingWrites.delete(promise);
  });
  return promise;
}

async function persistRoomEntrySnapshot(entry) {
  try {
    await query(
      `
        INSERT INTO room_directory_snapshots (
          room_no,
          family_key,
          game_key,
          title,
          strapline,
          detail_route,
          join_route,
          visibility,
          owner_id,
          room_state,
          supports_share_link,
          guest_allowed,
          member_ids,
          last_active_at,
          source,
          restored_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (room_no)
        DO UPDATE SET
          family_key = EXCLUDED.family_key,
          game_key = EXCLUDED.game_key,
          title = EXCLUDED.title,
          strapline = EXCLUDED.strapline,
          detail_route = EXCLUDED.detail_route,
          join_route = EXCLUDED.join_route,
          visibility = EXCLUDED.visibility,
          owner_id = EXCLUDED.owner_id,
          room_state = EXCLUDED.room_state,
          supports_share_link = EXCLUDED.supports_share_link,
          guest_allowed = EXCLUDED.guest_allowed,
          member_ids = EXCLUDED.member_ids,
          last_active_at = EXCLUDED.last_active_at,
          source = EXCLUDED.source,
          restored_at = EXCLUDED.restored_at,
          updated_at = NOW()
      `,
      [
        entry.roomNo,
        entry.familyKey,
        entry.gameKey,
        entry.title,
        entry.strapline,
        entry.detailRoute,
        entry.joinRoute,
        entry.visibility,
        entry.ownerId == null ? null : String(entry.ownerId),
        entry.state,
        entry.supportsShareLink,
        entry.guestAllowed,
        JSON.stringify(entry.memberIds),
        entry.lastActiveAt || entry.updatedAt,
        entry.source,
        entry.restoredAt
      ]
    );
  } catch (error) {
    reportRoomDirectoryPersistenceError("persist", error);
  }
}

async function deleteRoomEntrySnapshot(roomNo) {
  try {
    await query("DELETE FROM room_directory_snapshots WHERE room_no = $1", [roomNo]);
  } catch (error) {
    reportRoomDirectoryPersistenceError("delete", error);
  }
}

function reportRoomDirectoryPersistenceError(operation, error) {
  console.error(`[room-directory] snapshot ${operation} failed`, error);
}

async function loadRoomDirectorySnapshots(options = {}) {
  if (Number.isFinite(options.pruneOlderThanMs) && options.pruneOlderThanMs > 0) {
    await pruneRoomDirectorySnapshots(options.pruneOlderThanMs);
  }

  const restoredAt = new Date().toISOString();
  const result = await query(
    `
      UPDATE room_directory_snapshots
      SET source = $1, restored_at = NOW()
      RETURNING
        room_no,
        family_key,
        game_key,
        title,
        strapline,
        detail_route,
        join_route,
        visibility,
        owner_id,
        room_state,
        supports_share_link,
        guest_allowed,
        member_ids,
        last_active_at,
        source,
        restored_at,
        updated_at
    `,
    [ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT]
  );
  const store = getRoomDirectoryStore();
  store.entries.clear();

  for (const row of result.rows) {
    const entry = normalizeRoomEntry({
      roomNo: row.room_no,
      familyKey: row.family_key,
      gameKey: row.game_key,
      title: row.title,
      strapline: row.strapline,
      detailRoute: row.detail_route,
      joinRoute: row.join_route,
      visibility: row.visibility,
      ownerId: restoreStoredScalar(row.owner_id),
      state: row.room_state,
      supportsShareLink: row.supports_share_link,
      guestAllowed: row.guest_allowed,
      memberIds: Array.isArray(row.member_ids) ? row.member_ids : [],
      updatedAt: row.last_active_at || row.updated_at,
      lastActiveAt: row.last_active_at || row.updated_at,
      source: ROOM_DIRECTORY_SNAPSHOT_SOURCES.SNAPSHOT,
      restoredAt: row.restored_at || restoredAt
    });
    store.entries.set(entry.roomNo, entry);
  }

  store.lastLoadedAt = restoredAt;
  return [...store.entries.values()].map((entry) => cloneRoomEntry(entry));
}

async function pruneRoomDirectorySnapshots(maxAgeMs, nowMs = Date.now()) {
  if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) {
    return [];
  }

  const cutoff = new Date(nowMs - maxAgeMs).toISOString();
  const result = await query(
    `
      DELETE FROM room_directory_snapshots
      WHERE last_active_at < $1
      RETURNING room_no
    `,
    [cutoff]
  );
  const removedRoomNos = result.rows.map((row) => String(row.room_no || "").trim()).filter(Boolean);
  const store = getRoomDirectoryStore();

  for (const roomNo of removedRoomNos) {
    store.entries.delete(roomNo);
  }

  return removedRoomNos;
}

async function flushRoomDirectoryPersistence() {
  const store = getRoomDirectoryStore();
  const pending = [...store.pendingWrites];
  if (pending.length === 0) {
    return;
  }

  await Promise.allSettled(pending);
}

async function clearPersistedRoomDirectorySnapshots() {
  await flushRoomDirectoryPersistence();
  await query("DELETE FROM room_directory_snapshots");
}

module.exports = {
  allocateRoomNo,
  registerRoomEntry,
  updateRoomEntry,
  unregisterRoomEntry,
  resolveRoomEntry,
  getRoomEntryAvailability,
  listPublicRoomEntries,
  listShareableRoomsForUser,
  loadRoomDirectorySnapshots,
  flushRoomDirectoryPersistence,
  pruneRoomDirectorySnapshots,
  ROOM_DIRECTORY_SNAPSHOT_SOURCES,
  __testing: {
    resetRoomDirectory() {
      const store = getRoomDirectoryStore();
      store.entries.clear();
      store.lastLoadedAt = null;
    },
    listEntries() {
      return [...getRoomDirectoryStore().entries.values()].map((entry) => cloneRoomEntry(entry));
    },
    async flushPersistence() {
      await flushRoomDirectoryPersistence();
    },
    async clearPersistedSnapshots() {
      await clearPersistedRoomDirectorySnapshots();
    }
  }
};
