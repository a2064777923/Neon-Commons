"use strict";

const { GRAVITY, DEFAULT_HURTBOX } = require("./constants");

/**
 * Applies gravity to a character, updating velocity and position.
 * @param {object} character
 * @param {number} dt - delta time in seconds
 */
function applyGravity(character, dt) {
  character.velocity.y += GRAVITY * dt;
  character.pos.y += character.velocity.y * dt;
}

/**
 * Resolves platform collision for a falling character.
 * Snaps character to platform surface when falling through the top.
 * @param {object} character
 * @param {object} arena - arena object with platforms array
 */
function resolvePlatformCollision(character, arena) {
  // Only check when falling (velocity.y > 0 means moving downward)
  if (character.velocity.y <= 0) return;

  const charBottom = character.pos.y + DEFAULT_HURTBOX.y + DEFAULT_HURTBOX.h;
  const charLeft = character.pos.x + DEFAULT_HURTBOX.x;
  const charRight = charLeft + DEFAULT_HURTBOX.w;

  for (const platform of arena.platforms) {
    const platTop = platform.y;
    const platBottom = platform.y + platform.h;

    // Check horizontal overlap
    const horizontalOverlap = charRight > platform.x && charLeft < platform.x + platform.w;

    // Check vertical: character bottom passes through platform top (with tolerance)
    const verticalOverlap = charBottom >= platTop && charBottom <= platBottom + 15;

    if (horizontalOverlap && verticalOverlap) {
      // Snap character to platform surface
      character.pos.y = platTop - DEFAULT_HURTBOX.y - DEFAULT_HURTBOX.h;
      character.velocity.y = 0;
      character.grounded = true;

      // Transition from fall to idle
      if (character.state === "fall") {
        character.state = "idle";
        character.frameCount = 0;
      }
      return; // Only land on one platform
    }
  }
}

/**
 * Checks if a character has fallen out of the arena (ring-out).
 * @param {object} character
 * @param {object} arena - arena object with bounds
 * @returns {boolean}
 */
function checkRingOut(character, arena) {
  return character.pos.y > arena.bounds.bottom + 100;
}

module.exports = {
  applyGravity,
  resolvePlatformCollision,
  checkRingOut,
};
