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
const {
  createMahjongTileSet,
  shuffle,
  buildWall,
  detectClaims,
  detectWin,
  calculateFan,
  isFlower
} = require("./mahjong-tiles");

const DEFAULT_RECONNECT_GRACE_MS = 15000;
const DEFAULT_TURN_SECONDS = 30;
const HAND_SIZE = 13;
const MAX_PLAYERS = 4;
const CLAIM_WINDOW_MS = 3000;

function getMahjongRoomManager() {
  if (!global.mahjongRoomManager) {
    global.mahjongRoomManager = new MahjongRoomManager();
  }
  return global.mahjongRoomManager;
}

class MahjongRoomManager {
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
    const meta = getGameMeta("mahjong") || {};
    const roomNo = allocateRoomNo();
    const settings = normalizeMahjongConfig(config);

    const room = {
      roomNo,
      ownerId: owner.id,
      familyKey: "card",
      gameKey: "mahjong",
      title: meta.title || "麻將",
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

    pushFeed(room, `${owner.displayName || owner.username} 創建了 ${meta.title || "麻將"} 房間`, "system");
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

    // Build and shuffle 144 tiles
    const allTiles = createMahjongTileSet();
    const shuffled = shuffle(allTiles);
    const { wall, deadWall } = buildWall(shuffled);

    // Deal 13 tiles to each player
    const hands = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      hands.push(wall.splice(0, HAND_SIZE));
    }

    // Auto-replace flowers in initial hands
    const flowers = [[], [], [], []];
    for (let seat = 0; seat < MAX_PLAYERS; seat++) {
      this._replaceFlowersInHand(hands[seat], flowers[seat], wall, deadWall);
    }

    room.round = {
      stage: "playing",
      wall,
      deadWall,
      hands,
      melds: [[], [], [], []],
      discards: [[], [], [], []],
      flowers,
      currentTurn: 0,
      hasDrawn: false,
      pendingClaim: null,
      turnEndsAt: null,
      turnDurationMs: null
    };

