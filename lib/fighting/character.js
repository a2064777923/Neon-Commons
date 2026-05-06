"use strict";

const {
  TRANSITIONS,
  FRAME_DATA,
  STATE_DURATIONS,
  MAX_HEALTH,
  COMBO_CHAIN_WINDOW,
} = require("./constants");

/**
 * Checks if a state transition is valid.
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
function canTransition(fromState, toState) {
  const allowed = TRANSITIONS[fromState];
  if (!allowed) return false;
  return allowed.includes(toState);
}

/**
 * Gets the total frame duration for a state.
 * Attack states use FRAME_DATA; non-attack states use STATE_DURATIONS.
 * @param {string} state
 * @returns {number}
 */
function getFrameDuration(state) {
  if (FRAME_DATA[state]) {
    return FRAME_DATA[state].totalFrames;
  }
  return STATE_DURATIONS[state] || 60;
}

/**
 * Creates a new character object.
 * @param {number} seatIndex
 * @param {string} facing - "left" or "right"
 * @returns {object}
 */
function createCharacter(seatIndex, facing) {
  const spawnX = facing === "left" ? -150 : 150;
  const spawnY = -50;
  return {
    seatIndex,
    facing,
    state: "idle",
    frameCount: 0,
    pos: { x: spawnX, y: spawnY },
    velocity: { x: 0, y: 0 },
    health: MAX_HEALTH,
    energy: 0,
    grounded: true,
    invulnerable: false,
    invulnerableFrames: 0,
    comboState: { lastAttack: null, lastFrame: 0, chainCount: 0 },
    hitThisAttack: false,
    roundWins: 0,
  };
}

/**
 * Updates character state based on input and frame progression.
 * @param {object} character
 * @param {object} input - { requestedState, attack_heavy, left, right, up, block, dodge }
 * @param {number} dt - delta time in seconds
 */
function updateCharacterState(character, input, dt) {
  // Handle invulnerability countdown
  if (character.invulnerableFrames > 0) {
    character.invulnerableFrames -= 1;
    if (character.invulnerableFrames <= 0) {
      character.invulnerable = false;
      character.invulnerableFrames = 0;
    }
  }

  const { state } = character;
  const duration = getFrameDuration(state);

  // Auto-transitions when frame duration exceeded
  if (character.frameCount >= duration) {
    if (state === "attack_light" && input && input.attack_heavy) {
      // Natural chain: attack_light -> attack_heavy within timing window
      if (character.frameCount <= COMBO_CHAIN_WINDOW) {
        character.state = "attack_heavy";
        character.frameCount = 0;
        character.hitThisAttack = false;
        character.comboState.lastAttack = "attack_heavy";
        character.comboState.lastFrame = 0;
        character.comboState.chainCount += 1;
        return;
      }
    }
    // Auto-transition to idle
    if (state !== "idle" && state !== "ko" && state !== "ring_out") {
      character.state = "idle";
      character.frameCount = 0;
      character.hitThisAttack = false;
    }
    return;
  }

  // Process requested state change from input
  if (input && input.requestedState && canTransition(state, input.requestedState)) {
    character.state = input.requestedState;
    character.frameCount = 0;
    character.hitThisAttack = false;

    // Track combo state for attacks
    if (input.requestedState === "attack_light" || input.requestedState === "attack_heavy") {
      character.comboState.lastAttack = input.requestedState;
      character.comboState.lastFrame = character.frameCount;
    }

    // Handle dodge invulnerability
    if (input.requestedState === "dodge") {
      character.invulnerable = true;
      character.invulnerableFrames = STATE_DURATIONS.dodge || 10;
    }
    return;
  }

  // Increment frame counter
  character.frameCount += 1;
}

module.exports = {
  CHARACTER_STATES: require("./constants").CHARACTER_STATES,
  TRANSITIONS,
  canTransition,
  updateCharacterState,
  createCharacter,
};
