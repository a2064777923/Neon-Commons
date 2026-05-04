# Project Research Summary

**Project:** Hong's Neon-Commons
**Domain:** Browser-based real-time party arcade (5 new games)
**Milestone:** v1.3 Wave 3 遊戲擴充
**Researched:** 2026-05-04
**Confidence:** MEDIUM

## Executive Summary

Wave 3 expands the platform with five new games across two distinct complexity tiers. Three card-family games (Mahjong, Big Two, Pick Red) extend the existing turn-based architecture with zero new dependencies -- all game logic is pure JavaScript following the established `lib/{family}/{game}.js` pattern. Two real-time games (Racing, Fighting) require a fundamentally new architecture: a `light-3d` game family with a continuous game loop, delta-state broadcasting, and browser rendering engines (Three.js + cannon-es for Racing, PixiJS for Fighting).

The recommended build order starts with Pick Red (simplest, validates card manager extension), progresses through Big Two and Mahjong (increasing card complexity), then tackles Racing (creates the entire real-time infrastructure), and finishes with Fighting (reuses Racing's real-time infrastructure). This order minimizes risk by deferring the architectural unknowns (real-time networking, 3D rendering) until the well-understood card games are shipped.

The highest-risk items are: (1) Mahjong hand recognition algorithm -- recursive backtracking with 100+ test fixtures is non-negotiable; (2) real-time state synchronization for 3D games -- the existing full-state-push socket pattern cannot work at 20Hz, requiring a new delta-update event family; and (3) Big Two's non-standard card ranking (2-high, suit comparison, no wrapping straights) which is a common source of logic bugs.

## Key Findings

### Recommended Stack

See [STACK.md](./STACK.md) for full details.

**New production dependencies (3 total):**
- `three` ^0.172.0: 3D scene rendering for Racing -- de facto standard for browser 3D, lighter than Babylon.js, integrates with React via dynamic import
- `cannon-es` ^0.20.0: 3D physics for car movement/collision -- clean ES module API, maintained fork of cannon.js, sufficient for 2-6 car racing
- `pixi.js` ^8.6.0: 2.5D sprite rendering for Fighting -- WebGL-accelerated sprite batching, lighter than Phaser, pure renderer that fits React architecture

**Zero new dependencies for card games.** Mahjong, Pick Red, and Big Two follow the existing pattern: all game logic in plain JS modules under `lib/card/`. No npm packages for card/tile handling, scoring, or hand recognition.

**Audio:** Web Audio API (native browser), no Howler.js or Tone.js needed.
**Networking:** Socket.IO 4.8.1 already present; real-time games use it at 20Hz with client-side interpolation (not competitive-esports grade, but appropriate for party games).

### Expected Features

See [FEATURES.md](./FEATURES.md) for full details.

**Must have (table stakes) per game:**
- **Mahjong:** 144-tile set, draw/discard cycle, chi/pong/kong claiming, win detection (4 melds + pair, seven pairs, thirteen orphans), fan scoring, bot AI, turn timer
- **Pick Red:** 52-card deck, capture rules (same-rank, sum-to-10, face cards), hand refill, scoring (red card counting + bonuses), bot AI
- **Big Two:** 52-card deck, 13 cards/player, all hand types (single through straight flush), non-standard comparison (2-high, suit order), pass mechanism, 3-of-diamonds start
- **Racing:** 3D track, car physics, real-time multiplayer sync, lap tracking, minimap, start countdown
- **Fighting:** Character sprite animation, hitbox/hurtbox system, health bars, basic attacks, block, round system (best of 3), character selection

**Should have (differentiators) -- defer most to post-launch:**
- Mahjong: score breakdown display, tile drag-to-sort
- Big Two: hand suggestion, card sorting options
- Racing: drift mechanics, power-ups
- Fighting: combo system, super meter, multiple characters

**Defer to v2+:**
- Mahjong: multiple rule variants (Riichi, Hong Kong), replay system
- Racing: track editor, vehicle customization, photo-realistic graphics
- Fighting: rollback netcode, tutorial mode, 3+ character roster (start with 2)

### Architecture Approach

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

The five games decompose into two architectural categories:

**Card family (Mahjong, Pick Red, Big Two):** Extend the existing card room pattern. Each game creates a pure logic module (`lib/card/{game}.js`) that owns rules, state transitions, and serialization. The card room manager handles lifecycle (create, join, ready, reconnect, expiry). Reuses `room:*` / `game:*` socket events. Mahjong may need a `game:action` event for chi/pong/kong declarations.

**Action family (Racing, Fighting):** New `light-3d` family with its own room manager (`lib/action/manager.js`), shared game loop (`lib/action/game-loop.js`), and socket event family (`action:subscribe`, `action:input`, `action:update`, `action:snapshot`). Key differences from turn-based: 20Hz server tick, input buffering, delta-state broadcasting (not full-state-push), client-side interpolation. Both games share this infrastructure; Fighting adds only its own game logic module.

**Major components to create:**
1. `lib/card/manager.js` -- Card room lifecycle manager (if not existing; extends party/board pattern)
2. `lib/card/{mahjong,pickred,bigtwo}.js` -- Pure game logic modules
3. `lib/action/manager.js` -- Real-time room manager with game loop
4. `lib/action/game-loop.js` -- Fixed timestep loop, input batching, delta computation
5. `lib/action/{racing,fighting}.js` -- Real-time game logic modules
6. `lib/shared/network-contract.js` -- New `action:*` socket events + API routes
7. `lib/games/catalog.js` -- 5 new game entries, `light-3d` family activation
8. `lib/admin/control-plane.js` -- New family rollout/availability controls

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for the full list of 20 pitfalls.

1. **Mahjong hand recognition errors** -- Greedy decomposition misses valid wins. Prevention: recursive backtracking algorithm, 100+ test fixtures covering all edge cases (seven pairs, thirteen orphans, kong hands). Separate decomposition from scoring. This is the single highest-risk logic item.

2. **Real-time state desync (Racing/Fighting)** -- Reusing the existing full-state-push pattern for 20Hz updates causes rubber-banding and input lag. Prevention: design a new `action:*` socket family with delta-only updates BEFORE building any 3D game logic. Client-side prediction for Racing; lockstep input-based networking for Fighting.

3. **Big Two card ranking bugs** -- Non-standard ranking (3 < 2, suit matters, no wrapping straights) causes subtle comparison errors. Prevention: explicit total ordering function, comprehensive edge-case tests (Q-K-A-2-3 rejection, 2-of-spades vs everything).

4. **New game family breaking hub contract** -- Adding `light-3d` family without updating all `familyKey` references (catalog, socket-server, admin control-plane, hub API, lobby pages) causes silent failures. Prevention: trace every `familyKey` reference before implementing game logic.

5. **In-memory room state explosion** -- 3D game rooms with physics state are 10-50x larger than board game rooms. Prevention: keep server state minimal (positions + velocities only), let clients own visual interpolation, set per-room memory budgets.

## Implications for Roadmap

Based on the combined research, the five games should be delivered in 5 phases within a single milestone. The ordering is driven by: (a) dependency chains (card manager before card games; action infrastructure before action games), (b) complexity gradient (simple games first to validate patterns), and (c) risk deferral (real-time architecture is the biggest unknown, so build it after card games are shipping).

### Phase 1: Card Family Foundation + Pick Red (撿紅點)

**Rationale:** Pick Red is the simplest game (2 players, basic card matching). It validates the card family manager extension pattern with minimal risk. If the card manager does not yet exist as a standalone module, this phase creates it. This is the lowest-risk entry point.

**Delivers:**
- `lib/card/manager.js` (if not existing) -- card room lifecycle, following party/board manager pattern
- `lib/card/pickred.js` -- Pick Red game logic (~150-200 lines)
- Catalog + network-contract updates for `pickred` (familyKey: "card")
- REST handlers for card rooms (if not existing)
- Frontend: Pick Red room page with CSS card rendering
- Bot AI (greedy matching heuristics)

**Addresses:** Pick Red table stakes (card deck, capture rules, scoring, bot AI, turn timer)
**Avoids:** Pitfall 6 (rule ambiguity) -- document the exact rule variant before coding; Pitfall 18 (config defaults) -- always provide defaults for new config fields

### Phase 2: Big Two (大老二)

**Rationale:** Second card family game. Validates 4-player card rooms and more complex hand-type validation. Reuses the card manager from Phase 1. The hand-type detection and comparison logic is the core challenge.

**Delivers:**
- `lib/card/bigtwo.js` -- Big Two game logic (~400-600 lines)
- Catalog update for `bigtwo` (familyKey: "card", 4 players)
- Frontend: Big Two room page with hand-type display
- Bot AI (greedy shedding with hand-type awareness, NOT random)

**Addresses:** Big Two table stakes (all hand types, comparison logic, pass mechanism, 3-of-diamonds start)
**Avoids:** Pitfall 3 (card ranking bugs) -- explicit total ordering function with edge-case tests; Pitfall 11 (bad bot AI) -- implement basic heuristics, not random selection; Pitfall 15 (starting player) -- deterministic 3-of-diamonds scan after deal

### Phase 3: Mahjong (麻將)

**Rationale:** Most complex card-family game. 4 players, 136 tiles, multiple simultaneous declaration windows (chi/pong/kong/hu), complex fan scoring. Build last among card games to leverage the validated 4-player card room pattern from Phase 2. This is the highest-complexity logic item.

**Delivers:**
- `lib/card/mahjong.js` -- Mahjong game logic (~500-800 lines, largest single module)
- Possible new socket events (`game:action` for declarations) in card namespace
- Catalog update for `mahjong` (familyKey: "card", 4 players)
- Frontend: Mahjong room page with tile rendering (CSS/SVG, NOT DOM-per-tile -- use canvas or sprite sheets)
- Bot AI (tile efficiency heuristics)
- Flower tile handling (auto-reveal, auto-replacement)
- Fan scoring system (Taiwan style: 16 base patterns minimum)

**Addresses:** Mahjong table stakes (tile set, draw/discard, chi/pong/kong, win detection, fan scoring)
**Avoids:** Pitfall 1 (hand recognition errors) -- recursive backtracking with 100+ test fixtures, separate decomposition from scoring; Pitfall 2 (tile wall management) -- single authoritative tile pool with count assertions at every transition; Pitfall 10 (mobile rendering performance) -- use canvas/sprite sheets, not individual DOM elements; Pitfall 13 (flower tiles) -- explicit post-deal phase for flowers

### Phase 4: Racing (賽車) -- Action Family Infrastructure + First Real-Time Game

**Rationale:** First real-time game. Creates the entire `light-3d` / action family infrastructure from scratch: room manager with game loop, delta-state broadcasting, input buffering, new socket event family. This is the highest-risk phase because it introduces a new architectural pattern. Three.js + cannon-es for rendering/physics.

**Delivers:**
- `lib/action/manager.js` -- Real-time room manager (20Hz game loop, input buffering, delta broadcast)
- `lib/action/game-loop.js` -- Shared fixed-timestep loop infrastructure
- `lib/action/racing.js` -- Racing game logic (track, car physics, lap tracking, finish detection)
- Socket events: `action:*` family (subscribe, ready, input, update, snapshot)
- REST handlers: `/api/action/rooms/*`
- `network-contract.js` updates for action family
- Catalog update for `racing` (familyKey: "light-3d")
- Admin control-plane updates for new family rollout/availability
- Frontend: Racing page with dynamic Three.js import (NOT in main bundle)
- `cannon-es` physics integration (car movement, collision)
- Simple oval track for MVP (not complex circuit)
- Client-side interpolation for smooth rendering

**Addresses:** Racing table stakes (3D track, car physics, multiplayer sync, lap tracking, minimap)
**Uses:** `three` ^0.172.0, `cannon-es` ^0.20.0 (new dependencies)
**Avoids:** Pitfall 4 (real-time desync) -- design action socket family with delta updates, not full-state-push; Pitfall 5 (memory explosion) -- minimal server state, client owns rendering; Pitfall 7 (hub contract break) -- register light-3d family in all touchpoints BEFORE game logic; Pitfall 8 (socket collision) -- new action:* namespace, never reuse board:*/party:* events; Pitfall 12 (collision mesh complexity) -- separate visual and collision meshes, start with simple oval; Pitfall 16 (asset loading) -- progressive loading with loading screen; Pitfall 20 (disconnect recovery) -- respawn-based rejoin, not physics replay

### Phase 5: Fighting (打斗) -- Second Real-Time Game

**Rationale:** Second real-time game. Reuses the action family infrastructure from Phase 4. Only adds fighting-specific logic (hitboxes, frame data, combos, character state machine). PixiJS for 2.5D sprite rendering. This is the most latency-sensitive game; start with delay-based netcode, not rollback.

**Delivers:**
- `lib/action/fighting.js` -- Fighting game logic (character state machine, hitbox/hurtbox, frame data, health/round system)
- Frontend: Fighting page with dynamic PixiJS import (NOT in main bundle)
- Sprite sheet animation system (idle, walk, jump, attack, hit, block per character)
- Input system (keyboard mapping, input buffer)
- Character selection screen (start with 2 characters, not full roster)
- Potential tick rate option (30Hz with client prediction, or 60Hz for fighting)
- Web Audio API integration for hit SFX

**Addresses:** Fighting table stakes (sprite animation, hitbox system, health bars, attacks, block, rounds, character selection)
**Uses:** `pixi.js` ^8.6.0 (new dependency), action manager from Phase 4
**Avoids:** Pitfall 9 (frame-precise hit desync) -- lockstep input-based networking, server relays inputs and validates outcomes; Pitfall 17 (animation state machine) -- explicit state machine with allowed transitions, animation events for hitbox activation; Pitfall 16 (asset loading) -- sprite sheet progressive loading

### Phase Ordering Rationale

1. **Dependency chain:** Card manager (Phase 1) -> 4-player validation (Phase 2) -> complex card game (Phase 3). Action infrastructure (Phase 4) -> second action game (Phase 5).
2. **Complexity gradient:** Pick Red (low) -> Big Two (medium) -> Mahjong (high) -> Racing (very high) -> Fighting (very high). Each phase builds confidence for the next.
3. **Risk deferral:** The real-time architecture (action family, delta-state broadcasting, 3D rendering) is the biggest unknown. Shipping 3 card games first means the milestone delivers value even if the 3D games hit obstacles.
4. **Infrastructure reuse:** Phase 4 creates the entire action family; Phase 5 only adds game-specific logic. This is the most efficient ordering for the real-time games.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Mahjong):** Hand recognition algorithm design needs a detailed technical plan. The recursive backtracking approach and the 100+ test fixture list should be specified before implementation begins. Fan scoring patterns (30+ patterns for Taiwan rules) need a complete enumeration.
- **Phase 4 (Racing):** Real-time networking architecture is greenfield. The delta-state broadcasting protocol, input buffering strategy, and client-side interpolation approach need detailed specification. Three.js scene setup and cannon-es integration patterns need verification against current docs.
- **Phase 5 (Fighting):** Hitbox/hurtbox system design, frame data structure, and character state machine transitions need detailed specification. PixiJS v8 API patterns need verification.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Pick Red):** Simple card game extending well-established patterns. Card rendering, room lifecycle, bot AI all follow existing codebase conventions.
- **Phase 2 (Big Two):** Card game with well-documented rules. Hand-type detection is a solved problem. Only the non-standard ranking needs careful attention (covered by pitfalls).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Three.js, cannon-es, PixiJS choices are well-established; version numbers and bundle sizes from training data, not verified against live npm |
| Features | MEDIUM | Game rules are well-documented for Mahjong and Big Two; Pick Red has regional variants; Racing/Fighting feature scope is based on browser game conventions |
| Architecture | HIGH | Directly analyzed from codebase source files. All integration points, socket events, room manager contracts, and component boundaries are verified. |
| Pitfalls | MEDIUM | Based on codebase analysis and domain expertise. External web validation was not available. |

