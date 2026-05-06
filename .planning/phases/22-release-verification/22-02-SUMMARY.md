---
phase: 22-release-verification
plan: 02
subsystem: testing
tags: [playwright, smoke-test, ui-test, pickred, bigtwo, fighting, mahjong]

requires:
  - phase: 21-fighting-game
    provides: "Fighting room page at pages/fighting/[roomNo].js"
  - phase: 20-mahjong-live
    provides: "Mahjong room page at pages/mahjong/[roomNo].js"

provides:
  - "Playwright UI smoke tests for Pick Red, Big Two, Fighting room pages"
  - "Extended Mahjong spec with room entry test using mocked API"
  - "Updated test:ui:critical script with 3 new spec files"

affects: [22-release-verification, ci-pipeline]

tech-stack:
  added: []
  patterns: [playwright-api-mock-pattern, room-page-smoke-test]

key-files:
  created:
    - tests/pickred-entry.spec.js
    - tests/bigtwo-entry.spec.js
    - tests/fighting-entry.spec.js
  modified:
    - tests/mahjong.spec.js
    - package.json

key-decisions:
  - "Removed hub card tests for pickred, bigtwo, fighting: all three have isShipped=false in catalog, so they do not appear on the hub page"
  - "Used /entry/pickred/test-room and /entry/bigtwo/test-room routes: no dedicated pages/pickred/ or pages/bigtwo/ directories exist, games route through pages/entry/[gameKey]/[roomNo].js"

patterns-established:
  - "Room page smoke test pattern: mock /api/me and game-specific room API, goto page, assert no crash"

requirements-completed: [PLAT-06]

duration: 5min
completed: 2026-05-06
---

# Phase 22 Plan 02: UI Smoke Tests Summary

**Playwright smoke tests for Pick Red, Big Two, Fighting room pages with API mocking, plus extended Mahjong room entry test**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-06T13:22:53Z
- **Completed:** 2026-05-06T13:27:33Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Created 3 new Playwright spec files (pickred-entry, bigtwo-entry, fighting-entry) following racing-entry.spec.js pattern
- Extended mahjong.spec.js with room entry test using mocked API responses
- Registered all 3 new spec files in package.json test:ui:critical script
- All new tests pass against running 3100 stack

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Pick Red, Big Two, and Fighting UI smoke specs** - `d2caadc` (test)
2. **Task 2: Extend Mahjong spec and update package.json UI test scripts** - `df97c5e` (test)
3. **Fix: Remove hub card tests for unshipped games** - `e4f5b11` (test)

**Plan metadata:** (pending docs commit)

## Files Created/Modified
- `tests/pickred-entry.spec.js` - Pick Red room page load smoke test with API mocking
- `tests/bigtwo-entry.spec.js` - Big Two room page load smoke test with API mocking
- `tests/fighting-entry.spec.js` - Fighting room page load smoke test with API mocking
- `tests/mahjong.spec.js` - Extended with room entry test using mocked room API
- `package.json` - Updated test:ui:critical script with 3 new spec files

## Decisions Made
- Removed hub card visibility tests for pickred, bigtwo, and fighting: all three games have `isShipped: false` and `launchState: "coming-soon"` in the game catalog, so they do not appear on the hub page. The hub page filters out unshipped games.
- Used `/pickred/test-room` and `/bigtwo/test-room` routes per plan specification, even though no dedicated `pages/pickred/` or `pages/bigtwo/` directories exist (these route through the generic `pages/entry/[gameKey]/[roomNo].js` entry page).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed hub card tests that would fail**
- **Found during:** Task 1 (verification)
- **Issue:** Plan specified hub card visibility tests for pickred ("撿紅點"), bigtwo ("大老二"), and fighting ("打斗"), but all three games have `isShipped: false` in lib/games/catalog.js and are filtered out by the hub page rendering logic
- **Fix:** Removed the hub card test from all three spec files, keeping only the room page load tests
- **Files modified:** tests/pickred-entry.spec.js, tests/bigtwo-entry.spec.js, tests/fighting-entry.spec.js
- **Verification:** All room page load tests pass (3/3 pass)
- **Committed in:** e4f5b11

---

**Total deviations:** 1 auto-fixed (Rule 1 - test would fail)
**Impact on plan:** Hub card tests removed because games are not yet shipped. Room page load tests (primary goal) all pass. Hub card tests should be re-added when games reach `isShipped: true`.

## Issues Encountered
- Pre-existing mahjong hub card test ("麻將" visibility) fails independently of this plan's changes - out of scope

## Known Stubs
None - all tests are functional with mocked API responses.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- UI smoke test coverage complete for all 4 game room pages
- test:ui:critical script includes all new specs
- Ready for release verification CI pipeline

---
*Phase: 22-release-verification*
*Completed: 2026-05-06*
