const test = require("node:test");
const assert = require("node:assert/strict");

const {
  evaluateCards,
  compareCombos,
  listSuggestedPlays
} = require("../lib/game/combo");
const { __testing } = require("../lib/game/room-manager");

function createCard(rank, suit, idSuffix = `${rank}-${suit}`) {
  return {
    id: `${rank}-${suit}-${idSuffix}`,
    rank,
    suit,
    label: `${rank}-${suit}`
  };
}

function createSeat(seatIndex, userId, displayName, overrides = {}) {
  return {
    seatIndex,
    userId,
    displayName,
    username: displayName.toLowerCase(),
    isBot: false,
    ready: true,
    connected: true,
    trustee: false,
    isLandlord: false,
    socketIds: new Set(),
    ...overrides
  };
}

test("higher pair can beat lower pair and weaker pair cannot", () => {
  const pairSix = evaluateCards([createCard(6, "S"), createCard(6, "H")]);
  const pairEight = evaluateCards([createCard(8, "S"), createCard(8, "H")]);
  const pairFive = evaluateCards([createCard(5, "S"), createCard(5, "H")]);

  assert.equal(compareCombos(pairEight, pairSix), true);
  assert.equal(compareCombos(pairFive, pairSix), false);
});

test("suggested plays stay on same type before considering bombs", () => {
  const hand = [
    createCard(6, "S"),
    createCard(6, "H"),
    createCard(8, "S"),
    createCard(8, "H"),
    createCard(10, "S"),
    createCard(10, "H"),
    createCard(10, "C"),
    createCard(10, "D")
  ];
  const lastPlay = evaluateCards([createCard(5, "S"), createCard(5, "H")]);

  const suggestions = listSuggestedPlays(hand, lastPlay);

  assert.equal(suggestions.length >= 2, true);
  assert.equal(suggestions[0].type, "pair");
  assert.equal(suggestions[0].mainRank, 6);
  assert.equal(suggestions[1].type, "pair");
  assert.equal(suggestions.every((combo) => combo.type === "pair"), true);
});

test("suggested plays fall back to bombs when no same-type answer exists", () => {
  const hand = [
    createCard(4, "S"),
    createCard(7, "S"),
    createCard(10, "S"),
    createCard(10, "H"),
    createCard(10, "C"),
    createCard(10, "D")
  ];
  const lastPlay = evaluateCards([createCard(13, "S"), createCard(13, "H")]);

  const suggestions = listSuggestedPlays(hand, lastPlay);

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].type, "bomb");
  assert.equal(suggestions[0].mainRank, 10);
});

test("passing twice returns lead to the last active seat and clears current table play", () => {
  const { RoomManager } = __testing;
  const manager = new RoomManager();
  const notifications = [];

  manager.emitRoom = (_room, meta = {}) => {
    if (meta.notification) {
      notifications.push(meta.notification);
    }
  };
  manager.scheduleTurn = () => {};

  const lastPlayCards = [createCard(9, "S"), createCard(9, "H")];
  const room = {
    roomNo: "900001",
    state: "playing",
    ownerId: "u0",
    settings: {
      countdownSeconds: 18,
      autoTrusteeMinSeconds: 2,
      autoTrusteeMaxSeconds: 4
    },
    players: [
      {
        seatIndex: 0,
        userId: "u0",
        displayName: "Lead",
        isBot: false,
        ready: true,
        connected: true,
        trustee: false,
        socketIds: new Set()
      },
      {
        seatIndex: 1,
        userId: "u1",
        displayName: "Mid",
        isBot: false,
        ready: true,
        connected: true,
        trustee: false,
        socketIds: new Set()
      },
      {
        seatIndex: 2,
        userId: "u2",
        displayName: "Tail",
        isBot: false,
        ready: true,
        connected: true,
        trustee: false,
        socketIds: new Set()
      }
    ],
    round: {
      stage: "playing",
      currentTurn: 1,
      hands: {
        0: [createCard(3, "S")],
        1: [createCard(4, "S")],
        2: [createCard(5, "S")]
      },
      bottomCards: [],
      multiplier: 1,
      lastPlay: {
        playId: 1,
        seatIndex: 0,
        combo: evaluateCards(lastPlayCards),
        cards: lastPlayCards,
        text: "9-S 9-H",
        type: "pair"
      },
      lastActiveSeat: 0,
      passCount: 0,
      playCountBySeat: { 0: 1, 1: 0, 2: 0 },
      landlordSeat: 0,
      winnerSeat: null,
      winnerSide: null,
      summary: null,
      playSequence: 1,
      turnEndsAt: null,
      turnDurationMs: null,
      turnMode: "manual"
    },
    turnTimer: null,
    chatFeed: [],
    lastResult: null
  };

  manager.rooms.set(room.roomNo, room);

  manager.pass(room.roomNo, "u1");
  assert.equal(room.round.currentTurn, 2);
  assert.equal(room.round.passCount, 1);

  manager.pass(room.roomNo, "u2");
  assert.equal(room.round.currentTurn, 0);
  assert.equal(room.round.passCount, 0);
  assert.equal(room.round.lastPlay, null);
  assert.match(notifications.at(-1), /重新領出/);
});

