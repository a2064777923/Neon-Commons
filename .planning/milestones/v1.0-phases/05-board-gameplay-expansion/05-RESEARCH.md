# Phase 5: Board Gameplay Expansion - Research

**Researched:** 2026-04-22
**Domain:** Incremental expansion of shipped Gomoku and Chinese Checkers through the existing board-room contract
**Confidence:** HIGH

<user_constraints>
## User Constraints

- Phase 5 goal from `.planning/ROADMAP.md`: extend Gomoku and Chinese Checkers options or interactions without regressing real-time board play.
- Phase requirement is fixed as `BOARD-01`; every plan in this phase must contribute directly to that requirement.
- Earlier phases already locked the compatibility baseline: keep the shared `/games/[gameKey]` -> `/board/[roomNo]` flow, room-number join, invite links, guest/private-room rules, and the split frontend/backend architecture.
- `AGENTS.md` requires preserving the dedicated backend service boundary. Board runtime work should stay inside the existing backend handlers and shared runtime modules, not add `pages/api` endpoints.
- Existing live board play is the brownfield compatibility target, so expansion should prefer normalized room config and richer serialization/UI over architecture changes.
</user_constraints>

<current_state_audit>
## Current State Audit

### The board family already has a solid shared room contract

- `backend/handlers/board/rooms/index.js` already owns the board room list/create surface and applies capability gating before a room is created.
- `lib/board/manager.js` already centralizes room creation, config normalization, room serialization, socket emissions, timers, and move submission for Gomoku, Reversi, and Chinese Checkers.
- `pages/games/[gameKey].js` already provides the create-room form, quick room-number join, invite copy, and public room list for board titles.
- `pages/board/[roomNo].js` already branches by `room.gameKey` inside one shared board-room shell and therefore already has the right integration point for new board interactions.

### Board config capability is still thin

- `getBoardDefaultConfig()` in `lib/games/catalog.js` only exposes `visibility`, `maxPlayers`, and `turnSeconds`.
- `normalizeBoardConfig()` in `lib/board/manager.js` only validates those same fields; there is no game-specific enum option contract yet.
- `serializeRoomSummary()` already includes `config`, but `pages/games/[gameKey].js` only renders party-specific config chips in the public room list, not board-specific ones.
- `pages/board/[roomNo].js` shows room size and turn timer, but it does not display a canonical summary of the active board options.

### Gomoku has room for low-risk rule expansion

- Gomoku currently uses a fixed 15x15 board and standard first-move flow.
- The first move is not constrained beyond empty-cell validation, which makes a small opening-rule preset feasible without changing board geometry or player count.
- Gomoku interaction rendering is already mobile-friendly and simple, so additional rule display can ride on the current HUD rather than a new page structure.

### Chinese Checkers already exposes rich legal-move state but not progress insight

- `serializeChineseCheckersMatch()` already returns `viewerLegalMoves` plus the full cell list with seat occupancy.
- Seat profiles already contain `campLabel`, `targetCampLabel`, and accent metadata.
- The board page already renders selectable pieces, legal targets, jump traces, and seat labels, but it does not show how close each seat is to filling its target camp.
- Internal helper logic already calculates target-camp distance and target occupancy for bot choice, so progress summaries can be derived without inventing a new move system.

### Validation baseline exists but is missing board-expansion coverage

- `tests/board-games.spec.js` already covers create-room -> ready -> move smoke for Gomoku and Chinese Checkers.
- `test-logic/chinesecheckers-logic.test.js` currently covers the permissive jump rule but not room serialization/progress.
- There is no dedicated board-config regression file yet for normalization and Gomoku opening-rule enforcement.
</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Expand board capability through normalized config plus shared summary helpers

The safest phase shape is to keep all new board capability flowing through the existing `room.config` contract:

- extend `lib/games/catalog.js` with a shared `getBoardConfigSummary(gameKey, config)` helper
- extend `normalizeBoardConfig()` with one game-specific enum option for Gomoku
- keep the existing board create-room handler shape unchanged so route and auth contracts do not drift
- surface the same canonical config summary in the lobby room cards and the live board room HUD

This aligns with earlier phases: normalize once on the backend, then render the same truth everywhere.

### 2. Use a low-risk Gomoku opening preset instead of board-size or seat-count changes

The current engine is a strong fit for a small opening-rule variant:

