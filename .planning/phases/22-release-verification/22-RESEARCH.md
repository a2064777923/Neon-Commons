# Phase 22: Release Verification - Research

**Researched:** 2026-05-06
**Domain:** Smoke testing, rollout management, game lifecycle verification
**Confidence:** HIGH

## Summary

Phase 22 is the final verification gate for the v1.3 milestone. The goal is to prove all 5 new games (Pick Red, Big Two, Mahjong, Racing, Fighting) work end-to-end on the deployed 3100/3101 stack by running full-round smoke tests with bot-assisted players, verifying reconnection recovery, and flipping all rollout states to `live` with `isShipped: true`.

The existing test infrastructure is mature: `node:test` for logic tests, Playwright for UI tests, and `scripts/verify-release.js` as the release gate orchestrator. All 5 game managers expose the same room lifecycle APIs (`createRoom`, `joinRoom`, `setReady`, `serializeRoom`, `registerSocket`, `unregisterSocket`). Card game managers (Pick Red, Big Two, Mahjong) additionally expose game-action APIs (`drawCard`, `matchPair`, `discardCard`, `playHand`, `passTurn`, `claimTile`, etc.) that allow driving a full round to completion from tests. Action game managers (Racing, Fighting) use real-time server loops (20Hz and 60Hz respectively), which requires a different testing strategy -- either accelerating time or simulating inputs until a winner is declared.

The rollout catalog change is a single-file edit to `lib/games/catalog.js`: flip `launchState` from `coming-soon` to `live` and set `isShipped: true` for Pick Red, Big Two, Mahjong, and Racing. Fighting is already `live` and `isShipped: true`.

**Primary recommendation:** Create 5 per-game logic test files in `test-logic/` that each drive a complete round to a winner declaration using bot-assisted players, plus 5 reconnection test files that verify mid-game disconnect/recover preserves hand state. Add all new files to `test:logic:critical` and `test:ui:critical` in package.json. Extend `scripts/verify-release.js` if needed. Flip catalog state in a single commit after all tests pass.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Full-round smoke tests | API / Backend (test-logic/) | — | Logic tests exercise room managers directly, no browser needed |
| UI smoke tests | Browser / Client (tests/) | API / Backend | Playwright tests verify page loads and UI elements against live backend |
| Reconnection verification | API / Backend | — | Register/unregister socket lifecycle on room managers |
| Rollout state flip | API / Backend | — | Single-file edit to `lib/games/catalog.js` |
| Release gate orchestration | API / Backend | — | `scripts/verify-release.js` runs structural + logic + UI gates |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| node:test | built-in (Node 24.15.0) | Logic test runner | Already used by all existing test-logic files |
| node:assert/strict | built-in | Assertions | Already used by all existing test-logic files |
| playwright | ^1.59.1 | UI smoke tests | Already used by all existing tests/ specs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| cannon-es | ^0.20.0 | Physics engine (Racing tests) | Only if testing physics directly (existing racing-logic.test.js already does) |
| pixi.js | ^8.18.1 | 2.5D rendering (Fighting) | Only for UI tests, not logic tests |

**Installation:** No new packages needed. All dependencies are already installed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Bot-assisted full-round tests | Multi-browser Playwright orchestration | Bot-assisted is simpler, faster, deterministic; multi-browser is more realistic but complex and flaky |
| Logic tests for reconnection | Playwright page-reload tests | Logic tests are faster and more reliable; Playwright reconnection tests are fragile due to timing |

## Architecture Patterns

### System Architecture Diagram

```
[Smoke Test Runner]
        |
        v
[scripts/verify-release.js]  -->  [Docker Compose: app + postgres + redis]
        |                                    |
        |                                    v
        +--> structural check (npm run check)
        +--> logic gate (npm run test:logic:critical)
        |       |
        |       +--> game-logic tests (per-game full-round)
        |       +--> reconnection tests (per-game mid-game recovery)
        |       +--> existing critical tests (backend-contract, hub-room-entry, etc.)
        |
        +--> UI gate (npm run test:ui:critical)
                |
                +--> hub-entry.spec.js (verifies all games visible)
                +--> new per-game UI specs (page load, no crash)
                +--> existing critical specs
```

