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
  buildRolloutFamilies,
  buildRolloutSummary,
  getCapabilityState,
  getRolloutState,
  recordAdminLog,
  updateCapabilities,
  updateRolloutState
} = require("../../../../lib/admin/control-plane");

async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) {
    return undefined;
  }

  if (req.method === "GET") {
    const [state, rolloutState] = await Promise.all([
      getCapabilityState(),
      getRolloutState()
    ]);
    return res.status(200).json({
      families: buildCapabilityFamilies(state, { rolloutStates: rolloutState }),
      rolloutFamilies: buildRolloutFamilies(state, rolloutState),
      rolloutSummary: buildRolloutSummary(state, rolloutState)
    });
  }

  if (req.method === "PATCH") {
    try {
      const body = parseBody(req);
      const capabilityUpdates = Array.isArray(body.updates) && body.updates.length > 0 ? body.updates : null;
      const rolloutUpdates = Array.isArray(body.rolloutUpdates) && body.rolloutUpdates.length > 0
        ? body.rolloutUpdates
        : body.rolloutUpdate
          ? [body.rolloutUpdate]
          : null;

      if (!capabilityUpdates && !rolloutUpdates) {
        throw new Error("至少提供一項能力或 rollout 更新");
      }

      const capabilityResult = capabilityUpdates
        ? await updateCapabilities(capabilityUpdates)
        : {
            before: await getCapabilityState(),
            after: await getCapabilityState(),
            updates: []
          };
      const rolloutResult = rolloutUpdates
        ? await updateRolloutState(rolloutUpdates)
        : {
            before: await getRolloutState(),
            after: await getRolloutState(),
            updates: []
          };

      if (capabilityResult.updates.length > 0) {
        await recordAdminLog({
          operatorUserId: admin.id,
          action: "update-capabilities",
          detail: {
            scope: "capabilities",
            target: capabilityResult.updates.map((update) => update.gameKey),
            before: capabilityResult.before,
            after: capabilityResult.after,
            reason: capabilityResult.updates.map((update) => update.reason).filter(Boolean).join(" | "),
            appliesTo: NEW_ROOM_SCOPE
          }
        });
      }

      if (rolloutResult.updates.length > 0) {
        await recordAdminLog({
          operatorUserId: admin.id,
          action: "update-rollout",
          detail: {
            scope: "rollout",
            target: rolloutResult.updates.map((update) => update.gameKey),
            before: rolloutResult.before,
            after: rolloutResult.after,
            reason: rolloutResult.updates.map((update) => update.reason).filter(Boolean).join(" | "),
            appliesTo: "discovery-state",
            state: rolloutResult.updates.map((update) => update.state)
          }
        });
      }

      return res.status(200).json({
        families: buildCapabilityFamilies(capabilityResult.after, {
          rolloutStates: rolloutResult.after
        }),
        rolloutFamilies: buildRolloutFamilies(capabilityResult.after, rolloutResult.after),
        rolloutSummary: buildRolloutSummary(capabilityResult.after, rolloutResult.after)
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
