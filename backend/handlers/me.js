const { getUserFromRequest } = require("../../lib/auth");
const { methodNotAllowed } = require("../../lib/http");

async function handler(req, res) {
  if (req.method !== "GET") {
    return methodNotAllowed(res, ["GET"]);
  }

  const user = await getUserFromRequest(req);
  return res.status(200).json({ user });
}

module.exports = handler;
module.exports.default = handler;
