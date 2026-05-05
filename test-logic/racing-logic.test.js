const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const CANNON = require("cannon-es");

const { getGameMeta, getGameLimits, getRacingDefaultConfig } = require("../lib/games/catalog");
const { SOCKET_EVENTS, API_ROUTE_PATTERNS, API_ROUTES } = require("../lib/shared/network-contract");
const { createRacingWorld, createCarBody, createTrackBodies, applyCarInput, createLapDetector } = require("../lib/racing/physics");
const { TRACK_DEFINITION, TRACK_WIDTH, TRACK_LENGTH } = require("../lib/racing/track");
const { computeDelta, computeRaceOrder } = require("../lib/racing/delta");

describe("Catalog integration - Racing entry", () => {
  it("getGameMeta('racing') returns entry with title", () => {
    const meta = getGameMeta("racing");
    assert.ok(meta, "racing catalog entry should exist");
    assert.equal(meta.key, "racing");
    assert.equal(meta.familyKey, "light-3d");
    assert.equal(meta.launchState, "coming-soon");
  });

  it("getGameLimits('racing') returns { minPlayers: 2, maxPlayers: 4 }", () => {
    const limits = getGameLimits("racing");
    assert.deepEqual(limits, { minPlayers: 2, maxPlayers: 4 });
  });

  it("getRacingDefaultConfig returns default config", () => {
    const config = getRacingDefaultConfig();
    assert.equal(config.visibility, "public");
    assert.equal(config.maxPlayers, 4);
    assert.equal(config.lapCount, 3);
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
});

describe("Track definition", () => {
  it("TRACK_WIDTH is a positive number", () => {
    assert.ok(typeof TRACK_WIDTH === "number" && TRACK_WIDTH > 0);
  });

  it("TRACK_LENGTH is a positive number", () => {
    assert.ok(typeof TRACK_LENGTH === "number" && TRACK_LENGTH > 0);
  });

  it("TRACK_DEFINITION has walls array", () => {
    assert.ok(Array.isArray(TRACK_DEFINITION.walls), "walls should be an array");
    assert.ok(TRACK_DEFINITION.walls.length > 0, "should have at least one wall");
  });

  it("TRACK_DEFINITION has startLine", () => {
    assert.ok(TRACK_DEFINITION.startLine, "startLine should exist");
    assert.ok(typeof TRACK_DEFINITION.startLine.x === "number");
    assert.ok(typeof TRACK_DEFINITION.startLine.z === "number");
  });

  it("TRACK_DEFINITION has spawnPoints for 4 cars", () => {
    assert.ok(Array.isArray(TRACK_DEFINITION.spawnPoints), "spawnPoints should be an array");
    assert.equal(TRACK_DEFINITION.spawnPoints.length, 4);
    TRACK_DEFINITION.spawnPoints.forEach((sp, i) => {
      assert.ok(typeof sp.x === "number", `spawnPoint[${i}].x should be number`);
      assert.ok(typeof sp.z === "number", `spawnPoint[${i}].z should be number`);
    });
  });

  it("TRACK_DEFINITION has lapTriggerPosition", () => {
    assert.ok(TRACK_DEFINITION.lapTriggerPosition, "lapTriggerPosition should exist");
    assert.ok(typeof TRACK_DEFINITION.lapTriggerPosition.x === "number");
    assert.ok(typeof TRACK_DEFINITION.lapTriggerPosition.z === "number");
  });
});

describe("Physics - cannon-es World setup", () => {
  it("createRacingWorld returns a World with correct gravity", () => {
    const world = createRacingWorld();
    assert.ok(world, "World should be created");
    assert.equal(world.gravity.y, -9.82);
  });

  it("createRacingWorld has broadphase and solver configured", () => {
    const world = createRacingWorld();
    assert.ok(world.broadphase, "broadphase should be set");
    assert.ok(world.solver, "solver should exist");
  });
});

describe("Physics - Car body creation", () => {
  it("createCarBody returns a Body at the specified position with correct mass", () => {
    const body = createCarBody(0, 10, 20);
    assert.ok(body, "car body should be created");
    assert.equal(body.mass, 1500);
    assert.equal(body.position.x, 10);
    assert.equal(body.position.y, 0.5);
    assert.equal(body.position.z, 20);
  });

  it("createCarBody has linear and angular damping", () => {
    const body = createCarBody(0, 0, 0);
    assert.ok(body.linearDamping > 0, "should have linear damping");
    assert.ok(body.angularDamping > 0, "should have angular damping");
  });
});

describe("Physics - Track body creation", () => {
  it("createTrackBodies adds walls and ground to the world", () => {
    const world = createRacingWorld();
    const bodies = createTrackBodies(world, TRACK_DEFINITION);
    assert.ok(bodies, "should return bodies object");
    assert.ok(Array.isArray(bodies.wallBodies), "wallBodies should be array");
    assert.ok(bodies.wallBodies.length > 0, "should have wall bodies");
    assert.ok(bodies.groundBody, "should have ground body");
    assert.ok(bodies.triggerBody, "should have trigger body");
  });

  it("track walls are static (mass 0)", () => {
    const world = createRacingWorld();
    const bodies = createTrackBodies(world, TRACK_DEFINITION);
    bodies.wallBodies.forEach((wall, i) => {
      assert.equal(wall.mass, 0, `wall[${i}] should be static`);
    });
  });

  it("ground body is static", () => {
    const world = createRacingWorld();
    const bodies = createTrackBodies(world, TRACK_DEFINITION);
    assert.equal(bodies.groundBody.mass, 0, "ground should be static");
  });
});

describe("Physics - Car input", () => {
  it("applyCarInput with accel=1 produces forward velocity", () => {
    const world = createRacingWorld();
    const body = createCarBody(0, 0, 0);
    world.addBody(body);
    const input = { accel: 1, brake: 0, steer: 0 };
    applyCarInput(body, input, 1 / 20, CANNON);
    world.step(1 / 20);
    const speed = body.velocity.length();
    assert.ok(speed > 0, "velocity should increase with acceleration");
  });

  it("applyCarInput with steer rotates the car body", () => {
    const world = createRacingWorld();
    const body = createCarBody(0, 0, 0);
    world.addBody(body);
    const initialQuat = { x: body.quaternion.x, y: body.quaternion.y, z: body.quaternion.z, w: body.quaternion.w };
    const input = { accel: 0, brake: 0, steer: 1 };
    applyCarInput(body, input, 1 / 20, CANNON);
    world.step(1 / 20);
    const changed = body.quaternion.x !== initialQuat.x ||
      body.quaternion.y !== initialQuat.y ||
      body.quaternion.z !== initialQuat.z ||
      body.quaternion.w !== initialQuat.w;
    assert.ok(changed, "quaternion should change with steering");
  });

  it("applyCarInput caps speed at MAX_SPEED", () => {
    const world = createRacingWorld();
    const body = createCarBody(0, 0, 0);
    world.addBody(body);
    // Apply many acceleration ticks to reach max speed
    for (let i = 0; i < 200; i++) {
      applyCarInput(body, { accel: 1, brake: 0, steer: 0 }, 1 / 20, CANNON);
      world.step(1 / 20);
    }
    const speed = body.velocity.length();
    assert.ok(speed <= 31, `speed (${speed}) should be capped near MAX_SPEED (30)`);
  });
});

describe("Delta-state computation", () => {
  it("computeDelta returns correct structure", () => {
    const world = createRacingWorld();
    const room = {
      tick: 1,
      racePhase: "racing",
      countdownValue: 0,
      world,
      players: [
        { seatIndex: 0, userId: "p1" }
      ],
      laps: new Map([[0, { count: 0, lastCrossingTime: 0 }]])
    };
    const carBody = createCarBody(0, 0, 0);
    room.carBodies = [carBody];

    const delta = computeDelta(room, null);
    assert.ok(typeof delta.tick === "number", "tick should be number");
    assert.ok(typeof delta.phase === "string", "phase should be string");
    assert.ok(Array.isArray(delta.cars), "cars should be array");
    assert.ok(Array.isArray(delta.raceOrder), "raceOrder should be array");
  });

  it("computeDelta includes all cars on first call (no previous state)", () => {
    const world = createRacingWorld();
    const carBody = createCarBody(0, 0, 0);
    const room = {
      tick: 1,
      racePhase: "racing",
      countdownValue: 0,
      world,
      players: [{ seatIndex: 0, userId: "p1" }],
      laps: new Map([[0, { count: 0, lastCrossingTime: 0 }]]),
      carBodies: [carBody]
    };

    const delta = computeDelta(room, null);
    assert.equal(delta.cars.length, 1, "should include the car");
    assert.equal(delta.cars[0].seatIndex, 0);
    assert.ok(typeof delta.cars[0].pos.x === "number", "pos.x should be number");
    assert.ok(typeof delta.cars[0].speed === "number", "speed should be number");
  });

  it("computeDelta only includes cars that moved significantly", () => {
    const world = createRacingWorld();
    const carBody0 = createCarBody(0, 0, 0);
    const carBody1 = createCarBody(1, 10, 0);
    const room = {
      tick: 2,
      racePhase: "racing",
      countdownValue: 0,
      world,
      players: [
        { seatIndex: 0, userId: "p1" },
        { seatIndex: 1, userId: "p2" }
      ],
      laps: new Map([
        [0, { count: 0, lastCrossingTime: 0 }],
        [1, { count: 0, lastCrossingTime: 0 }]
      ]),
      carBodies: [carBody0, carBody1]
    };

    const prevDelta = computeDelta(room, null);
    // Don't move any car
    const delta = computeDelta(room, prevDelta);
    assert.equal(delta.cars.length, 0, "no cars moved, so delta should be empty");
  });
});

describe("Race order computation", () => {
  it("computeRaceOrder sorts by lap then progress", () => {
    const world = createRacingWorld();
    const carBody0 = createCarBody(0, 0, 0);
    const carBody1 = createCarBody(1, 0, -50);
    const room = {
      tick: 1,
      racePhase: "racing",
      countdownValue: 0,
      world,
      players: [
        { seatIndex: 0, userId: "p1" },
        { seatIndex: 1, userId: "p2" }
      ],
      laps: new Map([
        [0, { count: 2, lastCrossingTime: 0 }],
        [1, { count: 1, lastCrossingTime: 0 }]
      ]),
      carBodies: [carBody0, carBody1]
    };

    const order = computeRaceOrder(room);
    assert.ok(Array.isArray(order), "should return array");
    assert.equal(order.length, 2);
    // Player with more laps should be first
    assert.equal(order[0].seatIndex, 0, "player 0 with 2 laps should be first");
  });
});

describe("Lap detection", () => {
  it("createLapDetector returns cleanup function", () => {
    const world = createRacingWorld();
    const bodies = createTrackBodies(world, TRACK_DEFINITION);
    const room = {
      laps: new Map([[0, { count: 0, lastCrossingTime: 0 }]]),
      carBodies: [createCarBody(0, 0, 0)]
    };
    const cleanup = createLapDetector(bodies.triggerBody, room);
    assert.equal(typeof cleanup, "function", "should return cleanup function");
    cleanup();
  });
});
