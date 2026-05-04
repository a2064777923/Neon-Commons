# Requirements: v1.3 Wave 3 遊戲擴充

## v1 Requirements

### Card Games — 撿紅點 (Pick Red)

- [x] **PICK-01**: Player can create a Pick Red room from the hub with standard room options (visibility, max players, turn seconds)
- [x] **PICK-02**: Two players can join a Pick Red room via room-number entry flow with authentication
- [x] **PICK-03**: Game uses a standard 52-card deck with correct card values for ten-sum matching
- [x] **PICK-04**: Player can draw from the deck or pick up the last discarded card
- [x] **PICK-05**: Player can declare "撿紅點" when matching pairs that sum to 10 from red-suit cards
- [x] **PICK-06**: Scoring correctly counts red-card points (紅心/方塊) at round end
- [x] **PICK-07**: Game ends when the deck is exhausted; player with highest score wins
- [x] **PICK-08**: Turn timer enforces per-turn time limit with auto-pass on timeout
- [x] **PICK-09**: Pick Red room supports reconnection with hand state recovery

### Card Games — 大老二 (Big Two)

- [ ] **BIG2-01**: Player can create a Big Two room from the hub with standard room options
- [ ] **BIG2-02**: Four players can join a Big Two room via room-number entry flow
- [ ] **BIG2-03**: Game deals 13 cards to each player from a standard 52-card deck
- [ ] **BIG2-04**: Player holding 3 of diamonds goes first; play proceeds clockwise
- [ ] **BIG2-05**: Valid hand types: single, pair, triple, full house, straight (5+ cards), flush, four-of-a-kind + kicker, straight flush
- [ ] **BIG2-06**: Card ranking follows Big Two rules: 2 > A > K > ... > 3, with suit ranking Spades > Hearts > Clubs > Diamonds
- [ ] **BIG2-07**: Straights do not wrap around (Q-K-A-2-3 is invalid)
- [ ] **BIG2-08**: Player can pass when it is their turn to play
- [ ] **BIG2-09**: Round ends when a player empties their hand; scoring counts remaining cards
- [ ] **BIG2-10**: Big Two room supports reconnection with hand state recovery

### Card Games — 麻將 (Mahjong)

- [x] **MJ-01**: Player can create a Mahjong room from the hub with standard room options
- [x] **MJ-02**: Four players can join a Mahjong room via room-number entry flow
- [x] **MJ-03
**: Game uses a 144-tile set (萬/條/筒 1-9 × 4, 風牌, 箭牌, 花牌)
- [x] **MJ-04
**: Wall building, dice rolling, and dealing follow standard Mahjong procedures
- [x] **MJ-05**: Player can draw a tile from the wall or claim a discarded tile (吃/碰/槓)
- [x] **MJ-06
**: Claiming priority: 槓 > 碰 > 吃, with the same-priority nearest player winning ties
- [x] **MJ-07
**: Player can declare 胡 (win) when hand forms valid melds + pair
- [x] **MJ-08
**: Hand recognition supports all standard winning patterns: basic form, seven pairs, thirteen orphans
- [x] **MJ-09
**: Scoring system calculates 番 (fan) correctly for the chosen rule variant
- [x] **MJ-10
**: 花牌 bonus tiles are replaced from the dead wall automatically
- [x] **MJ-11
**: 槓 (kong) triggers an extra draw from the dead wall
- [x] **MJ-12
**: Game handles draw (流局) when wall is exhausted without a winner
- [x] **MJ-13**: Mahjong room supports reconnection with hand and wall state recovery

### Action Games — 賽車 (Racing)

- [ ] **RACE-01**: Player can create a Racing room from the hub with action-game options
- [ ] **RACE-02**: 2-4 players can join a Racing room via room-number entry flow
- [ ] **RACE-03**: Game renders a 3D race track using Three.js with correct camera and lighting
- [ ] **RACE-04**: Car physics (acceleration, braking, steering, collision) powered by cannon-es
- [ ] **RACE-05**: Player controls are responsive with local prediction (no input lag)
- [ ] **RACE-06**: Server validates car positions at 20Hz with delta-state broadcasting
- [ ] **RACE-07**: Game tracks lap count and declares winner when all laps complete
- [ ] **RACE-08**: Racing room supports spectator mode with read-only state stream
- [ ] **RACE-09**: Racing room supports reconnection with position state recovery

### Action Games — 2.5D 打斗 (Fighting)

