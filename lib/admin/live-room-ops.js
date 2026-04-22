const { getRoomManager } = require("../game/room-manager");
const { getPartyRoomManager } = require("../party/manager");
const { getBoardRoomManager } = require("../board/manager");
const { getGameMeta, getGameMode } = require("../games/catalog");
const {
  getRoomEntryAvailability,
  listRoomEntries,
  resolveRoomEntry
} = require("../rooms/directory");

const ROOM_ACTIONS = Object.freeze({
  INSPECT: "inspect",
  DRAIN: "drain",
  CLOSE: "close",
  REMOVE_OCCUPANT: "remove-occupant"
});

const AVAILABILITY_ORDER = Object.freeze({
  live: 0,
  draining: 1,
  "snapshot-only": 2,
  closed: 3
});

const CONFIG_LABELS = Object.freeze({
  roomVisibility: "可見性",
  visibility: "可見性",
  maxPlayers: "人數上限",
  countdownSeconds: "倒數秒數",
  nightSeconds: "夜晚秒數",
  discussionSeconds: "討論秒數",
  voteSeconds: "投票秒數",
  voiceEnabled: "語音",
  opening: "開局",
  baseScore: "底分"
});

function getRoomProviders() {
  return [
    {
      familyKey: "card",
      manager: getRoomManager(),
      resolveGameKey: () => "doudezhu"
    },
    {
      familyKey: "party",
      manager: getPartyRoomManager(),
      resolveGameKey: (room) => room.gameKey
    },
    {
      familyKey: "board",
      manager: getBoardRoomManager(),
      resolveGameKey: (room) => room.gameKey
    }
  ];
}

function listLiveRooms() {
  const liveItems = getRoomProviders().flatMap((provider) =>
    provider.manager.listRooms().map((room) => serializeLiveRoomSummary(provider, room))
  );
  const liveRoomNos = new Set(liveItems.map((item) => item.roomNo));
  const snapshotItems = listRoomEntries()
    .filter(
      (entry) =>
        !liveRoomNos.has(entry.roomNo) && getRoomEntryAvailability(entry) === "snapshot-only"
    )
    .map((entry) => serializeSnapshotRoomSummary(entry));

  return [...liveItems, ...snapshotItems].sort(compareAdminRooms);
}

function getLiveRoomDetail(roomNo) {
  const liveMatch = findLiveRoom(roomNo);
  if (liveMatch) {
    return serializeLiveRoomDetail(liveMatch);
  }

  const entry = resolveRoomEntry(roomNo);
  if (entry && getRoomEntryAvailability(entry) === "snapshot-only") {
    return serializeSnapshotRoomDetail(entry);
  }

  throw new Error("找不到這個房間");
}

function performRoomAction(roomNo, action) {
  const normalizedAction = normalizeRoomAction(action);
  const match = findLiveRoom(roomNo);
  if (!match) {
    throw new Error("找不到可操作的 live 房間");
  }

  if (normalizedAction === ROOM_ACTIONS.INSPECT) {
    return getLiveRoomDetail(roomNo);
  }

  if (normalizedAction === ROOM_ACTIONS.DRAIN) {
    match.provider.manager.drainRoom(match.room.roomNo);
    return getLiveRoomDetail(roomNo);
  }

  if (normalizedAction === ROOM_ACTIONS.CLOSE) {
    const detail = serializeLiveRoomDetail(match);
    match.provider.manager.closeRoom(match.room.roomNo);
    return buildClosedRoomDetail(detail);
  }

  throw new Error("不支持的房間操作");
}

function removeRoomOccupant(roomNo, occupantId) {
  const match = findLiveRoom(roomNo);
  if (!match) {
    throw new Error("找不到可操作的 live 房間");
  }

  const currentDetail = serializeLiveRoomDetail(match);
  const nextRoom = match.provider.manager.removeOccupant(roomNo, occupantId);
  if (!nextRoom) {
    return buildClosedRoomDetail(currentDetail);
  }

  return getLiveRoomDetail(roomNo);
}

