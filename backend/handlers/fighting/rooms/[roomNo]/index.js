const { getSessionFromRequest } = require("../../../../../lib/auth");
const { methodNotAllowed } = require("../../../../../lib/http");
const { getFightingRoomManager } = require("../../../../../lib/fighting/manager");
const { resolveRoomEntry } = require("../../../../../lib/rooms/directory");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const roomManager = getFightingRoomManager();
  const room = roomManager.getRoom(req.query.roomNo);
  if (!room) {
    const entry = resolveRoomEntry(req.query.roomNo);
    if (entry?.familyKey === "light-3d") {
      return res.status(404).json({ error: "房间不存在" });
    }

    return res.status(404).json({ error: "房间不存在" });
  }

  const session = await getSessionFromRequest(req);
  const serializedRoom = roomManager.serializeRoom(room, session?.id || null);
  return res.status(200).json({ room: serializedRoom });
}

handler.contract = createHandlerContract(
  "fightingRooms.detail",
  API_ROUTE_PATTERNS.fightingRooms.detail,
  ["GET"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
