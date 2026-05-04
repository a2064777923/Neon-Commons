# Domain Pitfalls: Wave 3 Game Expansion

**Domain:** Browser-based real-time party arcade (5 new games)
**Researched:** 2026-05-04
**Overall confidence:** MEDIUM (domain expertise + codebase analysis; WebSearch unavailable for external validation)

## Critical Pitfalls

Mistakes that cause rewrites, data corruption, or major regressions.

### Pitfall 1: Mahjong Hand Recognition Algorithm Errors

**What goes wrong:** Mahjong has 144 tiles with suits (萬/條/筒 1-9), winds (東南西北), dragons (中發白), and flowers (梅蘭竹菊). The "winning hand" algorithm must check all valid decompositions of 14 tiles into melds (sequences of 3, triplets of 3) plus a pair. Bug-prone edge cases: seven pairs, thirteen orphans, kong replacement tiles, concealed vs. melded hand scoring differences, and the multiple valid decomposition ambiguity (a hand might decompose into sequences OR triplets differently).

**Why it happens:** Developers implement a greedy decomposition that finds one valid arrangement but misses alternative decompositions that produce higher-scoring hands. Or they forget that the same tile group can be interpreted as a sequence OR a triplet depending on the rest of the hand.

**Consequences:** Players see incorrect win detection, wrong scoring, or the game accepts illegal winning claims. Community trust erodes instantly for a tile game with incorrect hand evaluation.

**Prevention:**
- Implement a recursive backtracking hand decomposition algorithm, NOT greedy
- Build a comprehensive test fixture of 100+ known hands with expected results, covering: standard win, seven pairs, thirteen orphans, all triplets, half flush, full flush, mixed terminals, kong hands
- Separate hand decomposition (logic) from scoring (番數 calculation) -- do not mix them
- Validate against a reference implementation (e.g., Japanese Mahjong League rules or Chinese Official rules reference)

**Detection:** Players report winning hands that should not win, or failing to recognize valid wins. Scoring disputes.

**Phase:** Should address in the very first Mahjong phase (pure logic). Hand recognition is the foundation -- everything else depends on it.

---

### Pitfall 2: Mahjong Tile Wall Management and Draw Exhaustion

**What goes wrong:** The 144-tile wall must be shuffled, dealt (each player gets 13 tiles, dealer gets 14), and drawn from during play. Bugs appear in: initial deal distribution, dead wall management (for kong replacements), wall exhaustion handling (draw game / 流局), and ensuring the same tile cannot appear twice.

**Why it happens:** Developers track tiles as a simple array and forget to properly remove drawn tiles, or they mishandle the dead wall boundary. Shuffle bugs produce non-uniform distributions.

**Consequences:** Duplicate tiles appear in players' hands. Draw games trigger at wrong wall positions. Players can draw from the dead wall incorrectly.

**Prevention:**
- Use a single authoritative tile pool object that enforces tile-count integrity
- Assert tile counts at every state transition (total must always be 144)
- Implement wall exhaustion as an explicit state machine transition, not a fallback
- Add unit tests that verify tile uniqueness across all hands after 1000 random deals

**Detection:** Assert tile counts during development. Any count deviation = bug.

**Phase:** First Mahjong phase, alongside hand recognition. Tile pool integrity is foundational.

---

### Pitfall 3: Big Two Card Ranking and Comparison Bugs

**What goes wrong:** Big Two (大老二) uses a non-standard card ranking (3 < 4 < ... < 2, with suit ranking clubs < diamonds < hearts < spades). The valid hand types are: single, pair, triple, straight (5 cards), full house, four-of-a-kind + kicker, and straight flush. Common bugs: incorrect suit comparison (especially for 2 of spades as highest card), straight wrapping (Q-K-A-2-3 is NOT valid), and comparing hands of different types.

**Why it happens:** Developers assume standard poker hand rankings or forget that straights cannot wrap around. Suit comparison order is unusual (standard poker does not compare suits).

**Consequences:** Players can play illegal combinations or win/lose incorrectly. The entire game becomes unfair.

