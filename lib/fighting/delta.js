"use strict";

const POSITION_THRESHOLD = 2.0;

/**
 * Rounds a number to 1 decimal place.
 * @param {number} n
 * @returns {number}
 */
function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Computes delta-state for 60Hz broadcasting.
 * Only includes characters that changed significantly since the last state.
 *
 * @param {object} room - room object with tick, fightPhase, countdownValue, characters
 * @param {object|null} previousState - previous delta result or null for first tick
 * @returns {{ tick: number, fightPhase: string, countdown: number, characters: object[], roundWins: number[] }}
 */
function computeDelta(room, previousState) {
  const characters = [];

  for (const character of room.characters) {
    const serialized = {
      seatIndex: character.seatIndex,
      state: character.state,
      frameCount: character.frameCount,
      pos: { x: round1(character.pos.x), y: round1(character.pos.y) },
      velocity: { x: round1(character.velocity.x), y: round1(character.velocity.y) },
      facing: character.facing,
      health: character.health,
      energy: character.energy,
      grounded: character.grounded,
      invulnerable: character.invulnerable,
    };

    // Always include on state changes (attack, hit_stun, ko, ring_out)
    const stateChanged =
      previousState &&
      previousState.characters &&
      (() => {
        const prev = previousState.characters.find((c) => c.seatIndex === character.seatIndex);
        if (!prev) return true; // New character, always include
        return prev.state !== character.state;
      })();

    if (stateChanged) {
      characters.push(serialized);
      continue;
    }

    // Check if position/health changed significantly from previous state
    if (previousState && previousState.characters) {
      const prev = previousState.characters.find((c) => c.seatIndex === character.seatIndex);
      if (prev) {
        const posDiff =
          Math.abs(serialized.pos.x - prev.pos.x) +
          Math.abs(serialized.pos.y - prev.pos.y);
        const healthChanged = serialized.health !== prev.health;

        if (posDiff < POSITION_THRESHOLD && !healthChanged) {
          continue; // Skip unchanged character
        }
      }
    }

    characters.push(serialized);
  }

  // Collect round wins from all characters
  const roundWins = room.characters.map((c) => c.roundWins);

  return {
    tick: room.tick,
    fightPhase: room.fightPhase,
    countdown: room.countdownValue || 0,
    characters,
    roundWins,
  };
}

module.exports = {
  computeDelta,
  POSITION_THRESHOLD,
};
