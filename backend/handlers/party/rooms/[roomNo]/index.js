const { getUserFromRequest } = require("../../../../../lib/auth");
const { methodNotAllowed } = require("../../../../../lib/http");
const { getPartyRoomManager } = require("../../../../../lib/party/manager");

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

module.exports = handler;
module.exports.default = handler;
