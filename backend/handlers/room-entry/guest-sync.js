const { requireUser } = require("../../../lib/auth");
const { query } = require("../../../lib/db");
const { methodNotAllowed, parseBody } = require("../../../lib/http");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return undefined;
  }

  const body = parseBody(req);
  const guestId = String(body.guestId || "").trim();
  const gameKey = String(body.gameKey || "").trim();
  const roomNo = String(body.roomNo || "").trim();
  const summary = typeof body.summary === "object" && body.summary ? body.summary : {};

  if (!guestId || !gameKey || !roomNo) {
    return res.status(400).json({ error: "缺少遊客對局資訊" });
  }

  const result = await query(
    `
      INSERT INTO guest_match_links (guest_id, claimed_user_id, game_key, room_no, summary, claimed_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, guest_id, claimed_user_id, game_key, room_no, summary, created_at, claimed_at
    `,
    [guestId, user.id, gameKey, roomNo, JSON.stringify(summary)]
  );

  const row = result.rows[0];
  return res.status(200).json({
    claim: {
      id: row.id,
      guestId: row.guest_id,
      claimedUserId: row.claimed_user_id,
      gameKey: row.game_key,
      roomNo: row.room_no,
      summary: row.summary,
      createdAt: row.created_at,
      claimedAt: row.claimed_at
    }
  });
}

handler.contract = createHandlerContract(
  "roomEntry.guestSync",
  API_ROUTE_PATTERNS.roomEntry.guestSync,
  ["POST"],
  AUTH_SCOPES.USER
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
