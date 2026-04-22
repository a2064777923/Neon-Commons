const { groupByRank, sortCards } = require("./cards");

const TYPE_WEIGHT = {
  single: 1,
  pair: 2,
  triple: 3,
  triple_single: 4,
  triple_pair: 5,
  straight: 6,
  double_straight: 7,
  plane: 8,
  plane_single: 9,
  plane_pair: 10,
  four_two_single: 11,
  four_two_pair: 12,
  bomb: 13,
  rocket: 14
};

function evaluateCards(cards) {
  const sorted = sortCards(cards);
  const size = sorted.length;
  const groups = groupByRank(sorted);
  const ranks = [...groups.keys()].sort((a, b) => a - b);
  const counts = ranks.map((rank) => groups.get(rank).length).sort((a, b) => b - a);

  if (size === 0) {
    return null;
  }

  if (size === 1) {
    return buildCombo("single", sorted, ranks[0], [ranks[0]]);
  }

  if (size === 2) {
    if (ranks.includes(16) && ranks.includes(17)) {
      return buildCombo("rocket", sorted, 17, [16, 17]);
    }

    if (groups.size === 1) {
      return buildCombo("pair", sorted, ranks[0], [ranks[0]]);
    }
  }

  if (size === 3 && groups.size === 1) {
    return buildCombo("triple", sorted, ranks[0], [ranks[0]]);
  }

  if (size === 4) {
    if (groups.size === 1) {
      return buildCombo("bomb", sorted, ranks[0], [ranks[0]]);
    }

    const tripleRank = findRankByCount(groups, 3);
    if (tripleRank) {
      return buildCombo("triple_single", sorted, tripleRank, [tripleRank]);
    }
  }

  if (size === 5) {
    if (isStraight(ranks, groups, 5)) {
      return buildCombo("straight", sorted, Math.max(...ranks), ranks);
    }

    const tripleRank = findRankByCount(groups, 3);
    const pairRank = findRankByCount(groups, 2);
    if (tripleRank && pairRank) {
      return buildCombo("triple_pair", sorted, tripleRank, [tripleRank]);
    }
  }

  if (isStraight(ranks, groups, size)) {
    return buildCombo("straight", sorted, Math.max(...ranks), ranks);
  }

  if (size >= 6 && size % 2 === 0 && isDoubleStraight(ranks, groups, size / 2)) {
    return buildCombo("double_straight", sorted, Math.max(...ranks), ranks);
  }

  const planeCombo = detectPlane(groups, size, sorted);
  if (planeCombo) {
    return planeCombo;
  }

  if (size === 6 && counts[0] === 4) {
    const mainRank = findRankByCount(groups, 4);
    return buildCombo("four_two_single", sorted, mainRank, [mainRank]);
  }

  if (size === 8 && counts[0] === 4 && counts[1] === 2 && counts[2] === 2) {
    const mainRank = findRankByCount(groups, 4);
    return buildCombo("four_two_pair", sorted, mainRank, [mainRank]);
  }

  return null;
}

function compareCombos(candidate, current) {
  if (!candidate || !current) {
    return false;
  }

  if (candidate.type === "rocket") {
    return current.type !== "rocket";
  }

  if (current.type === "rocket") {
    return false;
  }

  if (candidate.type === "bomb" && current.type !== "bomb") {
    return true;
  }

  if (candidate.type !== "bomb" && current.type === "bomb") {
    return false;
  }

  if (candidate.type !== current.type) {
    return false;
  }

  if (candidate.length !== current.length) {
    return false;
  }

  if (candidate.chainLength !== current.chainLength) {
    return false;
  }

  return candidate.mainRank > current.mainRank;
}

function findSuggestedPlay(hand, lastPlay = null, options = {}) {
  return listSuggestedPlays(hand, lastPlay, options)[0] || null;
}

