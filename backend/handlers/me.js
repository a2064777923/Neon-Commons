const { getUserFromRequest } = require("../../lib/auth");
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

  const user = await getUserFromRequest(req);
  return res.status(200).json({ user });
}

handler.contract = createHandlerContract(
  "me.read",
  API_ROUTE_PATTERNS.me,
  ["GET"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
