const { requireAdmin } = require("../../../../lib/auth");
const { query } = require("../../../../lib/db");
const { methodNotAllowed, parseBody } = require("../../../../lib/http");
const { setSystemConfigValue } = require("../../../../lib/system-config");
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
      SELECT key, value, updated_at
      FROM system_configs
      ORDER BY key ASC
    `);

    return res.status(200).json({
      items: result.rows.map((row) => ({
        key: row.key,
        value: row.value,
        updatedAt: row.updated_at
      }))
    });
  }

  if (req.method === "POST") {
    const body = parseBody(req);
    if (!body.key) {
      return res.status(400).json({ error: "缺少配置 key" });
    }

    const result = await query(
      `
        INSERT INTO system_configs (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        RETURNING *
      `,
      [body.key, JSON.stringify(body.value)]
    );
    setSystemConfigValue(body.key, body.value);

    await query(
      `
        INSERT INTO admin_logs (operator_user_id, action, detail)
        VALUES ($1, 'update-config', $2)
      `,
      [admin.id, JSON.stringify({ key: body.key, value: body.value })]
    );

    return res.status(200).json({ item: result.rows[0] });
  }

  return methodNotAllowed(res, ["GET", "POST"]);
}

handler.contract = createHandlerContract(
  "admin.config",
  API_ROUTE_PATTERNS.admin.config,
  ["GET", "POST"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
