"use strict";

const { getGameMeta } = require("../games/catalog");
const { applyUserSettlements, buildStandardSettlements } = require("../economy");
const {
  allocateRoomNo,
  registerRoomEntry,
  unregisterRoomEntry,
  updateRoomEntry
} = require("../rooms/directory");
const { buildAvailabilityEnvelope } = require("../shared/availability");
const { getAvailabilityControlsSync } = require("../admin/control-plane");
const { getRoomExpiryMs: resolveRoomExpiryMs } = require("../system-config");
const {
  SOCKET_EVENTS,
  buildSeatRecoveryState
} = require("../shared/network-contract");

const DEFAULT_RECONNECT_GRACE_MS = 15000;
const DEFAULT_TURN_SECONDS = 30;
const HAND_SIZE = 13;
const MAX_PLAYERS = 4;

// Card suits: 0=diamonds, 1=clubs, 2=hearts, 3=spades (ascending rank)
// Card ranks: 3=0, 4=1, ..., K=10, A=11, 2=12 (Big Two: 2 is highest)
const SUIT_NAMES = ["diamonds", "clubs", "hearts", "spades"];
const RANK_NAMES = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"];

function createDeck() {
  const deck = [];
  let id = 1;
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 0; rank < 13; rank++) {
      deck.push({
        id: id++,
        suit,
        rank,
        label: `${SUIT_NAMES[suit]}-${RANK_NAMES[rank]}`,
        // Big Two comparison value: rank * 4 + suit
        sortValue: rank * 4 + suit
      });
    }
  }
  return deck;
}

function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Compare two cards: returns positive if a > b
function compareCards(a, b) {
  return a.sortValue - b.sortValue;
}

function getBigTwoRoomManager() {
  if (!global.bigTwoRoomManager) {
    global.bigTwoRoomManager = new BigTwoRoomManager();
  }
  return global.bigTwoRoomManager;
}

class BigTwoRoomManager {
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

  listPublicRooms() {
    return [...this.rooms.values()]
      .filter((room) => room.settings.visibility !== "private")
      .map((room) => this.serializeRoomSummary(room));
  }

  countOpenRoomsByOwner(ownerId) {
    return [...this.rooms.values()].filter(
      (room) => room.ownerId === ownerId && room.state !== "archived"
    ).length;
  }

  createRoom(owner, config = {}) {
    const meta = getGameMeta("bigtwo") || {};
    const roomNo = allocateRoomNo();
    const settings = normalizeBigTwoConfig(config);

    const room = {
      roomNo,
      ownerId: owner.id,
      familyKey: "card",
      gameKey: "bigtwo",
      title: meta.title || "大老二",
      strapline: meta.strapline || "",
      createdAt: new Date().toISOString(),
      adminState: "live",
      state: "waiting",
      settings,
      turnTimer: null,
      turnEndsAt: null,
      turnDurationMs: null,
      players: [this.createHumanSeat(owner, 0)],
      round: null,
      feed: [],
      lastResult: null
    };

    pushFeed(room, `${owner.displayName || owner.username} 創建了大老二房間`, "system");
    this.rooms.set(roomNo, room);
    registerRoomEntry(this.buildRoomDirectoryEntry(room));
    return room;
  }

  getRoom(roomNo) {
    return this.rooms.get(roomNo);
  }

  joinRoom(roomNo, user) {
    const room = this.assertRoom(roomNo);
    const existingSeat = room.players.find((p) => p.userId === user.id && !p.isBot);
    if (existingSeat) {
      existingSeat.displayName = user.displayName || user.username;
      this.markSeatConnected(room, existingSeat);
      this.syncRoomDirectory(room);
      return room;
    }

    this.assertRoomJoinable(room);
    if (room.players.length >= MAX_PLAYERS) {
      throw new Error("房間人數已滿");
    }

    room.players.push(this.createHumanSeat(user, room.players.length));
    this.clearRoomExpiryTimer(room.roomNo);
    pushFeed(room, `${user.displayName || user.username} 加入房間`, "join");
    this.syncRoomDirectory(room);
    this.emitRoom(room);
    return room;
  }

