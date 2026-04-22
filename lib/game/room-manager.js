const { query } = require("../db");
const { applyUserSettlements } = require("../economy");
const { getGameMeta } = require("../games/catalog");
const {
  allocateRoomNo,
  registerRoomEntry,
  unregisterRoomEntry,
  updateRoomEntry
} = require("../rooms/directory");
const { createDeck, sortCards, cardsToText } = require("./cards");
const { evaluateCards, compareCombos } = require("./combo");
const { chooseBid, choosePlay } = require("./bot");
const {
  assertSupportedTemplateMode,
  getBidCeiling,
  normalizeRoomSettings,
  normalizeTemplateRecord,
  pickAllowedOverrides
} = require("./template-settings");
const { API_ROUTES, SOCKET_EVENTS } = require("../shared/network-contract");

const BOT_NAMES = ["阿強機器人", "春天助手", "炸彈專家", "叫分大師"];

function getRoomManager() {
  if (!global.ddzRoomManager) {
    global.ddzRoomManager = new RoomManager();
  }

  return global.ddzRoomManager;
}

class RoomManager {
  constructor() {
    this.rooms = new Map();
    this.io = null;
  }

  attachIo(io) {
    this.io = io;
  }

  listPublicRooms() {
    return [...this.rooms.values()]
      .filter((room) => room.settings.roomVisibility !== "private")
      .map((room) => this.serializeRoom(room));
  }

  countOpenRoomsByOwner(ownerId) {
    return [...this.rooms.values()].filter(
      (room) => room.ownerId === ownerId && room.state !== "archived"
    ).length;
  }

  createRoom(owner, template, overrides = {}) {
    const normalizedTemplate = normalizeTemplateRecord(template);
    assertSupportedTemplateMode(normalizedTemplate.mode);
    const roomNo = allocateRoomNo();
    const settings = normalizeRoomSettings({
      ...normalizedTemplate.settings,
      ...pickAllowedOverrides(overrides)
    }, normalizedTemplate.mode);
    const room = {
      roomNo,
      ownerId: owner.id,
      templateId: normalizedTemplate.id,
      templateName: normalizedTemplate.name,
      templateTitle: normalizedTemplate.title,
      mode: normalizedTemplate.mode,
      settings,
      createdAt: new Date().toISOString(),
      state: "waiting",
      lastResult: null,
      turnTimer: null,
      chatFeed: [],
      players: [this.createHumanSeat(owner, 0)],
      round: null
    };

    this.rooms.set(roomNo, room);
    registerRoomEntry(this.buildRoomDirectoryEntry(room));
    return room;
  }

  getRoom(roomNo) {
    return this.rooms.get(roomNo);
  }

  joinRoom(roomNo, user) {
    const room = this.rooms.get(roomNo);
    if (!room) {
      throw new Error("房間不存在");
    }

    const existingSeat = room.players.find(
      (player) => !player.isBot && player.userId === user.id
    );
    if (existingSeat) {
      existingSeat.displayName = user.displayName || user.username;
      existingSeat.connected = true;
      this.syncRoomDirectory(room);
      return room;
    }

    if (room.players.length >= 3) {
      throw new Error("房間已滿");
    }

    room.players.push(this.createHumanSeat(user, room.players.length));
    this.syncRoomDirectory(room);
    this.emitRoom(room);
    return room;
  }

  addBot(roomNo, userId, count = 1) {
    const room = this.assertOwnerWaitingRoom(roomNo, userId);
    const available = 3 - room.players.length;

    for (let i = 0; i < Math.min(available, count); i += 1) {
      room.players.push(this.createBotSeat(room.players.length));
    }

    this.emitRoom(room);
    this.maybeStartRoom(room);
    return room;
  }

  setReady(roomNo, userId, ready = true) {
    const room = this.rooms.get(roomNo);
    if (!room) {
      throw new Error("房間不存在");
    }

    const seat = room.players.find(
      (player) => !player.isBot && player.userId === userId
    );
    if (!seat) {
      throw new Error("不在此房間內");
    }

    seat.ready = ready;
    this.emitRoom(room);
    this.maybeStartRoom(room);
    return room;
  }

