const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const { query } = require("./db");

const COOKIE_NAME = "ddz_token";
const USER_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const GUEST_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24;
const GUEST_SCOPE_ERROR = "遊客憑證僅限指定房間";

function getJwtSecret() {
  return process.env.JWT_SECRET || "change-this-secret";
}

function sanitizeUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url || null,
    bio: row.bio || "",
    role: row.role,
    status: row.status,
    coins: row.coins,
    rankScore: row.rank_score,
    wins: row.wins,
    losses: row.losses,
    landlordWins: row.landlord_wins,
    landlordLosses: row.landlord_losses,
    farmerWins: row.farmer_wins,
    farmerLosses: row.farmer_losses,
    totalGames: row.total_games,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

function signToken(user) {
  return jwt.sign(
    {
      kind: "user",
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName || user.display_name
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

function signGuestToken(input = {}) {
  const expiresAt =
    input.expiresAt || new Date(Date.now() + GUEST_TOKEN_MAX_AGE_SECONDS * 1000).toISOString();

  return jwt.sign(
    {
      kind: "guest",
      guestId: String(input.guestId || "").trim(),
      displayName: String(input.displayName || "遊客").trim() || "遊客",
      gameKey: String(input.gameKey || "").trim(),
      roomNo: String(input.roomNo || "").trim(),
      expiresAt
    },
    getJwtSecret(),
    { expiresIn: "24h" }
  );
}

function parseCookies(req) {
  return cookie.parse(req.headers.cookie || "");
}

function setAuthCookie(res, token, options = {}) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: Number(options.maxAge || USER_TOKEN_MAX_AGE_SECONDS)
    })
  );
}

function clearAuthCookie(res) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0
    })
  );
}

function getTokenFromRequest(req) {
  const cookies = parseCookies(req);
  return cookies[COOKIE_NAME];
}

function decodeSessionToken(token) {
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
}

function buildGuestSession(payload) {
  if (!payload?.guestId || !payload?.gameKey || !payload?.roomNo) {
    return null;
  }

  return {
    kind: "guest",
    id: payload.guestId,
    guestId: payload.guestId,
    username: payload.guestId,
    displayName: payload.displayName || "遊客",
    role: "guest",
    status: "guest",
    gameKey: payload.gameKey,
    roomNo: payload.roomNo,
    expiresAt: payload.expiresAt
  };
}

async function getSessionFromRequest(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const payload = decodeSessionToken(token);
  if (!payload) {
    return null;
  }

  if (payload.kind === "guest") {
    return buildGuestSession(payload);
  }

  const result = await query("SELECT * FROM users WHERE id = $1", [payload.id]);
  const user = sanitizeUser(result.rows[0]);
  return user ? { ...user, kind: "user" } : null;
}

async function getUserFromRequest(req) {
  const session = await getSessionFromRequest(req);
  return session?.kind === "guest" ? null : session;
}

async function requireSession(req, res, options = {}) {
  const session = await getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: "未登入或登入已失效" });
    return null;
  }

  if (session.kind === "guest") {
    if (options.allowGuest !== true) {
      res.status(403).json({ error: "此操作需要登入帳號" });
      return null;
    }

    const expectedRoomNo = options.roomNo ? String(options.roomNo).trim() : "";
    const expectedGameKey = options.gameKey ? String(options.gameKey).trim() : "";

    if (
      (expectedRoomNo && session.roomNo !== expectedRoomNo) ||
      (expectedGameKey && session.gameKey !== expectedGameKey)
    ) {
      res.status(403).json({ error: GUEST_SCOPE_ERROR });
      return null;
    }

    return session;
  }

  if (session.status !== "active") {
    res.status(403).json({ error: "帳號不可用" });
    return null;
  }

  return session;
}

async function requireUser(req, res) {
  const session = await requireSession(req, res);
  if (!session || session.kind === "guest") {
    return null;
  }

  return session;
}

async function requireAdmin(req, res) {
  const user = await requireUser(req, res);
  if (!user) {
    return null;
  }

  if (user.role !== "admin") {
    res.status(403).json({ error: "需要管理員權限" });
    return null;
  }

  return user;
}

module.exports = {
  COOKIE_NAME,
  GUEST_SCOPE_ERROR,
  GUEST_TOKEN_MAX_AGE_SECONDS,
  USER_TOKEN_MAX_AGE_SECONDS,
  sanitizeUser,
  hashPassword,
  comparePassword,
  signToken,
  signGuestToken,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest,
  decodeSessionToken,
  getSessionFromRequest,
  getUserFromRequest,
  requireSession,
  requireUser,
  requireAdmin
};
