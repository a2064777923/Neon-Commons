# Hong's Neon-Commons

## What This Is

Hong's Neon-Commons is a browser-based real-time party arcade with a separated frontend/backend runtime, shipped live games across card, party, board, and solo families, recovery-aware room flows, live-room operator tooling, and a deployed-stack release contract on `3100/3101`.

The product is brownfield. New work should treat the shipped gameplay, admin, and release-verification surface as the compatibility baseline instead of reopening foundational architecture decisions without a clear reason.

## Current State

### Shipped Through v1.0

- Unified hub and room-entry flow across shipped room-based families
- Dedicated backend contract on `backend/server.js` and `backend/router.js`
- Shared browser runtime contract for REST and Socket.IO targets
- Admin control plane for capabilities, runtime controls, templates, logs, and player adjustments
- Wave 1 shipped titles: Sokoban, Reversi, Undercover
- Expanded Dou Dizhu, Werewolf, Avalon, Gomoku, and Chinese Checkers behavior
- Canonical deployed-stack verification on `3100/3101`

### Shipped in v1.1

- Player and guest recovery across eligible room families with `connected` / `reconnecting` / `disconnected` presence states
- Single-node room-directory snapshot persistence, stale-room expiry, and `snapshot-only` discovery/entry behavior
- Admin live-room directory, room detail, drain, close, and occupant removal workflows with audit coverage
- Canonical release verification that proves live-ops and recovery behavior, plus narrow helper reruns for diagnosis

### Runtime Shape

- Frontend: Next.js on `3100`
- Backend: Node.js + Socket.IO on `3101`
- Persistence: PostgreSQL
- Active room state: single-node, in-memory

### Release Contract

The canonical pre-ship flow is:

```bash
npm run deploy:3100
npm run verify:release
```

Diagnostic reruns for live-ops and recovery issues:

```bash
npm run test:logic:liveops
FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:liveops
```

## Core Value

Players can jump from the hub into stable real-time social game rooms with as little friction as possible.

## Current Milestone: v1.2 大跃进

**Goal:** Push the platform toward higher availability while shipping a second wave of games, more reliable voice, and stronger backend/admin operating leverage.

**Target features:**

- Ship Wave 2 new games through the shared hub, room-entry, recovery, and rollout contract
- Improve party-room voice reliability with fallback transport, reconnect handling, and clearer degraded-state signaling
- Expand the backend/admin surface for health visibility, degraded modes, rollout control, and auditability

<details>
<summary>Archived v1.1 milestone framing</summary>

**Goal:** Deepen live room operations and single-node recovery so players survive transient disconnects and operators can manage active rooms without database edits or stack-wide restarts.

**Target features:**

- Recover player and guest sessions after refresh/disconnect through the shared room-entry contract
- Expose live room directory, room health, and safe intervention tools in the admin surface
- Add single-node room snapshot/expiry guardrails plus release verification for recovery and live-ops workflows

</details>

## Constraints

- Preserve the split frontend/backend architecture
- Keep `/api/*` and `/socket.io/*` owned by the dedicated backend
- Protect the unified hub, room-number join flow, and live Socket.IO room behavior
- Treat the current release gate and docs as part of the shipped contract
- Move toward higher availability incrementally; do not fake full multi-node room recovery before the runtime contract is ready

## Deferred Work

- Full multi-node room-state recovery and live room migration
- Dedicated SFU-grade media architecture beyond fallback voice reliability
- Native mobile clients
- Richer economy / monetization systems

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep the separated frontend/backend runtime in one repository | Preserves the service boundary without adding multi-repo overhead | Validated in v1.0 |
| Treat shipped gameplay/admin flows as the compatibility baseline | The repo is brownfield and should expand incrementally | Validated in v1.0 |
| Prioritize game/backend/admin expansion over another platform rewrite | Matches the delivered surface and remaining opportunity | Still active |
| Defer distributed room-state infrastructure until later | Feature and verification depth mattered more than scaling first | Still deferred |
| Start v1.1 with live ops and single-node reliability instead of another content wave | The shipped game surface was broad enough that operational depth became the limiting factor | Validated in v1.1 |
| Expose `snapshot-only` as an explicit availability state across hub and room-entry flows | Restart recovery should stay visible without pretending a room is fully live | Validated in v1.1 |
| Keep `npm run verify:release` as the single canonical pre-ship command | Operators need one stable release habit even as diagnostics widen | Validated in v1.1 |
| Push v1.2 toward higher availability through degraded-mode and voice hardening before full multi-node recovery | The next safe step is to improve resilience and operator control without overstating runtime guarantees | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check -> still the right priority?
3. Audit Out of Scope -> reasons still valid?
4. Update Context with current state (users, feedback, metrics)

## Milestone History

- **v1.1 shipped on 2026-04-23**: session recovery, host-visible presence, snapshot-only restart recovery, stale-room expiry, live-room operator tooling, and release verification for live ops
- **v1.0 shipped on 2026-04-22**: backend contract hardening, admin control plane expansion, hub and room-entry unification, Wave 1 new games, gameplay expansion, and release hardening

For detailed archived planning context, see [MILESTONES.md](./MILESTONES.md), [v1.1 roadmap archive](./milestones/v1.1-ROADMAP.md), and [v1.0 roadmap archive](./milestones/v1.0-ROADMAP.md).

---
*Last updated: 2026-04-23 after starting the v1.2 milestone*
