const { requireUser } = require("../../../lib/auth");
const { query } = require("../../../lib/db");
const { methodNotAllowed, parseBody } = require("../../../lib/http");
const { getRoomManager } = require("../../../lib/game/room-manager");
const {
  normalizeTemplateRecord
} = require("../../../lib/game/template-settings");
const {
  getNewRoomBlockedReason,
  getNewRoomControlSnapshot
} = require("../../../lib/admin/control-plane");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../lib/shared/network-contract");

async function handler(req, res) {
  const roomManager = getRoomManager();

  if (req.method === "GET") {
    return res.status(200).json({ items: roomManager.listPublicRooms() });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return undefined;
  }

  const body = parseBody(req);
  const templateId = Number(body.templateId);
  if (!templateId) {
    return res.status(400).json({ error: "缺少模板 ID" });
  }

  const controlSnapshot = await getNewRoomControlSnapshot();
  const blockedReason = getNewRoomBlockedReason("doudezhu", controlSnapshot);
  if (blockedReason) {
    return res.status(400).json({ error: blockedReason });
  }

  const roomCount = roomManager.countOpenRoomsByOwner(user.id);
  const maxRooms = Number(controlSnapshot.runtime.maxOpenRoomsPerUser || 3);
  if (roomCount >= maxRooms) {
    return res.status(400).json({ error: `單個玩家最多同時開 ${maxRooms} 個房間` });
  }

  const templateResult = await query(
    `
      SELECT id, name, title, description, mode, is_active, settings
      FROM room_templates
      WHERE id = $1
      LIMIT 1
    `,
    [templateId]
  );

  if (templateResult.rowCount === 0) {
    return res.status(404).json({ error: "規則模板不存在" });
  }

  const template = normalizeTemplateRecord(templateResult.rows[0]);
  if (!template.isActive) {
    return res.status(400).json({ error: "該模板目前未上線" });
  }
  if (!template.modeSupported) {
    return res.status(400).json({
      error: template.unsupportedReason || "該模板模式目前未支援開房"
    });
  }

  const room = roomManager.createRoom(
    user,
    template,
    body.overrides || {}
  );

  return res.status(201).json({
    room: roomManager.serializeRoom(room, user.id)
  });
}

handler.contract = createHandlerContract(
  "cardRooms.collection",
  API_ROUTE_PATTERNS.cardRooms.list,
  ["GET", "POST"],
  {
    GET: AUTH_SCOPES.PUBLIC,
    POST: AUTH_SCOPES.USER
  }
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
