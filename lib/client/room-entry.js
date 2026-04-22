const PENDING_GUEST_MATCH_CLAIM_KEY = "neon-commons.pending-guest-match-claim";

export function getRoomEntryPath(gameKey, roomNo) {
  const normalizedGameKey = String(gameKey || "").trim();
  const normalizedRoomNo = String(roomNo || "").trim();
  return `/entry/${encodeURIComponent(normalizedGameKey)}/${encodeURIComponent(normalizedRoomNo)}`;
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
