const SUITS = ["S", "H", "C", "D"];
const SUIT_LABELS = {
  S: "♠",
  H: "♥",
  C: "♣",
  D: "♦",
  BJ: "",
  RJ: ""
};

const RANK_LABELS = {
  3: "3",
  4: "4",
  5: "5",
  6: "6",
  7: "7",
  8: "8",
  9: "9",
  10: "10",
  11: "J",
  12: "Q",
  13: "K",
  14: "A",
  15: "2",
  16: "小王",
  17: "大王"
};

function createDeck(mode = "CLASSIC") {
  const deck = [];
  let index = 0;

  for (const rank of [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
    for (const suit of SUITS) {
      deck.push({
        id: `${rank}-${suit}-${index}`,
        rank,
        suit,
        label: `${RANK_LABELS[rank]}${SUIT_LABELS[suit]}`
      });
      index += 1;
    }
  }

  deck.push({
    id: `16-BJ-${index}`,
    rank: 16,
    suit: "BJ",
    label: RANK_LABELS[16]
  });
  index += 1;
  deck.push({
    id: `17-RJ-${index}`,
    rank: 17,
    suit: "RJ",
    label: RANK_LABELS[17]
  });

  if (mode === "NO_SHUFFLE") {
    return deck.sort((a, b) => a.rank - b.rank);
  }

  return shuffle(deck);
}

function shuffle(input) {
  const deck = [...input];

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.rank !== b.rank) {
      return b.rank - a.rank;
    }

    return a.suit.localeCompare(b.suit);
  });
}

function groupByRank(cards) {
  const map = new Map();

  for (const card of cards) {
    if (!map.has(card.rank)) {
      map.set(card.rank, []);
    }

    map.get(card.rank).push(card);
  }

  return new Map(
    [...map.entries()].sort((a, b) => a[0] - b[0]).map(([rank, groupedCards]) => [
      Number(rank),
      sortCards(groupedCards)
    ])
  );
}

function rankToLabel(rank) {
  return RANK_LABELS[rank] || String(rank);
}

function cardsToText(cards) {
  return sortCards(cards)
    .map((card) => card.label)
    .join(" ");
}

module.exports = {
  createDeck,
  sortCards,
  groupByRank,
  rankToLabel,
  cardsToText
};
