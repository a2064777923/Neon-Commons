const { query } = require("../db");
const { DEFAULT_SYSTEM_CONFIG } = require("../defaults");
const { GAME_CATALOG, getGameMode } = require("../games/catalog");

const CAPABILITY_CONFIG_KEY = "gameCapabilities";
const RUNTIME_CONFIG_KEY = "runtimeControls";
const RUNTIME_CONTROL_KEYS = Object.freeze(["maxOpenRoomsPerUser", "maintenanceMode"]);
const CONTROLLED_GAME_KEYS = Object.freeze([
  "doudezhu",
  "werewolf",
  "avalon",
  "gomoku",
  "chinesecheckers"
]);
const NEW_ROOM_SCOPE = "new-rooms-only";
const MAINTENANCE_MODE_ERROR = "系統維護中，暫停新建房間";
const GAME_DISABLED_ERROR = "該遊戲目前未開放新房";

const FAMILY_META = Object.freeze({
  card: { key: "card", label: "卡牌" },
  party: { key: "party", label: "派對" },
  board: { key: "board", label: "棋類" }
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
  const meta = GAME_CATALOG[gameKey];
  if (meta) {
    return meta;
  }

  return {
    key: gameKey,
    title: gameKey,
    strapline: "",
    route: "",
    audience: ""
  };
}

function buildCapabilityFamilies(state) {
  const grouped = {
    card: [],
    party: [],
    board: []
  };

  for (const gameKey of CONTROLLED_GAME_KEYS) {
    const meta = getGameMetaOrFallback(gameKey);
    const family = getGameMode(gameKey);
    if (!family || !grouped[family]) {
      continue;
    }

    grouped[family].push({
      gameKey,
      family,
      title: meta.title,
      strapline: meta.strapline || "",
      route: meta.route || "",
      enabled: Boolean(state[gameKey]),
      appliesTo: NEW_ROOM_SCOPE
    });
  }

  return Object.values(FAMILY_META).map((family) => ({
    ...family,
    items: grouped[family.key]
  }));
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

function isGameEnabled(capabilities, gameKey) {
  if (!CONTROLLED_GAME_KEYS.includes(gameKey)) {
    return false;
  }

  return Boolean(capabilities[gameKey]);
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
  GAME_DISABLED_ERROR,
  MAINTENANCE_MODE_ERROR,
  NEW_ROOM_SCOPE,
  RUNTIME_CONFIG_KEY,
  RUNTIME_CONTROL_KEYS,
  buildCapabilityFamilies,
  buildRuntimeControlList,
  getCapabilityState,
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
    FAMILY_META,
    RUNTIME_CONTROL_META,
    buildCapabilityFamilies,
    buildDefaultCapabilityState,
    buildRuntimeControlList,
    normalizeCapabilityState,
    normalizeCapabilityUpdates,
    normalizeRuntimeControls,
    normalizeRuntimeUpdates,
    parseBooleanLike,
    parsePositiveInteger
  }
};
