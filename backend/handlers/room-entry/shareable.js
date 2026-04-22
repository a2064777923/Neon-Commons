const { requireUser } = require("../../../lib/auth");
const { methodNotAllowed } = require("../../../lib/http");
const { listShareableRoomsForUser } = require("../../../lib/rooms/directory");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../lib/shared/network-contract");
const { serializeRoomEntry } = require("./resolve");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return undefined;
  }

  return res.status(200).json({
    items: listShareableRoomsForUser(user.id).map((entry) => serializeRoomEntry(entry))
  });
}

handler.contract = createHandlerContract(
  "roomEntry.shareable",
  API_ROUTE_PATTERNS.roomEntry.shareable,
  ["GET"],
  AUTH_SCOPES.USER
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
