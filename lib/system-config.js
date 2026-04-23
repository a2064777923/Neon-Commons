const { query } = require("./db");
const { DEFAULT_SYSTEM_CONFIG } = require("./defaults");

const SYSTEM_CONFIG_KEYS = Object.freeze(["roomExpiryMinutes", "partyVoiceTransport"]);

function getSystemConfigStore() {
  if (!global.neonCommonsSystemConfigStore) {
    global.neonCommonsSystemConfigStore = {
      values: {
        roomExpiryMinutes: normalizeRoomExpiryMinutes(DEFAULT_SYSTEM_CONFIG.roomExpiryMinutes),
        partyVoiceTransport: normalizePartyVoiceTransport(
          DEFAULT_SYSTEM_CONFIG.partyVoiceTransport
        )
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
  const normalizedKey = String(key || "").trim();
  const store = getSystemConfigStore();

  if (normalizedKey === "roomExpiryMinutes") {
    store.values.roomExpiryMinutes = normalizeRoomExpiryMinutes(value);
    return;
  }

  if (normalizedKey === "partyVoiceTransport") {
    store.values.partyVoiceTransport = normalizePartyVoiceTransport(value);
  }
}

function getSystemConfigSnapshot() {
  const store = getSystemConfigStore();
  return {
    roomExpiryMinutes: store.values.roomExpiryMinutes,
    partyVoiceTransport: normalizePartyVoiceTransport(store.values.partyVoiceTransport)
  };
}

function getRoomExpiryMs() {
  return getSystemConfigStore().values.roomExpiryMinutes * 60 * 1000;
}

function getPartyVoiceTransportConfig() {
  return normalizePartyVoiceTransport(getSystemConfigStore().values.partyVoiceTransport);
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

function normalizePartyVoiceTransport(value) {
  const source = parseJsonObjectMaybe(value);
  const defaults = DEFAULT_SYSTEM_CONFIG.partyVoiceTransport || {};

  return {
    startupProbeMs: normalizePositiveInteger(source.startupProbeMs, defaults.startupProbeMs, 4000),
    persistentFailureMs: normalizePositiveInteger(
      source.persistentFailureMs,
      defaults.persistentFailureMs,
      6000
    ),
    reconnectGraceSeconds: normalizePositiveInteger(
      source.reconnectGraceSeconds,
      defaults.reconnectGraceSeconds,
      45
    ),
    stickyRelay: normalizeBoolean(source.stickyRelay, defaults.stickyRelay, true),
    resumeMutedOnRecovery: normalizeBoolean(
      source.resumeMutedOnRecovery,
      defaults.resumeMutedOnRecovery,
      true
    ),
    iceServers: normalizeIceServers(source.iceServers, defaults.iceServers)
  };
}

function parseJsonObjectMaybe(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      } catch (_error) {
        return {};
      }
    }

    return {};
  }

  return value;
}

function normalizePositiveInteger(value, fallback, hardDefault) {
  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric > 0) {
    return numeric;
  }

  const fallbackNumeric = Number(fallback);
  if (Number.isInteger(fallbackNumeric) && fallbackNumeric > 0) {
    return fallbackNumeric;
  }

  return hardDefault;
}

function normalizeBoolean(value, fallback, hardDefault) {
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

  if (typeof fallback === "boolean") {
    return fallback;
  }

  return hardDefault;
}

function normalizeIceServers(value, fallback) {
  const entries = normalizeIceServerEntries(value);
  if (entries.length > 0) {
    return entries;
  }

  const fallbackEntries = normalizeIceServerEntries(fallback);
  if (fallbackEntries.length > 0) {
    return fallbackEntries;
  }

  return normalizeIceServerEntries(DEFAULT_SYSTEM_CONFIG.partyVoiceTransport?.iceServers);
}

function normalizeIceServerEntries(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  const entries = [];

  for (const entry of value) {
    const normalized = normalizeIceServerEntry(entry);
    if (normalized) {
      entries.push(normalized);
    }
  }

  return entries;
}

function normalizeIceServerEntry(value) {
  if (typeof value === "string") {
    const urls = normalizeIceServerUrls(value);
    return urls ? { urls } : null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const urls = normalizeIceServerUrls(value.urls);
  if (!urls) {
    return null;
  }

  const normalized = { urls };
  if (typeof value.username === "string" && value.username.trim()) {
    normalized.username = value.username.trim();
  }
  if (typeof value.credential === "string" && value.credential.trim()) {
    normalized.credential = value.credential.trim();
  }
  return normalized;
}

function normalizeIceServerUrls(value) {
  if (Array.isArray(value)) {
    const urls = value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);

    if (urls.length === 0) {
      return null;
    }

    return urls.length === 1 ? urls[0] : urls;
  }

  const single = String(value || "").trim();
  return single || null;
}

module.exports = {
  loadSystemConfigCache,
  setSystemConfigValue,
  getSystemConfigSnapshot,
  getRoomExpiryMs,
  getPartyVoiceTransportConfig,
  __testing: {
    resetSystemConfigCache() {
      delete global.neonCommonsSystemConfigStore;
    }
  }
};
