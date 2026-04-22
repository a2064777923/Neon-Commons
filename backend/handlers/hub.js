const { query } = require("../../lib/db");
const { methodNotAllowed } = require("../../lib/http");
const { getRoomManager } = require("../../lib/game/room-manager");
const { getPartyRoomManager } = require("../../lib/party/manager");
const { getBoardRoomManager } = require("../../lib/board/manager");
const {
  getRoomEntryAvailability,
  listPublicRoomEntries
} = require("../../lib/rooms/directory");
const {
  getAvailabilityControls,
  buildCapabilitySummary,
  buildHubFamilies,
  getCapabilityState
} = require("../../lib/admin/control-plane");
const {
  getGameMeta,
  getGameMode,
  getGameSharePath
} = require("../../lib/games/catalog");
const { buildAvailabilityEnvelope } = require("../../lib/shared/availability");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const [capabilities, availabilityControls, leaderboardPreview, roomGroups] = await Promise.all([
    getCapabilityState(),
    getAvailabilityControls(),
    getLeaderboardPreview(),
    loadPublicRoomGroups()
  ]);

  const publicRooms = roomGroups.flat();
  const roomCounts = publicRooms.reduce((counts, room) => {
    counts[room.gameKey] = (counts[room.gameKey] || 0) + 1;
    return counts;
  }, {});

  return res.status(200).json({
    families: buildHubFamilies(capabilities, { roomCounts }),
    liveFeed: publicRooms
      .slice()
      .sort(compareLiveRooms)
      .slice(0, 6)
      .map((room) => attachDegradedState(room, availabilityControls)),
    featuredRooms: publicRooms
      .slice()
      .sort(compareFeaturedRooms)
      .slice(0, 6)
      .map((room) => attachDegradedState(room, availabilityControls)),
    leaderboardPreview,
    universalEntry: {
      heading: "遊戲入口",
      defaultMode: "room-no",
      modes: [
        {
          key: "room-no",
          label: "房號加入",
          helper: "六位房號可直接定位到對應遊戲房間。"
        },
        {
          key: "invite-link",
          label: "貼上邀請",
          helper: "支援完整邀請連結，系統自動判斷遊戲與房間。"
        },
        {
          key: "share-room",
          label: "分享我的房",
          helper: "只對你目前可分享的房間生成邀請連結。"
        }
      ]
    },
    capabilitySummary: buildCapabilitySummary(capabilities, { roomCounts })
  });
}

async function getLeaderboardPreview() {
  const result = await query(`
    SELECT
      id,
      username,
      display_name,
      avatar_url,
      coins,
      rank_score,
      wins,
      losses,
      total_games
    FROM users
    WHERE role IN ('player', 'admin')
    ORDER BY coins DESC, rank_score DESC, wins DESC
    LIMIT 5
  `);

  return result.rows.map((row, index) => ({
    rank: index + 1,
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || null,
    coins: row.coins,
    rankScore: row.rank_score,
    wins: row.wins,
    losses: row.losses,
    totalGames: row.total_games
  }));
}

async function loadPublicRoomGroups() {
  const cardRooms = normalizeLiveRoomGroup(
    getRoomManager()
      .listPublicRooms()
      .map((room) => ({
        roomNo: room.roomNo,
        gameKey: "doudezhu",
        title: room.templateTitle || getGameMeta("doudezhu")?.title || "斗地主",
        strapline: room.templateTitle || room.mode || getGameMeta("doudezhu")?.strapline || "",
        state: room.state,
        visibility: room.settings?.roomVisibility || "public",
        playerCount: Array.isArray(room.players) ? room.players.length : 0,
        createdAt: room.createdAt
      }))
  );
  const partyRooms = normalizeLiveRoomGroup(getPartyRoomManager().listPublicRooms());
  const boardRooms = normalizeLiveRoomGroup(getBoardRoomManager().listPublicRooms());
  const snapshotGroups = groupSnapshotOnlyRoomEntries(listPublicRoomEntries());

  return [
    mergeRoomGroups(cardRooms, snapshotGroups.card),
    mergeRoomGroups(partyRooms, snapshotGroups.party),
    mergeRoomGroups(boardRooms, snapshotGroups.board)
  ];
}

