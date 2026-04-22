const test = require("node:test");
const assert = require("node:assert/strict");

const {
  REVERSI_PIECES,
  applyReversiMove,
  createReversiBoard,
  createReversiBoardFromRows,
  getReversiLegalMoves,
  getReversiScore,
  getReversiWinner
} = require("../lib/board/reversi");
const { getBoardRoomManager } = require("../lib/board/manager");
const { __testing: directoryTesting } = require("../lib/rooms/directory");

test("reversi opening move set stays canonical", () => {
  const legalMoves = getReversiLegalMoves(createReversiBoard(), REVERSI_PIECES.black)
    .map((move) => `${move.row},${move.col}`)
    .sort();

  assert.deepEqual(legalMoves, ["2,3", "3,2", "4,5", "5,4"]);
});

test("reversi flips can resolve in multiple directions", () => {
  const board = createReversiBoardFromRows([
    "........",
    "...B....",
    "...W....",
    ".BW.WB..",
    "...W....",
    "...B....",
    "........",
    "........"
  ]);

  const result = applyReversiMove(board, 3, 3, REVERSI_PIECES.black);
  assert.ok(result);
  assert.equal(result.flipCount, 4);
  assert.equal(result.board[2][3], REVERSI_PIECES.black);
  assert.equal(result.board[3][2], REVERSI_PIECES.black);
  assert.equal(result.board[3][4], REVERSI_PIECES.black);
  assert.equal(result.board[4][3], REVERSI_PIECES.black);
});

test("board manager auto-passes when the next seat has no legal move and keeps dedicated detail routes", () => {
  resetManagers();
  const manager = getBoardRoomManager();
  const owner = { id: 301, username: "owner301", displayName: "Owner 301" };
  const challenger = { id: 302, username: "challenger302", displayName: "Challenger 302" };
  const room = manager.createRoom(owner, "reversi", {
    visibility: "private",
    maxPlayers: 2,
    turnSeconds: 20
  });
  manager.joinRoom(room.roomNo, challenger);
  room.players.forEach((player) => {
    player.ready = true;
  });
  manager.startReversi(room);

  room.match.board = createReversiBoardFromRows([
    "BBBBBBBB",
    "BBBBBBBB",
    "BBBBBBBB",
    "BBBBBBBB",
    "BBBBBBBB",
    "BBBBBBBB",
    "BBBBBBBB",
    "BBBBBBW."
  ]);
  room.match.turnSeat = 1;

  manager.resolveReversiTurnState(room);

  assert.equal(room.match.turnSeat, 0);
  assert.equal(manager.buildRoomDirectoryEntry(room).detailRoute, `/reversi/${room.roomNo}`);

  clearTimeout(room.turnTimer);
});

test("winner scoring prefers the higher disc count", () => {
  const board = createReversiBoardFromRows([
    "BBBBBBBB",
    "BBBBBBBB",
    "BBBBBBBB",
    "BBBBBBBB",
    "WWWWWWWW",
    "WWWWWWWW",
    "BBBBBBBB",
    "BBBBBBBB"
  ]);

  const score = getReversiScore(board);
  const winner = getReversiWinner(board);

  assert.deepEqual(score, { black: 48, white: 16 });
  assert.equal(winner.winnerPiece, REVERSI_PIECES.black);
});

function resetManagers() {
  directoryTesting.resetRoomDirectory();
  delete global.boardRoomManager;
}
