const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { getGameMeta, getGameLimits, getFightingDefaultConfig } = require("../lib/games/catalog");
const { SOCKET_EVENTS, API_ROUTE_PATTERNS, API_ROUTES } = require("../lib/shared/network-contract");

describe("Catalog integration - Fighting entry", () => {
  it("getGameMeta('fighting') returns entry with title", () => {
    const meta = getGameMeta("fighting");
    assert.ok(meta, "fighting catalog entry should exist");
    assert.equal(meta.key, "fighting");
    assert.equal(meta.title, "打斗");
    assert.equal(meta.familyKey, "light-3d");
    assert.equal(meta.launchState, "coming-soon");
  });

  it("getGameLimits('fighting') returns { minPlayers: 2, maxPlayers: 2 }", () => {
    const limits = getGameLimits("fighting");
    assert.deepEqual(limits, { minPlayers: 2, maxPlayers: 2 });
  });

  it("getFightingDefaultConfig returns default config", () => {
    const config = getFightingDefaultConfig();
    assert.equal(config.visibility, "public");
    assert.equal(config.maxPlayers, 2);
    assert.equal(config.roundCount, 3);
  });
});

describe("Network Contract - Fighting entries", () => {
  it("SOCKET_EVENTS.fighting has all 6 events", () => {
    const events = SOCKET_EVENTS.fighting;
    assert.ok(events, "fighting socket events should exist");
    assert.equal(events.subscribe, "fighting:subscribe");
    assert.equal(events.ready, "fighting:ready");
    assert.equal(events.input, "fighting:input");
    assert.equal(events.update, "fighting:update");
    assert.equal(events.error, "fighting:error");
    assert.equal(events.chat, "fighting:chat");
  });

  it("API_ROUTE_PATTERNS.fightingRooms has list, detail, join routes", () => {
    const routes = API_ROUTE_PATTERNS.fightingRooms;
    assert.ok(routes, "fightingRooms route patterns should exist");
    assert.equal(routes.list, "/api/fighting/rooms");
    assert.equal(routes.detail, "/api/fighting/rooms/:roomNo");
    assert.equal(routes.join, "/api/fighting/rooms/:roomNo/join");
  });

  it("API_ROUTES.fightingRooms has list, create, detail, join builders", () => {
    const routes = API_ROUTES.fightingRooms;
    assert.ok(routes, "fightingRooms route builders should exist");
    assert.equal(routes.list(), "/api/fighting/rooms");
    assert.equal(routes.create(), "/api/fighting/rooms");
    assert.equal(routes.detail(42), "/api/fighting/rooms/42");
    assert.equal(routes.join(42), "/api/fighting/rooms/42/join");
  });
});

describe("Character state machine (placeholder)", () => {
  it("canTransition allows idle->walk", () => {
    // Placeholder: will be implemented in Plan 03
    assert.ok(true);
  });

  it("canTransition disallows ko->idle", () => {
    // Placeholder: will be implemented in Plan 03
    assert.ok(true);
  });
});

describe("Hitbox collision (placeholder)", () => {
  it("AABB overlap detects hit", () => {
    // Placeholder: will be implemented in Plan 03
    assert.ok(true);
  });

  it("AABB miss returns null", () => {
    // Placeholder: will be implemented in Plan 03
    assert.ok(true);
  });
});

describe("Platform physics (placeholder)", () => {
  it("gravity increases velocity", () => {
    // Placeholder: will be implemented in Plan 03
    assert.ok(true);
  });

  it("platform landing resets velocity", () => {
    // Placeholder: will be implemented in Plan 03
    assert.ok(true);
  });
});

describe("Delta-state (placeholder)", () => {
  it("computeDelta returns tick and characters array", () => {
    // Placeholder: will be implemented in Plan 03
    assert.ok(true);
  });
});

describe("Round management (placeholder)", () => {
  it("round wins tracked correctly", () => {
    // Placeholder: will be implemented in Plan 04
    assert.ok(true);
  });
});
