const { query } = require("../../../lib/db");
const {
  hashPassword,
  signToken,
  setAuthCookie,
  sanitizeUser
} = require("../../../lib/auth");
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

  const body = parseBody(req);
  const username = String(body.username || "").trim().toLowerCase();
  const email = String(body.email || "").trim().toLowerCase();
  const displayName = String(body.displayName || body.username || "").trim();
  const password = String(body.password || "");

  if (!username || !email || !displayName || password.length < 6) {
    return res.status(400).json({ error: "請完整填寫註冊資料，密碼至少 6 位" });
  }

  const exists = await query(
    "SELECT id FROM users WHERE username = $1 OR email = $2",
    [username, email]
  );

  if (exists.rowCount > 0) {
    return res.status(409).json({ error: "用戶名或郵箱已存在" });
  }

  const passwordHash = await hashPassword(password);
  const result = await query(
    `
      INSERT INTO users (username, email, password_hash, display_name)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [username, email, passwordHash, displayName]
  );

  const user = sanitizeUser(result.rows[0]);
  setAuthCookie(res, signToken(user));
  return res.status(201).json({ user });
}

handler.contract = createHandlerContract(
  "auth.register",
  API_ROUTE_PATTERNS.auth.register,
  ["POST"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
