const SOKOBAN_LEVELS = Object.freeze([
  Object.freeze({
    id: "intro-push",
    title: "入門推進",
    rows: Object.freeze([
      "#######",
      "#  .  #",
      "#  $  #",
      "#  @  #",
      "#######"
    ])
  }),
  Object.freeze({
    id: "offset-turn",
    title: "轉角熱身",
    rows: Object.freeze([
      "########",
      "#   .  #",
      "# $$   #",
      "#  @   #",
      "########"
    ])
  }),
  Object.freeze({
    id: "double-goal",
    title: "雙目標",
    rows: Object.freeze([
      "########",
      "# .  . #",
      "# $$   #",
      "#  @   #",
      "########"
    ])
  }),
  Object.freeze({
    id: "lane-shift",
    title: "推進走廊",
    rows: Object.freeze([
      "#########",
      "#   .   #",
      "# ###   #",
      "# $ @   #",
      "#   .   #",
      "#########"
    ])
  })
]);

const DIRECTION_OFFSETS = Object.freeze({
  up: Object.freeze({ row: -1, col: 0 }),
  down: Object.freeze({ row: 1, col: 0 }),
  left: Object.freeze({ row: 0, col: -1 }),
  right: Object.freeze({ row: 0, col: 1 })
});

function createSokobanSession(levelRef = 0) {
  const levelIndex = resolveLevelIndex(levelRef);
  return createSokobanSessionFromRows(SOKOBAN_LEVELS[levelIndex].rows, {
    levelIndex,
    levelId: SOKOBAN_LEVELS[levelIndex].id,
    levelTitle: SOKOBAN_LEVELS[levelIndex].title
  });
}

function createSokobanSessionFromRows(rows, options = {}) {
  const normalizedRows = Array.isArray(rows) ? rows.map((row) => String(row || "")) : [];
  if (normalizedRows.length === 0) {
    throw new Error("Sokoban 地圖不可為空");
  }

  const width = normalizedRows.reduce((max, row) => Math.max(max, row.length), 0);
  const height = normalizedRows.length;
  const walls = [];
  const goals = [];
  const crates = [];
  let player = null;

  for (let row = 0; row < height; row += 1) {
    const paddedRow = normalizedRows[row].padEnd(width, " ");
    for (let col = 0; col < width; col += 1) {
      const tile = paddedRow[col];
      const id = toCellId(row, col);

      if (tile === "#") {
        walls.push(id);
      }

      if (tile === "." || tile === "*" || tile === "+") {
        goals.push(id);
      }

      if (tile === "$" || tile === "*") {
        crates.push(id);
      }

      if (tile === "@" || tile === "+") {
        player = { row, col };
      }
    }
  }

  if (!player) {
    throw new Error("Sokoban 地圖缺少玩家起點");
  }

  return freezeSession({
    levelIndex: Number.isInteger(options.levelIndex) ? options.levelIndex : 0,
    levelId: String(options.levelId || `custom-${Date.now()}`),
    levelTitle: String(options.levelTitle || "自訂關卡"),
    width,
    height,
    walls,
    goals,
    crates,
    player,
    moveCount: Number(options.moveCount || 0),
    pushCount: Number(options.pushCount || 0),
    solved: isSolved({ goals, crates })
  });
}

function applySokobanMove(session, direction) {
  const offset = DIRECTION_OFFSETS[direction];
  if (!offset) {
    return session;
  }

  const walls = new Set(session.walls);
  const crates = new Set(session.crates);
  const nextCell = toCellId(session.player.row + offset.row, session.player.col + offset.col);
  if (walls.has(nextCell)) {
    return session;
  }

  let nextCrates = crates;
  let pushCount = session.pushCount;

  if (crates.has(nextCell)) {
    const beyondCell = toCellId(
      session.player.row + offset.row * 2,
      session.player.col + offset.col * 2
    );
    if (walls.has(beyondCell) || crates.has(beyondCell)) {
      return session;
    }

    nextCrates = new Set(crates);
    nextCrates.delete(nextCell);
    nextCrates.add(beyondCell);
    pushCount += 1;
  }

  return freezeSession({
    ...session,
    crates: [...nextCrates].sort(),
    player: {
      row: session.player.row + offset.row,
      col: session.player.col + offset.col
    },
    moveCount: session.moveCount + 1,
    pushCount,
    solved: isSolved({
      goals: session.goals,
      crates: [...nextCrates]
    })
  });
}

function resetSokobanLevel(session) {
  return createSokobanSession(session.levelIndex);
}

function goToPreviousSokobanLevel(session) {
  return createSokobanSession(Math.max(0, session.levelIndex - 1));
}

function goToNextSokobanLevel(session) {
  return createSokobanSession(Math.min(SOKOBAN_LEVELS.length - 1, session.levelIndex + 1));
}

function buildSokobanGrid(session) {
  const walls = new Set(session.walls);
  const goals = new Set(session.goals);
  const crates = new Set(session.crates);
  const playerCell = toCellId(session.player.row, session.player.col);

  return Array.from({ length: session.height }, (_row, row) =>
    Array.from({ length: session.width }, (_col, col) => {
      const id = toCellId(row, col);
      return {
        id,
        row,
        col,
        isWall: walls.has(id),
        isGoal: goals.has(id),
        hasCrate: crates.has(id),
        hasPlayer: playerCell === id
      };
    })
  );
}

function resolveLevelIndex(levelRef) {
  if (typeof levelRef === "string") {
    const byId = SOKOBAN_LEVELS.findIndex((level) => level.id === levelRef);
    if (byId >= 0) {
      return byId;
    }
  }

  const numericIndex = Number(levelRef);
  if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < SOKOBAN_LEVELS.length) {
    return numericIndex;
  }

  return 0;
}

function isSolved({ goals, crates }) {
  const goalSet = new Set(goals || []);
  const crateList = Array.isArray(crates) ? crates : [];
  return crateList.length > 0 && crateList.every((crate) => goalSet.has(crate));
}

function toCellId(row, col) {
  return `${row}:${col}`;
}

function freezeSession(session) {
  return Object.freeze({
    ...session,
    walls: Object.freeze([...(session.walls || [])]),
    goals: Object.freeze([...(session.goals || [])]),
    crates: Object.freeze([...(session.crates || [])]),
    player: Object.freeze({
      row: session.player.row,
      col: session.player.col
    })
  });
}

module.exports = {
  DIRECTION_OFFSETS,
  SOKOBAN_LEVELS,
  applySokobanMove,
  buildSokobanGrid,
  createSokobanSession,
  createSokobanSessionFromRows,
  goToNextSokobanLevel,
  goToPreviousSokobanLevel,
  resetSokobanLevel
};
