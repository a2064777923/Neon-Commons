"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { getGameMeta, getGameLimits, getFightingDefaultConfig } = require("../lib/games/catalog");
const { SOCKET_EVENTS, API_ROUTE_PATTERNS, API_ROUTES } = require("../lib/shared/network-contract");

const {
  CHARACTER_STATES,
  TRANSITIONS,
  FRAME_DATA,
  DEFAULT_HURTBOX,
  MAX_HEALTH,
  ENERGY_FINISHER_THRESHOLD,
  ENERGY_GAIN_ON_HIT,
  ENERGY_GAIN_ON_TAKEN,
  BLOCK_DAMAGE_REDUCTION,
  PARRY_WINDOW,
  DODGE_IFRAMES,
  HIT_STUN_FRAMES,
  KNOCKBACK_FRAMES,
  COMBO_CHAIN_WINDOW,
} = require("../lib/fighting/constants");

const {
  canTransition,
  updateCharacterState,
  createCharacter,
} = require("../lib/fighting/character");

const {
  checkHitboxCollision,
  applyDamage,
  checkCombo,
  canUseFinisher,
} = require("../lib/fighting/combat");

const { ARENA_LAYOUTS, getDefaultArena } = require("../lib/fighting/arena");

const {
  applyGravity,
  resolvePlatformCollision,
  checkRingOut,
} = require("../lib/fighting/physics");

const { computeDelta, POSITION_THRESHOLD } = require("../lib/fighting/delta");

// ─── Catalog integration ──────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────

describe("Constants", () => {
  it("CHARACTER_STATES has all 15 states", () => {
    const states = Object.values(CHARACTER_STATES);
    assert.equal(states.length, 15);
    assert.ok(states.includes("idle"));
    assert.ok(states.includes("walk"));
    assert.ok(states.includes("jump"));
    assert.ok(states.includes("fall"));
    assert.ok(states.includes("attack_light"));
    assert.ok(states.includes("attack_heavy"));
    assert.ok(states.includes("special"));
    assert.ok(states.includes("finisher"));
    assert.ok(states.includes("block"));
    assert.ok(states.includes("parry"));
    assert.ok(states.includes("dodge"));
    assert.ok(states.includes("hit_stun"));
    assert.ok(states.includes("knockback"));
    assert.ok(states.includes("ko"));
    assert.ok(states.includes("ring_out"));
  });

  it("CHARACTER_STATES is frozen", () => {
    assert.throws(() => { CHARACTER_STATES.NEW_STATE = "test"; });
  });

  it("TRANSITIONS is frozen", () => {
    assert.throws(() => { TRANSITIONS.new_state = []; });
  });

  it("FRAME_DATA has data for all 4 attack states", () => {
    assert.ok(FRAME_DATA.attack_light);
    assert.ok(FRAME_DATA.attack_heavy);
    assert.ok(FRAME_DATA.special);
    assert.ok(FRAME_DATA.finisher);
  });

  it("FRAME_DATA: startup + active + recovery = totalFrames for all attacks", () => {
    for (const [state, data] of Object.entries(FRAME_DATA)) {
      const sum = data.startup + data.active + data.recovery;
      assert.equal(sum, data.totalFrames, `${state}: startup(${data.startup}) + active(${data.active}) + recovery(${data.recovery}) should equal totalFrames(${data.totalFrames})`);
    }
  });

  it("FRAME_DATA: hitbox count matches active frames for all attacks", () => {
    for (const [state, data] of Object.entries(FRAME_DATA)) {
      assert.equal(data.hitboxes.length, data.active, `${state}: hitbox count should equal active frames`);
    }
  });

  it("DEFAULT_HURTBOX has x, y, w, h", () => {
    assert.equal(DEFAULT_HURTBOX.x, -15);
    assert.equal(DEFAULT_HURTBOX.y, -40);
    assert.equal(DEFAULT_HURTBOX.w, 30);
    assert.equal(DEFAULT_HURTBOX.h, 80);
  });
});

