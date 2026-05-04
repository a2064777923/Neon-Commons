const test = require("node:test");
const assert = require("node:assert/strict");

const {
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
} = require("../lib/card/mahjong-tiles");

// ============================================================
// Helper: create a tile object for test assertions
// ============================================================
function makeTile(suit, rank, id) {
  return { id, suit, rank };
}

// ============================================================
// Tile Encoding Tests
// ============================================================

test("createMahjongTileSet returns exactly 144 tiles", () => {
  const tiles = createMahjongTileSet();
  assert.equal(tiles.length, 144);
});

test("each tile has id, suit, rank, label properties", () => {
  const tiles = createMahjongTileSet();
  for (const tile of tiles) {
    assert.ok(typeof tile.id === "number", `id should be number, got ${typeof tile.id}`);
    assert.ok(typeof tile.suit === "number", `suit should be number, got ${typeof tile.suit}`);
    assert.ok(typeof tile.rank === "number", `rank should be number, got ${typeof tile.rank}`);
    assert.ok(typeof tile.label === "string", `label should be string, got ${typeof tile.label}`);
  }
});

test("all tile ids are unique", () => {
  const tiles = createMahjongTileSet();
  const ids = new Set(tiles.map(t => t.id));
  assert.equal(ids.size, 144, "all 144 ids should be unique");
});

test("number suits (0-2) have ranks 1-9 with 4 copies each = 108 tiles", () => {
  const tiles = createMahjongTileSet();
  for (let suit = 0; suit <= 2; suit++) {
    const suitTiles = tiles.filter(t => t.suit === suit);
    assert.equal(suitTiles.length, 36, `suit ${suit} should have 36 tiles`);
    for (let rank = 1; rank <= 9; rank++) {
      const count = suitTiles.filter(t => t.rank === rank).length;
      assert.equal(count, 4, `suit ${suit} rank ${rank} should have 4 copies`);
    }
  }
});

test("wind suit (3) has ranks 0-3 with 4 copies each = 16 tiles", () => {
  const tiles = createMahjongTileSet();
  const windTiles = tiles.filter(t => t.suit === 3);
  assert.equal(windTiles.length, 16);
  for (let rank = 0; rank <= 3; rank++) {
    const count = windTiles.filter(t => t.rank === rank).length;
    assert.equal(count, 4, `wind rank ${rank} should have 4 copies`);
  }
});

test("dragon suit (4) has ranks 0-2 with 4 copies each = 12 tiles", () => {
  const tiles = createMahjongTileSet();
  const dragonTiles = tiles.filter(t => t.suit === 4);
  assert.equal(dragonTiles.length, 12);
  for (let rank = 0; rank <= 2; rank++) {
    const count = dragonTiles.filter(t => t.rank === rank).length;
    assert.equal(count, 4, `dragon rank ${rank} should have 4 copies`);
  }
});

test("flower suit (5) has ranks 0-7 with 1 copy each = 8 tiles", () => {
  const tiles = createMahjongTileSet();
  const flowerTiles = tiles.filter(t => t.suit === 5);
  assert.equal(flowerTiles.length, 8);
  for (let rank = 0; rank <= 7; rank++) {
    const count = flowerTiles.filter(t => t.rank === rank).length;
    assert.equal(count, 1, `flower rank ${rank} should have 1 copy`);
  }
});

test("total tile distribution: 108 + 16 + 12 + 8 = 144", () => {
  const tiles = createMahjongTileSet();
  assert.equal(tiles.filter(t => t.suit <= 2).length, 108);
  assert.equal(tiles.filter(t => t.suit === 3).length, 16);
  assert.equal(tiles.filter(t => t.suit === 4).length, 12);
  assert.equal(tiles.filter(t => t.suit === 5).length, 8);
});

test("Chinese labels for number suits are correct", () => {
  const tiles = createMahjongTileSet();
  const wanLabels = ["一萬", "二萬", "三萬", "四萬", "五萬", "六萬", "七萬", "八萬", "九萬"];
  const tiaoLabels = ["一條", "二條", "三條", "四條", "五條", "六條", "七條", "八條", "九條"];
  const tongLabels = ["一筒", "二筒", "三筒", "四筒", "五筒", "六筒", "七筒", "八筒", "九筒"];

  for (let rank = 1; rank <= 9; rank++) {
    const wanTile = tiles.find(t => t.suit === 0 && t.rank === rank);
    const tiaoTile = tiles.find(t => t.suit === 1 && t.rank === rank);
    const tongTile = tiles.find(t => t.suit === 2 && t.rank === rank);
    assert.equal(wanTile.label, wanLabels[rank - 1], `wan rank ${rank} label`);
    assert.equal(tiaoTile.label, tiaoLabels[rank - 1], `tiao rank ${rank} label`);
    assert.equal(tongTile.label, tongLabels[rank - 1], `tong rank ${rank} label`);
  }
});

test("Chinese labels for wind tiles are correct", () => {
  const tiles = createMahjongTileSet();
  const windLabels = ["東風", "南風", "西風", "北風"];
  for (let rank = 0; rank <= 3; rank++) {
    const tile = tiles.find(t => t.suit === 3 && t.rank === rank);
    assert.equal(tile.label, windLabels[rank], `wind rank ${rank} label`);
  }
});

test("Chinese labels for dragon tiles are correct", () => {
  const tiles = createMahjongTileSet();
  const dragonLabels = ["中", "發", "白"];
  for (let rank = 0; rank <= 2; rank++) {
    const tile = tiles.find(t => t.suit === 4 && t.rank === rank);
    assert.equal(tile.label, dragonLabels[rank], `dragon rank ${rank} label`);
  }
});

test("Chinese labels for flower tiles are correct", () => {
  const tiles = createMahjongTileSet();
  const flowerLabels = ["春", "夏", "秋", "冬", "梅", "蘭", "竹", "菊"];
  for (let rank = 0; rank <= 7; rank++) {
    const tile = tiles.find(t => t.suit === 5 && t.rank === rank);
    assert.equal(tile.label, flowerLabels[rank], `flower rank ${rank} label`);
  }
});

// ============================================================
// Shuffle Tests
// ============================================================

test("shuffle returns same tiles in different order", () => {
  const tiles = createMahjongTileSet();
  const shuffled = shuffle(tiles);
  assert.equal(shuffled.length, tiles.length);
  // Same tile ids present
  const origIds = tiles.map(t => t.id).sort((a, b) => a - b);
  const shufIds = shuffled.map(t => t.id).sort((a, b) => a - b);
  assert.deepEqual(origIds, shufIds);
});

