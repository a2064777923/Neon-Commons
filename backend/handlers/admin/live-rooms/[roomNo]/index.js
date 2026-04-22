const { requireAdmin } = require("../../../../../lib/auth");
const { methodNotAllowed } = require("../../../../../lib/http");
const { getLiveRoomDetail } = require("../../../../../lib/admin/live-room-ops");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  try {
    return res.status(200).json({
      room: getLiveRoomDetail(req.query.roomNo)
    });
  } catch (error) {
    return res.status(404).json({ error: error.message || "找不到這個房間" });
  }
}

handler.contract = createHandlerContract(
  "admin.liveRooms.detail",
  API_ROUTE_PATTERNS.admin.liveRooms.detail,
  ["GET"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
