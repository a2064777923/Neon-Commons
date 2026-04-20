const { requireUser } = require("../../../../lib/auth");
const { methodNotAllowed } = require("../../../../lib/http");
const { getRoomManager } = require("../../../../lib/game/room-manager");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return undefined;
  }

  const roomManager = getRoomManager();
  try {
    const room = roomManager.joinRoom(req.query.roomNo, user);
    return res.status(200).json({
      room: roomManager.serializeRoom(room, user.id)
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

handler.contract = createHandlerContract(
  "cardRooms.join",
  API_ROUTE_PATTERNS.cardRooms.join,
  ["POST"],
  AUTH_SCOPES.USER
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
