const { findSuggestedPlay } = require("./combo");

function chooseBid(hand, options = {}) {
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
  const maxBid = Number.isFinite(Number(options.maxBid)) ? Number(options.maxBid) : 3;
  let desired = 0;

  if (total >= 26) {
    desired = 4;
  } else if (total >= 22) {
    desired = 3;
  } else if (total >= 16) {
    desired = 2;
  } else if (total >= 10) {
    desired = 1;
  }

  const allowedBids = Array.isArray(options.bidOptions)
    ? [...new Set(options.bidOptions.map((value) => Number(value)).filter((value) => value >= 0))]
        .sort((left, right) => left - right)
    : Array.from({ length: Math.max(1, maxBid) + 1 }, (_item, index) => index);
  const ceiling = Math.max(0, maxBid);
  const boundedDesired = Math.min(ceiling, desired);
  const affordable = allowedBids.filter((value) => value <= boundedDesired);
  return affordable.length > 0 ? affordable[affordable.length - 1] : 0;
}

function choosePlay(hand, lastPlay, options = {}) {
  return findSuggestedPlay(hand, lastPlay, options);
}

module.exports = {
  chooseBid,
  choosePlay
};
