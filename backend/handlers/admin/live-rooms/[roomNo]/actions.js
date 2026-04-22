const { requireAdmin } = require("../../../../../lib/auth");
const { methodNotAllowed, parseBody } = require("../../../../../lib/http");
const {
  ROOM_ACTIONS,
  performRoomAction
} = require("../../../../../lib/admin/live-room-ops");
const { recordAdminLog } = require("../../../../../lib/admin/control-plane");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../../lib/shared/network-contract");

const ACTION_TO_LOG = Object.freeze({
  [ROOM_ACTIONS.INSPECT]: "inspect-live-room",
  [ROOM_ACTIONS.DRAIN]: "drain-live-room",
  [ROOM_ACTIONS.CLOSE]: "close-live-room"
});

async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  try {
    const body = parseBody(req);
    const room = performRoomAction(req.query.roomNo, body.action);

    await recordAdminLog({
      operatorUserId: admin.id,
      action: ACTION_TO_LOG[body.action] || "inspect-live-room",
      detail: {
        scope: "live-room-ops",
        roomNo: room.roomNo,
        familyKey: room.familyKey,
        gameKey: room.gameKey,
        availability: room.availability,
        target: [room.roomNo]
      }
    });

    return res.status(200).json({ room });
  } catch (error) {
    return res.status(400).json({ error: error.message || "房間操作失敗" });
  }
}

handler.contract = createHandlerContract(
  "admin.liveRooms.action",
  API_ROUTE_PATTERNS.admin.liveRooms.action,
  ["POST"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
