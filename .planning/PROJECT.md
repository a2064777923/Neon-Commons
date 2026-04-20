# Hong's Neon-Commons

## What This Is

Hong's Neon-Commons is a browser-based party arcade that already ships real-time Dou Dizhu, Werewolf, Avalon, Gomoku, and Chinese Checkers rooms with login, profiles, leaderboard, and admin tooling. It is aimed at friend groups who want fast room-based social play and operators who need lightweight backend control over live game behavior.

The codebase is brownfield and now runs as a separated frontend/backend stack in one repository: a Next.js frontend on top of a dedicated Node.js API + Socket.IO backend with PostgreSQL persistence.

## Core Value

Players can jump from the hub into stable real-time social game rooms with as little friction as possible.

## Requirements

### Validated

- ✓ Player can register, log in, log out, and keep a session alive across page loads — existing
- ✓ Player can browse a unified game hub, personal profile, and leaderboard — existing
- ✓ Player can create and join room-number based Dou Dizhu, Werewolf, Avalon, Gomoku, and Chinese Checkers rooms — existing
- ✓ Player can play live synchronized matches through Socket.IO-backed room state — existing
- ✓ Party-room players can use browser voice signaling and WebRTC peer connections — existing
- ✓ Admin can manage players, room templates, and system configuration from the control surface — existing

### Active

- [ ] Continue expanding game functionality across the existing game families without regressing live play
- [ ] Continue expanding backend and admin capabilities so new game behavior is configurable and operable
- [ ] Keep the separated frontend/backend architecture coherent as the product grows
- [ ] Maintain enough automated coverage and documentation to ship expansions safely

### Out of Scope

- Native mobile apps — current product remains browser-first
- Multi-node / restart-safe room persistence — current milestone keeps the single-node in-memory room model
- Payments or real-money economy — not part of the current gameplay/backend expansion focus
- Dedicated TURN/SFU voice infrastructure — current voice stack remains browser P2P unless scale forces a change

## Context

- The repository already contains live game logic, admin flows, deployment docs, and a codebase map in `.planning/codebase/`.
- Frontend and backend were recently separated in-repo so future game/backend work no longer depends on `pages/api`.
- Current backend state is still memory-resident for active rooms, while persistent user/template/config/result data lives in PostgreSQL.
- The existing product already covers five game experiences, so new work should protect shipped behavior rather than re-platform the stack again.
- The user’s stated direction for this milestone is to continue expanding game functionality and backend capability, not to pivot products.

## Constraints

- **Tech stack**: Keep `Next.js + React` on the frontend and `Node.js + Socket.IO + PostgreSQL` on the backend — current production code already depends on this stack
- **Architecture**: Keep the dedicated backend service boundary intact — recent separation should be reinforced, not undone
- **Runtime model**: Active room state stays single-node and in-memory for now — full distributed state is explicitly deferred
- **Compatibility**: Preserve room-number join flow, unified hub entry, and current admin console expectations — these are already shipped behaviors
- **Voice**: Party voice stays browser `getUserMedia + WebRTC` with Socket.IO signaling — current implementation is already live
- **Quality**: Expansion work must remain verifiable by automated checks and build validation — the codebase is large enough that unguarded changes are risky

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Keep the separated frontend/backend runtime in one repository | Preserves the new service boundary without adding multi-repo overhead yet | — Pending |
| Treat current gameplay/admin flows as the validated baseline | This is a brownfield product and existing shipped capability must anchor planning | — Pending |
| Prioritize expanding current game families and backend/admin capability over another platform rewrite | This matches the user’s stated goal for the next milestone | — Pending |
| Defer distributed room-state infrastructure to a later milestone | Current scope is feature/backend growth, not horizontal scaling | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `$gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `$gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-20 after initialization*
