function getRoomDirectoryStore() {
  if (!global.neonCommonsRoomDirectory) {
    global.neonCommonsRoomDirectory = {
      entries: new Map()
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
  const normalized = normalizeRoomEntry(entry);
  getRoomDirectoryStore().entries.set(normalized.roomNo, normalized);
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
    roomNo: current.roomNo
  });
  store.entries.set(normalized.roomNo, normalized);
  return cloneRoomEntry(normalized);
}

function unregisterRoomEntry(roomNo) {
  return getRoomDirectoryStore().entries.delete(String(roomNo || "").trim());
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
    updatedAt: entry.updatedAt || new Date().toISOString()
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

module.exports = {
  allocateRoomNo,
  registerRoomEntry,
  updateRoomEntry,
  unregisterRoomEntry,
  resolveRoomEntry,
  listShareableRoomsForUser,
  __testing: {
    resetRoomDirectory() {
      getRoomDirectoryStore().entries.clear();
    },
    listEntries() {
      return [...getRoomDirectoryStore().entries.values()].map((entry) => cloneRoomEntry(entry));
    }
  }
};