### Recommended Project Structure

```
test-logic/
  pickred-logic.test.js      # NEW: Full-round + reconnection
  bigtwo-logic.test.js        # NEW: Full-round + reconnection
  mahjong-logic.test.js       # EXISTS: Extend with full-round test
  racing-logic.test.js        # EXISTS: Extend with full-round test
  fighting-logic.test.js      # EXISTS: Extend with full-round test

tests/
  pickred-entry.spec.js       # NEW: UI smoke (page load, no crash)
  bigtwo-entry.spec.js        # NEW: UI smoke (page load, no crash)
  mahjong.spec.js             # EXISTS: Extend with room entry test
  racing-entry.spec.js        # EXISTS: Already has page load tests
```

### Pattern 1: Full-Round Card Game Smoke Test

Each card game test creates a room, fills remaining seats with test users, starts the game, and drives turns until a winner is declared.

**When to use:** For Pick Red, Big Two, Mahjong -- all card family games.

**Example (Pick Red full-round):**
```javascript
// Source: Based on existing test-logic/mahjong-logic.test.js pattern
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { getPickRedRoomManager } = require("../lib/card/pickred-manager");

describe("Pick Red full-round smoke test", () => {
  let manager;

  beforeEach(() => {
    global.pickRedRoomManager = null;
    manager = getPickRedRoomManager();
    manager.io = { to: () => ({ emit: () => {} }) };
  });

  afterEach(() => {
    // Clear all timers
    for (const room of manager.rooms.values()) {
      clearTimeout(room.turnTimer);
    }
    manager.rooms.clear();
  });

  it("plays a full round to winner declaration", () => {
    const owner = { id: "p1", username: "p1", displayName: "Player 1" };
    const joiner = { id: "p2", username: "p2", displayName: "Player 2" };
    const room = manager.createRoom(owner);
    manager.joinRoom(room.roomNo, joiner);
    manager.setReady(room.roomNo, "p1", true);
    manager.setReady(room.roomNo, "p2", true);

    assert.equal(room.state, "playing");

    // Drive turns until round ends
    let safety = 200;
    while (room.round && room.round.stage === "playing" && safety-- > 0) {
      const currentSeat = room.round.currentTurn;
      const userId = room.players[currentSeat].userId;
      const hand = room.round.hands[currentSeat];

      // Try to match a pair first
      let matched = false;
      if (room.round.tableCards.length > 0) {
        for (const handCard of hand) {
          for (const tableCard of room.round.tableCards) {
            try {
              manager.matchPair(room.roomNo, userId, handCard.id, tableCard.id);
              matched = true;
              break;
            } catch {}
          }
          if (matched) break;
        }
      }

      if (!matched) {
        // Draw or discard
        if (room.round.deck.length > 0) {
          manager.drawCard(room.roomNo, userId);
        } else if (hand.length > 0) {
          manager.discardCard(room.roomNo, userId, hand[0].id);
        }
      }
    }

    assert.equal(room.round.stage, "finished");
    assert.ok(room.lastResult);
    assert.ok(room.lastResult.winnerSeatIndex !== undefined);
  });
});
```

### Pattern 2: Full-Round Action Game Smoke Test

Action games (Racing, Fighting) use real-time server loops. The test strategy is to create a room, start the game, then either:
- **Option A:** Directly manipulate room state to simulate a winner (fastest, most deterministic)
- **Option B:** Run the game loop with accelerated time (more realistic but slower)

**Recommendation:** Use Option A for smoke tests -- directly set the win condition. The existing unit tests already verify the physics and combat logic in detail. The smoke test only needs to prove the full lifecycle works end-to-end.