// ─── Character State Machine ──────────────────────────────────────

describe("Character state machine", () => {
  it("createCharacter returns character with correct defaults", () => {
    const char = createCharacter(0, "left");
    assert.equal(char.seatIndex, 0);
    assert.equal(char.facing, "left");
    assert.equal(char.state, "idle");
    assert.equal(char.frameCount, 0);
    assert.equal(char.health, MAX_HEALTH);
    assert.equal(char.energy, 0);
    assert.equal(char.grounded, true);
    assert.equal(char.invulnerable, false);
    assert.equal(char.hitThisAttack, false);
    assert.equal(char.roundWins, 0);
  });

  it("createCharacter spawns at correct position based on facing", () => {
    const left = createCharacter(0, "left");
    const right = createCharacter(1, "right");
    assert.equal(left.pos.x, -150);
    assert.equal(right.pos.x, 150);
  });

  it("canTransition allows idle->walk", () => {
    assert.ok(canTransition("idle", "walk"));
  });

  it("canTransition allows idle->jump", () => {
    assert.ok(canTransition("idle", "jump"));
  });

  it("canTransition allows idle->attack_light", () => {
    assert.ok(canTransition("idle", "attack_light"));
  });

  it("canTransition allows idle->attack_heavy", () => {
    assert.ok(canTransition("idle", "attack_heavy"));
  });

  it("canTransition allows idle->special", () => {
    assert.ok(canTransition("idle", "special"));
  });

  it("canTransition allows idle->finisher", () => {
    assert.ok(canTransition("idle", "finisher"));
  });

  it("canTransition allows idle->block", () => {
    assert.ok(canTransition("idle", "block"));
  });

  it("canTransition allows idle->dodge", () => {
    assert.ok(canTransition("idle", "dodge"));
  });

  it("canTransition disallows idle->ko", () => {
    assert.equal(canTransition("idle", "ko"), false);
  });

  it("canTransition disallows idle->ring_out", () => {
    assert.equal(canTransition("idle", "ring_out"), false);
  });

  it("canTransition disallows idle->hit_stun", () => {
    assert.equal(canTransition("idle", "hit_stun"), false);
  });

  it("canTransition allows attack_light->attack_heavy (natural chain)", () => {
    assert.ok(canTransition("attack_light", "attack_heavy"));
  });

  it("canTransition allows attack_light->idle", () => {
    assert.ok(canTransition("attack_light", "idle"));
  });

  it("canTransition disallows attack_light->attack_light", () => {
    assert.equal(canTransition("attack_light", "attack_light"), false);
  });

  it("canTransition allows block->parry", () => {
    assert.ok(canTransition("block", "parry"));
  });

  it("canTransition disallows ko->idle (terminal state)", () => {
    assert.equal(canTransition("ko", "idle"), false);
  });

  it("canTransition disallows ring_out->idle (terminal state)", () => {
    assert.equal(canTransition("ring_out", "idle"), false);
  });

  it("canTransition returns false for unknown state", () => {
    assert.equal(canTransition("unknown", "idle"), false);
  });

  it("updateCharacterState increments frameCount each tick", () => {
    const char = createCharacter(0, "right");
    updateCharacterState(char, null, 1 / 60);
    assert.equal(char.frameCount, 1);
    updateCharacterState(char, null, 1 / 60);
    assert.equal(char.frameCount, 2);
  });

  it("updateCharacterState transitions to idle when frame duration exceeded", () => {
    const char = createCharacter(0, "right");
    char.state = "hit_stun";
    char.frameCount = HIT_STUN_FRAMES;
    updateCharacterState(char, null, 1 / 60);
    assert.equal(char.state, "idle");
    assert.equal(char.frameCount, 0);
  });

  it("updateCharacterState auto-transitions knockback->idle after KNOCKBACK_FRAMES", () => {
    const char = createCharacter(0, "right");
    char.state = "knockback";
    char.frameCount = KNOCKBACK_FRAMES;
    updateCharacterState(char, null, 1 / 60);
    assert.equal(char.state, "idle");
  });

  it("updateCharacterState processes requested state change", () => {
    const char = createCharacter(0, "right");
    updateCharacterState(char, { requestedState: "walk" }, 1 / 60);
    assert.equal(char.state, "walk");
    assert.equal(char.frameCount, 0);
  });

  it("updateCharacterState rejects invalid requested state change", () => {
    const char = createCharacter(0, "right");
    updateCharacterState(char, { requestedState: "ko" }, 1 / 60);
    assert.equal(char.state, "idle");
  });

  it("updateCharacterState handles attack_light -> attack_heavy chain within window", () => {
    const char = createCharacter(0, "right");
    char.state = "attack_light";
    char.frameCount = FRAME_DATA.attack_light.totalFrames;
    updateCharacterState(char, { attack_heavy: true }, 1 / 60);
    assert.equal(char.state, "attack_heavy");
    assert.equal(char.frameCount, 0);
  });

  it("updateCharacterState does not chain attack_light->attack_heavy outside window", () => {
    const char = createCharacter(0, "right");
    char.state = "attack_light";
    char.frameCount = FRAME_DATA.attack_light.totalFrames + 5;
    updateCharacterState(char, { attack_heavy: true }, 1 / 60);
    assert.equal(char.state, "idle");
  });

  it("updateCharacterState does not transition ko or ring_out", () => {
    const ko = createCharacter(0, "right");
    ko.state = "ko";
    ko.frameCount = 100;
    updateCharacterState(ko, null, 1 / 60);
    assert.equal(ko.state, "ko");

    const ringOut = createCharacter(1, "left");
    ringOut.state = "ring_out";
    ringOut.frameCount = 100;
    updateCharacterState(ringOut, null, 1 / 60);
    assert.equal(ringOut.state, "ring_out");
  });

  it("updateCharacterState sets invulnerability on dodge", () => {
    const char = createCharacter(0, "right");
    updateCharacterState(char, { requestedState: "dodge" }, 1 / 60);
    assert.equal(char.state, "dodge");
    assert.equal(char.invulnerable, true);
    assert.equal(char.invulnerableFrames, DODGE_IFRAMES);
  });

  it("updateCharacterState decrements invulnerability frames", () => {
    const char = createCharacter(0, "right");
    char.invulnerable = true;
    char.invulnerableFrames = 3;
    updateCharacterState(char, null, 1 / 60);
    assert.equal(char.invulnerableFrames, 2);
    assert.equal(char.invulnerable, true);
    updateCharacterState(char, null, 1 / 60);
    assert.equal(char.invulnerableFrames, 1);
    updateCharacterState(char, null, 1 / 60);
    assert.equal(char.invulnerableFrames, 0);
    assert.equal(char.invulnerable, false);
  });
});

