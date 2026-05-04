/**
 * Mahjong tile logic module — STUB (awaiting plan 19-01 real implementation)
 * Exports all required functions with placeholder returns.
 */

const TILE_SUITS = Object.freeze({
  WAN: 0,       // 萬
  TIAO: 1,      // 條
  TONG: 2,      // 筒
  WIND: 3,      // 風
  DRAGON: 4,    // 箭
  FLOWER: 5     // 花
});

const FAN_TABLE = Object.freeze({
  pingHu: { name: "平胡", points: 1 },
  pengPengHu: { name: "碰碰胡", points: 1 },
  hunYiSe: { name: "混一色", points: 2 },
  qingYiSe: { name: "清一色", points: 4 },
  ziMo: { name: "自摸", points: 1 },
  gangShangKaiHua: { name: "槓上開花", points: 1 },
  qiangGangHu: { name: "搶槓胡", points: 1 },
  huaPai: { name: "花牌", points: 1 },
  xiaoSanYuan: { name: "小三元", points: 2 },
  daSanYuan: { name: "大三元", points: 8 },
  xiaoSiXi: { name: "小四喜", points: 8 },
  daSiXi: { name: "大四喜", points: 16 },
  qiDui: { name: "七對子", points: 4 },
  shiSanYao: { name: "十三么", points: 16 }
});

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
  // Last 14 tiles are the dead wall
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

function detectClaims(discardedTile, hand, melds, isNextPlayer) {
  const claims = [];
  const sameSuit = (t) => t.suit === discardedTile.suit && t.suit <= 2;

  // Win check: add tile to hand and check
  const testHand = [...hand, discardedTile];
  if (detectWin(testHand, melds)) {
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
  if (isNextPlayer && sameSuit(discardedTile)) {
    const rank = discardedTile.rank;
    const suitHand = hand.filter((t) => t.suit === discardedTile.suit && t.suit <= 2);

    // rank-2, rank-1, rank
    if (suitHand.some((t) => t.rank === rank - 2) && suitHand.some((t) => t.rank === rank - 1)) {
      claims.push({
        type: "chi",
        priority: 1,
        tiles: [
          suitHand.find((t) => t.rank === rank - 2),
          suitHand.find((t) => t.rank === rank - 1),
          discardedTile
        ],
        sequence: [rank - 2, rank - 1, rank]
      });
    }

    // rank-1, rank, rank+1
    if (suitHand.some((t) => t.rank === rank - 1) && suitHand.some((t) => t.rank === rank + 1)) {
      claims.push({
        type: "chi",
        priority: 1,
        tiles: [
          suitHand.find((t) => t.rank === rank - 1),
          discardedTile,
          suitHand.find((t) => t.rank === rank + 1)
        ],
        sequence: [rank - 1, rank, rank + 1]
      });
    }

    // rank, rank+1, rank+2
    if (suitHand.some((t) => t.rank === rank + 1) && suitHand.some((t) => t.rank === rank + 2)) {
      claims.push({
        type: "chi",
        priority: 1,
        tiles: [
          discardedTile,
          suitHand.find((t) => t.rank === rank + 1),
          suitHand.find((t) => t.rank === rank + 2)
        ],
        sequence: [rank, rank + 1, rank + 2]
      });
    }
  }

  return claims.sort((a, b) => b.priority - a.priority);
}

function detectWin(hand, melds) {
  if (!hand || hand.length === 0) return null;
  const allTiles = [...hand];
  const meldCount = (melds || []).length;

  // Standard: 4 melds + 1 pair (14 tiles when melds are separate)
  // If we have melds, hand should be 14 - meldCount*3 tiles
  // Try standard decomposition
  if (canWinStandard(allTiles)) {
    return { type: "standard", hand: allTiles };
  }

  // Seven pairs
  if (allTiles.length === 14 && canWinSevenPairs(allTiles)) {
    return { type: "sevenPairs", hand: allTiles };
  }

  // Thirteen orphans
  if (allTiles.length === 14 && canWinThirteenOrphans(allTiles)) {
    return { type: "thirteenOrphans", hand: allTiles };
  }

  return null;
}

function canWinStandard(tiles) {
  if (tiles.length % 3 !== 2) return false;
  const sorted = [...tiles].sort((a, b) => a.suit * 100 + a.rank - (b.suit * 100 + b.rank));

  // Try each pair
  for (let i = 0; i < sorted.length - 1; i++) {
    if (i > 0 && sorted[i].suit === sorted[i - 1].suit && sorted[i].rank === sorted[i - 1].rank) continue;
    if (sorted[i].suit === sorted[i + 1].suit && sorted[i].rank === sorted[i + 1].rank) {
      const remaining = [...sorted];
      remaining.splice(i + 1, 1);
      remaining.splice(i, 1);
      if (canFormMelds(remaining)) return true;
    }
  }
  return false;
}

function canFormMelds(tiles) {
  if (tiles.length === 0) return true;
  if (tiles.length % 3 !== 0) return false;

  const sorted = [...tiles].sort((a, b) => a.suit * 100 + a.rank - (b.suit * 100 + b.rank));
  const first = sorted[0];

  // Try triplet
  if (
    sorted.length >= 3 &&
    sorted[1].suit === first.suit && sorted[1].rank === first.rank &&
    sorted[2].suit === first.suit && sorted[2].rank === first.rank
  ) {
    const rest = sorted.slice(3);
    if (canFormMelds(rest)) return true;
  }

  // Try sequence (only number suits)
  if (first.suit <= 2) {
    const second = sorted.find((t) => t.suit === first.suit && t.rank === first.rank + 1);
    const third = sorted.find((t) => t.suit === first.suit && t.rank === first.rank + 2);
    if (second && third) {
      const rest = [...sorted];
      rest.splice(rest.indexOf(first), 1);
      rest.splice(rest.indexOf(second), 1);
      rest.splice(rest.indexOf(third), 1);
      if (canFormMelds(rest)) return true;
    }
  }

  return false;
}

function canWinSevenPairs(tiles) {
  if (tiles.length !== 14) return false;
  const sorted = [...tiles].sort((a, b) => a.suit * 100 + a.rank - (b.suit * 100 + b.rank));
  for (let i = 0; i < 14; i += 2) {
    if (sorted[i].suit !== sorted[i + 1].suit || sorted[i].rank !== sorted[i + 1].rank) {
      return false;
    }
  }
  return true;
}

function canWinThirteenOrphans(tiles) {
  if (tiles.length !== 14) return false;
  const required = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 9 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 1 }, { suit: 3, rank: 2 }, { suit: 3, rank: 3 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 1 }, { suit: 4, rank: 2 }
  ];

  const sorted = [...tiles].sort((a, b) => a.suit * 100 + a.rank - (b.suit * 100 + b.rank));
  let extraFound = false;

  for (const req of required) {
    const idx = sorted.findIndex((t) => t.suit === req.suit && t.rank === req.rank);
    if (idx === -1) return false;
    sorted.splice(idx, 1);
  }

  // Remaining 1 tile must be one of the 13 orphans
  if (sorted.length === 1) {
    const last = sorted[0];
    return required.some((r) => r.suit === last.suit && r.rank === last.rank);
  }

  return false;
}

