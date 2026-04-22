---
phase: 07-session-recovery-presence
plan: 01
subsystem: api
tags: [recovery, presence, auth, rooms, socket.io, testing]
requires: []
provides:
  - shared recovery and presence helpers for room/session payloads
  - additive `/api/me` recovery metadata for users and scoped guests
  - aligned recovery field names across card, party, and board detail payloads
affects:
  - 07-02 reconnect grace state machine
  - 07-03 room-page recovery UI
  - session continuity tests
tech-stack:
  added: []
  patterns:
    - keep `connected` as the brownfield compatibility field while adding `presenceState`, `recoveryEligible`, and `reconnectGraceEndsAt`
    - define recovery payload rules once in `lib/shared/network-contract.js` and reuse them in auth plus room serializers
key-files:
  created:
    - .planning/phases/07-session-recovery-presence/07-01-SUMMARY.md
  modified:
    - lib/shared/network-contract.js
    - lib/auth.js
    - backend/handlers/me.js
    - backend/handlers/rooms/[roomNo]/index.js
    - lib/game/room-manager.js
    - lib/party/manager.js
    - lib/board/manager.js
    - test-logic/client-network-contract.test.js
    - test-logic/hub-room-entry.test.js
key-decisions:
  - "Recovery scope is exposed on session payloads from `/api/me`, while room payloads focus on authoritative seat presence fields."
  - "The shared helper already understands future reconnect grace timestamps so Plan 02 can add live `reconnecting` behavior without changing the public field names again."
  - "Guest recovery remains scoped by the existing auth/session model; no new endpoint or cookie was introduced."
patterns-established:
  - "Any room-family serializer that exposes seats should spread the shared recovery helper instead of hand-rolling presence fields."
  - "Session-facing recovery metadata should be derived from authenticated session kind rather than inferred in page code."
requirements-completed: [ROOM-01, ROOM-02]
duration: 21min
completed: 2026-04-22
---

# Phase 7 Plan 01 Summary

**Shared recovery helpers now define additive session and room presence metadata across `/api/me` plus all shipped room-detail payloads**

## Performance

- **Duration:** 21 min
- **Started:** 2026-04-22T19:28:00+08:00
- **Completed:** 2026-04-22T19:49:06+08:00
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added shared recovery helpers and constants so the backend now owns `presenceState`, `recoveryEligible`, `reconnectGraceEndsAt`, and session `recoveryScope`.
- Extended `/api/me` to expose recovery metadata for both real users and scoped guests without changing the cookie or auth flow.
- Aligned card, party, and board room serialization to the same additive presence vocabulary and locked it with Node tests.

## Task Commits

No task-level commits were created. Plan 07-01 was implemented as one working-tree batch and will be captured in a plan-level commit.

## Files Created/Modified

- `.planning/phases/07-session-recovery-presence/07-01-SUMMARY.md` - plan completion record and downstream context
- `lib/shared/network-contract.js` - shared presence states, recovery scopes, and serializer helpers
- `lib/auth.js` - session-to-client recovery serialization helper
- `backend/handlers/me.js` - `/api/me` now returns session recovery metadata
- `backend/handlers/rooms/[roomNo]/index.js` - card room detail uses session-aware viewer lookup
- `lib/game/room-manager.js` - Dou Dizhu seat serialization now includes additive recovery fields
- `lib/party/manager.js` - party seat and viewer serialization now includes additive recovery fields
- `lib/board/manager.js` - board seat and viewer serialization now includes additive recovery fields
- `test-logic/client-network-contract.test.js` - shared recovery contract tests
- `test-logic/hub-room-entry.test.js` - `/api/me` and cross-family detail-handler recovery contract tests

## Decisions Made

- Session payloads expose `recoveryScope`, but room occupant payloads stay focused on seat continuity and host-visible presence.
- `presenceState` currently maps from the shipped `connected` boolean in Plan 01; the bounded `reconnecting` runtime transition is deferred to Plan 02.
- Bots are explicitly non-recoverable in the shared contract even though they remain `connected` in serialized room state.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Plan 02 can add reconnect grace timers and seat restoration behavior without renaming payload fields again.
- Room pages can start consuming `presenceState` and `recoveryEligible` immediately once the runtime begins emitting live reconnect transitions.

---
*Phase: 07-session-recovery-presence*
*Completed: 2026-04-22*