// ─── Combat: Hitbox Collision ─────────────────────────────────────

describe("Combat - Hitbox collision", () => {
  it("checkHitboxCollision returns {damage, knockback} when AABBs overlap", () => {
    const attacker = createCharacter(0, "right");
    attacker.state = "attack_light";
    attacker.frameCount = 3; // first active frame
    attacker.pos.x = 0;
    attacker.pos.y = 0;

    const defender = createCharacter(1, "left");
    defender.pos.x = 50;
    defender.pos.y = 0;

    const hit = checkHitboxCollision(attacker, defender);
    assert.ok(hit, "should detect hit on overlap");
    assert.equal(hit.damage, 5);
    assert.ok(hit.knockback.x > 0, "knockback should push right when attacker faces right");
  });

  it("checkHitboxCollision returns null when AABBs do not overlap", () => {
    const attacker = createCharacter(0, "right");
    attacker.state = "attack_light";
    attacker.frameCount = 3;
    attacker.pos.x = 0;
    attacker.pos.y = 0;

    const defender = createCharacter(1, "left");
    defender.pos.x = 500;
    defender.pos.y = 500;

    const hit = checkHitboxCollision(attacker, defender);
    assert.equal(hit, null);
  });

  it("checkHitboxCollision returns null when no hitbox for current frame", () => {
    const attacker = createCharacter(0, "right");
    attacker.state = "attack_light";
    attacker.frameCount = 1; // startup frame, no hitbox
    attacker.pos.x = 0;
    attacker.pos.y = 0;

    const defender = createCharacter(1, "left");
    defender.pos.x = 30;
    defender.pos.y = 0;

    const hit = checkHitboxCollision(attacker, defender);
    assert.equal(hit, null);
  });

  it("checkHitboxCollision mirrors hitbox x when attacker faces left", () => {
    const attacker = createCharacter(0, "left");
    attacker.state = "attack_light";
    attacker.frameCount = 3;
    attacker.pos.x = 100;
    attacker.pos.y = 0;

    const defender = createCharacter(1, "right");
    defender.pos.x = 30;
    defender.pos.y = 0;

    const hit = checkHitboxCollision(attacker, defender);
    assert.ok(hit, "should detect hit with mirrored hitbox");
    assert.ok(hit.knockback.x < 0, "knockback should push left when attacker faces left");
  });

  it("checkHitboxCollision returns null for non-attack state", () => {
    const attacker = createCharacter(0, "right");
    attacker.state = "idle";

    const defender = createCharacter(1, "left");
    defender.pos.x = 30;
    defender.pos.y = 0;

    const hit = checkHitboxCollision(attacker, defender);
    assert.equal(hit, null);
  });

  it("checkHitboxCollision prevents multi-hit per attack", () => {
    const attacker = createCharacter(0, "right");
    attacker.state = "attack_light";
    attacker.frameCount = 3;
    attacker.pos.x = 0;
    attacker.pos.y = 0;
    attacker.hitThisAttack = true;

    const defender = createCharacter(1, "left");
    defender.pos.x = 50;
    defender.pos.y = 0;

    const hit = checkHitboxCollision(attacker, defender);
    assert.equal(hit, null);
  });
});

