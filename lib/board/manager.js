const {
  BOARD_GAME_KEYS,
  getGameMeta,
  getBoardDefaultConfig,
  getBoardOpeningOptions,
  getGameLimits
} = require("../games/catalog");
const { applyUserSettlements, buildStandardSettlements } = require("../economy");
const {
  allocateRoomNo,
  registerRoomEntry,
  unregisterRoomEntry,
  updateRoomEntry
} = require("../rooms/directory");
const { getRoomExpiryMs: resolveRoomExpiryMs } = require("../system-config");
const {
  API_ROUTES,
  SOCKET_EVENTS,
  buildSeatRecoveryState
} = require("../shared/network-contract");
const {
  REVERSI_PIECES,
  REVERSI_SIZE,
  applyReversiMove,
  createReversiBoard,
  getOpponentPiece,
  getReversiLegalMoves,
  getReversiScore,
  getReversiWinner,
  isReversiBoardFull,
  isReversiGameOver
} = require("./reversi");

const GOMOKU_SIZE = 15;
const GOMOKU_CENTER_INDEX = Math.floor(GOMOKU_SIZE / 2);
const CHINESE_CHECKERS_ROW_LENGTHS = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];
const CHINESE_VERTICAL_GAP = 0.8660254037844386;
const CHINESE_CHECKERS_PLAYER_COUNTS = [2, 4, 6];

const GOMOKU_PIECES = [
  { token: "black", label: "黑棋", accent: "dark" },
  { token: "white", label: "白棋", accent: "light" }
];

const CHINESE_CHECKERS_CAMP_PROFILES = {
  top: {
    campKey: "top",
    campLabel: "北营",
    targetCampKey: "bottom",
    targetCampLabel: "南营",
    token: "red",
    label: "红方",
    accent: "red"
  },
  upperRight: {
    campKey: "upperRight",
    campLabel: "东北营",
    targetCampKey: "lowerLeft",
    targetCampLabel: "西南营",
    token: "amber",
    label: "橙方",
    accent: "amber"
  },
  lowerRight: {
    campKey: "lowerRight",
    campLabel: "东南营",
    targetCampKey: "upperLeft",
    targetCampLabel: "西北营",
    token: "gold",
    label: "金方",
    accent: "gold"
  },
  bottom: {
    campKey: "bottom",
    campLabel: "南营",
    targetCampKey: "top",
    targetCampLabel: "北营",
    token: "green",
    label: "绿方",
    accent: "green"
  },
  lowerLeft: {
    campKey: "lowerLeft",
    campLabel: "西南营",
    targetCampKey: "upperRight",
    targetCampLabel: "东北营",
    token: "blue",
    label: "蓝方",
    accent: "blue"
  },
  upperLeft: {
    campKey: "upperLeft",
    campLabel: "西北营",
    targetCampKey: "lowerRight",
    targetCampLabel: "东南营",
    token: "violet",
    label: "紫方",
    accent: "violet"
  }
};

const CHINESE_CHECKERS_SEAT_LAYOUTS = {
  2: ["top", "bottom"],
  4: ["upperRight", "lowerRight", "lowerLeft", "upperLeft"],
  6: ["top", "upperRight", "lowerRight", "bottom", "lowerLeft", "upperLeft"]
};

const GOMOKU_BOT_NAMES = ["黑杉", "云岚", "木影", "苍岫", "玄弈", "星砂"];
const CHINESE_CHECKERS_BOT_NAMES = ["流火", "青岚", "晨霜", "越岭", "浮光", "远汀"];
const DEFAULT_RECONNECT_GRACE_MS = 15000;

const CHINESE_BOARD = buildChineseCheckersBoard();

function getBoardRoomManager() {
  if (!global.boardRoomManager) {
    global.boardRoomManager = new BoardRoomManager();
  }

  return global.boardRoomManager;
}

class BoardRoomManager {
  constructor() {
    this.rooms = new Map();
    this.io = null;
    this.reconnectGraceMs = DEFAULT_RECONNECT_GRACE_MS;
    this.reconnectTimers = new Map();
    this.roomExpiryTimers = new Map();
  }

  attachIo(io) {
    this.io = io;
  }

  listRooms() {
    return [...this.rooms.values()];
  }

  listPublicRooms(gameKey = null) {
    return [...this.rooms.values()]
      .filter(
        (room) =>
          room.config.visibility !== "private" &&
          (!gameKey || room.gameKey === gameKey)
      )
      .map((room) => this.serializeRoomSummary(room));
  }

  countOpenRoomsByOwner(ownerId, gameKey = null) {
    return [...this.rooms.values()].filter(
      (room) =>
        room.ownerId === ownerId &&
        room.state !== "archived" &&
        (!gameKey || room.gameKey === gameKey)
    ).length;
  }

  createRoom(owner, gameKey, overrides = {}) {
    if (!BOARD_GAME_KEYS.includes(gameKey)) {
      throw new Error("不支持的棋类游戏");
    }

    const meta = getGameMeta(gameKey);
    const roomNo = allocateRoomNo();
    const config = normalizeBoardConfig(gameKey, overrides);
    const room = {
      roomNo,
      ownerId: owner.id,
      gameKey,
      title: meta.title,
      strapline: meta.strapline,
      createdAt: new Date().toISOString(),
      adminState: "live",
      state: "waiting",
      config,
      turnTimer: null,
      turnEndsAt: null,
      turnDurationMs: null,
      botTimers: [],
      players: [this.createHumanSeat(owner, 0)],
      match: null,
      feed: [],
      lastResult: null
    };

    pushFeed(room, `${owner.displayName || owner.username} 创建了 ${meta.title} 房间`, "system");
    this.rooms.set(roomNo, room);
    registerRoomEntry(this.buildRoomDirectoryEntry(room));
    return room;
  }

  getRoom(roomNo) {
    return this.rooms.get(roomNo);
  }

  joinRoom(roomNo, user) {
    const room = this.assertRoom(roomNo);
    const existingSeat = room.players.find(
      (player) => player.userId === user.id && !player.isBot
    );
    if (existingSeat) {
      existingSeat.displayName = user.displayName || user.username;
      this.markSeatConnected(room, existingSeat);
      this.syncRoomDirectory(room);
      return room;
    }

    this.assertRoomJoinable(room);

    if (room.players.length >= room.config.maxPlayers) {
      throw new Error("房间人数已满");
    }

    room.players.push(this.createHumanSeat(user, room.players.length));
    this.clearRoomExpiryTimer(room.roomNo);
    pushFeed(room, `${user.displayName || user.username} 加入房间`, "join");
    this.syncRoomDirectory(room);
    this.emitRoom(room);
    return room;
  }

