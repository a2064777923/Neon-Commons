const { requireAdmin } = require("../../../../lib/auth");
const { methodNotAllowed } = require("../../../../lib/http");
const { listLiveRooms } = require("../../../../lib/admin/live-room-ops");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  return res.status(200).json({
    items: listLiveRooms()
  });
}

handler.contract = createHandlerContract(
  "admin.liveRooms.list",
  API_ROUTE_PATTERNS.admin.liveRooms.list,
  ["GET"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