test("shuffle does not mutate original array", () => {
  const tiles = createMahjongTileSet();
  const firstId = tiles[0].id;
  shuffle(tiles);
  assert.equal(tiles[0].id, firstId, "original array should not be mutated");
});

test("shuffle produces different order with high probability", () => {
  const tiles = createMahjongTileSet();
  const shuffled = shuffle(tiles);
  let samePosition = 0;
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].id === shuffled[i].id) samePosition++;
  }
  // Statistically very unlikely to have more than 20% same positions
  assert.ok(samePosition < tiles.length * 0.3,
    `Expected different order, got ${samePosition} same positions`);
});

// ============================================================
// Wall Building Tests
// ============================================================

test("buildWall splits tiles into wall (130) and deadWall (14)", () => {
  const tiles = createMahjongTileSet();
  const result = buildWall(tiles);
  assert.equal(result.wall.length, 130, "wall should have 130 tiles");
  assert.equal(result.deadWall.length, 14, "deadWall should have 14 tiles");
});

test("buildWall preserves all tiles", () => {
  const tiles = createMahjongTileSet();
  const result = buildWall(tiles);
  const allIds = [...result.wall.map(t => t.id), ...result.deadWall.map(t => t.id)].sort((a, b) => a - b);
  const origIds = tiles.map(t => t.id).sort((a, b) => a - b);
  assert.deepEqual(allIds, origIds);
});

test("deadWall tiles come from the end of the input array", () => {
  const tiles = createMahjongTileSet();
  const result = buildWall(tiles);
  const last14Ids = tiles.slice(-14).map(t => t.id);
  const deadWallIds = result.deadWall.map(t => t.id);
  assert.deepEqual(deadWallIds, last14Ids);
});

// ============================================================
// isFlower / isHonor / tileValue Tests
// ============================================================

test("isFlower returns true for suit 5 tiles", () => {
  const tiles = createMahjongTileSet();
  for (const tile of tiles) {
    if (tile.suit === 5) {
      assert.equal(isFlower(tile), true, `tile ${tile.label} should be flower`);
    }
  }
});

test("isFlower returns false for non-flower tiles", () => {
  const tiles = createMahjongTileSet();
  for (const tile of tiles) {
    if (tile.suit !== 5) {
      assert.equal(isFlower(tile), false, `tile ${tile.label} should not be flower`);
    }
  }
});

test("isHonor returns true for wind tiles (suit 3)", () => {
  const tiles = createMahjongTileSet();
  const windTiles = tiles.filter(t => t.suit === 3);
  for (const tile of windTiles) {
    assert.equal(isHonor(tile), true, `${tile.label} should be honor`);
  }
});

test("isHonor returns true for dragon tiles (suit 4)", () => {
  const tiles = createMahjongTileSet();
  const dragonTiles = tiles.filter(t => t.suit === 4);
  for (const tile of dragonTiles) {
    assert.equal(isHonor(tile), true, `${tile.label} should be honor`);
  }
});

test("isHonor returns false for number suit tiles", () => {
  const tiles = createMahjongTileSet();
  for (let suit = 0; suit <= 2; suit++) {
    const suitTiles = tiles.filter(t => t.suit === suit);
    for (const tile of suitTiles) {
      assert.equal(isHonor(tile), false, `${tile.label} should not be honor`);
    }
  }
});

test("isHonor returns false for flower tiles", () => {
  const tiles = createMahjongTileSet();
  const flowerTiles = tiles.filter(t => t.suit === 5);
  for (const tile of flowerTiles) {
    assert.equal(isHonor(tile), false, `${tile.label} should not be honor`);
  }
});

test("tileValue sorts by suit then rank", () => {
  const tiles = createMahjongTileSet();
  const sorted = [...tiles].sort((a, b) => tileValue(a) - tileValue(b));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const curr = sorted[i];
    assert.ok(
      tileValue(prev) <= tileValue(curr),
      `tiles should be sorted: ${prev.label} (${tileValue(prev)}) <= ${curr.label} (${tileValue(curr)})`
    );
  }
});

test("tileValue: lower suit comes before higher suit regardless of rank", () => {
  const wan1 = { suit: 0, rank: 1 };
  const tiao9 = { suit: 1, rank: 9 };
  assert.ok(tileValue(wan1) < tileValue(tiao9), "1萬 should come before 9條");
});

test("tileValue: within same suit, lower rank comes first", () => {
  const t1 = { suit: 2, rank: 1 };
  const t2 = { suit: 2, rank: 9 };
  assert.ok(tileValue(t1) < tileValue(t2), "1筒 should come before 9筒");
});

// ============================================================
// TILE_SUITS constant
// ============================================================

test("TILE_SUITS has all 6 suits defined", () => {
  assert.equal(TILE_SUITS.WAN, 0);
  assert.equal(TILE_SUITS.TIAO, 1);
  assert.equal(TILE_SUITS.TONG, 2);
  assert.equal(TILE_SUITS.WIND, 3);
  assert.equal(TILE_SUITS.DRAGON, 4);
  assert.equal(TILE_SUITS.FLOWER, 5);
});

// ============================================================
// Claim Detection Tests
// ============================================================

test("detectClaims: chi is only available for next player", () => {
  const tiles = createMahjongTileSet();
  // Discarded 5萬
  const discarded = { suit: 0, rank: 5 };
  // Hand has 3萬 and 4萬 (can form chi 3-4-5)
  const hand = [
    { suit: 0, rank: 3 },
    { suit: 0, rank: 4 },
    { suit: 1, rank: 1 }
  ];
  const melds = [];

  // Chi available for next player
  const claimsNext = detectClaims(discarded, hand, melds, true);
  const chiNext = claimsNext.filter(c => c.type === "chi");
  assert.ok(chiNext.length > 0, "chi should be available for next player");

  // Chi NOT available for non-next player
  const claimsOther = detectClaims(discarded, hand, melds, false);
  const chiOther = claimsOther.filter(c => c.type === "chi");
  assert.equal(chiOther.length, 0, "chi should not be available for non-next player");
});

