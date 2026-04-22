---
phase: 07-session-recovery-presence
plan: 02
subsystem: api
tags: [recovery, presence, socket.io, rooms, ddz, testing]
requires:
  - phase: 07-01
    provides: shared recovery field names and serializer helpers
provides:
  - bounded reconnect grace handling across card, party, and board room managers
  - manager-level recovery tests plus socket reconnect coverage
  - Dou Dizhu trustee compatibility with reconnect-aware presence
affects:
  - 07-03 room-page recovery UI
  - room disconnect lifecycle
  - host-visible presence transitions
tech-stack:
  added: []
  patterns:
    - treat the last active socket drop as `reconnecting` first and only clear to `disconnected` when the grace timer expires
    - clear reconnect timers on seat restoration and completed-room teardown to avoid stale transitions
key-files:
  created:
    - .planning/phases/07-session-recovery-presence/07-02-SUMMARY.md
    - test-logic/session-recovery.test.js
  modified:
    - lib/game/room-manager.js
    - lib/party/manager.js
    - lib/board/manager.js
    - test-logic/hub-room-entry.test.js
    - test-logic/ddz-logic.test.js
key-decisions:
  - "Reconnect grace is manager-owned state keyed by `roomNo:userId`, not a socket-local heuristic."
  - "Completed-room cleanup now waits for reconnecting humans to expire before archiving the room."
  - "Dou Dizhu disconnects still enter trustee immediately; reconnect awareness is additive rather than a gameplay rewrite."
patterns-established:
  - "Reconnect-capable managers should expose `reconnectGraceEndsAt` from seat state and clear timers whenever a seat is restored or the room closes."
  - "Socket lifecycle regressions are covered with one focused manager suite plus one real socket-scope reconnect test."
requirements-completed: [ROOM-01, ROOM-02, ROOM-03]
duration: 6min
completed: 2026-04-22
---

# Phase 7 Plan 02 Summary

**Human seats now move through a bounded reconnect grace window across card, party, and board rooms while Dou Dizhu trustee behavior stays intact**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-22T19:50:00+08:00
- **Completed:** 2026-04-22T19:55:29+08:00
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added reconnect grace timers to all shipped room managers so the last human socket drop becomes `reconnecting` before eventually settling to `disconnected`.
- Ensured reconnecting with the same valid seat clears grace state and reuses the existing player record and room-directory membership.
- Locked the new runtime behavior with focused session-recovery tests, guest socket reconnect coverage, and a Dou Dizhu trustee edge-case test.

## Task Commits

No task-level commits were created. Plan 07-02 was implemented as one working-tree batch and will be captured in a plan-level commit.

## Files Created/Modified

- `.planning/phases/07-session-recovery-presence/07-02-SUMMARY.md` - plan completion record and downstream context
- `lib/game/room-manager.js` - reconnect grace timers, seat restoration, and completed-room cleanup gating for Dou Dizhu
- `lib/party/manager.js` - reconnect grace timers for party rooms plus voice-disconnect coexistence
- `lib/board/manager.js` - reconnect grace timers for board rooms and completed-room cleanup gating
- `test-logic/session-recovery.test.js` - focused card/party/board reconnect lifecycle tests
- `test-logic/hub-room-entry.test.js` - real guest socket reconnect coverage through the scoped socket lifecycle
- `test-logic/ddz-logic.test.js` - Dou Dizhu trustee + reconnect presence edge-case coverage

## Decisions Made

- The reconnect grace timer is kept in-memory and per manager, matching Phase 7's single-node scope.
- Reconnect grace is cleared on both HTTP seat restoration paths (`joinRoom`) and live socket restoration paths (`registerSocket`).
- Bots stay permanently `connected` and never enter the grace timer state machine.

## Deviations from Plan

### Auto-fixed Issues

**1. Existing socket and directory wiring already matched the new manager state machine**
- **Found during:** Task 2 (wire socket lifecycle into the recovery state machine)
- **Issue:** The plan listed `lib/socket-server.js` and `lib/rooms/directory.js`, but the shipped subscribe/disconnect hooks already funneled through manager `registerSocket` / `unregisterSocket`, and directory membership was already deduped.
- **Fix:** Kept the runtime change inside the three managers and expanded tests to prove the live socket path exercises the new state machine correctly.
- **Files modified:** `lib/game/room-manager.js`, `lib/party/manager.js`, `lib/board/manager.js`, `test-logic/session-recovery.test.js`, `test-logic/hub-room-entry.test.js`
- **Verification:** `node --test test-logic/session-recovery.test.js test-logic/hub-room-entry.test.js test-logic/ddz-logic.test.js`
- **Committed in:** pending plan-level commit

---

**Total deviations:** 1 auto-fixed (plan simplification)
**Impact on plan:** No scope loss. Existing socket/directory wiring was sufficient, so the runtime change stayed smaller while preserving the required behavior.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Room pages can now render authoritative `connected` / `reconnecting` / `disconnected` transitions without guessing from socket churn.
- Playwright smokes in 07-03 can exercise refresh/reconnect continuity against a real bounded grace window instead of a binary online/offline flag.

---
*Phase: 07-session-recovery-presence*
*Completed: 2026-04-22*
