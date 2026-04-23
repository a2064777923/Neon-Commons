---
phase: 11-availability-signals-degraded-modes
plan: 03
subsystem: testing
tags: [availability, degraded-mode, release-verification, playwright, liveops]
requires:
  - phase: 11-availability-signals-degraded-modes
    plan: 01
    provides: degraded availability control contract and additive room payload envelope
  - phase: 11-availability-signals-degraded-modes
    plan: 02
    provides: admin/runtime UI, hub-entry messaging, and party-room degraded-state rendering
provides:
  - truthful live-ops helper commands that include degraded-mode coverage
  - repeatable browser smoke cleanup and session setup for sequential reruns on 3100/3101
  - skip-deploy release verification proven against the widened degraded-mode surface
affects: [release-reruns, liveops-diagnostics, browser-smoke, room-cleanup]
tech-stack:
  added: []
  patterns:
    - browser smoke suites clean up live rooms they create so repeated reruns stay stable
    - protected/operator test helpers prefer backend session setup over UI auth when auth UI is not the target
    - room readiness helpers should assert visible room tags without depending on one DOM wrapper
key-files:
  created: []
  modified:
    - package.json
    - tests/admin-console.spec.js
    - tests/arcade-party.spec.js
    - tests/board-games.spec.js
    - tests/reversi.spec.js
    - tests/support/admin-backend.js
    - tests/support/room-sync.js
key-decisions:
  - "Keep `test:logic:critical`, `test:ui:critical`, and `verify:release` unchanged as the canonical release boundary; only widen the helper rerun paths."
  - "Treat repeated deployed-stack reruns as a real contract: Playwright smokes must clean up rooms and avoid fragile page-only auth/setup steps when auth UI is not under test."
  - "Stabilize admin/runtime helper calls with lighter-weight retries and readiness checks instead of weakening degraded-state assertions."
patterns-established:
  - "Long serial browser gates can stay deterministic when suites close the live rooms they open and reset shared runtime state explicitly."
  - "Use backend-backed session helpers for room/game smoke tests so release reruns do not depend on the registration page responding first."
requirements-completed: [AVAIL-01, AVAIL-03]
duration: 2h45min
completed: 2026-04-23
---

# Phase 11 Plan 03 Summary

**Degraded-mode coverage is now part of the live-ops rerun path, and the deployed `3100/3101` release gate stays green even when browser suites are rerun back-to-back.**

## Performance

- **Duration:** 2h45min
- **Started:** 2026-04-23T07:08:29+08:00
- **Completed:** 2026-04-23T09:53:05+08:00
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Expanded `test:logic:liveops` to include degraded-mode control-plane coverage and expanded `test:ui:liveops` to include party-room degraded voice coverage.
- Stabilized repeated deployed-stack browser reruns by adding admin helper retries/readiness checks, cleaning up live rooms created by party/board/reversi smokes, and switching non-auth-focused board smoke setup to backend session helpers.
- Proved the widened degraded-mode surface on the canonical stack with `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:liveops` and `npm run verify:release -- --skip-deploy`.

## Files Created/Modified

- `package.json` - Promoted degraded-mode coverage into the live-ops helper commands without changing the canonical critical/release commands.
- `tests/admin-console.spec.js` - Added admin dashboard readiness handling and serialized runtime-capacity probing so repeated reruns stay stable.
- `tests/arcade-party.spec.js` - Reused configured room-creation flows, reset party voice state predictably, and closed created live rooms after smoke runs.
- `tests/board-games.spec.js` - Switched to backend session setup and closed created board rooms so the critical suite no longer poisons later reruns.
- `tests/reversi.spec.js` - Switched to backend session setup and closed created Reversi rooms after deep-link smoke coverage.
- `tests/support/admin-backend.js` - Added bounded retry/connection handling for direct admin backend helpers used by Playwright.
- `tests/support/room-sync.js` - Made room-tag readiness checks assert visible room numbers without assuming one specific DOM container.

## Decisions Made

- Kept the shipped release contract unchanged and treated helper commands as truthful narrower rerun paths, not alternative release gates.
- Fixed rerun stability in the tests/helpers instead of weakening assertions or skipping real-room coverage.
- Accepted the existing `ECONNREFUSED 127.0.0.1:5432` snapshot-persist warning in node tests as known non-blocking noise while the suites still exit 0.

## Deviations from Plan

- Added additional browser-smoke cleanup and session-stabilization work in board/reversi suites because `verify:release -- --skip-deploy` exposed repeated-run flake outside the initial Phase 11 browser subset.
- Tightened the shared room-sync helper after the deployed Reversi deep-link smoke showed that room tags were visible but not always wrapped in a literal `<header>` element.

## Issues Encountered

- The initial `test:ui:liveops && verify:release -- --skip-deploy` attempts exposed cross-suite contamination: some smokes left live rooms behind, some helpers assumed page-level registration or a fixed DOM wrapper, and admin helper calls were too brittle for repeated deployed-stack runs.
- Party-room smoke initially reused a helper that navigated back to the game page and wiped custom role-pack selections; the helper was adjusted so configured room creation stays bound to the current page state.

## User Setup Required

None.

## Verification

- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:logic:liveops && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/hub-entry.spec.js tests/admin-console.spec.js tests/arcade-party.spec.js --workers=1`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:liveops`
- `npm run verify:release -- --skip-deploy`

## Next Phase Readiness

- Phase 11 is now release-proven on the canonical deployed stack, not just the narrow degraded-mode subset.
- Future milestone work can reuse the stricter rerun contract: deploy to `3100/3101`, run the narrowed live-ops helpers for diagnosis, and trust `verify:release -- --skip-deploy` as a stable confirmation step.
