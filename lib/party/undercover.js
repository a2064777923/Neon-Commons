const WORD_PAIR_DECK = Object.freeze([
  Object.freeze({ civilian: "咖啡", undercover: "奶茶" }),
  Object.freeze({ civilian: "貓咪", undercover: "狐狸" }),
  Object.freeze({ civilian: "火車", undercover: "地鐵" }),
  Object.freeze({ civilian: "籃球", undercover: "排球" }),
  Object.freeze({ civilian: "鋼琴", undercover: "吉他" }),
  Object.freeze({ civilian: "沙灘", undercover: "泳池" })
]);

function createUndercoverRound(playerCount, options = {}) {
  if (!Number.isInteger(playerCount) || playerCount < 4) {
    throw new Error("Undercover 至少需要 4 位玩家");
  }

  const aliveSeats = Array.from({ length: playerCount }, (_item, index) => index);
  const pairIndex = normalizePairIndex(options.pairIndex);
  const pair = WORD_PAIR_DECK[pairIndex];
  const undercoverSeat = normalizeUndercoverSeat(options.undercoverSeat, playerCount);
  const rolesBySeat = Object.fromEntries(
    aliveSeats.map((seatIndex) => [seatIndex, seatIndex === undercoverSeat ? "undercover" : "civilian"])
  );
  const promptsBySeat = Object.fromEntries(
    aliveSeats.map((seatIndex) => [
      seatIndex,
      rolesBySeat[seatIndex] === "undercover" ? pair.undercover : pair.civilian
    ])
  );

  return {
    stage: "clue",
    roundNo: 1,
    activeSeat: aliveSeats[0],
    aliveSeats,
    eliminatedSeats: [],
    rolesBySeat,
    promptsBySeat,
    clues: [],
    votes: {},
    pairIndex,
    reveal: null,
    winnerSide: null
  };
}

function submitUndercoverClue(round, seatIndex, text) {
  if (round.stage !== "clue") {
    throw new Error("目前不是描述階段");
  }

  if (round.activeSeat !== seatIndex) {
    throw new Error("還沒輪到你描述");
  }

  const clue = normalizeClue(text);
  const nextRound = cloneRound(round);
  nextRound.clues.push({
    roundNo: round.roundNo,
    seatIndex,
    text: clue
  });

  const currentRoundClueSeats = new Set(
    nextRound.clues.filter((entry) => entry.roundNo === round.roundNo).map((entry) => entry.seatIndex)
  );
  const nextSeat = nextRound.aliveSeats.find((candidate) => !currentRoundClueSeats.has(candidate));
  if (nextSeat !== undefined) {
    nextRound.activeSeat = nextSeat;
    return nextRound;
  }

  nextRound.stage = "vote";
  nextRound.activeSeat = null;
  nextRound.votes = {};
  return nextRound;
}

function submitUndercoverVote(round, seatIndex, targetSeat) {
  if (round.stage !== "vote") {
    throw new Error("目前不是投票階段");
  }

  if (!round.aliveSeats.includes(seatIndex)) {
    throw new Error("已出局玩家不能投票");
  }

  if (!round.aliveSeats.includes(targetSeat)) {
    throw new Error("投票目標不在場上");
  }

  if (seatIndex === targetSeat) {
    throw new Error("不能投給自己");
  }

  if (round.votes[seatIndex] !== undefined) {
    throw new Error("本輪已經投過票");
  }

  const nextRound = cloneRound(round);
  nextRound.votes[seatIndex] = targetSeat;

  if (Object.keys(nextRound.votes).length < nextRound.aliveSeats.length) {
    return nextRound;
  }

  return resolveUndercoverVote(nextRound);
}

function resolveUndercoverVote(round) {
  const counts = {};
  for (const targetSeat of Object.values(round.votes)) {
    counts[targetSeat] = (counts[targetSeat] || 0) + 1;
  }

  const ranked = Object.entries(counts)
    .map(([seatIndex, voteCount]) => ({ seatIndex: Number(seatIndex), voteCount }))
    .sort((left, right) => right.voteCount - left.voteCount || left.seatIndex - right.seatIndex);
  const eliminatedSeat = ranked[0]?.seatIndex;

  const nextRound = cloneRound(round);
  nextRound.reveal = {
    eliminatedSeat,
    eliminatedRole: nextRound.rolesBySeat[eliminatedSeat],
    civilianWord: WORD_PAIR_DECK[nextRound.pairIndex].civilian,
    undercoverWord: WORD_PAIR_DECK[nextRound.pairIndex].undercover,
    tally: counts
  };
  nextRound.eliminatedSeats.push(eliminatedSeat);
  nextRound.aliveSeats = nextRound.aliveSeats.filter((seat) => seat !== eliminatedSeat);
  nextRound.votes = {};

  if (nextRound.rolesBySeat[eliminatedSeat] === "undercover") {
    nextRound.stage = "finished";
    nextRound.activeSeat = null;
    nextRound.winnerSide = "civilian";
    return nextRound;
  }

  if (nextRound.aliveSeats.length <= 3) {
    nextRound.stage = "finished";
    nextRound.activeSeat = null;
    nextRound.winnerSide = "undercover";
    return nextRound;
  }

  nextRound.stage = "clue";
  nextRound.roundNo += 1;
  nextRound.activeSeat = nextRound.aliveSeats[0];
  return nextRound;
}

function normalizeClue(text) {
  const clue = String(text || "").trim().slice(0, 36);
  if (!clue) {
    throw new Error("描述不能為空");
  }
  return clue;
}

function normalizePairIndex(pairIndex) {
  const numeric = Number(pairIndex);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < WORD_PAIR_DECK.length) {
    return numeric;
  }
  return 0;
}

function normalizeUndercoverSeat(seatIndex, playerCount) {
  const numeric = Number(seatIndex);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < playerCount) {
    return numeric;
  }
  return 0;
}

function cloneRound(round) {
  return {
    ...round,
    aliveSeats: [...round.aliveSeats],
    eliminatedSeats: [...round.eliminatedSeats],
    rolesBySeat: { ...round.rolesBySeat },
    promptsBySeat: { ...round.promptsBySeat },
    clues: round.clues.map((entry) => ({ ...entry })),
    votes: { ...round.votes },
    reveal: round.reveal
      ? {
          ...round.reveal,
          tally: { ...round.reveal.tally }
        }
      : null
  };
}

module.exports = {
  WORD_PAIR_DECK,
  createUndercoverRound,
  submitUndercoverClue,
  submitUndercoverVote
};