  setReady(roomNo, userId, ready = true) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("你不在该房间内");
    }

    if (room.state !== "waiting") {
      throw new Error("当前对局进行中");
    }

    seat.ready = Boolean(ready);
    pushFeed(
      room,
      `${seat.displayName} ${seat.ready ? "已准备" : "取消准备"}`,
      seat.ready ? "ready" : "system"
    );
    this.emitRoom(room);
    this.maybeStartRoom(room);
    return room;
  }

  addBot(roomNo, userId, count = 1) {
    const room = this.assertOwnerWaitingRoom(roomNo, userId);
    const openSeats = room.config.maxPlayers - room.players.length;
    if (openSeats <= 0) {
      throw new Error("房间已经满员");
    }

    const totalToAdd = Math.min(openSeats, clampNumber(count || 1, 1, openSeats));
    for (let index = 0; index < totalToAdd; index += 1) {
      const seat = this.createBotSeat(room, room.players.length);
      room.players.push(seat);
      pushFeed(room, `${seat.displayName} 已作为 AI 补位入座`, "system");
    }

    this.emitRoom(room);
    this.maybeStartRoom(room);
    return room;
  }

  registerSocket(roomNo, userId, socket) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("尚未加入房间");
    }

    seat.socketIds.add(socket.id);
    this.markSeatConnected(room, seat);
    socket.join(getSocketRoom(roomNo));
    this.emitRoom(room);
  }

  unregisterSocket(socketId) {
    for (const room of this.rooms.values()) {
      for (const seat of room.players) {
        if (!seat.socketIds.has(socketId)) {
          continue;
        }

        seat.socketIds.delete(socketId);
        if (seat.socketIds.size > 0 || seat.isBot) {
          continue;
        }

        this.markSeatReconnecting(room, seat);
        this.emitRoom(room);
        this.syncRoomOccupancyLifecycle(room);
        return;
      }
    }
  }

  submitMove(roomNo, userId, payload = {}) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("你不在该房间内");
    }

    if (room.state !== "playing" || !room.match) {
      throw new Error("当前没有进行中的棋局");
    }

    if (room.match.turnSeat !== seat.seatIndex) {
      throw new Error("还没轮到你");
    }

    if (room.gameKey === "gomoku") {
      this.applyGomokuMove(room, seat, payload.row, payload.col, false);
    } else if (room.gameKey === "reversi") {
      this.applyReversiTurn(room, seat, payload.row, payload.col, false);
    } else if (room.gameKey === "chinesecheckers") {
      this.applyChineseCheckersMove(room, seat, payload.fromCellId, payload.toCellId, false);
    } else {
      throw new Error("未知的棋类模式");
    }

    this.emitRoom(room);
    return room;
  }

  maybeStartRoom(room) {
    if (room.state !== "waiting") {
      return;
    }

    if (room.players.length < getRequiredPlayersToStart(room)) {
      return;
    }

    if (!room.players.every((player) => player.ready)) {
      return;
    }

    if (room.gameKey === "gomoku") {
      this.startGomoku(room);
    } else if (room.gameKey === "reversi") {
      this.startReversi(room);
    } else if (room.gameKey === "chinesecheckers") {
      this.startChineseCheckers(room);
    }
  }

  startGomoku(room) {
    room.state = "playing";
    room.lastResult = null;
    room.players.forEach((player, seatIndex) => {
      player.ready = false;
      player.piece = getRoomPieceToken(room, seatIndex);
    });

    room.match = {
      turnSeat: 0,
      moveCount: 0,
      board: createEmptyGomokuBoard(),
      lastMove: null
    };

    pushFeed(
      room,
      room.config.openingRule === "center-opening"
        ? "棋盘展开，黑棋先手，本局採用天元开局。"
        : "棋盘展开，黑棋先手。",
      "system"
    );
    this.scheduleTurn(room);
  }

  startReversi(room) {
    room.state = "playing";
    room.lastResult = null;
    room.players.forEach((player, seatIndex) => {
      player.ready = false;
      player.piece = getRoomPieceToken(room, seatIndex);
    });

    room.match = {
      turnSeat: 0,
      moveCount: 0,
      board: createReversiBoard(),
      lastMove: null,
      consecutivePasses: 0
    };

    pushFeed(room, "黑棋先手，角位與邊線會決定局勢。", "system");
    this.scheduleTurn(room);
  }

  startChineseCheckers(room) {
    room.state = "playing";
    room.lastResult = null;
    room.players.forEach((player, seatIndex) => {
      player.ready = false;
      player.piece = getRoomPieceToken(room, seatIndex);
    });

    room.match = {
      turnSeat: 0,
      moveCount: 0,
      positions: createChineseCheckersPositions(room.config.maxPlayers),
      lastMove: null,
      seatCount: room.config.maxPlayers
    };

    pushFeed(
      room,
      `星盘点亮，${getRoomPieceLabel(room, 0) || "首位棋手"}先行。`,
      "system"
    );
    this.scheduleTurn(room);
  }

  scheduleTurn(room) {
    clearTimeout(room.turnTimer);
    this.clearBotTimers(room);

    if (room.gameKey === "reversi") {
      this.resolveReversiTurnState(room);
      if (!room.match || room.state !== "playing") {
        return;
      }
    } else if (room.gameKey === "chinesecheckers") {
      const turnResolution = resolveChineseCheckersTurn(room);
      if (turnResolution.type === "blocked") {
        this.finishMatch(room, buildChineseCheckersBlockedResult(room));
        return;
      }

      if (turnResolution.skippedSeats.length > 0) {
        turnResolution.skippedSeats.forEach((seatIndex) => {
          const skippedSeat = room.players[seatIndex];
          if (!skippedSeat) {
            return;
          }

          pushFeed(room, `${skippedSeat.displayName} 当前无合法走法，自动轮空。`, "system");
        });
      }
    }

    const durationMs = Math.max(1, Number(room.config.turnSeconds || 1)) * 1000;
    room.turnDurationMs = durationMs;
    room.turnEndsAt = Date.now() + durationMs;

    room.turnTimer = setTimeout(() => {
      if (!room.match || room.state !== "playing") {
        return;
      }

      this.handleTurnTimeout(room);
      this.emitRoom(room);
    }, durationMs);

    this.scheduleBotTurn(room);
    this.emitRoom(room);
  }

  handleTurnTimeout(room) {
    if (!room.match || room.state !== "playing") {
      return;
    }

    const seat = room.players[room.match.turnSeat];
    if (!seat) {
      return;
    }

    if (room.gameKey === "gomoku") {
      const move = chooseBestGomokuMove(room, seat.seatIndex);
      if (!move) {
        this.finishMatch(room, {
          winnerSeat: null,
          headline: "五子棋和局",
          detail: "棋盘已被占满，没有形成五连。"
        });
        return;
      }

      this.applyGomokuMove(room, seat, move.row, move.col, true);
      return;
    }

    if (room.gameKey === "reversi") {
      const move = chooseBestReversiMove(room, seat.seatIndex);
      if (!move) {
        pushFeed(room, `${seat.displayName} 沒有合法落點，系統自動過手。`, "system");
        room.match.consecutivePasses += 1;
        this.advanceTurn(room);
        return;
      }

      this.applyReversiTurn(room, seat, move.row, move.col, true);
      return;
    }

    if (room.gameKey === "chinesecheckers") {
      const move = chooseBestChineseCheckersMove(room, seat.seatIndex);
      if (!move) {
        pushFeed(room, `${seat.displayName} 超时且没有可走位置，本回合轮空。`, "system");
        this.advanceTurn(room);
        return;
      }

      this.applyChineseCheckersMove(room, seat, move.fromCellId, move.toCellId, true);
    }
  }

  scheduleBotTurn(room) {
    if (!room.match || room.state !== "playing") {
      return;
    }

    const currentSeat = room.players[room.match.turnSeat];
    if (!currentSeat?.isBot) {
      return;
    }

    const delay = randomInt(900, Math.max(1200, room.turnDurationMs - 700));
    const timer = setTimeout(() => {
      if (!room.match || room.state !== "playing") {
        return;
      }

      if (room.match.turnSeat !== currentSeat.seatIndex) {
        return;
      }

      this.handleTurnTimeout(room);
      this.emitRoom(room);
    }, delay);
    room.botTimers.push(timer);
  }

  applyGomokuMove(room, seat, row, col, fromTimeout) {
    const moveRow = Number(row);
    const moveCol = Number(col);
    if (!Number.isInteger(moveRow) || !Number.isInteger(moveCol)) {
      throw new Error("落子坐标非法");
    }

    if (
      moveRow < 0 ||
      moveRow >= GOMOKU_SIZE ||
      moveCol < 0 ||
      moveCol >= GOMOKU_SIZE
    ) {
      throw new Error("落子超出棋盘");
    }

    if (room.match.board[moveRow][moveCol]) {
      throw new Error("该位置已经有棋子");
    }

    if (
      room.config.openingRule === "center-opening" &&
      room.match.moveCount === 0 &&
      (moveRow !== GOMOKU_CENTER_INDEX || moveCol !== GOMOKU_CENTER_INDEX)
    ) {
      throw new Error("天元开局首手必须落在棋盘中心");
    }

    const piece = getRoomPieceToken(room, seat.seatIndex);
    room.match.board[moveRow][moveCol] = piece;
    room.match.moveCount += 1;
    room.match.lastMove = {
      row: moveRow,
      col: moveCol,
      seatIndex: seat.seatIndex
    };

    pushFeed(
      room,
      `${fromTimeout ? "倒计时结束，" : ""}${seat.displayName} 落子 ${toGomokuLabel(
        moveRow,
        moveCol
      )}`,
      "system"
    );

    if (hasGomokuFive(room.match.board, moveRow, moveCol, piece)) {
      this.finishMatch(room, {
        winnerSeat: seat.seatIndex,
        headline: `${seat.displayName} 获胜`,
        detail: `${getRoomPieceLabel(room, seat.seatIndex)} 五连成线。`
      });
      return;
    }

    if (room.match.moveCount >= GOMOKU_SIZE * GOMOKU_SIZE) {
      this.finishMatch(room, {
        winnerSeat: null,
        headline: "五子棋和局",
        detail: "棋盘已被占满，没有形成五连。"
      });
      return;
    }

    this.advanceTurn(room);
  }

  applyReversiTurn(room, seat, row, col, fromTimeout) {
    const moveRow = Number(row);
    const moveCol = Number(col);
    if (!Number.isInteger(moveRow) || !Number.isInteger(moveCol)) {
      throw new Error("落子坐标非法");
    }

    if (moveRow < 0 || moveRow >= REVERSI_SIZE || moveCol < 0 || moveCol >= REVERSI_SIZE) {
      throw new Error("落子超出棋盘");
    }

    const piece = getRoomPieceToken(room, seat.seatIndex);
    const result = applyReversiMove(room.match.board, moveRow, moveCol, piece);
    if (!result) {
      throw new Error("该位置不是合法落点");
    }

    room.match.board = result.board;
    room.match.moveCount += 1;
    room.match.consecutivePasses = 0;
    room.match.lastMove = {
      row: moveRow,
      col: moveCol,
      seatIndex: seat.seatIndex,
      flipCount: result.flipCount
    };

    pushFeed(
      room,
      `${fromTimeout ? "倒计时结束，" : ""}${seat.displayName} 落子 ${String.fromCharCode(65 + moveCol)}${
        moveRow + 1
      }，翻轉 ${result.flipCount} 枚棋子`,
      "system"
    );

    if (isReversiGameOver(room.match.board)) {
      this.finishReversiMatch(room);
      return;
    }

    this.advanceTurn(room);
  }

  applyChineseCheckersMove(room, seat, fromCellId, toCellId, fromTimeout) {
    const fromId = String(fromCellId || "");
    const toId = String(toCellId || "");
    if (!CHINESE_BOARD.cellMap[fromId] || !CHINESE_BOARD.cellMap[toId]) {
      throw new Error("走子位置非法");
    }

    if (room.match.positions[fromId] !== seat.seatIndex) {
      throw new Error("起点不是你的棋子");
    }

    const legalMoves = getChineseCheckersLegalMoves(room.match.positions, fromId);
    const selectedMove = legalMoves.find((move) => move.toCellId === toId);
    if (!selectedMove) {
      throw new Error("该落点不合法");
    }

    delete room.match.positions[fromId];
    room.match.positions[toId] = seat.seatIndex;
    room.match.moveCount += 1;
    room.match.lastMove = {
      fromCellId: fromId,
      toCellId: toId,
      seatIndex: seat.seatIndex,
      kind: selectedMove.kind
    };

    pushFeed(
      room,
      `${fromTimeout ? "倒计时结束，" : ""}${seat.displayName}${
        selectedMove.kind === "jump" ? " 连跳" : " 走子"
      }至 ${toId}`,
      "system"
    );

    if (hasChineseCheckersWon(room, room.match.positions, seat.seatIndex)) {
      this.finishMatch(room, {
        winnerSeat: seat.seatIndex,
        headline: `${seat.displayName} 获胜`,
        detail: `${getRoomPieceLabel(room, seat.seatIndex)} 已全部进入目标营地。`
      });
      return;
    }

    this.advanceTurn(room);
  }

  advanceTurn(room) {
    room.match.turnSeat = nextSeatIndex(room.match.turnSeat, room.players.length);
    this.scheduleTurn(room);
  }

  resolveReversiTurnState(room) {
    if (!room.match || room.gameKey !== "reversi") {
      return;
    }

    const currentSeat = room.match.turnSeat;
    const currentPiece = getRoomPieceToken(room, currentSeat);
    const currentMoves = getReversiLegalMoves(room.match.board, currentPiece);
    if (currentMoves.length > 0) {
      return;
    }

    const nextSeat = nextSeatIndex(currentSeat, room.players.length);
    const nextPiece = getRoomPieceToken(room, nextSeat);
    const nextMoves = getReversiLegalMoves(room.match.board, nextPiece);
    if (nextMoves.length === 0) {
      this.finishReversiMatch(room);
      return;
    }

    room.match.consecutivePasses += 1;
    room.match.turnSeat = nextSeat;
    pushFeed(room, `${room.players[currentSeat].displayName} 沒有合法落點，自動過手。`, "system");
  }

  finishReversiMatch(room) {
    const { winnerPiece, score } = getReversiWinner(room.match.board);
    const winnerSeat =
      winnerPiece === null
        ? null
        : room.players.find((player) => getRoomPieceToken(room, player.seatIndex) === winnerPiece)?.seatIndex ?? null;

    this.finishMatch(room, {
      winnerSeat,
      headline:
        winnerSeat === null
          ? "黑白棋和局"
          : `${room.players[winnerSeat].displayName} 獲勝`,
      detail:
        winnerSeat === null
          ? `雙方同分 ${score.black}:${score.white}。`
          : `最終棋子比數 ${score.black}:${score.white}。`,
      score
    });
  }

  finishMatch(room, result) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnEndsAt = null;
    room.turnDurationMs = null;
    this.clearBotTimers(room);

    const settlements = buildStandardSettlements(room.players, {
      winnerSeatIndexes:
        typeof result.winnerSeat === "number" ? [result.winnerSeat] : [],
      loserPenalty: room.gameKey === "gomoku" || room.gameKey === "reversi" ? 40 : 30,
      winRank: room.gameKey === "gomoku" || room.gameKey === "reversi" ? 14 : 12,
      lossRank: room.gameKey === "gomoku" || room.gameKey === "reversi" ? -8 : -6
    });

    room.lastResult = {
      ...result,
      gameKey: room.gameKey,
      pieceLabel:
        typeof result.winnerSeat === "number"
          ? getRoomPieceLabel(room, result.winnerSeat)
          : null,
      deltas: settlements.map((entry) => ({
        seatIndex: entry.seatIndex,
        displayName: entry.displayName,
        delta: entry.delta,
        outcome: entry.outcome
      }))
    };

    applyUserSettlements(settlements).catch((error) => {
      console.error("Failed to apply board game settlements", error);
    });

    room.state = "waiting";
    room.match = null;
    room.players.forEach((player) => {
      player.ready = Boolean(player.isBot);
    });

    pushFeed(room, result.headline, typeof result.winnerSeat === "number" ? "success" : "system");
    this.maybeCloseCompletedRoom(room);
  }

  serializeRoomSummary(room) {
    return {
      roomNo: room.roomNo,
      gameKey: room.gameKey,
      title: room.title,
      strapline: room.strapline,
      state: room.state,
      config: room.config,
      playerCount: room.players.length,
      createdAt: room.createdAt
    };
  }

  serializeRoom(room, viewerUserId = null) {
    const viewerSeat = room.players.find((player) => player.userId === viewerUserId) || null;

    return {
      roomNo: room.roomNo,
      availability: this.getAdminAvailability(room),
      ownerId: room.ownerId,
      title: room.title,
      strapline: room.strapline,
      gameKey: room.gameKey,
      state: room.state,
      config: room.config,
      createdAt: room.createdAt,
      turnEndsAt: room.turnEndsAt,
      turnDurationMs: room.turnDurationMs,
      lastResult: room.lastResult,
      feed: room.feed.slice(-18),
      players: room.players.map((player) => ({
        seatIndex: player.seatIndex,
        userId: player.userId,
        displayName: player.displayName,
        isBot: Boolean(player.isBot),
        ready: player.ready,
        ...buildSeatRecoveryState({
          connected: player.connected,
          isBot: player.isBot,
          reconnectGraceEndsAt: player.reconnectGraceEndsAt
        }),
        pieceLabel: getRoomPieceLabel(room, player.seatIndex),
        pieceToken: getRoomPieceToken(room, player.seatIndex),
        pieceAccent: getRoomPieceAccent(room, player.seatIndex),
        campLabel: getRoomCampLabel(room, player.seatIndex),
        targetCampLabel: getRoomTargetCampLabel(room, player.seatIndex)
      })),
      viewer: viewerSeat
        ? {
            userId: viewerSeat.userId,
            seatIndex: viewerSeat.seatIndex,
            displayName: viewerSeat.displayName,
            isBot: Boolean(viewerSeat.isBot),
            isOwner: viewerSeat.userId === room.ownerId,
            ...buildSeatRecoveryState({
              connected: viewerSeat.connected,
              isBot: viewerSeat.isBot,
              reconnectGraceEndsAt: viewerSeat.reconnectGraceEndsAt
            }),
            pieceLabel: getRoomPieceLabel(room, viewerSeat.seatIndex),
            pieceToken: getRoomPieceToken(room, viewerSeat.seatIndex),
            pieceAccent: getRoomPieceAccent(room, viewerSeat.seatIndex),
            campLabel: getRoomCampLabel(room, viewerSeat.seatIndex),
            targetCampLabel: getRoomTargetCampLabel(room, viewerSeat.seatIndex)
          }
        : null,
      match: room.match
        ? room.gameKey === "gomoku"
          ? serializeGomokuMatch(room, viewerSeat)
          : room.gameKey === "reversi"
            ? serializeReversiMatch(room, viewerSeat)
          : serializeChineseCheckersMatch(room, viewerSeat)
        : null
    };
  }

  emitRoom(room) {
    this.syncRoomDirectory(room);

    for (const player of room.players) {
      for (const socketId of player.socketIds) {
        this.io?.to(socketId).emit(SOCKET_EVENTS.board.update, {
          room: this.serializeRoom(room, player.userId)
        });
      }
    }
  }

  createHumanSeat(user, seatIndex) {
    return {
      seatIndex,
      userId: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      isBot: false,
      ready: false,
      connected: true,
      piece: null,
      socketIds: new Set()
    };
  }

  createBotSeat(room, seatIndex) {
    const suffix = Math.random().toString(36).slice(2, 8);
    return {
      seatIndex,
      userId: `bot-${room.gameKey}-${room.roomNo}-${seatIndex}-${suffix}`,
      username: `bot_${suffix}`,
      displayName: getBoardBotName(room.gameKey, seatIndex, room.players),
      isBot: true,
      ready: true,
      connected: true,
      piece: getRoomPieceToken(room, seatIndex),
      socketIds: new Set()
    };
  }

  clearBotTimers(room) {
    for (const timer of room.botTimers || []) {
      clearTimeout(timer);
    }
    room.botTimers = [];
  }

  getReconnectGraceMs() {
    return Number.isFinite(this.reconnectGraceMs) && this.reconnectGraceMs > 0
      ? this.reconnectGraceMs
      : DEFAULT_RECONNECT_GRACE_MS;
  }

  getAdminAvailability(room) {
    return room?.adminState === "draining" ? "draining" : "live";
  }

  assertRoomJoinable(room) {
    if (this.getAdminAvailability(room) === "draining") {
      throw new Error("房间排空中，暂停新加入");
    }
  }

  drainRoom(roomNo) {
    const room = this.assertRoom(roomNo);
    room.adminState = "draining";
    pushFeed(room, "管理员已将房间切换为排空模式", "system");
    this.emitRoom(room);
    return room;
  }

  closeRoom(roomNo) {
    const room = this.assertRoom(roomNo);
    this.expireAbandonedRoom(room);
    return true;
  }

  removeOccupant(roomNo, occupantId) {
    const room = this.assertRoom(roomNo);
    if (room.state !== "waiting") {
      throw new Error("对局进行中，暂不可移除玩家");
    }

    const targetIndex = room.players.findIndex(
      (player) => String(player.userId) === String(occupantId)
    );
    if (targetIndex === -1) {
      throw new Error("找不到这个房内身份");
    }

    const [removedSeat] = room.players.splice(targetIndex, 1);
    if (!removedSeat.isBot) {
      this.clearReconnectTimer(room.roomNo, removedSeat.userId);
    }
    removedSeat.socketIds?.clear?.();

    if (!room.players.some((player) => String(player.userId) === String(room.ownerId))) {
      const nextOwner = room.players.find((player) => !player.isBot) || room.players[0] || null;
      room.ownerId = nextOwner?.userId || room.ownerId;
    }

    this.reindexWaitingPlayers(room);

    if (room.players.length === 0 || room.players.every((player) => player.isBot)) {
      this.expireAbandonedRoom(room);
      return null;
    }

    pushFeed(room, `${removedSeat.displayName} 已被管理员移出房间`, "system");
    this.syncRoomDirectory(room);
    this.emitRoom(room);
    return room;
  }

  reindexWaitingPlayers(room) {
    room.players.forEach((player, seatIndex) => {
      player.seatIndex = seatIndex;
    });
  }

  getReconnectTimerKey(roomNo, userId) {
    return `${roomNo}:${userId}`;
  }

  clearReconnectTimer(roomNo, userId) {
    const key = this.getReconnectTimerKey(roomNo, userId);
    const timer = this.reconnectTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(key);
    }
  }

  clearReconnectTimersForRoom(roomNo) {
    const prefix = `${roomNo}:`;
    for (const [key, timer] of this.reconnectTimers.entries()) {
      if (!key.startsWith(prefix)) {
        continue;
      }

      clearTimeout(timer);
      this.reconnectTimers.delete(key);
    }
  }

  getRoomExpiryMs() {
    return resolveRoomExpiryMs();
  }

  clearRoomExpiryTimer(roomNo) {
    const timer = this.roomExpiryTimers.get(roomNo);
    if (timer) {
      clearTimeout(timer);
      this.roomExpiryTimers.delete(roomNo);
    }
  }

  scheduleRoomExpiry(roomNo) {
    this.clearRoomExpiryTimer(roomNo);

    const room = this.rooms.get(roomNo);
    if (!room || this.countConnectedHumanPlayers(room) > 0) {
      return;
    }

    const timer = setTimeout(() => {
      this.clearRoomExpiryTimer(roomNo);

      const liveRoom = this.rooms.get(roomNo);
      if (!liveRoom || this.countConnectedHumanPlayers(liveRoom) > 0) {
        return;
      }

      this.expireAbandonedRoom(liveRoom);
    }, this.getRoomExpiryMs());

    this.roomExpiryTimers.set(roomNo, timer);
  }

  markSeatConnected(room, seat) {
    this.clearReconnectTimer(room.roomNo, seat.userId);
    this.clearRoomExpiryTimer(room.roomNo);
    seat.connected = true;
    seat.reconnectGraceEndsAt = null;
  }

  markSeatReconnecting(room, seat) {
    seat.connected = false;
    seat.reconnectGraceEndsAt = new Date(Date.now() + this.getReconnectGraceMs()).toISOString();
    this.scheduleReconnectExpiry(room.roomNo, seat.userId);
  }

  scheduleReconnectExpiry(roomNo, userId) {
    this.clearReconnectTimer(roomNo, userId);

    const room = this.rooms.get(roomNo);
    const seat = room?.players.find((player) => !player.isBot && player.userId === userId);
    if (!room || !seat || seat.connected || !seat.reconnectGraceEndsAt) {
      return;
    }

    const delay = Math.max(0, Date.parse(seat.reconnectGraceEndsAt) - Date.now());
    const timer = setTimeout(() => {
      this.clearReconnectTimer(roomNo, userId);

      const liveRoom = this.rooms.get(roomNo);
      const liveSeat = liveRoom?.players.find((player) => !player.isBot && player.userId === userId);
      if (!liveRoom || !liveSeat || liveSeat.connected) {
        return;
      }

      liveSeat.reconnectGraceEndsAt = null;
      this.emitRoom(liveRoom);
      this.syncRoomOccupancyLifecycle(liveRoom);
    }, delay);

    this.reconnectTimers.set(this.getReconnectTimerKey(roomNo, userId), timer);
  }

  countConnectedHumanPlayers(room) {
    return room.players.filter(
      (player) => !player.isBot && (player.connected || Boolean(player.reconnectGraceEndsAt))
    ).length;
  }

  syncRoomOccupancyLifecycle(room) {
    if (!room) {
      return false;
    }

    if (this.countConnectedHumanPlayers(room) > 0) {
      this.clearRoomExpiryTimer(room.roomNo);
      return false;
    }

    if (this.maybeCloseCompletedRoom(room)) {
      return true;
    }

    this.scheduleRoomExpiry(room.roomNo);
    return false;
  }

  expireAbandonedRoom(room) {
    if (!room || !this.rooms.has(room.roomNo)) {
      return false;
    }

    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnEndsAt = null;
    room.turnDurationMs = null;
    this.clearReconnectTimersForRoom(room.roomNo);
    this.clearRoomExpiryTimer(room.roomNo);
    this.clearBotTimers(room);
    room.match = null;
    this.rooms.delete(room.roomNo);
    unregisterRoomEntry(room.roomNo);
    return true;
  }

  maybeCloseCompletedRoom(room) {
    if (!room || room.state !== "waiting" || !room.lastResult) {
      return false;
    }

    if (this.countConnectedHumanPlayers(room) > 0) {
      return false;
    }

    return this.expireAbandonedRoom(room);
  }

  buildRoomDirectoryEntry(room) {
    const meta = getGameMeta(room.gameKey) || {};
    const visibility = room.config?.visibility === "private" ? "private" : "public";
    const detailRoutePrefix = meta.detailRoutePrefix || "/board";

    return {
      roomNo: room.roomNo,
      familyKey: meta.familyKey || "board",
      gameKey: room.gameKey,
      title: room.title || meta.title || room.gameKey,
      strapline: room.strapline || meta.strapline || "",
      detailRoute: `${detailRoutePrefix}/${room.roomNo}`.replace(/\/+/g, "/"),
      joinRoute: API_ROUTES.boardRooms.join(room.roomNo),
      visibility,
      ownerId: room.ownerId,
      state: room.state,
      supportsShareLink: Boolean(meta.supportsShareLink),
      guestAllowed: meta.guestMode === "invite-private-only" && visibility === "private",
      memberIds: room.players.filter((player) => !player.isBot).map((player) => player.userId),
      updatedAt: new Date().toISOString()
    };
  }

  syncRoomDirectory(room) {
    const entry = this.buildRoomDirectoryEntry(room);
    if (!updateRoomEntry(room.roomNo, entry)) {
      registerRoomEntry(entry);
    }
  }

  assertRoom(roomNo) {
    const room = this.rooms.get(roomNo);
    if (!room) {
      throw new Error("房间不存在");
    }

    return room;
  }

  assertOwnerWaitingRoom(roomNo, userId) {
    const room = this.assertRoom(roomNo);
    if (room.ownerId !== userId) {
      throw new Error("只有房主可以补机器人");
    }
    if (room.state !== "waiting") {
      throw new Error("只有等待阶段可以补机器人");
    }
    return room;
  }

  findSeat(room, userId) {
    return room.players.find((player) => player.userId === userId);
  }
}

