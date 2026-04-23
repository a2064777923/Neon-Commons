---
phase: 11-availability-signals-degraded-modes
plan: 02
subsystem: runtime-ui
tags: [availability, degraded-mode, admin-runtime, hub, room-entry, party-room]
requires:
  - phase: 11-availability-signals-degraded-modes
    plan: 01
    provides: shared degradedState envelope and admin runtime contract
provides:
  - scoped degraded-mode editing and audit visibility in the admin runtime surface
  - shared degraded-mode messaging on hub cards, room-entry, and party-room voice UI
  - stable local runtime routing for same-origin API plus split-port socket behavior on 3100/3101
affects: [admin-runtime, hub, room-entry, party-room, client-runtime, live-room-serialization]
tech-stack:
  added: []
  patterns: [same-origin API on local frontend, split-port socket fallback, room serialization keeps additive degradedState]
key-files:
  created:
    - tests/support/admin-auth.js
    - tests/support/admin-backend.js
  modified:
    - lib/admin/control-plane.js
    - lib/client/network-runtime.js
    - lib/game/room-manager.js
    - lib/party/manager.js
    - lib/board/manager.js
    - backend/router.js
    - pages/admin/index.js
    - pages/index.js
    - pages/entry/[gameKey]/[roomNo].js
    - pages/party/[roomNo].js
    - test-logic/client-network-contract.test.js
    - tests/admin-console.spec.js
    - tests/hub-entry.spec.js
    - tests/arcade-party.spec.js
    - tests/support/auth.js
key-decisions:
  - "Local browser API calls should stay same-origin on 3100, while Socket.IO keeps a direct 3101 fallback for split-port development."
  - "Live room serialization must carry degradedState, not only detail handlers, so join responses and socket updates cannot erase availability messaging."
  - "Browser coverage for hub/entry/party degraded flows can mix real-room smoke with route-mocked contract checks when backend behavior is already covered by node suites."
patterns-established:
  - "Admin session cookie helpers can stabilize protected UI/browser tests without relying on flaky login form flows."
  - "Runtime-sensitive browser suites reset shared degraded controls explicitly instead of assuming DB-backed config starts healthy."
requirements-completed: [AVAIL-01, AVAIL-03]
duration: 2h31min
completed: 2026-04-23
---

# Phase 11 Plan 02 Summary

**Operators can now edit scoped degraded-mode controls in admin, and players see the same degraded vocabulary across hub, entry, and party-room voice surfaces without losing live-room continuity.**

## Performance

- **Duration:** 2h31min
- **Started:** 2026-04-23T07:33:00+08:00
- **Completed:** 2026-04-23T10:04:00+08:00
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- Extended the admin runtime UI so scoped `entry`, `realtime`, and `voice` degraded controls are editable and auditable through the existing `/api/admin/runtime` surface.
- Updated hub cards, room-entry pages, and party-room voice panels to render one shared degraded-state vocabulary with stable selectors and safe-action labels.
- Fixed local runtime behavior so browser API traffic stays on same-origin `3100`, Socket.IO still connects reliably to `3101`, and live room socket updates preserve additive `degradedState`.

## Files Created/Modified

- `tests/support/admin-auth.js` - Signed admin-cookie helper for stable protected browser flows.
- `tests/support/admin-backend.js` - Node-side admin backend helper for deterministic runtime control requests in tests.
- `lib/admin/control-plane.js` - Added cached availability control access for live room serialization paths.
- `lib/client/network-runtime.js` - Same-origin API base for local browser runtime and split-port socket fallback.
- `lib/game/room-manager.js` - Card room serialization now keeps additive degraded-state data on live updates.
- `lib/party/manager.js` - Party room serialization now keeps additive degraded-state data on live updates.
- `lib/board/manager.js` - Board room serialization now keeps additive degraded-state data on live updates.
- `backend/router.js` - Accept both `/socket.io` and `/socket.io/` pass-through routing.
- `pages/admin/index.js` - Scoped degraded-mode controls, status badges, and audit context rendering.
- `pages/index.js` - Hub family cards and live feed show degraded entry state with shared copy.
- `pages/entry/[gameKey]/[roomNo].js` - Block/degraded entry guidance, safe actions, and auto-enter gating.
- `pages/party/[roomNo].js` - Voice blocked/degraded status, safe-action rendering, and button-state handling.
- `test-logic/client-network-contract.test.js` - Local API/socket runtime contract coverage for 3100/3101 split behavior.
- `tests/admin-console.spec.js` - Admin degraded-mode controls and audit-trace coverage.
- `tests/hub-entry.spec.js` - Hub and entry rendering coverage for paused, snapshot-only, blocked, and guest deep-link flows.
- `tests/arcade-party.spec.js` - Party voice blocked guidance coverage alongside real party-room smoke.
- `tests/support/auth.js` - Added direct registration-session helper for browser test stabilization.

## Decisions Made

- Kept room `availability` truth separate from degraded subsystem state even on live socket updates and join responses.
- Treated local split-port runtime as a special case: API through frontend proxy, Socket.IO direct to backend.
- Stabilized browser coverage by combining real-room flows where interaction mattered and route-mocked contract tests where backend semantics were already proven elsewhere.

## Deviations from Plan

- Added a small availability-control cache in `lib/admin/control-plane.js` so live room managers can serialize degraded state synchronously for join responses and socket broadcasts.
- Fixed a local Socket.IO regression by restoring the backend pass-through for both slash and no-slash `/socket.io` requests while keeping the frontend/backend split intact.

## Issues Encountered

- Local split-port development regressed when API and Socket.IO both used the same origin assumptions; the browser runtime had to treat API and socket endpoints differently.
- Playwright admin/login and backend helper calls were flaky under long serial batches, so browser tests were stabilized with signed-cookie helpers, direct admin helpers, and route-mocked contract checks where appropriate.
- DB-backed degraded controls persist across deployments, so browser suites now reset shared voice degraded state explicitly before and after affected tests.

## User Setup Required

None.

## Verification

- `node --test test-logic/admin-control-plane.test.js test-logic/live-room-ops.test.js test-logic/hub-room-entry.test.js`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/admin-console.spec.js tests/hub-entry.spec.js tests/arcade-party.spec.js --workers=1`
- `npm run deploy:3100`

## Next Phase Readiness

- Phase 11-03 can now promote the widened degraded-state browser and logic coverage into helper scripts and the release rerun path.
- The remaining work is packaging and release verification, not additional degraded-mode UI or contract design.