**Prevention:**
- Define explicit card ranking constants with a total ordering function
- Implement a hand classifier that returns {type, rank, suitRank} for any valid combination
- Write comparison tests for every edge case: 2 of spades vs any other single, straight flush vs four-of-a-kind, same-rank different-suit comparisons
- Test that wrapping straights (Q-K-A-2-3, K-A-2-3-4) are rejected

**Detection:** Players report losing to seemingly weaker hands. Impossible combinations appearing.

**Phase:** First Big Two phase (pure logic). Card comparison is the entire game.

---

### Pitfall 4: Real-Time State Desync in 3D Games (Racing / Fighting)

**What goes wrong:** The existing platform uses a simple "server emits full room state, client renders" pattern (see `emitRoom()` in party/manager.js). This works for turn-based games where state changes infrequently. For Racing (60fps physics) and Fighting (frame-precise hit detection), this pattern causes: visible rubber-banding, input lag, and state desync between players.

**Why it happens:** The team tries to reuse the existing `party:update` / `board:update` full-state-push pattern for games that need 20+ updates per second. Socket.IO cannot handle the bandwidth, and clients see stale state.

**Consequences:** Racing cars teleport. Fighting game hit registration feels wrong. Players on slower connections are unplayable.

**Prevention:**
- Design a new socket event family for real-time games (e.g., `rt:state`, `rt:input`) with delta-only updates, not full state pushes
- Implement client-side prediction with server reconciliation for Racing
- Use lockstep or deterministic simulation for Fighting (input-based, not state-based sync)
- Cap server tick rate at 20Hz for Racing, 60Hz for Fighting, with interpolation on client
- This is a NEW architecture pattern, not a reuse of existing room managers

**Detection:** Test with artificial 100ms+ latency. Any rubber-banding or input delay is unacceptable.

**Phase:** Must design the real-time transport contract BEFORE building any 3D game logic. This is a Wave B prerequisite.

---

### Pitfall 5: In-Memory Room State Explosion from 3D Game Physics

**What goes wrong:** The existing room managers store all state in memory (see `this.rooms = new Map()` in both party/manager.js and board/manager.js). Each 3D game room would need to store physics state, collision meshes, particle systems, or animation frames. With many concurrent rooms, memory usage spikes.

**Why it happens:** Developers copy the existing pattern of storing complete game state in the room object. A single racing room with track state, 6 car physics bodies, and collision data could be 10-50x larger than a board game room.

**Consequences:** Server runs out of memory. Single-node architecture cannot scale. Room expiry timers (already in place) help but do not solve the core issue for active rooms.

**Prevention:**
- Keep authoritative game state minimal on server (positions + velocities only, not rendered geometry)
- Let clients own visual/physics interpolation; server only validates and broadcasts
- Set per-room memory budgets and monitor with admin tooling
- Consider whether 3D game rooms need a different lifecycle (shorter expiry, active spectator limits)

**Detection:** Monitor RSS during load testing. Compare memory per room across game types.

**Phase:** Wave B architecture design phase, before implementing any 3D game rooms.

---

## Moderate Pitfalls

### Pitfall 6: Pick Red (撿紅點) Rule Ambiguity Leading to Incorrect Logic

**What goes wrong:** Pick Red is a regional card game with variant rules. Different families play with slightly different scoring (e.g., which cards are "red" cards, point values, end-game conditions). Without a canonical rule source, the implementation may not match player expectations.

**Why it happens:** The game has many local variants. Developers implement one variant without documenting which rules they chose, leading to player complaints from other variant players.

**Consequences:** Player confusion and bug reports that are actually rule disagreements, not bugs.

**Prevention:**
- Document the exact rule variant being implemented BEFORE coding
- Create a rules reference page in the game UI
- Implement scoring as a pure function with named constants for all point values
- Add a rules variant selector in room config if multiple variants are common enough

**Detection:** Players say "in my version, we play it differently."

**Phase:** First Pick Red phase. Define rules before implementing logic.

---

### Pitfall 7: New Game Family (Racing / Fighting) Breaking the Hub Contract

**What goes wrong:** The existing hub (`/api/hub`) and catalog (`lib/games/catalog.js`) assume games belong to families: card, party, board, solo, light-3d. Adding Racing and Fighting requires either expanding the `light-3d` family or creating new families. If done wrong, the hub UI, room creation, room entry, admin rollout, and capability management all break.

