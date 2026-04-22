---
phase: 09-single-node-recovery-guardrails
plan: 02
subsystem: backend
tags: [recovery, stale-room-expiry, config-cache, room-directory, reconnect-grace]
requires:
  - 09-01 snapshot persistence
provides:
  - shared cached `roomExpiryMinutes` policy in runtime milliseconds
  - consistent stale-room cleanup across card, party, and board managers
  - focused node coverage for expiry, reconnect cancellation, and snapshot prune parity
affects:
  - room lifecycle after all humans disconnect
  - startup snapshot pruning on backend boot
  - admin config writes for room-expiry policy changes
tech-stack:
  added: []
  patterns:
    - load mutable system config into a lightweight process cache, then reuse it from runtime timer paths
    - treat reconnect grace as authoritative and only start stale-room timers after the grace window fully expires
    - delete runtime rooms and persisted directory snapshots from the same archive path
key-files:
  created:
    - .planning/phases/09-single-node-recovery-guardrails/09-02-SUMMARY.md
    - lib/system-config.js
    - test-logic/room-expiry.test.js
  modified:
    - backend/handlers/admin/config/index.js
    - backend/server.js
    - lib/rooms/directory.js
    - lib/game/room-manager.js
    - lib/party/manager.js
    - lib/board/manager.js
    - test-logic/session-recovery.test.js
key-decisions:
  - "Use one cached `roomExpiryMinutes` source for all room families instead of hardcoding family-specific stale TTLs."
  - "Keep Phase 7 reconnect grace authoritative by starting abandonment cleanup only after reconnect grace ends and no human seats remain connected or reconnecting."
  - "Route stale-room deletion through the same manager-owned teardown path that also unregisters the shared room-directory entry, so persisted snapshots disappear with runtime rooms."
patterns-established:
  - "Any future room-family manager should model zero-human cleanup as: reconnect grace first, then one shared expiry window, then one teardown path."
  - "Host-runnable node tests for restart/expiry logic should mock `lib/db` and config adapters instead of depending on a published compose Postgres port."
requirements-completed: [RELY-02]
duration: 9min
completed: 2026-04-22
---

# Phase 9 Plan 02 Summary

**Single-node rooms now share one stale-room lifecycle: reconnect grace first, then room-expiry cleanup that removes both in-memory state and persisted directory snapshots**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-22T21:48:00+08:00
- **Completed:** 2026-04-22T21:57:11+08:00
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments

- Added `lib/system-config.js` as a cached runtime reader for `roomExpiryMinutes`, and wired backend startup plus admin config writes to keep that cache warm.
- Extended the shared room directory with startup-time snapshot pruning and reusable availability helpers needed by later plans.
- Added abandonment timers to card, party, and board room managers so rooms with zero connected or reconnecting humans now expire predictably after the shared policy window.
- Preserved the Phase 7 fast-close path for completed rooms once reconnect grace expires, while routing all room teardown through the same snapshot-removal path.
- Added focused node coverage for waiting-room expiry, completed-room fast close, reconnect-before-expiry cancellation, and stale snapshot prune parity.

## Task Commits

No task-level commits were created. Plan 09-02 was implemented as one working-tree batch and will be captured in a plan-level commit.

## Files Created/Modified

- `.planning/phases/09-single-node-recovery-guardrails/09-02-SUMMARY.md` - plan completion record and downstream context
- `lib/system-config.js` - cached room-expiry policy reader used by backend startup and room managers
- `backend/server.js` - loads config cache before snapshot bootstrap and prunes stale snapshots on startup
- `backend/handlers/admin/config/index.js` - keeps the runtime config cache in sync after admin writes
- `lib/rooms/directory.js` - snapshot prune helper, availability helper, and startup prune support
- `lib/game/room-manager.js` - card-room stale expiry timers and unified teardown path
- `lib/party/manager.js` - party-room stale expiry timers and unified teardown path
- `lib/board/manager.js` - board-room stale expiry timers and unified teardown path
- `test-logic/room-expiry.test.js` - focused expiry, reconnect cancellation, and snapshot prune coverage
- `test-logic/session-recovery.test.js` - clears new room-expiry timers during test resets

## Decisions Made

- `roomExpiryMinutes` is now normalized once into a process cache and reused from runtime timer paths so all families obey the same policy surface.
- Zero-human rooms do not start stale cleanup until every reconnect grace window has fully expired; reconnects and new joins clear any pending stale timer.
- Snapshot rows are deleted by the same archive path that removes the live room from the manager and shared directory, avoiding ghost discovery entries.

## Deviations from Plan

### Auto-fixed Issues

**1. The working tree already contained a partially applied 09-02 patch with a syntax break in `lib/rooms/directory.js`**
- **Found during:** execute startup inspection
- **Issue:** `loadRoomDirectorySnapshots()` had a duplicated function header, which made the file invalid before any new verification could run.
- **Fix:** Repaired the syntax break first, then completed the rest of the plan on top of the partially staged 09-02 changes instead of discarding them.
- **Files modified:** `lib/rooms/directory.js`
- **Verification:** `node --check lib/rooms/directory.js`
- **Committed in:** pending plan-level commit

---

**Total deviations:** 1 auto-fixed (partial patch recovery)
**Impact on plan:** Neutral to positive. The repair was necessary to regain a runnable baseline before completing the intended stale-room lifecycle work.

## Issues Encountered

- `test-logic/session-recovery.test.js` still emits expected snapshot-persistence connection-refused logs when run without a published host Postgres port, but the assertions remain green and the new focused expiry suite avoids that dependency by mocking `lib/db`.

## User Setup Required

None.

## Verification

- `node --test test-logic/room-expiry.test.js test-logic/session-recovery.test.js`
- `npm run check`

## Next Phase Readiness

- Plan 09-03 can now rely on accurate `live` versus `snapshot-only` room availability because stale rooms and snapshots are pruned on one shared lifecycle.
- Recovery-aware hub and entry handlers can safely surface snapshot-only rooms without risking long-lived ghost listings from abandoned zero-human rooms.

---
*Phase: 09-single-node-recovery-guardrails*
*Completed: 2026-04-22*
