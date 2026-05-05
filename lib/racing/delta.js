"use strict";

const { TRACK_LENGTH } = require("./track");

const POSITION_THRESHOLD = 0.01;
const ROTATION_THRESHOLD = 0.001;

/**
 * Computes delta-state for network broadcasting.
 * Only includes cars that have moved significantly since the last state.
 *
 * @param {object} room - room object with tick, racePhase, countdownValue, world, players, laps, carBodies
 * @param {object|null} previousState - previous delta result or null for first tick
 * @returns {{ tick: number, phase: string, countdown: number, cars: object[], raceOrder: object[] }}
 */
function computeDelta(room, previousState) {
  const cars = [];

  for (const player of room.players) {
    const carBody = room.carBodies[player.seatIndex];
    if (!carBody) {
      continue;
    }

    const pos = {
      x: round3(carBody.position.x),
      y: round3(carBody.position.y),
      z: round3(carBody.position.z)
    };
    const rot = {
      x: round4(carBody.quaternion.x),
      y: round4(carBody.quaternion.y),
      z: round4(carBody.quaternion.z),
      w: round4(carBody.quaternion.w)
    };
    const vel = {
      x: round3(carBody.velocity.x),
      y: round3(carBody.velocity.y),
      z: round3(carBody.velocity.z)
    };

    const lapEntry = room.laps.get(player.seatIndex);
    const lap = lapEntry ? lapEntry.count : 0;
    const speed = round2(carBody.velocity.length());

    // Check if car moved significantly from previous state
    if (previousState) {
      const prevCar = previousState.cars ? previousState.cars.find((c) => c.seatIndex === player.seatIndex) : null;
      if (prevCar) {
        const posDiff = Math.abs(pos.x - prevCar.pos.x) + Math.abs(pos.y - prevCar.pos.y) + Math.abs(pos.z - prevCar.pos.z);
        const rotDiff = Math.abs(rot.x - prevCar.rot.x) + Math.abs(rot.y - prevCar.rot.y) + Math.abs(rot.z - prevCar.rot.z) + Math.abs(rot.w - prevCar.rot.w);
        if (posDiff < POSITION_THRESHOLD && rotDiff < ROTATION_THRESHOLD) {
          continue; // Skip unchanged car
        }
      }
    }

    cars.push({
      seatIndex: player.seatIndex,
      pos,
      rot,
      vel,
      lap,
      speed
    });
  }

  const raceOrder = computeRaceOrder(room);

  return {
    tick: room.tick,
    phase: room.racePhase,
    countdown: room.countdownValue || 0,
    cars,
    raceOrder
  };
}

/**
 * Computes race leaderboard sorted by lap count then track progress.
 *
 * @param {object} room - room object with players, laps, carBodies
 * @returns {{ seatIndex: number, lap: number, progress: number }[]}
 */
function computeRaceOrder(room) {
  const entries = [];

  for (const player of room.players) {
    const carBody = room.carBodies[player.seatIndex];
    const lapEntry = room.laps.get(player.seatIndex);
    const lap = lapEntry ? lapEntry.count : 0;

    // Approximate track progress based on position
    // Use z-position as rough proxy for distance along the straight
    const z = carBody ? carBody.position.z : 0;
    const progress = lap * TRACK_LENGTH + (z + 80); // offset so all values positive

    entries.push({
      seatIndex: player.seatIndex,
      lap,
      progress: round2(progress)
    });
  }

  entries.sort((a, b) => b.progress - a.progress);
  return entries;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

module.exports = {
  computeDelta,
  computeRaceOrder
};
