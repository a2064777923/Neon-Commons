// Mahjong tile logic module (國標13張)
// Suits: 0=萬, 1=條, 2=筒, 3=風, 4=箭, 5=花

const TILE_SUITS = Object.freeze({
  WAN: 0,       // 萬
  TIAO: 1,      // 條
  TONG: 2,      // 筒
  WIND: 3,      // 風
  DRAGON: 4,    // 箭
  FLOWER: 5     // 花
});

const FAN_TABLE = Object.freeze({
  ALL_SEQUENCES: { name: "平胡", fan: 1, description: "All melds are sequences, pair is not a value tile" },
  ALL_TRIPLETS: { name: "碰碰胡", fan: 1, description: "All melds are triplets" },
  HALF_FLUSH: { name: "混一色", fan: 2, description: "One number suit + honor tiles" },
  FULL_FLUSH: { name: "清一色", fan: 6, description: "All tiles same number suit" },
  SEVEN_PAIRS: { name: "七對子", fan: 4, description: "Seven pairs" },
  THIRTEEN_ORPHANS: { name: "十三么", fan: 16, description: "Thirteen orphans" },
  BIG_THREE_DRAGONS: { name: "大三元", fan: 8, description: "Three dragon melds" },
  SMALL_THREE_DRAGONS: { name: "小三元", fan: 2, description: "Two dragon melds + dragon pair" },
  BIG_FOUR_WINDS: { name: "大四喜", fan: 16, description: "Four wind melds" },
  SMALL_FOUR_WINDS: { name: "小四喜", fan: 8, description: "Three wind melds + wind pair" },
  SELF_DRAWN: { name: "自摸", fan: 1, description: "Win by self-draw" },
  WIN_FROM_KONG: { name: "槓上開花", fan: 1, description: "Win on kong replacement draw" },
  ROBBING_KONG: { name: "搶槓胡", fan: 1, description: "Win on opponent's kong declaration" },
  FLOWER_TILES: { name: "花牌", fan: 1, description: "1 fan per flower tile" }
});

// ============================================================
// Tile Label Helpers
// ============================================================

function getTileLabel(suit, rank) {
  const wanLabels = ["", "一萬", "二萬", "三萬", "四萬", "五萬", "六萬", "七萬", "八萬", "九萬"];
  const tiaoLabels = ["", "一條", "二條", "三條", "四條", "五條", "六條", "七條", "八條", "九條"];
  const tongLabels = ["", "一筒", "二筒", "三筒", "四筒", "五筒", "六筒", "七筒", "八筒", "九筒"];
  if (suit === 0) return wanLabels[rank] || `萬${rank}`;
  if (suit === 1) return tiaoLabels[rank] || `條${rank}`;
  if (suit === 2) return tongLabels[rank] || `筒${rank}`;
  return `牌${suit}-${rank}`;
}

function getWindLabel(rank) {
  return ["東風", "南風", "西風", "北風"][rank] || `風${rank}`;
}

function getDragonLabel(rank) {
  return ["中", "發", "白"][rank] || `箭${rank}`;
}

function getFlowerLabel(rank) {
  return ["春", "夏", "秋", "冬", "梅", "蘭", "竹", "菊"][rank] || `花${rank}`;
}

// ============================================================
// Tile Set Creation & Utilities
// ============================================================

