const { query } = require("../../lib/db");
const { methodNotAllowed } = require("../../lib/http");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const period = String(req.query.period || "all");
  const result = await query(`
    SELECT
      id,
      username,
      display_name,
      avatar_url,
      coins,
      rank_score,
      wins,
      losses,
      total_games,
      CASE
        WHEN total_games = 0 THEN 0
        ELSE ROUND((wins::numeric / total_games::numeric) * 100, 2)
      END AS win_rate
    FROM users
    WHERE role IN ('player', 'admin')
    ORDER BY coins DESC, rank_score DESC, wins DESC
    LIMIT 50
  `);

  return res.status(200).json({
    period,
    items: result.rows.map((row, index) => ({
      rank: index + 1,
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      avatarUrl: row.avatar_url || null,
      coins: row.coins,
      rankScore: row.rank_score,
      wins: row.wins,
      losses: row.losses,
      totalGames: row.total_games,
      winRate: Number(row.win_rate)
    }))
  });
}

module.exports = handler;
module.exports.default = handler;
