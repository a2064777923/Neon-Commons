# Phase 15: Wave 2 Delivery Set A - Research

**Researched:** 2026-04-24
**Domain:** Shipping `flyingchess` as the first real Wave 2 board-family runtime on top of the shared launch, room-entry, recovery, and rollout contract
**Confidence:** HIGH

<user_constraints>
## User Constraints

- Phase 15 must satisfy `WAVE-02` from `.planning/REQUIREMENTS.md`: players can create or join the first Wave 2 room-based title through shared room-number, invite, recovery, and admin capability flows.
- `15-CONTEXT.md` locks the product direction for this phase:
  - the title is `flyingchess`
  - it must reuse the existing `board` family instead of opening a new room/runtime family
  - launch scope is a classic complete ruleset, not a thin MVP
  - the room should stay a light-party board room, not a voice-first party room
- `AGENTS.md` keeps the brownfield split-runtime contract intact:
  - backend owns `/api/*` and `/socket.io/*`
  - frontend remains on `3100`, backend remains on `3101`
  - room-number join, invite links, recovery-aware re-entry, and shipped families are compatibility targets
- Phase 14 already established backend-owned launch metadata and rollout gating. Phase 15 should activate that contract with one real title instead of inventing parallel discovery rules.
- Bot fill for `flyingchess` is still planner discretion. The implementation may ship with minimal/no bot support if the human multiplayer loop stays clean and truthful.

</user_constraints>

<current_state_audit>
## Current State Audit

### What already exists

1. **Wave 2 discovery metadata is already staged for `flyingchess`.**
   - `lib/games/catalog.js` already contains a `flyingchess` entry with board-family metadata, audience copy, and `coming-soon` launch state.
   - Phase 14 already taught hub, entry, and admin surfaces to consume backend-authored launch state instead of page-local heuristics.

2. **The board-family runtime already owns the right room lifecycle.**
   - `lib/board/manager.js` already owns room creation, public/private visibility, ready flow, socket sync, reconnect grace, room-directory updates, turn timers, settlement, and result overlays.
   - `backend/handlers/board/rooms/index.js` and `backend/handlers/board/rooms/[roomNo]/index.js` already provide the backend-owned create/list/detail contract for board titles.

3. **The shared board lobby and board room shell are already reusable.**
   - `pages/games/[gameKey].js` already handles board-family create/join/invite flow and dynamically renders board config controls from catalog helpers.
   - `pages/board/[roomNo].js` already manages the board-family socket lifecycle, recovery notice, turn timer, result overlay, and per-game rendering branches for existing board titles.

4. **The codebase already has strong templates for new board-title validation.**
   - `test-logic/board-config.test.js` locks board config normalization behavior.
   - `test-logic/chinesecheckers-logic.test.js` and `test-logic/reversi-logic.test.js` show the expected style for pure rules coverage.
   - `tests/board-games.spec.js` already exercises deployed-stack board create/join/ready/move/recovery smoke behavior on `3100`.

### Gaps blocking Phase 15

1. **`flyingchess` is staged in metadata but not actually part of the live board runtime.**
   - `BOARD_GAME_KEYS` only includes `gomoku`, `chinesecheckers`, and `reversi`.
   - `getBoardDefaultConfig(...)`, `getGameLimits(...)`, `getBoardPlayerOptions(...)`, and `getBoardConfigSummary(...)` have no `flyingchess` branch.

2. **The board room manager has no Flying Chess rules engine or serialization model.**
   - `submitMove(...)`, `maybeStartRoom(...)`, `scheduleTurn(...)`, timeout handling, and match serialization only branch for Gomoku, Reversi, and Chinese Checkers.
   - There is no pure rules module for pathing, takeoff, jump/flight, collisions, extra-roll flow, exact-finish home logic, or winner detection.

3. **The shared board room shell has no UI/action model for dice-driven multi-piece turns.**
   - Current board UI assumes either grid placement (`gomoku`, `reversi`) or source-target move selection (`chinesecheckers`).
   - Flying Chess needs a two-step turn contract: roll first, then choose the legal piece/target implied by that roll.

4. **Coverage and release hooks do not yet mention `flyingchess`.**
   - There is no `test-logic/flyingchess-logic.test.js`.
   - `tests/board-games.spec.js` does not create or play a `flyingchess` room.
   - The hub/admin regression surface still needs proof that promoting `flyingchess` from staged metadata to live gameplay does not regress the release contract added in Phase 14.