test("suggested plays can hide bombs and rockets when the room rules disable them", () => {
  const bombOnlyHand = [
    createCard(4, "S"),
    createCard(7, "S"),
    createCard(10, "S"),
    createCard(10, "H"),
    createCard(10, "C"),
    createCard(10, "D")
  ];
  const pairLastPlay = evaluateCards([createCard(13, "S"), createCard(13, "H")]);

  assert.deepEqual(listSuggestedPlays(bombOnlyHand, pairLastPlay, { allowBomb: false }), []);

  const rocketOnlyHand = [createCard(16, "BJ"), createCard(17, "RJ")];
  const rocketLastPlay = evaluateCards([createCard(15, "S"), createCard(15, "H")]);

  assert.deepEqual(
    listSuggestedPlays(rocketOnlyHand, rocketLastPlay, { allowRocket: false }),
    []
  );
});

test("room manager rejects bomb and rocket plays when those rules are disabled", () => {
  const { RoomManager } = __testing;
  const manager = new RoomManager();
  manager.emitRoom = () => {};
  manager.scheduleTurn = () => {};

  const bombRoom = {
    roomNo: "910001",
    state: "playing",
    ownerId: "u0",
    settings: {
      baseScore: 50,
      bidOptions: [0, 1, 2, 3],
      countdownSeconds: 18,
      autoTrusteeMinSeconds: 2,
      autoTrusteeMaxSeconds: 4,
      allowBomb: false,
      allowRocket: true,
      allowSpring: true
    },
    players: [
      createSeat(0, "u0", "Lead"),
      createSeat(1, "u1", "Mid"),
      createSeat(2, "u2", "Tail")
    ],
    round: {
      stage: "playing",
      currentTurn: 0,
      hands: {
        0: [
          createCard(9, "S"),
          createCard(9, "H"),
          createCard(9, "C"),
          createCard(9, "D")
        ],
        1: [createCard(4, "S")],
        2: [createCard(5, "S")]
      },
      bottomCards: [],
      multiplier: 1,
      lastPlay: null,
      lastActiveSeat: null,
      passCount: 0,
      playCountBySeat: { 0: 0, 1: 0, 2: 0 },
      landlordSeat: 0,
      winnerSeat: null,
      winnerSide: null,
      summary: null,
      playSequence: 0,
      turnEndsAt: null,
      turnDurationMs: null,
      turnMode: "manual"
    }
  };

  manager.rooms.set(bombRoom.roomNo, bombRoom);

  assert.throws(
    () =>
      manager.submitPlay(
        bombRoom.roomNo,
        "u0",
        bombRoom.round.hands[0].map((card) => card.id)
      ),
    /禁用炸彈/
  );

  const rocketRoom = {
    ...bombRoom,
    roomNo: "910002",
    settings: {
      ...bombRoom.settings,
      allowBomb: true,
      allowRocket: false
    },
    round: {
      ...bombRoom.round,
      hands: {
        0: [createCard(16, "BJ"), createCard(17, "RJ")],
        1: [createCard(4, "S")],
        2: [createCard(5, "S")]
      }
    }
  };

  manager.rooms.set(rocketRoom.roomNo, rocketRoom);

  assert.throws(
    () =>
      manager.submitPlay(
        rocketRoom.roomNo,
        "u0",
        rocketRoom.round.hands[0].map((card) => card.id)
      ),
    /禁用王炸/
  );
});

