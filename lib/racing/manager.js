"use strict";

const {
  getGameMeta,
  getRacingDefaultConfig,
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
const CANNON = require("cannon-es");
const { createRacingWorld, createCarBody, createTrackBodies, applyCarInput, createLapDetector } = require("./physics");
const { TRACK_DEFINITION, TRACK_WIDTH, TRACK_LENGTH } = require("./track");
const { computeDelta, computeRaceOrder } = require("./delta");

const DEFAULT_RECONNECT_GRACE_MS = 15000;
const TICK_INTERVAL_MS = 50; // 20Hz
const COUNTDOWN_SECONDS = 3;

function getRacingRoomManager() {
  if (!global.racingRoomManager) {
    global.racingRoomManager = new RacingRoomManager();
  }
  return global.racingRoomManager;
}

class RacingRoomManager {
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
      (room) => room.ownerId === ownerId && room.state !== "archived"
    ).length;
  }

  createRoom(owner, overrides = {}) {
    const meta = getGameMeta("racing");
    const roomNo = allocateRoomNo();
    const config = normalizeRacingConfig(overrides);
    const room = {
      roomNo,
      ownerId: owner.id,
      familyKey: "light-3d",
      gameKey: "racing",
      title: meta.title,
      strapline: meta.strapline,
      createdAt: new Date().toISOString(),
      adminState: "live",
      state: "waiting",
      config,
      players: [this.createHumanSeat(owner, 0)],
      racePhase: "waiting",
      world: null,
      tick: 0,
      inputs: new Map(),
      laps: new Map(),
      carBodies: [],
      previousState: null,
      countdownTimer: null,
      countdownValue: 0,
      loopTimer: null,
      lastTickTime: 0,
      feed: [],
      lastResult: null
    };

    pushFeed(room, `${owner.displayName || owner.username} 创建了赛房间`, "system");
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
    this.maybeStartRace(room);
    return room;
  }

  submitInput(roomNo, userId, input) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("你不在该房间内");
    }

    if (room.racePhase !== "racing") {
      return;
    }

    // Validate and clamp input values (Rule 2: security)
    const accel = input.accel ? 1 : 0;
    const brake = input.brake ? 1 : 0;
    const steer = Math.max(-1, Math.min(1, Number(input.steer) || 0));

    room.inputs.set(seat.seatIndex, { accel, brake, steer });
  }

  maybeStartRace(room) {
    if (room.state !== "waiting") {
      return;
    }

    const limits = getGameLimits("racing");
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
    room.racePhase = "countdown";
    room.countdownValue = COUNTDOWN_SECONDS;

    pushFeed(room, "比赛即将开始!", "system");
    this.emitRoom(room);

    room.countdownTimer = setInterval(() => {
      room.countdownValue -= 1;

      if (room.countdownValue <= 0) {
        clearInterval(room.countdownTimer);
        room.countdownTimer = null;
        this.startRace(room);
      } else {
        this.emitRoom(room);
      }
    }, 1000);
  }

  startRace(room) {
    room.state = "playing";
    room.racePhase = "racing";
    room.lastResult = null;
    room.tick = 0;
    room.inputs = new Map();
    room.laps = new Map();
    room.previousState = null;

    // Create physics world
    room.world = createRacingWorld();
    const trackBodies = createTrackBodies(room.world, TRACK_DEFINITION);

    // Create car bodies for each player at spawn points
    room.carBodies = [];
    room.players.forEach((player, index) => {
      player.ready = false;
      const spawn = TRACK_DEFINITION.spawnPoints[index] || { x: 0, z: -40 };
      const carBody = createCarBody(index, spawn.x + (index % 2 === 0 ? -2 : 2), spawn.z);
      room.world.addBody(carBody);
      room.carBodies[index] = carBody;
      room.laps.set(index, { count: 0, lastCrossingTime: 0 });
    });

    // Set up lap detection
    this._lapCleanup = createLapDetector(trackBodies.triggerBody, room);

    pushFeed(room, "比赛开始!", "success");
    this.emitRoom(room);

    // Start 20Hz game loop with drift correction
    room.lastTickTime = Date.now();
    room.loopTimer = setInterval(() => this.gameTick(room), TICK_INTERVAL_MS);
  }

  gameTick(room) {
    if (room.racePhase !== "racing") {
      return;
    }

    room.tick += 1;

    // Apply inputs to car bodies
    for (const [seatIndex, input] of room.inputs) {
      const carBody = room.carBodies[seatIndex];
      if (carBody) {
        applyCarInput(carBody, input, 1 / 20, CANNON);
      }
    }

    // Step physics
    room.world.step(1 / 20);

    // Compute delta
    const delta = computeDelta(room, room.previousState);
    room.previousState = delta;

    // Broadcast delta to all sockets in room
    this.io?.to(getSocketRoom(room.roomNo)).emit(SOCKET_EVENTS.racing.update, delta);

    // Check winner
    for (const player of room.players) {
      const lapEntry = room.laps.get(player.seatIndex);
      if (lapEntry && lapEntry.count >= room.config.lapCount) {
        this.finishRace(room, player);
        return;
      }
    }
  }

  finishRace(room, winner) {
    // Stop game loop
    if (room.loopTimer) {
      clearInterval(room.loopTimer);
      room.loopTimer = null;
    }
    if (room.countdownTimer) {
      clearInterval(room.countdownTimer);
      room.countdownTimer = null;
    }

    // Clean up lap detector
    if (this._lapCleanup) {
      this._lapCleanup();
      this._lapCleanup = null;
    }

    room.racePhase = "finished";
    room.state = "waiting";

    // Build result
    const raceOrder = computeRaceOrder(room);
    room.lastResult = {
      winnerSeat: winner.seatIndex,
      headline: `${winner.displayName} 获胜!`,
      detail: `完成 ${room.config.lapCount} 圈`,
      raceOrder,
      gameKey: "racing"
    };

    // Apply settlements
    const settlements = buildStandardSettlements(room.players, {
      winnerSeatIndexes: [winner.seatIndex],
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
      console.error("Failed to apply racing settlements", error);
    });

    // Reset players
    room.players.forEach((player) => {
      player.ready = false;
    });

    // Clear physics
    room.world = null;
    room.carBodies = [];
    room.inputs = new Map();
    room.laps = new Map();
    room.previousState = null;

    pushFeed(room, room.lastResult.headline, "success");
    this.emitRoom(room);
    this.maybeCloseCompletedRoom(room);
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

  serializeRoomSummary(room) {
    return {
      roomNo: room.roomNo,
      gameKey: room.gameKey,
      title: room.title,
      strapline: room.strapline,
      state: room.state,
      racePhase: room.racePhase,
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

    // Build match state with current car positions
    let match = null;
    if (room.racePhase === "racing" || room.racePhase === "countdown") {
      const cars = room.carBodies.map((body, seatIndex) => ({
        seatIndex,
        pos: { x: body.position.x, y: body.position.y, z: body.position.z },
        rot: { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w },
        speed: Math.round(body.velocity.length() * 100) / 100,
        lap: room.laps.get(seatIndex)?.count || 0
      }));

      match = {
        tick: room.tick,
        phase: room.racePhase,
        countdown: room.countdownValue,
        cars,
        raceOrder: computeRaceOrder(room)
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
      racePhase: room.racePhase,
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
        this.io?.to(socketId).emit(SOCKET_EVENTS.racing.update, {
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
      socketIds: new Set()
    };
  }

  // Reconnect/expiry pattern from board manager
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
    if (this._lapCleanup) {
      this._lapCleanup();
      this._lapCleanup = null;
    }

    this.clearReconnectTimersForRoom(room.roomNo);
    this.clearRoomExpiryTimer(room.roomNo);
    room.world = null;
    room.carBodies = [];
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
    const meta = getGameMeta("racing") || {};
    const visibility = room.config?.visibility === "private" ? "private" : "public";

    return {
      roomNo: room.roomNo,
      familyKey: "light-3d",
      gameKey: "racing",
      title: room.title || meta.title || "racing",
      strapline: room.strapline || meta.strapline || "",
      detailRoute: `/racing/${room.roomNo}`,
      joinRoute: API_ROUTES.racingRooms.join(room.roomNo),
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

function normalizeRacingConfig(input = {}) {
  const defaults = getRacingDefaultConfig();
  const limits = getGameLimits("racing");

  return {
    visibility: input.visibility === "private" ? "private" : defaults.visibility,
    maxPlayers: Math.max(limits.minPlayers, Math.min(limits.maxPlayers, Number(input.maxPlayers) || defaults.maxPlayers)),
    lapCount: Math.max(1, Math.min(10, Number(input.lapCount) || defaults.lapCount))
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
  return `racing:${roomNo}`;
}

module.exports = {
  getRacingRoomManager
};
