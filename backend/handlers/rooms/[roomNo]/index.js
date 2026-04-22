const { getSessionFromRequest } = require("../../../../lib/auth");
const { methodNotAllowed } = require("../../../../lib/http");
const { getRoomManager } = require("../../../../lib/game/room-manager");
const {
  getRoomEntryAvailability,
  resolveRoomEntry
} = require("../../../../lib/rooms/directory");
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
  if (!room) {
    const entry = resolveRoomEntry(req.query.roomNo, { gameKeyHint: "doudezhu" });
    if (entry?.familyKey === "card" && getRoomEntryAvailability(entry) === "snapshot-only") {
      return res.status(409).json(createSnapshotOnlyRoomPayload(entry));
    }

    return res.status(404).json({ error: "房間不存在" });
  }

  const session = await getSessionFromRequest(req);
  return res.status(200).json({
    room: roomManager.serializeRoom(room, session?.id || null)
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
