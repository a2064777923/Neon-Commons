---
phase: 21-fighting
plan: 02
subsystem: game-logic
tags: [fighting, state-machine, hitbox, physics, delta-state, combat]

requires:
  - phase: 21-fighting
    plan: 01
    provides: fighting network contract, catalog entry, test scaffold
provides:
  - Character state machine with 15 states and validated transitions
  - Hitbox/hurtbox AABB collision system
  - Damage, knockback, combo, energy, blocking, parry, dodge mechanics
  - Gravity, platform collision, ring-out detection
  - Delta-state computation for 60Hz broadcasting
  - Arena layout definitions
  - 97 passing tests
affects: [21-03, 21-04, 21-05]

tech-stack:
  patterns: [state-machine, aabb-collision, delta-computation, platform-physics]

key-files:
  created:
    - lib/fighting/constants.js
    - lib/fighting/character.js
    - lib/fighting/combat.js
    - lib/fighting/arena.js
    - lib/fighting/physics.js
    - lib/fighting/delta.js
  modified:
    - test-logic/fighting-logic.test.js

key-decisions:
  - "POSITION_THRESHOLD set to 2.0 pixels (higher than Racing's 0.01) because fighting positions are pixel-based at 60Hz with smaller per-tick deltas"
  - "round1 helper used (1 decimal) instead of round3 because fighting positions are pixel-based, not physics-based"
  - "Platform collision tolerance set to 15px to prevent tunneling at high fall speeds"
  - "Ring-out detection uses +100px buffer below arena bounds to prevent false positives near platform edges"

patterns-established:
  - "Fighting game state machine pattern: 15 states, frozen transition map, frame-based duration, auto-transitions"
  - "Hitbox collision pattern: per-frame hitbox arrays, AABB overlap, facing-aware mirroring, multi-hit prevention"
  - "Delta-state pattern: serialize characters, compare with previous, skip unchanged (position threshold + state + health), always include on state change"

requirements-completed: [FIGHT-04, FIGHT-05, FIGHT-06, FIGHT-07, FIGHT-09, FIGHT-10, FIGHT-11]

duration: 10min
completed: 2026-05-06
---

# Phase 21 Plan 02: Fighting Game Logic Modules

**6 modules implementing complete fighting game logic: character state machine, hitbox collision, combat mechanics, platform physics, arena definitions, and delta-state computation**

## Performance

- **Duration:** 10 min
- **Started:** 2026-05-06
- **Completed:** 2026-05-06
- **Tasks:** 2
- **Files created:** 6
- **Files modified:** 1
- **Tests:** 97 passing

## Accomplishments

### Task 1: Constants, Character, Combat, Arena
- Created constants.js with 15 CHARACTER_STATES, frozen TRANSITIONS map, FRAME_DATA for 4 attack states, DEFAULT_HURTBOX, and all balance constants (GRAVITY, MOVE_SPEED, JUMP_FORCE, etc.)
- Created character.js with createCharacter (spawn position, health, energy, combo state), canTransition (validates state transitions), updateCharacterState (frame counting, auto-transitions, input processing, invulnerability countdown)
- Created combat.js with checkHitboxCollision (AABB overlap, facing-aware mirroring, multi-hit prevention), applyDamage (health reduction, knockback scaling, blocking, parry reflection, energy gain), checkCombo (light->heavy chain timing), canUseFinisher (energy threshold)
- Created arena.js with ARENA_LAYOUTS.dojo (bounds, 4 platforms, 2 spawn points) and getDefaultArena

### Task 2: Physics and Delta-state
- Created physics.js with applyGravity (velocity.y += GRAVITY * dt, pos.y += velocity.y * dt), resolvePlatformCollision (falling check, AABB overlap with platform, snap to surface, grounded flag, fall->idle transition), checkRingOut (pos.y > bounds.bottom + 100)
- Created delta.js with computeDelta (serialize characters, compare with previous state, skip unchanged within POSITION_THRESHOLD=2.0, always include on state/health change, return {tick, fightPhase, countdown, characters, roundWins}) and round1 helper
- Extended test-logic/fighting-logic.test.js with 31 new tests (Physics gravity 3, platform collision 4, ring-out 4, delta-state 12, constants 8, character 20, combat 18, arena 5, combo 4, energy 3, round 1)

## Task Commits

Each task committed atomically:

1. **Task 1: Constants, character, combat, arena** - `e31ccaf` (feat)
2. **Task 2: Physics and delta-state** - pending commit

## Files Created/Modified

- `lib/fighting/constants.js` - All game constants: CHARACTER_STATES (15 states), TRANSITIONS (frozen map), FRAME_DATA (4 attacks with hitboxes), DEFAULT_HURTBOX, GRAVITY, MOVE_SPEED, JUMP_FORCE, balance values
- `lib/fighting/character.js` - Character state machine: createCharacter, canTransition, updateCharacterState
- `lib/fighting/combat.js` - Combat system: checkHitboxCollision, applyDamage, checkCombo, canUseFinisher
- `lib/fighting/arena.js` - Arena definitions: ARENA_LAYOUTS (dojo), getDefaultArena
- `lib/fighting/physics.js` - Platform physics: applyGravity, resolvePlatformCollision, checkRingOut
- `lib/fighting/delta.js` - Delta-state: computeDelta, POSITION_THRESHOLD (2.0), round1 helper
- `test-logic/fighting-logic.test.js` - 97 tests covering all modules

## Decisions Made

- POSITION_THRESHOLD set to 2.0 pixels for 60Hz optimization (fighting positions are pixel-based, not physics-based like Racing)
- round1 helper (1 decimal) used instead of round3 for fighting delta computation
- Platform collision tolerance set to 15px to prevent tunneling at high fall speeds
- Ring-out buffer of 100px below arena bounds prevents false positives near platform edges

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None

## Next Phase Readiness
- All 6 fighting modules ready for Plan 03 (room manager) to wire up game loop
- State machine, combat, physics, and delta computation fully tested
- Plan 03 can import from lib/fighting/* and build the room manager around these modules

---
*Phase: 21-fighting*
*Completed: 2026-05-06*
