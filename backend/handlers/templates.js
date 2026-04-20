const { query } = require("../../lib/db");
const { methodNotAllowed } = require("../../lib/http");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const result = await query(`
    SELECT id, name, title, description, mode, is_active, settings
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
      settings: row.settings
    }))
  });
}

handler.contract = createHandlerContract(
  "templates.list",
  API_ROUTE_PATTERNS.templates,
  ["GET"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