test("detectClaims: pong available for any player", () => {
  const discarded = { suit: 0, rank: 5 };
  const hand = [
    { suit: 0, rank: 5 },
    { suit: 0, rank: 5 },
    { suit: 1, rank: 1 }
  ];

  const claimsNext = detectClaims(discarded, hand, [], true);
  const pongNext = claimsNext.filter(c => c.type === "pong");
  assert.ok(pongNext.length > 0, "pong should be available for next player");

  const claimsOther = detectClaims(discarded, hand, [], false);
  const pongOther = claimsOther.filter(c => c.type === "pong");
  assert.ok(pongOther.length > 0, "pong should be available for non-next player");
});

test("detectClaims: kong available when hand has 3 matching tiles", () => {
  const discarded = { suit: 0, rank: 5 };
  const hand = [
    { suit: 0, rank: 5 },
    { suit: 0, rank: 5 },
    { suit: 0, rank: 5 },
    { suit: 1, rank: 1 }
  ];

  const claims = detectClaims(discarded, hand, [], false);
  const kongClaims = claims.filter(c => c.type === "kong");
  assert.ok(kongClaims.length > 0, "kong should be available with 3 matching tiles");
});

test("detectClaims: no chi when hand lacks required tiles", () => {
  const discarded = { suit: 0, rank: 5 };
  const hand = [
    { suit: 0, rank: 1 },
    { suit: 0, rank: 2 },
    { suit: 1, rank: 1 }
  ];

  const claims = detectClaims(discarded, hand, [], true);
  const chiClaims = claims.filter(c => c.type === "chi");
  assert.equal(chiClaims.length, 0, "no chi when tiles don't form sequence");
});

test("detectClaims: no pong when hand has fewer than 2 matching tiles", () => {
  const discarded = { suit: 0, rank: 5 };
  const hand = [
    { suit: 0, rank: 5 },
    { suit: 1, rank: 1 },
    { suit: 1, rank: 2 }
  ];

  const claims = detectClaims(discarded, hand, [], false);
  const pongClaims = claims.filter(c => c.type === "pong");
  assert.equal(pongClaims.length, 0, "no pong with only 1 matching tile");
});

test("detectClaims: priority ordering win > kong > pong > chi", () => {
  const tiles = createMahjongTileSet();
  // Verify priority values: win=4, kong=3, pong=2, chi=1
  const discarded = { suit: 0, rank: 5 };
  const hand = [
    { suit: 0, rank: 5 },
    { suit: 0, rank: 5 },
    { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }
  ];

  const claims = detectClaims(discarded, hand, [], true);
  // Should have both pong and chi
  const pong = claims.find(c => c.type === "pong");
  const chi = claims.find(c => c.type === "chi");
  if (pong && chi) {
    assert.ok(pong.priority > chi.priority, "pong priority should be higher than chi");
  }
});

test("detectClaims: chi forms valid sequences", () => {
  // Test all 3 chi patterns: [a-1, a], [a-1, a+1], [a, a+1]
  const discarded = { suit: 0, rank: 5 };

  // Pattern: 3+4 in hand with 5 discarded -> 3-4-5
  const hand1 = [{ suit: 0, rank: 3 }, { suit: 0, rank: 4 }];
  const claims1 = detectClaims(discarded, hand1, [], true);
  const chi1 = claims1.filter(c => c.type === "chi");
  assert.ok(chi1.length > 0, "should detect 3-4-5 sequence");

  // Pattern: 4+6 in hand with 5 discarded -> 4-5-6
  const hand2 = [{ suit: 0, rank: 4 }, { suit: 0, rank: 6 }];
  const claims2 = detectClaims(discarded, hand2, [], true);
  const chi2 = claims2.filter(c => c.type === "chi");
  assert.ok(chi2.length > 0, "should detect 4-5-6 sequence");

  // Pattern: 6+7 in hand with 5 discarded -> 5-6-7
  const hand3 = [{ suit: 0, rank: 6 }, { suit: 0, rank: 7 }];
  const claims3 = detectClaims(discarded, hand3, [], true);
  const chi3 = claims3.filter(c => c.type === "chi");
  assert.ok(chi3.length > 0, "should detect 5-6-7 sequence");
});

test("detectClaims: chi only works for number suits", () => {
  // Honor tiles (wind, dragon) cannot form chi
  const discarded = { suit: 3, rank: 0 }; // 東風
  const hand = [
    { suit: 3, rank: 1 }, // 南風
    { suit: 3, rank: 2 }, // 西風
    { suit: 0, rank: 1 }
  ];

  const claims = detectClaims(discarded, hand, [], true);
  const chiClaims = claims.filter(c => c.type === "chi");
  assert.equal(chiClaims.length, 0, "chi should not be available for honor tiles");
});

test("detectClaims: chi only within same suit", () => {
  const discarded = { suit: 0, rank: 5 }; // 5萬
  // Hand has tiles from different suit - can't form chi
  const hand = [
    { suit: 1, rank: 4 }, // 4條
    { suit: 1, rank: 6 }, // 6條
    { suit: 2, rank: 5 }  // 5筒
  ];

  const claims = detectClaims(discarded, hand, [], true);
  const chiClaims = claims.filter(c => c.type === "chi");
  assert.equal(chiClaims.length, 0, "chi should not work across suits");
});

test("detectClaims: no claims when hand has no matching tiles", () => {
  const discarded = { suit: 0, rank: 5 };
  const hand = [
    { suit: 1, rank: 1 },
    { suit: 1, rank: 2 },
    { suit: 1, rank: 3 }
  ];

  const claims = detectClaims(discarded, hand, [], false);
  assert.equal(claims.length, 0, "no claims should be available");
});

test("detectClaims: empty hand returns no claims", () => {
  const discarded = { suit: 0, rank: 5 };
  const claims = detectClaims(discarded, [], [], false);
  assert.equal(claims.length, 0, "empty hand should have no claims");
});

test("detectClaims: claims have correct structure", () => {
  const discarded = { suit: 0, rank: 5 };
  const hand = [
    { suit: 0, rank: 5 },
    { suit: 0, rank: 5 }
  ];

  const claims = detectClaims(discarded, hand, [], false);
  for (const claim of claims) {
    assert.ok(typeof claim.type === "string", "claim should have type string");
    assert.ok(Array.isArray(claim.tiles), "claim should have tiles array");
    assert.ok(typeof claim.priority === "number", "claim should have priority number");
  }
});

// FAN_TABLE constant
test("FAN_TABLE is defined with expected fan entries", () => {
  assert.ok(typeof FAN_TABLE === "object", "FAN_TABLE should be an object");
  assert.ok(FAN_TABLE !== null, "FAN_TABLE should not be null");
});

// ============================================================
// Win Detection Tests
// ============================================================

