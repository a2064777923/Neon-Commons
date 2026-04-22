const PENDING_GUEST_MATCH_CLAIM_KEY = "neon-commons.pending-guest-match-claim";
const {
  AVAILABILITY_STATES,
  getAvailabilityStateLabel,
  getSafeActionLabel
} = require("../shared/availability");
const PRESENCE_LABELS = Object.freeze({
  connected: "在线",
  reconnecting: "重连中",
  disconnected: "离线"
});

export function getRoomEntryPath(gameKey, roomNo) {
  const normalizedGameKey = String(gameKey || "").trim();
  const normalizedRoomNo = String(roomNo || "").trim();
  return `/entry/${encodeURIComponent(normalizedGameKey)}/${encodeURIComponent(normalizedRoomNo)}`;
}

export function getPresenceState(value) {
  if (!value) {
    return "disconnected";
  }

  const explicitState = String(value.presenceState || "").trim();
  if (explicitState) {
    return explicitState;
  }

  return value.connected ? "connected" : "disconnected";
}

export function getPresenceLabel(value, overrides = {}) {
  const labels = { ...PRESENCE_LABELS, ...overrides };
  return labels[getPresenceState(value)] || labels.disconnected;
}

export function getReconnectCountdownSeconds(reconnectGraceEndsAt, nowMs = Date.now()) {
  if (!reconnectGraceEndsAt) {
    return null;
  }

  const remainingMs = Date.parse(reconnectGraceEndsAt) - nowMs;
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
    return null;
  }

  return Math.ceil(remainingMs / 1000);
}

export function getRecoveryBannerMessage(viewer, socketConnected, nowMs = Date.now()) {
  if (!viewer?.recoveryEligible) {
    return "";
  }

  const presenceState = getPresenceState(viewer);
  if (presenceState === "reconnecting") {
    const seconds = getReconnectCountdownSeconds(viewer.reconnectGraceEndsAt, nowMs);
    const prefix = socketConnected === false ? "连接中断，正在恢复你的席位" : "正在恢复你的席位";
    return seconds ? `${prefix}，保留 ${seconds} 秒` : prefix;
  }

  if (socketConnected === false) {
    return "连接中断，正在重新连接…";
  }

  return "";
}

export function canRecoverRoomSession(session, roomLike) {
  if (!session?.recoveryEligible || !roomLike) {
    return false;
  }

  if (session.kind === "user") {
    return true;
  }

  return session.kind === "guest" &&
    session.roomNo === roomLike.roomNo &&
    session.gameKey === roomLike.gameKey;
}

export function getDegradedState(target) {
  return target?.degradedState || { state: AVAILABILITY_STATES.HEALTHY, subsystems: {} };
}

export function getDegradedSubsystem(target, subsystem) {
  return getDegradedState(target)?.subsystems?.[subsystem] || {
    subsystem,
    state: AVAILABILITY_STATES.HEALTHY,
    label: getAvailabilityStateLabel(AVAILABILITY_STATES.HEALTHY),
    reasonCode: "",
    message: "",
    safeActions: []
  };
}

export function isSubsystemBlocked(target, subsystem) {
  return getDegradedSubsystem(target, subsystem).state === AVAILABILITY_STATES.BLOCKED;
}

export function isSubsystemDegraded(target, subsystem) {
  return getDegradedSubsystem(target, subsystem).state !== AVAILABILITY_STATES.HEALTHY;
}

export function getSafeActionLabels(actions = []) {
  return actions
    .map((action) => getSafeActionLabel(action))
    .filter(Boolean);
}

export async function copyText(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") {
    throw new Error("clipboard unavailable");
  }

  const textarea = document.createElement("textarea");
  textarea.value = String(text || "");
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "absolute";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function readPendingGuestMatchClaim() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const rawValue = window.sessionStorage.getItem(PENDING_GUEST_MATCH_CLAIM_KEY);
    if (!rawValue) {
      return null;
    }

    const parsed = JSON.parse(rawValue);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writePendingGuestMatchClaim(claim) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(PENDING_GUEST_MATCH_CLAIM_KEY, JSON.stringify(claim));
}

export function clearPendingGuestMatchClaim() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(PENDING_GUEST_MATCH_CLAIM_KEY);
}
