const REVERSI_SIZE = 8;
const REVERSI_PIECES = Object.freeze({
  black: "black",
  white: "white"
});

function createReversiBoard() {
  const board = Array.from({ length: REVERSI_SIZE }, () => Array(REVERSI_SIZE).fill(null));
  board[3][3] = REVERSI_PIECES.white;
  board[3][4] = REVERSI_PIECES.black;
  board[4][3] = REVERSI_PIECES.black;
  board[4][4] = REVERSI_PIECES.white;
  return board;
}

function createReversiBoardFromRows(rows) {
  if (!Array.isArray(rows) || rows.length !== REVERSI_SIZE) {
    throw new Error("Reversi 棋盤必須為 8 行");
  }

  return rows.map((row) => {
    const cells = String(row || "").trim().split("");
    if (cells.length !== REVERSI_SIZE) {
      throw new Error("Reversi 每行必須為 8 格");
    }

    return cells.map((cell) => {
      if (cell === "B") {
        return REVERSI_PIECES.black;
      }
      if (cell === "W") {
        return REVERSI_PIECES.white;
      }
      return null;
    });
  });
}

function getReversiLegalMoves(board, piece) {
  const legalMoves = [];

  for (let row = 0; row < REVERSI_SIZE; row += 1) {
    for (let col = 0; col < REVERSI_SIZE; col += 1) {
      const flips = collectFlips(board, row, col, piece);
      if (flips.length > 0) {
        legalMoves.push({
          row,
          col,
          flips,
          flipCount: flips.length
        });
      }
    }
  }

  return legalMoves;
}

function applyReversiMove(board, row, col, piece) {
  const flips = collectFlips(board, row, col, piece);
  if (flips.length === 0) {
    return null;
  }

  const nextBoard = board.map((cells) => [...cells]);
  nextBoard[row][col] = piece;
  for (const flip of flips) {
    nextBoard[flip.row][flip.col] = piece;
  }

  return {
    board: nextBoard,
    flips,
    flipCount: flips.length
  };
}

function canReversiPieceMove(board, piece) {
  return getReversiLegalMoves(board, piece).length > 0;
}

function isReversiBoardFull(board) {
  return board.every((row) => row.every((cell) => Boolean(cell)));
}

function getReversiScore(board) {
  return board.flat().reduce(
    (score, cell) => {
      if (cell === REVERSI_PIECES.black) {
        score.black += 1;
      } else if (cell === REVERSI_PIECES.white) {
        score.white += 1;
      }
      return score;
    },
    { black: 0, white: 0 }
  );
}

function isReversiGameOver(board) {
  return (
    isReversiBoardFull(board) ||
    (!canReversiPieceMove(board, REVERSI_PIECES.black) &&
      !canReversiPieceMove(board, REVERSI_PIECES.white))
  );
}

function getReversiWinner(board) {
  const score = getReversiScore(board);
  if (score.black === score.white) {
    return { winnerPiece: null, score };
  }

  return {
    winnerPiece: score.black > score.white ? REVERSI_PIECES.black : REVERSI_PIECES.white,
    score
  };
}

function getOpponentPiece(piece) {
  return piece === REVERSI_PIECES.black ? REVERSI_PIECES.white : REVERSI_PIECES.black;
}

function collectFlips(board, row, col, piece) {
  if (!isInsideBoard(row, col) || board[row][col]) {
    return [];
  }

  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]
  ];

  return directions.flatMap(([rowStep, colStep]) =>
    collectDirectionalFlips(board, row, col, piece, rowStep, colStep)
  );
}

function collectDirectionalFlips(board, row, col, piece, rowStep, colStep) {
  const opponent = getOpponentPiece(piece);
  const flips = [];
  let nextRow = row + rowStep;
  let nextCol = col + colStep;

  while (isInsideBoard(nextRow, nextCol) && board[nextRow][nextCol] === opponent) {
    flips.push({ row: nextRow, col: nextCol });
    nextRow += rowStep;
    nextCol += colStep;
  }

  if (
    flips.length === 0 ||
    !isInsideBoard(nextRow, nextCol) ||
    board[nextRow][nextCol] !== piece
  ) {
    return [];
  }

  return flips;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < REVERSI_SIZE && col >= 0 && col < REVERSI_SIZE;
}

module.exports = {
  REVERSI_PIECES,
  REVERSI_SIZE,
  applyReversiMove,
  canReversiPieceMove,
  createReversiBoard,
  createReversiBoardFromRows,
  getOpponentPiece,
  getReversiLegalMoves,
  getReversiScore,
  getReversiWinner,
  isReversiBoardFull,
  isReversiGameOver
};