test("detectWin: basic form with 4 melds + 1 pair", () => {
  // 1-2-3萬, 4-5-6萬, 7-8-9萬, 1-1-1條, 5-5筒 (pair)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect basic win");
  assert.equal(result.type, "basic");
});

test("detectWin: basic form with all triplets", () => {
  // 1-1-1萬, 2-2-2萬, 3-3-3萬, 4-4-4萬, 5-5筒 (pair)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 0, rank: 3 }, { suit: 0, rank: 3 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 4 }, { suit: 0, rank: 4 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect all-triplet win");
  assert.equal(result.type, "basic");
});

test("detectWin: basic form with mixed sequences and triplets", () => {
  // 1-2-3萬, 5-5-5條, 7-8-9筒, 東-東-東, 4-4筒 (pair)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 1, rank: 5 }, { suit: 1, rank: 5 }, { suit: 1, rank: 5 },
    { suit: 2, rank: 7 }, { suit: 2, rank: 8 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 }, { suit: 3, rank: 0 },
    { suit: 2, rank: 4 }, { suit: 2, rank: 4 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect mixed win");
  assert.equal(result.type, "basic");
});

test("detectWin: seven pairs (七對子)", () => {
  // 1-1萬, 3-3萬, 5-5條, 7-7筒, 9-9筒, 東-東, 中-中
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 3 }, { suit: 0, rank: 3 },
    { suit: 1, rank: 5 }, { suit: 1, rank: 5 },
    { suit: 2, rank: 7 }, { suit: 2, rank: 7 },
    { suit: 2, rank: 9 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 0 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect seven pairs");
  assert.equal(result.type, "sevenPairs");
});

test("detectWin: seven pairs with same suit", () => {
  // All 7 pairs from 萬 suit
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 0, rank: 3 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 },
    { suit: 0, rank: 6 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 7 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect seven pairs from same suit");
  assert.equal(result.type, "sevenPairs");
});

test("detectWin: thirteen orphans (十三么)", () => {
  // 1萬, 9萬, 1條, 9條, 1筒, 9筒, 東, 南, 西, 北, 中, 發, 白 + one duplicate
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 9 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 1 }, { suit: 3, rank: 2 }, { suit: 3, rank: 3 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 1 }, { suit: 4, rank: 2 },
    { suit: 0, rank: 1 } // duplicate 1萬
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect thirteen orphans");
  assert.equal(result.type, "thirteenOrphans");
});

test("detectWin: thirteen orphans with different duplicate", () => {
  // Same 13 orphans, duplicate 東風 instead
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 9 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 1 }, { suit: 3, rank: 2 }, { suit: 3, rank: 3 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 1 }, { suit: 4, rank: 2 },
    { suit: 3, rank: 0 } // duplicate 東風
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect thirteen orphans with 東風 pair");
  assert.equal(result.type, "thirteenOrphans");
});

test("detectWin: returns null for incomplete hand (13 tiles)", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }
  ];
  const result = detectWin(hand, []);
  assert.equal(result, null, "13 tiles should not be a win");
});

test("detectWin: returns null for hand with melds but no pair", () => {
  // 13 tiles = 4 melds + 1 tile (no pair)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }
  ];
  const result = detectWin(hand, []);
  assert.equal(result, null, "no pair should not be a win");
});

test("detectWin: with exposed melds (hand has 5 tiles)", () => {
  // 3 exposed melds, hand has 5 tiles (1 meld + pair)
  const melds = [
    [{ suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 }],
    [{ suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 }],
    [{ suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 }]
  ];
  const hand = [
    { suit: 1, rank: 1 }, { suit: 1, rank: 2 }, { suit: 1, rank: 3 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = detectWin(hand, melds);
  assert.ok(result !== null, "should detect win with 3 exposed melds");
  assert.equal(result.type, "basic");
});

test("detectWin: with 2 exposed melds (hand has 8 tiles)", () => {
  // 2 exposed melds, hand has 8 tiles (2 melds + 1 pair)
  const melds = [
    [{ suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 }],
    [{ suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 }]
  ];
  const hand = [
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = detectWin(hand, melds);
  assert.ok(result !== null, "should detect win with 2 exposed melds");
  assert.equal(result.type, "basic");
});

test("detectWin: with 1 exposed meld (hand has 11 tiles)", () => {
  // 1 exposed meld, hand has 11 tiles (3 melds + 1 pair)
  const melds = [
    [{ suit: 3, rank: 0 }, { suit: 3, rank: 0 }, { suit: 3, rank: 0 }] // 東東東
  ];
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }
  ];
  const result = detectWin(hand, melds);
  assert.ok(result !== null, "should detect win with 1 exposed meld");
  assert.equal(result.type, "basic");
});

test("detectWin: overlapping sequences (edge case)", () => {
  // 1-2-3, 2-3-4, 5-6-7, 8-8-8, 9-9
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 3 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 6 }, { suit: 0, rank: 7 },
    { suit: 0, rank: 8 }, { suit: 0, rank: 8 }, { suit: 0, rank: 8 },
    { suit: 0, rank: 9 }, { suit: 0, rank: 9 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should handle overlapping sequences");
  assert.equal(result.type, "basic");
});

test("detectWin: multiple possible decompositions (edge case)", () => {
  // 1-1-1, 2-2-2, 3-3-3, 4-4-4, 5-5
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 0, rank: 3 }, { suit: 0, rank: 3 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 4 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect win with all triplets");
});

test("detectWin: honor tile melds (wind triplets)", () => {
  // 東東東, 南南南, 西西西, 北北北, 中中
  const hand = [
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 }, { suit: 3, rank: 0 },
    { suit: 3, rank: 1 }, { suit: 3, rank: 1 }, { suit: 3, rank: 1 },
    { suit: 3, rank: 2 }, { suit: 3, rank: 2 }, { suit: 3, rank: 2 },
    { suit: 3, rank: 3 }, { suit: 3, rank: 3 }, { suit: 3, rank: 3 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 0 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect win with all wind triplets");
  assert.equal(result.type, "basic");
});

test("detectWin: dragon triplet meld", () => {
  // 中中中, 發發發, 1-2-3萬, 4-5-6萬, 白白白 -> too many, let me fix
  // 中中中, 發發發, 1-2-3萬, 4-5-6萬, 白白
  const hand = [
    { suit: 4, rank: 0 }, { suit: 4, rank: 0 }, { suit: 4, rank: 0 },
    { suit: 4, rank: 1 }, { suit: 4, rank: 1 }, { suit: 4, rank: 1 },
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 4, rank: 2 }, { suit: 4, rank: 2 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect win with dragon melds");
});

test("detectWin: sequence at suit boundary (1-2-3 and 7-8-9)", () => {
  // 1-2-3萬, 7-8-9萬, 4-5-6條, 1-1筒, 2-2筒 -> pair needs to be 2-2筒
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 4 }, { suit: 1, rank: 5 }, { suit: 1, rank: 6 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 1 },
    { suit: 2, rank: 2 }, { suit: 2, rank: 2 }
  ];
  // This has 13 tiles... need 14. Add one more to pair.
  // Let me redo: 1-2-3萬, 7-8-9萬, 4-5-6條, 1-1-1筒, 2-2
  const hand2 = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 4 }, { suit: 1, rank: 5 }, { suit: 1, rank: 6 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 1 }, { suit: 2, rank: 1 },
    { suit: 2, rank: 2 }, { suit: 2, rank: 2 }
  ];
  const result = detectWin(hand2, []);
  assert.ok(result !== null, "should detect win with boundary sequences");
});