function normalizeBoardConfig(gameKey, input = {}) {
  const defaults = getBoardDefaultConfig(gameKey);
  const limits = getGameLimits(gameKey);
  const normalized = { ...defaults };

  normalized.visibility = input.visibility === "private" ? "private" : defaults.visibility;
  normalized.maxPlayers =
    gameKey === "chinesecheckers"
      ? normalizeChineseCheckersPlayerCount(input.maxPlayers ?? defaults.maxPlayers)
      : clampNumber(input.maxPlayers ?? defaults.maxPlayers, limits.minPlayers, limits.maxPlayers);
  normalized.turnSeconds = clampNumber(input.turnSeconds ?? defaults.turnSeconds, 10, 90);
  if (gameKey === "gomoku") {
    normalized.openingRule = normalizeBoardOpeningRule(input.openingRule ?? defaults.openingRule);
  }

  return normalized;
}

function normalizeBoardOpeningRule(value) {
  const normalized = String(value || "").trim();
  const allowed = new Set(getBoardOpeningOptions("gomoku").map((option) => option.key));
  return allowed.has(normalized) ? normalized : "standard";
}

function getRequiredPlayersToStart(room) {
  if (room.gameKey === "gomoku" || room.gameKey === "chinesecheckers") {
    return room.config.maxPlayers;
  }

  return getGameLimits(room.gameKey).minPlayers;
}