function createMahjongTileSet() {
  const tiles = [];
  let id = 0;

  // Number suits: 萬(0), 條(1), 筒(2) — ranks 1-9, 4 copies each
  for (let suit = 0; suit <= 2; suit++) {
    for (let rank = 1; rank <= 9; rank++) {
      for (let copy = 0; copy < 4; copy++) {
        tiles.push({ id: id++, suit, rank, label: getTileLabel(suit, rank) });
      }
    }
  }

  // Wind suit: 東(0)南(1)西(2)北(3), 4 copies each
  for (let rank = 0; rank <= 3; rank++) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: id++, suit: 3, rank, label: getWindLabel(rank) });
    }
  }

  // Dragon suit: 中(0)發(1)白(2), 4 copies each
  for (let rank = 0; rank <= 2; rank++) {
    for (let copy = 0; copy < 4; copy++) {
      tiles.push({ id: id++, suit: 4, rank, label: getDragonLabel(rank) });
    }
  }

  // Flower suit: 春(0)夏(1)秋(2)冬(3)梅(4)蘭(5)竹(6)菊(7), 1 copy each
  for (let rank = 0; rank <= 7; rank++) {
    tiles.push({ id: id++, suit: 5, rank, label: getFlowerLabel(rank) });
  }

  return tiles;
}