function listSuggestedPlays(hand, lastPlay = null, options = {}) {
  const candidates = buildPlayCandidates(hand, options);
  const unique = dedupeCandidates(candidates);

  if (!lastPlay) {
    return unique.sort(sortOpeningCombo);
  }

  const sameType = unique
    .filter((combo) => combo.type === lastPlay.type && compareCombos(combo, lastPlay))
    .sort(sortFollowingCombo);

  if (sameType.length > 0) {
    return sameType;
  }

  if (lastPlay.type !== "bomb") {
    const bombs = unique
      .filter((combo) => combo.type === "bomb")
      .sort(sortFollowingCombo);
    if (bombs.length > 0) {
      return bombs;
    }
  }

  const rocket = unique.find((combo) => combo.type === "rocket");
  return rocket ? [rocket] : [];
}

function buildPlayCandidates(hand, options = {}) {
  const cards = sortCards(hand);
  const groups = groupByRank(cards);
  const candidates = [];
  const ranks = [...groups.keys()].sort((a, b) => a - b);
  const allowBomb = options.allowBomb !== false;
  const allowRocket = options.allowRocket !== false;

  for (const rank of ranks) {
    const grouped = groups.get(rank);
    candidates.push(buildCombo("single", [grouped[0]], rank, [rank]));

    if (grouped.length >= 2) {
      candidates.push(buildCombo("pair", grouped.slice(0, 2), rank, [rank]));
    }

    if (grouped.length >= 3) {
      candidates.push(buildCombo("triple", grouped.slice(0, 3), rank, [rank]));
    }

    if (allowBomb && grouped.length >= 4) {
      candidates.push(buildCombo("bomb", grouped.slice(0, 4), rank, [rank]));
    }
  }

  if (allowRocket && groups.has(16) && groups.has(17)) {
    candidates.push(
      buildCombo("rocket", [groups.get(17)[0], groups.get(16)[0]], 17, [16, 17])
    );
  }

  candidates.push(...buildTripleAttachments(groups));
  candidates.push(...buildStraights(groups));
  candidates.push(...buildDoubleStraights(groups));
  candidates.push(...buildPlanes(groups));
  candidates.push(...buildFourWithTwo(groups));

  return candidates;
}

function buildTripleAttachments(groups) {
  const result = [];
  const ranks = [...groups.keys()].sort((a, b) => a - b);

  for (const rank of ranks) {
    const tripleCards = groups.get(rank);
    if (tripleCards.length < 3) {
      continue;
    }

    for (const kickerRank of ranks) {
      if (kickerRank === rank) {
        continue;
      }

      const kickerCards = groups.get(kickerRank);
      result.push(
        buildCombo(
          "triple_single",
          [...tripleCards.slice(0, 3), kickerCards[0]],
          rank,
          [rank]
        )
      );

      if (kickerCards.length >= 2) {
        result.push(
          buildCombo(
            "triple_pair",
            [...tripleCards.slice(0, 3), ...kickerCards.slice(0, 2)],
            rank,
            [rank]
          )
        );
      }
    }
  }

  return result;
}

function buildStraights(groups) {
  const ranks = [...groups.keys()].filter((rank) => rank < 15).sort((a, b) => a - b);
  const chains = enumerateChains(ranks, 5);
  const result = [];

  for (const chain of chains) {
    result.push(
      buildCombo(
        "straight",
        chain.map((rank) => groups.get(rank)[0]),
        Math.max(...chain),
        chain
      )
    );
  }

  return result;
}

function buildDoubleStraights(groups) {
  const ranks = [...groups.keys()]
    .filter((rank) => rank < 15 && groups.get(rank).length >= 2)
    .sort((a, b) => a - b);
  const chains = enumerateChains(ranks, 3);
  const result = [];

  for (const chain of chains) {
    const cards = chain.flatMap((rank) => groups.get(rank).slice(0, 2));
    result.push(
      buildCombo("double_straight", cards, Math.max(...chain), chain, chain.length)
    );
  }

  return result;
}

