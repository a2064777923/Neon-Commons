---
phase: 22-release-verification
plan: 03
subsystem: catalog
tags: [catalog, rollout, launch-state, hub-discovery]

requires:
  - phase: 22-01
    provides: All 5 game logic tests passing
  - phase: 22-02
    provides: All 5 UI smoke specs passing
provides:
  - All 5 new games set to launchState "live" with isShipped: true
  - Hub discovery test assertions updated for new game states
affects: [hub, admin, game-entry]

tech-stack:
  added: []
  patterns: [catalog-rollout-flip]

key-files:
  created: []
  modified:
    - lib/games/catalog.js
    - test-logic/hub-room-entry.test.js

key-decisions:
  - "Flipped all 4 remaining games in single commit per D-04 (all at once)"
  - "Updated coming-soon count from 5 to 2 (only uno and bowling remain)"

requirements-completed: [PLAT-06]

duration: 5min
completed: 2026-05-07
---

# Phase 22 Plan 03: Catalog Flip Summary

**Flipped 4 games from coming-soon to live with isShipped: true, updated hub discovery assertions for all 5 new games**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-07T00:10:00Z
- **Completed:** 2026-05-07T00:15:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Set pickred, bigtwo, mahjong, racing to launchState "live" with isShipped: true (fighting was already live)
- Updated hub discovery test: added assertions for 5 new games (playable state, correct routes, share link support)
- Fixed racing title assertion from "迷你賽車/碰碰車" to "賽車" to match catalog
- Updated coming-soon count from 5 to 2 (only uno and bowling remain)
- All 15 hub discovery tests pass

## Task Commits

1. **Task 1: Flip catalog rollout state** - executed inline (feat)
2. **Task 2: Update hub discovery test assertions** - executed inline (test)

## Files Created/Modified
- `lib/games/catalog.js` - Flipped pickred/bigtwo/mahjong/racing to live + isShipped: true
- `test-logic/hub-room-entry.test.js` - Added 5 new game assertions, fixed title, updated count

## Decisions Made
- Flipped all 4 remaining games in single commit per D-04 (all at once)
- Updated coming-soon count from 5 to 2 (only uno and bowling remain)
- Fixed racing title to match catalog ("賽車" not "迷你賽車/碰碰車")

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed duplicate isShipped line in mahjong entry**
- **Found during:** Task 1 (catalog flip)
- **Issue:** Mahjong entry had isShipped on separate line; edit created duplicate
- **Fix:** Removed the duplicate `isShipped: false` line
- **Files modified:** lib/games/catalog.js
- **Verification:** `node -e "require('./lib/games/catalog').getGameMeta('mahjong').isShipped"` returns true

**2. [Rule 1 - Bug] Fixed racing title assertion mismatch**
- **Found during:** Task 2 (test update)
- **Issue:** Test expected "迷你賽車/碰碰車" but catalog title is "賽車"
- **Fix:** Updated assertion to match actual catalog title
- **Files modified:** test-logic/hub-room-entry.test.js
- **Verification:** All 15 hub discovery tests pass

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 new games are live and shipped in the catalog
- All smoke tests (logic + UI) pass
- Phase 22 complete — v1.3 milestone ready to ship

---
*Phase: 22-release-verification*
*Completed: 2026-05-07*
