const SUPPORTED_TEMPLATE_MODES = Object.freeze(["CLASSIC", "ROB", "NO_SHUFFLE"]);
const ALL_TEMPLATE_MODES = Object.freeze([...SUPPORTED_TEMPLATE_MODES, "LAIZI"]);

const MODE_SUPPORT = Object.freeze({
  CLASSIC: Object.freeze({ supported: true, reason: null }),
  ROB: Object.freeze({ supported: true, reason: null }),
  NO_SHUFFLE: Object.freeze({ supported: true, reason: null }),
  LAIZI: Object.freeze({
    supported: false,
    reason: "癩子玩法暫未接通發牌與牌型判定，暫不能上線或開房。"
  })
});

const DEFAULT_TEMPLATE_SETTINGS_BY_MODE = Object.freeze({
  CLASSIC: Object.freeze({
    baseScore: 50,
    bidOptions: [0, 1, 2, 3],
    countdownSeconds: 18,
    autoTrusteeMinSeconds: 2,
    autoTrusteeMaxSeconds: 5,
    allowSpring: true,
    allowBomb: true,
    allowRocket: true,
    allowBots: true,
    maxRobMultiplier: 3,
    bombMultiplier: 2,
    rocketMultiplier: 2,
    springMultiplier: 2,
    roomVisibility: "public"
  }),
  ROB: Object.freeze({
    baseScore: 100,
    bidOptions: [0, 1, 2, 3, 4],
    countdownSeconds: 15,
    autoTrusteeMinSeconds: 2,
    autoTrusteeMaxSeconds: 4,
    allowSpring: true,
    allowBomb: true,
    allowRocket: true,
    allowBots: true,
    maxRobMultiplier: 4,
    bombMultiplier: 2,
    rocketMultiplier: 2,
    springMultiplier: 2,
    roomVisibility: "public"
  }),
  NO_SHUFFLE: Object.freeze({
    baseScore: 200,
    bidOptions: [0, 1, 2, 3, 4],
    countdownSeconds: 16,
    autoTrusteeMinSeconds: 2,
    autoTrusteeMaxSeconds: 5,
    allowSpring: true,
    allowBomb: true,
    allowRocket: true,
    allowBots: true,
    maxRobMultiplier: 4,
    bombMultiplier: 2,
    rocketMultiplier: 2,
    springMultiplier: 2,
    roomVisibility: "private"
  }),
  LAIZI: Object.freeze({
    baseScore: 100,
    bidOptions: [0, 1, 2, 3, 4],
    countdownSeconds: 16,
    autoTrusteeMinSeconds: 2,
    autoTrusteeMaxSeconds: 4,
    allowSpring: true,
    allowBomb: true,
    allowRocket: true,
    allowBots: true,
    maxRobMultiplier: 4,
    bombMultiplier: 2,
    rocketMultiplier: 2,
    springMultiplier: 2,
    roomVisibility: "private"
  })
});

const DEFAULT_TEMPLATE_PRESETS = Object.freeze([
  Object.freeze({
    name: "classic-ranked",
    title: "經典排位房",
    description: "標準三人斗地主，叫分搶地主、炸彈與春天結算。",
    mode: "CLASSIC",
    isActive: true,
    settings: DEFAULT_TEMPLATE_SETTINGS_BY_MODE.CLASSIC
  }),
  Object.freeze({
    name: "rob-fast",
    title: "搶地主快開房",
    description: "更快的節奏，叫地主與加倍流程簡化，適合好友局。",
    mode: "ROB",
    isActive: true,
    settings: DEFAULT_TEMPLATE_SETTINGS_BY_MODE.ROB
  }),
  Object.freeze({
    name: "no-shuffle-social",
    title: "不洗牌娛樂房",
    description: "使用固定牌序發牌的娛樂模式，適合測試與熟人對局。",
    mode: "NO_SHUFFLE",
    isActive: true,
    settings: DEFAULT_TEMPLATE_SETTINGS_BY_MODE.NO_SHUFFLE
  }),
  Object.freeze({
    name: "laizi-beta",
    title: "癩子實驗房",
    description: "預留癩子玩法模板，首版先保留配置入口，默認關閉。",
    mode: "LAIZI",
    isActive: false,
    settings: DEFAULT_TEMPLATE_SETTINGS_BY_MODE.LAIZI
  })
]);

