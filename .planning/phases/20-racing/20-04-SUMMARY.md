---
phase: 20-racing
plan: 04
subsystem: integration
tags: [racing, hub, admin, catalog, game-icon, light-3d]

# Dependency graph
requires:
  - phase: 20-racing
    plan: 01
    provides: racing catalog entry, network contract, test scaffold
  - phase: 20-racing
    plan: 02
    provides: RacingRoomManager singleton, physics engine, API handlers, socket registration
  - phase: 20-racing
    plan: 03
    provides: racing frontend pages
provides:
  - Racing GameIcon SVG for hub display
  - Racing integrated into admin live-rooms management
  - Racing catalog entry finalized with all required fields
  - Racing in ROLLOUT_MANAGED_GAME_KEYS for rollout control
  - 26 passing racing logic tests
affects: [20-racing, light-3d family, hub, admin]

# Tech tracking
tech-stack:
  added: []
  patterns: [admin room provider pattern, game icon SVG pattern]

key-files:
  created:
    - test-logic/racing-logic.test.js
    - backend/handlers/racing/rooms/index.js
    - backend/handlers/racing/rooms/[roomNo]/index.js
    - backend/handlers/racing/rooms/[roomNo]/join.js
    - lib/racing/physics.js
    - lib/racing/track.js
    - lib/racing/delta.js
    - lib/racing/manager.js
  modified:
    - components/game-hub/GameIcon.js
    - lib/games/catalog.js
    - lib/admin/live-room-ops.js
    - lib/shared/network-contract.js
    - lib/socket-server.js
    - package.json
    - package-lock.json

key-decisions:
  - "Racing uses light-3d family key and capabilityManaged: true for rollout control"
  - "Racing launchState is coming-soon for staged rollout per PLAT-05"
  - "Admin room management uses getRoomProviders() pattern in live-room-ops.js, not control-plane.js"
  - "Racing is in ROLLOUT_MANAGED_GAME_KEYS but not CONTROLLED_GAME_KEYS (correct: CONTROLLED is for shipped games only)"

patterns-established:
  - "Light-3d family admin room provider pattern in live-room-ops.js"
  - "Racing GameIcon SVG with dark blue background, gold track, red car, checkered flag"

requirements-completed: [RACE-01, RACE-02, PLAT-01, PLAT-02, PLAT-04]

# Metrics
duration: 15min
completed: 2026-05-05
---

# Phase 20 Plan 04: Racing Integration Summary