function findLiveRoom(roomNo) {
  const normalizedRoomNo = String(roomNo || "").trim();
  for (const provider of getRoomProviders()) {
    const room = provider.manager.getRoom(normalizedRoomNo);
    if (room) {
      return { provider, room };
    }
  }

  return null;
}

function serializeLiveRoomSummary(provider, room) {
  const gameKey = provider.resolveGameKey(room);
  const meta = getGameMeta(gameKey) || {};
  const entry = resolveRoomEntry(room.roomNo);
  const occupancy = summarizeOccupancy(room.players || []);

  return {
    roomNo: room.roomNo,
    familyKey: provider.familyKey,
    gameKey,
    title: room.title || room.templateTitle || meta.title || room.roomNo,
    strapline: room.strapline || room.templateTitle || meta.strapline || "",
    availability: provider.manager.getAdminAvailability(room),
    roomState: room.state || "waiting",
    visibility:
      room.settings?.roomVisibility || room.config?.visibility || entry?.visibility || "public",
    detailRoute: entry?.detailRoute || buildDetailRoute(gameKey, room.roomNo),
    lastActiveAt: entry?.lastActiveAt || entry?.updatedAt || room.createdAt || null,
    ownerId: room.ownerId,
    occupancy
  };
}

function serializeLiveRoomDetail(match) {
  const summary = serializeLiveRoomSummary(match.provider, match.room);
  const occupants = buildOccupants(match.room.players || [], match.room.ownerId, {
    roomState: summary.roomState,
    availability: summary.availability
  });

  return {
    ...summary,
    configSummary: buildConfigSummary(match.room),
    runtimeHealth: {
      connectedHumans: occupants.filter(
        (occupant) => !occupant.isBot && occupant.presenceState === "connected"
      ).length,
      reconnectingHumans: occupants.filter(
        (occupant) => !occupant.isBot && occupant.presenceState === "reconnecting"
      ).length,
      disconnectedHumans: occupants.filter(
        (occupant) => !occupant.isBot && occupant.presenceState === "disconnected"
      ).length,
      totalOccupants: occupants.length,
      humanOccupants: occupants.filter((occupant) => !occupant.isBot).length,
      botOccupants: occupants.filter((occupant) => occupant.isBot).length
    },
    occupants,
    actions: {
      inspect: true,
      drain: summary.availability === "live",
      close: true,
      removeOccupants: summary.roomState === "waiting" && summary.availability !== "closed"
    }
  };
}

function serializeSnapshotRoomSummary(entry) {
  const gameKey = entry.gameKey || "doudezhu";
  const meta = getGameMeta(gameKey) || {};

  return {
    roomNo: entry.roomNo,
    familyKey: entry.familyKey || getGameMode(gameKey),
    gameKey,
    title: entry.title || meta.title || entry.roomNo,
    strapline: entry.strapline || meta.strapline || "",
    availability: "snapshot-only",
    roomState: entry.state || "waiting",
    visibility: entry.visibility || "public",
    detailRoute: entry.detailRoute || buildDetailRoute(gameKey, entry.roomNo),
    lastActiveAt: entry.lastActiveAt || entry.updatedAt || entry.restoredAt || null,
    ownerId: entry.ownerId ?? null,
    occupancy: {
      total: Array.isArray(entry.memberIds) ? entry.memberIds.length : 0,
      humans: Array.isArray(entry.memberIds) ? entry.memberIds.length : 0,
      bots: 0,
      connectedHumans: 0
    }
  };
}

