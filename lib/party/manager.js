const {
  PARTY_GAME_KEYS,
  getGameMeta,
  getPartyDefaultConfig,
  getGameLimits
} = require("../games/catalog");
const { applyUserSettlements, buildStandardSettlements } = require("../economy");
const { SOCKET_EVENTS } = require("../shared/network-contract");

const WEREWOLF_ROLE_LABELS = {
  werewolf: "狼人",
  seer: "预言家",
  witch: "女巫",
  guard: "守卫",
  hunter: "猎人",
  villager: "村民"
};

const AVALON_ROLE_LABELS = {
  merlin: "梅林",
  percival: "派西维尔",
  loyal: "忠臣",
  assassin: "刺客",
  minion: "爪牙",
  morgana: "莫甘娜",
  mordred: "莫德雷德",
  oberon: "奥伯伦"
};

const WEREWOLF_BOT_NAMES = [
  "霜牙",
  "夜鸦",
  "灰烬",
  "月棘",
  "寒枝",
  "雾刃",
  "暮猎",
  "狼焰"
];

const AVALON_BOT_NAMES = [
  "银槲",
  "晨枪",
  "雾冠",
  "圣焰",
  "夜纹",
  "湖誓",
  "曜盾",
  "霜旗"
];

function getPartyRoomManager() {
  if (!global.partyRoomManager) {
    global.partyRoomManager = new PartyRoomManager();
  }

  return global.partyRoomManager;
}

class PartyRoomManager {
  constructor() {
    this.rooms = new Map();
    this.io = null;
  }

  attachIo(io) {
    this.io = io;
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
    if (!PARTY_GAME_KEYS.includes(gameKey)) {
      throw new Error("不支持的派对游戏");
    }

    const meta = getGameMeta(gameKey);
    const roomNo = generateRoomNo(this.rooms);
    const config = normalizePartyConfig(gameKey, overrides);
    const room = {
      roomNo,
      ownerId: owner.id,
      gameKey,
      title: meta.title,
      strapline: meta.strapline,
      createdAt: new Date().toISOString(),
      state: "waiting",
      config,
      phaseTimer: null,
      botTimers: [],
      phaseEndsAt: null,
      phaseDurationMs: null,
      feed: [],
      lastResult: null,
      players: [this.createHumanSeat(owner, 0)],
      round: null
    };

    pushFeed(room, `${owner.displayName || owner.username} 创建了 ${meta.title} 房间`, "system");
    this.rooms.set(roomNo, room);
    return room;
  }

  getRoom(roomNo) {
    return this.rooms.get(roomNo);
  }

  joinRoom(roomNo, user) {
    const room = this.rooms.get(roomNo);
    if (!room) {
      throw new Error("房间不存在");
    }

    const existingSeat = room.players.find(
      (player) => player.userId === user.id && !player.isBot
    );
    if (existingSeat) {
      existingSeat.displayName = user.displayName || user.username;
      existingSeat.connected = true;
      return room;
    }

    if (room.players.length >= room.config.maxPlayers) {
      throw new Error("房间人数已满");
    }

    room.players.push(this.createHumanSeat(user, room.players.length));
    pushFeed(room, `${user.displayName || user.username} 加入房间`, "join");
    this.emitRoom(room);
    return room;
  }

