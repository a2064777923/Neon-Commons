const { requireAdmin } = require("../../../../lib/auth");
const { methodNotAllowed, parseBody } = require("../../../../lib/http");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");
const {
  NEW_ROOM_SCOPE,
  buildRuntimeControlList,
  getRuntimeControls,
  recordAdminLog,
  updateRuntimeControls
} = require("../../../../lib/admin/control-plane");

async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  if (req.method === "GET") {
    const state = await getRuntimeControls();
    return res.status(200).json({
      controls: buildRuntimeControlList(state)
    });
  }

  if (req.method === "PATCH") {
    try {
      const body = parseBody(req);
      const { before, after, updates } = await updateRuntimeControls(body.updates);

      await recordAdminLog({
        operatorUserId: admin.id,
        action: "update-runtime",
        detail: {
          scope: "runtime",
          target: updates.map((update) => update.key),
          before,
          after,
          reason: updates.map((update) => update.reason).filter(Boolean).join(" | "),
          appliesTo: NEW_ROOM_SCOPE
        }
      });

      return res.status(200).json({
        controls: buildRuntimeControlList(after)
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || "運行配置更新失敗" });
    }
  }

  return methodNotAllowed(res, ["GET", "PATCH"]);
}

handler.contract = createHandlerContract(
  "admin.runtime",
  API_ROUTE_PATTERNS.admin.runtime,
  ["GET", "PATCH"],
  AUTH_SCOPES.ADMIN
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
