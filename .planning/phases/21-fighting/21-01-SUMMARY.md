---
phase: 21-fighting
plan: 01
subsystem: platform
tags: [pixi.js, socket.io, network-contract, game-catalog, fighting]

requires:
  - phase: 20-racing
    provides: light-3d family key, socket handler registration pattern, racing room manager pattern
provides:
  - pixi.js and @pixi/react dependencies installed
  - Fighting entries in SOCKET_EVENTS, API_ROUTE_PATTERNS, and API_ROUTES
  - Fighting game catalog entry (gameKey: fighting, familyKey: light-3d)
  - Fighting socket handler stubs in socket-server.js
  - getFightingDefaultConfig and getGameLimits for fighting
  - Test scaffold for fighting logic (14 passing tests)
affects: [21-02, 21-03, 21-04, 21-05]

tech-stack:
  added: [pixi.js@8.18.1, @pixi/react@8.0.5]
  patterns: [socket-event-registration, catalog-entry-light-3d, placeholder-manager-stub]

key-files:
  created:
    - test-logic/fighting-logic.test.js
  modified:
    - package.json
    - package-lock.json
    - lib/shared/network-contract.js
    - lib/games/catalog.js
    - lib/socket-server.js

key-decisions:
  - "@pixi/react installed with --legacy-peer-deps due to React 19 peer dependency conflict with project React 18"
  - "Fighting socket handlers commented out until Plan 02 delivers lib/fighting/manager.js"

patterns-established:
  - "Manager stub pattern: require commented out, handler bodies commented out, ready for Plan 02 wiring"

requirements-completed: [PLAT-01, PLAT-03]

duration: 5min
completed: 2026-05-06
---

# Phase 21 Plan 01: Install Dependencies and Add Fighting Network Contract

**pixi.js@8.18.1 installed, fighting socket events and API routes registered, catalog entry under light-3d family, socket handler stubs and test scaffold created**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-06T05:38:00Z
- **Completed:** 2026-05-06T05:43:08Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Installed pixi.js@8.18.1 and @pixi/react@8.0.5 as project dependencies
- Added complete fighting network contract (6 socket events, API route patterns, route builders)
- Registered fighting in game catalog under light-3d family with hubOrder 20, coming-soon state
- Created fighting socket handler stubs in socket-server.js (commented, ready for Plan 02)
- Created test scaffold with 14 passing tests (3 catalog + 3 contract + 8 placeholders)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install pixi.js and add fighting network contract entries** - `0b24908` (feat)
2. **Task 2: Register fighting socket handlers and create test scaffold** - `9534d12` (feat)

## Files Created/Modified
- `package.json` - Added pixi.js@8.18.1 and @pixi/react@8.0.5 dependencies
- `package-lock.json` - Updated lock file with new dependencies
- `lib/shared/network-contract.js` - Added fighting socket events, API route patterns, and route builders
- `lib/games/catalog.js` - Added fighting catalog entry, getFightingDefaultConfig, getGameLimits for fighting
- `lib/socket-server.js` - Added fighting socket handler stubs (commented until Plan 02)
- `test-logic/fighting-logic.test.js` - Created test scaffold with catalog/contract tests and placeholders

## Decisions Made
- @pixi/react installed with --legacy-peer-deps due to React 19 peer dependency conflict with project React 18
- Fighting socket handlers commented out until Plan 02 delivers lib/fighting/manager.js

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Network contract and catalog entry ready for Plan 02 (room manager) to wire up socket handlers
- Test scaffold ready for Plan 03 to implement character state machine, hitbox collision, and platform physics
- Plan 02 can uncomment fighting manager require and handler bodies once lib/fighting/manager.js exists

---
*Phase: 21-fighting*
*Completed: 2026-05-06*