function normalizeChineseCheckersPlayerCount(value) {
  const numeric = Number(value);
  return CHINESE_CHECKERS_PLAYER_COUNTS.includes(numeric) ? numeric : 2;
}

function getBoardSeatProfile(gameKey, seatCount, seatIndex) {
  if (gameKey === "gomoku" || gameKey === "reversi") {
    return GOMOKU_PIECES[seatIndex] || null;
  }

  if (gameKey !== "chinesecheckers") {
    return null;
  }

  const playerCount = normalizeChineseCheckersPlayerCount(seatCount);
  const seatLayout = CHINESE_CHECKERS_SEAT_LAYOUTS[playerCount] || CHINESE_CHECKERS_SEAT_LAYOUTS[2];
  const campKey = seatLayout[seatIndex];
  return campKey ? CHINESE_CHECKERS_CAMP_PROFILES[campKey] : null;
}

function getRoomSeatProfile(room, seatIndex) {
  return getBoardSeatProfile(room.gameKey, room.config.maxPlayers, seatIndex);
}

function getRoomPieceToken(room, seatIndex) {
  return getRoomSeatProfile(room, seatIndex)?.token || null;
}

function getRoomPieceLabel(room, seatIndex) {
  return getRoomSeatProfile(room, seatIndex)?.label || null;
}

