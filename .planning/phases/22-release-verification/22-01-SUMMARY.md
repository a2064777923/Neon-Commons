---
phase: 22-release-verification
plan: 01
subsystem: testing
tags: [node:test, logic-tests, room-managers, pickred, bigtwo, mahjong, racing, fighting]

requires:
  - phase: 21-fighting-delivery
    provides: Fighting game room manager and systems
provides:
  - Full-round smoke tests for all 5 new games
  - Reconnection recovery smoke tests for all 5 games
  - Pick Red and Big Two room manager implementations
  - All tests registered in test:logic:critical script
affects: [23-release-verification]

tech-stack:
  added: [pickred-manager, bigtwo-manager]
  patterns: [room-manager-singleton, card-game-loop, reconnection-recovery]

key-files:
  created:
    - test-logic/pickred-logic.test.js
    - test-logic/bigtwo-logic.test.js
    - lib/card/pickred-manager.js
    - lib/card/bigtwo-manager.js
  modified:
    - test-logic/mahjong-logic.test.js
    - test-logic/racing-logic.test.js
    - test-logic/fighting-logic.test.js
    - lib/racing/manager.js
    - lib/fighting/manager.js
    - package.json

key-decisions:
  - Created Pick Red and Big Two room managers as Rule 3 deviation
  - Added familyKey to racing and fighting managers for consistency

requirements-completed: [PLAT-06]
duration: 18min
completed: 2026-05-06
---

# Phase 22 Plan 01: Logic Smoke Tests Summary

Full-round + reconnection smoke tests for 5 games with newly created Pick Red and Big Two room managers

## Performance
- Duration: 18 min
- Started: 2026-05-06T13:22:13Z
- Completed: 2026-05-06T13:40:18Z
- Tasks: 2
- Files modified: 10

## Accomplishments
- Created Pick Red room manager with full game logic
- Created Big Two room manager with full game logic
- All 5 games have full-round smoke tests
- All 5 games have reconnection smoke tests
- All new test files registered in package.json test:logic:critical

## Task Commits
1. Task 1: fb0e0ef - Pick Red and Big Two tests
2. Task 2: abb4d37 - Mahjong, Racing, Fighting tests

## Deviations from Plan

1. [Rule 3] Created missing Pick Red and Big Two room managers (fb0e0ef)
2. [Rule 1] Fixed Pick Red end-round detection for deck-empty case (fb0e0ef)
3. [Rule 3] Added familyKey to racing and fighting managers (abb4d37)

Total deviations: 3 auto-fixed (2 blocking, 1 bug)

## Issues Encountered
- Room directory snapshot persist fails due to no PostgreSQL (expected, non-blocking)

*Phase: 22-release-verification*
*Completed: 2026-05-06*