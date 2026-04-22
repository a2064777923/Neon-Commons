const { requireAdmin } = require("../../../../lib/auth");
const { query } = require("../../../../lib/db");
const { methodNotAllowed } = require("../../../../lib/http");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");

function normalizeActor(id, displayName, username) {
  if (!id) {
    return null;
  }

  return {
    id,
    displayName: displayName || username || "",
    username: username || ""
  };
}

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  const result = await query(
    `
      SELECT
        logs.id,
        logs.operator_user_id,
        logs.target_user_id,
        logs.action,
        logs.detail,
        logs.created_at,
        operator_user.display_name AS operator_display_name,
        operator_user.username AS operator_username,
        target_user.display_name AS target_display_name,
        target_user.username AS target_username
      FROM admin_logs AS logs
      LEFT JOIN users AS operator_user
        ON operator_user.id = logs.operator_user_id
      LEFT JOIN users AS target_user
        ON target_user.id = logs.target_user_id
      ORDER BY logs.created_at DESC, logs.id DESC
      LIMIT 50
    `
  );

  return res.status(200).json({
    items: result.rows.map((row) => ({
      id: row.id,
      action: row.action,
      detail: row.detail || {},
      createdAt: row.created_at,
      operator: normalizeActor(
        row.operator_user_id,
        row.operator_display_name,
        row.operator_username
      ),
      targetUser: normalizeActor(
        row.target_user_id,
        row.target_display_name,
        row.target_username
      )
    }))
  });
}

handler.contract = createHandlerContract(
  "admin.logs",
  API_ROUTE_PATTERNS.admin.logs,
  ["GET"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
