const { requireUser } = require("../../../../lib/auth");
const { methodNotAllowed, parseBody } = require("../../../../lib/http");
const {
  getNewRoomBlockedReason,
  getNewRoomControlSnapshot
} = require("../../../../lib/admin/control-plane");
const { PARTY_GAME_KEYS, getGameMeta } = require("../../../../lib/games/catalog");
const { getPartyRoomManager } = require("../../../../lib/party/manager");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");

async function handler(req, res) {
  const roomManager = getPartyRoomManager();
  const gameKey = String(req.query.gameKey || parseBody(req).gameKey || "").trim();

  if (req.method === "GET") {
    if (!PARTY_GAME_KEYS.includes(gameKey)) {
      return res.status(200).json({ items: [] });
    }

    return res.status(200).json({ items: roomManager.listPublicRooms(gameKey) });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return undefined;
  }

  if (!PARTY_GAME_KEYS.includes(gameKey)) {
    return res.status(400).json({ error: "缺少有效游戏类型" });
  }

  const controlSnapshot = await getNewRoomControlSnapshot();
  const blockedReason = getNewRoomBlockedReason(gameKey, controlSnapshot);
  if (blockedReason) {
    return res.status(400).json({ error: blockedReason });
  }

  const roomCount = roomManager.countOpenRoomsByOwner(user.id, gameKey);
  const maxRooms = Number(controlSnapshot.runtime.maxOpenRoomsPerUser || 3);
  if (roomCount >= maxRooms) {
    return res.status(400).json({ error: `单个玩家最多同时开 ${maxRooms} 个房间` });
  }

  const body = parseBody(req);
  const room = roomManager.createRoom(user, gameKey, body.config || {});
  const meta = getGameMeta(gameKey);

  return res.status(201).json({
    game: meta,
    room: roomManager.serializeRoom(room, user.id)
  });
}

handler.contract = createHandlerContract(
  "partyRooms.collection",
  API_ROUTE_PATTERNS.partyRooms.list,
  ["GET", "POST"],
  {
    GET: AUTH_SCOPES.PUBLIC,
    POST: AUTH_SCOPES.USER
  }
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