// ─── Combat: Damage and Knockback ─────────────────────────────────

describe("Combat - Damage and knockback", () => {
  it("applyDamage reduces health", () => {
    const char = createCharacter(0, "right");
    const attacker = createCharacter(1, "left");
    applyDamage(char, { damage: 10, knockback: { x: 3, y: 0 } }, attacker);
    assert.equal(char.health, 90);
  });

  it("applyDamage clamps health to 0", () => {
    const char = createCharacter(0, "right");
    char.health = 5;
    const attacker = createCharacter(1, "left");
    applyDamage(char, { damage: 20, knockback: { x: 3, y: 0 } }, attacker);
    assert.equal(char.health, 0);
  });

  it("applyDamage triggers hit_stun for weak hits", () => {
    const char = createCharacter(0, "right");
    const attacker = createCharacter(1, "left");
    applyDamage(char, { damage: 5, knockback: { x: 3, y: 0 } }, attacker);
    assert.equal(char.state, "hit_stun");
    assert.equal(char.frameCount, 0);
  });

  it("applyDamage triggers knockback for strong hits", () => {
    const char = createCharacter(0, "right");
    const attacker = createCharacter(1, "left");
    applyDamage(char, { damage: 12, knockback: { x: 20, y: -5 } }, attacker);
    assert.equal(char.state, "knockback");
  });

  it("applyDamage does nothing when character is invulnerable", () => {
    const char = createCharacter(0, "right");
    char.invulnerable = true;
    const attacker = createCharacter(1, "left");
    applyDamage(char, { damage: 10, knockback: { x: 3, y: 0 } }, attacker);
    assert.equal(char.health, MAX_HEALTH);
  });

  it("applyDamage reduces damage by 50% when blocking", () => {
    const char = createCharacter(0, "right");
    char.state = "block";
    const attacker = createCharacter(1, "left");
    applyDamage(char, { damage: 20, knockback: { x: 3, y: 0 } }, attacker);
    assert.equal(char.health, 90); // 20 * 0.5 = 10 damage
  });

  it("applyDamage reflects knockback on parry within window", () => {
    const char = createCharacter(0, "right");
    char.state = "parry";
    char.frameCount = 2; // within PARRY_WINDOW
    const attacker = createCharacter(1, "left");
    const prevAttackerEnergy = attacker.energy;
    applyDamage(char, { damage: 10, knockback: { x: 5, y: 0 } }, attacker);
    // Parry should grant energy to attacker
    assert.ok(attacker.energy > prevAttackerEnergy, "attacker should gain energy on parry");
  });

  it("applyDamage grants energy to attacker", () => {
    const char = createCharacter(0, "right");
    const attacker = createCharacter(1, "left");
    applyDamage(char, { damage: 5, knockback: { x: 3, y: 0 } }, attacker);
    assert.equal(attacker.energy, ENERGY_GAIN_ON_HIT);
  });

  it("applyDamage grants energy to defender", () => {
    const char = createCharacter(0, "right");
    const attacker = createCharacter(1, "left");
    applyDamage(char, { damage: 5, knockback: { x: 3, y: 0 } }, attacker);
    assert.equal(char.energy, ENERGY_GAIN_ON_TAKEN);
  });

  it("applyDamage sets attacker.hitThisAttack to true", () => {
    const char = createCharacter(0, "right");
    const attacker = createCharacter(1, "left");
    assert.equal(attacker.hitThisAttack, false);
    applyDamage(char, { damage: 5, knockback: { x: 3, y: 0 } }, attacker);
    assert.equal(attacker.hitThisAttack, true);
  });

  it("applyDamage scales knockback with percentage", () => {
    const char1 = createCharacter(0, "right");
    const char2 = createCharacter(0, "right");
    char2.health = 50; // 50% damage taken

    const attacker1 = createCharacter(1, "left");
    const attacker2 = createCharacter(1, "left");

    applyDamage(char1, { damage: 5, knockback: { x: 10, y: 0 } }, attacker1);
    applyDamage(char2, { damage: 5, knockback: { x: 10, y: 0 } }, attacker2);

    // char2 (50% damaged) should have more knockback velocity
    assert.ok(
      Math.abs(char2.velocity.x) > Math.abs(char1.velocity.x),
      "Higher damage character should receive more knockback"
    );
  });

  it("applyDamage does not exceed max energy", () => {
    const char = createCharacter(0, "right");
    char.energy = 95;
    const attacker = createCharacter(1, "left");
    attacker.energy = 95;
    applyDamage(char, { damage: 5, knockback: { x: 3, y: 0 } }, attacker);
    assert.equal(char.energy, ENERGY_FINISHER_THRESHOLD);
    assert.equal(attacker.energy, ENERGY_FINISHER_THRESHOLD);
  });
});

