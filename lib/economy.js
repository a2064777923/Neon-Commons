const { query } = require("./db");

function splitInteger(total, count) {
  if (count <= 0) {
    return [];
  }

  const base = Math.floor(total / count);
  const remainder = total % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function buildPotDeltas(players = [], winnerSeatIndexes = [], loserPenalty = 0) {
  const winners = [...new Set(winnerSeatIndexes.map((value) => Number(value)).filter(Number.isInteger))].sort(
    (left, right) => left - right
  );
  const winnerSet = new Set(winners);
  const deltas = Object.fromEntries(players.map((player) => [player.seatIndex, 0]));

  if (winnerSet.size === 0) {
    return deltas;
  }

  const losers = players.filter((player) => !winnerSet.has(player.seatIndex));
  const totalPool = losers.length * Math.max(0, Number(loserPenalty) || 0);

  losers.forEach((player) => {
    deltas[player.seatIndex] = -Math.max(0, Number(loserPenalty) || 0);
  });

  splitInteger(totalPool, winners.length).forEach((share, index) => {
    deltas[winners[index]] = share;
  });

  return deltas;
}

function buildStandardSettlements(
  players = [],
  { winnerSeatIndexes = [], loserPenalty = 0, winRank = 0, lossRank = 0, drawRank = 0 } = {}
) {
  const winnerSet = new Set(
    [...new Set(winnerSeatIndexes.map((value) => Number(value)).filter(Number.isInteger))]
  );
  const hasWinner = winnerSet.size > 0;
  const deltas = hasWinner ? buildPotDeltas(players, [...winnerSet], loserPenalty) : {};

  return players.map((player) => {
    const didWin = hasWinner && winnerSet.has(player.seatIndex);
    return {
      seatIndex: player.seatIndex,
      userId: player.userId,
      displayName: player.displayName,
      isBot: Boolean(player.isBot),
      delta: hasWinner ? deltas[player.seatIndex] || 0 : 0,
      outcome: hasWinner ? (didWin ? "win" : "loss") : "draw",
      rankScore: hasWinner ? (didWin ? winRank : lossRank) : drawRank,
      wins: didWin ? 1 : 0,
      losses: hasWinner && !didWin ? 1 : 0,
      totalGames: 1
    };
  });
}

async function applyUserSettlements(settlements = []) {
  for (const settlement of settlements) {
    if (!settlement || settlement.isBot || !Number.isInteger(Number(settlement.userId))) {
      continue;
    }

    await query(
      `
        UPDATE users
        SET
          coins = coins + $2,
          rank_score = rank_score + $3,
          wins = wins + $4,
          losses = losses + $5,
          landlord_wins = landlord_wins + $6,
          landlord_losses = landlord_losses + $7,
          farmer_wins = farmer_wins + $8,
          farmer_losses = farmer_losses + $9,
          total_games = total_games + $10,
          updated_at = NOW()
        WHERE id = $1
      `,
      [
        Number(settlement.userId),
        Number(settlement.delta || 0),
        Number(settlement.rankScore || 0),
        Number(settlement.wins || 0),
        Number(settlement.losses || 0),
        Number(settlement.landlordWins || 0),
        Number(settlement.landlordLosses || 0),
        Number(settlement.farmerWins || 0),
        Number(settlement.farmerLosses || 0),
        Number(settlement.totalGames ?? 1)
      ]
    );
  }
}

module.exports = {
  applyUserSettlements,
  buildPotDeltas,
  buildStandardSettlements
};