function shuffle(tiles) {
  const arr = [...tiles];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildWall(tiles) {
  const deadWall = tiles.slice(-14);
  const wall = tiles.slice(0, -14);
  return { wall, deadWall };
}

function isFlower(tile) {
  return tile.suit === 5;
}

function isHonor(tile) {
  return tile.suit === 3 || tile.suit === 4;
}

function tileValue(tile) {
  return tile.suit * 100 + tile.rank;
}

// ============================================================
// Claim Detection
// ============================================================

function detectClaims(discardedTile, hand, melds, isNextPlayer) {
  const claims = [];

  // Win check: add tile to hand and check
  const testHand = [...hand, discardedTile];
  if (detectWin(testHand, melds || [])) {
    claims.push({ type: "win", priority: 4, tiles: [discardedTile] });
  }

  // Kong: 3 of same tile in hand
  const matchingForKong = hand.filter(
    (t) => t.suit === discardedTile.suit && t.rank === discardedTile.rank
  );
  if (matchingForKong.length >= 3) {
    claims.push({
      type: "kong",
      priority: 3,
      tiles: [...matchingForKong.slice(0, 3), discardedTile]
    });
  }

  // Pong: 2 of same tile in hand
  const matchingForPong = hand.filter(
    (t) => t.suit === discardedTile.suit && t.rank === discardedTile.rank
  );
  if (matchingForPong.length >= 2) {
    claims.push({
      type: "pong",
      priority: 2,
      tiles: [...matchingForPong.slice(0, 2), discardedTile]
    });
  }

  // Chi: sequence (only next player, only number suits)
  if (isNextPlayer && discardedTile.suit <= 2) {
    const rank = discardedTile.rank;
    const suitHand = hand.filter((t) => t.suit === discardedTile.suit);

    // rank-2, rank-1, rank
    const t1 = suitHand.find((t) => t.rank === rank - 2);
    const t2 = suitHand.find((t) => t.rank === rank - 1);
    if (t1 && t2) {
      claims.push({
        type: "chi",
        priority: 1,
        tiles: [t1, t2, discardedTile]
      });
    }

    // rank-1, rank, rank+1
    const t3 = suitHand.find((t) => t.rank === rank - 1);
    const t4 = suitHand.find((t) => t.rank === rank + 1);
    if (t3 && t4) {
      // Avoid duplicate if rank-1 tile was already used in previous pattern
      const alreadyUsed = t1 && t2 && t3.rank === t2.rank && t3.id === t2.id;
      if (!alreadyUsed) {
        claims.push({
          type: "chi",
          priority: 1,
          tiles: [t3, discardedTile, t4]
        });
      }
    }

    // rank, rank+1, rank+2
    const t5 = suitHand.find((t) => t.rank === rank + 1);
    const t6 = suitHand.find((t) => t.rank === rank + 2);
    if (t5 && t6) {
      const alreadyUsed = t3 && t4 && t5.id === t4.id;
      if (!alreadyUsed) {
        claims.push({
          type: "chi",
          priority: 1,
          tiles: [discardedTile, t5, t6]
        });
      }
    }
  }

  return claims.sort((a, b) => b.priority - a.priority);
}

// ============================================================
// Win Detection (Recursive Backtracking)
// ============================================================

function detectWin(hand, melds) {
  melds = melds || [];
  if (!hand || hand.length === 0) return null;

  const handSize = hand.length;
  const meldCount = melds.length;

  // Try basic form: 4 melds + 1 pair total
  // hand tiles = (4 - meldCount) * 3 + 2
  const expectedHandSize = (4 - meldCount) * 3 + 2;
  if (handSize === expectedHandSize) {
    const result = tryBasicWin(hand, melds);
    if (result) return result;
  }

  // Try seven pairs: only if no melds and hand has 14 tiles
  if (meldCount === 0 && handSize === 14) {
    if (trySevenPairs(hand)) {
      return { type: "sevenPairs", melds: [], pair: null };
    }
  }

  // Try thirteen orphans: only if no melds and hand has 14 tiles
  if (meldCount === 0 && handSize === 14) {
    if (tryThirteenOrphans(hand)) {
      return { type: "thirteenOrphans", melds: [], pair: null };
    }
  }

  return null;
}

function tryBasicWin(hand, melds) {
  const neededMelds = 4 - melds.length;
  const sorted = [...hand].sort((a, b) => tileValue(a) - tileValue(b));

  // Try each possible pair
  for (let i = 0; i < sorted.length - 1; i++) {
    // Skip duplicate pair candidates
    if (i > 0 && sorted[i].suit === sorted[i - 1].suit && sorted[i].rank === sorted[i - 1].rank) continue;
    if (sorted[i].suit === sorted[i + 1].suit && sorted[i].rank === sorted[i + 1].rank) {
      const pair = [sorted[i], sorted[i + 1]];
      const remaining = [...sorted.slice(0, i), ...sorted.slice(i + 2)];
      const extractedMelds = extractMelds(remaining, neededMelds);
      if (extractedMelds !== null) {
        return {
          type: "basic",
          melds: [...melds, ...extractedMelds],
          pair
        };
      }
    }
  }
  return null;
}

function extractMelds(tiles, needed) {
  if (needed === 0 && tiles.length === 0) return [];
  if (tiles.length < needed * 3) return null;

  const sorted = [...tiles].sort((a, b) => tileValue(a) - tileValue(b));
  const first = sorted[0];

  // Try triplet
  if (sorted.length >= 3 &&
    sorted[1].suit === first.suit && sorted[1].rank === first.rank &&
    sorted[2].suit === first.suit && sorted[2].rank === first.rank) {
    const meldTiles = [sorted[0], sorted[1], sorted[2]];
    const remaining = sorted.slice(3);
    const rest = extractMelds(remaining, needed - 1);
    if (rest !== null) return [meldTiles, ...rest];
  }

  // Try sequence (only for number suits)
  if (first.suit <= 2) {
    const second = sorted.find(t => t.suit === first.suit && t.rank === first.rank + 1);
    const third = sorted.find(t => t.suit === first.suit && t.rank === first.rank + 2);
    if (second && third) {
      const remaining = [...sorted];
      const idx1 = remaining.findIndex(t => t.id === second.id);
      remaining.splice(idx1, 1);
      const idx2 = remaining.findIndex(t => t.id === third.id);
      remaining.splice(idx2, 1);
      remaining.shift(); // remove first
      const rest = extractMelds(remaining, needed - 1);
      if (rest !== null) return [[first, second, third], ...rest];
    }
  }

  return null;
}

function trySevenPairs(hand) {
  if (hand.length !== 14) return false;
  const sorted = [...hand].sort((a, b) => tileValue(a) - tileValue(b));
  for (let i = 0; i < 14; i += 2) {
    if (sorted[i].suit !== sorted[i + 1].suit || sorted[i].rank !== sorted[i + 1].rank) {
      return false;
    }
  }
  return true;
}

const ORPHAN_TILES = [
  { suit: 0, rank: 1 }, { suit: 0, rank: 9 },
  { suit: 1, rank: 1 }, { suit: 1, rank: 9 },
  { suit: 2, rank: 1 }, { suit: 2, rank: 9 },
  { suit: 3, rank: 0 }, { suit: 3, rank: 1 }, { suit: 3, rank: 2 }, { suit: 3, rank: 3 },
  { suit: 4, rank: 0 }, { suit: 4, rank: 1 }, { suit: 4, rank: 2 }
];

function tryThirteenOrphans(hand) {
  if (hand.length !== 14) return false;

  const counts = {};
  for (const tile of hand) {
    const key = `${tile.suit}-${tile.rank}`;
    counts[key] = (counts[key] || 0) + 1;
  }

  // Check each required orphan tile is present at least once
  for (const orphan of ORPHAN_TILES) {
    const key = `${orphan.suit}-${orphan.rank}`;
    if (!counts[key] || counts[key] < 1) return false;
  }

  // Check exactly 13 unique tiles, one appears twice
  const uniqueKeys = Object.keys(counts);
  if (uniqueKeys.length !== 13) return false;
  const values = Object.values(counts);
  const twos = values.filter(v => v === 2).length;
  return twos === 1;
}

// ============================================================
// Fan Scoring
// ============================================================

function isSequence(meld) {
  if (meld.length !== 3) return false;
  const sorted = [...meld].sort((a, b) => a.rank - b.rank);
  return sorted[0].suit <= 2 &&
    sorted[1].suit === sorted[0].suit && sorted[2].suit === sorted[0].suit &&
    sorted[1].rank === sorted[0].rank + 1 && sorted[2].rank === sorted[0].rank + 2;
}

function isTriplet(meld) {
  if (meld.length !== 3) return false;
  return meld[0].suit === meld[1].suit && meld[0].rank === meld[1].rank &&
    meld[0].suit === meld[2].suit && meld[0].rank === meld[2].rank;
}

function calculateFan(hand, melds, winTile, flowers, winMethod) {
  melds = melds || [];
  flowers = flowers || [];
  const fans = [];

  // Check if this is a winning hand
  const winResult = detectWin(hand, melds);
  if (!winResult) return { totalFan: 0, fans: [] };

  // Get all tiles for flush checks
  const allTiles = [...hand];
  for (const meld of melds) {
    for (const tile of meld) allTiles.push(tile);
  }

  // Thirteen orphans
  if (winResult.type === "thirteenOrphans") {
    fans.push({
      name: FAN_TABLE.THIRTEEN_ORPHANS.name,
      fan: FAN_TABLE.THIRTEEN_ORPHANS.fan,
      description: FAN_TABLE.THIRTEEN_ORPHANS.description
    });
  }

  // Seven pairs
  if (winResult.type === "sevenPairs") {
    fans.push({
      name: FAN_TABLE.SEVEN_PAIRS.name,
      fan: FAN_TABLE.SEVEN_PAIRS.fan,
      description: FAN_TABLE.SEVEN_PAIRS.description
    });
  }

  // Basic win type checks
  if (winResult.type === "basic") {
    const allMelds = winResult.melds || [];
    const pair = winResult.pair;

    // Check all sequences (平胡)
    const allSeq = allMelds.every(meld => isSequence(meld));
    const pairIsValueTile = pair && (isHonor(pair[0]) || pair[0].rank === 1 || pair[0].rank === 9);
    if (allSeq && !pairIsValueTile) {
      fans.push({
        name: FAN_TABLE.ALL_SEQUENCES.name,
        fan: FAN_TABLE.ALL_SEQUENCES.fan,
        description: FAN_TABLE.ALL_SEQUENCES.description
      });
    }

    // Check all triplets (碰碰胡)
    const allTriplet = allMelds.every(meld => isTriplet(meld));
    if (allTriplet) {
      fans.push({
        name: FAN_TABLE.ALL_TRIPLETS.name,
        fan: FAN_TABLE.ALL_TRIPLETS.fan,
        description: FAN_TABLE.ALL_TRIPLETS.description
      });
    }

    // Dragon melds
    const dragonMelds = allMelds.filter(meld => meld[0].suit === 4);
    if (dragonMelds.length === 3) {
      fans.push({
        name: FAN_TABLE.BIG_THREE_DRAGONS.name,
        fan: FAN_TABLE.BIG_THREE_DRAGONS.fan,
        description: FAN_TABLE.BIG_THREE_DRAGONS.description
      });
    } else if (dragonMelds.length === 2 && pair && pair[0].suit === 4) {
      fans.push({
        name: FAN_TABLE.SMALL_THREE_DRAGONS.name,
        fan: FAN_TABLE.SMALL_THREE_DRAGONS.fan,
        description: FAN_TABLE.SMALL_THREE_DRAGONS.description
      });
    }

    // Wind melds
    const windMelds = allMelds.filter(meld => meld[0].suit === 3);
    if (windMelds.length === 4) {
      fans.push({
        name: FAN_TABLE.BIG_FOUR_WINDS.name,
        fan: FAN_TABLE.BIG_FOUR_WINDS.fan,
        description: FAN_TABLE.BIG_FOUR_WINDS.description
      });
    } else if (windMelds.length === 3 && pair && pair[0].suit === 3) {
      fans.push({
        name: FAN_TABLE.SMALL_FOUR_WINDS.name,
        fan: FAN_TABLE.SMALL_FOUR_WINDS.fan,
        description: FAN_TABLE.SMALL_FOUR_WINDS.description
      });
    }
  }

  // Flush checks (applies to all win types except thirteen orphans)
  if (winResult.type !== "thirteenOrphans") {
    const numberSuits = allTiles.filter(t => t.suit <= 2).map(t => t.suit);
    const hasHonors = allTiles.some(t => isHonor(t));
    const uniqueSuits = [...new Set(numberSuits)];

    if (uniqueSuits.length === 1 && !hasHonors) {
      fans.push({
        name: FAN_TABLE.FULL_FLUSH.name,
        fan: FAN_TABLE.FULL_FLUSH.fan,
        description: FAN_TABLE.FULL_FLUSH.description
      });
    } else if (uniqueSuits.length === 1 && hasHonors) {
      fans.push({
        name: FAN_TABLE.HALF_FLUSH.name,
        fan: FAN_TABLE.HALF_FLUSH.fan,
        description: FAN_TABLE.HALF_FLUSH.description
      });
    }
  }

  // Self-drawn
  if (winMethod === "selfDrawn") {
    fans.push({
      name: FAN_TABLE.SELF_DRAWN.name,
      fan: FAN_TABLE.SELF_DRAWN.fan,
      description: FAN_TABLE.SELF_DRAWN.description
    });
  }

  // Win from kong
  if (winMethod === "kong") {
    fans.push({
      name: FAN_TABLE.WIN_FROM_KONG.name,
      fan: FAN_TABLE.WIN_FROM_KONG.fan,
      description: FAN_TABLE.WIN_FROM_KONG.description
    });
  }

  // Robbing kong
  if (winMethod === "robKong") {
    fans.push({
      name: FAN_TABLE.ROBBING_KONG.name,
      fan: FAN_TABLE.ROBBING_KONG.fan,
      description: FAN_TABLE.ROBBING_KONG.description
    });
  }

  // Flower tiles
  if (flowers.length > 0) {
    fans.push({
      name: FAN_TABLE.FLOWER_TILES.name,
      fan: flowers.length,
      description: `${flowers.length} flower tile(s)`
    });
  }

  const totalFan = fans.reduce((sum, f) => sum + f.fan, 0);
  return { totalFan, fans };
}

// ============================================================
// Module Exports
// ============================================================

module.exports = {
  createMahjongTileSet,
  shuffle,
  buildWall,
  detectClaims,
  detectWin,
  calculateFan,
  isFlower,
  isHonor,
  tileValue,
  TILE_SUITS,
  FAN_TABLE
};
