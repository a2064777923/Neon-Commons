const { getSessionFromRequest } = require("../../../../lib/auth");
const { getAvailabilityControls } = require("../../../../lib/admin/control-plane");
const { methodNotAllowed } = require("../../../../lib/http");
const { getRoomManager } = require("../../../../lib/game/room-manager");
const {
  getRoomEntryAvailability,
  resolveRoomEntry
} = require("../../../../lib/rooms/directory");
const { buildAvailabilityEnvelope } = require("../../../../lib/shared/availability");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");
const { createSnapshotOnlyRoomPayload } = require("../../room-entry/resolve");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const roomManager = getRoomManager();
  const room = roomManager.getRoom(req.query.roomNo);
  const availabilityControls = await getAvailabilityControls();
  if (!room) {
    const entry = resolveRoomEntry(req.query.roomNo, { gameKeyHint: "doudezhu" });
    if (entry?.familyKey === "card" && getRoomEntryAvailability(entry) === "snapshot-only") {
      return res.status(409).json(createSnapshotOnlyRoomPayload(entry, undefined, availabilityControls));
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
  "cardRooms.detail",
  API_ROUTE_PATTERNS.cardRooms.detail,
  ["GET"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
