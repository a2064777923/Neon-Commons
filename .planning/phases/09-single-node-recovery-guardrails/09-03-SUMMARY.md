---
phase: 09-single-node-recovery-guardrails
plan: 03
subsystem: backend
tags: [recovery, discovery, availability, snapshot-only, room-entry, ui]
requires:
  - 09-01 snapshot persistence
  - 09-02 stale-room expiry guardrails
provides:
  - additive `live` / `snapshot-only` availability vocabulary across discovery and entry APIs
  - direct room-detail recovery payloads for snapshot-only rooms
  - browser copy and CTA guards that keep restart-recovered rooms visible without pretending they are live
affects:
  - hub public discovery
  - room-number resolve and shareable invite flows
  - guest invite minting and direct room detail requests
  - homepage and `/entry/[gameKey]/[roomNo]` UX during single-node recovery
tech-stack:
  added: []
  patterns:
    - keep live manager data as the preferred public-room source, but merge in snapshot-only directory entries for restart recovery visibility
    - attach explicit availability semantics to every room-entry payload instead of inferring liveness from route presence
    - fail closed on snapshot-only flows by returning recovery-aware 409 payloads instead of broken joins or generic 404s
key-files:
  created:
    - .planning/phases/09-single-node-recovery-guardrails/09-03-SUMMARY.md
  modified:
    - lib/rooms/directory.js
    - backend/handlers/hub.js
    - backend/handlers/room-entry/resolve.js
    - backend/handlers/room-entry/guest.js
    - backend/handlers/rooms/[roomNo]/index.js
    - backend/handlers/party/rooms/[roomNo]/index.js
    - backend/handlers/board/rooms/[roomNo]/index.js
    - pages/index.js
    - pages/entry/[gameKey]/[roomNo].js
    - styles/Arcade.module.css
    - test-logic/hub-room-entry.test.js
key-decisions:
  - "Use one explicit `availability` field with exact values `live` and `snapshot-only` across hub, resolve, shareable, guest, and direct room-detail surfaces."
  - "Keep live manager summaries as the preferred public discovery source, then merge in snapshot-only shared-directory entries so restart recovery stays visible without regressing live-room player counts."
  - "Route snapshot-only rooms through the browser entry page and recovery messaging instead of issuing guest tokens or pretending the direct room detail route is healthy."
patterns-established:
  - "If a room can be discovered after restart but not actively served by a live manager, the backend should expose it as `snapshot-only` rather than dropping it or treating it as joinable."
  - "Brownfield room-detail handlers can degrade consistently by checking the shared room directory after a live-room miss and returning one recovery payload before falling back to 404."
requirements-completed: [RELY-01, RELY-02]
duration: 10min
completed: 2026-04-22
---

# Phase 9 Plan 03 Summary

**Recovery-aware discovery now distinguishes `live` from `snapshot-only` rooms end to end, so restart-restored rooms stay visible without issuing broken entry flows**

## Performance

- **Duration:** 10 min
- **Started:** 2026-04-22T21:57:30+08:00
- **Completed:** 2026-04-22T22:07:06+08:00
- **Tasks:** 2
- **Files modified:** 12

## Accomplishments

- Added `availability` semantics to room-entry responses and public discovery payloads with the exact values `live` and `snapshot-only`.
- Taught `/api/hub` to merge live manager rooms with snapshot-only shared-directory entries so restart recovery stays visible after a single-node reboot.
- Blocked guest token issuance for snapshot-only rooms with a recovery-aware 409 response instead of allowing broken entry into a non-live room.
- Standardized card, party, and board detail handlers so a snapshot-only room now returns one aligned recovery payload instead of a generic 404.
- Updated the homepage live-feed cards and `/entry/[gameKey]/[roomNo]` to show recovery state honestly, avoid auto-entry for snapshot-only rooms, and disable destructive CTAs until a live room exists again.
- Extended the compatibility suite so hub, resolve/shareable, guest, and direct room-detail flows all assert the same availability vocabulary and fail-closed behavior.

## Task Commits

No task-level commits were created. Plan 09-03 was implemented as one working-tree batch and will be captured in a plan-level commit.

## Files Created/Modified

- `.planning/phases/09-single-node-recovery-guardrails/09-03-SUMMARY.md` - plan completion record and downstream context
- `lib/rooms/directory.js` - public room-entry listing helper for snapshot-aware discovery
- `backend/handlers/hub.js` - merges live public rooms with snapshot-only discovery entries and exposes availability metadata
- `backend/handlers/room-entry/resolve.js` - adds `availability` to room-entry payloads and exports shared snapshot-only recovery payload builder
- `backend/handlers/room-entry/guest.js` - rejects snapshot-only guest issuance with a recovery-aware 409 contract
- `backend/handlers/rooms/[roomNo]/index.js` - card-room direct detail recovery fallback
- `backend/handlers/party/rooms/[roomNo]/index.js` - party-room direct detail recovery fallback
- `backend/handlers/board/rooms/[roomNo]/index.js` - board-room direct detail recovery fallback
- `pages/index.js` - recovery-aware live-feed links and labels
- `pages/entry/[gameKey]/[roomNo].js` - blocks auto-entry and guest/login CTAs when availability is snapshot-only
- `styles/Arcade.module.css` - visual treatment for recovery-state feed cards
- `test-logic/hub-room-entry.test.js` - compatibility coverage for snapshot-only discovery, guest rejection, and direct detail fallbacks

## Decisions Made

- `availability` is the single additive liveness contract for discovery and entry flows; routes and share links alone no longer imply a room is actively joinable.
- Public discovery preserves richer live-manager player counts when available, then fills recovery gaps from the shared directory only for snapshot-only rooms.
- Snapshot-only rooms fail closed through the entry surface: they remain discoverable, but guest issuance, auto-join, and direct room-detail expectations all stop short of pretending the room is live.

## Deviations from Plan

### Auto-fixed Issues

**1. The existing hub compatibility test started seeing the snapshot-only room seeded by the new recovery test**
- **Found during:** verification
- **Issue:** The new snapshot-only test intentionally seeded global shared-directory state, which then leaked into the legacy hub test and changed its room count expectation.
- **Fix:** Reset live room state at the start of the legacy hub test so each compatibility case controls its own directory fixtures.
- **Files modified:** `test-logic/hub-room-entry.test.js`
- **Verification:** `node --test test-logic/hub-room-entry.test.js test-logic/room-directory-persistence.test.js test-logic/room-expiry.test.js test-logic/session-recovery.test.js`
- **Committed in:** pending plan-level commit

---

**Total deviations:** 1 auto-fixed (test isolation)
**Impact on plan:** Positive only. The runtime contract stayed unchanged; the fix only made the expanded compatibility suite deterministic.

## Issues Encountered

- Host-run node suites that touch the real shared room directory still emit expected PostgreSQL connection-refused logs when no host-published port exists, but the new recovery coverage stays deterministic because the assertions use in-memory directory fixtures and mocked handler dependencies where needed.

## User Setup Required

None.

## Verification

- `node --test test-logic/hub-room-entry.test.js test-logic/room-directory-persistence.test.js test-logic/room-expiry.test.js test-logic/session-recovery.test.js`
- `npm run check`

## Next Phase Readiness

- Phase 9 now fully exposes restart recovery honestly across backend contracts and the main browser entry surfaces.
- Any follow-up milestone can build richer recovery UX on top of the established `live` / `snapshot-only` vocabulary without reopening backend contract ambiguity.

---
*Phase: 09-single-node-recovery-guardrails*
*Completed: 2026-04-22*
