const ROOM_AVAILABILITY = Object.freeze({
  LIVE: "live",
  SNAPSHOT_ONLY: "snapshot-only",
  DRAINING: "draining",
  CLOSED: "closed"
});

const AVAILABILITY_SUBSYSTEMS = Object.freeze({
  ENTRY: "entry",
  REALTIME: "realtime",
  VOICE: "voice"
});

const AVAILABILITY_STATES = Object.freeze({
  HEALTHY: "healthy",
  DEGRADED: "degraded",
  BLOCKED: "blocked"
});

const SAFE_ACTIONS = Object.freeze({
  WAIT: "wait",
  RETRY: "retry",
  JOIN_EXISTING: "join-existing",
  SHARE_LINK: "share-link",
  CONTINUE_TEXT_ONLY: "continue-text-only",
  ACTIVE_SPEAKER_ONLY: "active-speaker-only"
});

const AVAILABILITY_FAMILY_KEYS = Object.freeze(["card", "party", "board"]);
const AVAILABILITY_STATE_ORDER = Object.freeze({
  [AVAILABILITY_STATES.HEALTHY]: 0,
  [AVAILABILITY_STATES.DEGRADED]: 1,
  [AVAILABILITY_STATES.BLOCKED]: 2
});

const AVAILABILITY_STATE_LABELS = Object.freeze({
  [AVAILABILITY_STATES.HEALTHY]: "正常",
  [AVAILABILITY_STATES.DEGRADED]: "降級中",
  [AVAILABILITY_STATES.BLOCKED]: "已暫停"
});

const SAFE_ACTION_LABELS = Object.freeze({
  [SAFE_ACTIONS.WAIT]: "稍後再試",
  [SAFE_ACTIONS.RETRY]: "重新嘗試",
  [SAFE_ACTIONS.JOIN_EXISTING]: "僅進現有房間",
  [SAFE_ACTIONS.SHARE_LINK]: "保留邀請",
  [SAFE_ACTIONS.CONTINUE_TEXT_ONLY]: "先用文字繼續",
  [SAFE_ACTIONS.ACTIVE_SPEAKER_ONLY]: "輪到描述者再開咪"
});

const DEFAULT_SAFE_ACTIONS = Object.freeze({
  [AVAILABILITY_SUBSYSTEMS.ENTRY]: Object.freeze({
    [AVAILABILITY_STATES.HEALTHY]: [],
    [AVAILABILITY_STATES.DEGRADED]: [SAFE_ACTIONS.RETRY, SAFE_ACTIONS.SHARE_LINK],
    [AVAILABILITY_STATES.BLOCKED]: [SAFE_ACTIONS.WAIT, SAFE_ACTIONS.SHARE_LINK]
  }),
  [AVAILABILITY_SUBSYSTEMS.REALTIME]: Object.freeze({
    [AVAILABILITY_STATES.HEALTHY]: [],
    [AVAILABILITY_STATES.DEGRADED]: [SAFE_ACTIONS.RETRY, SAFE_ACTIONS.JOIN_EXISTING],
    [AVAILABILITY_STATES.BLOCKED]: [SAFE_ACTIONS.WAIT]
  }),
  [AVAILABILITY_SUBSYSTEMS.VOICE]: Object.freeze({
    [AVAILABILITY_STATES.HEALTHY]: [],
    [AVAILABILITY_STATES.DEGRADED]: [SAFE_ACTIONS.RETRY, SAFE_ACTIONS.CONTINUE_TEXT_ONLY],
    [AVAILABILITY_STATES.BLOCKED]: [SAFE_ACTIONS.CONTINUE_TEXT_ONLY, SAFE_ACTIONS.WAIT]
  })
});

function getDefaultAvailabilityRule() {
  return {
    state: AVAILABILITY_STATES.HEALTHY,
    reasonCode: "",
    message: "",
    safeActions: [],
    configured: false
  };
}

function createAvailabilityBucket() {
  return {
    [AVAILABILITY_SUBSYSTEMS.ENTRY]: getDefaultAvailabilityRule(),
    [AVAILABILITY_SUBSYSTEMS.REALTIME]: getDefaultAvailabilityRule(),
    [AVAILABILITY_SUBSYSTEMS.VOICE]: getDefaultAvailabilityRule()
  };
}

function getDefaultAvailabilityControls() {
  return {
    global: createAvailabilityBucket(),
    families: Object.fromEntries(
      AVAILABILITY_FAMILY_KEYS.map((familyKey) => [familyKey, createAvailabilityBucket()])
    )
  };
}