function getRoomPieceAccent(room, seatIndex) {
  return getRoomSeatProfile(room, seatIndex)?.accent || null;
}

function getRoomCampLabel(room, seatIndex) {
  return getRoomSeatProfile(room, seatIndex)?.campLabel || null;
}

function getRoomTargetCampLabel(room, seatIndex) {
  return getRoomSeatProfile(room, seatIndex)?.targetCampLabel || null;
}

function serializeGomokuMatch(room, viewerSeat) {
  return {
    size: GOMOKU_SIZE,
    turnSeat: room.match.turnSeat,
    turnPieceLabel: getRoomPieceLabel(room, room.match.turnSeat),
    moveCount: room.match.moveCount,
    board: room.match.board,
    lastMove: room.match.lastMove,
    viewerCanMove:
      Boolean(viewerSeat) && room.match.turnSeat === viewerSeat.seatIndex
  };
}

function serializeReversiMatch(room, viewerSeat) {
  const viewerCanMove = Boolean(viewerSeat) && room.match.turnSeat === viewerSeat.seatIndex;
  const viewerLegalMoves = viewerCanMove
    ? getReversiLegalMoves(room.match.board, getRoomPieceToken(room, viewerSeat.seatIndex))
    : [];

  return {
    size: REVERSI_SIZE,
    turnSeat: room.match.turnSeat,
    turnPieceLabel: getRoomPieceLabel(room, room.match.turnSeat),
    moveCount: room.match.moveCount,
    board: room.match.board,
    lastMove: room.match.lastMove,
    score: getReversiScore(room.match.board),
    viewerCanMove: viewerCanMove && viewerLegalMoves.length > 0,
    viewerLegalMoves
  };
}

