---
phase: 03-hub-room-expansion-framework
plan: 03
subsystem: ui
tags: [nextjs, react, hub, invite, guest, playwright]
requires:
  - phase: 03-01
    provides: family hub payload and discovery metadata
  - phase: 03-02
    provides: room-entry resolve/shareable/guest/guest-sync backend contracts
provides:
  - family-arcade homepage and universal entry dock
  - deep-link entry page plus family-lobby invite/copy consistency
  - guest result-sync UI and Playwright coverage for hub/entry flows
affects:
  - Phase 4 gameplay expansion UX
  - invite sharing behavior across shipped families
  - release smoke coverage
tech-stack:
  added: []
  patterns:
    - route homepage and lobby invite actions through shared room-entry paths instead of page-local join logic
    - keep guest sync as a frontend storage handoff plus backend claim API, not a fake client-only toast
key-files:
  created:
    - lib/client/room-entry.js
    - pages/entry/[gameKey]/[roomNo].js
    - tests/hub-entry.spec.js
  modified:
    - pages/index.js
    - pages/lobby.js
    - pages/games/[gameKey].js
    - pages/login.js
    - pages/party/[roomNo].js
    - pages/board/[roomNo].js
    - components/MatchResultOverlay.js
    - styles/Arcade.module.css
    - styles/Lobby.module.css
    - styles/GameLobby.module.css
    - styles/MatchResultOverlay.module.css
    - styles/UtilityPages.module.css
    - tests/arcade-party.spec.js
    - tests/board-games.spec.js
key-decisions:
  - "Family lobbies keep dedicated create-room forms, but fast join and invite copy now route through `/entry/{gameKey}/{roomNo}`."
  - "Guest post-match sync is implemented as a compact result callout inside the shared overlay while leaving existing replay/return actions intact."
  - "The latest Phase 3 verification ran against the rebuilt Dockerized split runtime on ports 3100/3101."
patterns-established:
  - "Any future family or room page should consume hub discovery state for paused/upcoming semantics instead of hardcoding availability."
  - "Invite/login/guest handoff should use `returnTo` plus pending-claim session storage rather than custom query flags per page."
requirements-completed: [HUB-01, ROOM-01]
duration: 48min
completed: 2026-04-22
---

# Phase 3: Hub & Room Expansion Framework Summary

**Family-based arcade homepage, universal invite entry page, and guest-to-account sync UX wired into shipped party/board rooms**

## Performance

- **Duration:** 48 min
- **Started:** 2026-04-22T12:14:00+08:00
- **Completed:** 2026-04-22T13:02:50+08:00
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Rebuilt the homepage around the public hub payload with a central `遊戲入口` dock, compact family bands, and visible `暫停新房` / `即將推出` states.
- Added the universal `/entry/[gameKey]/[roomNo]` landing page, updated family lobbies to use deep-link joins/copy flows, and made login honor `returnTo`.
- Wired guest-result sync prompts into party/board result overlays and added Playwright smoke coverage for the new hub and invite paths.

## Task Commits

No commits were created in this session. The plan was executed in an already dirty worktree and completed as working-tree changes only.

## Files Created/Modified

- `pages/index.js` - family arcade homepage driven by `/api/hub`
- `pages/entry/[gameKey]/[roomNo].js` - universal invite/identity intercept with guest/login branching
- `pages/lobby.js` - Dou Dizhu family lobby with return path, deep-link quick join, paused-new-room messaging, and invite copy
- `pages/games/[gameKey].js` - party/board family lobbies aligned to deep-link join/copy and paused discovery state
- `pages/login.js` - safe `returnTo` handling after login
- `lib/client/room-entry.js` - shared invite-path, clipboard, and guest-claim session-storage helpers
- `pages/party/[roomNo].js` - guest-aware session handling and post-login claim sync
- `pages/board/[roomNo].js` - guest-aware session handling and post-login claim sync
- `components/MatchResultOverlay.js` - compact guest-sync notice block with exact CTA labels
- `tests/hub-entry.spec.js` - homepage state and guest invite deep-link smoke coverage
- `tests/arcade-party.spec.js` - updated family-hub and party lobby smoke checks
- `tests/board-games.spec.js` - updated family-hub and board lobby smoke checks

## Decisions Made

- Dou Dizhu still does not expose guest entry or guest-sync prompts; only shipped party/board private invites can branch into guest mode.
- Family lobbies copy the exact deep-link path rather than reusing the backend join API directly, so logged-out flows stay consistent with the entry page.
- The app container on `3100/3101` was rebuilt and restarted before the Phase 3 Playwright run so verification covered the latest code, not a stale deployment.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Port `3100/3101` was already occupied by the deployed `doudezhu_app` container. The container was rebuilt and recreated with `docker compose up -d --build app` before browser verification to ensure the smoke suite hit the latest Phase 3 runtime.

## User Setup Required

None - the live app container was rebuilt and restarted during execution.

## Next Phase Readiness

- Phase 4 can now extend card and party gameplay on top of stable family discovery, invite entry, paused-new-room semantics, and guest-aware room access.
- Hub, lobby, and room-entry regressions are covered by targeted Playwright smoke tests, reducing risk for the next expansion wave.

---
*Phase: 03-hub-room-expansion-framework*
*Completed: 2026-04-22*
