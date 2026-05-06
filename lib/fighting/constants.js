"use strict";

const CHARACTER_STATES = Object.freeze({
  IDLE: "idle",
  WALK: "walk",
  JUMP: "jump",
  FALL: "fall",
  ATTACK_LIGHT: "attack_light",
  ATTACK_HEAVY: "attack_heavy",
  SPECIAL: "special",
  FINISHER: "finisher",
  BLOCK: "block",
  PARRY: "parry",
  DODGE: "dodge",
  HIT_STUN: "hit_stun",
  KNOCKBACK: "knockback",
  KO: "ko",
  RING_OUT: "ring_out",
});

const TRANSITIONS = Object.freeze({
  idle: [
    "walk", "jump", "attack_light", "attack_heavy",
    "special", "finisher", "block", "dodge",
  ],
  walk: [
    "idle", "jump", "attack_light", "attack_heavy",
    "special", "finisher", "block", "dodge",
  ],
  jump: ["fall", "attack_light", "attack_heavy", "dodge"],
  fall: ["idle"],
  attack_light: ["idle", "attack_heavy"],
  attack_heavy: ["idle"],
  special: ["idle"],
  finisher: ["idle"],
  block: ["idle", "parry"],
  parry: ["idle"],
  dodge: ["idle"],
  hit_stun: ["idle", "knockback"],
  knockback: ["idle", "ring_out", "ko"],
  ko: [],
  ring_out: [],
});

const FRAME_DATA = Object.freeze({
  attack_light: {
    totalFrames: 10,
    startup: 3,
    active: 3,
    recovery: 4,
    hitboxes: [
      { frame: 3, x: 20, y: -10, w: 40, h: 30, damage: 5, knockback: { x: 3, y: 0 } },
      { frame: 4, x: 25, y: -10, w: 45, h: 30, damage: 5, knockback: { x: 3, y: 0 } },
      { frame: 5, x: 20, y: -10, w: 40, h: 30, damage: 5, knockback: { x: 3, y: 0 } },
    ],
    hurtbox: { x: -15, y: -40, w: 30, h: 80 },
  },
  attack_heavy: {
    totalFrames: 20,
    startup: 8,
    active: 5,
    recovery: 7,
    hitboxes: [
      { frame: 8, x: 15, y: -20, w: 50, h: 50, damage: 12, knockback: { x: 8, y: -3 } },
      { frame: 9, x: 20, y: -20, w: 55, h: 50, damage: 12, knockback: { x: 8, y: -3 } },
      { frame: 10, x: 25, y: -15, w: 55, h: 45, damage: 12, knockback: { x: 8, y: -3 } },
      { frame: 11, x: 20, y: -15, w: 50, h: 45, damage: 12, knockback: { x: 8, y: -3 } },
      { frame: 12, x: 15, y: -20, w: 45, h: 50, damage: 12, knockback: { x: 8, y: -3 } },
    ],
    hurtbox: { x: -15, y: -40, w: 30, h: 80 },
  },
  special: {
    totalFrames: 25,
    startup: 10,
    active: 6,
    recovery: 9,
    hitboxes: [
      { frame: 10, x: 10, y: -25, w: 60, h: 60, damage: 18, knockback: { x: 12, y: -5 } },
      { frame: 11, x: 15, y: -25, w: 65, h: 60, damage: 18, knockback: { x: 12, y: -5 } },
      { frame: 12, x: 20, y: -20, w: 65, h: 55, damage: 18, knockback: { x: 12, y: -5 } },
      { frame: 13, x: 20, y: -20, w: 60, h: 55, damage: 18, knockback: { x: 12, y: -5 } },
      { frame: 14, x: 15, y: -25, w: 55, h: 60, damage: 18, knockback: { x: 12, y: -5 } },
      { frame: 15, x: 10, y: -25, w: 50, h: 60, damage: 18, knockback: { x: 12, y: -5 } },
    ],
    hurtbox: { x: -15, y: -40, w: 30, h: 80 },
  },
  finisher: {
    totalFrames: 35,
    startup: 15,
    active: 8,
    recovery: 12,
    hitboxes: [
      { frame: 15, x: 5, y: -30, w: 70, h: 70, damage: 30, knockback: { x: 20, y: -8 } },
      { frame: 16, x: 10, y: -30, w: 75, h: 70, damage: 30, knockback: { x: 20, y: -8 } },
      { frame: 17, x: 15, y: -25, w: 75, h: 65, damage: 30, knockback: { x: 20, y: -8 } },
      { frame: 18, x: 20, y: -25, w: 75, h: 65, damage: 30, knockback: { x: 20, y: -8 } },
      { frame: 19, x: 20, y: -20, w: 70, h: 60, damage: 30, knockback: { x: 20, y: -8 } },
      { frame: 20, x: 15, y: -20, w: 65, h: 60, damage: 30, knockback: { x: 20, y: -8 } },
      { frame: 21, x: 10, y: -25, w: 60, h: 65, damage: 30, knockback: { x: 20, y: -8 } },
      { frame: 22, x: 5, y: -30, w: 55, h: 70, damage: 30, knockback: { x: 20, y: -8 } },
    ],
    hurtbox: { x: -15, y: -40, w: 30, h: 80 },
  },
});

const DEFAULT_HURTBOX = Object.freeze({ x: -15, y: -40, w: 30, h: 80 });

const GRAVITY = 980;
const MOVE_SPEED = 200;
const JUMP_FORCE = -450;
const AIR_DASH_SPEED = 300;
const DODGE_IFRAMES = 10;
const PARRY_WINDOW = 4;
const BLOCK_DAMAGE_REDUCTION = 0.5;
const ENERGY_GAIN_ON_HIT = 10;
const ENERGY_GAIN_ON_TAKEN = 5;
const ENERGY_GAIN_ON_COMBO = 20;
const ENERGY_FINISHER_THRESHOLD = 100;
const KNOCKBACK_PERCENTAGE_SCALE = 0.5;
const COMBO_CHAIN_WINDOW = 12;
const HIT_STUN_FRAMES = 12;
const KNOCKBACK_FRAMES = 20;
const MAX_HEALTH = 100;

// Non-attack state durations (frames) for auto-transition
const STATE_DURATIONS = Object.freeze({
  hit_stun: HIT_STUN_FRAMES,
  knockback: KNOCKBACK_FRAMES,
  dodge: DODGE_IFRAMES,
  parry: PARRY_WINDOW,
  jump: 30,
  fall: 60,
});

module.exports = {
  CHARACTER_STATES,
  TRANSITIONS,
  FRAME_DATA,
  DEFAULT_HURTBOX,
  GRAVITY,
  MOVE_SPEED,
  JUMP_FORCE,
  AIR_DASH_SPEED,
  DODGE_IFRAMES,
  PARRY_WINDOW,
  BLOCK_DAMAGE_REDUCTION,
  ENERGY_GAIN_ON_HIT,
  ENERGY_GAIN_ON_TAKEN,
  ENERGY_GAIN_ON_COMBO,
  ENERGY_FINISHER_THRESHOLD,
  KNOCKBACK_PERCENTAGE_SCALE,
  COMBO_CHAIN_WINDOW,
  HIT_STUN_FRAMES,
  KNOCKBACK_FRAMES,
  MAX_HEALTH,
  STATE_DURATIONS,
};
