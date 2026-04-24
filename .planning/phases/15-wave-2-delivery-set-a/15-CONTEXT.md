# Phase 15: Wave 2 Delivery Set A - Context

**Gathered:** 2026-04-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship the first real Wave 2 room-based game runtime on top of the shared launch, room-entry, recovery, rollout, and release contract that is already in place. For this phase, the chosen title is `flyingchess`, delivered as a board-family game that players can discover, create, join, and recover through the existing shared surfaces. This phase does not introduce a separate party-room stack, a voice-first experience, or a second Wave 2 title.

</domain>

<decisions>
## Implementation Decisions

### Wave 2 Title Selection
- **D-01:** Phase 15 should ship `flyingchess` as the first Wave 2 title. `drawguess`, `uno`, `bowling`, and `miniracers` stay out of scope for this phase.
- **D-02:** `flyingchess` should launch through the existing board-family contract instead of inventing a special-case runtime or one-off room surface.

### Launch Completeness Boundary
- **D-03:** The first shipped version should be a classic complete launch, not a stripped-down MVP.
- **D-04:** The shipped ruleset must support standard `2-4` player Flying Chess with the core rule loop intact: dice roll, takeoff, collisions that send pieces back, jump/flight behavior, extra-roll moments where appropriate, exact finish into home, and match-end settlement.
- **D-05:** Phase 15 should prioritize getting the classic rules correct and fully playable before adding flashy extras, party variants, or polish-heavy expansion features.

### Room Experience Shape
- **D-06:** The title should behave as a light-party board room, not a voice-first party game.
- **D-07:** Keep the existing board-family room model: public or private room creation, room-number join, invite-link compatibility, and recovery-aware re-entry remain the default player path.
- **D-08:** The room should feel fast and social, but Phase 15 does not need to re-orient around aggressive public matchmaking loops or a bespoke private-party shell.

### the agent's Discretion
- Exact board art direction, piece styling, movement animation language, and room-page information hierarchy are open as long as the board-family shell remains consistent with shipped titles.
- Exact defaults for turn timer, default room size, and how room configuration choices are surfaced in the create-room UI are open for planning.
- Bot fill / AI support for `flyingchess` was not locked during discussion. Planner may include or defer it, as long as the human multiplayer core loop and shared room-entry/recovery path ship cleanly.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Contract
- `.planning/PROJECT.md` — Brownfield product baseline, v1.2 goal, and non-negotiable split-runtime constraints.
- `.planning/ROADMAP.md` — Phase 15 goal, success criteria, and the downstream relationship to Phase 16.
- `.planning/REQUIREMENTS.md` — `WAVE-02` plus the surrounding availability/admin constraints that the new title must inherit.
- `.planning/STATE.md` — Current milestone progress and the Phase 14 decisions that now gate Phase 15 delivery.

### Shared Wave 2 Launch Baseline
- `.planning/phases/14-wave-2-launch-contract/14-01-SUMMARY.md` — Backend-owned `launchContract` and fail-closed staging rules that Phase 15 now activates with a real runtime.
- `.planning/phases/14-wave-2-launch-contract/14-02-SUMMARY.md` — Frontend launch-contract consumption and browser coverage that must remain truthful once `flyingchess` becomes playable.
- `.planning/phases/14-wave-2-launch-contract/14-CONTEXT.md` — Phase boundary and guardrails for turning staged Wave 2 discovery into real runtime delivery.

### Prior New-Game Delivery Patterns
- `.planning/milestones/v1.0-phases/03.1-new-game-delivery-wave-1/03.1-CONTEXT.md` — The prior new-game wave boundary, shared room-entry expectations, and guidance for adding new titles without bespoke launch plumbing.
- `.planning/milestones/v1.0-phases/03.1-new-game-delivery-wave-1/03.1-RESEARCH.md` — Evidence on reusing board-family APIs and room-entry contracts for new board titles.

### Runtime And API Contract
- `docs/architecture/backend-contract.md` — Canonical ownership of `/api/*`, `/socket.io/*`, board room families, and deployed `3100/3101` verification.
- `docs/api/api-reference.md` — Current room-entry, board-room, and admin rollout endpoints that `flyingchess` must fit without adding a parallel contract.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/board/manager.js` — Existing board-family room lifecycle, ready flow, add-bot hooks, turn timers, room-directory sync, serialization, and game-specific branching point for a new board title.
- `pages/games/[gameKey].js` — Shared board-family lobby/create-room/join/invite surface already used by `gomoku`, `chinesecheckers`, and `reversi`.
- `pages/board/[roomNo].js` — Shared board room shell with socket lifecycle, recovery messaging, result overlay, and per-game rendering branches.
- `lib/games/catalog.js` — Discovery metadata, board default-config helpers, board config summary helpers, and game-family classification.
- `backend/handlers/board/rooms/index.js` and `backend/handlers/board/rooms/[roomNo]/index.js` — Existing REST owners for board room create/list/detail flows.
- `tests/board-games.spec.js` — Existing deployed-stack smoke pattern for board-family room creation, ready flow, bot fill, turn interaction, and room cleanup.
- `test-logic/board-config.test.js` and `test-logic/chinesecheckers-logic.test.js` — Existing logic-test pattern for board config normalization and per-game rule coverage.

### Established Patterns
- New board titles flow through shared `/api/board/rooms?gameKey=...` handlers and `SOCKET_EVENTS.board`; they do not create bespoke API families.
- Discovery entry lives at `/games/[gameKey]`, while live room detail stays in the shared `/board/[roomNo]` shell.
- Public/private room behavior, room-number resolution, invite links, recovery-aware presence, and admin rollout semantics are already standardized and should be reused.
- The canonical ship path is the deployed `3100/3101` stack, so logic and browser coverage for the new title must fit the existing release gate rather than relying on ad hoc local-only checks.

### Integration Points
- `lib/games/catalog.js`, `lib/admin/control-plane.js`, and `components/game-hub/GameIcon.js` for surfacing `flyingchess` as a real playable board title.
- `lib/board/manager.js` for core Flying Chess rules, room serialization, move validation, and settlement.
- `pages/games/[gameKey].js` for create-room configuration and public-room listing, plus `pages/board/[roomNo].js` for in-room board rendering and turn interaction.
- `backend/handlers/board/rooms/*` plus shared room-entry flows for create/list/detail/join behavior that must stay contract-compatible.
- `test-logic/*` and `tests/board-games.spec.js` for the first release-quality regression surface.

</code_context>

<specifics>
## Specific Ideas

- `flyingchess` should feel like a proper classic release, not a temporary MVP missing the rules players expect from Flying Chess.
- The safest Phase 15 path is to prove the first Wave 2 runtime by staying close to the existing board-family model instead of opening a new party-runtime track.
- The room should stay social and lightweight, but strong voice-party behavior is not a launch requirement for this title.

</specifics>

<deferred>
## Deferred Ideas

- Voice-first or heavier party-room treatment for `flyingchess` stays out of scope for Phase 15.
- Public quick-match emphasis, continuous rematch loops, and other more aggressive “hot room” behaviors remain future enhancements rather than launch blockers here.
- The user did not lock AI / bot-fill behavior during discussion; that remains open for planning instead of being treated as a committed scope item.

</deferred>

---

*Phase: 15-wave-2-delivery-set-a*
*Context gathered: 2026-04-24*