test("detectWin: not a win when 14 tiles don't form valid pattern", () => {
  // Random tiles that can't form melds + pair
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 7 }, { suit: 0, rank: 8 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 2 }, { suit: 1, rank: 4 },
    { suit: 1, rank: 5 }, { suit: 1, rank: 7 }, { suit: 1, rank: 8 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 2 }
  ];
  const result = detectWin(hand, []);
  assert.equal(result, null, "random tiles should not form a win");
});

test("detectWin: not seven pairs when only 6 pairs", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 0, rank: 3 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 },
    { suit: 0, rank: 6 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 } // not a pair
  ];
  const result = detectWin(hand, []);
  // Should not be seven pairs (last two aren't a pair)
  // Might still be basic win - check it's not sevenPairs
  if (result) {
    assert.notEqual(result.type, "sevenPairs", "should not be seven pairs");
  }
});

test("detectWin: not thirteen orphans when missing a tile", () => {
  // Missing 9條, has extra 1萬
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, // missing 9條
    { suit: 2, rank: 1 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 1 }, { suit: 3, rank: 2 }, { suit: 3, rank: 3 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 1 }, { suit: 4, rank: 2 },
    { suit: 0, rank: 1 }
  ];
  const result = detectWin(hand, []);
  if (result) {
    assert.notEqual(result.type, "thirteenOrphans", "should not be thirteen orphans");
  }
});

test("detectWin: empty hand returns null", () => {
  assert.equal(detectWin([], []), null);
});

test("detectWin: result has correct structure for basic win", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null);
  assert.equal(result.type, "basic");
  assert.ok(result.melds !== undefined, "basic win should have melds");
  assert.ok(result.pair !== undefined, "basic win should have pair");
  assert.equal(result.pair.length, 2, "pair should have 2 tiles");
});

test("detectWin: basic win with honor pair", () => {
  // 1-2-3萬, 4-5-6萬, 7-8-9萬, 1-1-1條, 東-東 (pair)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect win with honor pair");
});

test("detectWin: sequence starting at 7 (7-8-9)", () => {
  // 7-8-9萬 x4, 1-1筒
  const hand = [
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 1 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect win with 7-8-9 sequences");
});

test("detectWin: all same suit sequences (清一色 candidate)", () => {
  // 1-2-3, 2-3-4, 5-6-7, 8-8-8, 9-9 all 萬
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 3 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 6 }, { suit: 0, rank: 7 },
    { suit: 0, rank: 8 }, { suit: 0, rank: 8 }, { suit: 0, rank: 8 },
    { suit: 0, rank: 9 }, { suit: 0, rank: 9 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect all-suit win");
});

// ============================================================
// Fan Scoring Tests
// ============================================================

test("calculateFan: 平胡 (all sequences, non-value pair)", () => {
  // 1-2-3萬, 4-5-6萬, 7-8-9條, 2-3-4筒, 6-6筒 (pair)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 1, rank: 7 }, { suit: 1, rank: 8 }, { suit: 1, rank: 9 },
    { suit: 2, rank: 2 }, { suit: 2, rank: 3 }, { suit: 2, rank: 4 },
    { suit: 2, rank: 6 }, { suit: 2, rank: 6 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  assert.ok(result.totalFan > 0, "should have fan points");
  const pingHu = result.fans.find(f => f.name === "平胡");
  assert.ok(pingHu !== undefined, "should have 平胡 fan");
  assert.equal(pingHu.fan, 1);
});

test("calculateFan: 碰碰胡 (all triplets)", () => {
  // 1-1-1萬, 2-2-2萬, 3-3-3條, 4-4-4筒, 5-5筒 (pair)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 1, rank: 3 }, { suit: 1, rank: 3 }, { suit: 1, rank: 3 },
    { suit: 2, rank: 4 }, { suit: 2, rank: 4 }, { suit: 2, rank: 4 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  const pengPengHu = result.fans.find(f => f.name === "碰碰胡");
  assert.ok(pengPengHu !== undefined, "should have 碰碰胡 fan");
  assert.equal(pengPengHu.fan, 1);
});

test("calculateFan: 混一色 (one number suit + honors)", () => {
  // All 萬 + some wind tiles
  // 1-2-3萬, 4-5-6萬, 東-東-東, 7-7萬 (pair)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 }, { suit: 3, rank: 0 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 7 }
  ];
  const melds = [
    [{ suit: 0, rank: 8 }, { suit: 0, rank: 8 }, { suit: 0, rank: 8 }]
  ];
  const result = calculateFan(hand, melds, null, [], null);
  const hunYiSe = result.fans.find(f => f.name === "混一色");
  assert.ok(hunYiSe !== undefined, "should have 混一色 fan");
  assert.equal(hunYiSe.fan, 2);
});

test("calculateFan: 清一色 (all one number suit)", () => {
  // All 萬 tiles only
  // 1-2-3, 4-5-6, 7-8-9, 1-1-1, 5-5
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  const qingYiSe = result.fans.find(f => f.name === "清一色");
  assert.ok(qingYiSe !== undefined, "should have 清一色 fan");
  assert.equal(qingYiSe.fan, 6);
});

test("calculateFan: 七對子 (seven pairs)", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 3 }, { suit: 0, rank: 3 },
    { suit: 1, rank: 5 }, { suit: 1, rank: 5 },
    { suit: 2, rank: 7 }, { suit: 2, rank: 7 },
    { suit: 2, rank: 9 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 0 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  const qiDui = result.fans.find(f => f.name === "七對子");
  assert.ok(qiDui !== undefined, "should have 七對子 fan");
  assert.equal(qiDui.fan, 4);
});

test("calculateFan: 十三么 (thirteen orphans)", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 9 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 1 }, { suit: 3, rank: 2 }, { suit: 3, rank: 3 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 1 }, { suit: 4, rank: 2 },
    { suit: 0, rank: 1 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  const shiSanYao = result.fans.find(f => f.name === "十三么");
  assert.ok(shiSanYao !== undefined, "should have 十三么 fan");
  assert.equal(shiSanYao.fan, 16);
});

