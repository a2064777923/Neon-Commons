const { getSessionFromRequest } = require("../../../../../lib/auth");
const { getAvailabilityControls } = require("../../../../../lib/admin/control-plane");
const { methodNotAllowed } = require("../../../../../lib/http");
const { getPartyRoomManager } = require("../../../../../lib/party/manager");
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
const { createSnapshotOnlyRoomPayload } = require("../../../room-entry/resolve");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const roomManager = getPartyRoomManager();
  const room = roomManager.getRoom(req.query.roomNo);
  const availabilityControls = await getAvailabilityControls();
  if (!room) {
    const entry = resolveRoomEntry(req.query.roomNo);
    if (entry?.familyKey === "party" && getRoomEntryAvailability(entry) === "snapshot-only") {
      return res.status(409).json(createSnapshotOnlyRoomPayload(entry, undefined, availabilityControls));
    }

    return res.status(404).json({ error: "房间不存在" });
  }

  const session = await getSessionFromRequest(req);
  const serializedRoom = roomManager.serializeRoom(room, session?.id || null);
  return res.status(200).json({
    room: {
      ...serializedRoom,
      degradedState: buildAvailabilityEnvelope({
        controls: availabilityControls,
        familyKey: "party",
        gameKey: serializedRoom.gameKey,
        roomAvailability: serializedRoom.availability,
        supportsVoice: true
      })
    }
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