**Racing fully integrated into hub (GameIcon), admin control plane (room management), and catalog with all required fields**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-05T05:20:41Z
- **Completed:** 2026-05-05T05:35:00Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Added racing GameIcon SVG to hub with top-down car on oval track, speed lines, and checkered flag
- Integrated racing into admin live-rooms management (list, drain, close, remove occupant)
- Finalized racing catalog entry with all required fields (key, familyKey, launchState, capabilityManaged, hubOrder, etc.)
- Racing appears in ROLLOUT_MANAGED_GAME_KEYS for admin rollout control
- Created comprehensive racing-logic.test.js with 26 passing tests covering catalog, network contract, track, physics, delta, race order, and lap detection
- Synced all 20-01 and 20-02 dependencies (lib/racing/*, cannon-es, three, backend handlers, socket events)

## Task Commits

Each task was committed atomically:

1. **Dependency sync (Rule 3)** - `1eefbbb` (chore)
2. **Task 1: Create racing GameIcon SVG** - `53ea8b0` (feat)
3. **Task 2: Register racing in admin control plane** - `a89355e` (feat)

## Files Created/Modified

### Created (from 20-02 dependency sync)
- `lib/racing/physics.js` - cannon-es World setup, car body factory, track body factory, lap trigger detector
- `lib/racing/track.js` - Oval track definition with wall positions, spawn points, start/finish line
- `lib/racing/delta.js` - Delta-state computation with changed-car filtering and race order sorting
- `lib/racing/manager.js` - RacingRoomManager singleton with 20Hz game loop, room lifecycle, reconnection
- `backend/handlers/racing/rooms/index.js` - GET (list) and POST (create) for racing rooms
- `backend/handlers/racing/rooms/[roomNo]/index.js` - GET (detail) for racing rooms
- `backend/handlers/racing/rooms/[roomNo]/join.js` - POST (join) for racing rooms
- `test-logic/racing-logic.test.js` - 26 tests for physics, delta, lap, catalog, contract

### Modified
- `components/game-hub/GameIcon.js` - Added racing SVG icon (top-down car on oval track with speed lines and checkered flag)
- `lib/games/catalog.js` - Replaced miniracers with racing entry, added getRacingDefaultConfig, added getGameLimits for racing
- `lib/admin/live-room-ops.js` - Added racing room provider to getRoomProviders() for admin room management
- `lib/shared/network-contract.js` - Added racing API routes and socket events
- `lib/socket-server.js` - Registered racing socket handlers (subscribe, ready, input, chat)
- `package.json` - Added cannon-es@0.20.0 and three@0.184.0 dependencies

## Decisions Made

- Racing uses `light-3d` family key and `capabilityManaged: true` for rollout control
- Racing `launchState` is `coming-soon` for staged rollout per PLAT-05
- Admin room management uses `getRoomProviders()` pattern in `live-room-ops.js`, not `control-plane.js`
- Racing is in `ROLLOUT_MANAGED_GAME_KEYS` but not `CONTROLLED_GAME_KEYS` (correct: CONTROLLED is for shipped games only)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree missing 20-01 and 20-02 dependencies**
- **Found during:** Task 1 startup
- **Issue:** Worktree was based on pre-20-racing commit, missing all racing infrastructure (lib/racing/*, catalog entry, network contract, socket handlers, backend handlers, npm packages)
- **Fix:** Synced all dependencies from main repo: created lib/racing/ directory with 4 modules, updated catalog.js with racing entry, updated network-contract.js with racing routes/events, registered racing socket handlers, created backend API handlers, installed cannon-es and three packages
- **Files modified:** lib/racing/physics.js, lib/racing/track.js, lib/racing/delta.js, lib/racing/manager.js, lib/games/catalog.js, lib/shared/network-contract.js, lib/socket-server.js, package.json, package-lock.json, backend/handlers/racing/rooms/index.js, backend/handlers/racing/rooms/[roomNo]/index.js, backend/handlers/racing/rooms/[roomNo]/join.js
- **Committed in:** 1eefbbb (Task dependency sync commit)

**2. [Rule 3 - Blocking] Plan referenced wrong file for admin integration**
- **Found during:** Task 2 planning
- **Issue:** Plan said to modify `lib/admin/control-plane.js` for room management, but actual room management is in `lib/admin/live-room-ops.js`
- **Fix:** Modified `lib/admin/live-room-ops.js` instead, adding racing provider to `getRoomProviders()` function
- **Files modified:** lib/admin/live-room-ops.js
- **Committed in:** a89355e (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both blocking dependency/config issues)
**Impact on plan:** Both fixes were necessary for correctness. No scope creep.

## Issues Encountered

- None beyond the dependency sync deviations

## User Setup Required

None - no external service configuration required.

## Known Stubs

- Racing chat handler is a placeholder (no chat implementation yet) - inherited from 20-02
- No bot/AI support for racing rooms (only human players) - inherited from 20-02

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| T-20-09 | lib/admin/live-room-ops.js | Admin can drain/close/remove racing rooms; follows existing auth pattern |

## Next Phase Readiness

- Racing is fully integrated as a first-class game in the platform
- Hub displays racing icon in the light-3d family section
- Admin can manage racing rooms via live-rooms management
- Racing rollout can be controlled via admin rollout controls
- All 26 racing logic tests pass
- Ready for frontend integration (Plan 20-03) and staged launch

## Self-Check: PASSED

- All created files verified on disk (14/14)
- All task commits verified in git log (1eefbbb, 53ea8b0, a89355e)
- All 26 racing logic tests pass

---

*Phase: 20-racing*
*Completed: 2026-05-05*
