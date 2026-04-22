const { query } = require("../db");
const { DEFAULT_SYSTEM_CONFIG } = require("../defaults");
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
const RUNTIME_CONFIG_KEY = "runtimeControls";
const RUNTIME_CONTROL_KEYS = Object.freeze(["maxOpenRoomsPerUser", "maintenanceMode"]);
const CONTROLLED_GAME_KEYS = Object.freeze([...CAPABILITY_MANAGED_GAME_KEYS]);
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

function getDiscoveryState(gameKey, capabilities = {}) {
  const meta = getGameMetaOrFallback(gameKey);
  if (meta.launchState === DISCOVERY_STATES.COMING_SOON || !meta.isShipped) {
    return DISCOVERY_STATES.COMING_SOON;
  }

  if (meta.capabilityManaged === false) {
    return DISCOVERY_STATES.PLAYABLE;
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
  const roomCount = Number(options.roomCount || 0);
  const familyMeta = getFamilyMeta(meta.familyKey) || {
    key: meta.familyKey || "",
    label: meta.familyKey || "",
    strapline: ""
  };
  const state = getDiscoveryState(gameKey, capabilities);

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
    launchMode: meta.launchMode || "room",
    capabilityManaged: meta.capabilityManaged !== false,
    isShipped: Boolean(meta.isShipped),
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

function buildCapabilityFamilies(state) {
  return listCatalogFamilies()
    .map((familyMeta) => ({
      key: familyMeta.key,
      familyKey: familyMeta.key,
      label: familyMeta.label,
      strapline: familyMeta.strapline || "",
      items: listCatalogGames({ includeUpcoming: false })
        .filter((entry) => entry.familyKey === familyMeta.key)
        .map((entry) => buildDiscoveryItem(entry.key, { capabilities: state, roomCount: 0 }))
        .sort((left, right) => left.hubOrder - right.hubOrder)
    }))
    .filter((family) => family.items.length > 0);
}

function buildHubFamilies(capabilities, options = {}) {
  const roomCounts = options.roomCounts || {};

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
          roomCount: roomCounts[entry.key] || 0
        })
      )
      .sort((left, right) => left.hubOrder - right.hubOrder)
  }));
}

function buildCapabilitySummary(capabilities, options = {}) {
  const roomCounts = options.roomCounts || {};
  const counts = {
    [DISCOVERY_STATES.PLAYABLE]: 0,
    [DISCOVERY_STATES.PAUSED_NEW_ROOMS]: 0,
    [DISCOVERY_STATES.COMING_SOON]: 0
  };

  for (const entry of listCatalogGames()) {
    counts[getDiscoveryState(entry.key, capabilities)] += 1;
  }

  return {
    scope: NEW_ROOM_SCOPE,
    counts,
    labels: DISCOVERY_STATE_LABELS,
    totalPublicRooms: Object.values(roomCounts).reduce((sum, value) => sum + Number(value || 0), 0)
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

async function getNewRoomControlSnapshot() {
  const [capabilities, runtime] = await Promise.all([
    getCapabilityState(),
    getRuntimeControls()
  ]);

  return { capabilities, runtime };
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

  if (!isGameEnabled(snapshot?.capabilities || {}, gameKey)) {
    return GAME_DISABLED_ERROR;
  }

  return "";
}

module.exports = {
  CAPABILITY_CONFIG_KEY,
  CONTROLLED_GAME_KEYS,
  DISCOVERY_STATES,
  DISCOVERY_STATE_LABELS,
  GAME_DISABLED_ERROR,
  MAINTENANCE_MODE_ERROR,
  NEW_ROOM_SCOPE,
  RUNTIME_CONFIG_KEY,
  RUNTIME_CONTROL_KEYS,
  buildCapabilityFamilies,
  buildCapabilitySummary,
  buildDiscoveryItem,
  buildHubFamilies,
  buildRuntimeControlList,
  getCapabilityState,
  getDiscoveryState,
  getDiscoveryStateDescription,
  getDiscoveryStateLabel,
  getNewRoomBlockedReason,
  getNewRoomControlSnapshot,
  getRuntimeControls,
  isGameEnabled,
  normalizeCapabilityState,
  normalizeCapabilityUpdates,
  normalizeRuntimeControls,
  normalizeRuntimeUpdates,
  recordAdminLog,
  updateCapabilities,
  updateRuntimeControls,
  __testing: {
    DISCOVERY_STATE_DESCRIPTIONS,
    RUNTIME_CONTROL_META,
    buildCapabilityFamilies,
    buildCapabilitySummary,
    buildDefaultCapabilityState,
    buildDiscoveryItem,
    buildHubFamilies,
    buildRuntimeControlList,
    getDiscoveryState,
    getDiscoveryStateDescription,
    getDiscoveryStateLabel,
    normalizeCapabilityState,
    normalizeCapabilityUpdates,
    normalizeRuntimeControls,
    normalizeRuntimeUpdates,
    parseBooleanLike,
    parsePositiveInteger
  }
};