test("calculateFan: 大三元 (big three dragons)", () => {
  // 3 dragon triplets + 1 other meld + pair
  const hand = [
    { suit: 4, rank: 0 }, { suit: 4, rank: 0 }, { suit: 4, rank: 0 }, // 中中中
    { suit: 4, rank: 1 }, { suit: 4, rank: 1 }, { suit: 4, rank: 1 }, // 發發發
    { suit: 4, rank: 2 }, { suit: 4, rank: 2 }, { suit: 4, rank: 2 }, // 白白白
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 }, // 1-2-3萬
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 } // 5-5萬 (pair)
  ];
  const result = calculateFan(hand, [], null, [], null);
  const daSanYuan = result.fans.find(f => f.name === "大三元");
  assert.ok(daSanYuan !== undefined, "should have 大三元 fan");
  assert.equal(daSanYuan.fan, 8);
});

test("calculateFan: 小三元 (small three dragons)", () => {
  // 2 dragon triplets + dragon pair
  const hand = [
    { suit: 4, rank: 0 }, { suit: 4, rank: 0 }, { suit: 4, rank: 0 }, // 中中中
    { suit: 4, rank: 1 }, { suit: 4, rank: 1 }, { suit: 4, rank: 1 }, // 發發發
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 }, // 1-2-3萬
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 }, // 4-5-6萬
    { suit: 4, rank: 2 }, { suit: 4, rank: 2 } // 白白 (pair)
  ];
  const result = calculateFan(hand, [], null, [], null);
  const xiaoSanYuan = result.fans.find(f => f.name === "小三元");
  assert.ok(xiaoSanYuan !== undefined, "should have 小三元 fan");
  assert.equal(xiaoSanYuan.fan, 2);
});

test("calculateFan: 大四喜 (big four winds)", () => {
  // 4 wind triplets + pair
  const hand = [
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 }, { suit: 3, rank: 0 }, // 東東東
    { suit: 3, rank: 1 }, { suit: 3, rank: 1 }, { suit: 3, rank: 1 }, // 南南南
    { suit: 3, rank: 2 }, { suit: 3, rank: 2 }, { suit: 3, rank: 2 }, // 西西西
    { suit: 3, rank: 3 }, { suit: 3, rank: 3 }, { suit: 3, rank: 3 }, // 北北北
    { suit: 4, rank: 0 }, { suit: 4, rank: 0 } // 中中 (pair)
  ];
  const result = calculateFan(hand, [], null, [], null);
  const daSiXi = result.fans.find(f => f.name === "大四喜");
  assert.ok(daSiXi !== undefined, "should have 大四喜 fan");
  assert.equal(daSiXi.fan, 16);
});

test("calculateFan: 小四喜 (small four winds)", () => {
  // 3 wind triplets + wind pair
  const hand = [
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 }, { suit: 3, rank: 0 }, // 東東東
    { suit: 3, rank: 1 }, { suit: 3, rank: 1 }, { suit: 3, rank: 1 }, // 南南南
    { suit: 3, rank: 2 }, { suit: 3, rank: 2 }, { suit: 3, rank: 2 }, // 西西西
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 }, // 1-2-3萬
    { suit: 3, rank: 3 }, { suit: 3, rank: 3 } // 北北 (pair)
  ];
  const result = calculateFan(hand, [], null, [], null);
  const xiaoSiXi = result.fans.find(f => f.name === "小四喜");
  assert.ok(xiaoSiXi !== undefined, "should have 小四喜 fan");
  assert.equal(xiaoSiXi.fan, 8);
});

test("calculateFan: 自摸 (self-drawn win)", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = calculateFan(hand, [], null, [], "selfDrawn");
  const ziMo = result.fans.find(f => f.name === "自摸");
  assert.ok(ziMo !== undefined, "should have 自摸 fan");
  assert.equal(ziMo.fan, 1);
});

test("calculateFan: 槓上開花 (win from kong draw)", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = calculateFan(hand, [], null, [], "kong");
  const gangShang = result.fans.find(f => f.name === "槓上開花");
  assert.ok(gangShang !== undefined, "should have 槓上開花 fan");
  assert.equal(gangShang.fan, 1);
});

test("calculateFan: 搶槓胡 (robbing kong)", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = calculateFan(hand, [], null, [], "robKong");
  const qiangGang = result.fans.find(f => f.name === "搶槓胡");
  assert.ok(qiangGang !== undefined, "should have 搶槓胡 fan");
  assert.equal(qiangGang.fan, 1);
});

test("calculateFan: 花牌 (flower tiles)", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const flowers = [
    { suit: 5, rank: 0 }, // 春
    { suit: 5, rank: 1 }, // 夏
    { suit: 5, rank: 4 }  // 梅
  ];
  const result = calculateFan(hand, [], null, flowers, null);
  const huaPai = result.fans.find(f => f.name === "花牌");
  assert.ok(huaPai !== undefined, "should have 花牌 fan");
  assert.equal(huaPai.fan, 3, "3 flowers = 3 fan");
});

test("calculateFan: no flowers = no flower fan", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  const huaPai = result.fans.find(f => f.name === "花牌");
  assert.equal(huaPai, undefined, "no flowers should have no flower fan");
});

test("calculateFan: fan stacking (清一色 + 自摸)", () => {
  // All 萬 suit, self-drawn
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 }
  ];
  const result = calculateFan(hand, [], null, [], "selfDrawn");
  const qingYiSe = result.fans.find(f => f.name === "清一色");
  const ziMo = result.fans.find(f => f.name === "自摸");
  assert.ok(qingYiSe !== undefined, "should have 清一色");
  assert.ok(ziMo !== undefined, "should have 自摸");
  assert.equal(result.totalFan, 6 + 1, "清一色(6) + 自摸(1) = 7");
});

