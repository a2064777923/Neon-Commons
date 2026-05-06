# Roadmap: Hong's Neon-Commons

## Shipped Milestones

- [x] **v1.2 大跃进** - shipped 2026-05-04. 6 phases, 17 plans, 51 tasks. Archives: [v1.2 roadmap](./milestones/v1.2-ROADMAP.md), [v1.2 requirements](./milestones/v1.2-REQUIREMENTS.md)
- [x] **v1.1 Live Ops & Reliability** - shipped 2026-04-23. 4 phases, 9 plans, 18 tasks. Archives: [v1.1 roadmap](./milestones/v1.1-ROADMAP.md), [v1.1 requirements](./milestones/v1.2-REQUIREMENTS.md)
- [x] **v1.0 milestone** - shipped 2026-04-22. 7 phases, 21 plans, 50 tasks. Archives: [v1.0 roadmap](./milestones/v1.0-ROADMAP.md), [v1.0 requirements](./milestones/v1.0-REQUIREMENTS.md)

## Current Milestone: v1.3 Wave 3 遊戲擴充

**Goal:** Ship five new games across card and action families through the shared hub, room-entry, recovery, and rollout contract.

**Delivery strategy:** Wave A (card games) first, then Wave B (action games). Card games extend the existing card family infrastructure. Action games create a new `light-3d` family with real-time game loop.

## Phases

- [ ] **Phase 17: Pick Red (撿紅點)** - Two-player card game with ten-sum matching; validates card family manager extension
- [ ] **Phase 18: Big Two (大老二)** - Four-player poker with non-standard hand types and ranking
- [ ] **Phase 19: Mahjong (麻將)** - Four-player tile game with chi/pong/kong claiming and fan scoring
- [x] **Phase 20: Racing (賽車)** - Real-time 3D racing with action family infrastructure (Three.js + cannon-es) — completed 2026-05-05
- [ ] **Phase 21: Fighting (打斗)** - 2.5D fighting game with sprite animation and hitbox system (PixiJS)
- [ ] **Phase 22: Release Verification** - Deployed smoke tests and integration verification for all 5 games

## Phase Details

### Phase 17: Pick Red (撿紅點)
**Goal**: Players can create, join, and play Pick Red rooms through the hub with full game logic and reconnection support
**Depends on**: Nothing (first phase of milestone)
**Requirements**: PICK-01, PICK-02, PICK-03, PICK-04, PICK-05, PICK-06, PICK-07, PICK-08, PICK-09, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. Player can create a Pick Red room from the hub and another player can join via room number
  2. Two players can play a complete round: draw cards, match red-suit pairs summing to 10, and see correct scoring at round end
  3. Turn timer auto-passes when a player does not act within the time limit
  4. Player can reconnect after disconnect and recover their hand state
  5. Pick Red appears in the hub game list with correct icon and admin can manage its rooms
**Plans**: TBD

### Phase 18: Big Two (大老二)
**Goal**: Players can create, join, and play Big Two rooms with correct hand-type validation and non-standard card ranking
**Depends on**: Phase 17
**Requirements**: BIG2-01, BIG2-02, BIG2-03, BIG2-04, BIG2-05, BIG2-06, BIG2-07, BIG2-08, BIG2-09, BIG2-10, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. Four players can join a Big Two room and each receives 13 cards from a standard deck
  2. Player holding 3 of diamonds starts first; valid hand types (single, pair, triple, full house, straight, flush, four-of-a-kind, straight flush) are correctly recognized
  3. Card ranking follows Big Two rules (2 > A > K > ... > 3, suit ranking Spades > Hearts > Clubs > Diamonds) and straights do not wrap
  4. Player can pass or play a valid hand; round ends when someone empties their hand with correct scoring
  5. Big Two appears in the hub and admin can manage its rooms; reconnection recovers hand state
**Plans**: TBD

### Phase 19: Mahjong (麻將)
**Goal**: Players can create, join, and play Mahjong rooms with full tile claiming, win detection, and fan scoring
**Depends on**: Phase 18
**Requirements**: MJ-01, MJ-02, MJ-03, MJ-04, MJ-05, MJ-06, MJ-07, MJ-08, MJ-09, MJ-10, MJ-11, MJ-12, MJ-13, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. Four players can join a Mahjong room; wall building, dice rolling, and dealing follow standard procedures with the 144-tile set
  2. Player can draw from the wall or claim discarded tiles (chi/pong/kong) with correct priority (kong > pong > chi)
  3. Player can declare win when hand forms valid melds + pair, seven pairs, or thirteen orphans; fan scoring calculates correctly
  4. Flower tiles auto-replace from the dead wall; kong triggers extra draw; game handles draw (liuju) when wall is exhausted
  5. Mahjong appears in the hub and admin can manage its rooms; reconnection recovers hand and wall state
