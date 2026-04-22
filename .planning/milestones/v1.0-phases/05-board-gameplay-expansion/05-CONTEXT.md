# Phase 5: Board Gameplay Expansion - Context

**Gathered:** 2026-04-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend Gomoku and Chinese Checkers through the existing board-family room model without fracturing the hub, room-number, invite-link, or real-time sync contracts already established earlier in the milestone. This phase should add richer player-facing room options or in-room interactions for those two shipped board games, while preserving the current split frontend/backend runtime and shared `/games/[gameKey]` -> `/board/[roomNo]` flow.

</domain>

<decisions>
## Implementation Decisions

### Board Expansion Delivery
- **D-01:** Phase 5 must extend the current per-game board lobby and shared board-room contract instead of introducing separate variant-specific routes or one-off entry flows.
- **D-02:** Any new board options must be normalized into `room.config`, snapshotted when the room is created, and surfaced in room summaries or room UI so players can tell which variant they are entering.
- **D-03:** Existing live rooms must keep the settings they started with; board expansion options apply only to newly created rooms.

### Gomoku Capability Focus
- **D-04:** Gomoku should keep its current 15x15, two-player, fast-placement baseline and expand through safe pacing or rule presets around that baseline rather than board-size or seat-count changes.
- **D-05:** Gomoku interaction work should stay mobile-friendly and fit inside the existing shared board-room page, not a new dedicated room implementation.

### Chinese Checkers Capability Focus
- **D-06:** Chinese Checkers should stay on the current standard 2/4/6-player star-board model and expand through richer room presets plus clearer move and turn-state assists.
- **D-07:** Chinese Checkers interaction work should build on the current selectable-piece and legal-target patterns rather than replace the board geometry or move model.

### Sync and Compatibility Boundary
- **D-08:** Prefer room-configurable options and explicit in-room state displays over features that require rollback, hidden simultaneous actions, or mid-turn conflict resolution.
- **D-09:** Board expansion must continue to respect the shared room-number, share-link, guest/private-room, and capability-gating rules locked in earlier phases.
- **D-10:** Every new board capability added in this phase needs targeted automated coverage across logic or contract tests plus board-family browser smoke coverage before shipping.

### the agent's Discretion
- Exact option labels, preset names, and config field names for Gomoku and Chinese Checkers.
- The exact safe option set that lands in Phase 5 first, as long as both Gomoku and Chinese Checkers gain visible player-facing expansion.
- Exact room-summary chips, room-header presentation, and helper copy for active board options.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase and prior decision boundary
- `.planning/PROJECT.md` — Brownfield baseline, product direction, and constraints that expansion work must preserve.
- `.planning/REQUIREMENTS.md` — `BOARD-01` defines the requirement contract for this phase.
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, and sequencing against the final hardening phase.
- `.planning/STATE.md` — Current milestone state after Phase 4 completion.
- `.planning/phases/02-admin-control-plane-expansion/02-CONTEXT.md` — Locked new-room-only config behavior and capability-control rules that still apply here.
- `.planning/phases/03-hub-room-expansion-framework/03-CONTEXT.md` — Locked hub, invite, guest, and room-entry decisions the board-family work must continue to follow.
- `.planning/phases/03.1-new-game-delivery-wave-1/03.1-CONTEXT.md` — Prior board-family expansion direction from the Reversi/new-game wave and the playable-now vs upcoming surfacing model.

### Architecture and runtime contract
- `.planning/codebase/ARCHITECTURE.md` — Split runtime model, manager-singleton pattern, and realtime data flow.
- `.planning/codebase/CONVENTIONS.md` — Frontend/backend split, shared contract-path, and room-flow preservation rules.
- `.planning/codebase/STACK.md` — Runtime and validation commands that board gameplay changes must continue to satisfy.
- `.planning/codebase/STRUCTURE.md` — File layout for board handlers, board pages, shared catalog helpers, and test coverage.
- `docs/architecture/backend-contract.md` — Canonical service-boundary contract for `/api/*` and `/socket.io/*`.