function buildPlanes(groups) {
  const tripleRanks = [...groups.keys()]
    .filter((rank) => rank < 15 && groups.get(rank).length >= 3)
    .sort((a, b) => a - b);
  const chains = enumerateChains(tripleRanks, 2);
  const result = [];

  for (const chain of chains) {
    const chainCards = chain.flatMap((rank) => groups.get(rank).slice(0, 3));
    result.push(
      buildCombo("plane", chainCards, Math.max(...chain), chain, chain.length)
    );

    const singleAttachments = pickLowestSingles(groups, chain, chain.length);
    if (singleAttachments.length === chain.length) {
      result.push(
        buildCombo(
          "plane_single",
          [...chainCards, ...singleAttachments],
          Math.max(...chain),
          chain,
          chain.length
        )
      );
    }

    const pairAttachments = pickLowestPairs(groups, chain, chain.length);
    if (pairAttachments.length === chain.length * 2) {
      result.push(
        buildCombo(
          "plane_pair",
          [...chainCards, ...pairAttachments],
          Math.max(...chain),
          chain,
          chain.length
        )
      );
    }
  }

  return result;
}

function buildFourWithTwo(groups) {
  const result = [];
  const ranks = [...groups.keys()].sort((a, b) => a - b);

  for (const rank of ranks) {
    const grouped = groups.get(rank);
    if (grouped.length < 4) {
      continue;
    }

    const singles = pickLowestSingles(groups, [rank], 2);
    if (singles.length === 2) {
      result.push(
        buildCombo(
          "four_two_single",
          [...grouped.slice(0, 4), ...singles],
          rank,
          [rank]
        )
      );
    }

    const pairs = pickLowestPairs(groups, [rank], 2);
    if (pairs.length === 4) {
      result.push(
        buildCombo("four_two_pair", [...grouped.slice(0, 4), ...pairs], rank, [rank])
      );
    }
  }

  return result;
}

function pickLowestSingles(groups, excludeRanks, needed) {
  const picks = [];
  const exclude = new Set(excludeRanks);

  for (const rank of [...groups.keys()].sort((a, b) => a - b)) {
    if (exclude.has(rank)) {
      continue;
    }

    for (const card of groups.get(rank)) {
      picks.push(card);
      if (picks.length === needed) {
        return picks;
      }
    }
  }

  return picks;
}

function pickLowestPairs(groups, excludeRanks, neededPairs) {
  const picks = [];
  const exclude = new Set(excludeRanks);

  for (const rank of [...groups.keys()].sort((a, b) => a - b)) {
    if (exclude.has(rank)) {
      continue;
    }

    const grouped = groups.get(rank);
    if (grouped.length >= 2) {
      picks.push(...grouped.slice(0, 2));
      if (picks.length === neededPairs * 2) {
        return picks;
      }
    }
  }

  return picks;
}

function detectPlane(groups, size, sorted) {
  const tripleRanks = [...groups.keys()]
    .filter((rank) => rank < 15 && groups.get(rank).length >= 3)
    .sort((a, b) => a - b);
  const chains = enumerateChains(tripleRanks, 2).sort((a, b) => b.length - a.length);

  for (const chain of chains) {
    const chainLength = chain.length;
    const pureSize = chainLength * 3;
    const remaining = cloneGroups(groups);

    for (const rank of chain) {
      remaining.set(rank, remaining.get(rank) - 3);
    }

    if (size === pureSize && sumCounts(remaining) === 0) {
      return buildCombo(
        "plane",
        sorted,
        Math.max(...chain),
        chain,
        chainLength
      );
    }

    if (size === pureSize + chainLength && sumCounts(remaining) === chainLength) {
      return buildCombo(
        "plane_single",
        sorted,
        Math.max(...chain),
        chain,
        chainLength
      );
    }

    if (
      size === pureSize + chainLength * 2 &&
      sumCounts(remaining) === chainLength * 2 &&
      [...remaining.values()].every((count) => count === 0 || count === 2)
    ) {
      const pairCount = [...remaining.values()].filter((count) => count === 2).length;
      if (pairCount === chainLength) {
        return buildCombo(
          "plane_pair",
          sorted,
          Math.max(...chain),
          chain,
          chainLength
        );
      }
    }
  }

  return null;
}

