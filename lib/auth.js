const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const { query } = require("./db");

const COOKIE_NAME = "ddz_token";

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
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName || user.display_name
    },
    getJwtSecret(),
    { expiresIn: "7d" }
  );
}

function parseCookies(req) {
  return cookie.parse(req.headers.cookie || "");
}

function setAuthCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
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

async function getUserFromRequest(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret());
    const result = await query("SELECT * FROM users WHERE id = $1", [payload.id]);
    return sanitizeUser(result.rows[0]);
  } catch (error) {
    return null;
  }
}

async function requireUser(req, res) {
  const user = await getUserFromRequest(req);
  if (!user) {
    res.status(401).json({ error: "未登入或登入已失效" });
    return null;
  }

  if (user.status !== "active") {
    res.status(403).json({ error: "帳號不可用" });
    return null;
  }

  return user;
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
  sanitizeUser,
  hashPassword,
  comparePassword,
  signToken,
  setAuthCookie,
  clearAuthCookie,
  getTokenFromRequest,
  getUserFromRequest,
  requireUser,
  requireAdmin
};