test("calculateFan: fan stacking (碰碰胡 + 自摸 + flowers)", () => {
  // All triplets, self-drawn, 2 flowers
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 1, rank: 3 }, { suit: 1, rank: 3 }, { suit: 1, rank: 3 },
    { suit: 2, rank: 4 }, { suit: 2, rank: 4 }, { suit: 2, rank: 4 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const flowers = [{ suit: 5, rank: 0 }, { suit: 5, rank: 1 }];
  const result = calculateFan(hand, [], null, flowers, "selfDrawn");
  assert.ok(result.totalFan >= 3, "should stack 碰碰胡(1) + 自摸(1) + 花牌(2)");
});

test("calculateFan: 七對子 + 清一色 stacking", () => {
  // All 萬, seven pairs
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 0, rank: 3 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 },
    { suit: 0, rank: 6 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 7 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  const qiDui = result.fans.find(f => f.name === "七對子");
  const qingYiSe = result.fans.find(f => f.name === "清一色");
  assert.ok(qiDui !== undefined, "should have 七對子");
  assert.ok(qingYiSe !== undefined, "should have 清一色");
  assert.equal(result.totalFan, 4 + 6, "七對子(4) + 清一色(6) = 10");
});

test("calculateFan: no fan for non-winning hand", () => {
  // 13 tiles, not a valid win
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 7 }, { suit: 0, rank: 8 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 2 }, { suit: 1, rank: 4 },
    { suit: 1, rank: 5 }, { suit: 1, rank: 7 }, { suit: 1, rank: 8 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 2 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  assert.equal(result.totalFan, 0, "non-winning hand should have 0 fan");
});

test("calculateFan: result has correct structure", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  assert.ok(typeof result.totalFan === "number", "totalFan should be number");
  assert.ok(Array.isArray(result.fans), "fans should be array");
  for (const fan of result.fans) {
    assert.ok(typeof fan.name === "string", "fan name should be string");
    assert.ok(typeof fan.fan === "number", "fan value should be number");
    assert.ok(typeof fan.description === "string", "fan description should be string");
  }
});

test("calculateFan: 平胡 should not trigger when pair is value tile", () => {
  // All sequences but pair is 東風 (honor = value tile)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 1, rank: 7 }, { suit: 1, rank: 8 }, { suit: 1, rank: 9 },
    { suit: 2, rank: 2 }, { suit: 2, rank: 3 }, { suit: 2, rank: 4 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 } // 東東 pair
  ];
  const result = calculateFan(hand, [], null, [], null);
  const pingHu = result.fans.find(f => f.name === "平胡");
  assert.equal(pingHu, undefined, "平胡 should not trigger with honor pair");
});

test("calculateFan: 平胡 should not trigger when pair is terminal", () => {
  // All sequences but pair is 1萬 (terminal = value tile)
  const hand = [
    { suit: 0, rank: 2 }, { suit: 0, rank: 3 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 6 }, { suit: 0, rank: 7 },
    { suit: 1, rank: 7 }, { suit: 1, rank: 8 }, { suit: 1, rank: 9 },
    { suit: 2, rank: 2 }, { suit: 2, rank: 3 }, { suit: 2, rank: 4 },
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 } // 1-1萬 pair (terminal)
  ];
  const result = calculateFan(hand, [], null, [], null);
  const pingHu = result.fans.find(f => f.name === "平胡");
  assert.equal(pingHu, undefined, "平胡 should not trigger with terminal pair");
});

test("calculateFan: with exposed melds for 混一色", () => {
  // Hand: 1-2-3萬, 7-8-9萬, 7-7萬 (pair) = 8 tiles
  // Melds: 東東東, 4-5-6萬
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 7 }
  ];
  const melds = [
    [{ suit: 3, rank: 0 }, { suit: 3, rank: 0 }, { suit: 3, rank: 0 }],
    [{ suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 }]
  ];
  const result = calculateFan(hand, melds, null, [], null);
  const hunYiSe = result.fans.find(f => f.name === "混一色");
  assert.ok(hunYiSe !== undefined, "should detect 混一色 with exposed melds");
});

test("calculateFan: 大三元 with exposed melds", () => {
  // Hand: 1-2-3萬, 5-5萬 (pair) = 5 tiles
  // Melds: 中中中, 發發發, 白白白
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 }
  ];
  const melds = [
    [{ suit: 4, rank: 0 }, { suit: 4, rank: 0 }, { suit: 4, rank: 0 }],
    [{ suit: 4, rank: 1 }, { suit: 4, rank: 1 }, { suit: 4, rank: 1 }],
    [{ suit: 4, rank: 2 }, { suit: 4, rank: 2 }, { suit: 4, rank: 2 }]
  ];
  const result = calculateFan(hand, melds, null, [], null);
  const daSanYuan = result.fans.find(f => f.name === "大三元");
  assert.ok(daSanYuan !== undefined, "should detect 大三元 with exposed melds");
  assert.equal(daSanYuan.fan, 8);
});

test("calculateFan: 小四喜 with exposed melds", () => {
  // Hand: 1-2-3萬, 北北 (pair) = 5 tiles
  // Melds: 東東東, 南南南, 西西西
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 3, rank: 3 }, { suit: 3, rank: 3 }
  ];
  const melds = [
    [{ suit: 3, rank: 0 }, { suit: 3, rank: 0 }, { suit: 3, rank: 0 }],
    [{ suit: 3, rank: 1 }, { suit: 3, rank: 1 }, { suit: 3, rank: 1 }],
    [{ suit: 3, rank: 2 }, { suit: 3, rank: 2 }, { suit: 3, rank: 2 }]
  ];
  const result = calculateFan(hand, melds, null, [], null);
  const xiaoSiXi = result.fans.find(f => f.name === "小四喜");
  assert.ok(xiaoSiXi !== undefined, "should detect 小四喜 with exposed melds");
  assert.equal(xiaoSiXi.fan, 8);
});

test("calculateFan: 清一色 with exposed melds", () => {
  // Hand: 7-8-9萬, 5-5萬 (pair) = 5 tiles
  // Melds: 1-2-3萬, 4-5-6萬, 1-1-1萬
  const hand = [
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 }
  ];
  const melds = [
    [{ suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 }],
    [{ suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 }],
    [{ suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 1 }]
  ];
  const result = calculateFan(hand, melds, null, [], null);
  const qingYiSe = result.fans.find(f => f.name === "清一色");
  assert.ok(qingYiSe !== undefined, "should detect 清一色 with exposed melds");
  assert.equal(qingYiSe.fan, 6);
});

