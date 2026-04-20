const { requireUser } = require("../../../lib/auth");
const { query } = require("../../../lib/db");
const { methodNotAllowed, parseBody } = require("../../../lib/http");
const { getRoomManager } = require("../../../lib/game/room-manager");
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

  const roomCount = roomManager.countOpenRoomsByOwner(user.id);
  const config = await query(
    "SELECT value FROM system_configs WHERE key = 'maxOpenRoomsPerUser' LIMIT 1"
  );
  const maxRooms = Number(config.rows[0]?.value || 3);
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

  const template = templateResult.rows[0];
  if (!template.is_active) {
    return res.status(400).json({ error: "該模板目前未上線" });
  }

  const room = roomManager.createRoom(
    user,
    {
      id: template.id,
      name: template.name,
      title: template.title,
      mode: template.mode,
      settings: template.settings
    },
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