  setReady(roomNo, userId, ready = true) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) throw new Error("你不在該房間內");
    if (room.state !== "waiting") throw new Error("當前對局進行中");

    seat.ready = Boolean(ready);
    pushFeed(room, `${seat.displayName} ${seat.ready ? "已準備" : "取消準備"}`, seat.ready ? "ready" : "system");
    this.emitRoom(room);
    this.maybeStartRoom(room);
    return room;
  }

  maybeStartRoom(room) {
    if (room.state !== "waiting") return;
    if (room.players.length < MAX_PLAYERS) return;
    if (!room.players.every((p) => p.ready)) return;
    this.startGame(room);
  }

  startGame(room) {
    room.state = "playing";
    room.lastResult = null;
    room.players.forEach((p) => { p.ready = false; });

    const deck = shuffleDeck(createDeck());
    const hands = [[], [], [], []];

    // Deal 13 cards to each player
    for (let i = 0; i < HAND_SIZE * MAX_PLAYERS; i++) {
      hands[i % MAX_PLAYERS].push(deck.pop());
    }

    // Sort hands by sortValue for easier play
    for (const hand of hands) {
      hand.sort((a, b) => a.sortValue - b.sortValue);
    }

    // Find player with 3 of diamonds (suit=0, rank=0) to go first
    let firstPlayer = 0;
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (hands[i].some((c) => c.suit === 0 && c.rank === 0)) {
        firstPlayer = i;
        break;
      }
    }

    room.round = {
      stage: "playing",
      currentTurn: firstPlayer,
      hands,
      table: {
        lastPlay: null,      // { cards: [...], seatIndex: N, handType: "single" }
        passCount: 0,         // consecutive passes
        leadSeat: firstPlayer // who started current trick
      },
      turnEndsAt: null,
      turnDurationMs: null
    };

    pushFeed(room, `牌局開始，各發 ${HAND_SIZE} 張手牌。${room.players[firstPlayer].displayName} 先出。`, "system");
    this.scheduleTurn(room);
  }

  playHand(roomNo, userId, cardIds) {
    const room = this.assertPlayingRoom(roomNo);
    const seat = this.assertCurrentTurn(room, userId);
    const seatIdx = seat.seatIndex;

    if (!Array.isArray(cardIds) || cardIds.length === 0) {
      throw new Error("請選擇要出的牌");
    }

    const hand = room.round.hands[seatIdx];
    const cards = [];
    for (const cardId of cardIds) {
      const card = hand.find((c) => c.id === cardId);
      if (!card) throw new Error("手牌中沒有這張牌");
      cards.push(card);
    }

    // Validate play against table
    const table = room.round.table;
    if (table.lastPlay && table.lastPlay.seatIndex !== seatIdx) {
      // Must beat previous play
      if (cards.length !== table.lastPlay.cards.length) {
        throw new Error("出牌數量必須與上家相同");
      }
      if (!this._beatsPlay(cards, table.lastPlay.cards)) {
        throw new Error("出牌必須大於上家");
      }
    }

    // Remove cards from hand
    for (const card of cards) {
      const idx = hand.findIndex((c) => c.id === card.id);
      if (idx !== -1) hand.splice(idx, 1);
    }

    // Update table
    room.round.table.lastPlay = { cards, seatIndex: seatIdx, handType: cards.length === 1 ? "single" : "pair" };
    room.round.table.passCount = 0;
    room.round.table.leadSeat = seatIdx;

    pushFeed(room, `${seat.displayName} 出牌 ${cards.map((c) => c.label).join(", ")}`, "success");

    // Check if player won
    if (hand.length === 0) {
      this.finishRound(room, seatIdx);
      return room;
    }

    // Advance turn
    room.round.currentTurn = (seatIdx + 1) % MAX_PLAYERS;
    this.scheduleTurn(room);
    return room;
  }

  passTurn(roomNo, userId) {
    const room = this.assertPlayingRoom(roomNo);
    const seat = this.assertCurrentTurn(room, userId);
    const seatIdx = seat.seatIndex;

    const table = room.round.table;

    // Can't pass if you're leading (no previous play to beat)
    if (!table.lastPlay || table.leadSeat === seatIdx) {
      throw new Error("你是首出，不能過牌");
    }

    table.passCount += 1;
    pushFeed(room, `${seat.displayName} 過牌`, "system");

    // Check if 3 consecutive passes (all others passed)
    if (table.passCount >= MAX_PLAYERS - 1) {
      // Last player who played leads new trick
      room.round.currentTurn = table.leadSeat;
      room.round.table.lastPlay = null;
      room.round.table.passCount = 0;
      pushFeed(room, `${room.players[table.leadSeat].displayName} 重新出牌`, "system");
      this.scheduleTurn(room);
      return room;
    }

    // Advance turn
    room.round.currentTurn = (seatIdx + 1) % MAX_PLAYERS;
    this.scheduleTurn(room);
    return room;
  }

  _beatsPlay(newCards, oldCards) {
    // For singles: compare by sortValue
    if (newCards.length === 1 && oldCards.length === 1) {
      return newCards[0].sortValue > oldCards[0].sortValue;
    }
    // For pairs: compare highest card
    if (newCards.length === 2 && oldCards.length === 2) {
      const newMax = Math.max(...newCards.map((c) => c.sortValue));
      const oldMax = Math.max(...oldCards.map((c) => c.sortValue));
      return newMax > oldMax;
    }
    return false;
  }

  finishRound(room, winnerSeat) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnEndsAt = null;
    room.turnDurationMs = null;

    room.round.stage = "finished";

    const winnerName = room.players[winnerSeat]?.displayName;
    const headline = `${winnerName} 獲勝！`;
    const detail = `先出完手牌`;

    const settlements = buildStandardSettlements(room.players, {
      winnerSeatIndexes: [winnerSeat],
      loserPenalty: 30,
      winRank: 14,
      lossRank: -8
    });

    room.lastResult = {
      headline,
      detail,
      winnerSeat,
      gameKey: "bigtwo",
      deltas: settlements.map((entry) => ({
        seatIndex: entry.seatIndex,
        displayName: entry.displayName,
        delta: entry.delta,
        outcome: entry.outcome
      }))
    };

    applyUserSettlements(settlements).catch((err) => {
      console.error("Failed to apply bigtwo settlements", err);
    });

    room.state = "waiting";
    room.round = null;
    room.players.forEach((p) => { p.ready = false; });

    pushFeed(room, headline, "success");
    this.maybeCloseCompletedRoom(room);
    this.emitRoom(room);
  }

  scheduleTurn(room) {
    clearTimeout(room.turnTimer);
    const durationMs = Math.max(1, Number(room.settings.turnSeconds || DEFAULT_TURN_SECONDS)) * 1000;
    room.turnDurationMs = durationMs;
    room.turnEndsAt = Date.now() + durationMs;

    if (room.round) {
      room.round.turnEndsAt = room.turnEndsAt;
      room.round.turnDurationMs = durationMs;
    }

    room.turnTimer = setTimeout(() => {
      if (!room.round || room.round.stage !== "playing") return;
      this.handleTurnTimeout(room);
      this.emitRoom(room);
    }, durationMs);

    this.emitRoom(room);
  }

  handleTurnTimeout(room) {
    if (!room.round || room.round.stage !== "playing") return;
    const seat = room.players[room.round.currentTurn];
    if (!seat) return;

    const table = room.round.table;
    if (!table.lastPlay || table.leadSeat === seat.seatIndex) {
      // Must play, play lowest card
      const hand = room.round.hands[seat.seatIndex];
      if (hand.length > 0) {
        this.playHand(room.roomNo, seat.userId, [hand[0].id]);
        pushFeed(room, `${seat.displayName} 超時，系統自動出牌`, "system");
      }
    } else {
      this.passTurn(room.roomNo, seat.userId);
      pushFeed(room, `${seat.displayName} 超時，系統自動過牌`, "system");
    }
  }

  registerSocket(roomNo, userId, socket) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) throw new Error("尚未加入房間");

    seat.socketIds.add(socket.id);
    this.markSeatConnected(room, seat);
    socket.join(`bigtwo:${roomNo}`);
    this.emitRoom(room);
  }

  unregisterSocket(socketId) {
    for (const room of this.rooms.values()) {
      for (const seat of room.players) {
        if (!seat.socketIds.has(socketId)) continue;
        seat.socketIds.delete(socketId);
        if (seat.socketIds.size > 0 || seat.isBot) continue;
        this.markSeatReconnecting(room, seat);
        this.emitRoom(room);
        this.syncRoomOccupancyLifecycle(room);
        return;
      }
    }
  }

  emitRoom(room) {
    this.syncRoomDirectory(room);
    for (const player of room.players) {
      for (const socketId of player.socketIds) {
        this.io?.to(socketId).emit("bigtwo:update", {
          room: this.serializeRoom(room, player.userId)
        });
      }
    }
  }

  serializeRoomSummary(room) {
    return {
      roomNo: room.roomNo,
      gameKey: room.gameKey,
      title: room.title,
      strapline: room.strapline,
      state: room.state,
      settings: room.settings,
      playerCount: room.players.length,
      createdAt: room.createdAt
    };
  }

  serializeRoom(room, viewerUserId = null) {
    const viewerSeat = room.players.find((p) => p.userId === viewerUserId) || null;
    const availability = this.getAdminAvailability(room);
    const degradedState = buildAvailabilityEnvelope({
      controls: getAvailabilityControlsSync(),
      familyKey: "card",
      roomAvailability: availability,
      supportsVoice: false
    });

    return {
      roomNo: room.roomNo,
      availability,
      degradedState,
      familyKey: room.familyKey,
      gameKey: room.gameKey,
      ownerId: room.ownerId,
      title: room.title,
      strapline: room.strapline,
      state: room.state,
      settings: room.settings,
      createdAt: room.createdAt,
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
        })
      })),
      round: room.round ? {
        stage: room.round.stage,
        currentTurn: room.round.currentTurn,
        table: room.round.table,
        turnEndsAt: room.round.turnEndsAt,
        turnDurationMs: room.round.turnDurationMs
      } : null,
      hands: room.round && viewerSeat
        ? room.round.hands[viewerSeat.seatIndex]
        : []
    };
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
      socketIds: new Set()
    };
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
      throw new Error("房間排空中，暫停新加入");
    }
  }

  drainRoom(roomNo) {
    const room = this.assertRoom(roomNo);
    room.adminState = "draining";
    pushFeed(room, "管理員已將房間切換為排空模式", "system");
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
    if (room.state !== "waiting") throw new Error("對局進行中，暫不可移除玩家");

    const targetIndex = room.players.findIndex((p) => String(p.userId) === String(occupantId));
    if (targetIndex === -1) throw new Error("找不到這個房內身份");

    const [removedSeat] = room.players.splice(targetIndex, 1);
    if (!removedSeat.isBot) this.clearReconnectTimer(room.roomNo, removedSeat.userId);
    removedSeat.socketIds?.clear?.();

    if (!room.players.some((p) => String(p.userId) === String(room.ownerId))) {
      const nextOwner = room.players.find((p) => !p.isBot) || room.players[0] || null;
      room.ownerId = nextOwner?.userId || room.ownerId;
    }

    room.players.forEach((p, i) => { p.seatIndex = i; });

    if (room.players.length === 0) {
      this.expireAbandonedRoom(room);
      return null;
    }

    pushFeed(room, `${removedSeat.displayName} 已被管理員移出房間`, "system");
    this.syncRoomDirectory(room);
    this.emitRoom(room);
    return room;
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
      if (!key.startsWith(prefix)) continue;
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
    if (!room || this.countConnectedHumanPlayers(room) > 0) return;

    const timer = setTimeout(() => {
      this.clearRoomExpiryTimer(roomNo);
      const liveRoom = this.rooms.get(roomNo);
      if (!liveRoom || this.countConnectedHumanPlayers(liveRoom) > 0) return;
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
    const seat = room?.players.find((p) => !p.isBot && p.userId === userId);
    if (!room || !seat || seat.connected || !seat.reconnectGraceEndsAt) return;

    const delay = Math.max(0, Date.parse(seat.reconnectGraceEndsAt) - Date.now());
    const timer = setTimeout(() => {
      this.clearReconnectTimer(roomNo, userId);
      const liveRoom = this.rooms.get(roomNo);
      const liveSeat = liveRoom?.players.find((p) => !p.isBot && p.userId === userId);
      if (!liveRoom || !liveSeat || liveSeat.connected) return;
      liveSeat.reconnectGraceEndsAt = null;
      this.emitRoom(liveRoom);
      this.syncRoomOccupancyLifecycle(liveRoom);
    }, delay);

    this.reconnectTimers.set(this.getReconnectTimerKey(roomNo, userId), timer);
  }

  countConnectedHumanPlayers(room) {
    return room.players.filter((p) => !p.isBot && (p.connected || Boolean(p.reconnectGraceEndsAt))).length;
  }

  syncRoomOccupancyLifecycle(room) {
    if (!room) return false;
    if (this.countConnectedHumanPlayers(room) > 0) {
      this.clearRoomExpiryTimer(room.roomNo);
      return false;
    }
    if (this.maybeCloseCompletedRoom(room)) return true;
    this.scheduleRoomExpiry(room.roomNo);
    return false;
  }

  expireAbandonedRoom(room) {
    if (!room || !this.rooms.has(room.roomNo)) return false;
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnEndsAt = null;
    room.turnDurationMs = null;

    this.clearReconnectTimersForRoom(room.roomNo);
    this.clearRoomExpiryTimer(room.roomNo);
    room.round = null;
    this.rooms.delete(room.roomNo);
    unregisterRoomEntry(room.roomNo);
    return true;
  }

  maybeCloseCompletedRoom(room) {
    if (!room || room.state !== "waiting" || !room.lastResult) return false;
    if (this.countConnectedHumanPlayers(room) > 0) return false;
    return this.expireAbandonedRoom(room);
  }

  buildRoomDirectoryEntry(room) {
    const meta = getGameMeta("bigtwo") || {};
    const visibility = room.settings?.visibility === "private" ? "private" : "public";
    return {
      roomNo: room.roomNo,
      familyKey: "card",
      gameKey: "bigtwo",
      title: room.title || meta.title || "大老二",
      strapline: room.strapline || meta.strapline || "",
      detailRoute: `/bigtwo/${room.roomNo}`,
      joinRoute: `/api/bigtwo/rooms/${room.roomNo}/join`,
      visibility,
      ownerId: room.ownerId,
      state: room.state,
      supportsShareLink: true,
      guestAllowed: false,
      memberIds: room.players.filter((p) => !p.isBot).map((p) => p.userId),
      updatedAt: new Date().toISOString()
    };
  }

  syncRoomDirectory(room) {
    const entry = this.buildRoomDirectoryEntry(room);
    if (!updateRoomEntry(room.roomNo, entry)) registerRoomEntry(entry);
  }

  assertRoom(roomNo) {
    const room = this.rooms.get(roomNo);
    if (!room) throw new Error("房間不存在");
    return room;
  }

  assertPlayingRoom(roomNo) {
    const room = this.assertRoom(roomNo);
    if (room.state !== "playing" || !room.round) throw new Error("當前沒有進行中的牌局");
    return room;
  }

  assertCurrentTurn(room, userId) {
    const seat = this.findSeat(room, userId);
    if (!seat) throw new Error("你不在該房間內");
    if (room.round.currentTurn !== seat.seatIndex) throw new Error("還沒輪到你");
    return seat;
  }

  findSeat(room, userId) {
    return room.players.find((p) => p.userId === userId);
  }
}

function normalizeBigTwoConfig(input = {}) {
  return {
    visibility: input.visibility === "private" ? "private" : "public",
    turnSeconds: clampNumber(input.turnSeconds ?? DEFAULT_TURN_SECONDS, 10, 90)
  };
}

function clampNumber(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, Math.round(num)));
}

function pushFeed(room, text, type = "system") {
  room.feed = room.feed || [];
  room.feed.push({ text, type, ts: Date.now() });
  if (room.feed.length > 50) room.feed = room.feed.slice(-30);
}

module.exports = {
  getBigTwoRoomManager,
  BigTwoRoomManager
};
