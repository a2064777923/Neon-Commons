const { query } = require("../db");
const { DEFAULT_SYSTEM_CONFIG } = require("../defaults");
const {
  AVAILABILITY_FAMILY_KEYS,
  AVAILABILITY_SUBSYSTEMS,
  buildAvailabilityControlList,
  getDefaultAvailabilityControls,
  normalizeAvailabilityControls,
  normalizeAvailabilityFamily,
  normalizeAvailabilityRule,
  normalizeAvailabilityState,
  normalizeAvailabilitySubsystem
} = require("../shared/availability");
const {
  CAPABILITY_MANAGED_GAME_KEYS,
  GAME_CATALOG,
  getFamilyMeta,
  getGameMeta,
  getGameMode,
  getGameSharePath,
  listCatalogFamilies,
  listCatalogGames
} = require("../games/catalog");

const CAPABILITY_CONFIG_KEY = "gameCapabilities";
const ROLLOUT_CONFIG_KEY = "gameRolloutStates";
const AVAILABILITY_CONFIG_KEY = "availabilityControls";
const RUNTIME_CONFIG_KEY = "runtimeControls";
const RUNTIME_CONTROL_KEYS = Object.freeze(["maxOpenRoomsPerUser", "maintenanceMode"]);
const CONTROLLED_GAME_KEYS = Object.freeze([...CAPABILITY_MANAGED_GAME_KEYS]);
const ROLLOUT_MANAGED_GAME_KEYS = Object.freeze(
  Object.values(GAME_CATALOG)
    .filter((entry) => entry.capabilityManaged !== false)
    .sort((left, right) => {
      const leftFamilyOrder = Number(getFamilyMeta(left.familyKey)?.hubOrder || 999);
      const rightFamilyOrder = Number(getFamilyMeta(right.familyKey)?.hubOrder || 999);
      if (leftFamilyOrder !== rightFamilyOrder) {
        return leftFamilyOrder - rightFamilyOrder;
      }

      return Number(left.hubOrder || 999) - Number(right.hubOrder || 999);
    })
    .map((entry) => entry.key)
);
let availabilityControlsCache = getDefaultAvailabilityControls();
const NEW_ROOM_SCOPE = "new-rooms-only";
const MAINTENANCE_MODE_ERROR = "系統維護中，暫停新建房間";
const GAME_DISABLED_ERROR = "該遊戲目前未開放新房";

const DISCOVERY_STATES = Object.freeze({
  PLAYABLE: "playable",
  PAUSED_NEW_ROOMS: "paused-new-rooms",
  COMING_SOON: "coming-soon"
});

const DISCOVERY_STATE_LABELS = Object.freeze({
  [DISCOVERY_STATES.PLAYABLE]: "可立即遊玩",
  [DISCOVERY_STATES.PAUSED_NEW_ROOMS]: "暫停新房",
  [DISCOVERY_STATES.COMING_SOON]: "即將推出"
});

const DISCOVERY_STATE_DESCRIPTIONS = Object.freeze({
  [DISCOVERY_STATES.PLAYABLE]: "可立即遊玩，依遊戲類型直接開始或進入專屬大廳。",
  [DISCOVERY_STATES.PAUSED_NEW_ROOMS]: "目前不開新房，已有房號或邀請可直接加入。",
  [DISCOVERY_STATES.COMING_SOON]: "入口保留中，完成後會直接在這裡開放。"
});

const RUNTIME_CONTROL_META = Object.freeze({
  maxOpenRoomsPerUser: Object.freeze({
    key: "maxOpenRoomsPerUser",
    label: "每位玩家同時開房上限",
    type: "number",
    appliesTo: NEW_ROOM_SCOPE
  }),
  maintenanceMode: Object.freeze({
    key: "maintenanceMode",
    label: "維護模式",
    type: "boolean",
    appliesTo: NEW_ROOM_SCOPE
  })
});

