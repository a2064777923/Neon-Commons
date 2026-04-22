---
phase: 09-single-node-recovery-guardrails
plan: 01
subsystem: backend
tags: [recovery, snapshots, postgres, room-directory, startup]
requires: []
provides:
  - PostgreSQL-backed room-directory snapshot persistence
  - startup rehydration for the shared room directory
  - focused node coverage for snapshot reload without fake live manager state
affects:
  - room-number resolve and shareable discovery
  - future stale-room cleanup work in 09-02
  - future availability semantics in 09-03
tech-stack:
  added: []
  patterns:
    - keep `registerRoomEntry` / `updateRoomEntry` / `unregisterRoomEntry` synchronous at call sites while doing async write-through persistence underneath
    - restore snapshot entries into the shared directory cache without reconstructing room-manager memory state
key-files:
  created:
    - .planning/phases/09-single-node-recovery-guardrails/09-01-SUMMARY.md
    - test-logic/room-directory-persistence.test.js
  modified:
    - lib/db.js
    - lib/rooms/directory.js
    - backend/server.js
key-decisions:
  - "Persist room-directory snapshots in PostgreSQL instead of container-local files because the canonical deploy recreates the app container."
  - "Keep the existing synchronous directory API surface and hide persistence behind tracked async write-through helpers."
  - "Mark startup-restored entries as `source: snapshot` without inventing fake room-manager rooms or match state."
patterns-established:
  - "Runtime restart recovery should rebuild the shared room directory first and let later handlers decide how snapshot-only entries are exposed."
  - "Node tests for directory persistence should mock the DB adapter so they stay runnable from the host even when the compose Postgres port is not published."
requirements-completed: [RELY-01]
duration: 5min
completed: 2026-04-22
---

# Phase 9 Plan 01 Summary

**The shared room directory now persists minimal snapshot metadata to PostgreSQL and reloads it at backend startup without faking live room-manager state**

## Performance

- **Duration:** 5 min
- **Started:** 2026-04-22T21:42:00+08:00
- **Completed:** 2026-04-22T21:47:34+08:00
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Added the `room_directory_snapshots` table to the existing database bootstrap path.
- Upgraded `lib/rooms/directory.js` with async write-through snapshot persistence, startup reload support, and test helpers for flush/reset flows.
- Wired backend startup to reload persisted directory entries before listening, then locked the behavior with a focused node persistence suite.

## Task Commits

No task-level commits were created. Plan 09-01 was implemented as one working-tree batch and will be captured in a plan-level commit.

## Files Created/Modified

- `.planning/phases/09-single-node-recovery-guardrails/09-01-SUMMARY.md` - plan completion record and downstream context
- `lib/db.js` - adds the `room_directory_snapshots` table to database initialization
- `lib/rooms/directory.js` - snapshot write-through persistence, startup reload, and test helpers
- `backend/server.js` - bootstraps the shared room directory from persisted snapshots before serving traffic
- `test-logic/room-directory-persistence.test.js` - focused persistence and startup-reload coverage

## Decisions Made

- PostgreSQL is the snapshot source of truth for Phase 9 restart recovery because the deployed app container is recreated during canonical release.
- The shared directory API kept its synchronous call shape so existing managers do not need async rewrites just to persist discovery metadata.
- Snapshot reload restores only directory-grade metadata; it intentionally does not recreate live room-manager `rooms` maps or match state.

## Deviations from Plan

### Auto-fixed Issues

**1. The new node persistence suite mocks `lib/db.query` instead of depending on a host-published Postgres port**
- **Found during:** verification
- **Issue:** The local compose Postgres container is not published on host `127.0.0.1:5432`, so a direct DB-backed node test would fail from the host shell even though the runtime stack is healthy.
- **Fix:** Built the persistence suite around a mocked snapshot repository contract so the logic remains fully verifiable from `node --test` without external port assumptions.
- **Files modified:** `test-logic/room-directory-persistence.test.js`
- **Verification:** `node --test test-logic/room-directory-persistence.test.js`
- **Committed in:** pending plan-level commit

---

**Total deviations:** 1 auto-fixed (test portability)
**Impact on plan:** Positive only. The runtime still persists to PostgreSQL, while the test suite stays runnable from the host shell in this repo's compose topology.

## Issues Encountered

- None in runtime code after shifting the persistence suite to a mocked DB adapter.

## User Setup Required

None.

## Next Phase Readiness

- Plan 09-02 can now layer stale-room expiry on top of a restart-safe directory snapshot source.
- Plan 09-03 can safely distinguish `live` and `snapshot-only` entries at the handler/UI contract layer because startup reload now preserves that state boundary.

---
*Phase: 09-single-node-recovery-guardrails*
*Completed: 2026-04-22*