function parseBooleanLike(value, fallback = false) {
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

function normalizeAvailabilityState(value, strict = false) {
  const candidate = String(value || "").trim();
  if (Object.values(AVAILABILITY_STATES).includes(candidate)) {
    return candidate;
  }

  if (strict) {
    throw new Error(`未知降級狀態: ${candidate || "未提供"}`);
  }

  return AVAILABILITY_STATES.HEALTHY;
}

function normalizeAvailabilitySubsystem(value, strict = false) {
  const candidate = String(value || "").trim();
  if (Object.values(AVAILABILITY_SUBSYSTEMS).includes(candidate)) {
    return candidate;
  }

  if (strict) {
    throw new Error(`未知服務子系統: ${candidate || "未提供"}`);
  }

  return AVAILABILITY_SUBSYSTEMS.ENTRY;
}

function normalizeAvailabilityFamily(value, strict = false) {
  const candidate = String(value || "").trim();
  if (!candidate) {
    return "";
  }

  if (AVAILABILITY_FAMILY_KEYS.includes(candidate)) {
    return candidate;
  }

  if (strict) {
    throw new Error(`未知降級範圍: ${candidate}`);
  }

  return "";
}

function normalizeSafeActions(values, subsystem, state, strict = false) {
  const nextActions = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const candidate = String(value || "").trim();
    if (!candidate) {
      continue;
    }

    if (!Object.values(SAFE_ACTIONS).includes(candidate)) {
      if (strict) {
        throw new Error(`未知安全操作: ${candidate}`);
      }
      continue;
    }

    if (seen.has(candidate)) {
      continue;
    }

    seen.add(candidate);
    nextActions.push(candidate);
  }

  if (nextActions.length > 0 || state === AVAILABILITY_STATES.HEALTHY) {
    return nextActions;
  }

  return [...(DEFAULT_SAFE_ACTIONS[subsystem]?.[state] || [])];
}

function normalizeAvailabilityRule(input = {}, subsystem, options = {}) {
  const strict = Boolean(options.strict);
  const provided = input && typeof input === "object" ? input : {};
  const state = normalizeAvailabilityState(provided.state, strict);
  return {
    state,
    reasonCode: String(provided.reasonCode || "").trim(),
    message: String(provided.message || "").trim(),
    safeActions: normalizeSafeActions(provided.safeActions, subsystem, state, strict),
    configured: parseBooleanLike(
      provided.configured,
      Object.keys(provided).length > 0 ? true : Boolean(options.configured)
    )
  };
}

function normalizeAvailabilityControls(input = {}, options = {}) {
  const strict = Boolean(options.strict);
  const normalized = getDefaultAvailabilityControls();
  const source = input && typeof input === "object" ? input : {};
  const sourceGlobal = source.global && typeof source.global === "object" ? source.global : {};
  const sourceFamilies =
    source.families && typeof source.families === "object" ? source.families : {};

  for (const subsystem of Object.values(AVAILABILITY_SUBSYSTEMS)) {
    normalized.global[subsystem] = normalizeAvailabilityRule(sourceGlobal[subsystem], subsystem, {
      strict,
      configured: Object.prototype.hasOwnProperty.call(sourceGlobal, subsystem)
    });
  }

  for (const familyKey of AVAILABILITY_FAMILY_KEYS) {
    const familySource =
      sourceFamilies[familyKey] && typeof sourceFamilies[familyKey] === "object"
        ? sourceFamilies[familyKey]
        : {};

    for (const subsystem of Object.values(AVAILABILITY_SUBSYSTEMS)) {
      normalized.families[familyKey][subsystem] = normalizeAvailabilityRule(
        familySource[subsystem],
        subsystem,
        {
          strict,
          configured: Object.prototype.hasOwnProperty.call(familySource, subsystem)
        }
      );
    }
  }

  return normalized;
}

function getAvailabilityStateLabel(state) {
  return AVAILABILITY_STATE_LABELS[state] || AVAILABILITY_STATE_LABELS[AVAILABILITY_STATES.HEALTHY];
}

function getSafeActionLabel(action) {
  return SAFE_ACTION_LABELS[action] || "";
}

function arraysEqual(left = [], right = []) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function getUndercoverVoiceSafeActions(state) {
  if (state === AVAILABILITY_STATES.DEGRADED) {
    return [SAFE_ACTIONS.RETRY, SAFE_ACTIONS.ACTIVE_SPEAKER_ONLY];
  }

  if (state === AVAILABILITY_STATES.BLOCKED) {
    return [SAFE_ACTIONS.WAIT, SAFE_ACTIONS.ACTIVE_SPEAKER_ONLY];
  }

  return [];
}