function buildDefaultCapabilityState() {
  return Object.freeze(
    Object.fromEntries(CONTROLLED_GAME_KEYS.map((gameKey) => [gameKey, true]))
  );
}

function getDefaultRolloutState(gameKey) {
  const meta = getGameMetaOrFallback(gameKey);
  if (meta.capabilityManaged === false) {
    return Boolean(meta.isShipped)
      ? DISCOVERY_STATES.PLAYABLE
      : DISCOVERY_STATES.COMING_SOON;
  }

  if (!meta.isShipped || meta.launchState === DISCOVERY_STATES.COMING_SOON) {
    return DISCOVERY_STATES.COMING_SOON;
  }

  return DISCOVERY_STATES.PLAYABLE;
}

function buildDefaultRolloutState() {
  return Object.freeze(
    Object.fromEntries(
      ROLLOUT_MANAGED_GAME_KEYS.map((gameKey) => [gameKey, getDefaultRolloutState(gameKey)])
    )
  );
}

function parseBooleanLike(value, fallback = null) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }

  return fallback;
}

function parsePositiveInteger(value, fallback, strict = false) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }

  if (strict) {
    throw new Error("maxOpenRoomsPerUser 必須為大於 0 的整數");
  }

  return fallback;
}

function normalizeCapabilityState(input = {}) {
  const defaults = buildDefaultCapabilityState();
  const normalized = {};

  for (const gameKey of CONTROLLED_GAME_KEYS) {
    normalized[gameKey] = parseBooleanLike(input[gameKey], defaults[gameKey]);
  }

  return normalized;
}

function normalizeRuntimeControls(input = {}) {
  return {
    maxOpenRoomsPerUser: parsePositiveInteger(
      input.maxOpenRoomsPerUser,
      DEFAULT_SYSTEM_CONFIG.maxOpenRoomsPerUser
    ),
    maintenanceMode: parseBooleanLike(
      input.maintenanceMode,
      Boolean(DEFAULT_SYSTEM_CONFIG.maintenanceMode)
    )
  };
}

function normalizeRolloutState(input = {}) {
  const defaults = buildDefaultRolloutState();
  const normalized = {};

  for (const gameKey of ROLLOUT_MANAGED_GAME_KEYS) {
    const candidate = String(input[gameKey] || "").trim();
    normalized[gameKey] = Object.values(DISCOVERY_STATES).includes(candidate)
      ? candidate
      : defaults[gameKey];
  }

  return normalized;
}

function normalizeCapabilityUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("至少提供一項能力更新");
  }

  return updates.map((entry) => {
    const gameKey = String(entry?.gameKey || "").trim();
    if (!CONTROLLED_GAME_KEYS.includes(gameKey)) {
      throw new Error(`未知遊戲能力: ${gameKey || "未提供"}`);
    }

    if (typeof entry.enabled !== "boolean") {
      throw new Error("enabled 必須為布林值");
    }

    return {
      gameKey,
      enabled: entry.enabled,
      reason: String(entry.reason || "").trim()
    };
  });
}

function normalizeRuntimeUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("至少提供一項運行配置更新");
  }

  return updates.map((entry) => {
    const key = String(entry?.key || "").trim();
    if (!RUNTIME_CONTROL_KEYS.includes(key)) {
      throw new Error(`未知運行配置: ${key || "未提供"}`);
    }

    if (key === "maxOpenRoomsPerUser") {
      return {
        key,
        value: parsePositiveInteger(entry.value, DEFAULT_SYSTEM_CONFIG.maxOpenRoomsPerUser, true),
        reason: String(entry.reason || "").trim()
      };
    }

    const maintenanceMode = parseBooleanLike(entry.value, null);
    if (maintenanceMode === null) {
      throw new Error("maintenanceMode 必須為布林值");
    }

    return {
      key,
      value: maintenanceMode,
      reason: String(entry.reason || "").trim()
    };
  });
}

function normalizeRolloutUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("至少提供一項 rollout 更新");
  }

  return updates.map((entry) => {
    const gameKey = String(entry?.gameKey || "").trim();
    if (!ROLLOUT_MANAGED_GAME_KEYS.includes(gameKey)) {
      throw new Error(`未知 rollout 遊戲: ${gameKey || "未提供"}`);
    }

    const state = String(entry?.state || "").trim();
    if (!Object.values(DISCOVERY_STATES).includes(state)) {
      throw new Error(`未知 rollout 狀態: ${state || "未提供"}`);
    }

    return {
      gameKey,
      state,
      reason: String(entry.reason || "").trim()
    };
  });
}

function normalizeAvailabilityUpdates(updates) {
  if (!Array.isArray(updates) || updates.length === 0) {
    throw new Error("至少提供一項降級模式更新");
  }

  return updates.map((entry) => {
    const scope = String(entry?.scope || "global").trim() || "global";
    if (scope !== "global" && scope !== "family") {
      throw new Error(`未知降級範圍: ${scope}`);
    }

    const familyKey =
      scope === "family"
        ? normalizeAvailabilityFamily(entry.familyKey, true)
        : normalizeAvailabilityFamily(entry.familyKey);
    const subsystem = normalizeAvailabilitySubsystem(entry.subsystem, true);
    const state = normalizeAvailabilityState(entry.state, true);
    const normalizedRule = normalizeAvailabilityRule(
      {
        state,
        reasonCode: entry.reasonCode,
        message: entry.message,
        safeActions: entry.safeActions,
        configured: true
      },
      subsystem,
      { strict: true, configured: true }
    );

    return {
      scope,
      familyKey,
      subsystem,
      state: normalizedRule.state,
      reasonCode: normalizedRule.reasonCode,
      message: normalizedRule.message,
      safeActions: normalizedRule.safeActions,
      reason: String(entry.reason || "").trim()
    };
  });
}

function getGameMetaOrFallback(gameKey) {
  const meta = getGameMeta(gameKey);
  if (meta) {
    return meta;
  }

  return {
    key: gameKey,
    title: gameKey,
    strapline: "",
    route: "",
    roomRoute: "",
    detailRoutePrefix: "",
    audience: "",
    familyKey: getGameMode(gameKey),
    launchMode: "room",
    capabilityManaged: true
  };
}

function isGameEnabled(capabilities, gameKey) {
  const meta = getGameMetaOrFallback(gameKey);
  if (meta.capabilityManaged === false) {
    return Boolean(meta.isShipped);
  }

  if (!CONTROLLED_GAME_KEYS.includes(gameKey)) {
    return false;
  }

  return Boolean(capabilities[gameKey]);
}

function resolveRolloutState(gameKey, rolloutStates = {}) {
  if (!ROLLOUT_MANAGED_GAME_KEYS.includes(gameKey)) {
    return getDefaultRolloutState(gameKey);
  }

  return normalizeRolloutState(rolloutStates)[gameKey];
}

function getDiscoveryState(gameKey, capabilities = {}, rolloutStates = {}) {
  const meta = getGameMetaOrFallback(gameKey);
  if (meta.capabilityManaged === false) {
    return getDefaultRolloutState(gameKey);
  }

  const rolloutState = resolveRolloutState(gameKey, rolloutStates);
  if (rolloutState === DISCOVERY_STATES.COMING_SOON) {
    return DISCOVERY_STATES.COMING_SOON;
  }

  if (rolloutState === DISCOVERY_STATES.PAUSED_NEW_ROOMS) {
    return DISCOVERY_STATES.PAUSED_NEW_ROOMS;
  }

  return isGameEnabled(capabilities, gameKey)
    ? DISCOVERY_STATES.PLAYABLE
    : DISCOVERY_STATES.PAUSED_NEW_ROOMS;
}

