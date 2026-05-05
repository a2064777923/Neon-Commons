"use strict";

const CANNON = require("cannon-es");

const ACCEL_FORCE = 800;
const BRAKE_FORCE = 600;
const STEER_RATE = 2.5;
const MAX_SPEED = 30;
const FRICTION_FACTOR = 0.85;

/**
 * Creates a cannon-es World configured for racing physics.
 * @returns {CANNON.World}
 */
function createRacingWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, -9.82, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;
  return world;
}

/**
 * Creates a car body for a given seat index at a start position.
 * @param {number} seatIndex
 * @param {number} startX
 * @param {number} startZ
 * @returns {CANNON.Body}
 */
function createCarBody(seatIndex, startX, startZ) {
  const body = new CANNON.Body({
    mass: 1500,
    shape: new CANNON.Box(new CANNON.Vec3(1, 0.5, 2)),
    position: new CANNON.Vec3(startX, 0.5, startZ)
  });
  body.linearDamping = 0.3;
  body.angularDamping = 0.9;
  body.seatIndex = seatIndex;
  return body;
}

/**
 * Creates static track bodies (walls, ground, trigger) in the world.
 * @param {CANNON.World} world
 * @param {object} trackDef - TRACK_DEFINITION from track.js
 * @returns {{ wallBodies: CANNON.Body[], groundBody: CANNON.Body, triggerBody: CANNON.Body }}
 */
function createTrackBodies(world, trackDef) {
  const wallBodies = [];

  for (const wall of trackDef.walls) {
    const wallBody = new CANNON.Body({ mass: 0 });
    wallBody.addShape(
      new CANNON.Box(new CANNON.Vec3(wall.halfWidth, wall.halfHeight, wall.halfDepth))
    );
    wallBody.position.set(wall.x, wall.y, wall.z);
    world.addBody(wallBody);
    wallBodies.push(wallBody);
  }

  // Ground plane
  const groundBody = new CANNON.Body({ mass: 0 });
  groundBody.addShape(new CANNON.Plane());
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  groundBody.position.set(0, 0, 0);
  world.addBody(groundBody);

  // Lap trigger
  const triggerBody = new CANNON.Body({
    mass: 0,
    isTrigger: true,
    shape: new CANNON.Box(new CANNON.Vec3(
      (trackDef.walls.length > 0 ? 6 : 6), 5, 0.1
    ))
  });
  const triggerPos = trackDef.lapTriggerPosition || { x: 0, z: -40 };
  triggerBody.position.set(triggerPos.x, 2, triggerPos.z);
  world.addBody(triggerBody);

  return { wallBodies, groundBody, triggerBody };
}

/**
 * Applies input forces to a car body.
 * @param {CANNON.Body} carBody
 * @param {{ accel: number, brake: number, steer: number }} input
 * @param {number} dt - time step in seconds
 * @param {object} CANNON - cannon-es module reference
 */
function applyCarInput(carBody, input, dt, CANNON_MOD) {
  const lib = CANNON_MOD || CANNON;

  // Forward vector from car orientation
  const forward = new lib.Vec3(0, 0, -1);
  carBody.quaternion.vmult(forward, forward);

  // Acceleration
  if (input.accel) {
    const force = forward.scale(ACCEL_FORCE);
    carBody.applyForce(force, carBody.position);
  }

  // Braking
  if (input.brake) {
    const brakeForce = forward.scale(-BRAKE_FORCE);
    carBody.applyForce(brakeForce, carBody.position);
  }

  // Steering
  if (input.steer !== 0) {
    const turnRate = STEER_RATE * input.steer * dt;
    const turnQuat = new lib.Quaternion();
    turnQuat.setFromEuler(0, turnRate, 0);
    carBody.quaternion = turnQuat.mult(carBody.quaternion);
  }

  // Speed cap
  const speed = carBody.velocity.length();
  if (speed > MAX_SPEED) {
    carBody.velocity = carBody.velocity.scale(MAX_SPEED / speed);
  }

  // Lateral friction (reduce sideways sliding)
  const right = new lib.Vec3(1, 0, 0);
  carBody.quaternion.vmult(right, right);
  const lateralSpeed = carBody.velocity.dot(right);
  const frictionImpulse = right.scale(-lateralSpeed * FRICTION_FACTOR);
  carBody.applyImpulse(frictionImpulse, carBody.position);
}

/**
 * Creates a lap detection listener on the trigger body.
 * @param {CANNON.Body} triggerBody
 * @param {object} room - room object with laps Map and carBodies array
 * @returns {function} cleanup function to remove listener
 */
function createLapDetector(triggerBody, room) {
  function onCollide(event) {
    const hitBody = event.body;
    if (!hitBody || hitBody.seatIndex === undefined) {
      return;
    }

    const seatIndex = hitBody.seatIndex;
    const lap = room.laps.get(seatIndex);
    if (!lap) {
      return;
    }

    // Debounce: must be at least 2 seconds since last crossing
    const now = Date.now();
    if (now - lap.lastCrossingTime < 2000) {
      return;
    }

    // Direction check: car must be moving forward through the line
    const forward = new CANNON.Vec3(0, 0, -1);
    hitBody.quaternion.vmult(forward, forward);
    // Reject if moving in wrong direction (positive z = away from finish)
    if (forward.z > 0) {
      return;
    }

    lap.count += 1;
    lap.lastCrossingTime = now;
  }

  triggerBody.addEventListener("collide", onCollide);

  return function cleanup() {
    triggerBody.removeEventListener("collide", onCollide);
  };
}

module.exports = {
  createRacingWorld,
  createCarBody,
  createTrackBodies,
  applyCarInput,
  createLapDetector
};