- [ ] **FIGHT-01**: Player can create a Fighting room from the hub with action-game options
- [ ] **FIGHT-02**: Two players can join a Fighting room via room-number entry flow
- [ ] **FIGHT-03**: Game renders a 2.5D arena using PixiJS with sprite-based characters
- [ ] **FIGHT-04**: Character state machine handles idle, walk, jump, attack, block, hit, and KO states
- [ ] **FIGHT-05**: Hitbox system detects attacks with frame-accurate collision
- [ ] **FIGHT-06**: Player inputs (movement + attack + block) are sent at 60Hz to the server
- [ ] **FIGHT-07**: Server runs a deterministic simulation at 60Hz for hit detection and state sync
- [ ] **FIGHT-08**: Health bar and round system (best of 3 rounds) with KO win condition
- [ ] **FIGHT-09**: Fighting room supports spectator mode with read-only state stream
- [ ] **FIGHT-10**: Fighting room supports reconnection with character state recovery

### Platform Integration

- [ ] **PLAT-01**: All 5 new games are registered in the game catalog with correct family keys (card for Pick Red/Big Two/Mahjong, action/light-3d for Racing/Fighting)
- [ ] **PLAT-02**: Hub homepage and lobby display all new games with correct icons and launch contract integration
- [ ] **PLAT-03**: Room-entry flow works for all new games with authentication and guest handling
- [ ] **PLAT-04**: Admin control plane can manage rooms for all new games (view, drain, close)
- [ ] **PLAT-05**: Rollout system supports staged launch for new games (hidden → staged → live)
- [ ] **PLAT-06**: Deployed smoke tests pass for each new game on the 3100/3101 stack
- [ ] **PLAT-07**: Recovery (refresh/disconnect) works for all new game rooms with correct presence states

## Future Requirements

- Richer economy and monetization systems
- Tournament/bracket mode for competitive games
- Game replay and recording
- Cross-game achievements and progression
- Mobile-optimized touch controls for all games

## Out of Scope

- **Dedicated SFU media architecture** — deferred; current voice fallback is sufficient
- **Native mobile clients** — deferred; browser-based experience is the priority
- **Full multi-node room recovery** — deferred; single-node is the current runtime shape
- **AI opponents** — not planned for this milestone; all games are human-vs-human
- **Real-money or gambling features** — out of scope for the platform

## Traceability

| Requirement | Phase | Plan | Status |
|-------------|-------|------|--------|
| PICK-01 | 17 | 01 | Complete |
| PICK-02 | 17 | 02 | Complete |
| PICK-03 | 17 | 01 | Complete |
| PICK-04 | 17 | 01 | Complete |
| PICK-05 | 17 | 01 | Complete |
| PICK-06 | 17 | 01 | Complete |
| PICK-07 | 17 | 01 | Complete |
| PICK-08 | 17 | 01 | Complete |
| PICK-09 | 17 | 01 | Complete |
| BIG2-01 | 18 | — | Pending |
| BIG2-02 | 18 | — | Pending |
| BIG2-03 | 18 | — | Pending |
| BIG2-04 | 18 | — | Pending |
| BIG2-05 | 18 | — | Pending |
| BIG2-06 | 18 | — | Pending |
| BIG2-07 | 18 | — | Pending |
| BIG2-08 | 18 | — | Pending |
| BIG2-09 | 18 | — | Pending |
| BIG2-10 | 18 | — | Pending |
| MJ-01 | 19 | — | Pending |
| MJ-02 | 19 | — | Pending |
| MJ-03 | 19 | — | Pending |
| MJ-04 | 19 | — | Pending |
| MJ-05 | 19 | — | Pending |
| MJ-06 | 19 | — | Pending |
| MJ-07 | 19 | — | Pending |
| MJ-08 | 19 | — | Pending |
| MJ-09 | 19 | — | Pending |
| MJ-10 | 19 | — | Pending |
| MJ-11 | 19 | — | Pending |
| MJ-12 | 19 | — | Pending |
| MJ-13 | 19 | — | Pending |
| RACE-01 | 20 | — | Pending |
| RACE-02 | 20 | — | Pending |
| RACE-03 | 20 | — | Pending |
| RACE-04 | 20 | — | Pending |
| RACE-05 | 20 | — | Pending |
| RACE-06 | 20 | — | Pending |
| RACE-07 | 20 | — | Pending |
| RACE-08 | 20 | — | Pending |
| RACE-09 | 20 | — | Pending |
| FIGHT-01 | 21 | — | Pending |
| FIGHT-02 | 21 | — | Pending |
| FIGHT-03 | 21 | — | Pending |
| FIGHT-04 | 21 | — | Pending |
| FIGHT-05 | 21 | — | Pending |
| FIGHT-06 | 21 | — | Pending |
| FIGHT-07 | 21 | — | Pending |
| FIGHT-08 | 21 | — | Pending |
| FIGHT-09 | 21 | — | Pending |
| FIGHT-10 | 21 | — | Pending |
| PLAT-01 | 17 | 01 | Complete |
| PLAT-02 | 17 | 02 | Complete |
| PLAT-03 | 17 | 02 | Complete |
| PLAT-04 | 17 | 01 | Complete |
| PLAT-05 | 17 | 01 | Complete |
| PLAT-06 | 22 | — | Pending |
| PLAT-07 | 17 | 01 | Complete |
