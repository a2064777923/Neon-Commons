const { findSuggestedPlay } = require("./combo");

function chooseBid(hand) {
  const score = hand.reduce((sum, card) => {
    let value = 0;
    if (card.rank >= 15) {
      value += 3;
    } else if (card.rank >= 13) {
      value += 2;
    } else if (card.rank >= 11) {
      value += 1;
    }

    return sum + value;
  }, 0);

  const bombs = hand.reduce((acc, card) => {
    acc[card.rank] = (acc[card.rank] || 0) + 1;
    return acc;
  }, {});
  const bombCount = Object.values(bombs).filter((count) => count >= 4).length;
  const total = score + bombCount * 3;

  if (total >= 22) {
    return 3;
  }

  if (total >= 16) {
    return 2;
  }

  if (total >= 10) {
    return 1;
  }

  return 0;
}

function choosePlay(hand, lastPlay) {
  return findSuggestedPlay(hand, lastPlay);
}

module.exports = {
  chooseBid,
  choosePlay
};