**Overall confidence:** MEDIUM-HIGH

The card game phases (1-3) have HIGH confidence -- they extend proven patterns with well-understood game rules. The real-time phases (4-5) have MEDIUM confidence -- the architectural approach is sound but the implementation details (delta-state protocol, physics integration, sprite animation) need validation during planning.

### Gaps to Address

1. **npm version verification:** Three.js, cannon-es, and PixiJS version numbers are from training data. Verify latest stable versions against npm before adding to package.json.
2. **Bundle size estimates:** Reported sizes (Three.js ~150KB gzipped, PixiJS ~60KB gzipped, cannon-es ~80KB) are from training data. Measure actual bundle impact after integration.
3. **Card manager existence:** The research assumes `lib/card/manager.js` may not exist as a standalone module (Dou Dizhu may use a separate implementation). Verify during Phase 1 planning.
4. **Pick Red exact rules:** Regional variants exist. The exact scoring rules, deck composition (52 or 54 cards), and capture rules need to be documented and frozen before implementation.
5. **Mahjong variant:** Taiwan rules are assumed (16-tile, 16 base points). Confirm this is the desired variant before Phase 3 planning.
6. **Fighting character assets:** Sprite sheets need to be created or sourced. This is a content production task, not a code task. Plan for asset pipeline during Phase 5 planning.
7. **Real-time tick rate:** 20Hz is assumed for Racing server tick. This needs validation with actual network conditions. Fighting may need 30-60Hz.