**Example (Fighting full-round):**
```javascript
// Strategy: Create room, start game, directly set one character to KO
it("plays a full round to winner declaration", () => {
  // ... create room, join, setReady, startGame ...
  // Directly trigger a round finish
  manager.finishRound(room, 0); // Player 0 wins round 1
  // Continue until match winner
  assert.equal(room.state, "finished"); // or "waiting" with lastResult
});
```

**Example (Racing full-round):**
```javascript
// Strategy: Create room, start race, directly trigger finishRace
it("plays a full race to winner declaration", () => {
  // ... create room, join, setReady, startRace ...
  manager.finishRace(room, room.players[0]); // Player 0 finishes first
  assert.ok(room.lastResult);
  assert.equal(room.lastResult.winnerSeatIndex, 0);
});
```

### Pattern 3: Reconnection Smoke Test

Based on existing `test-logic/session-recovery.test.js` pattern. Create room, join, register socket, unregister (disconnect), verify presenceState changes to "reconnecting", register new socket, verify recovery.

**Example:**
```javascript
it("reconnection recovers hand state after mid-game disconnect", () => {
  // ... create room, join, start game ...
  const handBefore = room.round.hands[0].length;

  // Disconnect
  manager.registerSocket(roomNo, "p1", { id: "sock-1", join: () => {} });
  manager.unregisterSocket("sock-1");

  // Verify reconnecting state
  const seat = room.players[0];
  assert.equal(seat.connected, false);
  assert.equal(seat.presenceState, "reconnecting");

  // Reconnect
  manager.registerSocket(roomNo, "p1", { id: "sock-2", join: () => {} });
  assert.equal(seat.connected, true);

  // Verify hand preserved
  assert.equal(room.round.hands[0].length, handBefore);
});
```

### Anti-Patterns to Avoid

- **Don't use Playwright for full-round game logic tests.** Playwright tests should verify page loads and UI elements, not drive game logic. Use `test-logic/` for game flow verification.
- **Don't use real-time loops for action game smoke tests.** Running a 20Hz or 60Hz loop in a test is slow and flaky. Directly manipulate state to trigger win conditions.
- **Don't create separate test scripts.** Add new test files to existing `test:logic:critical` and `test:ui:critical` scripts (D-06).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Room lifecycle | Custom room creation logic | `manager.createRoom()`, `joinRoom()`, `setReady()` | Already battle-tested across all game types |
| Bot seat filling | Custom bot logic | `manager.addBot()` if available, or multiple test users | Test users are simpler and more deterministic |
| Reconnection simulation | WebSocket disconnect/reconnect | `manager.registerSocket()` / `unregisterSocket()` | Direct API is faster and more reliable than WebSocket manipulation |
| Catalog state flip | Custom migration script | Direct edit to `lib/games/catalog.js` | Single file, 4 lines to change |

**Key insight:** The room manager APIs are designed to be testable. Every game flow action (draw, play, discard, claim, match) is exposed as a direct method call. No need to simulate socket events or HTTP requests for logic tests.

## Common Pitfalls

### Pitfall 1: Turn Timer Leaks in Tests
**What goes wrong:** Tests hang or leak timers because room managers schedule turn timers that never get cleared.
**Why it happens:** `startGame()` / `startRace()` / `startRound()` schedule `setTimeout` for turn timeouts.
**How to avoid:** Always clear `room.turnTimer` in `afterEach`. For racing/fighting, clear `room.gameLoopTimer` or equivalent.
**Warning signs:** Test suite hangs, "open handle" warnings from Node test runner.

### Pitfall 2: Global Singleton State Bleeding Between Tests
**What goes wrong:** Tests interfere with each other because room managers are singletons stored on `global.*`.
**Why it happens:** `getPickRedRoomManager()` returns `global.pickRedRoomManager` which persists across tests.
**How to avoid:** Set `global.pickRedRoomManager = null` in `beforeEach` to force a fresh instance.
**Warning signs:** Tests pass individually but fail when run together.