// ─── Combat: Combo System ─────────────────────────────────────────

describe("Combat - Combo system", () => {
  it("checkCombo returns true when light->heavy within timing window", () => {
    const char = createCharacter(0, "right");
    char.comboState.lastAttack = "attack_light";
    char.frameCount = 5;
    const result = checkCombo(char, { attack_heavy: true });
    assert.ok(result);
  });

  it("checkCombo returns false when outside timing window", () => {
    const char = createCharacter(0, "right");
    char.comboState.lastAttack = "attack_light";
    char.frameCount = 20; // beyond COMBO_CHAIN_WINDOW
    const result = checkCombo(char, { attack_heavy: true });
    assert.equal(result, false);
  });

  it("checkCombo returns false when last attack was not light", () => {
    const char = createCharacter(0, "right");
    char.comboState.lastAttack = "attack_heavy";
    char.frameCount = 5;
    const result = checkCombo(char, { attack_heavy: true });
    assert.equal(result, false);
  });

  it("checkCombo returns false when no heavy input", () => {
    const char = createCharacter(0, "right");
    char.comboState.lastAttack = "attack_light";
    char.frameCount = 5;
    const result = checkCombo(char, {});
    assert.equal(result, false);
  });
});

// ─── Combat: Energy and Finisher ──────────────────────────────────

