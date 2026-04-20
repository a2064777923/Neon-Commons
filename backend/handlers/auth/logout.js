const { clearAuthCookie } = require("../../../lib/auth");
const { methodNotAllowed } = require("../../../lib/http");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  clearAuthCookie(res);
  return res.status(200).json({ ok: true });
}

handler.contract = createHandlerContract(
  "auth.logout",
  API_ROUTE_PATTERNS.auth.logout,
  ["POST"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