function normalizeTemplateMode(mode, fallback = "CLASSIC") {
  const normalized = String(mode || "")
    .trim()
    .toUpperCase();
  if (ALL_TEMPLATE_MODES.includes(normalized)) {
    return normalized;
  }

  return ALL_TEMPLATE_MODES.includes(fallback) ? fallback : "CLASSIC";
}

function getTemplateModeSupport(mode) {
  return MODE_SUPPORT[normalizeTemplateMode(mode)] || MODE_SUPPORT.CLASSIC;
}

function isSupportedTemplateMode(mode) {
  return getTemplateModeSupport(mode).supported;
}

function assertSupportedTemplateMode(mode) {
  const normalizedMode = normalizeTemplateMode(mode);
  const support = getTemplateModeSupport(normalizedMode);
  if (!support.supported) {
    throw new Error(support.reason);
  }

  return normalizedMode;
}

function getDefaultTemplateSettings(mode = "CLASSIC") {
  const normalizedMode = normalizeTemplateMode(mode);
  return {
    ...DEFAULT_TEMPLATE_SETTINGS_BY_MODE[normalizedMode]
  };
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["false", "0", "off", "no"].includes(normalized)) {
      return false;
    }
    if (["true", "1", "on", "yes"].includes(normalized)) {
      return true;
    }
  }

  return Boolean(value);
}

function normalizeBidOptions(options, maxBid, fallbackOptions) {
  const source = Array.isArray(options) ? options : fallbackOptions;
  const sanitized = [...new Set(source.map((value) => clampInteger(value, null, 0, maxBid)))]
    .filter((value) => Number.isInteger(value))
    .sort((left, right) => left - right);

  if (!sanitized.includes(0)) {
    sanitized.unshift(0);
  }

  const positiveOptions = sanitized.filter((value) => value > 0);
  if (positiveOptions.length === 0) {
    return Array.from({ length: maxBid + 1 }, (_item, index) => index);
  }

  return [0, ...positiveOptions];
}

function normalizeRoomSettings(settings = {}, mode = "CLASSIC") {
  const normalizedMode = normalizeTemplateMode(mode);
  const defaults = getDefaultTemplateSettings(normalizedMode);
  const normalized = {};

  normalized.baseScore = clampInteger(settings.baseScore, defaults.baseScore, 10, 5000);
  normalized.maxRobMultiplier = clampInteger(
    settings.maxRobMultiplier,
    defaults.maxRobMultiplier,
    1,
    4
  );
  normalized.bidOptions = normalizeBidOptions(
    settings.bidOptions,
    normalized.maxRobMultiplier,
    defaults.bidOptions
  );
  normalized.countdownSeconds = clampInteger(
    settings.countdownSeconds,
    defaults.countdownSeconds,
    8,
    45
  );
  normalized.autoTrusteeMinSeconds = clampInteger(
    settings.autoTrusteeMinSeconds ?? settings.autoTrusteeSeconds,
    defaults.autoTrusteeMinSeconds,
    1,
    10
  );
  normalized.autoTrusteeMaxSeconds = clampInteger(
    settings.autoTrusteeMaxSeconds ?? settings.autoTrusteeSeconds,
    defaults.autoTrusteeMaxSeconds,
    normalized.autoTrusteeMinSeconds,
    20
  );
  normalized.allowSpring = normalizeBoolean(settings.allowSpring, defaults.allowSpring);
  normalized.allowBomb = normalizeBoolean(settings.allowBomb, defaults.allowBomb);
  normalized.allowRocket = normalizeBoolean(settings.allowRocket, defaults.allowRocket);
  normalized.allowBots = normalizeBoolean(settings.allowBots, defaults.allowBots);
  normalized.bombMultiplier = clampInteger(
    settings.bombMultiplier,
    defaults.bombMultiplier,
    1,
    8
  );
  normalized.rocketMultiplier = clampInteger(
    settings.rocketMultiplier,
    defaults.rocketMultiplier,
    1,
    8
  );
  normalized.springMultiplier = clampInteger(
    settings.springMultiplier,
    defaults.springMultiplier,
    1,
    8
  );
  normalized.roomVisibility =
    settings.roomVisibility === "private" ? "private" : "public";

  return normalized;
}

