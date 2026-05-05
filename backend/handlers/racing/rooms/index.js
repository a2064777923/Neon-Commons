const { requireUser } = require("../../../../lib/auth");
const { methodNotAllowed, parseBody } = require("../../../../lib/http");
const {
  getNewRoomBlockedReason,
  getNewRoomControlSnapshot
} = require("../../../../lib/admin/control-plane");
const { getGameMeta } = require("../../../../lib/games/catalog");
const { getRacingRoomManager } = require("../../../../lib/racing/manager");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");

async function handler(req, res) {
  const roomManager = getRacingRoomManager();

  if (req.method === "GET") {
    return res.status(200).json({ items: roomManager.listPublicRooms() });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return undefined;
  }

  const controlSnapshot = await getNewRoomControlSnapshot();
  const blockedReason = getNewRoomBlockedReason("racing", controlSnapshot);
  if (blockedReason) {
    return res.status(400).json({ error: blockedReason });
  }

  const roomCount = roomManager.countOpenRoomsByOwner(user.id);
  const maxRooms = Number(controlSnapshot.runtime.maxOpenRoomsPerUser || 3);
  if (roomCount >= maxRooms) {
    return res.status(400).json({ error: `单个玩家最多同时开 ${maxRooms} 个房间` });
  }

  const body = parseBody(req);
  const room = roomManager.createRoom(user, body.config || {});
  const meta = getGameMeta("racing");

  return res.status(201).json({
    game: meta,
    room: roomManager.serializeRoom(room, user.id)
  });
}

handler.contract = createHandlerContract(
  "racingRooms.collection",
  API_ROUTE_PATTERNS.racingRooms.list,
  ["GET", "POST"],
  {
    GET: AUTH_SCOPES.PUBLIC,
    POST: AUTH_SCOPES.USER
  }
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
