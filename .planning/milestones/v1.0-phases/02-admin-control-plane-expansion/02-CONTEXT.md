# Phase 2: Admin Control Plane Expansion - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the admin/backend operating surface so operators can control live game capability through explicit backend handlers and a structured admin console, without falling back to direct database edits. The first implementation pass should prioritize cross-game capability switches that prepare the platform for more game-family expansion later, while still preserving room/player control work already inside Phase 2.

</domain>

<decisions>
## Implementation Decisions

### Control Surface Structure
- **D-01:** Organize the admin control plane by game family so operators can reason about capability state in terms of Dou Dizhu, party games, board games, and future game families instead of raw config buckets.
- **D-02:** The Phase 2 control experience should be a switch/toggle-first control panel, not a raw JSON-first workflow.

### Capability Rollout Scope
- **D-03:** Prioritize cross-game capability switches before deeper per-game room/runtime editors in the first Phase 2 pass.
- **D-04:** The control model should leave room for additional game families and more interesting games in later phases, but those future games are not part of Phase 2 scope.

### Runtime Effect Model
- **D-05:** Admin config/capability changes should apply only to newly created rooms.
- **D-06:** Existing live rooms must keep running with the settings they were created with; Phase 2 must not mutate already-open room state.

### Guardrails and Audit
- **D-07:** Keep audit coverage lightweight: log admin changes for traceability, but do not introduce approval flows, rollback workflows, or other heavy operational gates in this phase.

### Player and Runtime Controls
- **D-08:** Phase 2 still needs explicit admin/backend controls for runtime/player adjustments required by expansion work, but the UX priority is capability toggles first and deeper adjustment workflows can follow that structure.

### the agent's Discretion
- Exact toggle grouping, labels, helper text, and panel density inside the admin console.
- Whether to preserve a limited expert-oriented fallback for advanced editing, as long as the primary workflow remains structured toggles rather than raw JSON.
- How to model cross-game switches internally across config keys, template metadata, or dedicated capability records, provided the API stays explicit and the room effect remains new-room-only.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and requirement boundary
- `.planning/PROJECT.md` — Product baseline, brownfield constraints, and milestone direction for backend/admin expansion.
- `.planning/REQUIREMENTS.md` — `ADMIN-01` and `ADMIN-02` define the Phase 2 requirement contract.
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and plan breakdown.
- `.planning/STATE.md` — Current milestone position and recent Phase 1 completion context.

### Codebase architecture references
- `.planning/codebase/ARCHITECTURE.md` — Split frontend/backend architecture and backend ownership constraints.
- `.planning/codebase/STACK.md` — Runtime stack and verification commands for admin/backend changes.
- `.planning/codebase/STRUCTURE.md` — Relevant frontend/backend file layout for adding explicit admin handlers and UI.

### Existing admin surface and backend contract
- `pages/admin/index.js` — Current admin console shape, existing data loads, and raw JSON editing workflow that Phase 2 should evolve.
- `backend/handlers/admin/players/index.js` — Existing explicit admin player listing handler.
- `backend/handlers/admin/players/[id]/adjust.js` — Existing player adjustment and admin logging pattern.
- `backend/handlers/admin/templates/index.js` — Existing admin template list/create/update handler and template logging pattern.
- `backend/handlers/admin/config/index.js` — Existing admin config list/update handler and config logging pattern.

### Persistence and defaults
- `lib/db.js` — `room_templates`, `system_configs`, and `admin_logs` persistence model that Phase 2 builds on.
- `lib/defaults.js` — Seed template metadata and default system config shape that show current capability/config coverage.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pages/admin/index.js`: Already loads admin identity, player list, templates, and system configs through shared API route helpers; this is the baseline console to extend rather than replace.
- `backend/handlers/admin/templates/index.js`: Demonstrates the explicit handler pattern for listing and mutating capability-bearing template records.
- `backend/handlers/admin/config/index.js`: Demonstrates the explicit handler pattern for reading and updating system-wide config entries.
- `backend/handlers/admin/players/[id]/adjust.js`: Already provides a safe player adjustment path plus admin log insertion that can inform other admin-side mutations.
- `lib/defaults.js`: Shows the current default config/template inventory that can be normalized into structured cross-game capability switches.

### Established Patterns
- Admin/backend changes are exposed through dedicated backend handlers with `createHandlerContract(...)`, not `pages/api` routes.
- Audit behavior is currently lightweight and append-only through `admin_logs`, matching the user's preference for traceability without a heavy approval layer.
- Template/config state is persisted in PostgreSQL and read through explicit queries, while active room state remains memory-resident; this reinforces the new-room-only effect model.

### Integration Points
- New admin control APIs should land under `backend/handlers/admin/**` and flow through the shared client route/config layer already used by `pages/admin/index.js`.
- New capability toggles will likely connect `room_templates` and/or `system_configs` to room creation flows that snapshot config at creation time.
- Admin UI changes should extend the existing admin console rather than introduce a separate control-plane app.

</code_context>

<specifics>
## Specific Ideas

- Group controls by game family.
- Make the admin console a switch/toggle-style control panel.
- Handle cross-game switches first before deeper per-game parameter editors.
- Apply capability/config changes only to newly created rooms.

</specifics>

<deferred>
## Deferred Ideas

- Add more interesting/new games later — capture as future roadmap or backlog work, not Phase 2 scope.
- Deep per-game room/runtime editors beyond the first cross-game switch pass — keep for later work inside or after the remaining Phase 2 plans once the capability foundation exists.

</deferred>

---

*Phase: 02-admin-control-plane-expansion*
*Context gathered: 2026-04-22*
