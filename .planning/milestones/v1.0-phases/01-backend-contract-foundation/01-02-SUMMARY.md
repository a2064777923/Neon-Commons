---
phase: 01-backend-contract-foundation
plan: 02
subsystem: api
tags: [frontend, nextjs, socket.io, playwright, node:test]
requires:
  - phase: 01-01
    provides: shared REST and Socket.IO contract inventory in `lib/shared/network-contract.js`
provides:
  - backend-aware frontend runtime resolution in `lib/client/network-runtime.js`
  - shared route/event helper usage across frontend pages, room views, and smoke coverage
  - client-side contract regression coverage for API and socket origin resolution
affects:
  - 01-03 docs refresh
  - future frontend/admin/hub feature work
  - room and smoke-test maintenance
tech-stack:
  added: []
  patterns:
    - shared frontend network runtime wrapping `lib/shared/network-contract.js`
    - route/event constants imported from `lib/client/api.js` instead of page-local string literals
    - smoke tests parameterized by frontend origin while reusing the app's backend URL helper
key-files:
  created:
    - lib/client/network-runtime.js
    - test-logic/client-network-contract.test.js
  modified:
    - lib/client/api.js
    - components/SiteLayout.js
    - pages/**/*.js
    - tests/room-ui.spec.js
    - .env.example
key-decisions:
  - "Keep the shared client runtime in CommonJS with an ESM wrapper so browser pages and node-based tests consume the same implementation."
  - "Read `NEXT_PUBLIC_*` variables through static property access so Next.js injects them into the client bundle correctly."
  - "Let the room smoke test accept a frontend base URL override so isolated verification can target the active workspace runtime instead of assuming one fixed host port."
patterns-established:
  - "Frontend pages import `API_ROUTES` and `SOCKET_EVENTS` from `lib/client/api.js` instead of hardcoding contract strings."
  - "Browser fetch and Playwright smoke paths resolve backend URLs through the same runtime helper."
requirements-completed: [PLAT-01]
duration: 44min
completed: 2026-04-22
---

# Phase 1: Backend Contract Foundation Summary

**Backend-aware frontend runtime helpers with shared route/event adoption across pages, room flows, and contract regression coverage**

## Performance

- **Duration:** 44 min across two sessions
- **Started:** 2026-04-20T05:31:05Z
- **Completed:** 2026-04-22T00:18:50Z
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- Added `lib/client/network-runtime.js` as the shared frontend runtime layer for API and Socket.IO origin resolution, then exposed it through `lib/client/api.js`.
- Replaced scattered `/api/*` and custom socket-event literals across login, hub, admin, profile, and room pages with `API_ROUTES` and `SOCKET_EVENTS`.
- Added direct `node:test` coverage for client runtime resolution and updated the room smoke test to use the same backend-aware helper path.

## Task Commits

No commits were created in this session. The plan was resumed in a dirty worktree and completed as working-tree changes only.

## Files Created/Modified

- `lib/client/network-runtime.js` - shared API/socket origin resolution plus shared contract re-exports for frontend and tests
- `lib/client/api.js` - thin ESM wrapper around the shared client runtime
- `pages/**/*.js` and `components/SiteLayout.js` - frontend consumers now use `API_ROUTES` and `SOCKET_EVENTS`
- `test-logic/client-network-contract.test.js` - direct regression coverage for API/socket resolution and route builders
- `tests/room-ui.spec.js` - smoke flow now resolves backend URLs through the shared helper and accepts a configurable frontend base URL
- `.env.example` - documents the public-origin variables that control frontend API/socket resolution

## Decisions Made

- Kept the route/event inventory authoritative in `lib/shared/network-contract.js`, with frontend pages importing the re-exported helpers from `lib/client/api.js`.
- Split the client runtime into a CommonJS implementation plus ESM wrapper so node-based tests and frontend code share one source of truth.
- Treated frontend-base configurability in the room smoke test as part of the contract layer, because verification must target the same runtime assumptions the app uses.

## Deviations from Plan

### Auto-fixed Issues

**1. [Runtime correctness] Replaced dynamic `process.env[name]` access with static `NEXT_PUBLIC_*` reads**
- **Found during:** Task 1 / Task 3 verification
- **Issue:** Next.js does not inject dynamic `process.env[name]` lookups into the client bundle, so browser builds ignored explicit public API/socket origin overrides.
- **Fix:** Switched the runtime helper to static `process.env.NEXT_PUBLIC_API_BASE_URL`, `process.env.NEXT_PUBLIC_BACKEND_URL`, and `process.env.NEXT_PUBLIC_SOCKET_URL` reads.
- **Files modified:** `lib/client/network-runtime.js`
- **Verification:** `node --test test-logic/client-network-contract.test.js` and the room smoke test both passed after the fix.

**2. [Verification hardening] Parameterized the room smoke test frontend origin**
- **Found during:** Task 3 smoke validation
- **Issue:** Port `3100` was already occupied by a separate containerized runtime, so the smoke test could not reliably target the current workspace frontend.
- **Fix:** Added `FRONTEND_BASE_URL` support to `tests/room-ui.spec.js` while keeping backend URL resolution on the shared client helper.
- **Files modified:** `tests/room-ui.spec.js`
- **Verification:** `FRONTEND_BASE_URL=http://127.0.0.1:3200 NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3101 NEXT_PUBLIC_SOCKET_URL=http://127.0.0.1:3101 npx playwright test tests/room-ui.spec.js --workers=1`

---

**Total deviations:** 2 auto-fixed (1 runtime correctness, 1 verification hardening)
**Impact on plan:** Both changes were necessary to make the contract helper real in browser builds and to verify the intended runtime instead of an unrelated existing service.

## Issues Encountered

- Host port `3100` was already serving another runtime, so final smoke verification used an isolated frontend on `3200` against the current workspace backend on `3101`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `01-03` can now document the real frontend/backend contract boundary, including the new client runtime helper and smoke-test expectations.
- Future frontend work should extend `API_ROUTES` / `SOCKET_EVENTS` rather than introducing new page-level literals.
- No code blockers remain for the docs-refresh plan.

---
*Phase: 01-backend-contract-foundation*
*Completed: 2026-04-22*