function serializeSnapshotRoomDetail(entry) {
  const summary = serializeSnapshotRoomSummary(entry);
  const occupantIds = Array.isArray(entry.memberIds) ? entry.memberIds : [];

  return {
    ...summary,
    configSummary: [],
    runtimeHealth: {
      connectedHumans: 0,
      reconnectingHumans: 0,
      disconnectedHumans: occupantIds.length,
      totalOccupants: occupantIds.length,
      humanOccupants: occupantIds.length,
      botOccupants: 0
    },
    occupants: occupantIds.map((occupantId, index) => ({
      occupantId: String(occupantId),
      displayName: String(occupantId),
      seatIndex: index,
      isBot: false,
      isOwner: occupantId === entry.ownerId,
      ready: false,
      presenceState: "disconnected",
      canRemove: false
    })),
    actions: {
      inspect: true,
      drain: false,
      close: false,
      removeOccupants: false
    }
  };
}

function buildClosedRoomDetail(detail) {
  return {
    ...detail,
    availability: "closed",
    roomState: "closed",
    runtimeHealth: {
      connectedHumans: 0,
      reconnectingHumans: 0,
      disconnectedHumans: 0,
      totalOccupants: 0,
      humanOccupants: 0,
      botOccupants: 0
    },
    occupants: [],
    actions: {
      inspect: true,
      drain: false,
      close: false,
      removeOccupants: false
    }
  };
}

function buildOccupants(players = [], ownerId, options = {}) {
  const canRemove = options.roomState === "waiting" && options.availability !== "closed";

  return players.map((player) => ({
    occupantId: String(player.userId),
    displayName: player.displayName,
    seatIndex: player.seatIndex,
    isBot: Boolean(player.isBot),
    isOwner: String(player.userId) === String(ownerId),
    ready: Boolean(player.ready),
    presenceState: player.presenceState || (player.connected ? "connected" : "disconnected"),
    canRemove
  }));
}

function summarizeOccupancy(players = []) {
  const humans = players.filter((player) => !player.isBot);
  return {
    total: players.length,
    humans: humans.length,
    bots: players.filter((player) => player.isBot).length,
    connectedHumans: humans.filter(
      (player) => player.connected || Boolean(player.reconnectGraceEndsAt)
    ).length
  };
}

function buildConfigSummary(room) {
  const config = room.settings || room.config || {};
  return Object.entries(config)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 8)
    .map(([key, value]) => ({
      key,
      label: CONFIG_LABELS[key] || key,
      value: formatConfigValue(value)
    }));
}

function formatConfigValue(value) {
  if (typeof value === "boolean") {
    return value ? "開啟" : "關閉";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function buildDetailRoute(gameKey, roomNo) {
  if (gameKey === "doudezhu") {
    return `/room/${roomNo}`;
  }

  const meta = getGameMeta(gameKey) || {};
  const prefix = String(meta.detailRoutePrefix || "").replace(/\/+$/, "");
  return prefix ? `${prefix}/${roomNo}` : `/${roomNo}`;
}

function compareAdminRooms(left, right) {
  const leftAvailability = AVAILABILITY_ORDER[left.availability] ?? 99;
  const rightAvailability = AVAILABILITY_ORDER[right.availability] ?? 99;
  if (leftAvailability !== rightAvailability) {
    return leftAvailability - rightAvailability;
  }

  return String(right.lastActiveAt || "").localeCompare(String(left.lastActiveAt || ""));
}

function normalizeRoomAction(action) {
  const normalized = String(action || "").trim();
  if (!Object.values(ROOM_ACTIONS).includes(normalized)) {
    throw new Error(`未知房間操作: ${normalized || "未提供"}`);
  }

  return normalized;
}

module.exports = {
  ROOM_ACTIONS,
  getLiveRoomDetail,
  listLiveRooms,
  normalizeRoomAction,
  performRoomAction,
  removeRoomOccupant,
  __testing: {
    buildClosedRoomDetail,
    buildConfigSummary,
    buildOccupants,
    compareAdminRooms,
    findLiveRoom,
    serializeLiveRoomDetail,
    serializeLiveRoomSummary,
    serializeSnapshotRoomDetail,
    serializeSnapshotRoomSummary,
    summarizeOccupancy
  }
};