  toggleTrustee(roomNo, userId, trustee) {
    const room = this.rooms.get(roomNo);
    if (!room || !room.round) {
      throw new Error("房間未在對局中");
    }

    const seat = room.players.find(
      (player) => !player.isBot && player.userId === userId
    );
    if (!seat) {
      throw new Error("不在此房間內");
    }

    seat.trustee = Boolean(trustee);

    if (room.round.currentTurn === seat.seatIndex) {
      this.scheduleTurn(room, seat.trustee ? this.getTrusteeDelayMs(room) : null);
    } else {
      this.emitRoom(room, {
        notification: seat.trustee
          ? `${seat.displayName} 已開啟托管`
          : `${seat.displayName} 已取消托管`
      });
    }

    return room;
  }

  registerSocket(roomNo, userId, socket) {
    const room = this.rooms.get(roomNo);
    if (!room) {
      throw new Error("房間不存在");
    }

    const seat = room.players.find(
      (player) => !player.isBot && player.userId === userId
    );
    if (!seat) {
      throw new Error("尚未加入房間");
    }

    seat.socketIds.add(socket.id);
    seat.connected = true;
    socket.join(roomNo);
    this.emitRoom(room);
  }

  unregisterSocket(socketId) {
    for (const room of this.rooms.values()) {
      for (const seat of room.players) {
        if (seat.socketIds.has(socketId)) {
          seat.socketIds.delete(socketId);
          seat.connected = seat.socketIds.size > 0;

          if (!seat.connected && room.round) {
            seat.trustee = true;
            if (room.round.currentTurn === seat.seatIndex) {
              this.scheduleTurn(room, this.getTrusteeDelayMs(room));
              return;
            }
          }

          this.emitRoom(room);
          this.maybeCloseCompletedRoom(room);
          return;
        }
      }
    }
  }

  submitBid(roomNo, userId, value) {
    const room = this.rooms.get(roomNo);
    if (!room || !room.round || room.round.stage !== "bidding") {
      throw new Error("當前不可叫分");
    }

    const seat = this.findSeatByActor(room, userId);
    if (!seat || room.round.currentTurn !== seat.seatIndex) {
      throw new Error("未輪到你叫分");
    }

    if (!room.settings.bidOptions.includes(value)) {
      throw new Error("叫分值不合法");
    }

    room.round.bidHistory.push({
      seatIndex: seat.seatIndex,
      value,
      playerName: seat.displayName
    });

    if (value > room.round.highestBid) {
      room.round.highestBid = value;
      room.round.highestBidSeat = seat.seatIndex;
    }

    room.round.bidTurns += 1;
    if (value === getBidCeiling(room.settings) || room.round.bidTurns >= room.players.length) {
      this.finishBidding(room);
    } else {
      room.round.currentTurn = nextSeatIndex(room.round.currentTurn, room.players.length);
      this.emitRoom(room);
      this.scheduleTurn(room);
    }

    return room;
  }

  submitPlay(roomNo, userId, cardIds) {
    const room = this.rooms.get(roomNo);
    if (!room || !room.round || room.round.stage !== "playing") {
      throw new Error("當前不可出牌");
    }

    const seat = this.findSeatByActor(room, userId);
    if (!seat || room.round.currentTurn !== seat.seatIndex) {
      throw new Error("未輪到你出牌");
    }

    const hand = room.round.hands[seat.seatIndex];
    const selectedCards = cardIds.map((cardId) => hand.find((card) => card.id === cardId));

    if (selectedCards.some((card) => !card)) {
      throw new Error("選中的牌不存在");
    }

    const combo = evaluateCards(selectedCards);
    if (!combo) {
      throw new Error("牌型不合法");
    }

    if (combo.type === "bomb" && room.settings.allowBomb === false) {
      throw new Error("此房間已禁用炸彈");
    }

    if (combo.type === "rocket" && room.settings.allowRocket === false) {
      throw new Error("此房間已禁用王炸");
    }

    if (room.round.lastPlay && room.round.lastPlay.seatIndex !== seat.seatIndex) {
      if (!compareCombos(combo, room.round.lastPlay.combo)) {
        throw new Error("牌型不足以壓過上家");
      }
    }

    room.round.hands[seat.seatIndex] = hand.filter(
      (card) => !cardIds.includes(card.id)
    );
    room.round.playSequence = (room.round.playSequence || 0) + 1;
    room.round.lastPlay = {
      playId: room.round.playSequence,
      seatIndex: seat.seatIndex,
      combo,
      cards: combo.cards,
      text: cardsToText(combo.cards),
      type: combo.type
    };
    room.round.lastActiveSeat = seat.seatIndex;
    room.round.passCount = 0;
    room.round.playCountBySeat[seat.seatIndex] += 1;

    if (combo.type === "bomb") {
      room.round.multiplier *= room.settings.bombMultiplier || 2;
    } else if (combo.type === "rocket") {
      room.round.multiplier *= room.settings.rocketMultiplier || 2;
    }

    if (room.round.hands[seat.seatIndex].length === 0) {
      this.finishGame(room, seat.seatIndex).catch((error) => {
        console.error("Failed to finish card room", error);
      });
      return room;
    }

    room.round.currentTurn = nextSeatIndex(seat.seatIndex, room.players.length);
    this.emitRoom(room, {
      notification: `${seat.displayName} 打出 ${cardsToText(combo.cards)}`
    });
    this.scheduleTurn(room);
    return room;
  }