function getDiscoveryStateLabel(state) {
  return DISCOVERY_STATE_LABELS[state] || "";
}

function getDiscoveryStateDescription(state) {
  return DISCOVERY_STATE_DESCRIPTIONS[state] || "";
}

function buildDiscoveryItem(gameKey, options = {}) {
  const meta = getGameMetaOrFallback(gameKey);
  const capabilities = options.capabilities || {};
  const rolloutStates = options.rolloutStates || {};
  const roomCount = Number(options.roomCount || 0);
  const familyMeta = getFamilyMeta(meta.familyKey) || {
    key: meta.familyKey || "",
    label: meta.familyKey || "",
    strapline: ""
  };
  const defaultRolloutState = getDefaultRolloutState(gameKey);
  const rolloutState = resolveRolloutState(gameKey, rolloutStates);
  const state = getDiscoveryState(gameKey, capabilities, rolloutStates);

  return {
    key: meta.key,
    gameKey: meta.key,
    title: meta.title,
    shortTitle: meta.shortTitle || meta.title,
    strapline: meta.strapline || "",
    description: meta.description || "",
    audience: meta.audience || "",
    players: meta.players || "",
    accent: meta.accent || "neutral",
    features: Array.isArray(meta.features) ? meta.features : [],
    discoveryTags: Array.isArray(meta.discoveryTags) ? meta.discoveryTags : [],
    familyKey: familyMeta.key,
    familyLabel: familyMeta.label,
    familyStrapline: familyMeta.strapline || "",
    hubOrder: Number(meta.hubOrder || 999),
    route: meta.route || meta.roomRoute || "",
    roomRoute: meta.roomRoute || meta.route || "",
    detailRoutePrefix: meta.detailRoutePrefix || "",
    supportsShareLink: Boolean(meta.supportsShareLink),
    guestMode: meta.guestMode || "login-only",
    launchState: meta.launchState || "live",
    defaultRolloutState,
    rolloutState,
    launchMode: meta.launchMode || "room",
    capabilityManaged: meta.capabilityManaged !== false,
    isShipped: Boolean(meta.isShipped),
    rolloutManaged: ROLLOUT_MANAGED_GAME_KEYS.includes(meta.key),
    stateSource: rolloutState === defaultRolloutState ? "catalog-default" : "admin-override",
    enabled:
      meta.isShipped && meta.capabilityManaged !== false
        ? isGameEnabled(capabilities, gameKey)
        : Boolean(meta.isShipped),
    state,
    stateLabel: getDiscoveryStateLabel(state),
    stateDescription: getDiscoveryStateDescription(state),
    roomCount,
    sharePath: meta.supportsShareLink ? getGameSharePath(meta.key) : "",
    appliesTo: meta.capabilityManaged === false ? "direct-launch" : NEW_ROOM_SCOPE
  };
}

function buildCapabilityFamilies(state, options = {}) {
  const rolloutStates = options.rolloutStates || {};
  const includeUpcoming = Boolean(options.includeUpcoming);

  return listCatalogFamilies()
    .map((familyMeta) => ({
      key: familyMeta.key,
      familyKey: familyMeta.key,
      label: familyMeta.label,
      strapline: familyMeta.strapline || "",
      items: listCatalogGames({ includeUpcoming })
        .filter((entry) => entry.familyKey === familyMeta.key)
        .map((entry) =>
          buildDiscoveryItem(entry.key, {
            capabilities: state,
            rolloutStates,
            roomCount: 0
          })
        )
        .sort((left, right) => left.hubOrder - right.hubOrder)
    }))
    .filter((family) => family.items.length > 0);
}