**Why it happens:** The catalog, admin control-plane, room directory, and frontend all reference `familyKey`. Adding a new family without updating all touchpoints causes silent failures (rooms created but not visible in hub, admin cannot control rollout).

**Consequences:** Games launch but are invisible in hub. Admin cannot enable/disable them. Room entry links do not work.

**Prevention:**
- Define the new family key(s) in `GAME_FAMILY_CATALOG` and `lib/games/catalog.js` FIRST
- Trace every reference to `familyKey` across: catalog, socket-server.js, room handlers, admin control-plane, hub API, frontend lobby pages
- Add the family to the admin capability and availability control systems
- Write integration tests that verify hub listing, room creation, and room entry for the new family

**Detection:** New game rooms exist but do not appear in hub. Admin shows no rollout controls for new games.

**Phase:** Wave B architecture phase. Family registration must precede game implementation.

---

### Pitfall 8: Socket Event Namespace Collision or Missing Registration

**What goes wrong:** The socket server (`lib/socket-server.js`) registers handlers per family: `room:*` for card, `party:*` for party, `board:*` for board. New games need their own event namespace. If 3D games reuse `board:move`, the payload semantics conflict. If they get a new namespace (e.g., `rt:*`), the socket server must register new handlers.

**Why it happens:** Developers try to shoehorn new game types into existing event namespaces to avoid modifying socket-server.js. The `board:move` event was designed for turn-based board moves, not real-time position updates.

**Consequences:** Payload format mismatches cause silent failures. Existing board games break if their event handler receives racing position data.

**Prevention:**
- Define new socket event constants in `SOCKET_EVENTS` (e.g., `rt:subscribe`, `rt:input`, `rt:state`)
- Add corresponding handler registration in socket-server.js
- Do NOT reuse existing event names with different payload semantics
- Update `assertSocketScope()` for the new family

**Detection:** Socket errors in console. Board game rooms receiving malformed events.

**Phase:** Wave B architecture phase, alongside family registration.

---

### Pitfall 9: Fighting Game Frame-Perfect Hit Detection Desync

**What goes wrong:** 2.5D fighting games require frame-precise hit detection (hitbox intersection at exact frame). If the server validates hits and the client predicts them differently, players see phantom hits (hit on screen but server rejects) or invisible hits (server registers hit but client did not show it).

**Why it happens:** Network latency means the client and server see different game frames. If the server is authoritative on hit detection but the client shows the animation, there is an inherent desync window.

**Consequences:** Competitive fighting game feels unfair. Players with higher latency have a structural disadvantage.

**Prevention:**
- Use input-based (lockstep) networking for Fighting, not state-based
- Both clients simulate deterministically from the same input stream
- Server only relays inputs, validates final outcomes, and resolves disputes
- Accept that Fighting games will need a minimum viable latency (<100ms) to be playable

**Detection:** Hit registration complaints from players with >80ms latency.

**Phase:** Wave B architecture phase. Transport design must account for this BEFORE implementing game logic.

---

### Pitfall 10: Mahjong Tile Rendering Performance on Mobile

**What goes wrong:** Mahjong requires rendering 144 3D tiles (or 2D representations) with 13-16 visible per player, plus the discard pile, meld areas, and wall. On mobile browsers with limited GPU, this can cause frame drops.

**Why it happens:** Developers render each tile as a separate DOM element or 3D mesh. 144 tiles * event listeners * CSS transforms = layout thrashing.

**Consequences:** Game feels sluggish on mobile. Players on older phones cannot play.

**Prevention:**
- Use a single Canvas2D or WebGL context for tile rendering, not individual DOM elements
- Implement tile pooling (only render visible tiles, recycle off-screen ones)
- Use sprite sheets for tile faces, not individual image loads
- Test on a low-end Android device (e.g., Snapdragon 665) as the performance baseline

**Detection:** Frame rate below 30fps on mid-range mobile during a full game.

**Phase:** Mahjong UI phase. Performance testing should happen early, not as an afterthought.

---

### Pitfall 11: Big Two Turn Timer and Bot Integration

