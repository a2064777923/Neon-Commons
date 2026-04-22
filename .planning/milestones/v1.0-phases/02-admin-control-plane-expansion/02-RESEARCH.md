# Phase 2: Admin Control Plane Expansion - Research

**Researched:** 2026-04-22
**Domain:** Structured admin capability controls for a split Next.js frontend and dedicated Node.js + Socket.IO backend
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

- Group the control surface by game family rather than raw storage buckets.
- Prioritize cross-game capability switches before deeper per-game runtime editors.
- Make the admin workflow toggle-first, not raw JSON-first.
- Apply capability/runtime changes to new rooms only; existing live rooms must not be mutated in place.
- Keep guardrails lightweight: basic trace logging is required, but heavy approval or rollback workflows are out of scope.

Derived project constraints from `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, and `AGENTS.md`:
- Keep the frontend/backend split intact; new admin APIs belong under `backend/handlers/admin/**`, not `pages/api/**`.
- Preserve the shipped room-number join flow and single-node in-memory room managers.
- Treat the current admin/player/template/config surface as the brownfield baseline to extend, not replace wholesale.
- Run the smallest relevant verification for each change and expand coverage when admin/runtime behavior changes.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Capability and runtime schema definition | Shared backend module | PostgreSQL | The control-plane contract should live in code, while persisted values remain in `system_configs`. |
| Admin mutation APIs | API/Backend | Shared contract layer | `backend/handlers/admin/**` already owns explicit admin mutations and `lib/shared/network-contract.js` exposes their paths. |
| New-room-only enforcement | API/Backend | In-memory room managers | Existing room managers snapshot config at room creation time, so enforcement belongs in create handlers rather than by mutating live room objects. |
| Game-family grouping and operator workflow | Browser/Admin UI | Shared backend schema | The admin page should render grouped family controls from structured backend responses instead of inferring them from raw JSON blobs. |
| Audit traceability | Database + API/Backend | Admin UI | `admin_logs` already exists; Phase 2 should standardize payloads and expose a lightweight read surface rather than relying on direct DB inspection. |
</architectural_responsibility_map>

<research_summary>
## Summary

The codebase already has the right building blocks for a Phase 2 control plane, but they are fragmented. Dou Dizhu templates live in `room_templates`, generic runtime values live in `system_configs`, party/board room defaults are hardcoded in `lib/games/catalog.js`, and the admin UI still edits templates/config through raw JSON textareas. This means operators can mutate state, but not through a structured, expansion-ready surface.

Three findings matter most for planning:

1. **The backend already enforces room settings at creation time.** Card rooms snapshot template settings in `lib/game/room-manager.js`; party and board rooms normalize config inside their managers during `createRoom(...)`. This fits the user requirement that changes affect new rooms only.
2. **Cross-game capability state has no shared schema yet.** Dou Dizhu is template-backed, while Werewolf/Avalon/Gomoku/Chinese Checkers pull defaults from `lib/games/catalog.js`. Without a shared control-plane module, admin endpoints would keep reimplementing validation and family grouping ad hoc.
3. **The current admin page is operationally useful but not scalable.** `pages/admin/index.js` already loads players, templates, and configs through shared API helpers, yet the primary mutation affordance is still JSON blobs. That conflicts directly with the user's request for a grouped toggle console.

**Primary recommendation:** Introduce a shared control-plane backend module backed by explicit `/api/admin/capabilities`, `/api/admin/runtime`, and `/api/admin/logs` handlers, then rebuild the admin page around grouped game-family controls and a lightweight audit feed.
</research_summary>

<current_state_audit>
## Current State Audit

### What is already working

- `pages/admin/index.js` already authenticates through shared API helpers and displays operator, player, template, and config data in one console.
- `backend/handlers/admin/players/index.js`, `backend/handlers/admin/players/[id]/adjust.js`, `backend/handlers/admin/templates/index.js`, and `backend/handlers/admin/config/index.js` already establish the explicit admin-handler pattern required by the roadmap.
- `admin_logs` already captures player/template/config mutations with operator IDs, so audit plumbing exists even though the payloads are inconsistent.
- Card, party, and board room creation all happen through dedicated backend handlers, which is the correct enforcement point for new-room-only gating.

### Gaps that block safe expansion

- There is no shared backend schema that says which game families and game keys are controllable, what defaults they use, or which runtime keys are allowed.
- `maxOpenRoomsPerUser` is fetched independently in three room-create handlers; there is no shared runtime-control accessor yet.
- `maintenanceMode` and `allowPublicRoomList` are seeded in `lib/defaults.js`, but Phase 2 cannot blindly enforce every existing config key because some of them would affect live discovery immediately and violate the user's new-room-only rule.
- Party and board rooms have no admin-managed capability gate today; only Dou Dizhu templates can be disabled.
- The admin UI leads with raw JSON textareas, which makes it easy to bypass structure, validation, and family grouping.
- There is no explicit read API for recent admin log history, so "leave a trace" still effectively requires DB inspection.
</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Create a shared control-plane schema module

Add a backend/shared module such as `lib/admin/control-plane.js` that:
- defines the supported game keys: `doudezhu`, `werewolf`, `avalon`, `gomoku`, `chinesecheckers`
- maps each game key to a family: `card`, `party`, `board`
- persists capability toggles in `system_configs.key = 'gameCapabilities'`
- persists runtime controls in `system_configs.key = 'runtimeControls'`
- allowlists Phase 2 runtime keys to values that only affect future room creation, specifically `maxOpenRoomsPerUser` and `maintenanceMode`

This module should merge defaults from `lib/defaults.js` and `lib/games/catalog.js`, validate updates, and generate consistent before/after payloads for `admin_logs`.

### 2. Add explicit admin APIs for capability and runtime updates

Extend `lib/shared/network-contract.js` and add:
- `GET/PATCH /api/admin/capabilities`
- `GET/PATCH /api/admin/runtime`
- `GET /api/admin/logs`

Use batch update payloads so the UI can toggle several items without inventing ad hoc JSON:
- capabilities: `{ updates: [{ gameKey: "werewolf", enabled: false, reason: "..." }] }`
- runtime: `{ updates: [{ key: "maxOpenRoomsPerUser", value: 5, reason: "..." }] }`

### 3. Enforce controls only on future room creation

Phase 2 should apply capability/runtime checks in the `POST` create handlers:
- `backend/handlers/rooms/index.js`
- `backend/handlers/party/rooms/index.js`
- `backend/handlers/board/rooms/index.js`

Do **not** mutate live room objects in `lib/game/room-manager.js`, `lib/party/manager.js`, or `lib/board/manager.js`. Existing rooms should remain playable after a toggle changes. This is the cleanest fit for the user's "new rooms only" decision.

### 4. Rebuild the admin console around grouped family controls

The admin page should load structured capability/runtime responses and render:
- a `card` family section for Dou Dizhu
- a `party` family section for Werewolf and Avalon
- a `board` family section for Gomoku and Chinese Checkers
- a runtime section for `maxOpenRoomsPerUser` and `maintenanceMode`
- the existing player quick actions as a retained secondary section

Raw JSON editing can remain only as a clearly de-emphasized expert fallback, or be removed entirely. It should not stay the primary control path.

### 5. Keep audit coverage lightweight but visible

Standardize `admin_logs.detail` payloads so capability, runtime, and player changes all capture:
- `scope`
- `target`
- `before`
- `after`
- `reason`
- `appliesTo`

Expose recent logs through `GET /api/admin/logs` and render a small "recent changes" feed in the admin UI. This satisfies the user's traceability requirement without introducing approvals or rollback mechanics.
</recommended_direction>

## Validation Architecture

### Fast feedback

- `npm run check`
- `node --test test-logic/admin-control-plane.test.js`

### Wave-level validation

- `node --test test-logic/ddz-logic.test.js test-logic/backend-contract.test.js test-logic/client-network-contract.test.js test-logic/admin-control-plane.test.js`

### High-risk smoke validation

- `npx playwright test tests/admin-console.spec.js --workers=1`

### Expected artifacts

- `lib/admin/control-plane.js` with a shared capability/runtime schema
- explicit admin handlers for capabilities, runtime controls, and recent logs
- a grouped admin console with new-room-only messaging
- `test-logic/admin-control-plane.test.js` for backend/admin contract coverage
- `tests/admin-console.spec.js` for operator workflow smoke coverage

## Open Questions

1. **Should the old raw JSON admin endpoints remain callable after the structured control plane lands?**
   - What we know: the user does not want raw JSON as the primary UI workflow.
   - Recommendation: keep legacy template/config endpoints temporarily for compatibility, but move the UI to the structured handlers immediately and do not expand the raw JSON surface further.

2. **Should `allowPublicRoomList` become a Phase 2 runtime control?**
   - What we know: it already exists in `lib/defaults.js`, but enforcing it would immediately alter discovery of existing public rooms and conflict with the user's "new rooms only" rule.
   - Recommendation: defer enforcement of `allowPublicRoomList` until a later phase that explicitly handles live discovery semantics.

3. **Is a recent-changes feed enough for audit, or does the operator also need export/filter features now?**
   - What we know: the user asked for lightweight traceability only.
   - Recommendation: Phase 2 should stop at a recent-changes list plus a simple read endpoint; filtering/export can wait until there is real operator demand.

<sources>
## Sources

### Primary (HIGH confidence)
- `pages/admin/index.js` - current admin workflow and raw JSON mutation surface
- `backend/handlers/admin/players/index.js` - existing player listing surface
- `backend/handlers/admin/players/[id]/adjust.js` - current player mutation and audit pattern
- `backend/handlers/admin/templates/index.js` - template mutation surface
- `backend/handlers/admin/config/index.js` - current runtime config mutation surface
- `backend/handlers/rooms/index.js` - Dou Dizhu create/list enforcement point
- `backend/handlers/party/rooms/index.js` - party-room create/list enforcement point
- `backend/handlers/board/rooms/index.js` - board-room create/list enforcement point
- `lib/game/room-manager.js` - Dou Dizhu room snapshot behavior
- `lib/party/manager.js` - party-room snapshot behavior
- `lib/board/manager.js` - board-room snapshot behavior
- `lib/games/catalog.js` - current party/board defaults and family inventory
- `lib/defaults.js` - seeded system config and Dou Dizhu templates
- `lib/db.js` - `room_templates`, `system_configs`, and `admin_logs` schema

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/phases/02-admin-control-plane-expansion/02-CONTEXT.md`
- `AGENTS.md`
</sources>