function serializeChineseCheckersMatch(room, viewerSeat) {
  const viewerCanMove =
    Boolean(viewerSeat) && room.match.turnSeat === viewerSeat.seatIndex;
  const viewerLegalMoves = viewerCanMove
    ? getAllChineseCheckersMoves(room.match.positions, viewerSeat.seatIndex)
    : {};

  return {
    turnSeat: room.match.turnSeat,
    turnPieceLabel: getRoomPieceLabel(room, room.match.turnSeat),
    moveCount: room.match.moveCount,
    lastMove: room.match.lastMove,
    seatCount: room.match.seatCount,
    viewerCanMove,
    viewerLegalMoves,
    progress: getChineseCheckersProgress(room),
    cells: CHINESE_BOARD.cells.map((cell) => ({
      id: cell.id,
      row: cell.row,
      index: cell.index,
      x: cell.x,
      y: cell.y,
      camp: cell.camp,
      occupantSeat:
        room.match.positions[cell.id] === undefined ? null : room.match.positions[cell.id]
    }))
  };
}

function getChineseCheckersProgress(room) {
  if (!room?.match?.positions) {
    return [];
  }

  return room.players
    .map((player) => {
      const seatProfile = getRoomSeatProfile(room, player.seatIndex);
      if (!seatProfile) {
        return null;
      }

      const goalCells = CHINESE_BOARD.camps[seatProfile.targetCampKey] || [];
      const goalReached = goalCells.filter((cellId) => room.match.positions[cellId] === player.seatIndex).length;

      return {
        seatIndex: player.seatIndex,
        displayName: player.displayName,
        pieceLabel: getRoomPieceLabel(room, player.seatIndex),
        pieceAccent: getRoomPieceAccent(room, player.seatIndex),
        campLabel: seatProfile.campLabel,
        targetCampLabel: seatProfile.targetCampLabel,
        goalReached,
        goalTotal: goalCells.length,
        remaining: Math.max(0, goalCells.length - goalReached)
      };
    })
    .filter(Boolean);
}

function createEmptyGomokuBoard() {
  return Array.from({ length: GOMOKU_SIZE }, () => Array(GOMOKU_SIZE).fill(null));
}

function hasGomokuFive(board, row, col, piece) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  return directions.some(([rowStep, colStep]) => {
    let count = 1;
    count += countGomokuDirection(board, row, col, piece, rowStep, colStep);
    count += countGomokuDirection(board, row, col, piece, -rowStep, -colStep);
    return count >= 5;
  });
}

function countGomokuDirection(board, row, col, piece, rowStep, colStep) {
  let nextRow = row + rowStep;
  let nextCol = col + colStep;
  let total = 0;

  while (
    nextRow >= 0 &&
    nextRow < GOMOKU_SIZE &&
    nextCol >= 0 &&
    nextCol < GOMOKU_SIZE &&
    board[nextRow][nextCol] === piece
  ) {
    total += 1;
    nextRow += rowStep;
    nextCol += colStep;
  }

  return total;
}

function chooseBestGomokuMove(room, seatIndex) {
  const board = room.match.board;
  const own = getRoomPieceToken(room, seatIndex);
  const enemy = getRoomPieceToken(room, seatIndex === 0 ? 1 : 0);
  const empties = [];

  for (let row = 0; row < GOMOKU_SIZE; row += 1) {
    for (let col = 0; col < GOMOKU_SIZE; col += 1) {
      if (!board[row][col]) {
        empties.push({ row, col });
      }
    }
  }

  if (empties.length === GOMOKU_SIZE * GOMOKU_SIZE) {
    return { row: 7, col: 7 };
  }

  for (const cell of empties) {
    board[cell.row][cell.col] = own;
    const wins = hasGomokuFive(board, cell.row, cell.col, own);
    board[cell.row][cell.col] = null;
    if (wins) {
      return cell;
    }
  }

  for (const cell of empties) {
    board[cell.row][cell.col] = enemy;
    const blocks = hasGomokuFive(board, cell.row, cell.col, enemy);
    board[cell.row][cell.col] = null;
    if (blocks) {
      return cell;
    }
  }

  let bestMove = null;
  let bestScore = -Infinity;
  for (const cell of empties) {
    const score =
      scoreGomokuPoint(board, cell.row, cell.col, own) +
      scoreGomokuPoint(board, cell.row, cell.col, enemy) * 0.92 -
      distanceToCenter(cell.row, cell.col) * 0.6;
    if (score > bestScore) {
      bestScore = score;
      bestMove = cell;
    }
  }

  return bestMove;
}

