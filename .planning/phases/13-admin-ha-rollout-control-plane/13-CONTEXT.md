# Phase 13: Admin HA & Rollout Control Plane - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Expand the existing backend-owned admin surface so operators can inspect realtime, room-entry, and voice health without shell access, manage Wave 2 rollout and availability without code edits, and audit those interventions in one place. This phase extends the shipped admin console and `/api/admin/*` contract; it does not introduce multi-node room migration, a full observability platform, or a new media stack.

</domain>

<decisions>
## Implementation Decisions

### Health Snapshot And Diagnostics
- **D-01:** The admin experience should open with a backend-computed health snapshot that rolls room-entry, realtime, voice, and rollout state into one operator summary before room-level drill-down.
- **D-02:** Health inspection should stay shell-free and opinionated: operators need state labels, reason copy, last-transition timing, affected scope, and impacted room/player counts rather than raw host metrics or low-level protocol traces.
- **D-03:** Voice diagnostics exposed to operators must reuse the same degraded and recovery vocabulary already shown in room UIs so operator triage and player messaging cannot drift.

### Rollout State And Launch Control
- **D-04:** Wave 2 rollout should be controlled per title from the existing admin surface, not only by family-wide switches and not by code edits.
- **D-05:** Rollout controls should map onto the shared discovery states already understood by hub and admin flows (`coming-soon`, `paused-new-rooms`, `playable`) instead of inventing a second rollout vocabulary.
- **D-06:** Default rollout posture for unfinished or risky titles stays fail-closed: discovery can be staged first, but new rooms only open when a title is explicitly set to a playable state and the existing availability checks remain healthy.

### Audit Trail And Operator Safety
- **D-07:** Degraded-mode changes, rollout edits, runtime toggles, and voice interventions should appear in one recent-change trail with operator, scope, before/after summary, reason, and timestamp.
- **D-08:** The audit surface should stay lightweight and review-oriented in this phase. Rollback, approvals, and long-retention analytics are out of scope.
- **D-09:** Global and family controls should clearly label blast radius (`new-rooms-only`, family-scoped, global), while explicit live-room interventions remain separate room actions.
- **D-10:** Extend the existing admin console as one coherent operations surface instead of splitting health, rollout, and audit into separate standalone tools first.

### the agent's Discretion
- Exact admin page layout, section ordering, and polling cadence are open as long as health, rollout, and audit remain part of one coherent surface.
- Planner may decide whether rollout persistence lives beside existing capability state or in a dedicated config key, as long as the source of truth stays backend-owned and audited.
- Exact diagnostic field set is flexible, but admin payloads must not expose raw ICE/TURN credentials or other low-level secrets.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Contract
- `.planning/PROJECT.md` — Product baseline, brownfield constraints, and v1.2 goal to expand backend/admin operating leverage.
- `.planning/ROADMAP.md` — Phase 13 goal, success criteria, and the downstream Wave 2 phases that will consume rollout and availability contracts.
- `.planning/REQUIREMENTS.md` — `AVAIL-02`, `ADMIN-01`, and `ADMIN-02`, plus v1.2 out-of-scope guardrails.

### Existing Availability And Voice Baseline
- `.planning/phases/11-availability-signals-degraded-modes/11-02-SUMMARY.md` — Shipped degraded-mode editing, shared vocabulary, and admin runtime audit behavior.
- `.planning/phases/11-availability-signals-degraded-modes/11-SECURITY.md` — Constraints around `/api/admin/runtime`, degraded controls, audit metadata, and split-runtime truth.
- `.planning/phases/12-voice-reliability-foundation/12-CONTEXT.md` — Locked voice fallback and recovery behavior that admin diagnostics must surface truthfully.
- `.planning/phases/12-voice-reliability-foundation/12-UAT.md` — Accepted expectations for degraded voice, relay fallback, and muted recovery behavior.

### Architecture And API Contract
- `docs/architecture/backend-contract.md` — Canonical backend-owned `/api/admin/*` contract and deployed `3100/3101` runtime boundary.
- `docs/architecture/system-architecture.md` — Split frontend/backend layering and the contract points admin code must extend.
- `docs/api/api-reference.md` — Current admin endpoints and release/verification entry points that Phase 13 must deepen without breaking.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pages/admin/index.js` — Existing admin surface with runtime controls, degraded-mode editing, live-room inspection, and recent-change UI that Phase 13 should extend instead of replacing.
- `backend/handlers/admin/runtime/index.js` — Backend-owned GET/PATCH runtime surface that already persists runtime and availability controls; natural insertion point for health and voice diagnostics payloads.
- `backend/handlers/admin/capabilities/index.js` — Current capability grouping and per-title toggles; the closest existing rollout-control surface.
- `lib/admin/control-plane.js` — Persistence, normalization, discovery-state helpers, and admin log writes for capability/runtime changes.
- `lib/admin/live-room-ops.js` — Shared live-room summaries/detail serialization, including runtime health counts and room actions.
- `lib/shared/availability.js` — Shared subsystem/state/safe-action vocabulary that already keeps degraded state separate from room availability truth.
- `test-logic/admin-control-plane.test.js` and `tests/admin-console.spec.js` — Existing regression base for admin handlers and console workflows.

### Established Patterns
- Backend owns `/api/admin/*`; the frontend admin page hydrates through shared client helpers rather than page-local APIs.
- Admin logs are lightweight, append-only, and recent-first; the current UX surfaces the latest changes instead of a rollback workflow.
- Room availability truth (`live`, `snapshot-only`, `draining`, `closed`) stays separate from degraded subsystem state (`healthy`, `degraded`, `blocked`).
- Discovery state already supports truthful staged exposure through `coming-soon`, `paused-new-rooms`, and `playable`.

### Integration Points
- `backend/handlers/admin/runtime/index.js` and `lib/admin/control-plane.js` for health snapshot fields, persisted rollout state, and unified audit writes.
- `backend/handlers/admin/capabilities/index.js` plus hub/entry consumers for rollout state that must stay consistent with discovery surfaces.
- `lib/admin/live-room-ops.js`, `lib/party/manager.js`, and room serializers for live room health, voice diagnostics, and affected-room counts.
- `pages/admin/index.js` for one-screen operator workflows, rollout editing, and audit review.

</code_context>

<specifics>
## Specific Ideas

- Operators should be able to answer "what is unhealthy, how many rooms or players are affected, and what can I safely do now?" without shell access.
- Wave 2 rollout should be staged truthfully through the same discovery language players see, not through hard-coded release edits.
- Voice health in admin should describe room-facing truth and recovery posture, not raw ICE/TURN internals.

</specifics>

<deferred>
## Deferred Ideas

- Full time-series observability, charts, alerting, and external telemetry dashboards remain outside this phase.
- Approval chains and rollback workflows for admin changes remain outside this phase.
- Full multi-node room recovery and live room migration remain deferred beyond v1.2.

</deferred>

---

*Phase: 13-admin-ha-rollout-control-plane*
*Context gathered: 2026-04-24*