### Existing board-family implementation
- `lib/games/catalog.js` — Board metadata, default configs, player-count options, and family routing metadata.
- `lib/board/manager.js` — Board room config normalization, room serialization, seat layouts, move handling, and realtime updates.
- `lib/shared/network-contract.js` — Shared board REST routes and socket event names that frontend and backend must continue to share.
- `backend/handlers/board/rooms/index.js` — Board room list/create contract, auth boundary, and new-room capability gating.
- `pages/games/[gameKey].js` — Existing per-game board lobby form, quick-join flow, and board-family create-room UX baseline.
- `pages/board/[roomNo].js` — Shared board-room page for Gomoku, Reversi, and Chinese Checkers where new board interactions will surface.

### Verification baseline
- `tests/board-games.spec.js` — Browser smoke coverage for Gomoku and Chinese Checkers room creation, start, and move flows.
- `test-logic/chinesecheckers-logic.test.js` — Chinese Checkers legal-move regression for jump behavior.
- `test-logic/hub-room-entry.test.js` — Shared room-entry and guest/invite expectations that still constrain board rooms.
- `test-logic/client-network-contract.test.js` — Shared route-builder coverage for board-room endpoints.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/board/manager.js`: Already centralizes board config normalization, per-game match serialization, room directory sync, timers, and socket emissions for the whole board family.
- `pages/games/[gameKey].js`: Already provides the board-family create-room form, quick room-number join, visibility toggle, player-count selector, and invite-copy entry flow.
- `pages/board/[roomNo].js`: Already branches by `room.gameKey` inside one shared room page, so new board options or interaction indicators can surface without fragmenting the route model.
- `lib/games/catalog.js`: Already owns board defaults, limits, player-count options, and discovery metadata, which makes it the natural source of truth for new room-option presets.
- `backend/handlers/board/rooms/index.js`: Already owns board room creation and applies capability gating before a room is opened.
- `tests/board-games.spec.js`: Already exercises the most important create-room -> start -> move smoke path for both shipped board titles.

### Established Patterns
- Board-family features flow through one shared `board:*` socket event family and one shared `/api/board/rooms` REST contract.
- Room options are normalized when a room is created and then stored on `room.config`; live rooms are not retroactively mutated.
- Dedicated per-game `/games/[gameKey]` lobbies remain the right place for room setup, while `/board/[roomNo]` remains the shared play surface.
- Room-directory, share-link, guest/private-room, and capability-gating behavior are shared cross-family contracts and should not be bypassed for board expansion.

### Integration Points
- New board room options should be defined in `lib/games/catalog.js`, normalized in `lib/board/manager.js`, accepted by `backend/handlers/board/rooms/index.js`, and surfaced by `pages/games/[gameKey].js`.
- New in-room board interaction indicators or option displays should attach to the existing `pages/board/[roomNo].js` branches for Gomoku and Chinese Checkers.
- Regression coverage should extend the current `test-logic/*` and `tests/board-games.spec.js` baseline rather than creating a separate verification track.

</code_context>

<specifics>
## Specific Ideas

- Gomoku should remain a quick, two-player, touch-friendly board match even after expansion.
- Chinese Checkers should keep the existing full star-board presentation and legal-target clarity as a core UX trait.
- New board settings should be visible before room entry and during the match, not hidden in backend-only config.
- Board-family expansion should continue to honor room-number entry, share-link deep-linking, guest/private-room constraints, and new-room-only config behavior from earlier phases.
- No extra product references were supplied during this auto pass, so the planner should prefer standard incremental board-game expansion inside the locked boundaries above.

</specifics>

<deferred>
## Deferred Ideas

- Reversi expansion is outside Phase 5 scope; this phase is specifically about Gomoku and Chinese Checkers.
- Custom board sizes, alternative Chinese Checkers board topologies, or other rules that fundamentally change board geometry are deferred unless a future phase explicitly scopes them.
- Mid-match admin mutations, rollback-heavy undo systems, and other features that risk realtime sync integrity remain out of scope for this phase.

</deferred>

---

*Phase: 05-board-gameplay-expansion*
*Context gathered: 2026-04-22*