**What goes wrong:** Big Two has complex pass/pass/pass/play decisions. If a player passes when they could play, or the bot plays suboptimally, the game feels broken. The existing bot system (see `performBotTurn` in party/manager.js) uses simple random selection, which is inadequate for Big Two.

**Why it happens:** Big Two bots need to evaluate hand strength, track played cards, and decide whether to play or pass strategically. Random play makes bots obviously stupid.

**Consequences:** Players lose interest in bot-filled rooms. Bots pass when they have winning cards.

**Prevention:**
- Implement a basic Big Two bot that tracks remaining cards and plays the lowest valid combination
- Do NOT make bots play randomly -- even a simple heuristic (always play lowest valid) is far better
- Add a "thinking delay" to make bot actions feel natural (already exists in party manager pattern)

**Detection:** Bots make obviously wrong plays (passing with 2 of spades, playing full house when a pair would win).

**Phase:** Big Two game logic phase. Bot logic is part of the core game, not a separate phase.

---

### Pitfall 12: Racing Track Design and Collision Mesh Complexity

**What goes wrong:** 3D racing tracks need collision boundaries, checkpoints, and respawn points. If the collision mesh is too complex, physics simulation lags. If too simple, cars clip through walls.

**Why it happens:** Developers import a detailed 3D track model and use it directly as the collision mesh. The mesh has thousands of polygons when a simplified convex hull would suffice.

**Consequences:** Physics simulation drops below 60fps. Cars phase through track walls on fast turns.

**Prevention:**
- Separate visual mesh from collision mesh (use simplified convex hulls for collision)
- Implement checkpoint-based position validation (car must pass checkpoints in order)
- Use broad-phase collision (spatial hash) before narrow-phase (mesh intersection)
- Start with a simple oval track for MVP, not a complex circuit

**Detection:** Cars clipping through walls. Frame drops during tight turns with multiple cars.

**Phase:** Racing track design phase. Collision architecture must be simple from the start.

---

## Minor Pitfalls

### Pitfall 13: Flower Tile Handling in Mahjong

**What goes wrong:** Flower tiles (梅蘭竹菊, 春夏秋冬) have special rules: they are immediately revealed, the player draws a replacement tile, and they score bonus points. Forgetting to handle flowers breaks the deal flow and scoring.

**Prevention:** Treat flower tiles as a separate phase after initial deal. Auto-reveal, auto-draw replacement, and accumulate bonus score. Add explicit test cases.

**Phase:** Mahjong logic phase.

---

### Pitfall 14: Pick Red Card Shuffling Producing Boring Games

**What goes wrong:** If the shuffle produces many games where no "red" cards are matchable, the game feels tedious.

**Prevention:** After shuffling, verify a minimum number of matchable pairs exist in the initial deal. If not, reshuffle. This is a design decision, not a bug, but affects player retention.

**Phase:** Pick Red logic phase.

---

### Pitfall 15: Big Two Starting Player Identification

**What goes wrong:** The player holding the 3 of clubs must play first. If multiple players claim to have it, or the server does not correctly identify the holder, the game cannot start.

**Prevention:** After dealing, server scans all hands for 3 of clubs and sets the starting turn. This is deterministic -- no ambiguity allowed.

**Phase:** Big Two deal phase.

---

### Pitfall 16: 3D Asset Loading Blocking Game Start

**What goes wrong:** Racing and Fighting games need 3D models, textures, and animations. If these load synchronously, players stare at a blank screen for 5-15 seconds.

**Prevention:**
- Show a loading screen with progress bar immediately
- Load essential assets (track, player character) first, defer decorative assets
- Use progressive loading: start game with low-poly models, swap to high-poly when ready
- Set a maximum load time (10 seconds) and show a "still loading" message with tips

**Phase:** Wave B UI phase.

---

### Pitfall 17: Fighting Game Character Animation State Machine

**What goes wrong:** 2.5D fighting characters have complex animation state machines (idle, walk, jump, attack, hit-stun, block, special). If transitions are not handled correctly, characters get stuck in wrong animations or cancel into impossible states.

