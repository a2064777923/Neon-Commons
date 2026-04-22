---
phase: 02-admin-control-plane-expansion
plan: 01
subsystem: api
tags: [admin, api, postgres, rooms, socket.io]
requires:
  - phase: 01-01
    provides: shared handler contract inventory and backend route metadata
  - phase: 01-02
    provides: shared frontend/backend route builders for split-port runtime access
provides:
  - shared admin control-plane module for capability and runtime state
  - explicit `/api/admin/capabilities` and `/api/admin/runtime` handlers
  - new-room-only enforcement in card, party, and board room create handlers
affects:
  - Phase 2 admin console
  - future admin audit surfaces
  - future room-gating work
tech-stack:
  added: []
  patterns:
    - persist operator-managed capability/runtime state through `system_configs`
    - gate only new room creation, never mutate live room manager state after room creation
    - expose admin control-plane changes through explicit backend handlers instead of raw DB edits
key-files:
  created:
    - lib/admin/control-plane.js
    - backend/handlers/admin/capabilities/index.js
    - backend/handlers/admin/runtime/index.js
    - test-logic/admin-control-plane.test.js
  modified:
    - lib/shared/network-contract.js
    - backend/handlers/rooms/index.js
    - backend/handlers/party/rooms/index.js
    - backend/handlers/board/rooms/index.js
key-decisions:
  - "Capability and runtime state live in explicit `gameCapabilities` / `runtimeControls` config keys, with runtime fallback to legacy scalar rows for compatibility."
  - "Create-time gating stays at handler boundaries so existing live rooms keep their original snapshot and remain playable."
  - "Wave 1 verification uses mocked backend handlers plus pure helper tests instead of requiring a live Postgres instance."
patterns-established:
  - "Admin room-gating work should route through `lib/admin/control-plane.js` before room manager creation calls."
  - "New admin backend surfaces should publish explicit route metadata in `lib/shared/network-contract.js` and handler contracts."
requirements-completed: [ADMIN-01, ADMIN-02]
duration: 18min
completed: 2026-04-22
---

# Phase 2: Admin Control Plane Expansion Summary

**Shared capability/runtime control-plane APIs plus new-room-only enforcement across card, party, and board room creation**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-22T01:46:00Z
- **Completed:** 2026-04-22T02:04:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- Added `lib/admin/control-plane.js` as the source of truth for cross-game capability toggles and allowlisted runtime controls.
- Exposed explicit admin handlers for grouped capability state and runtime state instead of relying on raw config edits.
- Applied maintenance-mode and disabled-game gating only to future room creation, leaving already-open rooms untouched.

## Task Commits

No commits were created in this session. The plan was executed in an already dirty worktree and completed as working-tree changes only.

## Files Created/Modified

- `lib/admin/control-plane.js` - shared capability/runtime persistence, normalization, audit logging, and create-time gating helpers
- `backend/handlers/admin/capabilities/index.js` - admin-only grouped game capability read/update endpoint
- `backend/handlers/admin/runtime/index.js` - admin-only allowlisted runtime control read/update endpoint
- `lib/shared/network-contract.js` - shared admin route builders for capability/runtime endpoints
- `backend/handlers/rooms/index.js` - Dou Dizhu create-time maintenance/runtime gating
- `backend/handlers/party/rooms/index.js` - party-room create-time capability/runtime gating
- `backend/handlers/board/rooms/index.js` - board-room create-time capability/runtime gating
- `test-logic/admin-control-plane.test.js` - helper, handler, and create-boundary regression coverage

## Decisions Made

- Runtime compatibility keeps reading legacy `maxOpenRoomsPerUser` and `maintenanceMode` rows if the consolidated runtime object has not been written yet.
- Capability grouping follows the shipped game families (`card`, `party`, `board`) so the admin UI can render a stable grouped surface in Wave 2.
- Enforcement remains at HTTP create handlers rather than in the room managers because the product decision is explicitly "new rooms only."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworked the handler test mock loader to stop leaking through to real Postgres**
- **Found during:** Task 2 / Task 3 verification
- **Issue:** The first handler-level tests restored mocked modules too early, so nested imports reused the real `lib/db` connection and hit `127.0.0.1:5432`.
- **Fix:** Replaced the brittle restore-first cache helper with a project-cache reset plus mock reinjection before each handler load.
- **Files modified:** `test-logic/admin-control-plane.test.js`
- **Verification:** `node --test test-logic/admin-control-plane.test.js`

---

**Total deviations:** 1 auto-fixed (blocking test isolation)
**Impact on plan:** Low. The fix stayed inside the planned test scaffold and made the required backend verification deterministic.

## Issues Encountered

- Handler-level mocks initially reused the already-cached real control-plane module. Clearing project-local require cache before each mocked load resolved it cleanly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The admin page can now consume structured capability/runtime APIs instead of raw JSON config state.
- Cross-game room gating is live at backend boundaries and ready for UI controls plus audit surfacing.

---
*Phase: 02-admin-control-plane-expansion*
*Completed: 2026-04-22*
