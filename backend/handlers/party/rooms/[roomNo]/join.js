const { requireUser } = require("../../../../../lib/auth");
const { methodNotAllowed } = require("../../../../../lib/http");
const { getPartyRoomManager } = require("../../../../../lib/party/manager");

async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return undefined;
  }

  const roomManager = getPartyRoomManager();
  try {
    const room = roomManager.joinRoom(req.query.roomNo, user);
    return res.status(200).json({
      room: roomManager.serializeRoom(room, user.id)
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

module.exports = handler;
module.exports.default = handler;