### Pitfall 3: Big Two Requires Exactly 4 Players
**What goes wrong:** Big Two `maybeStartRoom` checks `room.players.length < MAX_PLAYERS` (4). Tests with fewer players silently never start.
**Why it happens:** Unlike Pick Red (2 players), Big Two requires exactly 4.
**How to avoid:** Always join 4 test users and set all 4 ready.
**Warning signs:** Room stays in "waiting" state after setReady calls.

### Pitfall 4: Action Game Win Conditions Require Specific State
**What goes wrong:** Directly calling `finishRace()` or `finishRound()` without proper room state causes errors.
**Why it happens:** The finish methods expect room to be in "playing" state with initialized game state.
**How to avoid:** Always call `startGame()` / `startRace()` before attempting to trigger finish.
**Warning signs:** "Cannot read property of null" errors when accessing `room.round`.

### Pitfall 5: Catalog Flip Breaks Discovery Tests
**What goes wrong:** Changing `launchState` to `live` changes the hub discovery output, breaking existing `test-logic/hub-room-entry.test.js`.
**Why it happens:** The discovery test asserts specific `state` values for games. Changing `coming-soon` to `live` changes these assertions.
**How to avoid:** Update hub-room-entry test assertions to match new `launchState` values.
**Warning signs:** `test:logic:critical` fails after catalog flip.

## Code Examples

### Full-Round Pick Red Smoke Test
```javascript
// Source: Based on lib/card/pickred-manager.js API
const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { getPickRedRoomManager } = require("../lib/card/pickred-manager");
const { __testing: directoryTesting } = require("../lib/rooms/directory");

describe("Pick Red - full-round smoke", () => {
  let manager;

  beforeEach(() => {
    global.pickRedRoomManager = null;
    directoryTesting.resetRoomDirectory();
    manager = getPickRedRoomManager();
    manager.io = { to: () => ({ emit: () => {} }) };
  });

  afterEach(() => {
    for (const room of manager.rooms.values()) {
      clearTimeout(room.turnTimer);
    }
    manager.rooms.clear();
  });

  it("full round produces a winner", () => {
    const p1 = { id: "pr1", username: "pr1", displayName: "P1" };
    const p2 = { id: "pr2", username: "pr2", displayName: "P2" };
    const room = manager.createRoom(p1);
    manager.joinRoom(room.roomNo, p2);
    manager.setReady(room.roomNo, "pr1", true);
    manager.setReady(room.roomNo, "pr2", true);

    assert.equal(room.state, "playing");
    assert.ok(room.round);
    assert.equal(room.round.hands.length, 2);
    assert.equal(room.round.hands[0].length, 8);
    assert.equal(room.round.hands[1].length, 8);

    // Drive game to completion
    let safety = 300;
    while (room.round.stage === "playing" && safety-- > 0) {
      const turn = room.round.currentTurn;
      const uid = room.players[turn].userId;
      const hand = room.round.hands[turn];

      let acted = false;
      // Try match pair
      for (const hc of hand) {
        for (const tc of room.round.tableCards) {
          try { manager.matchPair(room.roomNo, uid, hc.id, tc.id); acted = true; break; }
          catch {}
        }
        if (acted) break;
      }

      if (!acted) {
        if (room.round.deck.length > 0) {
          manager.drawCard(room.roomNo, uid);
        } else if (hand.length > 0) {
          manager.discardCard(room.roomNo, uid, hand[0].id);
        }
      }
    }

    assert.equal(room.round.stage, "finished");
    assert.ok(room.lastResult);
  });
});
```