function buildRolloutFamilies(capabilities = {}, rolloutStates = {}) {
  return listCatalogFamilies()
    .map((familyMeta) => ({
      key: familyMeta.key,
      familyKey: familyMeta.key,
      label: familyMeta.label,
      strapline: familyMeta.strapline || "",
      items: listCatalogGames()
        .filter(
          (entry) => entry.familyKey === familyMeta.key && entry.capabilityManaged !== false
        )
        .map((entry) =>
          buildDiscoveryItem(entry.key, {
            capabilities,
            rolloutStates,
            roomCount: 0
          })
        )
        .sort((left, right) => left.hubOrder - right.hubOrder)
    }))
    .filter((family) => family.items.length > 0);
}

function buildHubFamilies(capabilities, options = {}) {
  const roomCounts = options.roomCounts || {};
  const rolloutStates = options.rolloutStates || {};

  return listCatalogFamilies().map((familyMeta) => ({
    key: familyMeta.key,
    familyKey: familyMeta.key,
    label: familyMeta.label,
    strapline: familyMeta.strapline || "",
    hubOrder: familyMeta.hubOrder || 999,
    items: listCatalogGames()
      .filter((entry) => entry.familyKey === familyMeta.key)
      .map((entry) =>
        buildDiscoveryItem(entry.key, {
          capabilities,
          rolloutStates,
          roomCount: roomCounts[entry.key] || 0
        })
      )
      .sort((left, right) => left.hubOrder - right.hubOrder)
  }));
}

function buildCapabilitySummary(capabilities, options = {}) {
  const roomCounts = options.roomCounts || {};
  const rolloutStates = options.rolloutStates || {};
  const counts = {
    [DISCOVERY_STATES.PLAYABLE]: 0,
    [DISCOVERY_STATES.PAUSED_NEW_ROOMS]: 0,
    [DISCOVERY_STATES.COMING_SOON]: 0
  };

  for (const entry of listCatalogGames()) {
    counts[getDiscoveryState(entry.key, capabilities, rolloutStates)] += 1;
  }

  return {
    scope: NEW_ROOM_SCOPE,
    counts,
    labels: DISCOVERY_STATE_LABELS,
    totalPublicRooms: Object.values(roomCounts).reduce((sum, value) => sum + Number(value || 0), 0)
  };
}

function buildRolloutSummary(capabilities = {}, rolloutStates = {}) {
  const normalizedRolloutState = normalizeRolloutState(rolloutStates);
  const counts = {
    [DISCOVERY_STATES.PLAYABLE]: 0,
    [DISCOVERY_STATES.PAUSED_NEW_ROOMS]: 0,
    [DISCOVERY_STATES.COMING_SOON]: 0
  };

  let overriddenTitles = 0;
  for (const gameKey of ROLLOUT_MANAGED_GAME_KEYS) {
    const state = getDiscoveryState(gameKey, capabilities, normalizedRolloutState);
    counts[state] += 1;
    if (normalizedRolloutState[gameKey] !== getDefaultRolloutState(gameKey)) {
      overriddenTitles += 1;
    }
  }

  return {
    counts,
    labels: DISCOVERY_STATE_LABELS,
    managedTitles: ROLLOUT_MANAGED_GAME_KEYS.length,
    overriddenTitles
  };
}

function buildRuntimeControlList(state) {
  return RUNTIME_CONTROL_KEYS.map((key) => ({
    ...RUNTIME_CONTROL_META[key],
    value: state[key]
  }));
}

async function readSystemConfigValues(keys) {
  const result = await query(
    `
      SELECT key, value
      FROM system_configs
      WHERE key = ANY($1::text[])
    `,
    [keys]
  );

  return Object.fromEntries(result.rows.map((row) => [row.key, row.value]));
}

async function upsertSystemConfigValue(key, value) {
  return query(
    `
      INSERT INTO system_configs (key, value)
      VALUES ($1, $2)
      ON CONFLICT (key)
      DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    `,
    [key, JSON.stringify(value)]
  );
}

async function getCapabilityState() {
  const configs = await readSystemConfigValues([CAPABILITY_CONFIG_KEY]);
  return normalizeCapabilityState(configs[CAPABILITY_CONFIG_KEY] || {});
}

