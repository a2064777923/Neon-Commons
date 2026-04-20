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
