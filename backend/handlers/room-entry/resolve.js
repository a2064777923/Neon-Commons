const { methodNotAllowed } = require("../../../lib/http");
const { getGameSharePath } = require("../../../lib/games/catalog");
const { resolveRoomEntry } = require("../../../lib/rooms/directory");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../lib/shared/network-contract");

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

  return res.status(200).json(serializeRoomEntry(entry));
}

function serializeRoomEntry(entry) {
  return {
    familyKey: entry.familyKey,
    gameKey: entry.gameKey,
    roomNo: entry.roomNo,
    detailRoute: entry.detailRoute,
    joinRoute: entry.joinRoute,
    roomState: entry.state,
    visibility: entry.visibility,
    guestAllowed: entry.guestAllowed,
    shareUrl: getGameSharePath(entry.gameKey, entry.roomNo),
    title: entry.title,
    strapline: entry.strapline
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