- keep the board at 15x15 and the room at 2 players
- add an `openingRule` enum with `standard` and `center-opening`
- enforce `center-opening` server-side by requiring the first move to land on the center point
- surface that preset in the create-room form, room list, and room HUD so invitees know what rule is active

This delivers a meaningful new room option without changing the fundamental board model.

### 3. Expand Chinese Checkers through progress and move-assist serialization, not geometry variants

Chinese Checkers already has the harder pieces in place: legal move generation, jump chains, seat camps, and target-camp math. The lowest-risk expansion is:

- derive per-seat target-camp progress from existing `positions` and seat profiles
- serialize that progress to the room page
- render progress cards or chips alongside the current board view so players can gauge race state at a glance
- keep the current board geometry, 2/4/6-player layouts, and move rules intact

This satisfies the "interactions" part of the phase goal without creating a new rules engine.

### 4. Close the gap between lobby discovery and live board state

Right now board rooms expose config in JSON payloads but not in the board-family UI. Phase 5 should therefore:

- render board config chips in public board room cards, similar to party rooms
- render active board config in the board room header/info dock
- keep the same config labels across lobby and room so players do not see different language for the same rule

### 5. Make validation explicitly board-expansion aware

Phase 5 touches the shared board manager and shared board UI, so final validation should include:

- a new node test file for board config normalization and Gomoku opening-rule enforcement
- Chinese Checkers progress serialization coverage
- the existing Playwright board smoke expanded to cover the new opening preset and progress UI
- `npm run check` plus targeted node tests as the fast path before browser smoke
</recommended_direction>

<phase_shape_recommendation>
## Recommended Phase Shape

Use the roadmap's **2 plans**:

1. **05-01: Extend board-game room/model capability for new options and interactions**
   - add shared board config summary support
   - add Gomoku `openingRule` normalization and enforcement
   - add Chinese Checkers progress serialization and room UI surfacing

2. **05-02: Validate board gameplay sync and UX after expansion**
   - add dedicated board node tests
   - expand board browser smoke for the new rule and progress surfaces
   - verify shared board contract remains stable

Recommended execution order:

- Run **05-01** first because it defines the new room/model behavior.
- Run **05-02** second as the explicit regression gate for the added config and UI behavior.
</phase_shape_recommendation>

## Validation Architecture

### Fast feedback

- `npm run check`

### Wave-level validation

- `npm run check && node --test test-logic/board-config.test.js test-logic/chinesecheckers-logic.test.js test-logic/client-network-contract.test.js`

### High-risk smoke validation

- `npx playwright test tests/board-games.spec.js --workers=1`

### Expected artifacts

- shared board config summary helper in `lib/games/catalog.js`
- Gomoku `openingRule` support normalized and enforced in `lib/board/manager.js`
- Chinese Checkers progress serialization added to the board-room payload
- board-family lobby and board-room UI that clearly show active board options/progress
- `test-logic/board-config.test.js`
- updated `tests/board-games.spec.js` coverage for the new board expansion behavior

## Open Questions

1. **Should Phase 5 change board geometry or player counts?**
   - What we know: the current room contract and UI are stable around 15x15 Gomoku and standard 2/4/6-seat Chinese Checkers.
   - Recommendation: no. Keep geometry and seat layouts fixed; expand through safer options and interaction surfaces.

2. **Should Chinese Checkers add alternate rulesets in this phase?**
   - What we know: the current engine already has rich legal-move and target-camp logic, but no flexible house-rule contract.
   - Recommendation: no. Use progress and move-assist surfacing in this phase, not alternate rules.

3. **Does board expansion need new backend routes?**
   - What we know: board room create/list/detail/join routes already exist and already carry `config`.
   - Recommendation: no. Keep the current route surface and expand the normalized config payload instead.

<sources>
## Sources

### Primary (HIGH confidence)
- `lib/board/manager.js`
- `lib/games/catalog.js`
- `backend/handlers/board/rooms/index.js`
- `pages/games/[gameKey].js`
- `pages/board/[roomNo].js`
- `tests/board-games.spec.js`
- `test-logic/chinesecheckers-logic.test.js`
- `test-logic/client-network-contract.test.js`

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/ROADMAP.md`
- `.planning/STATE.md`
- `.planning/phases/02-admin-control-plane-expansion/02-CONTEXT.md`
- `.planning/phases/03-hub-room-expansion-framework/03-CONTEXT.md`
- `.planning/phases/03.1-new-game-delivery-wave-1/03.1-CONTEXT.md`
- `AGENTS.md`
</sources>