function pickAllowedOverrides(input = {}) {
  const overrides = {};
  for (const key of [
    "baseScore",
    "bidOptions",
    "countdownSeconds",
    "autoTrusteeMinSeconds",
    "autoTrusteeMaxSeconds",
    "autoTrusteeSeconds",
    "roomVisibility",
    "allowBots",
    "allowSpring",
    "allowBomb",
    "allowRocket",
    "maxRobMultiplier",
    "springMultiplier",
    "bombMultiplier",
    "rocketMultiplier"
  ]) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] !== "" && input[key] !== null) {
      overrides[key] = input[key];
    }
  }

  return overrides;
}

function getBidCeiling(settings = {}) {
  const normalized = normalizeRoomSettings(settings);
  return normalized.bidOptions[normalized.bidOptions.length - 1] || normalized.maxRobMultiplier;
}

function normalizeTemplateRecord(record = {}) {
  const mode = normalizeTemplateMode(record.mode);
  const support = getTemplateModeSupport(mode);

  return {
    id: record.id,
    name: record.name,
    title: record.title,
    description: record.description || "",
    mode,
    isActive: normalizeBoolean(record.isActive ?? record.is_active, false),
    modeSupported: support.supported,
    unsupportedReason: support.reason,
    settings: normalizeRoomSettings(record.settings || {}, mode),
    updatedAt: record.updatedAt || record.updated_at || null
  };
}

function normalizeText(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function normalizeTemplateMutation(input = {}, options = {}) {
  const existing = options.existing ? normalizeTemplateRecord(options.existing) : null;
  const mode = normalizeTemplateMode(
    input.mode ?? existing?.mode ?? "CLASSIC",
    existing?.mode ?? "CLASSIC"
  );
  const support = getTemplateModeSupport(mode);
  const baseSettings = existing
    ? normalizeRoomSettings(existing.settings, mode)
    : getDefaultTemplateSettings(mode);
  const mergedSettings =
    Object.prototype.hasOwnProperty.call(input, "settings") &&
    input.settings &&
    typeof input.settings === "object"
      ? { ...baseSettings, ...input.settings }
      : baseSettings;
  const settings = normalizeRoomSettings(mergedSettings, mode);
  const fallbackPreset = DEFAULT_TEMPLATE_PRESETS.find((item) => item.mode === mode);
  const isActive = normalizeBoolean(
    input.isActive ?? input.is_active,
    existing?.isActive ?? true
  );

  if (isActive && !support.supported) {
    throw new Error(support.reason);
  }

  return {
    name: normalizeText(
      input.name,
      existing?.name || fallbackPreset?.name || `ddz-${mode.toLowerCase()}`
    ),
    title: normalizeText(
      input.title,
      existing?.title || fallbackPreset?.title || "斗地主模板"
    ),
    description: normalizeText(
      input.description,
      existing?.description || fallbackPreset?.description || ""
    ),
    mode,
    isActive,
    settings
  };
}

module.exports = {
  SUPPORTED_TEMPLATE_MODES,
  ALL_TEMPLATE_MODES,
  DEFAULT_TEMPLATE_PRESETS,
  DEFAULT_TEMPLATE_SETTINGS_BY_MODE,
  normalizeTemplateMode,
  getTemplateModeSupport,
  isSupportedTemplateMode,
  assertSupportedTemplateMode,
  getDefaultTemplateSettings,
  normalizeRoomSettings,
  normalizeTemplateRecord,
  normalizeTemplateMutation,
  pickAllowedOverrides,
  getBidCeiling
};
