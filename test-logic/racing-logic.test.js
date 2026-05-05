const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { getGameMeta, getGameLimits } = require("../lib/games/catalog");
const { SOCKET_EVENTS, API_ROUTE_PATTERNS, API_ROUTES } = require("../lib/shared/network-contract");

describe("Catalog integration - Racing entry", () => {
  it("getGameMeta('racing') returns entry with title '賽車'", () => {
    const meta = getGameMeta("racing");
    assert.ok(meta, "racing catalog entry should exist");
    assert.equal(meta.title, "賽車");
    assert.equal(meta.key, "racing");
    assert.equal(meta.familyKey, "light-3d");
    assert.equal(meta.launchState, "coming-soon");
  });

  it("getGameLimits('racing') returns { minPlayers: 2, maxPlayers: 4 }", () => {
    const limits = getGameLimits("racing");
    assert.deepEqual(limits, { minPlayers: 2, maxPlayers: 4 });
  });
});

describe("Network Contract - Racing entries", () => {
  it("SOCKET_EVENTS.racing has all required events", () => {
    const events = SOCKET_EVENTS.racing;
    assert.ok(events, "racing socket events should exist");
    assert.equal(events.subscribe, "racing:subscribe");
    assert.equal(events.ready, "racing:ready");
    assert.equal(events.input, "racing:input");
    assert.equal(events.update, "racing:update");
    assert.equal(events.error, "racing:error");
    assert.equal(events.chat, "racing:chat");
  });

  it("API_ROUTE_PATTERNS.racingRooms has list, detail, join routes", () => {
    const routes = API_ROUTE_PATTERNS.racingRooms;
    assert.ok(routes, "racingRooms route patterns should exist");
    assert.equal(routes.list, "/api/racing/rooms");
    assert.equal(routes.detail, "/api/racing/rooms/:roomNo");
    assert.equal(routes.join, "/api/racing/rooms/:roomNo/join");
  });

  it("API_ROUTES.racingRooms has list, create, detail, join methods", () => {
    const routes = API_ROUTES.racingRooms;
    assert.ok(routes, "racingRooms API routes should exist");
    assert.equal(routes.list(), "/api/racing/rooms");
    assert.equal(routes.create(), "/api/racing/rooms");
    assert.equal(routes.detail("1234"), "/api/racing/rooms/1234");
    assert.equal(routes.join("1234"), "/api/racing/rooms/1234/join");
  });
});

describe("Physics - cannon-es basics (placeholder)", () => {
  it("cannon-es World can be created", async () => {
    const CANNON = require("cannon-es");
    const world = new CANNON.World();
    world.gravity.set(0, -9.82, 0);
    assert.ok(world, "World should be created");
    assert.equal(world.gravity.y, -9.82);
    world.step(1 / 20);
    assert.ok(true, "Physics step succeeded");
  });

  it("car body can be created with Box shape", async () => {
    const CANNON = require("cannon-es");
    const carBody = new CANNON.Body({
      mass: 1500,
      shape: new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)),
      position: new CANNON.Vec3(0, 0.5, 0)
    });
    assert.ok(carBody, "Car body should be created");
    assert.equal(carBody.mass, 1500);
    assert.equal(carBody.position.x, 0);
  });

  it("track walls are static bodies", async () => {
    const CANNON = require("cannon-es");
    const wallBody = new CANNON.Body({ mass: 0 });
    wallBody.addShape(new CANNON.Box(new CANNON.Vec3(100, 1, 0.5)));
    assert.ok(wallBody, "Wall body should be created");
    assert.equal(wallBody.mass, 0, "Wall should be static (mass 0)");
  });
});

describe("Delta-state - state computation (placeholder)", () => {
  it("computeDelta returns tick and cars array", () => {
    // Placeholder: will be filled in Plan 20-02
    const delta = { tick: 1, cars: [] };
    assert.ok(typeof delta.tick === "number");
    assert.ok(Array.isArray(delta.cars));
  });

  it("delta only includes changed cars", () => {
    // Placeholder: will be filled in Plan 20-02
    const allCars = [
      { seatIndex: 0, pos: { x: 0, y: 0, z: 0 } },
      { seatIndex: 1, pos: { x: 1, y: 0, z: 1 } }
    ];
    const changed = allCars.filter((car) => car.seatIndex === 0);
    assert.ok(changed.length <= allCars.length);
  });
});

describe("Lap detection - crossing detection (placeholder)", () => {
  it("lap count increments on valid crossing", () => {
    // Placeholder: will be filled in Plan 20-02
    let lapCount = 0;
    lapCount += 1;
    assert.equal(lapCount, 1);
  });
});
