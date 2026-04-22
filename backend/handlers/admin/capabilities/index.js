const { requireAdmin } = require("../../../../lib/auth");
const { methodNotAllowed, parseBody } = require("../../../../lib/http");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");
const {
  NEW_ROOM_SCOPE,
  buildCapabilityFamilies,
  getCapabilityState,
  recordAdminLog,
  updateCapabilities
} = require("../../../../lib/admin/control-plane");

async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  if (req.method === "GET") {
    const state = await getCapabilityState();
    return res.status(200).json({
      families: buildCapabilityFamilies(state)
    });
  }

  if (req.method === "PATCH") {
    try {
      const body = parseBody(req);
      const { before, after, updates } = await updateCapabilities(body.updates);

      await recordAdminLog({
        operatorUserId: admin.id,
        action: "update-capabilities",
        detail: {
          scope: "capabilities",
          target: updates.map((update) => update.gameKey),
          before,
          after,
          reason: updates.map((update) => update.reason).filter(Boolean).join(" | "),
          appliesTo: NEW_ROOM_SCOPE
        }
      });

      return res.status(200).json({
        families: buildCapabilityFamilies(after)
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || "能力更新失敗" });
    }
  }

  return methodNotAllowed(res, ["GET", "PATCH"]);
}

handler.contract = createHandlerContract(
  "admin.capabilities",
  API_ROUTE_PATTERNS.admin.capabilities,
  ["GET", "PATCH"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
