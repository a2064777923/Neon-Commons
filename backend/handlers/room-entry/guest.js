const {
  GUEST_TOKEN_MAX_AGE_SECONDS,
  getSessionFromRequest,
  setAuthCookie,
  signGuestToken
} = require("../../../lib/auth");
const { methodNotAllowed, parseBody } = require("../../../lib/http");
const { resolveRoomEntry } = require("../../../lib/rooms/directory");
const { getRoomManager } = require("../../../lib/game/room-manager");
const { getPartyRoomManager } = require("../../../lib/party/manager");
const { getBoardRoomManager } = require("../../../lib/board/manager");
const {
  AUTH_SCOPES,
  API_ROUTE_PATTERNS,
  createHandlerContract
} = require("../../../lib/shared/network-contract");

async function handler(req, res) {
  if (req.method !== "POST") {
    return methodNotAllowed(res, ["POST"]);
  }

  const body = parseBody(req);
  const roomNo = String(body.roomNo || "").trim();
  const gameKeyHint = String(body.gameKey || body.gameKeyHint || "").trim();
  const displayName = normalizeGuestDisplayName(body.displayName, roomNo);
  if (!roomNo) {
    return res.status(400).json({ error: "缺少房號" });
  }

  const entry = resolveRoomEntry(roomNo, { gameKeyHint });
  if (!entry) {
    return res.status(404).json({ error: "找不到這個房間" });
  }

  if (entry.gameKey === "doudezhu") {
    return res.status(400).json({ error: "當前房間不支持遊客加入" });
  }

  if (entry.visibility !== "private") {
    return res.status(400).json({ error: "遊客僅可通過私密邀請入場" });
  }

  if (!entry.guestAllowed) {
    return res.status(400).json({ error: "當前房間不支持遊客加入" });
  }

  const existingSession = await getSessionFromRequest(req);
  const guestSession =
    existingSession?.kind === "guest" &&
    existingSession.roomNo === entry.roomNo &&
    existingSession.gameKey === entry.gameKey
      ? existingSession
      : createGuestSession(entry, displayName);

  const room = joinGuestToRoom(entry, guestSession);
  const token = signGuestToken(guestSession);
  setAuthCookie(res, token, { maxAge: GUEST_TOKEN_MAX_AGE_SECONDS });

  return res.status(200).json({
    session: guestSession,
    detailRoute: entry.detailRoute,
    room
  });
}

function createGuestSession(entry, displayName) {
  return {
    kind: "guest",
    guestId: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    displayName,
    gameKey: entry.gameKey,
    roomNo: entry.roomNo,
    expiresAt: new Date(Date.now() + GUEST_TOKEN_MAX_AGE_SECONDS * 1000).toISOString()
  };
}

function normalizeGuestDisplayName(input, roomNo) {
  const candidate = String(input || "").trim().slice(0, 24);
  return candidate || `遊客${String(roomNo || "").slice(-4) || "玩家"}`;
}

function joinGuestToRoom(entry, guestSession) {
  const guestUser = {
    id: guestSession.guestId,
    username: guestSession.guestId,
    displayName: guestSession.displayName
  };

  if (entry.familyKey === "party") {
    const manager = getPartyRoomManager();
    const room = manager.joinRoom(entry.roomNo, guestUser);
    return manager.serializeRoom(room, guestUser.id);
  }

  if (entry.familyKey === "board") {
    const manager = getBoardRoomManager();
    const room = manager.joinRoom(entry.roomNo, guestUser);
    return manager.serializeRoom(room, guestUser.id);
  }

  const manager = getRoomManager();
  const room = manager.joinRoom(entry.roomNo, guestUser);
  return manager.serializeRoom(room, guestUser.id);
}

handler.contract = createHandlerContract(
  "roomEntry.guest",
  API_ROUTE_PATTERNS.roomEntry.guest,
  ["POST"],
  AUTH_SCOPES.PUBLIC
);

module.exports = handler;
module.exports.default = handler;
module.exports.contract = handler.contract;
