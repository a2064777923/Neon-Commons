"use strict";

const {
  FRAME_DATA,
  DEFAULT_HURTBOX,
  BLOCK_DAMAGE_REDUCTION,
  PARRY_WINDOW,
  ENERGY_GAIN_ON_HIT,
  ENERGY_GAIN_ON_TAKEN,
  ENERGY_GAIN_ON_COMBO,
  ENERGY_FINISHER_THRESHOLD,
  KNOCKBACK_PERCENTAGE_SCALE,
  MAX_HEALTH,
  COMBO_CHAIN_WINDOW,
  HIT_STUN_FRAMES,
} = require("./constants");

/**
 * Checks hitbox/hurtbox AABB collision between attacker and defender.
 * @param {object} attacker
 * @param {object} defender
 * @returns {{ damage: number, knockback: { x: number, y: number } } | null}
 */
function checkHitboxCollision(attacker, defender) {
  const attackerData = FRAME_DATA[attacker.state];
  if (!attackerData) return null;

  // Prevent multi-hit per attack
  if (attacker.hitThisAttack) return null;

  // Find hitbox for current frame
  const hitbox = attackerData.hitboxes.find((h) => h.frame === attacker.frameCount);
  if (!hitbox) return null;

  // Get defender's hurtbox
  const defenderData = FRAME_DATA[defender.state];
  const hurtbox = defenderData ? defenderData.hurtbox : DEFAULT_HURTBOX;

  // Calculate hitbox world position (mirror x if facing left)
  const ax =
    attacker.facing === "right"
      ? attacker.pos.x + hitbox.x
      : attacker.pos.x - hitbox.x - hitbox.w;
  const ay = attacker.pos.y + hitbox.y;

  // Defender hurtbox world position
  const dx = defender.pos.x + hurtbox.x;
  const dy = defender.pos.y + hurtbox.y;

  // AABB overlap check
  if (
    ax < dx + hurtbox.w &&
    ax + hitbox.w > dx &&
    ay < dy + hurtbox.h &&
    ay + hitbox.h > dy
  ) {
    return {
      damage: hitbox.damage,
      knockback: {
        x: hitbox.knockback.x * (attacker.facing === "right" ? 1 : -1),
        y: hitbox.knockback.y,
      },
    };
  }

  return null;
}

/**
 * Applies damage to a character from a hit result.
 * @param {object} character - defender
 * @param {{ damage: number, knockback: { x: number, y: number } }} hitResult
 * @param {object} attacker - the attacking character
 */
function applyDamage(character, hitResult, attacker) {
  // Dodge i-frames
  if (character.invulnerable) return;

  let damage = hitResult.damage;
  let knockback = { ...hitResult.knockback };

  // Blocking reduces damage
  if (character.state === "block") {
    damage = Math.floor(damage * BLOCK_DAMAGE_REDUCTION);
  }

  // Parry: reflect knockback and grant energy (within PARRY_WINDOW)
  if (character.state === "parry" && character.frameCount <= PARRY_WINDOW) {
    knockback.x = -knockback.x;
    knockback.y = -knockback.y;
    if (attacker) {
      attacker.energy = Math.min(attacker.energy + ENERGY_GAIN_ON_COMBO, ENERGY_FINISHER_THRESHOLD);
    }
  }

  // Apply damage (clamped to 0)
  character.health = Math.max(0, character.health - damage);

  // Percentage-based knockback scaling
  const damagePercent = (MAX_HEALTH - character.health) / MAX_HEALTH;
  const scaledKnockback = {
    x: knockback.x * (1 + damagePercent * KNOCKBACK_PERCENTAGE_SCALE),
    y: knockback.y * (1 + damagePercent * KNOCKBACK_PERCENTAGE_SCALE),
  };

  // Apply knockback velocity
  character.velocity.x += scaledKnockback.x * 10;
  character.velocity.y += scaledKnockback.y * 10;

  // Set state based on hit strength
  if (Math.abs(scaledKnockback.x) > 15 || Math.abs(scaledKnockback.y) > 10) {
    character.state = "knockback";
  } else {
    character.state = "hit_stun";
  }
  character.frameCount = 0;

  // Energy gain
  if (attacker) {
    attacker.energy = Math.min(attacker.energy + ENERGY_GAIN_ON_HIT, ENERGY_FINISHER_THRESHOLD);
    attacker.hitThisAttack = true;
  }
  character.energy = Math.min(character.energy + ENERGY_GAIN_ON_TAKEN, ENERGY_FINISHER_THRESHOLD);
}

/**
 * Checks if a combo chain is valid (light -> heavy within timing window).
 * @param {object} character
 * @param {object} input
 * @returns {boolean}
 */
function checkCombo(character, input) {
  if (
    character.comboState.lastAttack === "attack_light" &&
    input &&
    input.attack_heavy
  ) {
    if (character.frameCount <= COMBO_CHAIN_WINDOW) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if character can use finisher.
 * @param {object} character
 * @returns {boolean}
 */
function canUseFinisher(character) {
  return character.energy >= ENERGY_FINISHER_THRESHOLD;
}

module.exports = {
  checkHitboxCollision,
  applyDamage,
  checkCombo,
  canUseFinisher,
};
