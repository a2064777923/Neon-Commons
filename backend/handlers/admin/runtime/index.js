const { requireAdmin } = require("../../../../lib/auth");
const { methodNotAllowed, parseBody } = require("../../../../lib/http");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../../lib/shared/network-contract");
const {
  buildAvailabilityControlList,
  NEW_ROOM_SCOPE,
  buildRuntimeControlList,
  getAvailabilityControls,
  getRuntimeControls,
  recordAdminLog,
  updateAvailabilityControls,
  updateRuntimeControls
} = require("../../../../lib/admin/control-plane");

async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  if (req.method === "GET") {
    const [state, availabilityControls] = await Promise.all([
      getRuntimeControls(),
      getAvailabilityControls()
    ]);
    return res.status(200).json({
      controls: buildRuntimeControlList(state),
      availabilityControls,
      availabilityControlList: buildAvailabilityControlList(availabilityControls)
    });
  }

  if (req.method === "PATCH") {
    try {
      const body = parseBody(req);
      const runtimeUpdates =
        Array.isArray(body.updates) && body.updates.length > 0 ? body.updates : null;
      const availabilityUpdates = Array.isArray(body.availabilityUpdates)
        ? body.availabilityUpdates
        : body.availabilityUpdate
          ? [body.availabilityUpdate]
          : null;

      if (!runtimeUpdates && !availabilityUpdates) {
        throw new Error("至少提供一項運行配置或降級模式更新");
      }

      const runtimeResult = runtimeUpdates
        ? await updateRuntimeControls(runtimeUpdates)
        : {
            before: await getRuntimeControls(),
            after: await getRuntimeControls(),
            updates: []
          };
      const availabilityResult = availabilityUpdates
        ? await updateAvailabilityControls(availabilityUpdates)
        : {
            before: await getAvailabilityControls(),
            after: await getAvailabilityControls(),
            updates: []
          };

      if (runtimeResult.updates.length > 0) {
        await recordAdminLog({
          operatorUserId: admin.id,
          action: "update-runtime",
          detail: {
            scope: "runtime",
            target: runtimeResult.updates.map((update) => update.key),
            before: runtimeResult.before,
            after: runtimeResult.after,
            reason: runtimeResult.updates.map((update) => update.reason).filter(Boolean).join(" | "),
            appliesTo: NEW_ROOM_SCOPE
          }
        });
      }

      if (availabilityResult.updates.length > 0) {
        await recordAdminLog({
          operatorUserId: admin.id,
          action: "update-runtime",
          detail: {
            scope: "availability-controls",
            target: availabilityResult.updates.map((update) =>
              update.scope === "family"
                ? `${update.familyKey}:${update.subsystem}`
                : `global:${update.subsystem}`
            ),
            before: availabilityResult.before,
            after: availabilityResult.after,
            reason: availabilityResult.updates.map((update) => update.reason).filter(Boolean).join(" | "),
            appliesTo: availabilityResult.updates.map((update) =>
              update.scope === "family" ? `family:${update.familyKey}` : "global"
            ),
            subsystem: availabilityResult.updates.map((update) => update.subsystem),
            state: availabilityResult.updates.map((update) => update.state)
          }
        });
      }

      return res.status(200).json({
        controls: buildRuntimeControlList(runtimeResult.after),
        availabilityControls: availabilityResult.after,
        availabilityControlList: buildAvailabilityControlList(availabilityResult.after)
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
