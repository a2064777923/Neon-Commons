const { requireAdmin } = require("../../../../../lib/auth");
const { query } = require("../../../../../lib/db");
const { methodNotAllowed, parseBody } = require("../../../../../lib/http");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  const body = parseBody(req);
  const targetId = Number(req.query.id);
  const coinsDelta = Number(body.coinsDelta || 0);
  const rankDelta = Number(body.rankDelta || 0);
  const reason = String(body.reason || "後台手動調整");
  const status = body.status ? String(body.status) : null;

  const current = await query("SELECT * FROM users WHERE id = $1 LIMIT 1", [targetId]);
  if (current.rowCount === 0) {
    return res.status(404).json({ error: "玩家不存在" });
  }

  const row = current.rows[0];
  const result = await query(
    `
      UPDATE users
      SET
        coins = coins + $2,
        rank_score = rank_score + $3,
        status = COALESCE($4, status),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [targetId, coinsDelta, rankDelta, status]
  );

  await query(
    `
      INSERT INTO admin_logs (operator_user_id, target_user_id, action, detail)
      VALUES ($1, $2, 'adjust-player', $3)
    `,
    [
      admin.id,
      targetId,
      JSON.stringify({
        before: {
          coins: row.coins,
          rankScore: row.rank_score,
          status: row.status
        },
        delta: {
          coinsDelta,
          rankDelta,
          status
        },
        reason
      })
    ]
  );

  return res.status(200).json({ item: result.rows[0] });
}

handler.contract = createHandlerContract(
  "admin.players.adjust",
  API_ROUTE_PATTERNS.admin.playerAdjust,
  ["POST"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
