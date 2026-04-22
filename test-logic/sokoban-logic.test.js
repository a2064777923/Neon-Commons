const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SOKOBAN_LEVELS,
  applySokobanMove,
  createSokobanSession,
  createSokobanSessionFromRows,
  goToNextSokobanLevel,
  resetSokobanLevel
} = require("../lib/solo/sokoban");

test("walls block movement without mutating the session", () => {
  const session = createSokobanSession();
  const next = applySokobanMove(session, "down");

  assert.equal(next, session);
  assert.deepEqual(next.player, { row: 3, col: 3 });
  assert.equal(next.moveCount, 0);
});

test("single crates push one tile into open space", () => {
  const session = createSokobanSessionFromRows([
    "######",
    "# @$.#",
    "#    #",
    "######"
  ]);

  const next = applySokobanMove(session, "right");
  assert.notEqual(next, session);
  assert.deepEqual(next.player, { row: 1, col: 3 });
  assert.deepEqual([...next.crates], ["1:4"]);
  assert.equal(next.moveCount, 1);
  assert.equal(next.pushCount, 1);
  assert.equal(next.solved, true);
});

test("double pushes are illegal", () => {
  const session = createSokobanSessionFromRows([
    "#######",
    "# @$$.#",
    "#######"
  ]);

  const next = applySokobanMove(session, "right");
  assert.equal(next, session);
  assert.deepEqual([...next.crates], ["1:3", "1:4"]);
  assert.equal(next.moveCount, 0);
});

test("solved state only passes when every crate sits on a goal", () => {
  const partial = createSokobanSessionFromRows([
    "########",
    "# * @  #",
    "#  $.  #",
    "########"
  ]);
  assert.equal(partial.solved, false);

  const intro = createSokobanSession();
  const solved = applySokobanMove(intro, "up");
  assert.equal(solved.solved, true);
});

test("reset and next-level helpers restore counters and advance bundled levels", () => {
  const first = createSokobanSession();
  const moved = applySokobanMove(first, "up");
  const reset = resetSokobanLevel(moved);
  const next = goToNextSokobanLevel(reset);

  assert.equal(reset.levelId, SOKOBAN_LEVELS[0].id);
  assert.equal(reset.moveCount, 0);
  assert.equal(reset.pushCount, 0);
  assert.deepEqual(reset.player, first.player);

  assert.equal(next.levelId, SOKOBAN_LEVELS[1].id);
  assert.equal(next.levelIndex, 1);
  assert.equal(next.moveCount, 0);
});
