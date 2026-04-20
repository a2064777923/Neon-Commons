const { requireUser, sanitizeUser } = require("../../lib/auth");
const { query } = require("../../lib/db");
const { methodNotAllowed, parseBody } = require("../../lib/http");

const AVATAR_PATTERN = /^data:image\/(png|jpeg|jpg|webp);base64,[a-z0-9+/=]+$/i;
const MAX_AVATAR_LENGTH = 380000;

async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) {
    return undefined;
  }

  if (req.method === "GET") {
    const result = await query("SELECT * FROM users WHERE id = $1 LIMIT 1", [user.id]);
    return res.status(200).json({ user: sanitizeUser(result.rows[0]) });
  }

  if (req.method !== "PATCH") {
    return methodNotAllowed(res, ["GET", "PATCH"]);
  }

  const body = parseBody(req);
  const displayName = String(body.displayName || "").trim().slice(0, 60);
  const bio = String(body.bio || "").trim().slice(0, 160);
  const avatarUrl = normalizeAvatar(body.avatarUrl);

  if (!displayName) {
    return res.status(400).json({ error: "昵称不能为空" });
  }

  if (body.avatarUrl && avatarUrl === false) {
    return res.status(400).json({ error: "头像格式无效，请上传 PNG、JPG 或 WebP 图片" });
  }

  const result = await query(
    `
      UPDATE users
      SET
        display_name = $2,
        bio = $3,
        avatar_url = $4,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [user.id, displayName, bio, avatarUrl]
  );

  return res.status(200).json({ user: sanitizeUser(result.rows[0]) });
}

function normalizeAvatar(value) {
  if (!value) {
    return null;
  }

  const avatar = String(value).trim();
  if (!avatar) {
    return null;
  }

  if (avatar.length > MAX_AVATAR_LENGTH) {
    return false;
  }

  return AVATAR_PATTERN.test(avatar) ? avatar : false;
}

module.exports = handler;
module.exports.default = handler;
