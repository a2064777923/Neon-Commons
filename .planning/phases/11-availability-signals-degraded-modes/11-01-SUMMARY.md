---
phase: 11-availability-signals-degraded-modes
plan: 01
subsystem: api
tags: [availability, degraded-mode, runtime-controls, room-entry, hub]
requires:
  - phase: 09-single-node-recovery-guardrails
    provides: snapshot-only room availability and recovery-aware room payloads
  - phase: 10-release-verification-for-live-ops
    provides: live-ops runtime/admin baselines and contract coverage
provides:
  - shared availability and degraded-mode enums plus safe-action helpers
  - additive availabilityControls on /api/admin/runtime with audit-safe normalization
  - additive degradedState envelopes on hub, room-entry, and room detail payloads
affects: [admin-runtime, hub, room-entry, room-detail, degraded-mode-ui]
tech-stack:
  added: []
  patterns: [shared availability contract, additive degradedState envelopes, backend-owned degraded-mode normalization]
key-files:
  created:
    - lib/shared/availability.js
  modified:
    - lib/admin/control-plane.js
    - backend/handlers/admin/runtime/index.js
    - backend/handlers/hub.js
    - backend/handlers/room-entry/resolve.js
    - backend/handlers/rooms/[roomNo]/index.js
    - backend/handlers/party/rooms/[roomNo]/index.js
    - backend/handlers/board/rooms/[roomNo]/index.js
    - backend/handlers/room-entry/guest.js
    - lib/client/room-entry.js
    - test-logic/admin-control-plane.test.js
    - test-logic/backend-contract.test.js
    - test-logic/hub-room-entry.test.js
key-decisions:
  - "Keep shipped room availability values separate from subsystem degraded-mode state."
  - "Expose degraded mode through the existing /api/admin/runtime surface instead of adding a parallel endpoint."
  - "Keep guest snapshot-only error payload unchanged even after room-detail degradedState became additive."
patterns-established:
  - "Backend payloads keep top-level availability truth and add a shared degradedState envelope."
  - "Availability control validation and serialization flow through lib/shared/availability.js."
requirements-completed: [AVAIL-01, AVAIL-03]
duration: 34min
completed: 2026-04-23
---

# Phase 11 Plan 01 Summary

**Shared degraded-mode enums, admin runtime controls, and additive hub / room-entry / room-detail payload envelopes now describe availability without overloading room state.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-04-23T06:58:00+08:00
- **Completed:** 2026-04-23T07:32:00+08:00
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments

- Added `lib/shared/availability.js` as the canonical source for room availability, degraded subsystem states, safe actions, and envelope serialization.
- Extended `/api/admin/runtime` and `lib/admin/control-plane.js` so degraded-mode controls round-trip through the existing runtime surface with normalized defaults and audit-safe updates.
- Added one shared `degradedState` envelope across hub cards, room-entry resolve payloads, and card / party / board room detail flows while preserving existing top-level `availability` semantics.

## Files Created/Modified

- `lib/shared/availability.js` - Shared enums, defaults, normalization, safe-action labels, and degraded-state envelope builders.
- `lib/admin/control-plane.js` - Availability control persistence, normalization, and runtime update helpers.
- `backend/handlers/admin/runtime/index.js` - Additive runtime GET/PATCH contract for degraded-mode controls.
- `backend/handlers/hub.js` - Shared degraded-state envelope on live feed and featured room payloads.
- `backend/handlers/room-entry/resolve.js` - Shared degraded-state envelope on resolved entry and snapshot-only payloads.
- `backend/handlers/rooms/[roomNo]/index.js` - Card room detail degraded-state coverage on `200` and recovery `409`.
- `backend/handlers/party/rooms/[roomNo]/index.js` - Party room detail degraded-state coverage on `200` and recovery `409`.
- `backend/handlers/board/rooms/[roomNo]/index.js` - Board room detail degraded-state coverage on `200` and recovery `409`.
- `backend/handlers/room-entry/guest.js` - Preserve the shipped guest snapshot-only error contract instead of leaking the new room-detail envelope.
- `lib/client/room-entry.js` - Thin selectors for degraded-state and safe-action labels.
- `test-logic/admin-control-plane.test.js` - Runtime and availability control normalization / audit coverage.
- `test-logic/backend-contract.test.js` - Runtime contract coverage for the additive degraded-mode surface.
- `test-logic/hub-room-entry.test.js` - Hub, room-entry, room-detail, and snapshot-only payload contract coverage.

## Decisions Made

- Kept `live`, `snapshot-only`, `draining`, and `closed` as room-truth states and introduced degraded subsystem state as a separate additive layer.
- Reused `/api/admin/runtime` as the only operator-facing transport for degraded controls so later UI work does not invent another backend family.
- Treated the guest snapshot-only response as an existing compatibility contract and explicitly excluded it from the new additive room-detail envelope.

## Deviations from Plan

- Fixed an unplanned regression where `room-entry/guest` inherited `degradedState` through the shared snapshot helper. The guest error payload was restored to its prior shape so only the plan-targeted hub, resolve, and room-detail surfaces changed.

## Issues Encountered

- Strict degraded-control normalization originally validated a whole control tree for single-rule updates and rejected partial family updates. Validation was narrowed to a single rule path so scoped updates can pass safely.
- Several logic tests started touching the real PostgreSQL client because the new handlers now read availability controls. The tests were updated to inject the shared control-plane contract explicitly, keeping them deterministic.
- Some room-directory tests still emit non-failing snapshot persistence warnings when local PostgreSQL is absent; assertions remain green.

## User Setup Required

None.

## Verification

- `node --test test-logic/admin-control-plane.test.js`
- `node --test test-logic/hub-room-entry.test.js test-logic/backend-contract.test.js`
- `npm run check`

## Next Phase Readiness

- Phase 11-02 can now build admin editing UI, scoped degraded-mode messaging, and player-facing gating on top of one stable backend-owned contract.
- No blocking data-model or route-contract gaps remain from 11-01.