describe("Combat - Energy and finisher", () => {
  it("canUseFinisher returns false when energy below threshold", () => {
    const char = createCharacter(0, "right");
    char.energy = 50;
    assert.equal(canUseFinisher(char), false);
  });

  it("canUseFinisher returns true when energy at threshold", () => {
    const char = createCharacter(0, "right");
    char.energy = ENERGY_FINISHER_THRESHOLD;
    assert.ok(canUseFinisher(char));
  });

  it("canUseFinisher returns true when energy above threshold", () => {
    const char = createCharacter(0, "right");
    char.energy = 150;
    assert.ok(canUseFinisher(char));
  });
});

// ─── Arena ────────────────────────────────────────────────────────

describe("Arena", () => {
  it("ARENA_LAYOUTS has dojo arena", () => {
    assert.ok(ARENA_LAYOUTS.dojo);
  });

  it("dojo arena has bounds", () => {
    const arena = ARENA_LAYOUTS.dojo;
    assert.equal(arena.bounds.left, -500);
    assert.equal(arena.bounds.right, 500);
    assert.equal(arena.bounds.top, -400);
    assert.equal(arena.bounds.bottom, 600);
  });

  it("dojo arena has 4 platforms", () => {
    assert.equal(ARENA_LAYOUTS.dojo.platforms.length, 4);
  });

  it("dojo arena has 2 spawn points", () => {
    assert.equal(ARENA_LAYOUTS.dojo.spawnPoints.length, 2);
  });

  it("getDefaultArena returns dojo", () => {
    const arena = getDefaultArena();
    assert.equal(arena, ARENA_LAYOUTS.dojo);
  });
});

// ─── Physics ─────────────────────────────────────────────────────

describe("Physics - Gravity", () => {
  it("applyGravity increases velocity.y by GRAVITY * dt", () => {
    const char = createCharacter(0, "right");
    const prevVelY = char.velocity.y;
    applyGravity(char, 1 / 60);
    assert.ok(char.velocity.y > prevVelY, "velocity.y should increase (downward)");
    // GRAVITY = 980, dt = 1/60 => velocity.y += 980/60 ≈ 16.33
    assert.ok(char.velocity.y > 15 && char.velocity.y < 17);
  });

  it("applyGravity updates pos.y by velocity.y * dt", () => {
    const char = createCharacter(0, "right");
    char.pos.y = 0;
    char.velocity.y = 100;
    applyGravity(char, 1 / 60);
    // pos.y += velocity.y * dt = 100 * (1/60) ≈ 1.67
    assert.ok(char.pos.y > 0, "pos.y should move downward");
  });

  it("applyGravity accumulates over multiple calls", () => {
    const char = createCharacter(0, "right");
    char.pos.y = 0;
    applyGravity(char, 1 / 60);
    applyGravity(char, 1 / 60);
    // velocity should have increased twice
    assert.ok(char.velocity.y > 30);
  });
});