function chooseBestReversiMove(room, seatIndex) {
  const piece = getRoomPieceToken(room, seatIndex);
  const legalMoves = getReversiLegalMoves(room.match.board, piece);
  if (legalMoves.length === 0) {
    return null;
  }

  return legalMoves
    .map((move) => ({
      ...move,
      weight:
        (isReversiCorner(move.row, move.col) ? 100 : 0) +
        (isReversiEdge(move.row, move.col) ? 24 : 0) +
        move.flipCount
    }))
    .sort((left, right) => right.weight - left.weight || right.flipCount - left.flipCount)[0];
}

function scoreGomokuPoint(board, row, col, piece) {
  const directions = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1]
  ];

  let score = 0;
  for (const [rowStep, colStep] of directions) {
    const forward = countConsecutive(board, row, col, piece, rowStep, colStep);
    const backward = countConsecutive(board, row, col, piece, -rowStep, -colStep);
    const total = forward.count + backward.count;
    const openEnds = Number(forward.open) + Number(backward.open);
    score += total * total * 9 + openEnds * 4;
  }

  const neighbors = collectNearbyPieces(board, row, col);
  return score + neighbors * 6;
}

function countConsecutive(board, row, col, piece, rowStep, colStep) {
  let nextRow = row + rowStep;
  let nextCol = col + colStep;
  let count = 0;

  while (
    nextRow >= 0 &&
    nextRow < GOMOKU_SIZE &&
    nextCol >= 0 &&
    nextCol < GOMOKU_SIZE &&
    board[nextRow][nextCol] === piece
  ) {
    count += 1;
    nextRow += rowStep;
    nextCol += colStep;
  }

  const open =
    nextRow >= 0 &&
    nextRow < GOMOKU_SIZE &&
    nextCol >= 0 &&
    nextCol < GOMOKU_SIZE &&
    board[nextRow][nextCol] === null;

  return { count, open };
}

function collectNearbyPieces(board, row, col) {
  let total = 0;
  for (let rowOffset = -2; rowOffset <= 2; rowOffset += 1) {
    for (let colOffset = -2; colOffset <= 2; colOffset += 1) {
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (
        (rowOffset !== 0 || colOffset !== 0) &&
        nextRow >= 0 &&
        nextRow < GOMOKU_SIZE &&
        nextCol >= 0 &&
        nextCol < GOMOKU_SIZE &&
        board[nextRow][nextCol]
      ) {
        total += 1;
      }
    }
  }
  return total;
}

function distanceToCenter(row, col) {
  return Math.abs(row - 7) + Math.abs(col - 7);
}

function createChineseCheckersPositions(playerCount) {
  const positions = {};
  const seatLayout =
    CHINESE_CHECKERS_SEAT_LAYOUTS[normalizeChineseCheckersPlayerCount(playerCount)] ||
    CHINESE_CHECKERS_SEAT_LAYOUTS[2];

  seatLayout.forEach((campKey, seatIndex) => {
    (CHINESE_BOARD.camps[campKey] || []).forEach((cellId) => {
      positions[cellId] = seatIndex;
    });
  });

  return positions;
}

function getChineseCheckersLegalMoves(positions, fromCellId) {
  const occupant = positions[fromCellId];
  if (occupant === undefined) {
    return [];
  }

  const directMoves = CHINESE_BOARD.adjacency[fromCellId]
    .filter((targetId) => positions[targetId] === undefined)
    .map((targetId) => ({
      toCellId: targetId,
      kind: "step"
    }));

  const jumpMoves = [];
  const visited = new Set([fromCellId]);

  function dfs(currentId) {
    for (const jump of CHINESE_BOARD.jumps[currentId]) {
      if (positions[jump.overId] === undefined || positions[jump.toCellId] !== undefined) {
        continue;
      }

      if (visited.has(jump.toCellId)) {
        continue;
      }

      visited.add(jump.toCellId);
      jumpMoves.push({
        toCellId: jump.toCellId,
        kind: "jump"
      });
      dfs(jump.toCellId);
    }
  }

  dfs(fromCellId);
  return [...directMoves, ...jumpMoves];
}

function getAllChineseCheckersMoves(positions, seatIndex) {
  const moves = {};
  for (const [cellId, occupantSeat] of Object.entries(positions)) {
    if (occupantSeat !== seatIndex) {
      continue;
    }

    const legalMoves = getChineseCheckersLegalMoves(positions, cellId);
    if (legalMoves.length > 0) {
      moves[cellId] = legalMoves;
    }
  }
  return moves;
}

function resolveChineseCheckersTurn(room) {
  const skippedSeats = [];
  let nextSeat = room.match.turnSeat;

  for (let checked = 0; checked < room.players.length; checked += 1) {
    const legalMoves = getAllChineseCheckersMoves(room.match.positions, nextSeat);
    if (Object.keys(legalMoves).length > 0) {
      room.match.turnSeat = nextSeat;
      return {
        type: "ready",
        skippedSeats
      };
    }

    skippedSeats.push(nextSeat);
    nextSeat = nextSeatIndex(nextSeat, room.players.length);
  }

  return {
    type: "blocked",
    skippedSeats
  };
}

function buildChineseCheckersBlockedResult(room) {
  let bestSeat = null;
  let bestScore = -Infinity;
  let tied = false;

  room.players.forEach((player) => {
    const score = scoreChineseCheckersSeat(room, player.seatIndex);
    if (score > bestScore + 0.001) {
      bestScore = score;
      bestSeat = player.seatIndex;
      tied = false;
      return;
    }

    if (Math.abs(score - bestScore) <= 0.001) {
      tied = true;
    }
  });

  if (tied || bestSeat === null) {
    return {
      winnerSeat: null,
      headline: "中国跳棋和局",
      detail: "所有阵营暂时都没有合法走法。"
    };
  }

  return {
    winnerSeat: bestSeat,
    headline: `${room.players[bestSeat]?.displayName || "领先棋手"} 领先胜出`,
    detail: "所有阵营暂时无合法走法，按占营进度判定领先。"
  };
}

function scoreChineseCheckersSeat(room, seatIndex) {
  const seatProfile = getRoomSeatProfile(room, seatIndex);
  if (!seatProfile) {
    return -Infinity;
  }

  let occupiedTargets = 0;
  let totalDistance = 0;
  for (const [cellId, occupantSeat] of Object.entries(room.match.positions)) {
    if (occupantSeat !== seatIndex) {
      continue;
    }

    if (CHINESE_BOARD.campSets[seatProfile.targetCampKey]?.has(cellId)) {
      occupiedTargets += 1;
    }

    totalDistance += getDistanceToCamp(seatProfile.targetCampKey, CHINESE_BOARD.cellMap[cellId]);
  }

  return occupiedTargets * 1000 - totalDistance;
}

function chooseBestChineseCheckersMove(room, seatIndex) {
  const seatProfile = getRoomSeatProfile(room, seatIndex);
  if (!seatProfile) {
    return null;
  }

  const allMoves = getAllChineseCheckersMoves(room.match.positions, seatIndex);
  const homeCamp = CHINESE_BOARD.campSets[seatProfile.campKey];
  const goalCamp = CHINESE_BOARD.campSets[seatProfile.targetCampKey];
  let bestMove = null;
  let bestScore = -Infinity;

  for (const [fromCellId, moves] of Object.entries(allMoves)) {
    const fromCell = CHINESE_BOARD.cellMap[fromCellId];
    for (const move of moves) {
      const toCell = CHINESE_BOARD.cellMap[move.toCellId];
      let score =
        projectProgressScore(room, seatIndex, fromCell, toCell) +
        (move.kind === "jump" ? 18 : 0) -
        Math.abs(toCell.x) * 0.18;

      if (goalCamp.has(move.toCellId)) {
        score += 34;
      }

      if (homeCamp?.has(fromCellId) && !homeCamp.has(move.toCellId)) {
        score += 9;
      }

      if (!homeCamp?.has(fromCellId) && homeCamp?.has(move.toCellId)) {
        score -= 12;
      }

      if (isLeavingTargetCamp(room, seatIndex, fromCellId, move.toCellId)) {
        score -= 26;
      }

      if (score > bestScore) {
        bestScore = score;
        bestMove = {
          fromCellId,
          toCellId: move.toCellId
        };
      }
    }
  }

  return bestMove;
}

