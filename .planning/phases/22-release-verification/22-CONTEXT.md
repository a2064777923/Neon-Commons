# Phase 22: Release Verification - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Final verification gate for v1.3 milestone. Deploy all 5 new games (Pick Red, Big Two, Mahjong, Racing, Fighting) to the 3100/3101 stack, run full-round smoke tests with bot-assisted players, verify reconnection recovery, and flip all rollout states to `live` with `isShipped: true`. This phase proves the milestone is ready to ship.

</domain>

<decisions>
## Implementation Decisions

### Smoke Test Depth
- **D-01:** Full game round — each smoke test plays through a complete round to a winner declaration (not just room lifecycle or single-turn)
- **D-02:** Bot-assisted — tests create a room, fill remaining seats with bot/auto-play logic, and play to completion. No multi-browser orchestration needed.
- **D-03:** Assert winner declared — each smoke test must verify a winner is correctly declared and the game transitions to finished state (not just "no crash")

### Rollout Sequencing
- **D-04:** All at once — flip all 4 remaining games from `coming-soon` to `live` in a single commit after all tests pass. (Fighting is already `live`.)
- **D-05:** Set `isShipped: true` for all 5 games — Pick Red, Big Two, Mahjong, Racing, and Fighting all get `isShipped: true` in the catalog

### Test Script Structure
- **D-06:** Extend existing scripts — add the 5 new game test files to the existing `test:logic:critical` and `test:ui:critical` scripts in package.json. One place to run everything.
- **D-07:** Per-game logic test files — each new game gets its own `.test.js` file in `test-logic/` (e.g., `pickred-logic.test.js`, `bigtwo-logic.test.js`, `mahjong-logic.test.js`, `racing-logic.test.js`, `fighting-logic.test.js`). Matches the existing pattern.

### Reconnection Verification
- **D-08:** Include in release gate — add reconnection smoke tests for each game. Disconnect mid-game, reconnect, verify hand/position state is preserved and game can continue.
- **D-09:** Mid-game disconnect + recover — reconnection tests must prove game state is actually recovered, not just that the socket reconnects.

### Claude's Discretion
- Specific bot logic for filling seats in each game type
- How to trigger disconnect/reconnect in Playwright tests (page reload, socket disconnect, etc.)
- Test ordering and parallelization strategy
- Timeout values for full-round tests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Release Verification Infrastructure
- `scripts/verify-release.js` — Current release gate script (redeploy, readiness check, structural check, logic/UI gates)
- `package.json` — Test scripts: `test:logic:critical`, `test:ui:critical`, `test:logic:liveops`, `test:ui:liveops`

### Game Catalog & Rollout
- `lib/games/catalog.js` — Game catalog with `launchState` and `isShipped` fields (4 games at `coming-soon`, Fighting at `live`)

### Existing Test Patterns
- `test-logic/` — Logic test files using `node:test` + `node:assert/strict`
- `tests/` — Playwright UI smoke tests
- `test-logic/hub-room-entry.test.js` — Room entry flow test pattern
- `test-logic/session-recovery.test.js` — Reconnection test pattern
- `test-logic/live-room-ops.test.js` — Live room operations test pattern

### Game Manager Patterns (for bot-assisted testing)
- `lib/card/pickred-manager.js` — Pick Red room manager
- `lib/card/bigtwo-manager.js` — Big Two room manager
- `lib/card/mahjong-manager.js` — Mahjong room manager
- `lib/racing/manager.js` — Racing room manager
- `lib/fighting/manager.js` — Fighting room manager

### Prior Phase Context
- `.planning/phases/21-fighting/21-CONTEXT.md` — Fighting game decisions (light-3d family, 60Hz server loop)
- `.planning/phases/20-racing/20-CONTEXT.md` — Racing game decisions (Three.js, cannon-es, delta-state)
- `.planning/phases/19-mahjong/19-CONTEXT.md` — Mahjong game decisions (tile claiming, fan scoring)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/verify-release.js` — Current release gate with staged execution pattern (redeploy → readiness → check → logic → UI). Extend with new game test stages.
- `test-logic/session-recovery.test.js` — Reconnection test pattern reusable for new games
- `test-logic/hub-room-entry.test.js` — Room creation/join test pattern reusable for new games
- `lib/games/catalog.js` — `launchState` and `isShipped` fields ready for batch update

### Established Patterns
- Logic tests use `node:test` with `test()` blocks, `node:assert/strict` for assertions
- Playwright tests use `test()` blocks, real app at `http://127.0.0.1:3100`
- Release gate runs: structural check → logic critical → UI critical
- Room managers expose `createRoom()`, `joinRoom()`, `startGame()` APIs for test orchestration

### Integration Points
- `package.json` — Add new test files to `test:logic:critical` and `test:ui:critical` scripts
- `lib/games/catalog.js` — Update `launchState` and `isShipped` for 4 games
- `scripts/verify-release.js` — May need new stages for per-game smoke tests

</code_context>

<specifics>
## Specific Ideas

- Full-round smoke tests prove the entire game lifecycle works on the deployed stack
- Bot-assisted approach lets tests run without multi-browser complexity
- Reconnection tests verify the recovery contract actually works for each new game family
- All-at-once rollout simplifies the release process — one commit to flip everything live

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 22-release-verification*
*Context gathered: 2026-05-06*