## Sources

### Primary (codebase analysis -- HIGH confidence)
- `lib/games/catalog.js` -- game metadata, family catalog, config defaults
- `lib/shared/network-contract.js` -- socket events, API routes, presence states
- `lib/party/manager.js` -- party room manager pattern (model for card/action managers)
- `lib/board/manager.js` -- board room manager pattern
- `lib/board/flyingchess.js` -- game logic module pattern
- `lib/party/drawguess.js` -- game logic module pattern
- `lib/rooms/directory.js` -- shared room directory
- `lib/admin/control-plane.js` -- admin rollout/availability controls
- `docs/architecture/backend-contract.md` -- API/socket ownership
- `docs/overview/project-overview.md` -- platform overview
- `package.json` -- current dependencies

### Secondary (training data -- MEDIUM confidence)
- Three.js documentation and patterns
- PixiJS v8 documentation and patterns
- cannon-es documentation and patterns
- Web Audio API (MDN)
- Mahjong Taiwan rules (well-documented traditional game)
- Big Two rules (well-documented card game)
- Pick Red rules (regional variations exist)

### Tertiary (LOW confidence -- needs validation)
- Bundle size estimates for Three.js, PixiJS, cannon-es
- Latest stable version numbers for npm packages
- Real-time networking performance characteristics at 20Hz over Socket.IO

---
*Research completed: 2026-05-04*
*Ready for roadmap: yes*
