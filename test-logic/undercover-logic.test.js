const test = require("node:test");
const assert = require("node:assert/strict");

const {
  WORD_PAIR_DECK,
  createUndercoverRound,
  submitUndercoverClue,
  submitUndercoverVote
} = require("../lib/party/undercover");
const { getPartyRoomManager } = require("../lib/party/manager");
const { __testing: directoryTesting } = require("../lib/rooms/directory");

test("undercover round assigns exactly one secret role and prompt", () => {
  const round = createUndercoverRound(4, { undercoverSeat: 2, pairIndex: 1 });
  const roles = Object.values(round.rolesBySeat);

  assert.equal(roles.filter((role) => role === "undercover").length, 1);
  assert.equal(round.promptsBySeat[2], WORD_PAIR_DECK[1].undercover);
  assert.equal(round.promptsBySeat[0], WORD_PAIR_DECK[1].civilian);
});

test("vote tally eliminates the highest-voted player", () => {
  let round = moveToVote(createUndercoverRound(5, { undercoverSeat: 4 }));

  round = submitUndercoverVote(round, 0, 2);
  round = submitUndercoverVote(round, 1, 2);
  round = submitUndercoverVote(round, 2, 1);
  round = submitUndercoverVote(round, 3, 2);
  round = submitUndercoverVote(round, 4, 2);

  assert.equal(round.reveal.eliminatedSeat, 2);
  assert.equal(round.stage, "clue");
  assert.equal(round.aliveSeats.includes(2), false);
});

test("ties resolve deterministically to the lowest seat index among top votes", () => {
  let round = moveToVote(createUndercoverRound(5, { undercoverSeat: 4 }));

  round = submitUndercoverVote(round, 0, 1);
  round = submitUndercoverVote(round, 1, 2);
  round = submitUndercoverVote(round, 2, 1);
  round = submitUndercoverVote(round, 3, 2);
  round = submitUndercoverVote(round, 4, 3);

  assert.equal(round.reveal.eliminatedSeat, 1);
  assert.equal(round.stage, "clue");
});

test("round-end win conditions cover both civilian and undercover wins", () => {
  let civilianWin = moveToVote(createUndercoverRound(4, { undercoverSeat: 1 }));
  civilianWin = submitUndercoverVote(civilianWin, 0, 1);
  civilianWin = submitUndercoverVote(civilianWin, 1, 0);
  civilianWin = submitUndercoverVote(civilianWin, 2, 1);
  civilianWin = submitUndercoverVote(civilianWin, 3, 1);
  assert.equal(civilianWin.stage, "finished");
  assert.equal(civilianWin.winnerSide, "civilian");

  let undercoverWin = moveToVote(createUndercoverRound(4, { undercoverSeat: 0 }));
  undercoverWin = submitUndercoverVote(undercoverWin, 0, 2);
  undercoverWin = submitUndercoverVote(undercoverWin, 1, 2);
  undercoverWin = submitUndercoverVote(undercoverWin, 2, 1);
  undercoverWin = submitUndercoverVote(undercoverWin, 3, 2);
  assert.equal(undercoverWin.stage, "finished");
  assert.equal(undercoverWin.winnerSide, "undercover");
});

test("party manager keeps undercover rooms on the dedicated /undercover route", () => {
  directoryTesting.resetRoomDirectory();
  delete global.partyRoomManager;

  const manager = getPartyRoomManager();
  const owner = { id: 501, username: "owner501", displayName: "Owner 501" };
  const room = manager.createRoom(owner, "undercover", {
    visibility: "private",
    maxPlayers: 6
  });

  const entry = manager.buildRoomDirectoryEntry(room);
  assert.equal(entry.detailRoute, `/undercover/${room.roomNo}`);
  assert.equal(entry.guestAllowed, true);
});

test("party room viewer payload keeps ready and alive state for undercover players", (t) => {
  directoryTesting.resetRoomDirectory();
  delete global.partyRoomManager;

  const manager = getPartyRoomManager();
  const owner = { id: 777, username: "owner777", displayName: "Owner 777" };
  const room = manager.createRoom(owner, "undercover", {
    visibility: "private",
    maxPlayers: 6
  });

  manager.setReady(room.roomNo, owner.id, true);
  const waitingSnapshot = manager.serializeRoom(room, owner.id);
  assert.equal(waitingSnapshot.viewer.ready, true);
  assert.equal(waitingSnapshot.viewer.alive, true);

  manager.addBot(room.roomNo, owner.id, 3);
  const playingSnapshot = manager.serializeRoom(room, owner.id);
  assert.equal(playingSnapshot.state, "playing");
  assert.equal(playingSnapshot.viewer.alive, true);

  t.after(() => {
    clearTimeout(room.phaseTimer);
    manager.clearBotTimers(room);
  });
});

function moveToVote(round) {
  let current = round;
  for (const seatIndex of round.aliveSeats) {
    current = submitUndercoverClue(current, seatIndex, `描述-${seatIndex}`);
  }
  return current;
}
