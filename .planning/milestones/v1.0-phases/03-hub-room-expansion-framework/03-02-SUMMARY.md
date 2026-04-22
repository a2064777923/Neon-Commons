---
phase: 03-hub-room-expansion-framework
plan: 02
subsystem: api
tags: [rooms, auth, guest, socket.io, postgres, testing]
requires:
  - phase: 03-01
    provides: family/game discovery metadata and share-link path shape
provides:
  - shared cross-family room directory and allocator
  - universal room-entry resolve/shareable/guest/guest-sync APIs
  - scoped guest auth/session handling with claim persistence
affects:
  - invite deep-link UI
  - room-number join flows
  - guest-capable party and board rooms
tech-stack:
  added: []
  patterns:
    - register every live room into one shared directory and resolve room entry from that registry
    - keep guest auth scoped to a single room and family while leaving create/profile/admin flows real-user-only
key-files:
  created:
    - lib/rooms/directory.js
    - backend/handlers/room-entry/resolve.js
    - backend/handlers/room-entry/shareable.js
    - backend/handlers/room-entry/guest.js
    - backend/handlers/room-entry/guest-sync.js
  modified:
    - lib/game/room-manager.js
    - lib/party/manager.js
    - lib/board/manager.js
    - lib/auth.js
    - lib/socket-server.js
    - lib/db.js
    - lib/shared/network-contract.js
    - test-logic/hub-room-entry.test.js
key-decisions:
  - "One in-memory room directory is the source of truth for cross-family room-number resolution."
  - "Guest entry is allowed only for private invite flows on shipped party/board games; Dou Dizhu stays login-only."
  - "Guest minting joins the guest into the room immediately and reuses the main auth cookie with a scoped guest token."
patterns-established:
  - "Any future live room family should register `roomNo`, `detailRoute`, `joinRoute`, share support, and guest eligibility in the shared directory."
  - "Guest-capable flows must pair UI affordances with backend scope checks plus `guest_match_links` claim persistence."
requirements-completed: [ROOM-01]
duration: 26min
completed: 2026-04-22
---

# Phase 3: Hub & Room Expansion Framework Summary

**Shared room-number registry, universal room-entry APIs, and scoped guest-session support for eligible invite flows**

## Performance

- **Duration:** 26 min
- **Started:** 2026-04-22T11:48:00+08:00
- **Completed:** 2026-04-22T12:14:00+08:00
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Replaced per-manager room-number ownership with a shared room directory so all shipped game families resolve through one six-digit namespace.
- Added universal resolve/shareable/guest/guest-sync backend handlers and corresponding shared route builders.
- Extended auth, socket scope checks, and DB bootstrap so private invite guests can play, then later claim finished matches into a real account.

## Task Commits

No commits were created in this session. The plan was executed in an already dirty worktree and completed as working-tree changes only.

## Files Created/Modified

- `lib/rooms/directory.js` - shared allocator, room registry, resolver, and shareable-room listing
- `lib/game/room-manager.js` - room-directory registration for Dou Dizhu rooms
- `lib/party/manager.js` - room-directory registration for party rooms and guest eligibility metadata
- `lib/board/manager.js` - room-directory registration for board rooms and guest eligibility metadata
- `lib/shared/network-contract.js` - room-entry route builders for resolve/shareable/guest/guest-sync
- `lib/auth.js` - session-aware auth helpers, guest token signing, and guest scope enforcement
- `lib/socket-server.js` - guest socket scope checks per room/game
- `lib/db.js` - `guest_match_links` bootstrap
- `backend/handlers/room-entry/*.js` - universal room-entry API surface
- `test-logic/hub-room-entry.test.js` - cross-family allocator, resolve, guest, and socket-scope tests

## Decisions Made

- Existing rooms remain joinable even when a shipped game is paused for new-room creation; the pause stays create-time only.
- `backend/handlers/me.js` now returns both `user` and `session` so frontend room pages can support guest viewers without breaking existing real-user consumers.
- The room-entry resolve payload returns the frontend deep-link shape `/entry/{gameKey}/{roomNo}` so UI layers do not need to reconstruct invite URLs.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- The frontend can now build one coherent invite/login/guest experience on top of explicit resolve/shareable/guest contracts.
- Phase 03-03 can focus on homepage, family-lobby, and post-match UX instead of backend plumbing.

---
*Phase: 03-hub-room-expansion-framework*
*Completed: 2026-04-22*