test("spring multiplier is skipped when the room disables spring scoring", async () => {
  const { RoomManager } = __testing;
  const manager = new RoomManager();
  manager.emitRoom = () => {};
  manager.maybeCloseCompletedRoom = () => false;
  manager.persistResult = async () => {};

  const room = {
    roomNo: "910003",
    state: "playing",
    ownerId: "u0",
    templateId: 1,
    settings: {
      baseScore: 50,
      bidOptions: [0, 1, 2, 3],
      allowSpring: false,
      springMultiplier: 2
    },
    players: [
      createSeat(0, "u0", "Landlord", { isLandlord: true }),
      createSeat(1, "u1", "Farmer A"),
      createSeat(2, "u2", "Farmer B")
    ],
    round: {
      stage: "playing",
      currentTurn: 0,
      bidHistory: [],
      highestBid: 3,
      highestBidSeat: 0,
      hands: {
        0: [],
        1: [createCard(4, "S"), createCard(5, "S")],
        2: [createCard(6, "S"), createCard(7, "S")]
      },
      bottomCards: [],
      multiplier: 3,
      lastPlay: null,
      lastActiveSeat: 0,
      passCount: 0,
      playCountBySeat: { 0: 2, 1: 0, 2: 0 },
      landlordSeat: 0,
      winnerSeat: null,
      winnerSide: null,
      summary: null,
      playSequence: 0,
      turnEndsAt: null,
      turnDurationMs: null,
      turnMode: "manual"
    },
    turnTimer: null,
    chatFeed: [],
    lastResult: null
  };

  await manager.finishGame(room, 0);

  assert.equal(room.lastResult.spring, false);
  assert.equal(room.lastResult.multiplier, 3);
});

test("bidding ceiling follows normalized bid options instead of hard coded 3", () => {
  const { RoomManager } = __testing;
  const manager = new RoomManager();
  let finished = false;

  manager.finishBidding = () => {
    finished = true;
  };
  manager.emitRoom = () => {};
  manager.scheduleTurn = () => {};

  const room = {
    roomNo: "910004",
    state: "bidding",
    ownerId: "u0",
    settings: {
      baseScore: 100,
      bidOptions: [0, 1, 2, 3, 4],
      maxRobMultiplier: 4
    },
    players: [
      createSeat(0, "u0", "Lead"),
      createSeat(1, "u1", "Mid"),
      createSeat(2, "u2", "Tail")
    ],
    round: {
      stage: "bidding",
      currentTurn: 0,
      firstBidSeat: 0,
      bidHistory: [],
      bidTurns: 0,
      highestBid: 3,
      highestBidSeat: 1,
      hands: {
        0: [
          createCard(17, "RJ"),
          createCard(16, "BJ"),
          createCard(15, "S"),
          createCard(15, "H"),
          createCard(15, "C"),
          createCard(15, "D")
        ],
        1: [],
        2: []
      },
      bottomCards: [],
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
    }
  };

  manager.rooms.set(room.roomNo, room);
  manager.submitBid(room.roomNo, "u0", 4);

  assert.equal(finished, true);
});

test("bot bidding can escalate to the configured 4-point ceiling", () => {
  const { RoomManager } = __testing;
  const manager = new RoomManager();
  const submitted = [];

  manager.submitBid = (_roomNo, _userId, value) => {
    submitted.push(value);
  };

  const room = {
    roomNo: "910005",
    settings: {
      bidOptions: [0, 1, 2, 3, 4],
      maxRobMultiplier: 4,
      allowBomb: true,
      allowRocket: true
    },
    players: [
      createSeat(0, "bot-0", "Bot", { isBot: true, trustee: true }),
      createSeat(1, "u1", "Mid"),
      createSeat(2, "u2", "Tail")
    ],
    round: {
      stage: "bidding",
      currentTurn: 0,
      highestBid: 3,
      hands: {
        0: [
          createCard(17, "RJ"),
          createCard(16, "BJ"),
          createCard(15, "S"),
          createCard(15, "H"),
          createCard(15, "C"),
          createCard(15, "D")
        ]
      }
    }
  };

  manager.performAutomatedAction(room, room.players[0]);

  assert.deepEqual(submitted, [4]);
});