describe("Physics - Platform collision", () => {
  it("resolvePlatformCollision lands character on platform when falling", () => {
    const char = createCharacter(0, "right");
    char.velocity.y = 100; // falling
    char.pos.y = -10; // near platform surface
    const arena = getDefaultArena();
    // Main ground platform: y=0, so charBottom should be near 0
    // charBottom = pos.y + DEFAULT_HURTBOX.y + DEFAULT_HURTBOX.h = -10 + (-40) + 80 = 30
    // This is above platform, let's set pos.y so charBottom is just above platform
    char.pos.y = -50; // charBottom = -50 + (-40) + 80 = -10, need to be near y=0
    char.pos.y = -10; // charBottom = -10 + (-40) + 80 = 30, above platform y=0
    // Let's set it so charBottom passes through platform top
    char.pos.y = -5; // charBottom = -5 - 40 + 80 = 35, still above
    // Actually let me just set charBottom to be between plat.y and plat.y+15
    // plat.y = 0, so charBottom needs to be between 0 and 15
    char.pos.y = -35; // charBottom = -35 - 40 + 80 = 5, between 0 and 15
    resolvePlatformCollision(char, arena);
    assert.equal(char.grounded, true, "should be grounded after landing");
    assert.equal(char.velocity.y, 0, "velocity.y should be zeroed on landing");
  });

  it("resolvePlatformCollision does not snap from below (only when velocity.y > 0)", () => {
    const char = createCharacter(0, "right");
    char.velocity.y = -100; // rising, not falling
    char.pos.y = -35;
    const arena = getDefaultArena();
    const prevY = char.pos.y;
    resolvePlatformCollision(char, arena);
    assert.equal(char.pos.y, prevY, "position should not change when rising");
    assert.equal(char.grounded, true, "grounded should remain unchanged");
  });

  it("resolvePlatformCollision transitions fall->idle on landing", () => {
    const char = createCharacter(0, "right");
    char.state = "fall";
    char.velocity.y = 100;
    char.pos.y = -35; // charBottom = 5, between 0 and 15
    const arena = getDefaultArena();
    resolvePlatformCollision(char, arena);
    assert.equal(char.state, "idle", "should transition from fall to idle");
    assert.equal(char.frameCount, 0);
  });

  it("resolvePlatformCollision does nothing when character is above all platforms", () => {
    const char = createCharacter(0, "right");
    char.velocity.y = 100;
    char.pos.y = -500; // far above all platforms
    const arena = getDefaultArena();
    resolvePlatformCollision(char, arena);
    assert.equal(char.grounded, true, "should remain in original grounded state");
    assert.ok(char.velocity.y > 0, "velocity should not be zeroed");
  });
});

describe("Physics - Ring-out detection", () => {
  it("checkRingOut returns false when character is within arena bounds", () => {
    const char = createCharacter(0, "right");
    char.pos.y = 0;
    const arena = getDefaultArena();
    assert.equal(checkRingOut(char, arena), false);
  });

  it("checkRingOut returns false when character is near bottom bound", () => {
    const char = createCharacter(0, "right");
    char.pos.y = 600; // exactly at bottom
    const arena = getDefaultArena();
    assert.equal(checkRingOut(char, arena), false);
  });

  it("checkRingOut returns true when character falls below bottom + 100", () => {
    const char = createCharacter(0, "right");
    char.pos.y = 701; // 600 + 100 + 1
    const arena = getDefaultArena();
    assert.equal(checkRingOut(char, arena), true);
  });

  it("checkRingOut returns false at exactly bottom + 100 (not strictly greater)", () => {
    const char = createCharacter(0, "right");
    char.pos.y = 700; // exactly 600 + 100
    const arena = getDefaultArena();
    assert.equal(checkRingOut(char, arena), false);
  });
});

// ─── Delta-state computation ──────────────────────────────────────

