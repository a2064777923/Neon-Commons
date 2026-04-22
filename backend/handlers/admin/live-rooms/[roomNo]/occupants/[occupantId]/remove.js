const { requireAdmin } = require("../../../../../../../lib/auth");
const { methodNotAllowed } = require("../../../../../../../lib/http");
const { removeRoomOccupant } = require("../../../../../../../lib/admin/live-room-ops");
const { recordAdminLog } = require("../../../../../../../lib/admin/control-plane");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  try {
    const room = removeRoomOccupant(req.query.roomNo, req.query.occupantId);

    await recordAdminLog({
      operatorUserId: admin.id,
      action: "remove-live-room-occupant",
      detail: {
        scope: "live-room-ops",
        roomNo: room.roomNo,
        familyKey: room.familyKey,
        gameKey: room.gameKey,
        availability: room.availability,
        occupantId: String(req.query.occupantId || ""),
        target: [room.roomNo, String(req.query.occupantId || "")]
      }
    });

    return res.status(200).json({ room });
  } catch (error) {
    return res.status(400).json({ error: error.message || "移除房內身份失敗" });
  }
}

handler.contract = createHandlerContract(
  "admin.liveRooms.occupantRemove",
  API_ROUTE_PATTERNS.admin.liveRooms.occupantRemove,
  ["POST"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