function projectProgressScore(room, seatIndex, fromCell, toCell) {
  const seatProfile = getRoomSeatProfile(room, seatIndex);
  if (!seatProfile) {
    return 0;
  }

  return (
    getDistanceToCamp(seatProfile.targetCampKey, fromCell) -
    getDistanceToCamp(seatProfile.targetCampKey, toCell)
  ) * 42;
}

function getDistanceToCamp(campKey, cell) {
  const campCells = CHINESE_BOARD.camps[campKey] || [];
  return Math.min(
    ...campCells.map((cellId) => {
      const target = CHINESE_BOARD.cellMap[cellId];
      return Math.hypot(cell.x - target.x, cell.y - target.y);
    })
  );
}

function isLeavingTargetCamp(room, seatIndex, fromCellId, toCellId) {
  const targetCampKey = getRoomSeatProfile(room, seatIndex)?.targetCampKey;
  if (!targetCampKey) {
    return false;
  }

  return (
    CHINESE_BOARD.campSets[targetCampKey]?.has(fromCellId) &&
    !CHINESE_BOARD.campSets[targetCampKey]?.has(toCellId)
  );
}

function hasChineseCheckersWon(room, positions, seatIndex) {
  const targetCampKey = getRoomSeatProfile(room, seatIndex)?.targetCampKey;
  const targetCamp = CHINESE_BOARD.camps[targetCampKey] || [];
  return targetCamp.every((cellId) => positions[cellId] === seatIndex);
}

function buildChineseCheckersBoard() {
  const cells = [];
  for (let row = 0; row < CHINESE_CHECKERS_ROW_LENGTHS.length; row += 1) {
    const length = CHINESE_CHECKERS_ROW_LENGTHS[row];
    const xStart = -((length - 1) / 2);
    for (let index = 0; index < length; index += 1) {
      const x = xStart + index;
      const y = row * CHINESE_VERTICAL_GAP;
      cells.push({
        id: `c${row}_${index}`,
        row,
        index,
        x,
        y,
        camp: getChineseCheckersCampKey(row, index, length)
      });
    }
  }

  const cellMap = Object.fromEntries(cells.map((cell) => [cell.id, cell]));
  const adjacency = {};
  for (const cell of cells) {
    adjacency[cell.id] = [];
    for (const candidate of cells) {
      if (cell.id === candidate.id) {
        continue;
      }

      const distance = Math.hypot(cell.x - candidate.x, cell.y - candidate.y);
      if (Math.abs(distance - 1) < 0.08) {
        adjacency[cell.id].push(candidate.id);
      }
    }
  }

  const jumps = {};
  for (const cell of cells) {
    jumps[cell.id] = [];
    for (const neighborId of adjacency[cell.id]) {
      const neighbor = cellMap[neighborId];
      const target = findChineseCellAt(cells, neighbor.x + (neighbor.x - cell.x), neighbor.y + (neighbor.y - cell.y));
      if (target) {
        jumps[cell.id].push({
          overId: neighborId,
          toCellId: target.id
        });
      }
    }
  }

  const camps = {
    top: [],
    upperRight: [],
    lowerRight: [],
    bottom: [],
    lowerLeft: [],
    upperLeft: []
  };

  cells.forEach((cell) => {
    if (cell.camp !== "center") {
      camps[cell.camp].push(cell.id);
    }
  });

  const campSets = Object.fromEntries(
    Object.entries(camps).map(([campKey, cellIds]) => [campKey, new Set(cellIds)])
  );
  const campCenters = Object.fromEntries(
    Object.entries(camps).map(([campKey, cellIds]) => {
      const mappedCells = cellIds.map((cellId) => cellMap[cellId]);
      return [
        campKey,
        {
          x: mappedCells.reduce((sum, cell) => sum + cell.x, 0) / Math.max(1, mappedCells.length),
          y: mappedCells.reduce((sum, cell) => sum + cell.y, 0) / Math.max(1, mappedCells.length)
        }
      ];
    })
  );

  return {
    cells,
    cellMap,
    adjacency,
    jumps,
    camps,
    campSets,
    campCenters,
    topCamp: camps.top,
    bottomCamp: camps.bottom,
    topCampSet: campSets.top,
    bottomCampSet: campSets.bottom
  };
}

function getChineseCheckersCampKey(row, index, length) {
  if (row <= 3) {
    return "top";
  }

  if (row >= 13) {
    return "bottom";
  }

  if (row >= 4 && row <= 7) {
    const edgeSize = 8 - row;
    if (index < edgeSize) {
      return "upperLeft";
    }
    if (index >= length - edgeSize) {
      return "upperRight";
    }
  }

  if (row >= 9 && row <= 12) {
    const edgeSize = row - 8;
    if (index < edgeSize) {
      return "lowerLeft";
    }
    if (index >= length - edgeSize) {
      return "lowerRight";
    }
  }

  return "center";
}

function findChineseCellAt(cells, x, y) {
  return (
    cells.find(
      (cell) => Math.abs(cell.x - x) < 0.08 && Math.abs(cell.y - y) < 0.08
    ) || null
  );
}

function getBoardBotName(gameKey, seatIndex, existingPlayers = []) {
  const pool = gameKey === "chinesecheckers" ? CHINESE_CHECKERS_BOT_NAMES : GOMOKU_BOT_NAMES;
  const base = pool[seatIndex % pool.length];
  const count =
    existingPlayers.filter((player) => player.isBot && player.displayName.startsWith(base)).length + 1;
  return `${base}${count}`;
}

function toGomokuLabel(row, col) {
  const letters = "ABCDEFGHIJKLMNO";
  return `${letters[col]}${row + 1}`;
}

function isReversiCorner(row, col) {
  return (
    (row === 0 || row === REVERSI_SIZE - 1) &&
    (col === 0 || col === REVERSI_SIZE - 1)
  );
}

function isReversiEdge(row, col) {
  return row === 0 || row === REVERSI_SIZE - 1 || col === 0 || col === REVERSI_SIZE - 1;
}

function nextSeatIndex(currentSeat, totalSeats) {
  if (totalSeats <= 0) {
    return 0;
  }

  return (currentSeat + 1) % totalSeats;
}

function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return min;
  }

  return Math.min(max, Math.max(min, numeric));
}

function pushFeed(room, text, tone = "system") {
  room.feed.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    tone,
    createdAt: new Date().toISOString()
  });
  room.feed = room.feed.slice(-30);
}

function randomInt(min, max) {
  const lower = Math.max(1, Math.floor(min));
  const upper = Math.max(lower, Math.floor(max));
  return lower + Math.floor(Math.random() * (upper - lower + 1));
}

function getSocketRoom(roomNo) {
  return `board:${roomNo}`;
}

module.exports = {
  getBoardRoomManager,
  __testing: {
    createChineseCheckersPositions,
    getChineseCheckersLegalMoves,
    getChineseCheckersProgress,
    normalizeBoardConfig
  }
};
