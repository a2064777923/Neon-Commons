const { query } = require("../../lib/db");
const { methodNotAllowed } = require("../../lib/http");
const { getRoomManager } = require("../../lib/game/room-manager");
const { getPartyRoomManager } = require("../../lib/party/manager");
const { getBoardRoomManager } = require("../../lib/board/manager");
const {
  buildCapabilitySummary,
  buildHubFamilies,
  getCapabilityState
} = require("../../lib/admin/control-plane");
const {
  getGameMeta,
  getGameMode,
  getGameSharePath
} = require("../../lib/games/catalog");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const [capabilities, leaderboardPreview, roomGroups] = await Promise.all([
    getCapabilityState(),
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
      .slice(0, 6),
    featuredRooms: publicRooms
      .slice()
      .sort(compareFeaturedRooms)
      .slice(0, 6),
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
  const cardRooms = normalizeRoomGroup(
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
  const partyRooms = normalizeRoomGroup(getPartyRoomManager().listPublicRooms());
  const boardRooms = normalizeRoomGroup(getBoardRoomManager().listPublicRooms());

  return [cardRooms, partyRooms, boardRooms];
}

function normalizeRoomGroup(rooms = []) {
  return rooms
    .filter((room) => (room.visibility || room.config?.visibility || "public") !== "private")
    .map((room) => {
      const gameKey = room.gameKey || "doudezhu";
      const meta = getGameMeta(gameKey) || {};
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
        detailRoute,
        sharePath: meta.supportsShareLink ? getGameSharePath(gameKey, room.roomNo) : ""
      };
    });
}

function compareLiveRooms(left, right) {
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
