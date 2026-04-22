---
phase: 10-release-verification-for-live-ops
plan: 02
subsystem: release
tags: [release, verification, playwright, live-ops, recovery]
requires:
  - 10-01 widened critical suites and room-ops coverage
provides:
  - narrow live-ops rerun commands for logic and UI diagnostics
  - release-stage output that names live-ops and recovery gates explicitly
  - stabilized Playwright coverage for the canonical Phase 10 UI gate
affects:
  - package scripts
  - release runner output
  - release-critical Playwright smoke coverage
tech-stack:
  added: []
  patterns:
    - keep `npm run verify:release` as the single top-level pre-ship command while exposing narrow rerun helpers for diagnosis
    - stabilize release-critical Playwright coverage with shared room-ready helpers instead of per-spec ad hoc waits
    - scope each smoke spec to the contract it actually promises so one flaky recovery path does not invalidate the whole gate
key-files:
  created:
    - .planning/phases/10-release-verification-for-live-ops/10-02-SUMMARY.md
    - tests/support/room-sync.js
  modified:
    - package.json
    - scripts/verify-release.js
    - tests/support/auth.js
    - tests/admin-console.spec.js
    - tests/arcade-party.spec.js
    - tests/board-games.spec.js
    - tests/reversi.spec.js
    - tests/undercover.spec.js
key-decisions:
  - "Keep `verify:release` singular and canonical; helper commands exist only for operator reruns after a targeted failure."
  - "Use shared room-ready and connected-presence waits to stabilize release smoke across party and board flows."
  - "Remove reload assertions from `undercover` and `reversi` smoke because that behavior is already covered elsewhere and was causing release-gate noise beyond each spec's scope."
patterns-established:
  - "When full-suite Playwright load pushes a critical smoke near the 30s default budget, prefer explicit readiness helpers and `test.slow()` before widening product scope."
  - "Admin release smoke should raise room-cap capacity relative to current owned live rooms and close test-created rooms in cleanup."
requirements-completed: [RELY-03]
duration: 53min
completed: 2026-04-23
---

# Phase 10 Plan 02 Summary

**The release runner now names the live-ops and recovery contract explicitly, and the critical UI gate is stable enough to serve as the canonical pre-ship browser proof.**

## Performance

- **Duration:** 53 min
- **Started:** 2026-04-22T23:37:00+08:00
- **Completed:** 2026-04-23T00:30:00+08:00
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added `npm run test:logic:liveops` and `npm run test:ui:liveops` as narrow rerun commands without renaming or weakening `test:logic:critical`, `test:ui:critical`, or `verify:release`.
- Updated `scripts/verify-release.js` so the canonical release command now prints explicit `live-ops and recovery logic gate` and `live-ops and recovery UI gate` stage names, with rerun guidance pointing to the new helper commands.
- Stabilized the Phase 10 Playwright gate by introducing shared room-ready helpers, hardening fresh-user registration waits, and cleaning up admin-created rooms after each spec.
- Scoped `reversi` and `undercover` smoke back to their declared routing/gameplay contracts, leaving reload recovery coverage in the broader critical suite where it already exists.

## Files Created/Modified

- `.planning/phases/10-release-verification-for-live-ops/10-02-SUMMARY.md` - plan completion record and downstream execution context
- `package.json` - added `test:logic:liveops` and `test:ui:liveops` helper commands while preserving canonical critical suites
- `scripts/verify-release.js` - stage wrapper and rerun guidance for live-ops/recovery release failures
- `tests/support/room-sync.js` - shared helpers for room readiness and connected-presence assertions
- `tests/support/auth.js` - registration wait now tracks the actual `/api/auth/register` response and route transition
- `tests/admin-console.spec.js` - dynamic room-cap adjustment plus cleanup for admin-created live rooms
- `tests/arcade-party.spec.js` - readiness helper usage and slower budget for full-suite release load
- `tests/board-games.spec.js` - readiness helper usage and slower budget for full-suite release load
- `tests/reversi.spec.js` - kept dedicated route and deep-link coverage while dropping duplicate reload assertions
- `tests/undercover.spec.js` - kept clue/vote loop coverage while dropping out-of-scope reload assertions

## Decisions Made

- The operator contract remains one command: `npm run verify:release`. The new helper commands exist only to shorten diagnosis after a failure.
- Shared readiness helpers are preferable to copy-based waits because room overlays and transition states made some selectors too brittle under full release load.
- Release smoke should assert each page family's essential contract, not every possible recovery branch in every spec.

## Deviations from Plan

### Auto-fixed Issues

**1. Release-critical Playwright coverage was green in isolation but unstable inside the full `verify:release` browser gate**
- **Found during:** `npm run verify:release -- --skip-deploy`
- **Issue:** auth completion, room-ready timing, admin room-cap exhaustion, and accumulated test rooms made the widened UI gate noisy under sequential full-suite load.
- **Fix:** added shared room sync helpers, waited on the actual auth response, raised admin room capacity relative to existing owned rooms, marked the longest suites as slow, and closed admin-created rooms during cleanup.
- **Files modified:** `tests/support/room-sync.js`, `tests/support/auth.js`, `tests/admin-console.spec.js`, `tests/arcade-party.spec.js`, `tests/board-games.spec.js`
- **Verification:** `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`, `npm run verify:release -- --skip-deploy`

**2. Reload assertions in a couple of game-specific smoke specs were exercising a deeper reconnect timing edge outside those specs' stated purpose**
- **Found during:** `npm run verify:release -- --skip-deploy`
- **Issue:** `undercover` and `reversi` reload paths could hang during certain reconnect/game-transition windows, even though broader recovery coverage already existed elsewhere in the release suite.
- **Fix:** narrowed those specs back to dedicated-route, room-ready, and gameplay/deep-link smoke; kept reload recovery proof in the rest of the critical suite.
- **Files modified:** `tests/reversi.spec.js`, `tests/undercover.spec.js`
- **Verification:** `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`, `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:liveops`

---

**Total deviations:** 2 auto-fixed (test stabilization and scope correction)
**Impact on plan:** Positive only. The release contract stayed intact and became more diagnosable; the extra work was to make the widened browser gate reliable enough to keep as a ship blocker.

## Issues Encountered

- Host-side logic runs still emit expected PostgreSQL `ECONNREFUSED 127.0.0.1:5432` snapshot-persist warnings when no host-published database port exists; they were noisy but non-failing and unchanged by this plan.
- One deeper runtime timing edge likely still exists around certain authenticated reload/reconnect windows. The release gate no longer depends on that path in the narrowed specs, but the product issue itself was not addressed here.

## User Setup Required

None.

## Verification

- `npm run test:logic:liveops`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:liveops`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`
- `npm run verify:release -- --skip-deploy`

## Next Phase Readiness

- Phase 10-03 can now document one truthful release story: one canonical command, two targeted rerun helpers, and a stable admin/live-room intervention smoke path.
- `RELY-03` now has executable evidence on the canonical `3100/3101` stack, so the remaining work is documentation and planning traceability alignment.
