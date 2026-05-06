# Phase 22: Release Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 22-release-verification
**Areas discussed:** Smoke test depth, Rollout sequencing, Test script structure, Reconnection verification

---

## Smoke test depth

### Q1: How deep should per-game smoke tests go?

| Option | Description | Selected |
|--------|-------------|----------|
| Room lifecycle only | Create room → join → verify game starts. Fastest to run, proves the plumbing works. | |
| One gameplay turn | Create room → join → deal/draw → make one move → verify state updated. Proves game logic actually runs. | |
| Full game round | Play through a complete round to end state (winner declared). Most thorough but slowest. | ✓ |

**User's choice:** Full game round
**Notes:** User wants the most thorough verification — prove the entire game lifecycle works.

### Q2: How should the test orchestrate multiple players?

| Option | Description | Selected |
|--------|-------------|----------|
| Bot-assisted | Single-player scripted flow: create room, fill with bots, play to completion. Tests the full path without needing multiple browser contexts. | ✓ |
| Multi-browser | Multiple Playwright browser contexts joining the same room, each making moves. True multiplayer but complex to orchestrate. | |
| Logic-only API calls | Logic-only tests (no browser): call room manager APIs directly to play a full round. Fastest but doesn't prove the UI. | |

**User's choice:** Bot-assisted
**Notes:** Avoids multi-browser complexity while still testing the full game flow.

### Q3: Should the full-round smoke test assert that a winner is correctly declared?

| Option | Description | Selected |
|--------|-------------|----------|
| Verify winner declared | Test asserts a winner is declared and game transitions to finished state. Proves end-to-end game lifecycle. | ✓ |
| Verify no crash only | Test plays until deck/wall exhausted or lap count reached, but doesn't assert who won. Just proves no crash. | |

**User's choice:** Verify winner declared
**Notes:** Must prove the game actually completes with a winner, not just that it doesn't crash.

---

## Rollout sequencing

### Q1: How should we sequence the rollout flip?

| Option | Description | Selected |
|--------|-------------|----------|
| All at once | Flip all 5 games from 'coming-soon' to 'live' in one commit after all tests pass. Simplest. | ✓ |
| Card games first, action games second | Card games (Pick Red, Big Two, Mahjong) go live first, then action games (Racing, Fighting) after. Staged risk reduction. | |
| Individually as tests pass | Each game goes live independently as its smoke test passes. Most granular but more commits. | |

**User's choice:** All at once
**Notes:** Simplest approach — one commit to flip everything live after all tests pass.

### Q2: Should the rollout flip also set isShipped: true?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, set isShipped: true | Sets isShipped: true for all 5 games. This marks them as shipped in the catalog metadata. | ✓ |
| No, only flip launchState | Only change launchState to 'live'. Keep isShipped as-is for now. | |

**User's choice:** Yes, set isShipped: true for all 5 games
**Notes:** Fighting already has isShipped: true — the other 4 games should match.

---

## Test script structure

### Q1: How should we structure the test scripts?

| Option | Description | Selected |
|--------|-------------|----------|
| Extend existing scripts | Add the 5 new games to the existing test:logic:critical and test:ui:critical scripts in package.json. One place to run everything. | ✓ |
| Separate wave3 scripts | Create new scripts like test:logic:wave3 and test:ui:wave3. Keeps new game tests isolated from the existing gate. | |
| Per-game scripts with aggregate | Per-game scripts (test:logic:pickred, test:logic:bigtwo, etc.) plus a test:ui:wave3 aggregate. | |

**User's choice:** Extend existing scripts
**Notes:** One place to run everything — keeps the release gate unified.

### Q2: Should each new game get its own logic test file?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-game logic test files | Each new game gets a .test.js file in test-logic/ (e.g., pickred-logic.test.js, bigtwo-logic.test.js). Matches existing pattern. | ✓ |
| Single wave3-logic.test.js | One combined test file covering all 5 new games. Fewer files but larger. | |

**User's choice:** Per-game logic test files
**Notes:** Matches the existing pattern — one test file per game.

---

## Reconnection verification

### Q1: Should Phase 22 also verify reconnection works on the deployed stack?

| Option | Description | Selected |
|--------|-------------|----------|
| Include in release gate | Add a reconnection smoke test for each game (disconnect mid-game → reconnect → verify state recovered). Proves the recovery contract works for new games. | ✓ |
| Trust per-phase tests | Trust the per-phase tests that already verify reconnection. Release verification focuses on deployment and rollout only. | |
| Card games only | Add reconnection tests for card games only (Pick Red, Big Two, Mahjong). Action games (Racing, Fighting) have more complex state — defer those. | |

**User's choice:** Include in release gate
**Notes:** All 5 games must prove reconnection works on the deployed stack.

### Q2: How deep should the reconnection verification go?

| Option | Description | Selected |
|--------|-------------|----------|
| Mid-game disconnect + recover | Disconnect during a game → reconnect → verify hand/position state is preserved and game can continue. | ✓ |
| Socket reconnect only | Just verify the socket reconnects and the room page loads. Doesn't prove game state recovery. | |

**User's choice:** Mid-game disconnect + recover
**Notes:** Must prove game state is actually recovered, not just that the socket reconnects.

---

## Claude's Discretion

- Specific bot logic for filling seats in each game type
- How to trigger disconnect/reconnect in Playwright tests (page reload, socket disconnect, etc.)
- Test ordering and parallelization strategy
- Timeout values for full-round tests

## Deferred Ideas

None — discussion stayed within phase scope