function getUndercoverVoiceMessage(state) {
  if (state === AVAILABILITY_STATES.BLOCKED) {
    return "誰是臥底語音暫停中，先留在房內等恢復，恢復後再由當前描述者開咪。";
  }

  if (state === AVAILABILITY_STATES.DEGRADED) {
    return "誰是臥底語音波動中，輪到描述者再開咪；若接通失敗可稍後重試。";
  }

  return "";
}

function getDefaultAvailabilityMessage({ subsystem, state, familyKey = "", scope = "global" }) {
  const familyPrefix = scope === "family" && familyKey ? `${getFamilyLabel(familyKey)} ` : "";

  if (state === AVAILABILITY_STATES.HEALTHY) {
    return "";
  }

  if (subsystem === AVAILABILITY_SUBSYSTEMS.ENTRY) {
    return state === AVAILABILITY_STATES.BLOCKED
      ? `${familyPrefix}入口暫時停用，請稍後再試。`
      : `${familyPrefix}入口狀態不穩定，可先保留邀請或稍後重試。`;
  }

  if (subsystem === AVAILABILITY_SUBSYSTEMS.REALTIME) {
    return state === AVAILABILITY_STATES.BLOCKED
      ? `${familyPrefix}即時房間服務暫時停用，請等待恢復。`
      : `${familyPrefix}即時房間服務波動中，現有房間以當前狀態為準。`;
  }

  if (subsystem === AVAILABILITY_SUBSYSTEMS.VOICE) {
    return state === AVAILABILITY_STATES.BLOCKED
      ? `${familyPrefix}語音暫時停用，請先使用文字溝通。`
      : `${familyPrefix}語音不穩定，可先文字溝通或稍後重試。`;
  }

  return "";
}

function resolveAvailabilityStatus(controls, options = {}) {
  const normalizedControls = normalizeAvailabilityControls(controls);
  const subsystem = normalizeAvailabilitySubsystem(options.subsystem);
  const familyKey = normalizeAvailabilityFamily(options.familyKey);
  const gameKey = String(options.gameKey || "").trim();
  const familyRule = familyKey ? normalizedControls.families[familyKey]?.[subsystem] : null;
  const useFamilyRule = Boolean(familyRule?.configured);
  const rule = useFamilyRule ? familyRule : normalizedControls.global[subsystem];
  const scope = useFamilyRule ? "family" : "global";

  const status = {
    subsystem,
    state: rule.state,
    label: getAvailabilityStateLabel(rule.state),
    reasonCode: rule.reasonCode,
    message:
      rule.message ||
      getDefaultAvailabilityMessage({
        subsystem,
        state: rule.state,
        familyKey,
        scope
      }),
    safeActions: [...rule.safeActions],
    scope,
    familyKey: scope === "family" ? familyKey : "",
    configured: Boolean(rule.configured)
  };

  if (subsystem !== AVAILABILITY_SUBSYSTEMS.VOICE || gameKey !== "undercover") {
    return status;
  }

  if (status.state === AVAILABILITY_STATES.HEALTHY) {
    return status;
  }

  const genericMessage = getDefaultAvailabilityMessage({
    subsystem,
    state: status.state,
    familyKey,
    scope
  });
  const genericSafeActions = DEFAULT_SAFE_ACTIONS[subsystem]?.[status.state] || [];
  const specializedSafeActions = getUndercoverVoiceSafeActions(status.state);

  return {
    ...status,
    message:
      !status.message || status.message === genericMessage
        ? getUndercoverVoiceMessage(status.state)
        : status.message,
    safeActions:
      status.safeActions.length === 0 || arraysEqual(status.safeActions, genericSafeActions)
        ? specializedSafeActions
        : [...status.safeActions]
  };
}

function buildAvailabilityEnvelope(options = {}) {
  const familyKey = normalizeAvailabilityFamily(options.familyKey);
  const gameKey = String(options.gameKey || "").trim();
  const roomAvailability = String(options.roomAvailability || ROOM_AVAILABILITY.LIVE).trim();
  const supportsVoice = options.supportsVoice !== false;
  const entry = resolveAvailabilityStatus(options.controls, {
    familyKey,
    gameKey,
    subsystem: AVAILABILITY_SUBSYSTEMS.ENTRY
  });
  const realtime = resolveAvailabilityStatus(options.controls, {
    familyKey,
    gameKey,
    subsystem: AVAILABILITY_SUBSYSTEMS.REALTIME
  });
  const voice = supportsVoice
    ? resolveAvailabilityStatus(options.controls, {
      familyKey,
      gameKey,
        subsystem: AVAILABILITY_SUBSYSTEMS.VOICE
      })
    : {
        subsystem: AVAILABILITY_SUBSYSTEMS.VOICE,
        state: AVAILABILITY_STATES.HEALTHY,
        label: getAvailabilityStateLabel(AVAILABILITY_STATES.HEALTHY),
        reasonCode: "",
        message: "",
        safeActions: [],
        scope: "global",
        familyKey: "",
        configured: false,
        supported: false
      };

  const relevantStates = [entry.state, realtime.state];
  if (supportsVoice) {
    relevantStates.push(voice.state);
  }

  const state = relevantStates.reduce((current, candidate) => {
    if ((AVAILABILITY_STATE_ORDER[candidate] || 0) > (AVAILABILITY_STATE_ORDER[current] || 0)) {
      return candidate;
    }
    return current;
  }, AVAILABILITY_STATES.HEALTHY);

  return {
    state,
    label: getAvailabilityStateLabel(state),
    familyKey,
    roomAvailability,
    subsystems: {
      [AVAILABILITY_SUBSYSTEMS.ENTRY]: entry,
      [AVAILABILITY_SUBSYSTEMS.REALTIME]: realtime,
      [AVAILABILITY_SUBSYSTEMS.VOICE]: voice
    }
  };
}