function normalizeLiveRoomGroup(rooms = []) {
  return rooms
    .filter((room) => (room.visibility || room.config?.visibility || "public") !== "private")
    .map((room) => {
      const gameKey = room.gameKey || "doudezhu";
      const meta = getGameMeta(gameKey) || {};
      const entryRoute = getGameSharePath(gameKey, room.roomNo);
      const detailRoute = `${meta.detailRoutePrefix || "/"}${meta.detailRoutePrefix ? "/" : ""}${room.roomNo}`.replace(
        /\/+/g,
        "/"
      );

      return {
        roomNo: room.roomNo,
        gameKey,
        familyKey: getGameMode(gameKey),
        title: room.title || meta.title || "公開房",
        strapline: room.strapline || meta.strapline || "",
        roomState: room.state || "waiting",
        visibility: room.visibility || room.config?.visibility || "public",
        playerCount: Number(room.playerCount || room.players?.length || 0),
        createdAt: room.createdAt || null,
        availability: "live",
        detailRoute,
        entryRoute,
        sharePath: meta.supportsShareLink ? getGameSharePath(gameKey, room.roomNo) : ""
      };
    });
}

function groupSnapshotOnlyRoomEntries(entries = []) {
  const grouped = {
    card: [],
    party: [],
    board: []
  };

  for (const entry of entries) {
    const availability = getRoomEntryAvailability(entry);
    if (availability !== "snapshot-only") {
      continue;
    }

    const gameKey = entry.gameKey || "doudezhu";
    const meta = getGameMeta(gameKey) || {};
    const familyKey = entry.familyKey || getGameMode(gameKey);
    if (!grouped[familyKey]) {
      continue;
    }

    const entryRoute = getGameSharePath(gameKey, entry.roomNo);
    grouped[familyKey].push({
      roomNo: entry.roomNo,
      gameKey,
      familyKey,
      title: entry.title || meta.title || "公開房",
      strapline: entry.strapline || meta.strapline || "",
      roomState: entry.state || "waiting",
      visibility: entry.visibility || "public",
      playerCount: Array.isArray(entry.memberIds) ? entry.memberIds.length : 0,
      createdAt: entry.restoredAt || entry.updatedAt || null,
      availability,
      detailRoute: entry.detailRoute,
      entryRoute,
      sharePath: entry.supportsShareLink ? entryRoute : ""
    });
  }

  return grouped;
}

function mergeRoomGroups(liveRooms = [], snapshotRooms = []) {
  const merged = new Map();

  for (const room of liveRooms) {
    merged.set(room.roomNo, room);
  }

  for (const room of snapshotRooms) {
    if (!merged.has(room.roomNo)) {
      merged.set(room.roomNo, room);
    }
  }

  return [...merged.values()];
}

function attachDegradedState(room, availabilityControls) {
  return {
    ...room,
    degradedState: buildAvailabilityEnvelope({
      controls: availabilityControls,
      familyKey: room.familyKey,
      roomAvailability: room.availability,
      supportsVoice: room.familyKey === "party"
    })
  };
}

function compareLiveRooms(left, right) {
  const leftLive = left.availability === "live" ? 1 : 0;
  const rightLive = right.availability === "live" ? 1 : 0;
  if (leftLive !== rightLive) {
    return rightLive - leftLive;
  }

  const leftActive = left.roomState === "playing" ? 1 : 0;
  const rightActive = right.roomState === "playing" ? 1 : 0;
  if (leftActive !== rightActive) {
    return rightActive - leftActive;
  }

  if (left.playerCount !== right.playerCount) {
    return right.playerCount - left.playerCount;
  }

  return String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
}

function compareFeaturedRooms(left, right) {
  const leftLive = left.availability === "live" ? 1 : 0;
  const rightLive = right.availability === "live" ? 1 : 0;
  if (leftLive !== rightLive) {
    return rightLive - leftLive;
  }

  if (left.playerCount !== right.playerCount) {
    return right.playerCount - left.playerCount;
  }

  return compareLiveRooms(left, right);
}

handler.contract = createHandlerContract(
  "hub.read",
  API_ROUTE_PATTERNS.hub,
  ["GET"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
