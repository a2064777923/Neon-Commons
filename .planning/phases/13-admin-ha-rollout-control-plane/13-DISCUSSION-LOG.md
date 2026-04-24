# Phase 13: Admin HA & Rollout Control Plane - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `13-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 13-admin-ha-rollout-control-plane
**Areas discussed:** operational health view, rollout granularity and states, audit trail detail, default blast radius, admin surface shape
**Mode:** Auto-selected recommended defaults while executing `$gsd-next` because interactive question UI was unavailable in this execution mode.

---

## Operational Health View

| Option | Description | Selected |
|--------|-------------|----------|
| Summary-first with drill-down | Start with one backend-computed health snapshot, then let operators inspect affected scopes and rooms. | Yes |
| Raw endpoint dump | Expose mostly unopinionated payloads and logs, leaving operators to infer state manually. | No |
| Separate specialized pages | Split health, rollout, and diagnostics into separate tools before improving the main admin surface. | No |
| Other | Freeform alternative. | No |

### Questions Asked

1. **How should operators consume realtime, room-entry, and voice health?**
   - Presented options: summary-first with drill-down / raw endpoint dump / separate specialized pages / other
   - Auto-selected fallback: `1`

### Outcome

- Health should open with a backend-computed operator summary.
- Operators can drill down into affected scopes and rooms without needing shell access.

---

## Rollout Granularity And States

| Option | Description | Selected |
|--------|-------------|----------|
| Per-title staged rollout using shared discovery states | Let operators control each Wave 2 title through the same truthful states used by hub and admin surfaces. | Yes |
| Family-wide rollout only | Manage rollout only at the family level, even when titles need independent launch timing. | No |
| Binary launch toggle only | Use a single on/off release switch without staged visibility or paused-new-room states. | No |
| Other | Freeform alternative. | No |

### Questions Asked

1. **How should Wave 2 rollout be controlled from admin?**
   - Presented options: per-title staged rollout using shared discovery states / family-wide rollout only / binary launch toggle only / other
   - Auto-selected fallback: `1`

### Outcome

- Rollout should be controlled per title.
- Shared discovery states such as `coming-soon`, `paused-new-rooms`, and `playable` stay the truth across hub and admin.

---

## Audit Trail Detail

| Option | Description | Selected |
|--------|-------------|----------|
| Unified lightweight audit trail | Keep one recent-change feed with operator, scope, before/after, reason, and timestamp. | Yes |
| Full approval and rollback workflow | Add approval gates, change review, and rollback controls inside this phase. | No |
| Minimal action names only | Record only terse actions without before/after detail or reasoning. | No |
| Other | Freeform alternative. | No |

### Questions Asked

1. **How much audit detail should admin changes carry in this phase?**
   - Presented options: unified lightweight audit trail / full approval and rollback workflow / minimal action names only / other
   - Auto-selected fallback: `1`

### Outcome

- One recent-change trail should cover degraded mode, rollout, runtime, and voice interventions.
- The trail stays lightweight and review-oriented; rollback and approvals remain out of scope.

---

## Default Blast Radius

| Option | Description | Selected |
|--------|-------------|----------|
| Safe-by-default with explicit scope labels | Global and family controls clearly state blast radius, while live-room interventions stay separate and explicit. | Yes |
| Immediate live mutation by default | Let most controls affect active rooms and players immediately without strong scope cues. | No |
| Mixed hidden behavior | Allow different blast radii per control without making the scope obvious in the UI. | No |
| Other | Freeform alternative. | No |

### Questions Asked

1. **What should risky admin controls affect by default?**
   - Presented options: safe-by-default with explicit scope labels / immediate live mutation by default / mixed hidden behavior / other
   - Auto-selected fallback: `1`

### Outcome

- Global and family controls should clearly label whether they affect new rooms only, a family, or the whole runtime.
- Explicit live-room actions remain separate tools instead of being hidden inside rollout or health toggles.

---

## Admin Surface Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the existing admin console | Keep health, rollout, and audit in one coherent backend-owned operations surface. | Yes |
| Build a separate HA console | Create a second standalone operations tool for these workflows. | No |
| Prefer CLI or shell workflows | Keep the browser admin light and rely on shell access for real operations. | No |
| Other | Freeform alternative. | No |

### Questions Asked

1. **Where should these new operator workflows live?**
   - Presented options: extend the existing admin console / build a separate HA console / prefer CLI or shell workflows / other
   - Auto-selected fallback: `1`

### Outcome

- Phase 13 should deepen the existing admin console instead of forking a second operations tool.
- The admin surface stays backend-owned and shell-free for normal operator work.

---

## the agent's Discretion

- Exact admin section layout and polling cadence.
- Exact persistence shape for rollout state.
- Exact diagnostic field set, as long as low-level secrets stay hidden.

## Deferred Ideas

- Full observability dashboards with charts and alerts.
- Approval and rollback workflows for admin changes.
- Multi-node room migration and recovery.
