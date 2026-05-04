const { getSessionFromRequest } = require("../../../../../lib/auth");
const { getAvailabilityControls } = require("../../../../../lib/admin/control-plane");
const { methodNotAllowed } = require("../../../../../lib/http");
const { getMahjongRoomManager } = require("../../../../../lib/card/mahjong-manager");
const {
  getRoomEntryAvailability,
  resolveRoomEntry
} = require("../../../../../lib/rooms/directory");
const { buildAvailabilityEnvelope } = require("../../../../../lib/shared/availability");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const roomManager = getMahjongRoomManager();
  const room = roomManager.getRoom(req.query.roomNo);
  const availabilityControls = await getAvailabilityControls();

  if (!room) {
    const entry = resolveRoomEntry(req.query.roomNo);
    if (entry?.gameKey === "mahjong" && getRoomEntryAvailability(entry) === "snapshot-only") {
      return res.status(409).json({
        error: "房間已結束",
        roomNo: req.query.roomNo,
        availability: "snapshot-only"
      });
    }

    return res.status(404).json({ error: "房間不存在" });
  }

  const session = await getSessionFromRequest(req);
  const serializedRoom = roomManager.serializeRoom(room, session?.id || null);
  return res.status(200).json({
    room: {
      ...serializedRoom,
      degradedState: buildAvailabilityEnvelope({
        controls: availabilityControls,
        familyKey: "card",
        roomAvailability: serializedRoom.availability,
        supportsVoice: false
      })
    }
  });
}

handler.contract = createHandlerContract(
  "mahjongRooms.detail",
  API_ROUTE_PATTERNS.mahjongRooms.detail,
  ["GET"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
