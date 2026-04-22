const { methodNotAllowed } = require("../../../lib/http");
const { getGameSharePath } = require("../../../lib/games/catalog");
const { getAvailabilityControls } = require("../../../lib/admin/control-plane");
const {
  getRoomEntryAvailability,
  resolveRoomEntry
} = require("../../../lib/rooms/directory");
const { buildAvailabilityEnvelope } = require("../../../lib/shared/availability");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../lib/shared/network-contract");

const SNAPSHOT_ONLY_ROOM_ERROR = "房間正在從單機重啟中恢復，暫時不能直接進入。";

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const roomNo = String(req.query.roomNo || "").trim();
  const gameKeyHint = String(req.query.gameKeyHint || "").trim();
  if (!roomNo) {
    return res.status(400).json({ error: "缺少房號" });
  }

  const entry = resolveRoomEntry(roomNo, { gameKeyHint });
  if (!entry) {
    return res.status(404).json({ error: "找不到這個房間" });
  }

  const availabilityControls = await getAvailabilityControls();
  return res.status(200).json(serializeRoomEntry(entry, availabilityControls));
}

function serializeRoomEntry(entry, availabilityControls = {}) {
  const availability = getRoomEntryAvailability(entry);
  return {
    familyKey: entry.familyKey,
    gameKey: entry.gameKey,
    roomNo: entry.roomNo,
    detailRoute: entry.detailRoute,
    joinRoute: entry.joinRoute,
    availability,
    roomState: entry.state,
    visibility: entry.visibility,
    guestAllowed: entry.guestAllowed,
    shareUrl: getGameSharePath(entry.gameKey, entry.roomNo),
    title: entry.title,
    strapline: entry.strapline,
    degradedState: buildAvailabilityEnvelope({
      controls: availabilityControls,
      familyKey: entry.familyKey,
      roomAvailability: availability,
      supportsVoice: entry.familyKey === "party"
    })
  };
}

function createSnapshotOnlyRoomPayload(
  entry,
  error = SNAPSHOT_ONLY_ROOM_ERROR,
  availabilityControls = {}
) {
  const availability = getRoomEntryAvailability(entry);
  return {
    error,
    availability,
    roomNo: entry.roomNo,
    gameKey: entry.gameKey,
    degradedState: buildAvailabilityEnvelope({
      controls: availabilityControls,
      familyKey: entry.familyKey,
      roomAvailability: availability,
      supportsVoice: entry.familyKey === "party"
    })
  };
}

handler.contract = createHandlerContract(
  "roomEntry.resolve",
  API_ROUTE_PATTERNS.roomEntry.resolve,
  ["GET"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
module.exports.serializeRoomEntry = serializeRoomEntry;
module.exports.createSnapshotOnlyRoomPayload = createSnapshotOnlyRoomPayload;
module.exports.SNAPSHOT_ONLY_ROOM_ERROR = SNAPSHOT_ONLY_ROOM_ERROR;
