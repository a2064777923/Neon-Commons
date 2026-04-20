const { requireAdmin } = require("../../../../lib/auth");
const { query } = require("../../../../lib/db");
const { methodNotAllowed } = require("../../../../lib/http");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  const result = await query(`
    SELECT
      id,
      username,
      email,
      display_name,
      role,
      status,
      coins,
      rank_score,
      wins,
      losses,
      total_games,
      created_at
    FROM users
    ORDER BY created_at DESC
    LIMIT 100
  `);

  return res.status(200).json({
    items: result.rows.map((row) => ({
      id: row.id,
      username: row.username,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      coins: row.coins,
      rankScore: row.rank_score,
      wins: row.wins,
      losses: row.losses,
      totalGames: row.total_games,
      createdAt: row.created_at
    }))
  });
}

module.exports = handler;
module.exports.default = handler;