async function getRolloutState() {
  const configs = await readSystemConfigValues([ROLLOUT_CONFIG_KEY]);
  return normalizeRolloutState(configs[ROLLOUT_CONFIG_KEY] || {});
}

async function getRuntimeControls() {
  const configs = await readSystemConfigValues([
    RUNTIME_CONFIG_KEY,
    "maxOpenRoomsPerUser",
    "maintenanceMode"
  ]);

  return normalizeRuntimeControls({
    ...(configs[RUNTIME_CONFIG_KEY] || {}),
    ...(configs.maxOpenRoomsPerUser !== undefined
      ? { maxOpenRoomsPerUser: configs.maxOpenRoomsPerUser }
      : {}),
    ...(configs.maintenanceMode !== undefined
      ? { maintenanceMode: configs.maintenanceMode }
      : {})
  });
}

async function getAvailabilityControls() {
  const configs = await readSystemConfigValues([AVAILABILITY_CONFIG_KEY]);
  availabilityControlsCache = normalizeAvailabilityControls(configs[AVAILABILITY_CONFIG_KEY] || {});
  return availabilityControlsCache;
}

function getAvailabilityControlsSync() {
  return normalizeAvailabilityControls(availabilityControlsCache);
}

async function getNewRoomControlSnapshot() {
  const [capabilities, rolloutStates, runtime] = await Promise.all([
    getCapabilityState(),
    getRolloutState(),
    getRuntimeControls()
  ]);

  return { capabilities, rolloutStates, runtime };
}

async function updateCapabilities(updates) {
  const normalizedUpdates = normalizeCapabilityUpdates(updates);
  const before = await getCapabilityState();
  const after = { ...before };

  for (const update of normalizedUpdates) {
    after[update.gameKey] = update.enabled;
  }

  const normalizedAfter = normalizeCapabilityState(after);
  await upsertSystemConfigValue(CAPABILITY_CONFIG_KEY, normalizedAfter);

  return {
    before,
    after: normalizedAfter,
    updates: normalizedUpdates
  };
}

async function updateRolloutState(updates) {
  const normalizedUpdates = normalizeRolloutUpdates(updates);
  const before = await getRolloutState();
  const after = { ...before };

  for (const update of normalizedUpdates) {
    after[update.gameKey] = update.state;
  }

  const normalizedAfter = normalizeRolloutState(after);
  await upsertSystemConfigValue(ROLLOUT_CONFIG_KEY, normalizedAfter);

  return {
    before,
    after: normalizedAfter,
    updates: normalizedUpdates
  };
}

async function updateRuntimeControls(updates) {
  const normalizedUpdates = normalizeRuntimeUpdates(updates);
  const before = await getRuntimeControls();
  const after = { ...before };

  for (const update of normalizedUpdates) {
    after[update.key] = update.value;
  }

  const normalizedAfter = normalizeRuntimeControls(after);
  await upsertSystemConfigValue(RUNTIME_CONFIG_KEY, normalizedAfter);
  await upsertSystemConfigValue("maxOpenRoomsPerUser", normalizedAfter.maxOpenRoomsPerUser);
  await upsertSystemConfigValue("maintenanceMode", normalizedAfter.maintenanceMode);

  return {
    before,
    after: normalizedAfter,
    updates: normalizedUpdates
  };
}

async function updateAvailabilityControls(updates) {
  const normalizedUpdates = normalizeAvailabilityUpdates(updates);
  const before = await getAvailabilityControls();
  const after = normalizeAvailabilityControls(before);

  for (const update of normalizedUpdates) {
    const bucket =
      update.scope === "family" ? after.families[update.familyKey] : after.global;

    bucket[update.subsystem] = {
      state: update.state,
      reasonCode: update.reasonCode,
      message: update.message,
      safeActions: [...update.safeActions],
      configured: true
    };
  }

  const normalizedAfter = normalizeAvailabilityControls(after);
  availabilityControlsCache = normalizedAfter;
  await upsertSystemConfigValue(AVAILABILITY_CONFIG_KEY, normalizedAfter);

  return {
    before,
    after: normalizedAfter,
    updates: normalizedUpdates
  };
}