### Full-Round Big Two Smoke Test
```javascript
// Source: Based on lib/card/bigtwo-manager.js API
it("full round produces a winner", () => {
  const players = [
    { id: "bt1", username: "bt1", displayName: "BT1" },
    { id: "bt2", username: "bt2", displayName: "BT2" },
    { id: "bt3", username: "bt3", displayName: "BT3" },
    { id: "bt4", username: "bt4", displayName: "BT4" },
  ];
  const room = manager.createRoom(players[0]);
  for (let i = 1; i < 4; i++) manager.joinRoom(room.roomNo, players[i]);
  for (const p of players) manager.setReady(room.roomNo, p.id, true);

  assert.equal(room.state, "playing");

  // Drive game: each turn, play lowest single card or pass
  let safety = 500;
  while (room.round.stage === "playing" && safety-- > 0) {
    const turn = room.round.currentTurn;
    const uid = room.players[turn].userId;
    const hand = room.round.hands[turn];

    if (hand.length === 0) break;

    try {
      // Play lowest card as single
      const sorted = [...hand].sort((a, b) => a.rank - b.rank || a.suit - b.suit);
      manager.playHand(room.roomNo, uid, [sorted[0].id]);
    } catch {
      try { manager.passTurn(room.roomNo, uid); }
      catch {}
    }
  }

  assert.equal(room.round.stage, "finished");
  assert.ok(room.lastResult);
});
```

### Full-Round Mahjong Smoke Test (Wall Exhaustion)
```javascript
// Source: Based on lib/card/mahjong-manager.js API
// Mahjong ends when wall is exhausted (draw/流局) or someone wins
it("full round reaches conclusion (draw or win)", () => {
  // ... create room with 4 players, setReady ...
  // Empty the wall to force a draw
  room.round.wall.length = 0;
  manager.drawTile(room.roomNo, "u1");

  assert.equal(room.state, "waiting");
  assert.ok(room.lastResult);
  assert.equal(room.lastResult.winMethod, "draw");
});
```

### Full-Round Racing Smoke Test
```javascript
// Source: Based on lib/racing/manager.js API
it("full race produces a winner", () => {
  // ... create room with 2-4 players, setReady, startRace ...
  // Directly trigger finish
  manager.finishRace(room, room.players[0]);
  assert.ok(room.lastResult);
  assert.equal(room.lastResult.winnerSeatIndex, 0);
});
```

### Full-Round Fighting Smoke Test
```javascript
// Source: Based on lib/fighting/manager.js API
it("full match produces a winner (best of 3)", () => {
  // ... create room with 2 players, setReady, startRound ...
  // Win 2 rounds for player 0
  manager.finishRound(room, 0); // Round 1
  manager.finishRound(room, 0); // Round 2
  assert.ok(room.lastResult);
  assert.equal(room.lastResult.winnerSeatIndex, 0);
});
```

### Reconnection Smoke Test (Generic Pattern)
```javascript
// Source: Based on test-logic/session-recovery.test.js
it("reconnection recovers hand state", () => {
  // ... create room, join, start game ...
  const handBefore = [...room.round.hands[0]];

  const sock1 = { id: "recon-1", join: () => {} };
  manager.registerSocket(roomNo, userId, sock1);
  manager.unregisterSocket("recon-1");

  assert.equal(room.players[0].connected, false);
  assert.equal(room.players[0].presenceState, "reconnecting");

  const sock2 = { id: "recon-2", join: () => {} };
  manager.registerSocket(roomNo, userId, sock2);

  assert.equal(room.players[0].connected, true);
  assert.deepEqual(room.round.hands[0], handBefore);
});
```

## Runtime State Inventory

> Not applicable -- this phase is not a rename/refactor/migration. No runtime state to audit.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | None | N/A |
| Live service config | None | N/A |
| OS-registered state | None | N/A |
| Secrets/env vars | None | N/A |
| Build artifacts | None | N/A |

## Common Pitfalls (Rollout Specific)

### Pitfall 6: Catalog Flip Changes Hub Discovery Assertions
**What goes wrong:** Existing `test-logic/hub-room-entry.test.js` asserts `state: "coming-soon"` for games like `uno` and `bowling`. After flipping `launchState` to `live` for the 5 new games, the discovery output changes.
**Why it happens:** The `buildHubFamilies` function uses `launchState` and `isShipped` to determine display state.
**How to avoid:** After flipping catalog, update any test assertions that reference the old `launchState` values for the 5 games. The new games should show `state: "playable"` instead of `state: "coming-soon"`.
**Warning signs:** `test:logic:critical` fails with assertion mismatches on `state` or `stateLabel`.