### Brownfield-safe leverage points

- `lib/games/catalog.js` is the right place to promote `flyingchess` into the shipped board set and define its room/config defaults.
- `lib/board/manager.js` should stay the orchestrator for room lifecycle, while Flying Chess rules should move into a dedicated pure helper module under `lib/board/`.
- `pages/board/[roomNo].js` should keep the shared room shell and add one dedicated `flyingchess` render/action branch instead of creating a second board-room page.
- `lib/admin/control-plane.js`, the hub handlers, and launch-contract surfaces should inherit most of the release/admin behavior automatically once catalog metadata is promoted from `coming-soon` to live.

</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Promote `flyingchess` through the existing board-family contract, not a special-case runtime

Recommended catalog changes:

- move `flyingchess` from staged metadata to a real board-family launch target
- add it to `BOARD_GAME_KEYS`
- set `route` to `/games/flyingchess`
- keep `detailRoutePrefix` on the shared `/board` shell unless the UI later proves that a dedicated route is necessary
- make it `isShipped: true` so capability management, launch contract, and hub/admin release surfaces treat it like a real title

This keeps Phase 15 aligned with the user's explicit "reuse board-family contract" decision and lets Phase 14's launch contract do real work.

### 2. Introduce a dedicated pure Flying Chess rules module and keep room orchestration in `BoardRoomManager`

Recommended shape:

- add `lib/board/flyingchess.js` (or equivalent) for pure rule helpers and immutable transforms
- keep room creation, socket sync, timers, settlements, and recovery in `lib/board/manager.js`

The pure rules module should own:

- seat/color profiles for `2-4` players
- piece inventory and starting airport state
- canonical path definitions plus per-seat home lanes
- roll resolution and legal-move calculation
- takeoff rule for the classic mode
- same-color jump / flight behavior
- collision detection and send-back-to-airport behavior
- extra-roll rule handling
- exact-finish home handling
- winner detection and end-state summaries

This matches the existing separation where `lib/board/reversi.js` owns Reversi legality while `lib/board/manager.js` owns room lifecycle.

### 3. Extend the board room manager with a multi-step turn contract instead of faking Flying Chess into row/col moves

Recommended match shape:

- `turnSeat`
- `moveCount`
- `rollValue`
- `turnPhase` such as `roll` or `move`
- per-seat piece positions
- `movablePieceIds`
- `lastMove` / `lastEvent`
- extra-roll bookkeeping

Recommended move contract:

- `submitMove(...)` should accept Flying Chess payloads such as `{ action: "roll" }` and `{ action: "move", pieceId, targetCellId }`
- serialization should expose viewer-specific action state, legal targets, roll result, and progress toward home

Trying to force Flying Chess into the existing `row/col` or `fromCellId/toCellId` payload shapes would create brittle adapters and shallow plans. The manager should branch explicitly for `flyingchess`, just as it already does for the other board titles.

### 4. Keep the room in the shared `/board/[roomNo]` shell, but render a dedicated mobile-friendly Flying Chess board branch

Recommended UI direction:

- stay inside `pages/board/[roomNo].js` so recovery, room feed, presence, result overlays, and invite behavior remain shared
- add a dedicated `flyingchess` renderer inside the existing shell rather than making a second board-room runtime
- prefer SVG/DOM primitives over canvas so touch targets, test selectors, and recovery overlays stay inspectable and stable

The room should explicitly support:

- one-tap dice rolling for the active player
- clear movable-piece highlights after a roll
- obvious target-cell feedback for jumps / flights / collisions
- persistent turn-state copy so mobile players know whether they need to roll or move
- progress chips or compact status rows per seat so 4-player state remains legible on phones

### 5. Treat bot fill as optional scope, but do not leave the shared board shell in a misleading state

Because Phase 15 context left bot behavior open, the safe recommendation is:

- prioritize the human multiplayer core loop first
- if bot play is not implemented in the first pass, explicitly disable or hide Flying Chess bot-fill affordances instead of exposing a broken `补机器人` path

This is important because the shared board shell already advertises bot fill for existing games. Phase 15 should either support a safe minimal bot path or truthfully suppress it for `flyingchess`.

### 6. Plan the phase around two roadmap plans, with backend/runtime first and UI/release second

The roadmap already has the right split:

1. `15-01` should establish the real runtime:
   - catalog promotion
   - config and limits
   - pure rules module
   - board manager integration
   - backend room contract