function isStraight(ranks, groups, expectedLength) {
  if (ranks.length !== expectedLength || Math.max(...ranks) >= 15) {
    return false;
  }

  if (![...groups.values()].every((group) => group.length === 1)) {
    return false;
  }

  return isConsecutive(ranks);
}

function isDoubleStraight(ranks, groups, expectedPairs) {
  if (ranks.length !== expectedPairs || Math.max(...ranks) >= 15) {
    return false;
  }

  if (![...groups.values()].every((group) => group.length === 2)) {
    return false;
  }

  return isConsecutive(ranks);
}

function enumerateChains(ranks, minLength) {
  const result = [];
  let start = 0;

  while (start < ranks.length) {
    let end = start;
    while (end + 1 < ranks.length && ranks[end + 1] === ranks[end] + 1) {
      end += 1;
    }

    const chain = ranks.slice(start, end + 1);
    if (chain.length >= minLength) {
      for (let size = minLength; size <= chain.length; size += 1) {
        for (let offset = 0; offset + size <= chain.length; offset += 1) {
          result.push(chain.slice(offset, offset + size));
        }
      }
    }

    start = end + 1;
  }

  return result;
}

function dedupeCandidates(candidates) {
  const map = new Map();

  for (const combo of candidates) {
    const key = combo.cards
      .map((card) => card.id)
      .sort()
      .join("|");
    if (!map.has(key)) {
      map.set(key, combo);
    }
  }

  return [...map.values()];
}

function sortOpeningCombo(a, b) {
  const weightA = openingWeight(a);
  const weightB = openingWeight(b);

  if (weightA !== weightB) {
    return weightA - weightB;
  }

  if (a.mainRank !== b.mainRank) {
    return a.mainRank - b.mainRank;
  }

  return a.length - b.length;
}

function sortFollowingCombo(a, b) {
  if (a.type !== b.type) {
    return TYPE_WEIGHT[a.type] - TYPE_WEIGHT[b.type];
  }

  if (a.mainRank !== b.mainRank) {
    return a.mainRank - b.mainRank;
  }

  return a.length - b.length;
}

function openingWeight(combo) {
  switch (combo.type) {
    case "plane":
    case "plane_single":
    case "plane_pair":
      return 1;
    case "straight":
      return 2;
    case "double_straight":
      return 3;
    case "triple_pair":
      return 4;
    case "triple_single":
      return 5;
    case "pair":
      return 6;
    case "single":
      return 7;
    case "bomb":
      return 20;
    case "rocket":
      return 21;
    default:
      return 10;
  }
}

function buildCombo(type, cards, mainRank, orderedRanks, chainLength = 1) {
  return {
    type,
    cards: sortCards(cards),
    mainRank,
    orderedRanks,
    chainLength,
    length: cards.length
  };
}

function cloneGroups(groups) {
  return new Map([...groups.entries()].map(([rank, cards]) => [rank, cards.length]));
}

function sumCounts(countMap) {
  return [...countMap.values()].reduce((sum, count) => sum + count, 0);
}

function findRankByCount(groups, count) {
  for (const [rank, cards] of groups.entries()) {
    if (cards.length === count) {
      return rank;
    }
  }

  return null;
}

function isConsecutive(ranks) {
  for (let i = 1; i < ranks.length; i += 1) {
    if (ranks[i] !== ranks[i - 1] + 1) {
      return false;
    }
  }

  return true;
}

module.exports = {
  evaluateCards,
  compareCombos,
  findSuggestedPlay,
  listSuggestedPlays
};
