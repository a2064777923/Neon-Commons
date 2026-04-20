const { clearAuthCookie } = require("../../../lib/auth");
const { methodNotAllowed } = require("../../../lib/http");

async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  clearAuthCookie(res);
  return res.status(200).json({ ok: true });
}

module.exports = handler;
module.exports.default = handler;