2. `15-02` should consume and harden that runtime:
   - board lobby create-room controls
   - room-page Flying Chess UI
   - admin/hub launch truth
   - logic/browser/release regression coverage

This keeps write sets coherent and lets the second plan stabilize selectors, mobile presentation, and release coverage once the runtime contract is real.

</recommended_direction>

<phase_shape_recommendation>
## Recommended Phase Shape

Use the roadmap's **2 plans**:

### 15-01: Implement the first Wave 2 title's runtime, rules, and shared room integration

Focus:

- promote `flyingchess` into the live board catalog
- add board config/limits/player options for `2-4` players
- create a pure Flying Chess rules helper module
- extend `BoardRoomManager` start/turn/timeout/serialization branches
- keep room-directory, invite, recovery, settlement, and availability flows contract-compatible

### 15-02: Ship UI, entry, admin hooks, and regression coverage for the first Wave 2 title

Focus:

- extend `/games/flyingchess` lobby controls and summaries
- add the `flyingchess` render branch to `/board/[roomNo]`
- ensure hub/admin/capability surfaces show truthful live behavior once the title is promoted
- add logic tests, board smoke coverage, and release-facing regression hooks

Recommended execution order:

- `15-01` first; it defines the backend-owned runtime and payload shape
- `15-02` second; it consumes that runtime and locks browser/release coverage

</phase_shape_recommendation>

## Validation Architecture

### Narrow feedback

- `node --test test-logic/board-config.test.js`
- `node --test test-logic/flyingchess-logic.test.js`
- `npm run check`

### Board-family browser coverage

- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/board-games.spec.js --workers=1`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/hub-entry.spec.js --workers=1`

### Release-facing coverage

- `npm run test:logic:critical`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`
- `npm run verify:release -- --skip-deploy`

### Expected artifacts

- live `flyingchess` entry in `lib/games/catalog.js`
- pure Flying Chess rules helper under `lib/board/`
- board-manager support for `flyingchess` room lifecycle and match serialization
- `/games/flyingchess` lobby flow and `/board/[roomNo]` Flying Chess room renderer
- `test-logic/flyingchess-logic.test.js`
- expanded board/hub browser smoke coverage that proves the title is usable on the canonical `3100/3101` stack

## Open Questions

1. **Should Phase 15 include bot fill for Flying Chess?**
   - Recommendation: treat bot play as optional. Either implement a minimal deterministic bot after the human loop is stable, or explicitly disable the add-bot affordance for `flyingchess` in this phase.

2. **Should Flying Chess use canvas for the board?**
   - Recommendation: no. Stay with SVG/DOM rendering inside the shared board shell so mobile tap targets, `data-*` selectors, and state overlays remain inspectable and easy to regress-test.

3. **How much of the classic rule table should be hard-coded vs configurable?**
   - Recommendation: hard-code one backend-owned "classic" rule table for Phase 15 so the launch is coherent. If house rules are ever added later, expose them as explicit config options rather than burying them in the implementation.

4. **Which classic takeoff / reroll rules should the plan lock?**
   - Recommendation: follow the common classic baseline players expect in Chinese Flying Chess: takeoff requires the standard trigger roll, same-color jump/flight is enabled, collisions send rivals back, extra rolls are explicit, and finishing home requires the exact count. The final plan should write this rule table down once and reuse it across backend, UI copy, and tests.

<sources>
## Sources

### Primary
- `.planning/phases/15-wave-2-delivery-set-a/15-CONTEXT.md`
- `.planning/phases/14-wave-2-launch-contract/14-CONTEXT.md`
- `.planning/phases/14-wave-2-launch-contract/14-01-SUMMARY.md`
- `.planning/phases/14-wave-2-launch-contract/14-02-SUMMARY.md`
- `.planning/milestones/v1.0-phases/03.1-new-game-delivery-wave-1/03.1-RESEARCH.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `lib/games/catalog.js`
- `lib/board/manager.js`
- `backend/handlers/board/rooms/index.js`
- `backend/handlers/board/rooms/[roomNo]/index.js`
- `pages/games/[gameKey].js`
- `pages/board/[roomNo].js`
- `tests/board-games.spec.js`
- `test-logic/board-config.test.js`
- `test-logic/chinesecheckers-logic.test.js`
- `package.json`

### Secondary
- `docs/architecture/backend-contract.md`
- `docs/api/api-reference.md`
- `AGENTS.md`

</sources>