  setReady(roomNo, userId, ready = true) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("你不在该房间内");
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
    for (let step = 0; step < totalToAdd; step += 1) {
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
    seat.connected = true;
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
        if (seat.socketIds.size > 0) {
          continue;
        }

        seat.connected = false;
        if (seat.voiceConnected) {
          seat.voiceConnected = false;
          this.io?.to(getSocketRoom(room.roomNo)).emit(SOCKET_EVENTS.party.voiceUserLeft, {
            roomNo: room.roomNo,
            userId: seat.userId
          });
        }

        this.emitRoom(room);
        this.maybeCloseCompletedRoom(room);
        return;
      }
    }
  }

  voiceJoin(roomNo, userId, muted = false) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("不在房间内");
    }

    const alreadyJoined = seat.voiceConnected;
    seat.voiceConnected = true;
    seat.voiceMuted = Boolean(muted);

    const peers = room.players
      .filter((player) => player.userId !== userId && player.voiceConnected)
      .map((player) => ({
        userId: player.userId,
        displayName: player.displayName,
        muted: player.voiceMuted
      }));

    for (const socketId of seat.socketIds) {
      this.io?.to(socketId).emit(SOCKET_EVENTS.party.voicePeers, {
        roomNo,
        peers
      });
    }

    if (!alreadyJoined) {
      this.io?.to(getSocketRoom(roomNo)).emit(SOCKET_EVENTS.party.voiceUserJoined, {
        roomNo,
        userId: seat.userId,
        displayName: seat.displayName,
        muted: seat.voiceMuted
      });
    }

    this.emitRoom(room);
  }

  voiceLeave(roomNo, userId) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("不在房间内");
    }

    if (!seat.voiceConnected) {
      return room;
    }

    seat.voiceConnected = false;
    this.io?.to(getSocketRoom(roomNo)).emit(SOCKET_EVENTS.party.voiceUserLeft, {
      roomNo,
      userId: seat.userId
    });
    this.emitRoom(room);
    return room;
  }

  updateVoiceState(roomNo, userId, muted) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("不在房间内");
    }

    seat.voiceMuted = Boolean(muted);
    this.io?.to(getSocketRoom(roomNo)).emit(SOCKET_EVENTS.voice.state, {
      roomNo,
      userId: seat.userId,
      muted: seat.voiceMuted
    });
    this.emitRoom(room);
    return room;
  }

  relayVoiceSignal(roomNo, userId, targetUserId, data) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    const targetSeat = this.findSeat(room, targetUserId);
    if (!seat || !targetSeat) {
      throw new Error("语音对象不存在");
    }

    for (const socketId of targetSeat.socketIds) {
      this.io?.to(socketId).emit(SOCKET_EVENTS.voice.signal, {
        roomNo,
        fromUserId: userId,
        data
      });
    }
  }

  sendRoomMessage(roomNo, userId, text) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("不在房间内");
    }

    const message = String(text || "").trim().slice(0, 36);
    if (!message) {
      throw new Error("消息不能为空");
    }

    pushFeed(room, `${seat.displayName}: ${message}`, "chat");
    this.emitRoom(room);
    return room;
  }

  submitAction(roomNo, userId, payload = {}) {
    const room = this.assertRoom(roomNo);
    const seat = this.findSeat(room, userId);
    if (!seat) {
      throw new Error("不在房间内");
    }

    if (!room.round || room.state !== "playing") {
      throw new Error("当前没有进行中的对局");
    }

    if (room.gameKey === "werewolf") {
      this.handleWerewolfAction(room, seat, payload);
    } else if (room.gameKey === "avalon") {
      this.handleAvalonAction(room, seat, payload);
    } else {
      throw new Error("未知的游戏类型");
    }

    if (room.state === "playing" && room.round) {
      this.scheduleBotThinking(room);
    }
    this.emitRoom(room);
    return room;
  }

  maybeStartRoom(room) {
    if (room.state !== "waiting") {
      return;
    }

    const limits = getGameLimits(room.gameKey);
    if (room.players.length < limits.minPlayers) {
      return;
    }

    if (!room.players.every((player) => player.ready)) {
      return;
    }

    if (room.gameKey === "werewolf") {
      this.startWerewolf(room);
      return;
    }

    if (room.gameKey === "avalon") {
      this.startAvalon(room);
    }
  }

  startWerewolf(room) {
    const roles = shuffle(buildWerewolfRoles(room.players.length));
    room.state = "playing";
    room.lastResult = null;

    room.players.forEach((player, index) => {
      player.ready = false;
      player.alive = true;
      player.role = roles[index];
      player.side = roles[index] === "werewolf" ? "evil" : "good";
      player.healUsed = false;
      player.poisonUsed = false;
      player.lastGuardTarget = null;
      player.hunterUsed = false;
      player.inspectedSeats = [];
    });

    room.round = {
      stage: "night",
      nightNo: 1,
      dayNo: 1,
      night: createWerewolfNightState(room),
      votes: {},
      eliminatedSeat: null,
      revealDeadRoles: true,
      pendingHunterSeat: null,
      hunterTargetSeat: null,
      resumeStageAfterHunter: null
    };

    pushFeed(room, "月色落下，第一夜开始。", "system");
    this.schedulePhase(room, room.config.nightSeconds);
  }

  startAvalon(room) {
    const roles = shuffle(buildAvalonRoles(room.players.length));
    room.state = "playing";
    room.lastResult = null;

    room.players.forEach((player, index) => {
      player.ready = false;
      player.alive = true;
      player.role = roles[index];
      player.side = getAvalonSide(roles[index]);
      player.inspectedSeats = [];
    });

    room.round = {
      stage: "team-building",
      roundNo: 1,
      leaderSeat: 0,
      selectedTeam: [],
      teamVotes: {},
      questVotes: {},
      rejectTrack: 0,
      questResults: []
    };

    pushFeed(room, "圆桌集结，队长开始组建第一次任务小队。", "system");
    this.schedulePhase(room, room.config.teamBuildSeconds);
  }

  schedulePhase(room, seconds) {
    clearTimeout(room.phaseTimer);
    this.clearBotTimers(room);
    const durationMs = Math.max(1, Number(seconds || 1)) * 1000;
    room.phaseDurationMs = durationMs;
    room.phaseEndsAt = Date.now() + durationMs;

    room.phaseTimer = setTimeout(() => {
      if (!room.round || room.state !== "playing") {
        return;
      }

      if (room.gameKey === "werewolf") {
        this.advanceWerewolfPhase(room, true);
      } else if (room.gameKey === "avalon") {
        this.advanceAvalonPhase(room, true);
      }
      this.emitRoom(room);
    }, durationMs);

    this.scheduleBotThinking(room);
    this.emitRoom(room);
  }

  advanceWerewolfPhase(room, fromTimeout = false) {
    const { stage } = room.round;

    if (stage === "night") {
      this.resolveWerewolfNight(room, fromTimeout);
      return;
    }

    if (stage === "discussion") {
      room.round.stage = "vote";
      room.round.votes = {};
      pushFeed(room, "讨论结束，开始公开投票。", "system");
      this.schedulePhase(room, room.config.voteSeconds);
      return;
    }

    if (stage === "vote") {
      this.resolveWerewolfVote(room, fromTimeout);
      return;
    }

    if (stage === "hunter-shot") {
      this.resolveWerewolfHunterShot(room, null, fromTimeout);
    }
  }

  advanceAvalonPhase(room, fromTimeout = false) {
    const { stage } = room.round;
    if (stage === "team-building") {
      if (room.round.selectedTeam.length !== getAvalonTeamSize(room)) {
        room.round.selectedTeam = autoSelectAvalonTeam(room);
      }
      room.round.stage = "team-vote";
      room.round.teamVotes = {};
      pushFeed(room, "队长已提交队伍，所有人开始表决。", "system");
      this.schedulePhase(room, room.config.voteSeconds);
      return;
    }

    if (stage === "team-vote") {
      this.resolveAvalonTeamVote(room, fromTimeout);
      return;
    }

    if (stage === "quest") {
      this.resolveAvalonQuest(room, fromTimeout);
      return;
    }

    if (stage === "assassination") {
      this.resolveAvalonAssassination(room, null, fromTimeout);
    }
  }

  handleWerewolfAction(room, seat, payload) {
    const type = payload.type;
    const round = room.round;

    if (!seat.alive && !(round.stage === "hunter-shot" && round.pendingHunterSeat === seat.seatIndex)) {
      throw new Error("你已出局");
    }

    if (round.stage === "night") {
      if (type === "wolf-target") {
        if (seat.role !== "werewolf") {
          throw new Error("只有狼人可刀人");
        }

        const targetSeat = Number(payload.targetSeat);
        const targetPlayer = room.players[targetSeat];
        if (!targetPlayer?.alive || targetPlayer.side === "evil") {
          throw new Error("目标不可选");
        }

        round.night.wolfVotes[seat.seatIndex] = targetSeat;
        this.maybeResolveWerewolfNight(room);
        return;
      }

      if (type === "guard-protect") {
        if (seat.role !== "guard") {
          throw new Error("只有守卫可守护");
        }

        const targetSeat = Number(payload.targetSeat);
        const targetPlayer = room.players[targetSeat];
        if (!targetPlayer?.alive) {
          throw new Error("守护目标不可选");
        }

        if (seat.lastGuardTarget === targetSeat) {
          throw new Error("守卫不能连续两晚守同一人");
        }

        round.night.guardProtectSeat = targetSeat;
        this.maybeResolveWerewolfNight(room);
        return;
      }

      if (type === "seer-inspect") {
        if (seat.role !== "seer") {
          throw new Error("只有预言家可查验");
        }

        if (round.night.seerSeat !== seat.seatIndex) {
          throw new Error("本夜已完成查验");
        }

        const targetSeat = Number(payload.targetSeat);
        const targetPlayer = room.players[targetSeat];
        if (!targetPlayer?.alive || targetSeat === seat.seatIndex) {
          throw new Error("查验目标不可选");
        }

        round.night.seerInspectSeat = targetSeat;
        round.night.seerResult = {
          seatIndex: targetSeat,
          displayName: targetPlayer.displayName,
          side: targetPlayer.side
        };
        this.maybeResolveWerewolfNight(room);
        return;
      }

      if (type === "witch-plan") {
        if (seat.role !== "witch") {
          throw new Error("只有女巫可用药");
        }

        const save = Boolean(payload.saveTarget);
        const poisonSeat =
          payload.poisonSeat === null || payload.poisonSeat === undefined
            ? null
            : Number(payload.poisonSeat);

        if (save && round.night.witch.healUsed) {
          throw new Error("解药已经用过");
        }

        if (save && round.night.witch.incomingVictimSeat === null) {
          throw new Error("本夜没有可救目标");
        }

        if (poisonSeat !== null) {
          if (round.night.witch.poisonUsed) {
            throw new Error("毒药已经用过");
          }
          const targetPlayer = room.players[poisonSeat];
          if (!targetPlayer?.alive || poisonSeat === seat.seatIndex) {
            throw new Error("毒杀目标不可选");
          }
        }

        round.night.witch.plan = {
          saveTarget: save,
          poisonSeat
        };
        round.night.witch.committed = true;
        this.maybeResolveWerewolfNight(room);
        return;
      }
    }

    if (round.stage === "vote" && type === "day-vote") {
      const targetSeat = Number(payload.targetSeat);
      const targetPlayer = room.players[targetSeat];
      if (!targetPlayer?.alive || targetSeat === seat.seatIndex) {
        throw new Error("投票目标不可选");
      }

      round.votes[seat.seatIndex] = targetSeat;
      this.maybeResolveWerewolfVote(room);
      return;
    }

    if (round.stage === "hunter-shot" && type === "hunter-shot") {
      if (seat.role !== "hunter" || round.pendingHunterSeat !== seat.seatIndex) {
        throw new Error("当前只有猎人可以开枪");
      }

      const targetSeat = Number(payload.targetSeat);
      const targetPlayer = room.players[targetSeat];
      if (!targetPlayer?.alive || targetSeat === seat.seatIndex) {
        throw new Error("猎枪目标不可选");
      }

      this.resolveWerewolfHunterShot(room, targetSeat, false);
      return;
    }

    throw new Error("当前阶段不支持该操作");
  }

  maybeResolveWerewolfNight(room) {
    const round = room.round;
    const livingWolves = room.players.filter(
      (player) => player.alive && player.role === "werewolf"
    );
    const livingSeer = room.players.find(
      (player) => player.alive && player.role === "seer"
    );
    const livingGuard = room.players.find(
      (player) => player.alive && player.role === "guard"
    );
    const livingWitch = room.players.find(
      (player) => player.alive && player.role === "witch"
    );

    const wolvesReady =
      livingWolves.length === 0 ||
      livingWolves.every((player) => round.night.wolfVotes[player.seatIndex] !== undefined);
    round.night.witch.incomingVictimSeat = tallyVotes(round.night.wolfVotes);
    const seerReady =
      !livingSeer || round.night.seerInspectSeat !== null;
    const guardReady =
      !livingGuard || round.night.guardProtectSeat !== null;
    const witchReady =
      !livingWitch || round.night.witch.committed;

    if (wolvesReady && seerReady && guardReady && witchReady) {
      this.resolveWerewolfNight(room, false);
    } else {
      this.emitRoom(room);
    }
  }

  resolveWerewolfNight(room, fromTimeout) {
    const round = room.round;
    const wolfTargetSeat = tallyVotes(round.night.wolfVotes);
    round.night.witch.incomingVictimSeat = wolfTargetSeat;
    const guardSeat = room.players.find((player) => player.alive && player.role === "guard");
    const protectedSeat = round.night.guardProtectSeat;
    if (guardSeat) {
      guardSeat.lastGuardTarget = protectedSeat;
    }

    const deaths = [];
    const shouldSave =
      round.night.witch.plan.saveTarget &&
      round.night.witch.incomingVictimSeat !== null &&
      !round.night.witch.healUsed;

    const guardedFromWolf =
      wolfTargetSeat !== null &&
      protectedSeat !== null &&
      protectedSeat === wolfTargetSeat &&
      !shouldSave;

    if (wolfTargetSeat !== null && !shouldSave && !guardedFromWolf) {
      deaths.push(wolfTargetSeat);
    }

    if (
      round.night.witch.plan.poisonSeat !== null &&
      !round.night.witch.poisonUsed
    ) {
      deaths.push(round.night.witch.plan.poisonSeat);
    }

    if (shouldSave) {
      round.night.witch.healUsed = true;
    }

    if (round.night.witch.plan.poisonSeat !== null) {
      round.night.witch.poisonUsed = true;
    }

    const witchSeat = room.players.find((player) => player.role === "witch");
    if (witchSeat) {
      witchSeat.healUsed = round.night.witch.healUsed;
      witchSeat.poisonUsed = round.night.witch.poisonUsed;
    }

    const uniqueDeaths = [...new Set(deaths)].filter(
      (seatIndex) => room.players[seatIndex]?.alive
    );
    uniqueDeaths.forEach((seatIndex) => {
      room.players[seatIndex].alive = false;
    });

    if (uniqueDeaths.length === 0) {
      pushFeed(
        room,
        `${fromTimeout ? "夜晚倒计时结束，" : ""}天亮了，昨夜是平安夜。`,
        "system"
      );
    } else {
      pushFeed(
        room,
        `天亮了，${uniqueDeaths
          .map((seatIndex) => room.players[seatIndex].displayName)
          .join("、")} 出局。`,
        "danger"
      );
    }

    const pendingHunterSeat = uniqueDeaths.find(
      (seatIndex) =>
        room.players[seatIndex]?.role === "hunter" && !room.players[seatIndex]?.hunterUsed
    );
    if (typeof pendingHunterSeat === "number") {
      this.enterWerewolfHunterStage(room, pendingHunterSeat, "discussion");
      return;
    }

    const winner = getWerewolfWinner(room);
    if (winner) {
      this.finishPartyGame(room, {
        winnerSide: winner,
        headline: winner === "evil" ? "狼人阵营获胜" : "好人阵营获胜"
      });
      return;
    }

    this.enterWerewolfDiscussion(room);
  }

  maybeResolveWerewolfVote(room) {
    const livingSeats = room.players.filter((player) => player.alive);
    const allSubmitted = livingSeats.every(
      (player) => room.round.votes[player.seatIndex] !== undefined
    );
    if (allSubmitted) {
      this.resolveWerewolfVote(room, false);
    } else {
      this.emitRoom(room);
    }
  }

  resolveWerewolfVote(room) {
    const voteTarget = tallyVotes(room.round.votes, true);
    const targetSeat = voteTarget.tie ? null : voteTarget.targetSeat;

    if (typeof targetSeat === "number" && room.players[targetSeat]?.alive) {
      room.players[targetSeat].alive = false;
      pushFeed(room, `${room.players[targetSeat].displayName} 被票出局。`, "danger");

      if (room.players[targetSeat].role === "hunter" && !room.players[targetSeat].hunterUsed) {
        this.enterWerewolfHunterStage(room, targetSeat, "night");
        return;
      }
    } else {
      pushFeed(room, "票型打平，本轮没有玩家出局。", "system");
    }

    const winner = getWerewolfWinner(room);
    if (winner) {
      this.finishPartyGame(room, {
        winnerSide: winner,
        headline: winner === "evil" ? "狼人阵营获胜" : "好人阵营获胜"
      });
      return;
    }

    this.enterWerewolfNight(room);
  }

  resolveWerewolfHunterShot(room, targetSeat, fromTimeout) {
    const hunterSeat = room.players[room.round.pendingHunterSeat];
    const candidates = room.players.filter(
      (player) => player.alive && player.seatIndex !== room.round.pendingHunterSeat
    );
    const fallbackTarget = pickRandom(candidates)?.seatIndex ?? null;
    const finalTarget =
      typeof targetSeat === "number" &&
      room.players[targetSeat]?.alive &&
      targetSeat !== room.round.pendingHunterSeat
        ? targetSeat
        : fallbackTarget;

    hunterSeat.hunterUsed = true;
    room.round.hunterTargetSeat = finalTarget;

    if (typeof finalTarget === "number") {
      room.players[finalTarget].alive = false;
      pushFeed(
        room,
        `${fromTimeout ? "猎枪超时，" : ""}${hunterSeat.displayName} 开枪带走了 ${
          room.players[finalTarget].displayName
        }。`,
        "danger"
      );
    } else {
      pushFeed(room, `${hunterSeat.displayName} 没有带走任何人。`, "system");
    }

    room.round.pendingHunterSeat = null;
    room.round.hunterTargetSeat = null;

    const winner = getWerewolfWinner(room);
    if (winner) {
      this.finishPartyGame(room, {
        winnerSide: winner,
        headline: winner === "evil" ? "狼人阵营获胜" : "好人阵营获胜"
      });
      return;
    }

    if (room.round.resumeStageAfterHunter === "discussion") {
      room.round.resumeStageAfterHunter = null;
      this.enterWerewolfDiscussion(room);
      return;
    }

    room.round.resumeStageAfterHunter = null;
    this.enterWerewolfNight(room);
  }

  enterWerewolfDiscussion(room) {
    room.round.stage = "discussion";
    room.round.votes = {};
    room.round.night = createWerewolfNightState(room);
    pushFeed(room, "进入白天讨论阶段，打开语音开始发言。", "system");
    this.schedulePhase(room, room.config.discussionSeconds);
  }

  enterWerewolfNight(room) {
    room.round.stage = "night";
    room.round.votes = {};
    room.round.nightNo += 1;
    room.round.dayNo += 1;
    room.round.night = createWerewolfNightState(room);
    pushFeed(room, "夜幕再临，开始下一夜行动。", "system");
    this.schedulePhase(room, room.config.nightSeconds);
  }

  enterWerewolfHunterStage(room, hunterSeat, resumeStageAfterHunter) {
    room.round.stage = "hunter-shot";
    room.round.pendingHunterSeat = hunterSeat;
    room.round.resumeStageAfterHunter = resumeStageAfterHunter;
    room.round.hunterTargetSeat = null;
    pushFeed(room, `${room.players[hunterSeat].displayName} 身份翻开，猎枪时间开始。`, "system");
    this.schedulePhase(room, room.config.hunterSeconds || 20);
  }

  handleAvalonAction(room, seat, payload) {
    const type = payload.type;
    const round = room.round;

    if (round.stage === "team-building") {
      if (seat.seatIndex !== round.leaderSeat) {
        throw new Error("只有当前队长可选人");
      }

      if (type === "select-team") {
        const targetSeat = Number(payload.targetSeat);
        const alreadySelected = round.selectedTeam.includes(targetSeat);
        if (alreadySelected) {
          round.selectedTeam = round.selectedTeam.filter((item) => item !== targetSeat);
        } else {
          if (round.selectedTeam.length >= getAvalonTeamSize(room)) {
            throw new Error("队伍人数已满");
          }
          round.selectedTeam = [...round.selectedTeam, targetSeat].sort((a, b) => a - b);
        }
        return;
      }

      if (type === "confirm-team") {
        if (round.selectedTeam.length !== getAvalonTeamSize(room)) {
          throw new Error("队伍人数尚未选满");
        }

        round.stage = "team-vote";
        round.teamVotes = {};
        pushFeed(
          room,
          `${seat.displayName} 提交了任务小队：${round.selectedTeam
            .map((seatIndex) => room.players[seatIndex].displayName)
            .join("、")}`,
          "system"
        );
        this.schedulePhase(room, room.config.voteSeconds);
        return;
      }
    }

    if (round.stage === "team-vote" && type === "team-vote") {
      if (round.teamVotes[seat.seatIndex]) {
        throw new Error("你已经投过票");
      }

      if (!["approve", "reject"].includes(payload.value)) {
        throw new Error("表决值非法");
      }

      round.teamVotes[seat.seatIndex] = payload.value;
      const submittedCount = Object.keys(round.teamVotes).length;
      if (submittedCount === room.players.length) {
        this.resolveAvalonTeamVote(room, false);
      }
      return;
    }

    if (round.stage === "quest" && type === "quest-vote") {
      if (!round.selectedTeam.includes(seat.seatIndex)) {
        throw new Error("只有任务成员可投任务牌");
      }

      if (round.questVotes[seat.seatIndex]) {
        throw new Error("你已经提交任务牌");
      }

      const value = payload.value;
      if (!["success", "fail"].includes(value)) {
        throw new Error("任务牌无效");
      }

      if (seat.side === "good" && value !== "success") {
        throw new Error("好人不能出失败牌");
      }

      round.questVotes[seat.seatIndex] = value;
      if (Object.keys(round.questVotes).length === round.selectedTeam.length) {
        this.resolveAvalonQuest(room, false);
      }
      return;
    }

    if (round.stage === "assassination" && type === "assassin-pick") {
      if (seat.role !== "assassin") {
        throw new Error("只有刺客可执行刺杀");
      }

      this.resolveAvalonAssassination(room, Number(payload.targetSeat), false);
      return;
    }

    throw new Error("当前阶段不支持该操作");
  }

  resolveAvalonTeamVote(room, fromTimeout) {
    const totalPlayers = room.players.length;
    for (const player of room.players) {
      if (!room.round.teamVotes[player.seatIndex]) {
        room.round.teamVotes[player.seatIndex] = "reject";
      }
    }

    const approveCount = Object.values(room.round.teamVotes).filter(
      (vote) => vote === "approve"
    ).length;
    const passed = approveCount > totalPlayers / 2;

    if (passed) {
      room.round.stage = "quest";
      room.round.questVotes = {};
      pushFeed(
        room,
        `${fromTimeout ? "表决倒计时结束，" : ""}队伍通过，任务成员开始暗投任务牌。`,
        "success"
      );
      this.schedulePhase(room, room.config.questSeconds);
      return;
    }

    room.round.rejectTrack += 1;
    pushFeed(
      room,
      `队伍被否决，当前否决计数 ${room.round.rejectTrack}/5。`,
      "danger"
    );

    if (room.round.rejectTrack >= 5) {
      this.finishPartyGame(room, {
        winnerSide: "evil",
        headline: "邪恶阵营获胜",
        detail: "连续五次组队未通过，阿瓦隆失守。"
      });
      return;
    }

    room.round.leaderSeat = nextSeatIndex(room.round.leaderSeat, room.players.length);
    room.round.selectedTeam = [];
    room.round.teamVotes = {};
    room.round.stage = "team-building";
    this.schedulePhase(room, room.config.teamBuildSeconds);
  }

  resolveAvalonQuest(room, fromTimeout) {
    for (const seatIndex of room.round.selectedTeam) {
      if (!room.round.questVotes[seatIndex]) {
        room.round.questVotes[seatIndex] = "success";
      }
    }

    const failVotes = Object.values(room.round.questVotes).filter(
      (value) => value === "fail"
    ).length;
    const failThreshold = getAvalonFailThreshold(room);
    const passed = failVotes < failThreshold;
    room.round.questResults.push({
      roundNo: room.round.roundNo,
      team: [...room.round.selectedTeam],
      failVotes,
      passed
    });

    pushFeed(
      room,
      `${fromTimeout ? "任务投票超时，" : ""}第 ${room.round.roundNo} 轮任务${
        passed ? "成功" : "失败"
      }，出现 ${failVotes} 张失败牌。`,
      passed ? "success" : "danger"
    );

    const successCount = room.round.questResults.filter((item) => item.passed).length;
    const failCount = room.round.questResults.length - successCount;

    if (successCount >= 3) {
      room.round.stage = "assassination";
      pushFeed(room, "正义方三次任务成功，刺客进入刺杀阶段。", "system");
      this.schedulePhase(room, room.config.assassinSeconds);
      return;
    }

    if (failCount >= 3) {
      this.finishPartyGame(room, {
        winnerSide: "evil",
        headline: "邪恶阵营获胜",
        detail: "三次任务失败，圆桌被腐化。"
      });
      return;
    }

    room.round.roundNo += 1;
    room.round.leaderSeat = nextSeatIndex(room.round.leaderSeat, room.players.length);
    room.round.selectedTeam = [];
    room.round.teamVotes = {};
    room.round.questVotes = {};
    room.round.stage = "team-building";
    room.round.rejectTrack = 0;
    this.schedulePhase(room, room.config.teamBuildSeconds);
  }

  resolveAvalonAssassination(room, targetSeat, fromTimeout) {
    const assassin = room.players.find((player) => player.role === "assassin");
    const finalTarget =
      typeof targetSeat === "number" && room.players[targetSeat]
        ? targetSeat
        : getRandomSeat(room.players.length);

    const killedPlayer = room.players[finalTarget];
    const assassinName = assassin?.displayName || "刺客";
    const success = killedPlayer?.role === "merlin";
    pushFeed(
      room,
      `${fromTimeout ? "刺杀超时，" : ""}${assassinName} 指向了 ${
        killedPlayer?.displayName || "未知目标"
      }。`,
      "danger"
    );

    this.finishPartyGame(room, {
      winnerSide: success ? "evil" : "good",
      headline: success ? "邪恶阵营翻盘" : "正义阵营守住胜利",
      detail: success ? "刺客命中了梅林。" : "刺客没有找出梅林。"
    });
  }

  finishPartyGame(room, result) {
    clearTimeout(room.phaseTimer);
    this.clearBotTimers(room);
    room.phaseTimer = null;
    room.phaseEndsAt = null;
    room.phaseDurationMs = null;

    const winnerSeatIndexes = room.players
      .filter((player) => player.side === result.winnerSide)
      .map((player) => player.seatIndex);
    const settlements = buildStandardSettlements(room.players, {
      winnerSeatIndexes,
      loserPenalty: 30,
      winRank: 12,
      lossRank: -6
    });

    room.lastResult = {
      ...result,
      gameKey: room.gameKey,
      players: room.players.map((player) => ({
        seatIndex: player.seatIndex,
        displayName: player.displayName,
        role: player.role,
        roleLabel:
          room.gameKey === "werewolf"
            ? WEREWOLF_ROLE_LABELS[player.role]
            : AVALON_ROLE_LABELS[player.role],
        side: player.side,
        delta:
          settlements.find((entry) => entry.seatIndex === player.seatIndex)?.delta || 0,
        outcome:
          settlements.find((entry) => entry.seatIndex === player.seatIndex)?.outcome || "draw"
      }))
    };

    applyUserSettlements(settlements).catch((error) => {
      console.error("Failed to apply party game settlements", error);
    });

    room.state = "waiting";
    room.round = null;
    room.players.forEach((player) => {
      player.ready = false;
      player.alive = true;
      player.role = null;
      player.side = null;
      player.healUsed = false;
      player.poisonUsed = false;
      player.lastGuardTarget = null;
      player.hunterUsed = false;
      player.inspectedSeats = [];
    });

    pushFeed(room, result.headline, result.winnerSide === "evil" ? "danger" : "success");
    this.emitRoom(room);
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
      phase: room.round?.stage || null,
      playerCount: room.players.length,
      createdAt: room.createdAt
    };
  }

  serializeRoom(room, viewerUserId = null) {
    const viewerSeat = room.players.find((player) => player.userId === viewerUserId) || null;
    const viewersKnown = getKnownSeats(room, viewerSeat);

    return {
      roomNo: room.roomNo,
      ownerId: room.ownerId,
      title: room.title,
      strapline: room.strapline,
      gameKey: room.gameKey,
      state: room.state,
      config: room.config,
      createdAt: room.createdAt,
      phaseEndsAt: room.phaseEndsAt,
      phaseDurationMs: room.phaseDurationMs,
      lastResult: room.lastResult
        ? {
            ...room.lastResult,
            players: room.lastResult.players.map((player) => ({
              ...player,
              roleLabel:
                room.gameKey === "werewolf"
                  ? WEREWOLF_ROLE_LABELS[player.role]
                  : AVALON_ROLE_LABELS[player.role]
            }))
          }
        : null,
      feed: room.feed.slice(-18),
      players: room.players.map((player) => ({
        seatIndex: player.seatIndex,
        userId: player.userId,
        displayName: player.displayName,
        isBot: Boolean(player.isBot),
        connected: player.connected,
        ready: player.ready,
        alive: room.state === "playing" ? player.alive : true,
        voiceConnected: player.voiceConnected,
        voiceMuted: player.voiceMuted,
        roleLabel: getVisibleRoleLabel(room, player, viewerSeat, viewersKnown),
        sideHint:
          viewersKnown[player.seatIndex]?.side ||
          (room.state === "waiting" ? null : undefined)
      })),
      viewer: viewerSeat
        ? {
            userId: viewerSeat.userId,
            seatIndex: viewerSeat.seatIndex,
            displayName: viewerSeat.displayName,
            isBot: Boolean(viewerSeat.isBot),
            role: viewerSeat.role,
            roleLabel:
              room.gameKey === "werewolf"
                ? WEREWOLF_ROLE_LABELS[viewerSeat.role]
                : AVALON_ROLE_LABELS[viewerSeat.role],
            side: viewerSeat.side,
            isOwner: viewerSeat.userId === room.ownerId,
            notes: getViewerNotes(room, viewerSeat, viewersKnown)
          }
        : null,
      round: room.round
        ? room.gameKey === "werewolf"
          ? serializeWerewolfRound(room, viewerSeat)
          : serializeAvalonRound(room, viewerSeat)
        : null
    };
  }

  emitRoom(room, meta = {}) {
    for (const player of room.players) {
      for (const socketId of player.socketIds) {
        this.io?.to(socketId).emit(SOCKET_EVENTS.party.update, {
          room: this.serializeRoom(room, player.userId),
          ...meta
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
      alive: true,
      role: null,
      side: null,
      healUsed: false,
      poisonUsed: false,
      lastGuardTarget: null,
      hunterUsed: false,
      inspectedSeats: [],
      voiceConnected: false,
      voiceMuted: true,
      socketIds: new Set()
    };
  }

  createBotSeat(room, seatIndex) {
    const suffix = Math.random().toString(36).slice(2, 8);
    return {
      seatIndex,
      userId: `bot-${room.gameKey}-${room.roomNo}-${seatIndex}-${suffix}`,
      username: `bot_${suffix}`,
      displayName: getBotDisplayName(room, seatIndex),
      isBot: true,
      ready: true,
      connected: true,
      alive: true,
      role: null,
      side: null,
      healUsed: false,
      poisonUsed: false,
      lastGuardTarget: null,
      hunterUsed: false,
      inspectedSeats: [],
      voiceConnected: false,
      voiceMuted: true,
      socketIds: new Set()
    };
  }

  findSeat(room, userId) {
    return room.players.find((player) => player.userId === userId);
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

  clearBotTimers(room) {
    for (const timer of room.botTimers || []) {
      clearTimeout(timer);
    }
    room.botTimers = [];
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

    clearTimeout(room.phaseTimer);
    room.phaseTimer = null;
    room.phaseEndsAt = null;
    room.phaseDurationMs = null;
    this.clearBotTimers(room);
    room.round = null;
    this.rooms.delete(room.roomNo);
    return true;
  }

  scheduleBotThinking(room) {
    this.clearBotTimers(room);
    if (!room.round || room.state !== "playing") {
      return;
    }

    const bots = room.players.filter((player) => player.isBot);
    if (bots.length === 0) {
      return;
    }

    const maxDelay = Math.max(1200, Math.min(3800, (room.phaseEndsAt || Date.now()) - Date.now() - 250));
    for (const bot of bots) {
      const timer = setTimeout(() => {
        try {
          this.performBotTurn(room, bot.userId);
        } catch (error) {
          return;
        }
      }, randomInt(900, maxDelay));
      room.botTimers.push(timer);
    }
  }

  performBotTurn(room, userId) {
    if (!room.round || room.state !== "playing") {
      return;
    }

    const seat = this.findSeat(room, userId);
    if (!seat?.isBot) {
      return;
    }

    let acted = false;
    if (room.gameKey === "werewolf") {
      acted = this.performWerewolfBotTurn(room, seat);
    } else if (room.gameKey === "avalon") {
      acted = this.performAvalonBotTurn(room, seat);
    }

    if (acted && room.state === "playing" && room.round) {
      this.scheduleBotThinking(room);
      this.emitRoom(room);
    }
  }

  performWerewolfBotTurn(room, seat) {
    const { round } = room;
    if (round.stage === "discussion") {
      return false;
    }

    if (round.stage === "night") {
      if (!seat.alive) {
        return false;
      }

      if (seat.role === "werewolf" && round.night.wolfVotes[seat.seatIndex] === undefined) {
        const target = chooseWerewolfBotKill(room, seat);
        if (typeof target === "number") {
          this.handleWerewolfAction(room, seat, { type: "wolf-target", targetSeat: target });
          return true;
        }
        return false;
      }

      if (seat.role === "guard" && round.night.guardProtectSeat === null) {
        const target = chooseGuardProtectTarget(room, seat);
        if (typeof target === "number") {
          this.handleWerewolfAction(room, seat, { type: "guard-protect", targetSeat: target });
          return true;
        }
        return false;
      }

      if (seat.role === "seer" && round.night.seerInspectSeat === null) {
        const target = chooseSeerInspectTarget(room, seat);
        if (typeof target === "number") {
          this.handleWerewolfAction(room, seat, { type: "seer-inspect", targetSeat: target });
          return true;
        }
        return false;
      }

      if (
        seat.role === "witch" &&
        !round.night.witch.committed &&
        (round.night.witch.incomingVictimSeat !== null ||
          !room.players.some((player) => player.alive && player.role === "werewolf"))
      ) {
        const plan = chooseWitchPlan(room, seat);
        this.handleWerewolfAction(room, seat, {
          type: "witch-plan",
          saveTarget: plan.saveTarget,
          poisonSeat: plan.poisonSeat
        });
        return true;
      }
      return false;
    }

    if (round.stage === "vote") {
      if (!seat.alive || round.votes[seat.seatIndex] !== undefined) {
        return false;
      }

      const target = chooseWerewolfDayVote(room, seat);
      if (typeof target === "number") {
        this.handleWerewolfAction(room, seat, { type: "day-vote", targetSeat: target });
        return true;
      }
      return false;
    }

    if (round.stage === "hunter-shot") {
      if (round.pendingHunterSeat !== seat.seatIndex) {
        return false;
      }

      const target = chooseHunterShotTarget(room, seat);
      this.resolveWerewolfHunterShot(room, target, false);
      return true;
    }

    return false;
  }

  performAvalonBotTurn(room, seat) {
    const { round } = room;
    if (round.stage === "team-building") {
      if (round.leaderSeat !== seat.seatIndex) {
        return false;
      }

      round.selectedTeam = buildBotAvalonTeam(room, seat);
      this.handleAvalonAction(room, seat, { type: "confirm-team" });
      return true;
    }

    if (round.stage === "team-vote") {
      if (round.teamVotes[seat.seatIndex]) {
        return false;
      }

      this.handleAvalonAction(room, seat, {
        type: "team-vote",
        value: chooseAvalonTeamVote(room, seat)
      });
      return true;
    }

    if (round.stage === "quest") {
      if (!round.selectedTeam.includes(seat.seatIndex) || round.questVotes[seat.seatIndex]) {
        return false;
      }

      this.handleAvalonAction(room, seat, {
        type: "quest-vote",
        value: chooseAvalonQuestVote(room, seat)
      });
      return true;
    }

    if (round.stage === "assassination") {
      if (seat.role !== "assassin") {
        return false;
      }

      this.resolveAvalonAssassination(room, chooseAvalonAssassinationTarget(room), false);
      return true;
    }

    return false;
  }
}

function normalizePartyConfig(gameKey, input = {}) {
  const defaults = getPartyDefaultConfig(gameKey);
  const limits = getGameLimits(gameKey);
  const normalized = { ...defaults };

  normalized.visibility = input.visibility === "private" ? "private" : defaults.visibility;
  normalized.maxPlayers = clampNumber(
    input.maxPlayers ?? defaults.maxPlayers,
    limits.minPlayers,
    limits.maxPlayers
  );

  if (gameKey === "werewolf") {
    normalized.nightSeconds = clampNumber(input.nightSeconds ?? defaults.nightSeconds, 20, 90);
    normalized.discussionSeconds = clampNumber(
      input.discussionSeconds ?? defaults.discussionSeconds,
      30,
      180
    );
    normalized.voteSeconds = clampNumber(input.voteSeconds ?? defaults.voteSeconds, 15, 90);
    normalized.hunterSeconds = clampNumber(
      input.hunterSeconds ?? defaults.hunterSeconds ?? 20,
      10,
      45
    );
  }

  if (gameKey === "avalon") {
    normalized.teamBuildSeconds = clampNumber(
      input.teamBuildSeconds ?? defaults.teamBuildSeconds,
      20,
      120
    );
    normalized.voteSeconds = clampNumber(input.voteSeconds ?? defaults.voteSeconds, 15, 90);
    normalized.questSeconds = clampNumber(
      input.questSeconds ?? defaults.questSeconds,
      15,
      90
    );
    normalized.assassinSeconds = clampNumber(
      input.assassinSeconds ?? defaults.assassinSeconds,
      15,
      90
    );
  }

  normalized.voiceEnabled = input.voiceEnabled !== false;
  return normalized;
}

function serializeWerewolfRound(room, viewerSeat) {
  const night = room.round.night;
  const alivePlayers = room.players.filter((player) => player.alive);
  return {
    stage: room.round.stage,
    nightNo: room.round.nightNo,
    dayNo: room.round.dayNo,
    aliveCount: alivePlayers.length,
    wolfVotes:
      viewerSeat?.role === "werewolf"
        ? summarizeCounts(night.wolfVotes)
        : [],
    myWolfTarget:
      viewerSeat?.role === "werewolf"
        ? night.wolfVotes[viewerSeat.seatIndex] ?? null
        : null,
    incomingVictimSeat:
      viewerSeat?.role === "witch" ? night.witch.incomingVictimSeat : null,
    seerResult:
      viewerSeat?.role === "seer" ? night.seerResult : null,
    myInspectTarget:
      viewerSeat?.role === "seer" ? night.seerInspectSeat : null,
    myGuardTarget:
      viewerSeat?.role === "guard" ? night.guardProtectSeat : null,
    lastGuardTarget:
      viewerSeat?.role === "guard" ? viewerSeat.lastGuardTarget ?? null : null,
    witchStatus:
      viewerSeat?.role === "witch"
        ? {
            healUsed: night.witch.healUsed,
            poisonUsed: night.witch.poisonUsed,
            committed: night.witch.committed,
            plan: night.witch.plan
          }
        : null,
    pendingHunterSeat: room.round.pendingHunterSeat,
    myVote:
      viewerSeat && room.round.stage === "vote"
        ? room.round.votes[viewerSeat.seatIndex] ?? null
        : null,
    submittedVotes: Object.keys(room.round.votes).length
  };
}

function serializeAvalonRound(room, viewerSeat) {
  const successCount = room.round.questResults.filter((item) => item.passed).length;
  const failCount = room.round.questResults.length - successCount;
  return {
    stage: room.round.stage,
    roundNo: room.round.roundNo,
    leaderSeat: room.round.leaderSeat,
    teamSize: getAvalonTeamSize(room),
    selectedTeam: room.round.selectedTeam,
    rejectTrack: room.round.rejectTrack,
    teamVotesSubmitted: Object.keys(room.round.teamVotes).length,
    questVotesSubmitted: Object.keys(room.round.questVotes).length,
    questResults: room.round.questResults,
    successCount,
    failCount,
    myTeamVote:
      viewerSeat && room.round.stage === "team-vote"
        ? room.round.teamVotes[viewerSeat.seatIndex] || null
        : null,
    myQuestVote:
      viewerSeat && room.round.stage === "quest"
        ? room.round.questVotes[viewerSeat.seatIndex] || null
        : null
  };
}

function getKnownSeats(room, viewerSeat) {
  if (!room.round || !viewerSeat) {
    return {};
  }

  const known = {
    [viewerSeat.seatIndex]: {
      role: viewerSeat.role,
      side: viewerSeat.side
    }
  };

  if (room.gameKey === "werewolf" && viewerSeat.role === "werewolf") {
    room.players
      .filter((player) => player.role === "werewolf")
      .forEach((player) => {
        known[player.seatIndex] = { role: player.role, side: player.side };
      });
  }

  if (room.gameKey === "avalon") {
    if (viewerSeat.side === "evil" && viewerSeat.role !== "oberon") {
      room.players
        .filter((player) => player.side === "evil" && player.role !== "oberon")
        .forEach((player) => {
          known[player.seatIndex] = { role: player.role, side: player.side };
        });
    }

    if (viewerSeat.role === "merlin") {
      room.players
        .filter((player) => player.side === "evil" && player.role !== "mordred")
        .forEach((player) => {
          known[player.seatIndex] = { role: null, side: "evil" };
        });
    }

    if (viewerSeat.role === "percival") {
      room.players
        .filter((player) => ["merlin", "morgana"].includes(player.role))
        .forEach((player) => {
          known[player.seatIndex] = { role: "possible-merlin", side: "good" };
        });
    }
  }

  return known;
}

function getVisibleRoleLabel(room, player, viewerSeat, knownSeats) {
  if (!player.role) {
    return null;
  }

  if (viewerSeat?.seatIndex === player.seatIndex || room.lastResult) {
    return room.gameKey === "werewolf"
      ? WEREWOLF_ROLE_LABELS[player.role]
      : AVALON_ROLE_LABELS[player.role];
  }

  if (knownSeats[player.seatIndex]?.role === "possible-merlin") {
    return "梅林 / 莫甘娜";
  }

  if (knownSeats[player.seatIndex]?.role) {
    return room.gameKey === "werewolf"
      ? WEREWOLF_ROLE_LABELS[player.role]
      : AVALON_ROLE_LABELS[player.role];
  }

  if (knownSeats[player.seatIndex]?.side === "evil") {
    return "邪恶阵营";
  }

  return null;
}

function getViewerNotes(room, viewerSeat, knownSeats) {
  if (!viewerSeat?.role) {
    return [];
  }

  if (room.gameKey === "werewolf") {
    if (viewerSeat.role === "werewolf") {
      const partners = room.players
        .filter(
          (player) => player.role === "werewolf" && player.seatIndex !== viewerSeat.seatIndex
        )
        .map((player) => player.displayName);
      return partners.length > 0
        ? [`狼队友：${partners.join("、")}`]
        : ["你是独狼，今晚需要自己判断刀口。"];
    }

    if (viewerSeat.role === "seer") {
      return ["每晚可查验一名存活玩家的阵营。"];
    }

    if (viewerSeat.role === "witch") {
      return ["你有一瓶解药和一瓶毒药，各只能使用一次。"];
    }

    if (viewerSeat.role === "guard") {
      return ["每晚守护一名玩家，且不能连续两晚守同一人。"];
    }

    if (viewerSeat.role === "hunter") {
      return ["你出局后可立即开枪带走一名存活玩家。"];
    }

    return ["白天发言、投票，帮助好人找出狼人。"];
  }

  const notes = [];
  if (viewerSeat.side === "evil" && viewerSeat.role !== "oberon") {
    const allies = room.players
      .filter(
        (player) =>
          player.side === "evil" &&
          player.role !== "oberon" &&
          player.seatIndex !== viewerSeat.seatIndex
      )
      .map((player) => player.displayName);
    if (allies.length > 0) {
      notes.push(`邪恶同伴：${allies.join("、")}`);
    }
  }

  if (viewerSeat.role === "oberon") {
    notes.push("你属于邪恶阵营，但不会被其他邪恶角色识别。");
  }

  if (viewerSeat.role === "merlin") {
    const evilPlayers = room.players
      .filter((player) => knownSeats[player.seatIndex]?.side === "evil")
      .map((player) => player.displayName);
    notes.push(`你能看到邪恶气息：${evilPlayers.join("、")}`);
  }

  if (viewerSeat.role === "percival") {
    const merlinCandidates = room.players
      .filter((player) => knownSeats[player.seatIndex]?.role === "possible-merlin")
      .map((player) => player.displayName);
    notes.push(`梅林候选：${merlinCandidates.join("、")}`);
  }

  if (viewerSeat.role === "mordred") {
    notes.push("梅林看不见你的存在，但邪恶同伴仍能认出你。");
  }

  if (notes.length === 0) {
    notes.push("隐藏身份，跟住团队讨论与票型。");
  }

  return notes;
}

function createWerewolfNightState(room) {
  const witch = room.players.find((player) => player.role === "witch");
  return {
    wolfVotes: {},
    guardProtectSeat: null,
    seerSeat: room.players.find((player) => player.alive && player.role === "seer")?.seatIndex ?? null,
    seerInspectSeat: null,
    seerResult: null,
    witch: {
      incomingVictimSeat: null,
      healUsed: Boolean(witch?.healUsed),
      poisonUsed: Boolean(witch?.poisonUsed),
      plan: {
        saveTarget: false,
        poisonSeat: null
      },
      committed: !room.players.some((player) => player.alive && player.role === "witch")
    }
  };
}

function getWerewolfWinner(room) {
  const aliveWolves = room.players.filter(
    (player) => player.alive && player.role === "werewolf"
  ).length;
  const aliveGood = room.players.filter(
    (player) => player.alive && player.role !== "werewolf"
  ).length;

  if (aliveWolves === 0) {
    return "good";
  }

  if (aliveWolves >= aliveGood) {
    return "evil";
  }

  return null;
}

function buildWerewolfRoles(playerCount) {
  const rolesByCount = {
    6: ["werewolf", "werewolf", "seer", "witch", "guard", "villager"],
    7: ["werewolf", "werewolf", "seer", "witch", "guard", "hunter", "villager"],
    8: ["werewolf", "werewolf", "seer", "witch", "guard", "hunter", "villager", "villager"],
    9: [
      "werewolf",
      "werewolf",
      "werewolf",
      "seer",
      "witch",
      "guard",
      "hunter",
      "villager",
      "villager"
    ],
    10: [
      "werewolf",
      "werewolf",
      "werewolf",
      "seer",
      "witch",
      "guard",
      "hunter",
      "villager",
      "villager",
      "villager"
    ]
  };

  return rolesByCount[playerCount] || rolesByCount[8];
}

function buildAvalonRoles(playerCount) {
  const rolesByCount = {
    5: ["merlin", "assassin", "minion", "loyal", "loyal"],
    6: ["merlin", "percival", "assassin", "morgana", "loyal", "loyal"],
    7: ["merlin", "percival", "assassin", "morgana", "mordred", "loyal", "loyal"],
    8: ["merlin", "percival", "assassin", "morgana", "oberon", "loyal", "loyal", "loyal"],
    9: [
      "merlin",
      "percival",
      "assassin",
      "morgana",
      "mordred",
      "loyal",
      "loyal",
      "loyal",
      "loyal"
    ],
    10: [
      "merlin",
      "percival",
      "assassin",
      "morgana",
      "mordred",
      "oberon",
      "loyal",
      "loyal",
      "loyal",
      "loyal"
    ]
  };

  return rolesByCount[playerCount] || rolesByCount[7];
}

function getAvalonSide(role) {
  return ["assassin", "minion", "morgana", "mordred", "oberon"].includes(role)
    ? "evil"
    : "good";
}

function getAvalonTeamSize(room) {
  const table = {
    5: [2, 3, 2, 3, 3],
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5]
  };

  const roundIndex = Math.max(0, Math.min(4, room.round.roundNo - 1));
  return table[room.players.length][roundIndex];
}

function getAvalonFailThreshold(room) {
  return room.players.length >= 7 && room.round.roundNo === 4 ? 2 : 1;
}

function autoSelectAvalonTeam(room) {
  const teamSize = getAvalonTeamSize(room);
  const team = [];
  for (let step = 0; step < room.players.length && team.length < teamSize; step += 1) {
    team.push((room.round.leaderSeat + step) % room.players.length);
  }
  return team.sort((a, b) => a - b);
}

function tallyVotes(votes, detectTie = false) {
  const counts = {};
  for (const targetSeat of Object.values(votes || {})) {
    if (targetSeat === null || targetSeat === undefined) {
      continue;
    }
    counts[targetSeat] = (counts[targetSeat] || 0) + 1;
  }

  let winner = null;
  let best = -1;
  let tie = false;

  for (const [seatIndex, count] of Object.entries(counts)) {
    if (count > best) {
      winner = Number(seatIndex);
      best = count;
      tie = false;
    } else if (count === best) {
      tie = true;
    }
  }

  if (detectTie) {
    return { targetSeat: winner, tie };
  }

  return winner;
}

function summarizeCounts(votes) {
  const counts = {};
  for (const target of Object.values(votes)) {
    counts[target] = (counts[target] || 0) + 1;
  }

  return Object.entries(counts).map(([seatIndex, count]) => ({
    seatIndex: Number(seatIndex),
    count
  }));
}

function nextSeatIndex(current, total) {
  return (current + 1) % total;
}

function getRandomSeat(total) {
  return Math.floor(Math.random() * total);
}

function chooseWerewolfBotKill(room, seat) {
  const priorities = room.players.filter(
    (player) => player.alive && player.seatIndex !== seat.seatIndex && player.side !== "evil"
  );
  return pickRandom(priorities)?.seatIndex ?? null;
}

function chooseGuardProtectTarget(room, seat) {
  const protectedCandidates = room.players.filter(
    (player) => player.alive && player.seatIndex !== seat.lastGuardTarget
  );
  return pickRandom(protectedCandidates)?.seatIndex ?? null;
}

function chooseSeerInspectTarget(room, seat) {
  const inspected = new Set(seat.inspectedSeats || []);
  const unseen = room.players.filter(
    (player) =>
      player.alive &&
      player.seatIndex !== seat.seatIndex &&
      !inspected.has(player.seatIndex)
  );
  const target = pickRandom(unseen.length > 0 ? unseen : room.players.filter(
    (player) => player.alive && player.seatIndex !== seat.seatIndex
  ));
  if (target) {
    seat.inspectedSeats = [...inspected, target.seatIndex];
  }
  return target?.seatIndex ?? null;
}

function chooseWitchPlan(room) {
  const { witch } = room.round.night;
  const allTargets = room.players.filter(
    (player) => player.alive && player.role !== "witch"
  );
  const saveTarget =
    witch.incomingVictimSeat !== null &&
    !witch.healUsed &&
    room.players[witch.incomingVictimSeat]?.side === "good" &&
    Math.random() > 0.35;

  let poisonSeat = null;
  if (!witch.poisonUsed && Math.random() > 0.62) {
    poisonSeat = pickRandom(allTargets)?.seatIndex ?? null;
  }

  return { saveTarget, poisonSeat };
}

function chooseWerewolfDayVote(room, seat) {
  const nonWolfTargets = room.players.filter(
    (player) => player.alive && player.role !== "werewolf" && player.seatIndex !== seat.seatIndex
  );

  if (seat.role === "werewolf") {
    return pickRandom(nonWolfTargets)?.seatIndex ?? null;
  }

  const suspiciousTargets = room.players.filter(
    (player) => player.alive && player.seatIndex !== seat.seatIndex
  );
  return pickRandom(suspiciousTargets)?.seatIndex ?? null;
}

function chooseHunterShotTarget(room, seat) {
  const enemies =
    seat.side === "evil"
      ? room.players.filter((player) => player.alive && player.side === "good")
      : room.players.filter((player) => player.alive && player.side === "evil");
  const fallback = room.players.filter(
    (player) => player.alive && player.seatIndex !== seat.seatIndex
  );
  return pickRandom(enemies)?.seatIndex ?? pickRandom(fallback)?.seatIndex ?? null;
}

function buildBotAvalonTeam(room, leaderSeat) {
  const teamSize = getAvalonTeamSize(room);
  const pool = room.players.map((player) => ({
    ...player,
    knownEvil:
      leaderSeat.role === "merlin" &&
      player.side === "evil" &&
      player.role !== "mordred",
    merlinCandidate: ["merlin", "morgana"].includes(player.role)
  }));

  if (leaderSeat.side === "evil") {
    const team = new Set([leaderSeat.seatIndex]);
    if (leaderSeat.role !== "oberon") {
      const evilSeat = pickRandom(
        pool.filter(
          (player) => player.side === "evil" && player.seatIndex !== leaderSeat.seatIndex
        )
      )?.seatIndex;
      if (typeof evilSeat === "number") {
        team.add(evilSeat);
      }
    }
    while (team.size < teamSize) {
      team.add(pickRandom(pool)?.seatIndex);
    }
    return [...team].sort((a, b) => a - b);
  }

  const preferred = pool
    .filter((player) => !player.knownEvil)
    .sort((left, right) => Number(right.seatIndex === leaderSeat.seatIndex) - Number(left.seatIndex === leaderSeat.seatIndex));
  return preferred.slice(0, teamSize).map((player) => player.seatIndex).sort((a, b) => a - b);
}

function chooseAvalonTeamVote(room, seat) {
  const selectedPlayers = room.round.selectedTeam.map((seatIndex) => room.players[seatIndex]);
  const hasKnownEvil = selectedPlayers.some((player) => {
    if (seat.role === "merlin") {
      return player.side === "evil" && player.role !== "mordred";
    }

    if (seat.side === "evil" && seat.role !== "oberon") {
      return player.side === "evil" && player.role !== "oberon";
    }

    return false;
  });

  if (seat.side === "evil") {
    if (seat.role === "oberon") {
      return room.round.selectedTeam.includes(seat.seatIndex) || Math.random() > 0.42
        ? "approve"
        : "reject";
    }

    const includesEvil = selectedPlayers.some(
      (player) => player.side === "evil" && player.role !== "oberon"
    );
    return includesEvil || Math.random() > 0.55 ? "approve" : "reject";
  }

  if (hasKnownEvil) {
    return "reject";
  }

  return room.round.selectedTeam.includes(seat.seatIndex) || Math.random() > 0.28
    ? "approve"
    : "reject";
}

function chooseAvalonQuestVote(room, seat) {
  if (seat.side === "good") {
    return "success";
  }

  const successCount = room.round.questResults.filter((item) => item.passed).length;
  const failCount = room.round.questResults.length - successCount;
  if (failCount >= 2 || successCount >= 2) {
    return "fail";
  }

  if (room.round.roundNo === 1 && room.round.selectedTeam.length <= 2) {
    return Math.random() > 0.85 ? "fail" : "success";
  }

  return Math.random() > 0.45 ? "fail" : "success";
}

function chooseAvalonAssassinationTarget(room) {
  const preferredRoles = ["merlin", "percival", "loyal"];
  for (const role of preferredRoles) {
    const target = pickRandom(
      room.players.filter((player) => player.side === "good" && player.role === role)
    );
    if (target) {
      return target.seatIndex;
    }
  }

  return pickRandom(room.players.filter((player) => player.side === "good"))?.seatIndex ?? null;
}

function getBotDisplayName(room, seatIndex) {
  const pool = room.gameKey === "werewolf" ? WEREWOLF_BOT_NAMES : AVALON_BOT_NAMES;
  const base = pool[seatIndex % pool.length];
  const dupIndex =
    room.players.filter((player) => player.isBot && player.displayName.startsWith(base)).length + 1;
  return `${base}${dupIndex}`;
}

function pickRandom(items) {
  if (!items || items.length === 0) {
    return null;
  }

  return items[Math.floor(Math.random() * items.length)];
}

function randomInt(min, max) {
  const lower = Math.max(1, Math.floor(min));
  const upper = Math.max(lower, Math.floor(max));
  return lower + Math.floor(Math.random() * (upper - lower + 1));
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

function shuffle(items) {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[swapIndex]] = [cloned[swapIndex], cloned[index]];
  }
  return cloned;
}

function generateRoomNo(map) {
  let roomNo = "";
  do {
    roomNo = String(Math.floor(100000 + Math.random() * 900000));
  } while (map.has(roomNo));
  return roomNo;
}

function getSocketRoom(roomNo) {
  return `party:${roomNo}`;
}

module.exports = {
  getPartyRoomManager
};
