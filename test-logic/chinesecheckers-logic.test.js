const test = require("node:test");
const assert = require("node:assert/strict");

const { __testing } = require("../lib/board/manager");

test("chinese checkers can jump over any occupied piece, including other players", () => {
  const { getChineseCheckersLegalMoves } = __testing;
  const positions = {
    c8_0: 0,
    c8_1: 1,
    c8_3: 2
  };

  const moves = getChineseCheckersLegalMoves(positions, "c8_0");
  const targets = new Set(moves.map((move) => move.toCellId));

  assert.equal(targets.has("c8_2"), true);
  assert.equal(targets.has("c8_4"), true);
});
