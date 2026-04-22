const { requireAdmin } = require("../../../../lib/auth");
const { query } = require("../../../../lib/db");
const { methodNotAllowed, parseBody } = require("../../../../lib/http");
const {
  SUPPORTED_TEMPLATE_MODES,
  normalizeTemplateMutation,
  normalizeTemplateRecord
} = require("../../../../lib/game/template-settings");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");

async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  if (req.method === "GET") {
    const result = await query(`
      SELECT id, name, title, description, mode, is_active, settings, updated_at
      FROM room_templates
      ORDER BY id ASC
    `);
    return res.status(200).json({
      supportedModes: SUPPORTED_TEMPLATE_MODES,
      items: result.rows.map((row) => normalizeTemplateRecord(row))
    });
  }

  if (req.method === "POST") {
    let payload;
    try {
      payload = normalizeTemplateMutation(parseBody(req), { existing: null });
    } catch (error) {
      return res.status(400).json({ error: error.message || "模板設定不合法" });
    }

    const result = await query(
      `
        INSERT INTO room_templates (name, title, description, mode, is_active, settings)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        payload.name,
        payload.title,
        payload.description,
        payload.mode,
        payload.isActive,
        JSON.stringify(payload.settings)
      ]
    );

    await query(
      `
        INSERT INTO admin_logs (operator_user_id, action, detail)
        VALUES ($1, 'create-template', $2)
      `,
      [admin.id, JSON.stringify({ templateId: result.rows[0].id })]
    );

    return res.status(201).json({ item: normalizeTemplateRecord(result.rows[0]) });
  }

  if (req.method === "PATCH") {
    const body = parseBody(req);
    if (!body.id) {
      return res.status(400).json({ error: "缺少模板 ID" });
    }

    const existingResult = await query(
      `
        SELECT id, name, title, description, mode, is_active, settings, updated_at
        FROM room_templates
        WHERE id = $1
        LIMIT 1
      `,
      [body.id]
    );

    if (existingResult.rowCount === 0) {
      return res.status(404).json({ error: "模板不存在" });
    }

    let payload;
    try {
      payload = normalizeTemplateMutation(body, {
        existing: existingResult.rows[0]
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || "模板設定不合法" });
    }

    const result = await query(
      `
        UPDATE room_templates
        SET
          name = $2,
          title = $3,
          description = $4,
          mode = $5,
          is_active = $6,
          settings = $7,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        body.id,
        payload.name,
        payload.title,
        payload.description,
        payload.mode,
        payload.isActive,
        JSON.stringify(payload.settings)
      ]
    );

    await query(
      `
        INSERT INTO admin_logs (operator_user_id, action, detail)
        VALUES ($1, 'update-template', $2)
      `,
      [admin.id, JSON.stringify({ templateId: body.id })]
    );

    return res.status(200).json({ item: normalizeTemplateRecord(result.rows[0]) });
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}

handler.contract = createHandlerContract(
  "admin.templates",
  API_ROUTE_PATTERNS.admin.templates,
  ["GET", "POST", "PATCH"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
