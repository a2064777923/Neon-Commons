# Phase 2: Admin Control Plane Expansion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 2-Admin Control Plane Expansion
**Areas discussed:** control surface structure, rollout priority, admin interaction style, config effect timing, audit depth

---

## Control Surface Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Group by resource type | Separate templates, configs, and player/runtime tools as standalone buckets | |
| Group by game family | Organize controls around game families and their capability switches | ✓ |
| Keep current mixed layout | Extend the existing page without a stronger grouping model | |

**User's choice:** Group by game family.
**Notes:** The user wants the admin surface to scale toward more games, so the grouping model should match how operators think about game capability rather than raw storage primitives.

---

## Rollout Priority

| Option | Description | Selected |
|--------|-------------|----------|
| Cross-game switches first | Build shared capability gates before deeper per-game editors | ✓ |
| Per-game parameters first | Start with detailed room/runtime controls for specific games | |
| Ship both equally in first pass | Split initial effort evenly across both surfaces | |

**User's choice:** Cross-game switches first.
**Notes:** The user still wants both cross-game and per-game control eventually, but the first implementation pass should establish the shared switch layer first.

---

## Admin Interaction Style

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle-first console | Structured switches and direct controls are the primary workflow | ✓ |
| Raw JSON editor | Keep JSON editing as the primary admin interaction mode | |
| Mixed editor-first mode | JSON remains central with a few helper controls layered on top | |

**User's choice:** Toggle-first console.
**Notes:** The user explicitly asked for a switch-style control panel instead of a raw JSON-centered admin experience.

---

## Config Effect Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Affect new rooms only | Capability/config changes apply when rooms are created after the change | ✓ |
| Affect live rooms immediately | Update currently open rooms in place | |
| Mixed policy by feature | Some settings update live, some wait for new rooms | |

**User's choice:** Affect new rooms only.
**Notes:** Existing live rooms should keep their current behavior; phase work should not mutate already-open room state.

---

## Audit Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Lightweight logs | Keep simple change history without extra approval/rollback layers | ✓ |
| Approval workflow | Require explicit review before capability changes go live | |
| Full rollback console | Add operator rollback tooling as part of the first control-plane pass | |

**User's choice:** Lightweight logs.
**Notes:** The user only wants traceability for now. Heavy operational gates are intentionally deferred.

---

## the agent's Discretion

- Exact toggle layout, naming, grouping density, and helper text.
- Whether to keep a limited advanced-edit escape hatch behind the structured control surface.
- Internal backend representation of cross-game switches, as long as the external control model stays explicit and new-room-only.

## Deferred Ideas

- Add more interesting/new games in future phases.
- Revisit deeper per-game parameter editors after the cross-game switch foundation is in place.
