"use strict";

const {
  getGameMeta,
  getFightingDefaultConfig,
  getGameLimits
} = require("../games/catalog");
const { getAvailabilityControlsSync } = require("../admin/control-plane");
const { applyUserSettlements, buildStandardSettlements } = require("../economy");
const {
  allocateRoomNo,
  registerRoomEntry,
  unregisterRoomEntry,
  updateRoomEntry
} = require("../rooms/directory");
const { buildAvailabilityEnvelope } = require("../shared/availability");
const { getRoomExpiryMs: resolveRoomExpiryMs } = require("../system-config");
const {
  API_ROUTES,
  SOCKET_EVENTS,
  buildSeatRecoveryState
} = require("../shared/network-contract");

const { createCharacter, updateCharacterState } = require("./character");
const { checkHitboxCollision, applyDamage } = require("./combat");
const { applyGravity, resolvePlatformCollision, checkRingOut } = require("./physics");
const { computeDelta } = require("./delta");
const { getDefaultArena } = require("./arena");
const { TICK_INTERVAL_MS, COUNTDOWN_SECONDS, MAX_HEALTH } = require("./constants");

const DEFAULT_RECONNECT_GRACE_MS = 15000;

function getFightingRoomManager() {
  if (!global.fightingRoomManager) {
    global.fightingRoomManager = new FightingRoomManager();
  }
  return global.fightingRoomManager;
}

