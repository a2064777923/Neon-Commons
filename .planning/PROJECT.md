# Hong's Neon-Commons

## What This Is

Hong's Neon-Commons is a browser-based real-time party arcade that now ships a separated frontend/backend runtime with live Dou Dizhu, Werewolf, Avalon, Gomoku, Chinese Checkers, Reversi, Undercover, and Sokoban experiences plus admin tooling.

The product is brownfield. New work should treat the shipped gameplay, admin, and release-verification surface as the compatibility baseline instead of reopening foundational architecture decisions without a clear reason.

## Current State

### Shipped in v1.0

- Unified hub and room-entry flow across shipped room-based families
- Dedicated backend contract on `backend/server.js` and `backend/router.js`
- Shared browser runtime contract for REST and Socket.IO targets
- Admin control plane for capabilities, runtime controls, templates, logs, and player adjustments
- Wave 1 shipped titles: Sokoban, Reversi, Undercover
- Expanded Dou Dizhu, Werewolf, Avalon, Gomoku, and Chinese Checkers behavior
- Canonical deployed-stack verification on `3100/3101`

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

## Core Value

Players can jump from the hub into stable real-time social game rooms with as little friction as possible.

## Current Milestone: v1.1 Live Ops & Reliability

**Goal:** Deepen live room operations and single-node recovery so players survive transient disconnects and operators can manage active rooms without database edits or stack-wide restarts.

**Target features:**

- Recover player and guest sessions after refresh/disconnect through the shared room-entry contract
- Expose live room directory, room health, and safe intervention tools in the admin surface
- Add single-node room snapshot/expiry guardrails plus release verification for recovery and live-ops workflows

## Constraints

- Preserve the split frontend/backend architecture
- Keep `/api/*` and `/socket.io/*` owned by the dedicated backend
- Protect the unified hub, room-number join flow, and live Socket.IO room behavior
- Treat the current release gate and docs as part of the shipped contract

## Deferred Work

- Distributed room-state recovery beyond one process
- TURN / SFU voice infrastructure
- Native mobile clients
- Richer economy / monetization systems

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep the separated frontend/backend runtime in one repository | Preserves the new service boundary without adding multi-repo overhead | Validated in v1.0 |
| Treat shipped gameplay/admin flows as the compatibility baseline | The repo is brownfield and should expand incrementally | Validated in v1.0 |
| Prioritize game/backend/admin expansion over another platform rewrite | Matches the actual delivered surface and remaining opportunity | Still active |
| Defer distributed room-state infrastructure until later | Current milestone proved feature and verification depth mattered more than scaling first | Still deferred |
| Start v1.1 with live ops and single-node reliability instead of another content wave | The shipped game surface is broad enough that operational depth is the current limiting factor | Pending validation |

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

- **v1.0 shipped on 2026-04-22**: backend contract hardening, admin control plane expansion, hub and room-entry unification, Wave 1 new games, gameplay expansion, and release hardening

For detailed archived planning context, see [MILESTONES.md](./MILESTONES.md) and [v1.0 roadmap archive](./milestones/v1.0-ROADMAP.md).

---
*Last updated: 2026-04-22 after starting the v1.1 milestone*
