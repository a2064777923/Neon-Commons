---
phase: 10-release-verification-for-live-ops
plan: 01
subsystem: testing
tags: [playwright, admin, recovery, live-ops, socket.io]
requires:
  - phase: 09-single-node-recovery-guardrails
    provides: reconnect recovery, snapshot-only discovery, room expiry coverage
provides:
  - admin live-room directory, detail, and intervention API surface
  - stable recovery and live-ops data hooks on hub, entry, and admin pages
  - widened critical logic and UI suites for recovery and operator actions
affects: [verify-release, admin-console, room-entry, hub]
tech-stack:
  added: []
  patterns: [shared live-room-ops service, admin data-hook contract, release-critical room-ops test coverage]
key-files:
  created:
    - lib/admin/live-room-ops.js
    - backend/handlers/admin/live-rooms/index.js
    - backend/handlers/admin/live-rooms/[roomNo]/index.js
    - backend/handlers/admin/live-rooms/[roomNo]/actions.js
    - backend/handlers/admin/live-rooms/[roomNo]/occupants/[occupantId]/remove.js
    - test-logic/live-room-ops.test.js
  modified:
    - package.json
    - pages/admin/index.js
    - pages/index.js
    - pages/entry/[gameKey]/[roomNo].js
    - tests/admin-console.spec.js
    - tests/hub-entry.spec.js
key-decisions:
  - "Phase 10 was blocked by the missing Phase 8 room-ops surface, so the minimum truthful room-ops backend/UI was implemented inline before widening release verification."
  - "Room drain blocks new joins but still allows existing occupants to reconnect or exit naturally."
  - "Close returns a closed admin payload while removing the live room from manager state, so operators can verify the outcome without keeping a dead runtime around."
patterns-established:
  - "Admin room operations should flow through lib/admin/live-room-ops.js and dedicated backend handlers instead of ad hoc page logic."
  - "Release smoke targets recovery and room-ops states through stable data-* hooks, not decorative copy."
requirements-completed: [RELY-03]
duration: 45min
completed: 2026-04-22
---

# Phase 10 Plan 01 Summary

**Recovery-aware release coverage now includes a real admin live-room intervention surface, stable hub/entry/admin hooks, and widened critical logic/UI gates.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-04-22T22:52:00+08:00
- **Completed:** 2026-04-22T23:36:57+08:00
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- Added an admin live-room directory/detail/action surface backed by dedicated `/api/admin/live-rooms*` handlers and a shared `lib/admin/live-room-ops.js` service.
- Added stable `data-*` hooks for hub live-feed cards, room-entry recovery states, and admin room-ops controls so Playwright can assert live-ops behavior without brittle copy matching.
- Widened `test:logic:critical` to cover session recovery, room-directory persistence, room expiry, and the new live-room-ops backend path.

## Files Created/Modified

- `lib/admin/live-room-ops.js` - Shared live-room listing, detail serialization, drain/close/remove-occupant actions.
- `backend/handlers/admin/live-rooms/*` - Admin list/detail/action endpoints for live room operations.
- `pages/admin/index.js` - Live room directory, detail panel, confirm flows, and data hooks.
- `pages/index.js` - `data-live-feed-room` and `data-room-availability` hooks on live-feed cards.
- `pages/entry/[gameKey]/[roomNo].js` - Recovery-aware entry hooks for availability, actions, and notices.
- `tests/admin-console.spec.js` - Real inspect/remove/drain/close smoke on the canonical admin page.
- `tests/hub-entry.spec.js` - Snapshot-only recovery hook assertions for hub and entry.
- `test-logic/live-room-ops.test.js` - Backend room-ops contract coverage.

## Decisions Made

- The roadmap ordering was temporarily compressed: the missing live-room-ops capability was implemented inside Phase 10 execution because release verification could not honestly cover operator interventions otherwise.
- Snapshot-only rooms are visible in the admin directory for inspection, but destructive actions stay limited to live runtime rooms.
- Remove-occupant actions are limited to waiting rooms to avoid corrupting in-progress gameplay state across families.

## Deviations from Plan

- Implemented the minimal Phase 8 room-ops backend/UI surface inline before the planned Phase 10 verification work. This was necessary to satisfy the actual `RELY-03` operator-intervention requirement truthfully.

## Issues Encountered

- Playwright room-ops smoke initially hit the per-user open-room limit and a connected-guest removal timing edge. The test now raises `maxOpenRoomsPerUser` temporarily and closes the guest browser context after joining so the admin remove flow targets a recovery-state occupant deterministically.

## User Setup Required

None.

## Verification

- `npm run check`
- `npm run test:logic:critical`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/hub-entry.spec.js tests/admin-console.spec.js --workers=1`
- `npm run deploy:3100`

## Next Phase Readiness

- The repo now has the real room-ops and recovery surface that Phase 10-02 can describe in release helper commands and `verify:release` stage output.
- `.planning/STATE.md` still has pre-existing drift and was intentionally left out of this plan commit.
