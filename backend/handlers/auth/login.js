const { query } = require("../../../lib/db");
const {
  comparePassword,
  setAuthCookie,
  signToken,
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
  const account = String(body.account || "").trim().toLowerCase();
  const password = String(body.password || "");

  if (!account || !password) {
    return res.status(400).json({ error: "請輸入帳號與密碼" });
  }

  const result = await query(
    "SELECT * FROM users WHERE username = $1 OR email = $1 LIMIT 1",
    [account]
  );

  if (result.rowCount === 0) {
    return res.status(401).json({ error: "帳號或密碼錯誤" });
  }

  const row = result.rows[0];
  const valid = await comparePassword(password, row.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "帳號或密碼錯誤" });
  }

  const user = sanitizeUser(row);
  setAuthCookie(res, signToken(user));
  return res.status(200).json({ user });
}

handler.contract = createHandlerContract(
  "auth.login",
  API_ROUTE_PATTERNS.auth.login,
  ["POST"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
