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

test("chinese checkers progress counts pieces that reach the target camp", () => {
  const positions = __testing.createChineseCheckersPositions(2);
  const targetCellId = Object.entries(positions).find(([, seatIndex]) => seatIndex === 1)[0];
  positions[targetCellId] = 0;

  const progress = __testing.getChineseCheckersProgress({
    gameKey: "chinesecheckers",
    config: { maxPlayers: 2 },
    players: [
      { seatIndex: 0, displayName: "红方" },
      { seatIndex: 1, displayName: "绿方" }
    ],
    match: {
      positions
    }
  });

  assert.equal(progress[0].goalReached, 1);
  assert.equal(progress[0].remaining, progress[0].goalTotal - 1);
  assert.equal(progress[1].goalReached >= 0, true);
});