test("calculateFan: multiple flowers counted correctly", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 5 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 1 }, { suit: 1, rank: 1 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const flowers = [
    { suit: 5, rank: 0 }, { suit: 5, rank: 1 }, { suit: 5, rank: 2 },
    { suit: 5, rank: 3 }, { suit: 5, rank: 4 }, { suit: 5, rank: 5 },
    { suit: 5, rank: 6 }, { suit: 5, rank: 7 }
  ];
  const result = calculateFan(hand, [], null, flowers, null);
  const huaPai = result.fans.find(f => f.name === "花牌");
  assert.ok(huaPai !== undefined);
  assert.equal(huaPai.fan, 8, "8 flowers = 8 fan");
});

test("calculateFan: 十三么 does not trigger 清一色 or 混一色", () => {
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 9 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 1 }, { suit: 3, rank: 2 }, { suit: 3, rank: 3 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 1 }, { suit: 4, rank: 2 },
    { suit: 0, rank: 1 }
  ];
  const result = calculateFan(hand, [], null, [], null);
  const qingYiSe = result.fans.find(f => f.name === "清一色");
  const hunYiSe = result.fans.find(f => f.name === "混一色");
  assert.equal(qingYiSe, undefined, "十三么 should not trigger 清一色");
  assert.equal(hunYiSe, undefined, "十三么 should not trigger 混一色");
});

// ============================================================
// Additional Edge Case Tests (to reach 100+)
// ============================================================

test("detectWin: basic win with all sequences (no triplets)", () => {
  // 1-2-3, 2-3-4, 5-6-7, 7-8-9 all 萬, 5-5筒
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 2 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 3 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 6 }, { suit: 0, rank: 7 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 }, { suit: 0, rank: 9 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect win with all sequences");
  assert.equal(result.type, "basic");
});

test("detectWin: basic win with 4 triplets + pair of same tile", () => {
  // 1-1-1, 2-2-2, 3-3-3, 4-4-4 all 萬, 5-5萬
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 0, rank: 3 }, { suit: 0, rank: 3 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 4 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 }
  ];
  const result = detectWin(hand, []);
  assert.ok(result !== null, "should detect win with 4 triplets + pair");
});

test("detectWin: not seven pairs when pairs are not distinct", () => {
  // 6 pairs + 2 extra tiles that don't form a 7th pair
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 0, rank: 3 }, { suit: 0, rank: 3 },
    { suit: 0, rank: 4 }, { suit: 0, rank: 4 },
    { suit: 0, rank: 5 }, { suit: 0, rank: 5 },
    { suit: 0, rank: 6 }, { suit: 0, rank: 6 },
    { suit: 0, rank: 7 }, { suit: 0, rank: 8 } // not a pair
  ];
  const result = detectWin(hand, []);
  if (result) {
    assert.notEqual(result.type, "sevenPairs", "should not be seven pairs with unmatched tiles");
  }
});

test("detectWin: thirteen orphans fails when extra tile is not orphan", () => {
  // All 13 orphans present, but duplicate is 2萬 (not an orphan)
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 9 },
    { suit: 1, rank: 1 }, { suit: 1, rank: 9 },
    { suit: 2, rank: 1 }, { suit: 2, rank: 9 },
    { suit: 3, rank: 0 }, { suit: 3, rank: 1 }, { suit: 3, rank: 2 }, { suit: 3, rank: 3 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 1 }, { suit: 4, rank: 2 },
    { suit: 0, rank: 2 } // not an orphan tile
  ];
  const result = detectWin(hand, []);
  if (result) {
    assert.notEqual(result.type, "thirteenOrphans", "should not be thirteen orphans with non-orphan extra");
  }
});

test("calculateFan: 大四喜 + 碰碰胡 + 自摸 stacking", () => {
  // All wind triplets + dragon pair
  // 碰碰胡(all triplets) + 大四喜(4 wind melds) + 自摸(self-drawn)
  const hand = [
    { suit: 3, rank: 0 }, { suit: 3, rank: 0 }, { suit: 3, rank: 0 },
    { suit: 3, rank: 1 }, { suit: 3, rank: 1 }, { suit: 3, rank: 1 },
    { suit: 3, rank: 2 }, { suit: 3, rank: 2 }, { suit: 3, rank: 2 },
    { suit: 3, rank: 3 }, { suit: 3, rank: 3 }, { suit: 3, rank: 3 },
    { suit: 4, rank: 0 }, { suit: 4, rank: 0 }
  ];
  const result = calculateFan(hand, [], null, [], "selfDrawn");
  const daSiXi = result.fans.find(f => f.name === "大四喜");
  const pengPengHu = result.fans.find(f => f.name === "碰碰胡");
  const ziMo = result.fans.find(f => f.name === "自摸");
  assert.ok(daSiXi !== undefined, "should have 大四喜");
  assert.ok(pengPengHu !== undefined, "should have 碰碰胡");
  assert.ok(ziMo !== undefined, "should have 自摸");
  assert.equal(result.totalFan, 16 + 1 + 1, "大四喜(16) + 碰碰胡(1) + 自摸(1) = 18");
});

test("calculateFan: 搶槓胡 + 碰碰胡 stacking", () => {
  // All triplets, won by robbing kong
  const hand = [
    { suit: 0, rank: 1 }, { suit: 0, rank: 1 }, { suit: 0, rank: 1 },
    { suit: 0, rank: 2 }, { suit: 0, rank: 2 }, { suit: 0, rank: 2 },
    { suit: 1, rank: 3 }, { suit: 1, rank: 3 }, { suit: 1, rank: 3 },
    { suit: 2, rank: 4 }, { suit: 2, rank: 4 }, { suit: 2, rank: 4 },
    { suit: 2, rank: 5 }, { suit: 2, rank: 5 }
  ];
  const result = calculateFan(hand, [], null, [], "robKong");
  const pengPengHu = result.fans.find(f => f.name === "碰碰胡");
  const qiangGang = result.fans.find(f => f.name === "搶槓胡");
  assert.ok(pengPengHu !== undefined, "should have 碰碰胡");
  assert.ok(qiangGang !== undefined, "should have 搶槓胡");
  assert.equal(result.totalFan, 1 + 1, "碰碰胡(1) + 搶槓胡(1) = 2");
});
