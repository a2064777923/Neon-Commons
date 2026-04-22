---
phase: 05-board-gameplay-expansion
plan: 02
subsystem: "testing"
tags:
  - playwright
  - node:test
  - gomoku
  - chinese-checkers
provides:
  - "Node regressions cover Gomoku opening-rule normalization and enforcement."
  - "Node regressions cover Chinese Checkers target-camp progress serialization."
  - "Browser smoke covers the new board option UI, live start flow, and progress badges."
affects:
  - board rooms
  - regression suite
  - phase-06-hardening
tech-stack:
  added: []
  patterns:
    - "Board smoke waits for real-time room controls to become interactive before emitting actions"
    - "Socket-dependent board controls are disabled until the live channel is ready"
key-files:
  created: []
  modified:
    - test-logic/board-config.test.js
    - test-logic/chinesecheckers-logic.test.js
    - tests/board-games.spec.js
    - pages/board/[roomNo].js
key-decisions:
  - "Keep the Gomoku center-opening smoke assertion at behavior level: illegal corner click remains empty, center move succeeds."
  - "Prevent ready/add-bot actions from silently no-oping by gating board-room socket actions on connection readiness."
patterns-established:
  - "Realtime room smoke should wait for controls to become enabled instead of assuming socket subscription is already live."
requirements-completed:
  - BOARD-01
duration: "15min"
completed: 2026-04-22
---

# Phase 5 Plan 02 Summary

**Board regression coverage now proves Gomoku opening enforcement, Chinese Checkers progress UI, and socket-ready room actions end to end**

## Performance

- **Duration:** 15 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added `test-logic/board-config.test.js` to cover Gomoku `openingRule`, invalid-value fallback, center-opening rejection, accepted center move, and Chinese progress serialization.
- Extended Chinese Checkers logic coverage and board Playwright smoke to assert live progress badges alongside room creation, start, and move sync.
- Fixed a real board-room race by disabling ready/add-bot actions until Socket.IO is connected so early clicks cannot silently disappear.

## Task Commits

1. **Task 1: Add node regressions for board config and serialization** - `uncommitted working tree`
2. **Task 2: Extend browser smoke to cover new board surfaces end to end** - `uncommitted working tree`

## Files Created/Modified

- `test-logic/board-config.test.js` - Covers board config defaults, normalization, center-opening enforcement, and progress serialization.
- `test-logic/chinesecheckers-logic.test.js` - Verifies target-camp progress increases when a piece reaches the goal camp.
- `tests/board-games.spec.js` - Exercises Gomoku opening selection, illegal first move rejection, Chinese progress badges, and live move sync.
- `pages/board/[roomNo].js` - Gates ready/add-bot/move socket actions on connection readiness to avoid a live-room interaction race.

## Decisions & Deviations

- Deviation from the original plan: verification exposed a socket readiness race in the board room, so `pages/board/[roomNo].js` was updated as part of the validation pass.
- The smoke test now waits for buttons and cells to become interactive before clicking, matching real-time room startup instead of assuming immediate socket readiness.

## Next Phase Readiness

- Phase 5 has full targeted verification coverage and is ready to be marked complete so Phase 6 can build on the hardened board regression surface.
