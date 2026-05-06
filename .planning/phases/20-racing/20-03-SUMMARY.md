---
phase: 20-racing
plan: 03
subsystem: frontend
tags: [three.js, webgl, racing, client-prediction, interpolation, playwright]

# Dependency graph
requires:
  - phase: 20-racing
    plan: 02
    provides: RacingRoomManager singleton, cannon-es physics, delta-state broadcasting, API routes, socket events
provides:
  - Racing room page with Three.js 3D scene (WebGLRenderer, ssr: false)
  - Track and car rendering with geometric models
  - Third-person chase camera with smooth lerp follow
  - Keyboard and touch input handling at 20Hz
  - Client-side prediction with local input application
  - Server state interpolation between ticks
  - HUD with lap counter, speed, position, countdown
  - Touch controls with virtual joystick for mobile
  - Playwright integration tests for racing entry
affects: [20-racing, light-3d family]

# Tech tracking
tech-stack:
  added: []
  patterns: [Three.js WebGLRenderer with Next.js dynamic import (ssr: false), client-side prediction with reconciliation, server state interpolation via lerp]

key-files:
  created:
    - pages/racing/[roomNo].js
    - components/racing/RacingScene.js
    - components/racing/CarModel.js
    - components/racing/TrackModel.js
    - components/racing/HUD.js
    - components/racing/TouchControls.js
    - styles/RacingRoom.module.css
    - tests/racing-entry.spec.js
  modified: []

key-decisions:
  - "Used Next.js dynamic import with ssr: false for Three.js to avoid SSR crash (Pitfall 1 from research)"
  - "Client-side prediction applies inputs locally with simplified physics, snaps to server when diverged > 2 units"
  - "Interpolation lerps between previous and current server states over 50ms tick period"
  - "Touch controls render only on touch devices (ontouchstart detection)"
  - "Car colors: red, blue, green, yellow per seat index (0-3)"
  - "Chase camera: 12 units behind, 8 units above, with 0.08 lerp factor for smooth follow"

patterns-established:
  - "Racing room page pattern: dynamic import RacingScene, socket subscribe, keyboard/touch input, HUD overlay"
  - "Client-side prediction pattern: local input application with server reconciliation snap threshold"
  - "Server state interpolation pattern: store prev/curr server states, lerp by elapsed time fraction"

requirements-completed: [RACE-03, RACE-05]

# Metrics
duration: 9min
completed: 2026-05-05
---

# Phase 20 Plan 03: Racing Frontend Summary

**Three.js 3D racing scene with track/car rendering, keyboard/touch input, client-side prediction, server interpolation, HUD, and Playwright tests**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-05T08:46:21Z
- **Completed:** 2026-05-05T08:55:23Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Built complete racing room page with Three.js WebGLRenderer, SSR-safe dynamic import
- Created 3D scene with track (ground, walls, start/finish line, lane markings) and car models (box body + cylinder wheels)
- Implemented third-person chase camera with smooth lerp follow behind player's car
- Added keyboard arrow key input at 20Hz throttle and mobile touch controls with virtual joystick
- Implemented client-side prediction (local input application) with server state reconciliation
- Added server state interpolation (lerp between previous and current ticks) for smooth rendering
- HUD displays lap count, speed, position, and countdown; race result overlay shows winner
- Playwright tests verify page load, 3D canvas, HUD elements, and ready button

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Three.js scene with track and car rendering** - `6dd8009` (feat)
2. **Task 2: Add HUD, touch controls, client-side prediction, and interpolation** - `93554a4` (feat)
3. **Task 3: Create Playwright integration test for racing entry** - `c9d4893` (test)

**Dependency sync:** `ce30dd7` (chore: sync 20-01/20-02 dependencies)

## Files Created/Modified
- `pages/racing/[roomNo].js` - Racing room page with socket connection, keyboard/touch input, prediction, interpolation, HUD, overlays
- `components/racing/RacingScene.js` - Three.js scene setup (WebGLRenderer, camera, lights), car position updates, chase camera follow
- `components/racing/CarModel.js` - Simple geometric car model (box body + cabin + cylinder wheels) with per-seat colors
- `components/racing/TrackModel.js` - Track surface, walls, start/finish line, lane markings from TRACK_DEFINITION
- `components/racing/HUD.js` - Lap counter, speed, position indicator, countdown display
- `components/racing/TouchControls.js` - Mobile virtual joystick and accel/brake buttons (touch devices only)
- `styles/RacingRoom.module.css` - Racing room styles: gameShell, canvas, hud, badges, touch controls, overlays
- `tests/racing-entry.spec.js` - Playwright tests for page load, canvas, HUD, ready button

## Decisions Made
- Used Next.js dynamic import with `ssr: false` for Three.js to prevent SSR crash (research Pitfall 1)
- Client-side prediction uses simplified physics (forward movement + rotation), snaps to server when diverged > 2 units
- Interpolation lerps between previous and current server states over 50ms tick period for smooth rendering
- Touch controls only render on touch devices to avoid unnecessary DOM on desktop
- Car colors follow seat index: red(0), blue(1), green(2), yellow(3)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Synced 20-01/20-02 dependencies from main**
- **Found during:** Task 1 start
- **Issue:** Worktree branch did not have lib/racing/*, catalog.js, network-contract.js, socket-server.js from 20-01/20-02
- **Fix:** Checked out dependency files from main branch and committed as dependency sync
- **Files modified:** lib/racing/delta.js, lib/racing/manager.js, lib/racing/physics.js, lib/racing/track.js, lib/games/catalog.js, lib/shared/network-contract.js, lib/socket-server.js, test-logic/racing-logic.test.js, package.json, package-lock.json
- **Verification:** Files present and imports resolve
- **Committed in:** ce30dd7 (dependency sync commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Dependency sync was necessary for the frontend to reference backend modules. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Racing frontend complete, ready for 20-04 integration plan
- Three.js scene renders track and cars with keyboard/touch input
- Client-side prediction and interpolation provide smooth gameplay experience

---
*Phase: 20-racing*
*Completed: 2026-05-05*

## Self-Check: PASSED

All 8 created files verified present. All 4 commit hashes verified in git log.
