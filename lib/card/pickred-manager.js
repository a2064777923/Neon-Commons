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
const HAND_SIZE = 8;
const TABLE_SIZE = 4;
const MAX_PLAYERS = 2;

// Card suits: 0=spades, 1=hearts, 2=diamonds, 3=clubs
// Red suits: hearts(1), diamonds(2)
const SUIT_NAMES = ["spades", "hearts", "diamonds", "clubs"];
const RANK_NAMES = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

function createDeck() {
  const deck = [];
  let id = 1;
  for (let suit = 0; suit < 4; suit++) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({
        id: id++,
        suit,
        rank,
        label: `${SUIT_NAMES[suit]}-${RANK_NAMES[rank - 1]}`,
        isRed: suit === 1 || suit === 2
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

function getPickRedRoomManager() {
  if (!global.pickRedRoomManager) {
    global.pickRedRoomManager = new PickRedRoomManager();
  }
  return global.pickRedRoomManager;
}

class PickRedRoomManager {
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
    const meta = getGameMeta("pickred") || {};
    const roomNo = allocateRoomNo();
    const settings = normalizePickRedConfig(config);

    const room = {
      roomNo,
      ownerId: owner.id,
      familyKey: "card",
      gameKey: "pickred",
      title: meta.title || "撿紅點",
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

    pushFeed(room, `${owner.displayName || owner.username} 創建了撿紅點房間`, "system");
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
    const hands = [[], []];
    const tableCards = [];

    // Deal 8 cards to each player
    for (let i = 0; i < HAND_SIZE; i++) {
      hands[0].push(deck.pop());
      hands[1].push(deck.pop());
    }

    // Deal 4 cards to table
    for (let i = 0; i < TABLE_SIZE; i++) {
      tableCards.push(deck.pop());
    }

    room.round = {
      stage: "playing",
      currentTurn: 0,
      hands,
      tableCards,
      deck,
      scores: [0, 0],
      matchedPairs: [[], []],
      turnEndsAt: null,
      turnDurationMs: null
    };

    pushFeed(room, `牌局開始，各發 ${HAND_SIZE} 張手牌。${room.players[0].displayName} 先手。`, "system");
    this.scheduleTurn(room);
  }

  drawCard(roomNo, userId) {
    const room = this.assertPlayingRoom(roomNo);
    const seat = this.assertCurrentTurn(room, userId);

    if (room.round.deck.length === 0) {
      throw new Error("牌堆已空");
    }

    const card = room.round.deck.pop();
    room.round.hands[seat.seatIndex].push(card);
    pushFeed(room, `${seat.displayName} 摸牌`, "system");
    this.emitRoom(room);
    return room;
  }

  matchPair(roomNo, userId, handCardId, tableCardId) {
    const room = this.assertPlayingRoom(roomNo);
    const seat = this.assertCurrentTurn(room, userId);
    const seatIdx = seat.seatIndex;

    const hand = room.round.hands[seatIdx];
    const handCardIdx = hand.findIndex((c) => c.id === handCardId);
    if (handCardIdx === -1) throw new Error("手牌中沒有這張牌");

    const tableIdx = room.round.tableCards.findIndex((c) => c.id === tableCardId);
    if (tableIdx === -1) throw new Error("桌牌中沒有這張牌");

    const handCard = hand[handCardIdx];
    const tableCard = room.round.tableCards[tableIdx];

    // Check if ranks sum to 10
    if (handCard.rank + tableCard.rank !== 10) {
      throw new Error("牌面數字總和不為 10");
    }

    // Remove cards
    hand.splice(handCardIdx, 1);
    room.round.tableCards.splice(tableIdx, 1);

    // Score red cards
    let points = 0;
    if (handCard.isRed) points += handCard.rank;
    if (tableCard.isRed) points += tableCard.rank;
    room.round.scores[seatIdx] += points;

    room.round.matchedPairs[seatIdx].push({ handCard, tableCard, points });
    pushFeed(room, `${seat.displayName} 配對成功 (+${points}分)`, "success");

    // Advance turn
    room.round.currentTurn = (seatIdx + 1) % MAX_PLAYERS;
    this.scheduleTurn(room);
    return room;
  }

  discardCard(roomNo, userId, cardId) {
    const room = this.assertPlayingRoom(roomNo);
    const seat = this.assertCurrentTurn(room, userId);
    const seatIdx = seat.seatIndex;

    const hand = room.round.hands[seatIdx];
    const cardIdx = hand.findIndex((c) => c.id === cardId);
    if (cardIdx === -1) throw new Error("手牌中沒有這張牌");

    const [card] = hand.splice(cardIdx, 1);
    room.round.tableCards.push(card);
    pushFeed(room, `${seat.displayName} 打出 ${card.label}`, "system");

    // Check if round should end
    if (this._shouldEndRound(room)) {
      this.finishRound(room);
      return room;
    }

    // Advance turn
    room.round.currentTurn = (seatIdx + 1) % MAX_PLAYERS;
    this.scheduleTurn(room);
    return room;
  }

  _shouldEndRound(room) {
    // End when both hands are empty
    if (room.round.hands[0].length === 0 && room.round.hands[1].length === 0) {
      return true;
    }

    // End when deck is empty and no player can make a match
    if (room.round.deck.length === 0) {
      const canMatch0 = room.round.hands[0].some((hc) =>
        room.round.tableCards.some((tc) => hc.rank + tc.rank === 10)
      );
      const canMatch1 = room.round.hands[1].some((hc) =>
        room.round.tableCards.some((tc) => hc.rank + tc.rank === 10)
      );
      if (!canMatch0 && !canMatch1) {
        return true;
      }
    }

    return false;
  }

  finishRound(room) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnEndsAt = null;
    room.turnDurationMs = null;

    room.round.stage = "finished";

    // Determine winner by score
    const score0 = room.round.scores[0];
    const score1 = room.round.scores[1];
    let winnerSeat;
    if (score0 > score1) {
      winnerSeat = 0;
    } else if (score1 > score0) {
      winnerSeat = 1;
    } else {
      winnerSeat = 0; // Tie goes to first player
    }

    const winnerName = room.players[winnerSeat]?.displayName;
    const headline = `${winnerName} 獲勝！`;
    const detail = `比分 ${score0}:${score1}`;

    const settlements = buildStandardSettlements(room.players, {
      winnerSeatIndexes: [winnerSeat],
      loserPenalty: Math.abs(score0 - score1) || 10,
      winRank: 14,
      lossRank: -8
    });

    room.lastResult = {
      headline,
      detail,
      winnerSeat,
      scores: [score0, score1],
      gameKey: "pickred",
      deltas: settlements.map((entry) => ({
        seatIndex: entry.seatIndex,
        displayName: entry.displayName,
        delta: entry.delta,
        outcome: entry.outcome
      }))
    };

    applyUserSettlements(settlements).catch((err) => {
      console.error("Failed to apply pickred settlements", err);
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

    const hand = room.round.hands[seat.seatIndex];
    if (hand.length > 0) {
      this.discardCard(room.roomNo, seat.userId, hand[0].id);
      pushFeed(room, `${seat.displayName} 超時，系統自動出牌`, "system");
    }
  }

  registerSocket(roomNo, userId, socket) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) throw new Error("尚未加入房間");

    seat.socketIds.add(socket.id);
    this.markSeatConnected(room, seat);
    socket.join(`pickred:${roomNo}`);
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
        this.io?.to(socketId).emit("pickred:update", {
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
        tableCards: room.round.tableCards,
        deckCount: room.round.deck.length,
        scores: room.round.scores,
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
    const meta = getGameMeta("pickred") || {};
    const visibility = room.settings?.visibility === "private" ? "private" : "public";
    return {
      roomNo: room.roomNo,
      familyKey: "card",
      gameKey: "pickred",
      title: room.title || meta.title || "撿紅點",
      strapline: room.strapline || meta.strapline || "",
      detailRoute: `/pickred/${room.roomNo}`,
      joinRoute: `/api/pickred/rooms/${room.roomNo}/join`,
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

function normalizePickRedConfig(input = {}) {
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
  getPickRedRoomManager,
  PickRedRoomManager
};
