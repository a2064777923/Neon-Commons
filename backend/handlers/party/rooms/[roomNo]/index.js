const { getUserFromRequest } = require("../../../../../lib/auth");
const { methodNotAllowed } = require("../../../../../lib/http");
const { getPartyRoomManager } = require("../../../../../lib/party/manager");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const roomManager = getPartyRoomManager();
  const room = roomManager.getRoom(req.query.roomNo);
  if (!room) {
    return res.status(404).json({ error: "房间不存在" });
  }

  const user = await getUserFromRequest(req);
  return res.status(200).json({
    room: roomManager.serializeRoom(room, user?.id || null)
  });
}

handler.contract = createHandlerContract(
  "partyRooms.detail",
  API_ROUTE_PATTERNS.partyRooms.detail,
  ["GET"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