function calculateFan(hand, melds, winTile, flowers, winMethod) {
  const fans = [];
  let totalPoints = 0;

  // Flower tiles
  const flowerCount = (flowers || []).length;
  if (flowerCount > 0) {
    fans.push({ name: FAN_TABLE.huaPai.name, points: flowerCount });
    totalPoints += flowerCount;
  }

  // Self-drawn
  if (winMethod === "selfDrawn") {
    fans.push({ name: FAN_TABLE.ziMo.name, points: FAN_TABLE.ziMo.points });
    totalPoints += FAN_TABLE.ziMo.points;
  }

  // Gang shang kai hua
  if (winMethod === "gangShang") {
    fans.push({ name: FAN_TABLE.gangShangKaiHua.name, points: FAN_TABLE.gangShangKaiHua.points });
    totalPoints += FAN_TABLE.gangShangKaiHua.points;
  }

  // Basic check: all sequences = ping hu
  const allMelds = melds || [];
  const hasTriplet = allMelds.some((m) => m.length === 3 && m[0].rank === m[1].rank);
  if (!hasTriplet && hand.length <= 2) {
    fans.push({ name: FAN_TABLE.pingHu.name, points: FAN_TABLE.pingHu.points });
    totalPoints += FAN_TABLE.pingHu.points;
  }

  if (fans.length === 0) {
    fans.push({ name: "基本胡", points: 1 });
    totalPoints = 1;
  }

  return { fans, totalPoints };
}

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