**Plans**: 4 plans
Plans:
- [ ] 19-01-PLAN.md — Tile logic module (encoding, wall, claims, win detection, fan scoring)
- [x] 19-02-PLAN.md — Room manager + backend API handlers (completed 2026-05-04, 18min)
- [ ] 19-03-PLAN.md — Frontend room page + CSS
- [ ] 19-04-PLAN.md — Catalog, icon, admin, integration tests

### Phase 20: Racing (賽車)
**Goal**: Players can create, join, and race in real-time 3D rooms with physics, lap tracking, and spectator support
**Depends on**: Phase 19
**Requirements**: RACE-01, RACE-02, RACE-03, RACE-04, RACE-05, RACE-06, RACE-07, RACE-08, RACE-09, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. Player can create a Racing room; 2-4 players see a 3D race track rendered with Three.js with correct camera and lighting
  2. Car controls (acceleration, braking, steering) are responsive with local prediction; collisions are handled by cannon-es physics
  3. Server validates car positions at 20Hz with delta-state broadcasting; all players see consistent race state
  4. Game tracks laps and declares a winner when all laps are complete; spectators can watch with read-only state stream
  5. Racing appears in the hub and admin can manage its rooms; reconnection recovers position state
**Plans**: 4 plans
Plans:
- [x] 20-01-PLAN.md — Risk spike: install three + cannon-es, verify CJS compat, add network contract + catalog entries (completed 2026-05-05)
- [x] 20-02-PLAN.md — Backend: RacingRoomManager with 20Hz physics loop, API handlers, socket registration (completed 2026-05-05)
- [x] 20-03-PLAN.md — Frontend: Three.js 3D scene, car/track rendering, input handling, HUD, touch controls (completed 2026-05-05)
- [x] 20-04-PLAN.md — Integration: GameIcon SVG, admin control plane, catalog finalization (completed 2026-05-05)
**UI hint**: yes

### Phase 21: Fighting (打斗)
**Goal**: Players can create, join, and fight in 2.5D arena rooms with sprite animation, hitbox combat, and round system
**Depends on**: Phase 20
**Requirements**: FIGHT-01, FIGHT-02, FIGHT-03, FIGHT-04, FIGHT-05, FIGHT-06, FIGHT-07, FIGHT-08, FIGHT-09, FIGHT-10, PLAT-01, PLAT-02, PLAT-03, PLAT-04, PLAT-05
**Success Criteria** (what must be TRUE):
  1. Two players can join a Fighting room; the arena renders with PixiJS sprite-based characters
  2. Character state machine handles idle, walk, jump, attack, block, hit, and KO states with frame-accurate hitbox detection
  3. Player inputs (movement + attack + block) are sent at 60Hz; server runs deterministic simulation for hit detection and state sync
  4. Health bars display correctly; best-of-3 round system declares a winner on KO
  5. Fighting appears in the hub and admin can manage its rooms; reconnection recovers character state; spectators can watch
**Plans**: 5 plans
Plans:
- [x] 21-01-PLAN.md — Risk spike: install pixi.js + @pixi/react, add network contract + catalog entries, socket handler stubs (completed 2026-05-06)
- [x] 21-02-PLAN.md — Backend game logic: character state machine, hitbox combat, platform physics, delta-state (completed 2026-05-06)
- [x] 21-03-PLAN.md — Backend room manager: FightingRoomManager with 60Hz loop, API handlers, socket wiring (completed 2026-05-06)
- [ ] 21-04-PLAN.md — Frontend: PixiJS scene, sprite rendering, HUD, touch controls, room page
- [ ] 21-05-PLAN.md — Integration: GameIcon SVG, admin control plane, catalog finalization
**UI hint**: yes

### Phase 22: Release Verification
**Goal**: All 5 new games pass deployed smoke tests on the 3100/3101 stack and the milestone is ready to ship
**Depends on**: Phase 21
**Requirements**: PLAT-06
**Success Criteria** (what must be TRUE):
  1. Deployed smoke tests pass for Pick Red, Big Two, Mahjong, Racing, and Fighting on the 3100/3101 stack
  2. All 5 games are live in the rollout system (not hidden or staged)
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 17 -> 18 -> 19 -> 20 -> 21 -> 22

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 17. Pick Red | 0/TBD | Not started | - |
| 18. Big Two | 0/TBD | Not started | - |
| 19. Mahjong | 0/TBD | Not started | - |
| 20. Racing | 0/4 | Planning complete | - |
| 21. Fighting | 3/5 | Executing | - |
| 22. Release Verification | 0/TBD | Not started | - |