  pass(roomNo, userId) {
    const room = this.rooms.get(roomNo);
    if (!room || !room.round || room.round.stage !== "playing") {
      throw new Error("當前不可過牌");
    }

    const seat = this.findSeatByActor(room, userId);
    if (!seat || room.round.currentTurn !== seat.seatIndex) {
      throw new Error("未輪到你");
    }

    if (!room.round.lastPlay || room.round.lastPlay.seatIndex === seat.seatIndex) {
      throw new Error("首出不能過");
    }

    room.round.passCount += 1;

    if (room.round.passCount >= room.players.length - 1) {
      room.round.currentTurn = room.round.lastActiveSeat;
      room.round.lastPlay = null;
      room.round.passCount = 0;
      this.emitRoom(room, {
        notification: `${seat.displayName} 過牌，其餘兩家都不要，${room.players[room.round.currentTurn].displayName} 重新領出`
      });
    } else {
      room.round.currentTurn = nextSeatIndex(seat.seatIndex, room.players.length);
      this.emitRoom(room, {
        notification: `${seat.displayName} 過牌`
      });
    }

    this.scheduleTurn(room);
    return room;
  }

  maybeStartRoom(room) {
    if (room.state !== "waiting") {
      return;
    }

    if (room.players.length !== 3) {
      return;
    }

    if (!room.players.every((player) => player.isBot || player.ready)) {
      return;
    }

    this.startGame(room);
  }

  startGame(room) {
    const deck = createDeck(room.mode);
    const hands = {
      0: sortCards(deck.slice(0, 17)),
      1: sortCards(deck.slice(17, 34)),
      2: sortCards(deck.slice(34, 51))
    };
    const bottomCards = sortCards(deck.slice(51));
    const firstBidSeat = Math.floor(Math.random() * room.players.length);

    room.state = "bidding";
    room.round = {
      stage: "bidding",
      currentTurn: firstBidSeat,
      firstBidSeat,
      bidHistory: [],
      bidTurns: 0,
      highestBid: 0,
      highestBidSeat: null,
      hands,
      bottomCards,
      multiplier: 1,
      lastPlay: null,
      lastActiveSeat: null,
      passCount: 0,
      playCountBySeat: { 0: 0, 1: 0, 2: 0 },
      landlordSeat: null,
      winnerSeat: null,
      winnerSide: null,
      summary: null,
      playSequence: 0,
      turnEndsAt: null,
      turnDurationMs: null,
      turnMode: "manual"
    };

    for (const player of room.players) {
      player.ready = player.isBot;
      player.trustee = player.isBot;
      player.isLandlord = false;
    }

    this.emitRoom(room, {
      notification: `對局開始，${room.players[firstBidSeat].displayName} 先叫分`
    });
    this.scheduleTurn(room);
  }

  finishBidding(room) {
    const landlordSeat =
      room.round.highestBidSeat === null
        ? Math.floor(Math.random() * room.players.length)
        : room.round.highestBidSeat;

    room.round.landlordSeat = landlordSeat;
    room.round.highestBid = Math.max(room.round.highestBid, 1);
    room.round.multiplier = room.round.highestBid;
    room.round.hands[landlordSeat] = sortCards([
      ...room.round.hands[landlordSeat],
      ...room.round.bottomCards
    ]);
    room.round.currentTurn = landlordSeat;
    room.round.stage = "playing";
    room.state = "playing";

    for (const player of room.players) {
      player.isLandlord = player.seatIndex === landlordSeat;
    }

    this.emitRoom(room, {
      notification: `${room.players[landlordSeat].displayName} 成為地主，底牌為 ${cardsToText(
        room.round.bottomCards
      )}`
    });
    this.scheduleTurn(room);
  }

  async finishGame(room, winnerSeat) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.round.winnerSeat = winnerSeat;
    room.round.winnerSide =
      winnerSeat === room.round.landlordSeat ? "landlord" : "farmers";