function buildAvailabilityControlList(controls) {
  const normalizedControls = normalizeAvailabilityControls(controls);
  const rows = [];

  for (const subsystem of Object.values(AVAILABILITY_SUBSYSTEMS)) {
    rows.push(
      buildAvailabilityControlRow(normalizedControls.global[subsystem], {
        subsystem,
        scope: "global",
        familyKey: ""
      })
    );
  }

  for (const familyKey of AVAILABILITY_FAMILY_KEYS) {
    for (const subsystem of Object.values(AVAILABILITY_SUBSYSTEMS)) {
      rows.push(
        buildAvailabilityControlRow(normalizedControls.families[familyKey][subsystem], {
          subsystem,
          scope: "family",
          familyKey
        })
      );
    }
  }

  return rows;
}

function buildAvailabilityControlRow(rule, options = {}) {
  return {
    scope: options.scope || "global",
    scopeKey:
      options.scope === "family" && options.familyKey
        ? `family:${options.familyKey}`
        : "global",
    scopeLabel:
      options.scope === "family" && options.familyKey
        ? `${getFamilyLabel(options.familyKey)}家族`
        : "全域",
    familyKey: options.familyKey || "",
    subsystem: options.subsystem || AVAILABILITY_SUBSYSTEMS.ENTRY,
    subsystemLabel: getSubsystemLabel(options.subsystem),
    state: rule.state,
    stateLabel: getAvailabilityStateLabel(rule.state),
    reasonCode: rule.reasonCode,
    message:
      rule.message ||
      getDefaultAvailabilityMessage({
        subsystem: options.subsystem,
        state: rule.state,
        familyKey: options.familyKey,
        scope: options.scope
      }),
    safeActions: [...rule.safeActions],
    configured: Boolean(rule.configured)
  };
}

function getSubsystemLabel(subsystem) {
  if (subsystem === AVAILABILITY_SUBSYSTEMS.ENTRY) {
    return "入口";
  }
  if (subsystem === AVAILABILITY_SUBSYSTEMS.REALTIME) {
    return "即時房間";
  }
  if (subsystem === AVAILABILITY_SUBSYSTEMS.VOICE) {
    return "語音";
  }
  return "";
}

function getFamilyLabel(familyKey) {
  if (familyKey === "card") {
    return "卡牌";
  }
  if (familyKey === "party") {
    return "派對";
  }
  if (familyKey === "board") {
    return "棋盤";
  }
  return familyKey || "";
}

module.exports = {
  AVAILABILITY_FAMILY_KEYS,
  AVAILABILITY_STATES,
  AVAILABILITY_STATE_LABELS,
  AVAILABILITY_SUBSYSTEMS,
  ROOM_AVAILABILITY,
  SAFE_ACTIONS,
  SAFE_ACTION_LABELS,
  buildAvailabilityControlList,
  buildAvailabilityEnvelope,
  getAvailabilityStateLabel,
  getDefaultAvailabilityControls,
  getDefaultAvailabilityMessage,
  getDefaultAvailabilityRule,
  getFamilyLabel,
  getSafeActionLabel,
  getSubsystemLabel,
  normalizeAvailabilityControls,
  normalizeAvailabilityFamily,
  normalizeAvailabilityRule,
  normalizeAvailabilityState,
  normalizeAvailabilitySubsystem,
  resolveAvailabilityStatus,
  __testing: {
    DEFAULT_SAFE_ACTIONS,
    AVAILABILITY_STATE_ORDER,
    buildAvailabilityControlRow,
    createAvailabilityBucket,
    normalizeSafeActions,
    parseBooleanLike
  }
};
