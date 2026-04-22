---
phase: 03-hub-room-expansion-framework
plan: 01
subsystem: api
tags: [hub, discovery, catalog, control-plane, testing]
requires:
  - phase: 02-01
    provides: control-plane capability state and create-time room gating
  - phase: 02-02
    provides: grouped family metadata already exposed to admin consumers
provides:
  - unified family/game discovery metadata for shipped and upcoming titles
  - exact hub card state synthesis for playable, paused-new-rooms, and coming-soon
  - public `/api/hub` discovery payload and shared route builder
affects:
  - homepage family arcade UI
  - invite entry routing
  - future game discovery expansion
tech-stack:
  added: []
  patterns:
    - keep discovery metadata in `lib/games/catalog.js` and derive runtime state from control-plane capability data
    - expose family discovery through one public hub payload instead of page-local multi-fetch assembly
key-files:
  created:
    - backend/handlers/hub.js
    - test-logic/hub-room-entry.test.js
  modified:
    - lib/games/catalog.js
    - lib/admin/control-plane.js
    - lib/shared/network-contract.js
key-decisions:
  - "Upcoming titles remain metadata-only Phase 3 entries; no fake handlers or room managers were created for them."
  - "Paused shipped-game state stays sourced from Phase 2 capability data rather than a second persisted discovery store."
  - "The public hub payload exposes only public-room discovery data and never leaks private invite details."
patterns-established:
  - "Frontend discovery consumers should call `/api/hub` instead of assembling room/capability/catalog state ad hoc."
  - "Future titles should be added to the catalog with family metadata, launch state, and share/guest hints before any gameplay work lands."
requirements-completed: [HUB-01]
duration: 16min
completed: 2026-04-22
---

# Phase 3: Hub & Room Expansion Framework Summary

**Family-based discovery metadata, exact hub state synthesis, and a single public `/api/hub` contract for shipped plus upcoming games**

## Performance

- **Duration:** 16 min
- **Started:** 2026-04-22T11:32:00+08:00
- **Completed:** 2026-04-22T11:48:00+08:00
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Expanded the catalog from shipped-title helpers into the Phase 3 discovery source, including the approved upcoming pool across `經典牌桌`, `推理派對`, `棋盤對戰`, `單人闖關`, and `輕量 3D`.
- Added exact discovery-state helpers in the control plane so shipped titles can render `可立即遊玩`, `暫停新房`, and `即將推出` without inventing a parallel data source.
- Added a public `/api/hub` endpoint and route builder so homepage/admin consumers can read one normalized discovery payload.

## Task Commits

No commits were created in this session. The plan was executed in an already dirty worktree and completed as working-tree changes only.

## Files Created/Modified

- `lib/games/catalog.js` - family taxonomy, shipped/upcoming discovery metadata, share-link hints, and guest-mode metadata
- `lib/admin/control-plane.js` - discovery-state synthesis and family/card payload builders
- `lib/shared/network-contract.js` - `/api/hub` route contract
- `backend/handlers/hub.js` - public hub discovery payload with families, live feed, featured rooms, and entry dock metadata
- `test-logic/hub-room-entry.test.js` - discovery contract coverage for hub payloads and exact state strings

## Decisions Made

- The hub payload intentionally keeps public discovery separate from private invite resolution so homepage consumers stay safe by default.
- Dou Dizhu remains the shipped card-family anchor and will use `guestMode: "login-only"` even while party/board families prepare guest-capable invite flows.
- Upcoming titles are visible immediately in the catalog so UI work can ship without blocking on unfinished gameplay implementations.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None.

## Next Phase Readiness

- Phase 3 now has the normalized discovery contract that later entry-flow and UI work can consume directly.
- The next plan can wire room resolution and invite lifecycle onto this hub contract without duplicating catalog logic.

---
*Phase: 03-hub-room-expansion-framework*
*Completed: 2026-04-22*