describe("Delta-state computation", () => {
  function makeRoom(characters, opts = {}) {
    return {
      tick: opts.tick || 100,
      fightPhase: opts.fightPhase || "fighting",
      countdownValue: opts.countdownValue || 0,
      characters,
    };
  }

  it("computeDelta returns {tick, fightPhase, countdown, characters, roundWins}", () => {
    const char = createCharacter(0, "right");
    const room = makeRoom([char]);
    const delta = computeDelta(room, null);
    assert.equal(delta.tick, 100);
    assert.equal(delta.fightPhase, "fighting");
    assert.equal(delta.countdown, 0);
    assert.ok(Array.isArray(delta.characters));
    assert.ok(Array.isArray(delta.roundWins));
  });

  it("computeDelta includes all characters on first call (no previousState)", () => {
    const char1 = createCharacter(0, "right");
    const char2 = createCharacter(1, "left");
    const room = makeRoom([char1, char2]);
    const delta = computeDelta(room, null);
    assert.equal(delta.characters.length, 2);
  });

  it("computeDelta skips unchanged characters (position within threshold)", () => {
    const char = createCharacter(0, "right");
    const room = makeRoom([char]);
    const firstDelta = computeDelta(room, null);
    // Second call with same state
    const secondDelta = computeDelta(room, firstDelta);
    assert.equal(secondDelta.characters.length, 0, "should skip unchanged character");
  });

  it("computeDelta includes characters on state change", () => {
    const char = createCharacter(0, "right");
    const room = makeRoom([char]);
    const firstDelta = computeDelta(room, null);
    // Change state
    char.state = "attack_light";
    const secondDelta = computeDelta(room, firstDelta);
    assert.equal(secondDelta.characters.length, 1, "should include character on state change");
    assert.equal(secondDelta.characters[0].state, "attack_light");
  });

  it("computeDelta includes characters on health change", () => {
    const char = createCharacter(0, "right");
    const room = makeRoom([char]);
    const firstDelta = computeDelta(room, null);
    // Change health
    char.health = 50;
    const secondDelta = computeDelta(room, firstDelta);
    assert.equal(secondDelta.characters.length, 1, "should include character on health change");
    assert.equal(secondDelta.characters[0].health, 50);
  });

  it("computeDelta includes characters when position moves beyond threshold", () => {
    const char = createCharacter(0, "right");
    const room = makeRoom([char]);
    const firstDelta = computeDelta(room, null);
    // Move beyond threshold (POSITION_THRESHOLD = 2.0)
    char.pos.x += 5;
    char.pos.y += 5;
    const secondDelta = computeDelta(room, firstDelta);
    assert.equal(secondDelta.characters.length, 1, "should include character when position changes beyond threshold");
  });

  it("computeDelta rounds positions to 1 decimal", () => {
    const char = createCharacter(0, "right");
    char.pos.x = 100.567;
    char.pos.y = -50.321;
    const room = makeRoom([char]);
    const delta = computeDelta(room, null);
    assert.equal(delta.characters[0].pos.x, 100.6);
    assert.equal(delta.characters[0].pos.y, -50.3);
  });

  it("computeDelta includes roundWins from all characters", () => {
    const char1 = createCharacter(0, "right");
    const char2 = createCharacter(1, "left");
    char1.roundWins = 2;
    char2.roundWins = 1;
    const room = makeRoom([char1, char2]);
    const delta = computeDelta(room, null);
    assert.deepEqual(delta.roundWins, [2, 1]);
  });

  it("computeDelta uses countdownValue from room", () => {
    const char = createCharacter(0, "right");
    const room = makeRoom([char], { countdownValue: 3 });
    const delta = computeDelta(room, null);
    assert.equal(delta.countdown, 3);
  });

  it("computeDelta defaults countdown to 0 when not set", () => {
    const char = createCharacter(0, "right");
    const room = { tick: 1, fightPhase: "countdown", characters: [char] };
    const delta = computeDelta(room, null);
    assert.equal(delta.countdown, 0);
  });

  it("computeDelta serializes character with all expected fields", () => {
    const char = createCharacter(0, "right");
    const room = makeRoom([char]);
    const delta = computeDelta(room, null);
    const s = delta.characters[0];
    assert.equal(s.seatIndex, 0);
    assert.equal(s.state, "idle");
    assert.equal(s.frameCount, 0);
    assert.ok(s.pos);
    assert.ok(s.velocity);
    assert.equal(s.facing, "right");
    assert.equal(s.health, MAX_HEALTH);
    assert.equal(s.energy, 0);
    assert.equal(s.grounded, true);
    assert.equal(s.invulnerable, false);
  });

  it("POSITION_THRESHOLD is 2.0 for 60Hz optimization", () => {
    assert.equal(POSITION_THRESHOLD, 2.0);
  });
});

// ─── Round management (placeholder) ───────────────────────────────

describe("Round management (placeholder)", () => {
  it("round wins tracked correctly", () => {
    const char = createCharacter(0, "right");
    assert.equal(char.roundWins, 0);
    char.roundWins += 1;
    assert.equal(char.roundWins, 1);
  });
});