    const spring =
      room.settings.allowSpring === false ? false : this.detectSpring(room);
    if (spring) {
      room.round.multiplier *= room.settings.springMultiplier || 2;
    }

    const baseScore = room.settings.baseScore || 1;
    const unit = baseScore * room.round.multiplier;
    const deltas = {};

    for (const player of room.players) {
      const isLandlord = player.seatIndex === room.round.landlordSeat;
      const didWin =
        room.round.winnerSide === "landlord" ? isLandlord : !isLandlord;
      deltas[player.seatIndex] = isLandlord
        ? didWin
          ? unit * 2
          : unit * -2
        : didWin
          ? unit
          : unit * -1;
    }

    const summary = {
      landlordSeat: room.round.landlordSeat,
      winnerSeat,
      winnerSide: room.round.winnerSide,
      multiplier: room.round.multiplier,
      baseScore,
      spring,
      deltas: room.players.map((player) => ({
        seatIndex: player.seatIndex,
        displayName: player.displayName,
        isBot: player.isBot,
        delta: deltas[player.seatIndex]
      }))
    };

    room.round.summary = summary;
    await this.persistResult(room, summary);

    room.lastResult = summary;
    room.state = "waiting";
    room.round = null;

    for (const player of room.players) {
      player.ready = player.isBot;
      player.trustee = player.isBot;
      player.isLandlord = false;
    }

