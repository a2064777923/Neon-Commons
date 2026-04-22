const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getBoardDefaultConfig,
  getBoardConfigSummary
} = require("../lib/games/catalog");
const { getBoardRoomManager, __testing } = require("../lib/board/manager");

function createUser(id, name) {
  return {
    id,
    username: id,
    displayName: name
  };
}

function cleanupRoom(room) {
  if (!room) {
    return;
  }

  clearTimeout(room.turnTimer);
  room.botTimers.forEach((timer) => clearTimeout(timer));
}

test("gomoku default config and summary include the opening rule", () => {
  const config = getBoardDefaultConfig("gomoku");

  assert.equal(config.openingRule, "standard");
  assert.deepEqual(getBoardConfigSummary("gomoku", config), ["标准开局", "25 秒/手"]);
});

test("gomoku opening rule normalization falls back to standard", () => {
  const normalized = __testing.normalizeBoardConfig("gomoku", {
    openingRule: "unknown-rule",
    turnSeconds: 22
  });

  assert.equal(normalized.openingRule, "standard");
  assert.equal(normalized.turnSeconds, 22);
});

test("center-opening gomoku rejects a non-center first move and accepts the center move", () => {
  delete global.boardRoomManager;
  const manager = getBoardRoomManager();
  const owner = createUser("owner", "房主");
  const guest = createUser("guest", "对手");
  const room = manager.createRoom(owner, "gomoku", {
    openingRule: "center-opening"
  });

  manager.joinRoom(room.roomNo, guest);
  manager.setReady(room.roomNo, owner.id, true);
  manager.setReady(room.roomNo, guest.id, true);

  assert.equal(room.state, "playing");
  assert.throws(
    () => manager.submitMove(room.roomNo, owner.id, { row: 0, col: 0 }),
    /天元开局首手必须落在棋盘中心/
  );
  assert.equal(room.match.moveCount, 0);

  manager.submitMove(room.roomNo, owner.id, { row: 7, col: 7 });

  assert.equal(room.match.moveCount, 1);
  assert.equal(room.match.board[7][7], "black");

  cleanupRoom(room);
  delete global.boardRoomManager;
});
