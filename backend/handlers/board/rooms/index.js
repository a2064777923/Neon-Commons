const { requireUser } = require("../../../../lib/auth");
const { query } = require("../../../../lib/db");
const { methodNotAllowed, parseBody } = require("../../../../lib/http");
const { BOARD_GAME_KEYS, getGameMeta } = require("../../../../lib/games/catalog");
const { getBoardRoomManager } = require("../../../../lib/board/manager");

async function handler(req, res) {
  const roomManager = getBoardRoomManager();
  const gameKey = String(req.query.gameKey || parseBody(req).gameKey || "").trim();

  if (req.method === "GET") {
    if (!BOARD_GAME_KEYS.includes(gameKey)) {
      return res.status(200).json({ items: [] });
    }

    return res.status(200).json({ items: roomManager.listPublicRooms(gameKey) });
  }

  if (req.method !== "POST") {
    return methodNotAllowed(res, ["GET", "POST"]);
  }

  const user = await requireUser(req, res);
  if (!user) {
    return undefined;
  }

  if (!BOARD_GAME_KEYS.includes(gameKey)) {
    return res.status(400).json({ error: "缺少有效游戏类型" });
  }

  const roomCount = roomManager.countOpenRoomsByOwner(user.id, gameKey);
  const config = await query(
    "SELECT value FROM system_configs WHERE key = 'maxOpenRoomsPerUser' LIMIT 1"
  );
  const maxRooms = Number(config.rows[0]?.value || 3);
  if (roomCount >= maxRooms) {
    return res.status(400).json({ error: `单个玩家最多同时开 ${maxRooms} 个房间` });
  }

  const body = parseBody(req);
  const room = roomManager.createRoom(user, gameKey, body.config || {});
  const meta = getGameMeta(gameKey);

  return res.status(201).json({
    game: meta,
    room: roomManager.serializeRoom(room, user.id)
  });
}

module.exports = handler;
module.exports.default = handler;
