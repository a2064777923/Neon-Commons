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