**Prevention:**
- Define an explicit state machine with allowed transitions (e.g., can only cancel attack into special on hit frames)
- Use animation events (not timers) for hit-box activation/deactivation
- Test every possible state transition combination

**Phase:** Fighting character implementation phase.

---

### Pitfall 18: Room Config Expansion Breaking Existing Defaults

**What goes wrong:** Adding new config fields for Mahjong (scoring rules, kong handling), Big Two (pass rules), or 3D games (track selection, round count) without proper defaults breaks existing room creation flows.

**Prevention:**
- Always provide sensible defaults in `getPartyDefaultConfig` / `getBoardDefaultConfig` or equivalent
- Use `??` (nullish coalescing) for all new config fields
- Test room creation with empty config object to verify defaults work

**Phase:** Each game's room creation phase.

---

### Pitfall 19: Admin Rollout Controls Missing for New Families

**What goes wrong:** The admin control-plane (`lib/admin/control-plane.js`) manages rollout per `familyKey`. If new families are not added to `ROLLOUT_MANAGED_GAME_KEYS` and `AVAILABILITY_FAMILY_KEYS`, operators cannot enable/disable the new games through the admin UI.

**Prevention:**
- Add new family keys to the availability and rollout systems in the same phase as family registration
- Verify admin can see and control new game families before any game logic is built

**Phase:** Wave B architecture phase, before game implementation.

---

### Pitfall 20: 3D Game Recovery After Disconnect

**What goes wrong:** The existing recovery system (reconnect grace period, presence states) works for turn-based games where the state can be re-sent on reconnect. For real-time 3D games, a 15-second disconnect means the player is hopelessly behind the game state.

**Prevention:**
- For Racing: allow late-joiners and disconnected players to rejoin at a respawn point with current lap progress
- For Fighting: if a player disconnects mid-round, pause the round briefly (3-5 seconds) then give win to the remaining player
- Do NOT try to replay 15 seconds of physics simulation on reconnect

**Phase:** Wave B architecture phase. Recovery strategy must be designed per game type.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Mahjong hand recognition | Greedy decomposition misses valid wins | Recursive backtracking + 100+ test fixtures |
| Mahjong tile pool | Duplicate tiles or incorrect wall management | Single authoritative pool + count assertions at every transition |
| Big Two card comparison | Non-standard ranking bugs (suit order, 2-high, no wrapping straights) | Explicit total ordering function + edge case tests |
| Pick Red rules | Variant ambiguity causes player confusion | Document chosen variant + rules reference in UI |
| New family registration | Hub/admin/entry systems not updated for new families | Trace all familyKey references before implementing game logic |
| 3D real-time transport | Reusing turn-based full-state-push pattern for real-time games | Design new socket event family with delta updates |
| Racing collision | Complex visual mesh used for collision | Separate visual and collision meshes |
| Fighting hit detection | Frame-precise hits desync over network | Lockstep input-based networking, not state-based |
| Bot logic | Random bots make obviously wrong plays | Implement basic heuristics, not random selection |
| Mobile 3D performance | Too many DOM elements or unoptimized 3D rendering | Canvas/WebGL + tile pooling + sprite sheets |
| Room config defaults | New config fields without defaults break room creation | Always provide defaults, test with empty config |
| 3D asset loading | Blocking load times | Progressive loading + loading screen + time limits |
| Disconnect recovery | 15-second grace period inadequate for real-time games | Per-game-type recovery strategy, not one-size-fits-all |

## Sources

- Codebase analysis: `lib/party/manager.js`, `lib/board/manager.js`, `lib/socket-server.js`, `lib/games/catalog.js`, `lib/admin/control-plane.js`, `lib/rooms/directory.js`, `lib/shared/network-contract.js`
- Existing game implementations: `lib/party/drawguess.js`, `lib/party/undercover.js`, `lib/board/flyingchess.js`, `lib/board/reversi.js`
- Frontend patterns: `pages/games/[gameKey].js`, `pages/board/[roomNo].js`, `pages/party/[roomNo].js`
- Platform documentation: `docs/architecture/backend-contract.md`, `docs/overview/project-overview.md`
- Confidence: MEDIUM -- based on codebase analysis and domain expertise. External web validation was not available during this research session.