### Pitfall 7: Fighting is Already `live` -- Don't Double-Flip
**What goes wrong:** Accidentally modifying Fighting's `launchState` or `isShipped` when they're already correct.
**Why it happens:** Fighting was set to `live` and `isShipped: true` in Phase 21.
**How to avoid:** Only modify 4 entries (pickred, bigtwo, mahjong, racing). Leave fighting unchanged.
**Warning signs:** Git diff shows unnecessary changes to fighting entry.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All tests | ✓ | 24.15.0 | — |
| npm | Test scripts | ✓ | 11.12.1 | — |
| Playwright | UI tests | ✓ | 1.59.1 | — |
| Docker | Release gate | ✓ | 28.4.0 | — |
| 3100 frontend | Integration tests | ✓ | running (200) | — |
| 3101 backend | Integration tests | ✓ | running (200) | — |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | node:test (built-in, Node 24.15.0) |
| Config file | none (runner flags in package.json scripts) |
| Quick run command | `node --test test-logic/pickred-logic.test.js` |
| Full suite command | `npm run test:logic:critical` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-06 | Deployed smoke tests pass for each new game | unit (logic) | `node --test test-logic/pickred-logic.test.js` | NO - Wave 0 |
| PLAT-06 | Deployed smoke tests pass for each new game | unit (logic) | `node --test test-logic/bigtwo-logic.test.js` | NO - Wave 0 |
| PLAT-06 | Deployed smoke tests pass for each new game | unit (logic) | `node --test test-logic/mahjong-logic.test.js` | YES (extend) |
| PLAT-06 | Deployed smoke tests pass for each new game | unit (logic) | `node --test test-logic/racing-logic.test.js` | YES (extend) |
| PLAT-06 | Deployed smoke tests pass for each new game | unit (logic) | `node --test test-logic/fighting-logic.test.js` | YES (extend) |
| PLAT-06 | UI smoke tests pass for each new game | e2e (playwright) | `playwright test tests/pickred-entry.spec.js` | NO - Wave 0 |
| PLAT-06 | UI smoke tests pass for each new game | e2e (playwright) | `playwright test tests/bigtwo-entry.spec.js` | NO - Wave 0 |
| PLAT-06 | UI smoke tests pass for each new game | e2e (playwright) | `playwright test tests/mahjong.spec.js` | YES (extend) |
| PLAT-06 | UI smoke tests pass for each new game | e2e (playwright) | `playwright test tests/racing-entry.spec.js` | YES (exists) |
| PLAT-06 | All games live in rollout | unit (logic) | Catalog assertion in test | NO - Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test test-logic/<game>-logic.test.js` (per-game)
- **Per wave merge:** `npm run test:logic:critical && npm run test:ui:critical`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `test-logic/pickred-logic.test.js` -- covers PLAT-06 (Pick Red full-round + reconnection)
- [ ] `test-logic/bigtwo-logic.test.js` -- covers PLAT-06 (Big Two full-round + reconnection)
- [ ] `tests/pickred-entry.spec.js` -- covers PLAT-06 (Pick Red UI smoke)
- [ ] `tests/bigtwo-entry.spec.js` -- covers PLAT-06 (Big Two UI smoke)
- [ ] Extend `test-logic/mahjong-logic.test.js` with full-round + reconnection tests
- [ ] Extend `test-logic/racing-logic.test.js` with full-round + reconnection tests
- [ ] Extend `test-logic/fighting-logic.test.js` with full-round + reconnection tests
- [ ] Update `package.json` `test:logic:critical` and `test:ui:critical` scripts with new files
- [ ] Update catalog assertions in `test-logic/hub-room-entry.test.js` after rollout flip

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Tests use mock users, no real auth |
| V3 Session Management | no | Tests exercise session recovery but no new auth code |
| V4 Access Control | no | No new admin or access control changes |
| V5 Input Validation | no | No new input paths |
| V6 Cryptography | no | No new crypto operations |

**Rationale:** Phase 22 is a verification phase only. No new code paths are introduced that require security review. The only code change is flipping catalog fields and adding test files.

## Sources

### Primary (HIGH confidence)
- `scripts/verify-release.js` -- Release gate script, read and analyzed
- `lib/games/catalog.js` -- Game catalog with launchState/isShipped fields, read and analyzed
- `test-logic/session-recovery.test.js` -- Reconnection test pattern, read and analyzed
- `test-logic/hub-room-entry.test.js` -- Room entry/discovery test pattern, read and analyzed
- `test-logic/mahjong-logic.test.js` -- Full-round card game test pattern, read and analyzed
- `test-logic/fighting-logic.test.js` -- Action game test pattern, read and analyzed
- `test-logic/racing-logic.test.js` -- Racing test pattern, read and analyzed
- `lib/card/pickred-manager.js` -- Pick Red room manager API, read and analyzed
- `lib/card/bigtwo-manager.js` -- Big Two room manager API, read and analyzed
- `lib/card/mahjong-manager.js` -- Mahjong room manager API (referenced)
- `lib/racing/manager.js` -- Racing room manager API, grep analyzed
- `lib/fighting/manager.js` -- Fighting room manager API, grep analyzed
- `package.json` -- Test scripts, dependencies, read and analyzed
- `docker-compose.yml` -- Stack configuration, read and analyzed
- `.planning/phases/22-release-verification/22-CONTEXT.md` -- User decisions, read and analyzed

### Secondary (MEDIUM confidence)
- `tests/mahjong.spec.js` -- Existing Playwright spec for mahjong, read and analyzed
- `tests/racing-entry.spec.js` -- Existing Playwright spec for racing, read and analyzed
- Environment probes -- Node 24.15.0, npm 11.12.1, Playwright 1.59.1, Docker 28.4.0, stack running

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Racing manager has `finishRace()` method that can be called directly to end a race | Full-Round Action Game Pattern | Test would need alternative approach (e.g., manipulate lap count to trigger automatic finish) |
| A2 | Fighting manager has `finishRound()` method that can be called directly to end a round | Full-Round Action Game Pattern | Test would need to simulate actual combat to KO |
| A3 | `addBot()` is available on all 5 game managers | Bot-Assisted Testing | Tests would need to use multiple test users instead of bots |
| A4 | Big Two `playHand()` accepts an array of card IDs for all valid hand types | Full-Round Big Two | May need to verify the exact API signature |
| A5 | Hub discovery test assertions in `test-logic/hub-room-entry.test.js` reference `state` values for the 5 new games | Rollout Flip Pitfall | If assertions don't reference these games, no update needed |

## Open Questions (RESOLVED)

1. **Do Racing and Fighting managers expose `finishRace()` / `finishRound()` as public methods?** — **RESOLVED**
   - Racing: `finishRace(room, winner)` is defined at line 283 of `lib/racing/manager.js` and exported via `module.exports` at line 794. Public method.
   - Fighting: `handleRoundEnd(room, winnerSeatIndex)` is defined at line 358 of `lib/fighting/manager.js` and exported via `module.exports` at line 899. Public method.
   - Both are callable from tests.

2. **Should the rollout flip be a separate plan or combined with test creation?** — **RESOLVED**
   - Plans use separate Plan 03 at wave 2 (after Plans 01 and 02 complete). Matches D-04 "all at once after all tests pass."

3. **Do existing hub-entry tests assert `coming-soon` state for the 5 new games?** — **RESOLVED**
   - `test-logic/hub-room-entry.test.js` line 94: `assert.equal(uno.state, "coming-soon")` — will need updating after catalog flip.
   - Line 1512: counts `coming-soon` entries — will also need updating.
   - Plan 03 Task 2 addresses these updates.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all tools verified via environment probes and existing code
- Architecture: HIGH -- patterns derived from reading existing test files and managers
- Pitfalls: HIGH -- all pitfalls derived from code analysis of existing test patterns and manager behavior

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable -- no external dependency changes expected)
