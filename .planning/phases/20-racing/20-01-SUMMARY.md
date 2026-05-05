---
phase: 20-racing
plan: 01
subsystem: testing
tags: [three.js, cannon-es, physics, network-contract, game-catalog]

# Dependency graph
requires:
  - phase: 13-admin-ha-rollout-control-plane
    provides: stable admin control plane and release verification baseline
provides:
  - three@0.184.0 and cannon-es@0.20.0 installed and CJS-verified
  - Racing socket events (subscribe, ready, input, update, error, chat)
  - Racing API route patterns and builders (/api/racing/rooms)
  - Racing game catalog entry (gameKey: racing, familyKey: light-3d, launchState: coming-soon)
  - getRacingDefaultConfig (maxPlayers: 4, lapCount: 3)
  - getGameLimits for racing (2-4 players)
  - test-logic/racing-logic.test.js scaffold with 11 passing tests
affects: [20-racing, light-3d family]

# Tech tracking
tech-stack:
  added: [three@0.184.0, cannon-es@0.20.0]
  patterns: [server-authoritative physics, delta-state broadcasting, CJS cannon-es import]

key-files:
  created:
    - test-logic/racing-logic.test.js
  modified:
    - package.json
    - package-lock.json
    - lib/shared/network-contract.js
    - lib/games/catalog.js

key-decisions:
  - "cannon-es 0.20.0 works with CJS require() in Node.js 18 — no dynamic import wrapper needed"
  - "Replaced miniracers placeholder with racing entry in GAME_CATALOG"
  - "Set launchState to coming-soon for staged rollout per PLAT-05"

patterns-established:
  - "Racing socket event namespace: racing:* (subscribe, ready, input, update, error, chat)"
  - "Racing API route namespace: /api/racing/rooms/*"
  - "Light-3d game family pattern with hubOrder 10"

requirements-completed: [PLAT-01, PLAT-05]

# Metrics
duration: 2min
completed: 2026-05-05
---

# Phase 20 Plan 01: Racing Risk Spike Summary

**three + cannon-es installed with CJS compatibility verified, racing network contract and catalog entry registered, test scaffold with 11 passing tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-05T01:24:39Z
- **Completed:** 2026-05-05T01:27:26Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- De-risked cannon-es CJS compatibility — confirmed `require('cannon-es')` works in Node.js 18 without ERR_REQUIRE_ESM
- Registered racing game in network contract (socket events + API routes) and game catalog
- Created test scaffold with catalog, network contract, and placeholder physics/delta/lap tests (all 11 passing)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and verify cannon-es CJS compatibility** - `04661c4` (feat)
2. **Task 2: Add racing network contract and catalog entries** - `c0bd073` (feat)
3. **Task 3: Create racing test scaffold** - `36a5336` (test)

## Files Created/Modified
- `package.json` - Added three@0.184.0 and cannon-es@0.20.0 dependencies
- `package-lock.json` - Updated lockfile with new dependencies
- `lib/shared/network-contract.js` - Added racing socket events and API route patterns/builders
- `lib/games/catalog.js` - Replaced miniracers with racing entry, added getRacingDefaultConfig and racing getGameLimits
- `test-logic/racing-logic.test.js` - Created test scaffold with 11 tests across 5 describe blocks

## Decisions Made
- cannon-es 0.20.0 works with CJS require() in Node.js 18 — no dynamic import wrapper needed (highest-risk item from research resolved)
- Replaced miniracers placeholder with racing entry in GAME_CATALOG (single canonical gameKey)
- Set launchState to "coming-soon" for staged rollout per PLAT-05

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- cannon-es CJS compatibility confirmed — safe to build server-side physics in Plan 20-02
- Network contract and catalog entries ready for room manager and frontend integration
- Test scaffold ready for physics, delta-state, and lap detection test expansion

## Known Stubs
- `test-logic/racing-logic.test.js` — Delta-state and lap detection tests are placeholders (will be filled in Plan 20-02)
- `test-logic/racing-logic.test.js` — Physics tests verify cannon-es basics only (full car physics tests in Plan 20-02)

## Self-Check: PASSED

- All created files verified on disk
- All task commits verified in git log (04661c4, c0bd073, 36a5336)

---
*Phase: 20-racing*
*Completed: 2026-05-05*
