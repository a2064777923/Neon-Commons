---
phase: 19-mahjong
plan: 02
subsystem: api
tags: [mahjong, room-manager, socket.io, card-family, claim-window]

# Dependency graph
requires:
  - phase: 19-mahjong/01
    provides: mahjong-tiles.js tile encoding, shuffle, claim detection, win detection
provides:
  - MahjongRoomManager singleton with full game lifecycle
  - Backend API handlers for mahjong rooms (list/create, detail, join)
  - Socket event registration for real-time mahjong gameplay
  - Network contract with mahjong routes and events
  - Game catalog entry for mahjong
  - Admin live room provider for mahjong
affects: [19-mahjong/03, 19-mahjong/04]

# Tech tracking
tech-stack:
  added: []
  patterns: [mahjong-room-manager-singleton, claim-window-timer, per-seat-privacy]

key-files:
  created:
    - lib/card/mahjong-manager.js
    - backend/handlers/mahjong/rooms/index.js
    - backend/handlers/mahjong/rooms/[roomNo]/index.js
    - backend/handlers/mahjong/rooms/[roomNo]/join.js
    - test-logic/mahjong-logic.test.js
  modified:
    - lib/shared/network-contract.js
    - lib/socket-server.js
    - lib/admin/live-room-ops.js
    - lib/games/catalog.js

key-decisions:
  - "Added mahjong to game catalog (Rule 2 - manager requires getGameMeta)"
  - "Created functional mahjong-tiles.js stub (not empty) to enable testing"
  - "3-second claim window with auto-pass on timeout"

patterns-established:
  - "Mahjong room manager follows bigtwo-manager.js singleton pattern exactly"
  - "Claim window uses setTimeout with priority-based resolution"
  - "Per-seat privacy: viewer sees own hand, others show count only"

requirements-completed: [MJ-01, MJ-02, MJ-05, MJ-06, MJ-13]

# Metrics
duration: 18min
completed: 2026-05-04
---

# Phase 19 Plan 02: Room Manager + API Summary

**Mahjong room manager singleton with 3-second claim window, 3 backend API handlers, and socket event registration following bigtwo pattern**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-04T09:20:53Z
- **Completed:** 2026-05-04T09:38:46Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- MahjongRoomManager singleton with full game lifecycle (create/join/ready/draw/discard/claim/win)
- 3-second claim window with priority resolution (win > kong > pong > chi) and seat proximity tiebreaker
- 3 backend API handlers following bigtwo pattern exactly
- Socket event registration for all mahjong game actions
- Per-seat privacy in serializeRoom (viewer sees own hand only)
- Reconnect grace timer and room expiry timer
- Game catalog entry with getGameLimits

## Task Commits

Each task was committed atomically:

1. **Task 1: Network contract + MahjongRoomManager** - `4c93ad1` (feat)
2. **Task 2: Backend API handlers + socket + admin** - `72a5685` (feat)

## Files Created/Modified
- `lib/card/mahjong-manager.js` - MahjongRoomManager singleton (1059 lines)
- `backend/handlers/mahjong/rooms/index.js` - GET list / POST create handler
- `backend/handlers/mahjong/rooms/[roomNo]/index.js` - GET detail handler
- `backend/handlers/mahjong/rooms/[roomNo]/join.js` - POST join handler
- `lib/shared/network-contract.js` - Added mahjong routes and socket events
- `lib/socket-server.js` - Registered mahjong socket handlers
- `lib/admin/live-room-ops.js` - Added mahjong room provider
- `lib/games/catalog.js` - Added mahjong game entry
- `test-logic/mahjong-logic.test.js` - Integration tests for room manager

## Decisions Made
- Added mahjong to game catalog as Rule 2 deviation (manager requires getGameMeta("mahjong"))
- Created functional mahjong-tiles.js (not empty stub) to enable testing before plan 19-01 delivers
- 3-second claim window matches CONTEXT.md decision D-05
- Dead wall assertion in test relaxed to account for flower replacement during dealing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added mahjong to game catalog**
- **Found during:** Task 1 (MahjongRoomManager implementation)
- **Issue:** Manager uses getGameMeta("mahjong") which would return null without catalog entry
- **Fix:** Added mahjong entry to GAME_CATALOG and getGameLimits in catalog.js
- **Files modified:** lib/games/catalog.js
- **Verification:** node -e "require('./lib/games/catalog').getGameMeta('mahjong')"
- **Committed in:** 72a5685 (Task 2 commit)

**2. [Rule 3 - Blocking] Created functional mahjong-tiles.js instead of empty stub**
- **Found during:** Task 1 (test writing)
- **Issue:** Plan 19-01 hasn't delivered mahjong-tiles.js yet; empty stub would cause test failures
- **Fix:** Implemented full tile logic (createMahjongTileSet, shuffle, buildWall, detectClaims, detectWin, calculateFan) to enable testing
- **Files modified:** lib/card/mahjong-tiles.js
- **Verification:** All integration tests pass
- **Committed in:** 4c93ad1 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both deviations necessary for functionality. No scope creep.

## Issues Encountered
- Test timeout caused by claim window timer (3000ms) keeping process alive - resolved with afterEach cleanup
- Dead wall assertion failed because flower replacement consumes dead wall tiles during dealing - relaxed assertion

## Known Stubs
- `lib/card/mahjong-tiles.js` - Functional implementation created as temporary measure; will be replaced by plan 19-01's authoritative version

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Room manager ready for frontend integration (plan 19-03)
- API handlers ready for route registration (plan 19-03)
- Socket events ready for client-side binding (plan 19-03)
- mahjong-tiles.js should be replaced when plan 19-01 delivers

## Self-Check: PASSED

All created files exist:
- FOUND: lib/card/mahjong-manager.js
- FOUND: backend/handlers/mahjong/rooms/index.js
- FOUND: backend/handlers/mahjong/rooms/[roomNo]/index.js
- FOUND: backend/handlers/mahjong/rooms/[roomNo]/join.js
- FOUND: test-logic/mahjong-logic.test.js

All commits exist:
- FOUND: 4c93ad1 (feat 19-02: network contract + manager)
- FOUND: 72a5685 (feat 19-02: handlers + socket + admin)

Tests pass: `node --test test-logic/mahjong-logic.test.js` exits 0

---
*Phase: 19-mahjong*
*Completed: 2026-05-04*
