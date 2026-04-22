const { query } = require("./db");
const { DEFAULT_SYSTEM_CONFIG } = require("./defaults");

const SYSTEM_CONFIG_KEYS = Object.freeze(["roomExpiryMinutes"]);

function getSystemConfigStore() {
  if (!global.neonCommonsSystemConfigStore) {
    global.neonCommonsSystemConfigStore = {
      values: {
        roomExpiryMinutes: normalizeRoomExpiryMinutes(DEFAULT_SYSTEM_CONFIG.roomExpiryMinutes)
      }
    };
  }

  return global.neonCommonsSystemConfigStore;
}

async function loadSystemConfigCache() {
  const result = await query(
    `
      SELECT key, value
      FROM system_configs
      WHERE key = ANY($1::text[])
    `,
    [SYSTEM_CONFIG_KEYS]
  );

  for (const row of result.rows) {
    setSystemConfigValue(row.key, row.value);
  }

  return getSystemConfigSnapshot();
}

function setSystemConfigValue(key, value) {
  if (String(key || "").trim() !== "roomExpiryMinutes") {
    return;
  }

  const store = getSystemConfigStore();
  store.values.roomExpiryMinutes = normalizeRoomExpiryMinutes(value);
}

function getSystemConfigSnapshot() {
  const store = getSystemConfigStore();
  return {
    roomExpiryMinutes: store.values.roomExpiryMinutes
  };
}

function getRoomExpiryMs() {
  return getSystemConfigStore().values.roomExpiryMinutes * 60 * 1000;
}

function normalizeRoomExpiryMinutes(value) {
  const candidate =
    typeof value === "object" && value && "minutes" in value ? value.minutes : value;
  const numeric = Number(candidate);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }

  return Number(DEFAULT_SYSTEM_CONFIG.roomExpiryMinutes || 30);
}

module.exports = {
  loadSystemConfigCache,
  setSystemConfigValue,
  getSystemConfigSnapshot,
  getRoomExpiryMs,
  __testing: {
    resetSystemConfigCache() {
      delete global.neonCommonsSystemConfigStore;
    }
  }
};