async function recordAdminLog({ operatorUserId, targetUserId = null, action, detail }) {
  await query(
    `
      INSERT INTO admin_logs (operator_user_id, target_user_id, action, detail)
      VALUES ($1, $2, $3, $4)
    `,
    [operatorUserId, targetUserId, action, JSON.stringify(detail || {})]
  );
}

function getNewRoomBlockedReason(gameKey, snapshot) {
  if (snapshot?.runtime?.maintenanceMode) {
    return MAINTENANCE_MODE_ERROR;
  }

  if (
    getDiscoveryState(
      gameKey,
      snapshot?.capabilities || {},
      snapshot?.rolloutStates || {}
    ) !== DISCOVERY_STATES.PLAYABLE
  ) {
    return GAME_DISABLED_ERROR;
  }

  return "";
}

module.exports = {
  AVAILABILITY_CONFIG_KEY,
  AVAILABILITY_FAMILY_KEYS,
  AVAILABILITY_SUBSYSTEMS,
  CAPABILITY_CONFIG_KEY,
  CONTROLLED_GAME_KEYS,
  DISCOVERY_STATES,
  DISCOVERY_STATE_LABELS,
  GAME_DISABLED_ERROR,
  MAINTENANCE_MODE_ERROR,
  NEW_ROOM_SCOPE,
  ROLLOUT_CONFIG_KEY,
  ROLLOUT_MANAGED_GAME_KEYS,
  RUNTIME_CONFIG_KEY,
  RUNTIME_CONTROL_KEYS,
  buildAvailabilityControlList,
  buildCapabilityFamilies,
  buildCapabilitySummary,
  buildDiscoveryItem,
  buildRolloutFamilies,
  buildRolloutSummary,
  buildHubFamilies,
  buildRuntimeControlList,
  getAvailabilityControls,
  getAvailabilityControlsSync,
  getCapabilityState,
  getDiscoveryState,
  getDiscoveryStateDescription,
  getDiscoveryStateLabel,
  getNewRoomBlockedReason,
  getNewRoomControlSnapshot,
  getRolloutState,
  getRuntimeControls,
  isGameEnabled,
  normalizeCapabilityState,
  normalizeCapabilityUpdates,
  normalizeAvailabilityUpdates,
  normalizeRolloutState,
  normalizeRolloutUpdates,
  normalizeRuntimeControls,
  normalizeRuntimeUpdates,
  recordAdminLog,
  updateAvailabilityControls,
  updateCapabilities,
  updateRolloutState,
  updateRuntimeControls,
  __testing: {
    DISCOVERY_STATE_DESCRIPTIONS,
    RUNTIME_CONTROL_META,
    getDefaultAvailabilityControls,
    buildCapabilityFamilies,
    buildAvailabilityControlList,
    buildCapabilitySummary,
    buildDefaultCapabilityState,
    buildDefaultRolloutState,
    buildDiscoveryItem,
    buildRolloutFamilies,
    buildRolloutSummary,
    buildHubFamilies,
    buildRuntimeControlList,
    getDiscoveryState,
    getDiscoveryStateDescription,
    getDiscoveryStateLabel,
    getDefaultRolloutState,
    normalizeCapabilityState,
    normalizeCapabilityUpdates,
    normalizeAvailabilityUpdates,
    normalizeRolloutState,
    normalizeRolloutUpdates,
    normalizeRuntimeControls,
    normalizeRuntimeUpdates,
    parseBooleanLike,
    parsePositiveInteger
  }
};