    pushFeed(room, `牌局開始，各發 ${HAND_SIZE} 張手牌。${room.players[0].displayName}（東）先手。`, "system");
    this.scheduleTurn(room);
  }

  drawTile(roomNo, userId) {
    const room = this.assertPlayingRoom(roomNo);
    const seat = this.assertCurrentTurn(room, userId);

    if (room.round.hasDrawn) {
      throw new Error("本回合已經摸過牌");
    }

    if (room.round.pendingClaim) {
      throw new Error("等待其他玩家回應吃碰槓");
    }

    if (room.round.wall.length === 0) {
      this.finishRoundDraw(room);
      return room;
    }

    // Draw from wall
    const tile = room.round.wall.shift();
    const seatIdx = seat.seatIndex;

    // Auto-replace flowers
    if (isFlower(tile)) {
      room.round.flowers[seatIdx].push(tile);
      this._replaceFlowersFromDraw(room.round, seatIdx);
    } else {
      room.round.hands[seatIdx].push(tile);
    }

    room.round.hasDrawn = true;
    pushFeed(room, `${seat.displayName} 摸牌`, "system");

    // Check for self-draw win
    const hand = room.round.hands[seatIdx];
    const melds = room.round.melds[seatIdx];
    const winResult = detectWin(hand, melds);
    if (winResult) {
      // Player can declare win (auto-win for now)
      this.finishRoundWin(room, seatIdx, null, "selfDrawn");
      return room;
    }

    this.emitRoom(room);
    return room;
  }

  discardTile(roomNo, userId, tileId) {
    const room = this.assertPlayingRoom(roomNo);
    const seat = this.assertCurrentTurn(room, userId);

    if (!room.round.hasDrawn) {
      throw new Error("請先摸牌");
    }

    if (room.round.pendingClaim) {
      throw new Error("等待其他玩家回應吃碰槓");
    }

    const seatIdx = seat.seatIndex;
    const hand = room.round.hands[seatIdx];
    const tileIndex = hand.findIndex((t) => t.id === tileId);

    if (tileIndex === -1) {
      throw new Error("手牌中沒有這張牌");
    }

    const [discarded] = hand.splice(tileIndex, 1);
    room.round.discards[seatIdx].push(discarded);
    room.round.hasDrawn = false;

    pushFeed(room, `${seat.displayName} 打出 ${discarded.label || `牌${discarded.id}`}`, "system");

    // Start claim window
    this._startClaimWindow(room, seatIdx, discarded);
    return room;
  }

  claimTile(roomNo, userId, claimType) {
    const room = this.assertPlayingRoom(roomNo);
    if (!room.round.pendingClaim) {
      throw new Error("目前沒有可回應的棄牌");
    }

    const seat = this.findSeat(room, userId);
    if (!seat) throw new Error("你不在該房間內");

    const claim = room.round.pendingClaim.claims.find(
      (c) => c.userId === userId && c.type === claimType
    );
    if (!claim) {
      throw new Error("無效的回應或你沒有這個選項");
    }

    this._executeClaim(room, claim);
    return room;
  }

  passClaim(roomNo, userId) {
    const room = this.assertPlayingRoom(roomNo);
    if (!room.round.pendingClaim) {
      throw new Error("目前沒有可回應的棄牌");
    }

    const seat = this.findSeat(room, userId);
    if (!seat) throw new Error("你不在該房間內");

    const claimEntry = room.round.pendingClaim.claims.find((c) => c.userId === userId);
    if (claimEntry) {
      claimEntry.passed = true;
    }

    // Check if all claims are resolved
    this._checkClaimResolution(room);
    return room;
  }

  _startClaimWindow(room, discarderSeat, tile) {
    // Clear any existing claim timer
    if (room.round.pendingClaim?.timer) {
      clearTimeout(room.round.pendingClaim.timer);
    }

    // Collect claims from all opponents
    const allClaims = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
      if (i === discarderSeat) continue;
      const hand = room.round.hands[i];
      const melds = room.round.melds[i];
      const isNextPlayer = ((discarderSeat + 1) % MAX_PLAYERS) === i;
      const claims = detectClaims(tile, hand, melds, isNextPlayer);
      for (const c of claims) {
        allClaims.push({ ...c, seatIndex: i, userId: room.players[i].userId, passed: false });
      }
    }

    if (allClaims.length === 0) {
      // No claims possible, advance turn
      this._advanceTurnAfterDiscard(room, discarderSeat);
      return;
    }

    room.round.pendingClaim = {
      tile,
      discarderSeat,
      claims: allClaims,
      expiresAt: Date.now() + CLAIM_WINDOW_MS,
      timer: null
    };

    // Set auto-pass timer
    room.round.pendingClaim.timer = setTimeout(() => {
      this._resolveClaimWindow(room);
    }, CLAIM_WINDOW_MS);

    this.emitRoom(room);
  }

  _checkClaimResolution(room) {
    if (!room.round.pendingClaim) return;
    const pending = room.round.pendingClaim;
    const allPassed = pending.claims.every((c) => c.passed);
    if (allPassed) {
      this._resolveClaimWindow(room);
    }
  }

  _resolveClaimWindow(room) {
    if (!room.round.pendingClaim) return;
    const pending = room.round.pendingClaim;
    clearTimeout(pending.timer);

    // Filter out passed claims
    const activeClaims = pending.claims.filter((c) => !c.passed);

    if (activeClaims.length === 0) {
      // No one claimed, advance turn
      room.round.pendingClaim = null;
      this._advanceTurnAfterDiscard(room, pending.discarderSeat);
      return;
    }

    // Sort by priority (descending), then by seat proximity to discarder
    const discarderSeat = pending.discarderSeat;
    activeClaims.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      // Same priority: nearest counter-clockwise from discarder
      const distA = ((a.seatIndex - discarderSeat + MAX_PLAYERS) % MAX_PLAYERS);
      const distB = ((b.seatIndex - discarderSeat + MAX_PLAYERS) % MAX_PLAYERS);
      return distA - distB;
    });

    const winner = activeClaims[0];
    room.round.pendingClaim = null;
    this._executeClaim(room, winner);
  }

  _executeClaim(room, claim) {
    const seatIdx = claim.seatIndex;
    const tile = room.round.pendingClaim?.tile || claim.tile;

    // Clear pending claim
    if (room.round.pendingClaim?.timer) {
      clearTimeout(room.round.pendingClaim.timer);
    }
    room.round.pendingClaim = null;

    if (claim.type === "win") {
      this.finishRoundWin(room, seatIdx, tile, "claim");
      return;
    }

    const hand = room.round.hands[seatIdx];
    const melds = room.round.melds[seatIdx];

    if (claim.type === "pong") {
      // Remove 2 matching tiles from hand, add meld
      const matching = hand.filter((t) => t.suit === tile.suit && t.rank === tile.rank);
      const toRemove = matching.slice(0, 2);
      for (const t of toRemove) {
        const idx = hand.findIndex((h) => h.id === t.id);
        if (idx !== -1) hand.splice(idx, 1);
      }
      melds.push([...toRemove, tile]);
      pushFeed(room, `${room.players[seatIdx].displayName} 碰！`, "system");
    } else if (claim.type === "kong") {
      // Remove 3 matching tiles from hand, add meld, draw replacement
      const matching = hand.filter((t) => t.suit === tile.suit && t.rank === tile.rank);
      const toRemove = matching.slice(0, 3);
      for (const t of toRemove) {
        const idx = hand.findIndex((h) => h.id === t.id);
        if (idx !== -1) hand.splice(idx, 1);
      }
      melds.push([...toRemove, tile]);
      pushFeed(room, `${room.players[seatIdx].displayName} 槓！`, "system");

      // Draw replacement from dead wall
      if (room.round.deadWall.length > 0) {
        const replacement = room.round.deadWall.shift();
        if (isFlower(replacement)) {
          room.round.flowers[seatIdx].push(replacement);
          this._replaceFlowersFromDraw(room.round, seatIdx);
        } else {
          hand.push(replacement);
        }
      }
    } else if (claim.type === "chi") {
      // Remove matching tiles from hand based on sequence
      const seqTiles = claim.tiles.filter((t) => t.id !== tile.id);
      for (const st of seqTiles) {
        const idx = hand.findIndex((h) => h.id === st.id);
        if (idx !== -1) hand.splice(idx, 1);
      }
      melds.push(claim.tiles);
      pushFeed(room, `${room.players[seatIdx].displayName} 吃！`, "system");
    }

    // Claimant becomes current turn and must discard
    room.round.currentTurn = seatIdx;
    room.round.hasDrawn = true; // Can discard immediately
    this.scheduleTurn(room);
  }

  _advanceTurnAfterDiscard(room, discarderSeat) {
    room.round.currentTurn = (discarderSeat + 1) % MAX_PLAYERS;
    room.round.hasDrawn = false;
    this.scheduleTurn(room);
  }

  _replaceFlowersInHand(hand, flowerPile, wall, deadWall) {
    let i = 0;
    while (i < hand.length) {
      if (isFlower(hand[i])) {
        flowerPile.push(hand[i]);
        if (deadWall.length > 0) {
          const replacement = deadWall.shift();
          if (isFlower(replacement)) {
            flowerPile.push(replacement);
            // Need another replacement
            if (wall.length > 0) {
              hand[i] = wall.shift();
            } else {
              hand.splice(i, 1);
              continue;
            }
          } else {
            hand[i] = replacement;
          }
        } else if (wall.length > 0) {
          hand[i] = wall.shift();
        } else {
          hand.splice(i, 1);
          continue;
        }
      }
      i++;
    }
  }

  _replaceFlowersFromDraw(round, seatIdx) {
    const hand = round.hands[seatIdx];
    // We already pushed the flower to the flower pile in the caller
    // Now we need a replacement tile
    let replacement;
    if (round.deadWall.length > 0) {
      replacement = round.deadWall.shift();
    } else if (round.wall.length > 0) {
      replacement = round.wall.shift();
    } else {
      return; // No replacement available
    }

    if (isFlower(replacement)) {
      round.flowers[seatIdx].push(replacement);
      // Recurse for more replacements
      this._replaceFlowersFromDraw(round, seatIdx);
    } else {
      hand.push(replacement);
    }
  }

  finishRoundWin(room, winnerSeat, winTile, winMethod) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnEndsAt = null;
    room.turnDurationMs = null;

    if (room.round.pendingClaim?.timer) {
      clearTimeout(room.round.pendingClaim.timer);
    }
    room.round.pendingClaim = null;

    const hand = room.round.hands[winnerSeat];
    const melds = room.round.melds[winnerSeat];
    const flowers = room.round.flowers[winnerSeat];

    const fanResult = calculateFan(hand, melds, winTile, flowers, winMethod);

    room.round.stage = "finished";
    room.round.winner = winnerSeat;
    room.round.fanResult = fanResult;
    room.round.winMethod = winMethod;

    const winnerName = room.players[winnerSeat]?.displayName;
    const headline = `${winnerName} 胡牌！`;
    const fanDetail = fanResult.fans.map((f) => `${f.name}(${f.points}番)`).join("、");

    const settlements = buildStandardSettlements(room.players, {
      winnerSeatIndexes: [winnerSeat],
      loserPenalty: fanResult.totalPoints,
      winRank: 14 + fanResult.totalPoints,
      lossRank: -8
    });

    room.lastResult = {
      headline,
      detail: `番數：${fanDetail}，共 ${fanResult.totalPoints} 番`,
      fanResult,
      winnerSeat,
      winMethod,
      gameKey: "mahjong",
      deltas: settlements.map((entry) => ({
        seatIndex: entry.seatIndex,
        displayName: entry.displayName,
        delta: entry.delta,
        outcome: entry.outcome
      }))
    };

    applyUserSettlements(settlements).catch((err) => {
      console.error("Failed to apply mahjong settlements", err);
    });

    room.state = "waiting";
    room.round = null;
    room.players.forEach((p) => { p.ready = false; });

    pushFeed(room, headline, "success");
    this.maybeCloseCompletedRoom(room);
    this.emitRoom(room);
  }

  finishRoundDraw(room) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnEndsAt = null;
    room.turnDurationMs = null;

    if (room.round.pendingClaim?.timer) {
      clearTimeout(room.round.pendingClaim.timer);
    }
    room.round.pendingClaim = null;

    room.round.stage = "finished";
    room.round.winner = null;
    room.round.winMethod = "draw";

    const headline = "流局";
    const detail = "牌牆已摸完，無人胡牌";

    room.lastResult = {
      headline,
      detail,
      fanResult: null,
      winnerSeat: null,
      winMethod: "draw",
      gameKey: "mahjong",
      deltas: room.players.map((p, i) => ({
        seatIndex: i,
        displayName: p.displayName,
        delta: 0,
        outcome: "draw"
      }))
    };

    room.state = "waiting";
    room.round = null;
    room.players.forEach((p) => { p.ready = false; });

    pushFeed(room, headline, "system");
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

    if (!room.round.hasDrawn) {
      // Auto-draw
      if (room.round.wall.length > 0) {
        this.drawTile(room.roomNo, seat.userId);
      }
    }

    if (room.round.hasDrawn) {
      // Auto-discard first tile
      const hand = room.round.hands[seat.seatIndex];
      if (hand.length > 0) {
        const tile = hand[0];
        this.discardTile(room.roomNo, seat.userId, tile.id);
        pushFeed(room, `${seat.displayName} 超時，系統自動打牌`, "system");
      }
    }
  }

  registerSocket(roomNo, userId, socket) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) throw new Error("尚未加入房間");

    seat.socketIds.add(socket.id);
    this.markSeatConnected(room, seat);
    socket.join(`mahjong:${roomNo}`);
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
        this.io?.to(socketId).emit("mahjong:update", {
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

    const round = room.round
      ? {
          stage: room.round.stage,
          currentTurn: room.round.currentTurn,
          hasDrawn: room.round.hasDrawn,
          wallCount: room.round.wall?.length || 0,
          deadWallCount: room.round.deadWall?.length || 0,
          pendingClaim: room.round.pendingClaim
            ? {
                tile: room.round.pendingClaim.tile,
                expiresAt: room.round.pendingClaim.expiresAt,
                seatClaims: room.round.pendingClaim.claims.map((c) => ({
                  seatIndex: c.seatIndex,
                  userId: c.userId,
                  type: c.type,
                  priority: c.priority,
                  passed: c.passed
                }))
              }
            : null,
          winner: room.round.winner,
          fanResult: room.round.fanResult,
          winMethod: room.round.winMethod,
          turnEndsAt: room.round.turnEndsAt,
          turnDurationMs: room.round.turnDurationMs
        }
      : null;

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
        handCount: room.round ? room.round.hands[player.seatIndex]?.length || 0 : 0,
        melds: room.round ? room.round.melds[player.seatIndex] || [] : [],
        discards: room.round ? room.round.discards[player.seatIndex] || [] : [],
        flowers: room.round ? room.round.flowers[player.seatIndex] || [] : [],
        ...buildSeatRecoveryState({
          connected: player.connected,
          isBot: player.isBot,
          reconnectGraceEndsAt: player.reconnectGraceEndsAt
        })
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
            })
          }
        : null,
      hands: room.round && viewerSeat
        ? room.round.hands[viewerSeat.seatIndex]?.map((t) => ({ ...t })) || []
        : [],
      round
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

    if (room.round?.pendingClaim?.timer) {
      clearTimeout(room.round.pendingClaim.timer);
    }

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
    const meta = getGameMeta("mahjong") || {};
    const visibility = room.settings?.visibility === "private" ? "private" : "public";
    return {
      roomNo: room.roomNo,
      familyKey: "card",
      gameKey: "mahjong",
      title: room.title || meta.title || "麻將",
      strapline: room.strapline || meta.strapline || "",
      detailRoute: `/mahjong/${room.roomNo}`,
      joinRoute: `/api/mahjong/rooms/${room.roomNo}/join`,
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

function normalizeMahjongConfig(input = {}) {
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
  getMahjongRoomManager,
  MahjongRoomManager
};
