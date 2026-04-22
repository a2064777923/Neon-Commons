---
phase: 07-session-recovery-presence
plan: 03
subsystem: ui
tags: [recovery, presence, nextjs, playwright, rooms, ui]
requires:
  - phase: 07-01
    provides: shared recovery contract fields across session and room payloads
  - phase: 07-02
    provides: runtime reconnect grace transitions and socket-driven recovery behavior
provides:
  - recovery-aware room pages across card, party, Undercover, board, and Reversi routes
  - stable `data-presence-state` and `data-recovery-banner` selectors for host and smoke validation
  - refresh/reload smoke coverage on the canonical 3100 runtime
affects:
  - release verification
  - room host moderation cues
  - phase 8 live-ops tooling assumptions
tech-stack:
  added: []
  patterns:
    - derive room-page presence copy from shared client helpers instead of page-local boolean checks
    - keep smoke specs repeatable by registering fresh users instead of relying on long-lived accounts with open-room quotas
key-files:
  created:
    - .planning/phases/07-session-recovery-presence/07-03-SUMMARY.md
    - tests/support/auth.js
  modified:
    - lib/client/room-entry.js
    - pages/entry/[gameKey]/[roomNo].js
    - pages/room/[roomNo].js
    - pages/party/[roomNo].js
    - pages/undercover/[roomNo].js
    - pages/board/[roomNo].js
    - styles/GameRoom.module.css
    - styles/PartyRoom.module.css
    - styles/UndercoverRoom.module.css
    - styles/BoardRoom.module.css
    - tests/room-ui.spec.js
    - tests/arcade-party.spec.js
    - tests/board-games.spec.js
    - tests/undercover.spec.js
    - tests/reversi.spec.js
key-decisions:
  - "Keep the existing room entry model and add recovery awareness through shared client helpers plus subtle in-room banners."
  - "Use stable data attributes for presence and recovery so UI verification does not depend on CSS-module class names."
  - "Make smoke runs self-seeding with fresh accounts to avoid open-room quota drift across repeated executions."
patterns-established:
  - "Room pages should render presence from `presenceState` and only fall back to `connected` through shared client helpers."
  - "Browser smoke tests for room flows should verify reload continuity on the real deployed stack, not only happy-path room creation."
requirements-completed: [ROOM-01, ROOM-02, ROOM-03]
duration: 16min
completed: 2026-04-22
---

# Phase 7 Plan 03 Summary

**Shipped room pages now surface recovery-aware presence and survive refresh/reload, with Playwright smokes enforcing the behavior on the deployed 3100 stack**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-22T19:56:00+08:00
- **Completed:** 2026-04-22T20:12:24+08:00
- **Tasks:** 2
- **Files modified:** 17

## Accomplishments

- Extended shared client recovery helpers so room pages can derive presence labels, reconnect banners, and direct-recovery decisions from one source.
- Added additive recovery and presence affordances to Dou Dizhu, party, Undercover, board, and Reversi room pages without redesigning the shipped layouts.
- Updated the shipped Playwright smoke surface to assert refresh continuity and visible `data-presence-state` cues on the canonical deployed runtime.

## Task Commits

No task-level commits were created. Plan 07-03 was implemented as one working-tree batch and will be captured in a plan-level commit.

## Files Created/Modified

- `.planning/phases/07-session-recovery-presence/07-03-SUMMARY.md` - plan completion record and downstream context
- `lib/client/room-entry.js` - shared presence labels, reconnect banner copy, and room-session recovery helpers
- `pages/entry/[gameKey]/[roomNo].js` - entry page now uses the shared recovery helper for direct guest/session return
- `pages/room/[roomNo].js` - Dou Dizhu room page now resubscribes on reconnect and renders recovery-aware presence cues
- `pages/party/[roomNo].js` - party room page now renders recovery-aware seat state and reconnect banners
- `pages/undercover/[roomNo].js` - Undercover route now explicitly participates in the same recovery/presence UI contract
- `pages/board/[roomNo].js` - board/reversi room page now renders recovery-aware seat state and reconnect banners
- `styles/GameRoom.module.css` - additive presence/recovery banner styling for the card room shell
- `styles/PartyRoom.module.css` - additive presence/recovery banner styling for party rooms
- `styles/UndercoverRoom.module.css` - additive presence/recovery banner styling for Undercover
- `styles/BoardRoom.module.css` - additive presence/recovery banner styling for board and Reversi rooms
- `tests/support/auth.js` - fresh-user registration helper for repeatable smoke runs
- `tests/room-ui.spec.js` - Dou Dizhu reload continuity and presence assertions
- `tests/arcade-party.spec.js` - party reload continuity and presence assertions
- `tests/board-games.spec.js` - board reload continuity and presence assertions
- `tests/undercover.spec.js` - Undercover reload continuity and presence assertions
- `tests/reversi.spec.js` - Reversi reload continuity, presence assertions, and entry deep-link smoke

## Decisions Made

- Recovery messaging stays subtle and additive: a compact banner is shown for reconnecting/recovered viewers instead of a new blocking flow.
- Host-visible presence is exposed through `data-presence-state` attributes so browser tests can assert the authoritative UI contract directly.
- Smoke tests now create fresh users to avoid false failures from accumulated open-room quotas on long-lived accounts.

## Deviations from Plan

### Auto-fixed Issues

**1. Added a tiny shared smoke-auth helper to keep Playwright runs repeatable**
- **Found during:** Task 2 (extend browser smokes)
- **Issue:** Re-running room-creation smokes against the same long-lived accounts could fail because open-room quotas persisted between runs.
- **Fix:** Added `tests/support/auth.js` so each smoke spec registers a fresh user before creating rooms.
- **Files modified:** `tests/support/auth.js`, `tests/room-ui.spec.js`, `tests/arcade-party.spec.js`, `tests/board-games.spec.js`, `tests/undercover.spec.js`, `tests/reversi.spec.js`
- **Verification:** `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/room-ui.spec.js tests/arcade-party.spec.js tests/board-games.spec.js tests/undercover.spec.js tests/reversi.spec.js --workers=1`
- **Committed in:** pending plan-level commit

---

**Total deviations:** 1 auto-fixed (test reliability)
**Impact on plan:** Positive only. Runtime scope stayed the same while smoke verification became repeatable on a reused environment.

## Issues Encountered

- Initial board smoke selectors were too broad and hit both “我的席位” and “席位” buttons; the selectors were narrowed to the actual seat-panel button and the drawer was closed before board interaction resumed.

## User Setup Required

None.

## Next Phase Readiness

- Phase 7 is now fully shipped and verified from backend contract through browser refresh/reconnect behavior.
- Phase 8 can build live-ops tooling on top of stable room presence metadata and real deployed-stack verification.

---
*Phase: 07-session-recovery-presence*
*Completed: 2026-04-22*
