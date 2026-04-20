const { getUserFromRequest } = require("../../../../lib/auth");
const { methodNotAllowed } = require("../../../../lib/http");
const { getRoomManager } = require("../../../../lib/game/room-manager");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const roomManager = getRoomManager();
  const room = roomManager.getRoom(req.query.roomNo);
  if (!room) {
    return res.status(404).json({ error: "房間不存在" });
  }

  const user = await getUserFromRequest(req);
  return res.status(200).json({
    room: roomManager.serializeRoom(room, user?.id || null)
  });
}

module.exports = handler;
module.exports.default = handler;