class FightingRoomManager {
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
      .filter((room) => room.config.visibility !== "private")
      .map((room) => this.serializeRoomSummary(room));
  }

  countOpenRoomsByOwner(ownerId) {
    return [...this.rooms.values()].filter(
      (room) => room.ownerId === ownerId && room.adminState !== "archived"
    ).length;
  }

  createRoom(owner, overrides = {}) {
    const meta = getGameMeta("fighting");
    const roomNo = allocateRoomNo();
    const config = normalizeFightingConfig(overrides);
    const room = {
      roomNo,
      ownerId: owner.id,
      familyKey: "light-3d",
      gameKey: "fighting",
      title: meta.title,
      strapline: meta.strapline,
      createdAt: new Date().toISOString(),
      adminState: "live",
      state: "waiting",
      config,
      players: [this.createHumanSeat(owner, 0)],
      fightPhase: "waiting",
      characters: [],
      inputs: new Map(),
      roundWins: new Map(),
      currentRound: 1,
      arena: getDefaultArena(),
      tick: 0,
      previousState: null,
      countdownTimer: null,
      countdownValue: 0,
      loopTimer: null,
      lastTickTime: 0,
      feed: [],
      lastResult: null
    };

    pushFeed(room, `${owner.displayName || owner.username} 创建了房间`, "system");
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

    const limits = getGameLimits("fighting");
    if (room.players.length >= limits.maxPlayers) {
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
    this.maybeStartFight(room);
    return room;
  }

  submitInput(roomNo, userId, input) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("你不在该房间内");
    }

    if (room.fightPhase !== "fighting") {
      return;
    }

    // Validate and clamp input (boolean flags only)
    const validated = {
      left: Boolean(input.left),
      right: Boolean(input.right),
      up: Boolean(input.up),
      attack: Boolean(input.attack),
      heavy: Boolean(input.heavy),
      block: Boolean(input.block),
      dodge: Boolean(input.dodge),
    };

    // Determine requested state from input
    let requestedState = null;
    if (validated.up) {
      requestedState = "jump";
    } else if (validated.heavy) {
      requestedState = "attack_heavy";
    } else if (validated.attack) {
      requestedState = "attack_light";
    } else if (validated.block) {
      requestedState = "block";
    } else if (validated.dodge) {
      requestedState = "dodge";
    } else if (validated.left || validated.right) {
      requestedState = "walk";
    }

    room.inputs.set(seat.seatIndex, {
      ...validated,
      requestedState,
    });
  }

  // ── Game start flow ─────────────────────────────────────────────────────

  maybeStartFight(room) {
    if (room.state !== "waiting") {
      return;
    }

    const limits = getGameLimits("fighting");
    if (room.players.length < limits.minPlayers) {
      return;
    }

    if (!room.players.every((player) => player.ready)) {
      return;
    }

    this.startCountdown(room);
  }

  startCountdown(room) {
    room.state = "countdown";
    room.fightPhase = "countdown";
    room.countdownValue = COUNTDOWN_SECONDS;

    pushFeed(room, "对战即将开始!", "system");
    this.emitRoom(room);

    room.countdownTimer = setInterval(() => {
      room.countdownValue -= 1;

      if (room.countdownValue <= 0) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        this.startFight(room);
      } else {
        this.emitRoom(room);
      }
    }, 1000);
  }

  startFight(room) {
    room.state = "playing";
    room.fightPhase = "fighting";
    room.lastResult = null;
    room.tick = 0;
    room.inputs = new Map();
    room.previousState = null;

    // Create characters for each player at arena spawn points
    room.characters = [];
    const arena = room.arena;
    room.players.forEach((player, index) => {
      player.ready = false;
      const char = createCharacter(index, index === 0 ? "right" : "left");
      // Override spawn position with arena spawn points
      if (arena.spawnPoints[index]) {
        char.pos.x = arena.spawnPoints[index].x;
        char.pos.y = arena.spawnPoints[index].y;
      }
      // Restore round wins if mid-match
      char.roundWins = room.roundWins.get(index) || 0;
      room.characters[index] = char;
    });

    if (room.roundWins.size === 0) {
      for (let i = 0; i < room.players.length; i++) {
        room.roundWins.set(i, 0);
      }
    }

    pushFeed(room, `第 ${room.currentRound} 回合开始!`, "success");
    this.emitRoom(room);

    // Start 60Hz game loop
    room.lastTickTime = Date.now();
    room.loopTimer = setInterval(() => this.gameTick(room), TICK_INTERVAL_MS);
  }

  // ── 60Hz game loop ──────────────────────────────────────────────────────

  gameTick(room) {
    if (room.fightPhase !== "fighting") {
      return;
    }

    room.tick += 1;
    const dt = 1 / 60;

    // Step 1: Process inputs -> update character states
    for (let i = 0; i < room.characters.length; i++) {
      const input = room.inputs.get(i) || null;
      updateCharacterState(room.characters[i], input, dt);
    }

    // Step 2: Apply physics (gravity + platform collision)
    for (const char of room.characters) {
      applyGravity(char, dt);
      resolvePlatformCollision(char, room.arena);
    }

    // Step 3: Check hitbox/hurtbox collisions
    // Reset hitThisAttack at start of each tick (before collision checks)
    for (const char of room.characters) {
      char.hitThisAttack = false;
    }

    for (let i = 0; i < room.characters.length; i++) {
      for (let j = i + 1; j < room.characters.length; j++) {
        const charA = room.characters[i];
        const charB = room.characters[j];

        // A attacks B
        const hitAB = checkHitboxCollision(charA, charB);
        if (hitAB && !charB.invulnerable) {
          applyDamage(charB, hitAB, charA);
        }

        // B attacks A
        const hitBA = checkHitboxCollision(charB, charA);
        if (hitBA && !charA.invulnerable) {
          applyDamage(charA, hitBA, charB);
        }
      }
    }

    // Step 4: Check ring-out
    for (const char of room.characters) {
      if (checkRingOut(char, room.arena)) {
        char.state = "ring_out";
        char.frameCount = 0;
        const winnerSeat = char.seatIndex === 0 ? 1 : 0;
        this.handleRoundEnd(room, winnerSeat);
        return;
      }
    }

    // Step 5: Check KO
    for (const char of room.characters) {
      if (char.health <= 0) {
        char.state = "ko";
        char.frameCount = 0;
        const winnerSeat = char.seatIndex === 0 ? 1 : 0;
        this.handleRoundEnd(room, winnerSeat);
        return;
      }
    }

    // Step 6: Compute delta and broadcast
    const delta = computeDelta(room, room.previousState);
    room.previousState = delta;
    this.io?.to(getSocketRoom(room.roomNo)).emit(SOCKET_EVENTS.fighting.update, delta);
  }

  // ── Round management ────────────────────────────────────────────────────

  handleRoundEnd(room, winnerSeatIndex) {
    // Stop game loop
    if (room.loopTimer) {
      clearInterval(room.loopTimer);
      room.loopTimer = null;
    }

    // Increment round wins
    const currentWins = room.roundWins.get(winnerSeatIndex) || 0;
    room.roundWins.set(winnerSeatIndex, currentWins + 1);

    const winnerChar = room.characters[winnerSeatIndex];
    winnerChar.roundWins = room.roundWins.get(winnerSeatIndex);

    room.fightPhase = "round_end";

    const winsNeeded = Math.floor(room.config.roundCount / 2) + 1;
    const winnerPlayer = room.players[winnerSeatIndex];

    pushFeed(room, `${winnerPlayer.displayName} 赢得第 ${room.currentRound} 回合!`, "success");
    this.emitRoom(room);

    // Check match win
    if (room.roundWins.get(winnerSeatIndex) >= winsNeeded) {
      room.fightPhase = "match_end";
      this.finishMatch(room, winnerSeatIndex);
      return;
    }

    // Start next round after 3-second delay
    room.fightPhase = "next_round";
    setTimeout(() => {
      room.currentRound += 1;
      this.startFight(room);
    }, 3000);
  }

  finishMatch(room, winnerSeatIndex) {
    const winnerPlayer = room.players[winnerSeatIndex];

    // Build result
    room.lastResult = {
      winnerSeat: winnerSeatIndex,
      headline: `${winnerPlayer.displayName} 获胜!`,
      detail: `${room.config.roundCount} 回合制，比分 ${room.roundWins.get(0)}:${room.roundWins.get(1)}`,
      roundWins: [room.roundWins.get(0), room.roundWins.get(1)],
      gameKey: "fighting"
    };

    // Apply settlements
    const settlements = buildStandardSettlements(room.players, {
      winnerSeatIndexes: [winnerSeatIndex],
      loserPenalty: 30,
      winRank: 12,
      lossRank: -6
    });

    room.lastResult.deltas = settlements.map((entry) => ({
      seatIndex: entry.seatIndex,
      displayName: entry.displayName,
      delta: entry.delta,
      outcome: entry.outcome
    }));

    applyUserSettlements(settlements).catch((error) => {
      console.error("Failed to apply fighting settlements", error);
    });

    // Reset players
    room.players.forEach((player) => {
      player.ready = false;
    });

    // Reset room state
    room.state = "waiting";
    room.fightPhase = "waiting";
    room.characters = [];
    room.inputs = new Map();
    room.roundWins = new Map();
    room.currentRound = 1;
    room.previousState = null;

    pushFeed(room, room.lastResult.headline, "success");
    this.emitRoom(room);
    this.maybeCloseCompletedRoom(room);
  }

  // ── Socket management ───────────────────────────────────────────────────

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

  // ── Serialization ───────────────────────────────────────────────────────

  serializeRoomSummary(room) {
    return {
      roomNo: room.roomNo,
      gameKey: room.gameKey,
      title: room.title,
      strapline: room.strapline,
      state: room.state,
      fightPhase: room.fightPhase,
      config: room.config,
      playerCount: room.players.length,
      createdAt: room.createdAt
    };
  }

  serializeRoom(room, viewerUserId = null) {
    const viewerSeat = room.players.find((player) => player.userId === viewerUserId) || null;
    const availability = this.getAdminAvailability(room);
    const degradedState = buildAvailabilityEnvelope({
      controls: getAvailabilityControlsSync(),
      familyKey: "light-3d",
      roomAvailability: availability,
      supportsVoice: false
    });

    // Build match state with current character positions when fighting
    let match = null;
    if (room.fightPhase === "fighting" || room.fightPhase === "countdown" || room.fightPhase === "round_end") {
      const characters = room.characters.map((char) => ({
        seatIndex: char.seatIndex,
        state: char.state,
        frameCount: char.frameCount,
        pos: { x: Math.round(char.pos.x * 10) / 10, y: Math.round(char.pos.y * 10) / 10 },
        velocity: { x: Math.round(char.velocity.x * 10) / 10, y: Math.round(char.velocity.y * 10) / 10 },
        facing: char.facing,
        health: char.health,
        energy: char.energy,
        grounded: char.grounded,
        invulnerable: char.invulnerable,
        roundWins: char.roundWins,
      }));

      match = {
        tick: room.tick,
        phase: room.fightPhase,
        countdown: room.countdownValue,
        currentRound: room.currentRound,
        roundCount: room.config.roundCount,
        characters,
        roundWins: [room.roundWins.get(0) || 0, room.roundWins.get(1) || 0],
      };
    }

    return {
      roomNo: room.roomNo,
      availability,
      degradedState,
      ownerId: room.ownerId,
      title: room.title,
      strapline: room.strapline,
      gameKey: room.gameKey,
      state: room.state,
      fightPhase: room.fightPhase,
      config: room.config,
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
      match
    };
  }

  emitRoom(room) {
    this.syncRoomDirectory(room);

    for (const player of room.players) {
      for (const socketId of player.socketIds) {
        this.io?.to(socketId).emit(SOCKET_EVENTS.fighting.update, {
          room: this.serializeRoom(room, player.userId)
        });
      }
    }
  }

  // ── Seat helpers ────────────────────────────────────────────────────────

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

  // ── Reconnect / expiry pattern (adapted from RacingRoomManager) ─────────

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

    // Clean up game loop
    if (room.loopTimer) {
      clearInterval(room.loopTimer);
      room.loopTimer = null;
    }
    if (room.countdownTimer) {
      clearInterval(room.countdownTimer);
      room.countdownTimer = null;
    }

    this.clearReconnectTimersForRoom(room.roomNo);
    this.clearRoomExpiryTimer(room.roomNo);
    room.characters = [];
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
    const meta = getGameMeta("fighting") || {};
    const visibility = room.config?.visibility === "private" ? "private" : "public";

    return {
      roomNo: room.roomNo,
      familyKey: "light-3d",
      gameKey: "fighting",
      title: room.title || meta.title || "fighting",
      strapline: room.strapline || meta.strapline || "",
      detailRoute: `/fighting/${room.roomNo}`,
      joinRoute: API_ROUTES.fightingRooms.join(room.roomNo),
      visibility,
      ownerId: room.ownerId,
      state: room.state,
      supportsShareLink: Boolean(meta.supportsShareLink),
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

  assertRoom(roomNo) {
    const room = this.rooms.get(roomNo);
    if (!room) {
      throw new Error("房间不存在");
    }
    return room;
  }

  findSeat(room, userId) {
    return room.players.find((player) => player.userId === userId);
  }
}

function normalizeFightingConfig(input = {}) {
  const defaults = getFightingDefaultConfig();

  return {
    visibility: input.visibility === "private" ? "private" : defaults.visibility,
    maxPlayers: 2,
    roundCount: Math.max(1, Math.min(9, Number(input.roundCount) || defaults.roundCount))
  };
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

function getSocketRoom(roomNo) {
  return `fighting:${roomNo}`;
}

module.exports = {
  getFightingRoomManager
};