    this.emitRoom(room, {
      notification: `${room.players[winnerSeat].displayName} 贏得本局`
    });
    this.maybeCloseCompletedRoom(room);
  }

  async persistResult(room, summary) {
    const resultDelta = {};
    const settlements = [];

    for (const player of room.players) {
      const delta = summary.deltas.find((item) => item.seatIndex === player.seatIndex)?.delta || 0;
      resultDelta[player.displayName] = delta;

      const didWin =
        (summary.winnerSide === "landlord" && player.seatIndex === summary.landlordSeat) ||
        (summary.winnerSide === "farmers" && player.seatIndex !== summary.landlordSeat);
      const isLandlord = player.seatIndex === summary.landlordSeat;

      settlements.push({
        userId: player.userId,
        isBot: player.isBot,
        delta,
        rankScore: didWin ? 12 * summary.multiplier : -8 * summary.multiplier,
        wins: didWin ? 1 : 0,
        losses: didWin ? 0 : 1,
        landlordWins: didWin && isLandlord ? 1 : 0,
        landlordLosses: !didWin && isLandlord ? 1 : 0,
        farmerWins: didWin && !isLandlord ? 1 : 0,
        farmerLosses: !didWin && !isLandlord ? 1 : 0,
        totalGames: 1
      });
    }

    await applyUserSettlements(settlements);

    const landlordPlayer = room.players.find(
      (player) => player.seatIndex === summary.landlordSeat
    );

    await query(
      `
        INSERT INTO game_results
          (room_no, template_id, winner_side, landlord_user_id, multiplier, base_score, score_delta, summary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        room.roomNo,
        room.templateId,
        summary.winnerSide,
        landlordPlayer?.isBot ? null : landlordPlayer?.userId || null,
        summary.multiplier,
        summary.baseScore,
        JSON.stringify(resultDelta),
        JSON.stringify(summary)
      ]
    );
  }

  scheduleTurn(room, delay = null) {
    clearTimeout(room.turnTimer);
    if (!room.round) {
      return;
    }

    const seat = room.players.find(
      (player) => player.seatIndex === room.round.currentTurn
    );
    if (!seat) {
      return;
    }

    const isAutomated = seat.isBot || seat.trustee;
    const timeoutMs =
      delay !== null
        ? delay
        : isAutomated
          ? this.getTrusteeDelayMs(room)
          : this.getManualTurnMs(room);

    room.round.turnDurationMs = timeoutMs;
    room.round.turnEndsAt = Date.now() + timeoutMs;
    room.round.turnMode = isAutomated ? "trustee" : "manual";
    this.emitRoom(room);

    room.turnTimer = setTimeout(() => {
      if (!room.round) {
        return;
      }

      const activeSeat = room.players.find(
        (player) => player.seatIndex === room.round.currentTurn
      );
      if (!activeSeat) {
        return;
      }

      if (!activeSeat.isBot && !activeSeat.trustee) {
        activeSeat.trustee = true;
        this.emitRoom(room, {
          notification: `${activeSeat.displayName} 超時，已進入托管`
        });
        this.scheduleTurn(room, this.getTrusteeDelayMs(room));
        return;
      }

      this.performAutomatedAction(room, activeSeat);
    }, timeoutMs);
  }

  getManualTurnMs(room) {
    return (room.settings.countdownSeconds || 18) * 1000;
  }

  getTrusteeDelayMs(room) {
    const minSeconds = Math.max(1, Number(room.settings.autoTrusteeMinSeconds || 2));
    const maxSeconds = Math.max(
      minSeconds,
      Number(room.settings.autoTrusteeMaxSeconds || room.settings.autoTrusteeSeconds || 5)
    );
    const randomSeconds =
      minSeconds + Math.random() * Math.max(0, maxSeconds - minSeconds);

    return Math.round(randomSeconds * 1000);
  }

  performAutomatedAction(room, seat) {
    if (!room.round) {
      return;
    }

    if (room.round.stage === "bidding") {
      const hand = room.round.hands[seat.seatIndex];
      const bidCeiling = getBidCeiling(room.settings);
      const availableRaises = (room.settings.bidOptions || []).filter(
        (value) => value > room.round.highestBid && value <= bidCeiling
      );
      const suggestedBid = chooseBid(hand, {
        maxBid: bidCeiling,
        bidOptions: room.settings.bidOptions
      });
      const finalBid =
        availableRaises.length === 0
          ? 0
          : Math.max(availableRaises[0], suggestedBid);

      try {
        this.submitBid(room.roomNo, seat.userId, finalBid);
      } catch (error) {
        this.submitBid(room.roomNo, seat.userId, 0);
      }
      return;
    }

    if (room.round.stage === "playing") {
      const hand = room.round.hands[seat.seatIndex];
      const lastPlay =
        room.round.lastPlay && room.round.lastPlay.seatIndex !== seat.seatIndex
          ? room.round.lastPlay.combo
          : null;
      const playOptions = {
        allowBomb: room.settings.allowBomb !== false,
        allowRocket: room.settings.allowRocket !== false
      };
      const play = choosePlay(hand, lastPlay, playOptions);

      if (play) {
        this.submitPlay(
          room.roomNo,
          seat.userId,
          play.cards.map((card) => card.id)
        );
      } else if (room.round.lastPlay && room.round.lastPlay.seatIndex !== seat.seatIndex) {
        this.pass(room.roomNo, seat.userId);
      } else {
        const fallback = choosePlay(hand, null, playOptions);
        if (fallback) {
          this.submitPlay(
            room.roomNo,
            seat.userId,
            fallback.cards.map((card) => card.id)
          );
        }
      }
    }
  }

  detectSpring(room) {
    const landlordSeat = room.round.landlordSeat;
    const landlordPlayCount = room.round.playCountBySeat[landlordSeat];
    const farmerSeats = room.players
      .filter((player) => player.seatIndex !== landlordSeat)
      .map((player) => player.seatIndex);
    const farmerPlayed = farmerSeats.some(
      (seatIndex) => room.round.playCountBySeat[seatIndex] > 0
    );

    if (room.round.winnerSide === "landlord") {
      return !farmerPlayed;
    }

    return landlordPlayCount <= 1;
  }

  serializeRoom(room, viewerUserId = null) {
    const viewerSeat = room.players.find(
      (player) => !player.isBot && player.userId === viewerUserId
    );

    return {
      roomNo: room.roomNo,
      ownerId: room.ownerId,
      templateId: room.templateId,
      templateName: room.templateName,
      templateTitle: room.templateTitle,
      mode: room.mode,
      settings: room.settings,
      state: room.state,
      createdAt: room.createdAt,
      lastResult: room.lastResult,
      chatFeed: room.chatFeed,
      players: room.players.map((player) => ({
        seatIndex: player.seatIndex,
        userId: player.isBot ? null : player.userId,
        username: player.username,
        displayName: player.displayName,
        isBot: player.isBot,
        ready: player.ready,
        connected: player.connected,
        trustee: player.trustee,
        isLandlord: player.isLandlord,
        handCount: room.round ? room.round.hands[player.seatIndex].length : 0
      })),
      round: room.round
        ? {
            stage: room.round.stage,
            currentTurn: room.round.currentTurn,
            bidHistory: room.round.bidHistory,
            highestBid: room.round.highestBid,
            highestBidSeat: room.round.highestBidSeat,
            multiplier: room.round.multiplier,
            turnEndsAt: room.round.turnEndsAt,
            turnDurationMs: room.round.turnDurationMs,
            turnMode: room.round.turnMode,
            bottomCards:
              room.state === "playing" || room.state === "bidding"
                ? room.round.landlordSeat === null
                  ? []
                  : room.round.bottomCards
                : room.round.bottomCards,
            lastPlay: room.round.lastPlay
              ? {
                  playId: room.round.lastPlay.playId,
                  seatIndex: room.round.lastPlay.seatIndex,
                  type: room.round.lastPlay.type,
                  text: room.round.lastPlay.text,
                  cards: room.round.lastPlay.cards
                }
              : null,
            hands: viewerSeat
              ? {
                  [viewerSeat.seatIndex]: room.round.hands[viewerSeat.seatIndex]
                }
              : {},
            landlordSeat: room.round.landlordSeat
          }
        : null
    };
  }

  emitRoom(room, meta = {}) {
    this.syncRoomDirectory(room);

    for (const player of room.players) {
      if (player.isBot) {
        continue;
      }

      for (const socketId of player.socketIds) {
        this.io?.to(socketId).emit(SOCKET_EVENTS.room.update, {
          room: this.serializeRoom(room, player.userId),
          ...meta
        });
      }
    }
  }

  sendChat(roomNo, userId, payload) {
    const room = this.rooms.get(roomNo);
    if (!room) {
      throw new Error("房間不存在");
    }

    const seat = room.players.find(
      (player) => !player.isBot && player.userId === userId
    );
    if (!seat) {
      throw new Error("尚未加入房間");
    }

    const text = String(payload?.text || "").trim().slice(0, 24);
    const type = payload?.type === "emoji" ? "emoji" : "text";
    if (!text) {
      throw new Error("消息不能為空");
    }

    room.chatFeed.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      seatIndex: seat.seatIndex,
      displayName: seat.displayName,
      type,
      text,
      createdAt: new Date().toISOString()
    });

    room.chatFeed = room.chatFeed.slice(-8);
    this.emitRoom(room);
    return room;
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
      trustee: false,
      isLandlord: false,
      socketIds: new Set()
    };
  }

  createBotSeat(seatIndex) {
    return {
      seatIndex,
      userId: `bot-${Date.now()}-${seatIndex}`,
      username: `bot${seatIndex + 1}`,
      displayName: BOT_NAMES[seatIndex % BOT_NAMES.length],
      isBot: true,
      ready: true,
      connected: true,
      trustee: true,
      isLandlord: false,
      socketIds: new Set()
    };
  }

  buildRoomDirectoryEntry(room) {
    const meta = getGameMeta("doudezhu") || {};

    return {
      roomNo: room.roomNo,
      familyKey: "card",
      gameKey: "doudezhu",
      title: room.templateTitle || meta.title || "斗地主",
      strapline: room.templateTitle || meta.strapline || "",
      detailRoute: `/room/${room.roomNo}`,
      joinRoute: API_ROUTES.cardRooms.join(room.roomNo),
      visibility: room.settings?.roomVisibility === "private" ? "private" : "public",
      ownerId: room.ownerId,
      state: room.state,
      supportsShareLink: true,
      guestAllowed: false,
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

  findSeatByUser(room, userId) {
    return room.players.find((player) => !player.isBot && player.userId === userId);
  }

  findSeatByActor(room, userId) {
    return room.players.find((player) => player.userId === userId);
  }

  countConnectedHumanPlayers(room) {
    return room.players.filter((player) => !player.isBot && player.connected).length;
  }

  maybeCloseCompletedRoom(room) {
    if (!room || room.state !== "waiting" || !room.lastResult) {
      return false;
    }

    if (this.countConnectedHumanPlayers(room) > 0) {
      return false;
    }

    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.round = null;
    this.rooms.delete(room.roomNo);
    unregisterRoomEntry(room.roomNo);
    return true;
  }

  assertOwnerWaitingRoom(roomNo, userId) {
    const room = this.rooms.get(roomNo);
    if (!room) {
      throw new Error("房間不存在");
    }

    if (room.ownerId !== userId) {
      throw new Error("僅房主可操作");
    }

    if (room.state !== "waiting") {
      throw new Error("對局進行中，暫不可調整座位");
    }

    return room;
  }
}

function nextSeatIndex(current, total) {
  return (current + 1) % total;
}

module.exports = {
  getRoomManager,
  __testing: {
    RoomManager,
    getBidCeiling,
    nextSeatIndex,
    normalizeRoomSettings
  }
};
