const { requireAdmin } = require("../../../../lib/auth");
const { query } = require("../../../../lib/db");
const { methodNotAllowed, parseBody } = require("../../../../lib/http");

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
      items: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        title: row.title,
        description: row.description,
        mode: row.mode,
        isActive: row.is_active,
        settings: row.settings,
        updatedAt: row.updated_at
      }))
    });
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    const result = await query(
      `
        INSERT INTO room_templates (name, title, description, mode, is_active, settings)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [
        body.name,
        body.title,
        body.description,
        body.mode,
        Boolean(body.isActive),
        JSON.stringify(body.settings || {})
      ]
    );

    await query(
      `
        INSERT INTO admin_logs (operator_user_id, action, detail)
        VALUES ($1, 'create-template', $2)
      `,
      [admin.id, JSON.stringify({ templateId: result.rows[0].id })]
    );

    return res.status(201).json({ item: result.rows[0] });
  }

  if (req.method === "PATCH") {
    const body = parseBody(req);
    if (!body.id) {
      return res.status(400).json({ error: "缺少模板 ID" });
    }

    const result = await query(
      `
        UPDATE room_templates
        SET
          title = COALESCE($2, title),
          description = COALESCE($3, description),
          is_active = COALESCE($4, is_active),
          settings = COALESCE($5, settings),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        body.id,
        body.title || null,
        body.description || null,
        typeof body.isActive === "boolean" ? body.isActive : null,
        body.settings ? JSON.stringify(body.settings) : null
      ]
    );

    await query(
      `
        INSERT INTO admin_logs (operator_user_id, action, detail)
        VALUES ($1, 'update-template', $2)
      `,
      [admin.id, JSON.stringify({ templateId: body.id })]
    );

    return res.status(200).json({ item: result.rows[0] });
  }

  return methodNotAllowed(res, ["GET", "POST", "PATCH"]);
}

module.exports = handler;
module.exports.default = handler;
