# Feature Landscape: 5 New Games Expansion

**Domain:** Browser-based real-time party arcade platform (Hong's Neon-Commons)
**Researched:** 2026-05-04
**Overall confidence:** MEDIUM (training data knowledge of game rules; no external verification possible)

## Executive Summary

Five new games spanning three distinct complexity tiers and two new game families. Mahjong and Big Two are card-family games with established rulesets but high implementation complexity. Pick Red is a simple card matching game. Racing and Fighting represent entirely new game families (light-3d, action) requiring WebGL/Canvas rendering infrastructure not yet present in the platform.

The existing platform handles card, party, board, and solo families with a consistent pattern: pure-logic modules in `lib/`, socket-based room managers, and Next.js page renderers. The 3D and action games break this pattern significantly, requiring real-time rendering loops, physics engines, and frame-based input handling that the current architecture was not designed for.

---

## Game 1: Mahjong (麻將) — Four-Player Tile Game

### How It Typically Works

**Core Flow:**
1. 4 players seated around a virtual table. 144 tiles shuffled and built into a wall.
2. Each player starts with 13 tiles (dealer gets 14).
3. Turns: draw 1 tile from wall, then discard 1 tile.
4. Other players can claim discarded tiles via:
   - **吃 (Chi):** Form a sequence with 2 of your tiles (only from left player's discard)
   - **碰 (Pong):** Form a triplet with 2 of your tiles (any player's discard)
   - **杠 (Kong):** Form a quad with 3 of your tiles (any player's discard) — draws replacement tile
   - **和 (Hu):** Complete hand with the discarded tile (wins the round)
5. Game ends when someone declares Hu, or wall is exhausted (draw).

**Hand Recognition (和牌判定):**
- Standard winning hand: 4 sets (sequences or triplets) + 1 pair
- Seven Pairs (七對子): 7 distinct pairs
- Thirteen Orphans (十三幺): one of each terminal/honor + one duplicate
- Sets can be sequences (順子, only in numbered suits) or triplets (刻子)
- Must check for valid winning pattern before declaring Hu

**Scoring (番數計算):**
- Taiwan style (台灣麻將): 16 base points, multiplied by fan
- Common fan patterns:
  - 門清 (concealed hand): 1 fan
  - 自摸 (self-drawn win): 1 fan
  - 花牌 (flower tiles): 1 fan each
  - 碰碰胡 (all triplets): 2 fan
  - 混一色 (half flush): 2 fan
  - 清一色 (full flush): 8 fan
  - 小三元 (small three dragons): 2 fan
  - 大三元 (big three dragons): 8 fan
  - 四杠子 (four kongs): limit hand
  - And many more (30+ patterns)
- Payment calculation: winner collects from all 3 players (or only from discarder in some rules)

### Table Stakes Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 144-tile set with correct suits | Fundamental to the game | Low | 萬/條/筒 (1-9), 東南西北風, 中發白, 花牌(8) |
| Tile wall building and dealing | Core setup | Medium | Must shuffle, build walls, deal correctly |
| Draw and discard cycle | Core gameplay loop | Low | Standard turn flow |
| Chi/Pong/Kong claiming | Core interaction | High | Priority system: Hu > Kong/Pong > Chi > pass |
| Win detection (和牌判定) | Game completion | High | Must check all valid hand patterns |
| Turn timer with auto-pass | Prevents stalling | Low | Reuse platform's turnSeconds pattern |
| Bot AI (auto-play) | Platform requirement | High | Simple: random discard. Good: evaluate hand value |
| Room system integration | Platform requirement | Low | Register in GAME_CATALOG, familyKey: "card" |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Visual tile arrangement | Drag-to-sort tiles in hand | Medium | 2.5D tile rendering with drag support |
| Score breakdown display | Shows which fan patterns were scored | Medium | Educational for new players |
| Multiple rule variants | Taiwan, Hong Kong, Riichi styles | Very High | Each variant has different tile set, scoring, and win conditions |
| Tile animation | Smooth draw/discard/claim animations | Medium | Enhances feel significantly |
| Spectator mode | Watch live games | Medium | Read-only socket subscription |
| Replay system | Review past games | High | Requires move history persistence |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full Riichi (Japanese) rules | Extremely complex (yaku, furiten, riichi declaration, ippatsu, etc.) | Start with Taiwan rules only; add Riichi as future expansion |
| Real-money gambling integration | Legal/ethical concerns, vastly different product | Keep as social game with platform's existing point economy |
| Voice chat during play | Already available via platform's existing voice system | Do not build game-specific voice; reuse platform voice |
| Full 3D tile rendering | Overkill for a tile game; increases load time dramatically | Use 2.5D or isometric tile sprites |

### Feature Dependencies

```
Tile set definition → Wall building → Dealing → Draw/discard cycle
Draw/discard cycle → Chi/Pong/Kong claiming → Win detection
Win detection → Fan scoring → Payment calculation → Round summary
Room system integration → Bot AI → Turn timer
```

### Platform Dependencies

- **Family:** `card` (existing) — uses `/api/rooms/*` and `room:*` socket events
- **New socket events needed:** Likely need `game:claim` (for chi/pong/kong) alongside existing `game:play`, `game:pass`
- **Catalog registration:** Add `mahjong` to `GAME_CATALOG` with `familyKey: "card"`
- **No new rendering infrastructure needed:** Tile game can be done with CSS/SVG on existing Next.js stack

---

## Game 2: Pick Red (撿紅點) — Two-Player Card Game

### How It Typically Works

**Core Flow:**
1. 2 players. Standard 52-card deck (some variants use 2 decks).
2. Cards dealt: 4 face-up on table, 4 in each player's hand.
3. On your turn, play a card from your hand to capture table cards:
   - Capture a single card of the same rank
   - Capture a pair of cards whose values sum to 10 (e.g., 7+3, 8+2, 6+4, A+9)
   - Capture a Jack (11), Queen (12), or King (13) individually
4. After playing, draw from deck to refill hand to 4 cards.
5. When deck is empty and hands are empty, count points.

**Scoring:**
- Red cards (hearts, diamonds) = 1 point each
- Total 20 red cards = 20 points max from red cards
- Special bonuses:
  - 撿紅: capturing red cards via matching = bonus points
  - 拾: capturing all cards of a suit = bonus
  - Big score: capturing all cards of one number = bonus
- Highest total score wins

### Table Stakes Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 52-card deck with correct suits/values | Fundamental | Low | Standard deck |
| Card dealing and table layout | Core setup | Low | 4 on table, 4 per hand |
| Same-rank capture | Core mechanic | Low | Play card, capture matching rank |
| Sum-to-10 capture | Core mechanic | Medium | Must check all valid sum-to-10 combinations |
| Jack/Queen/King individual capture | Standard rules | Low | Face cards have special capture rules |
| Hand refill from deck | Core flow | Low | Draw to 4 after each play |
| Scoring system | Game completion | Medium | Red card counting + bonuses |
| Bot AI | Platform requirement | Medium | Simple: capture highest-value. Smart: optimize bonuses |
| Turn timer | Prevents stalling | Low | Standard platform pattern |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Capture animation | Visual feedback for matches | Low | Card fly-to-pile animation |
| Score breakdown | Shows bonus calculation | Low | Helps players learn scoring |
| Hint system | Casual-friendly | Low | Highlight valid captures |
| Card back customization | Personalization | Low | Cosmetic only |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Complex rule variants | Many regional variants exist with subtle differences | Start with one standard ruleset; add variants later |
| Multiplayer beyond 2P | Game is fundamentally 2-player | Keep as 2-player only |
| Real-time card throwing | Unnecessary complexity for a turn-based game | Use standard click-to-select, click-to-capture |

### Feature Dependencies

```
Card deck → Dealing → Table layout → Capture rules (same-rank, sum-to-10, face cards)
Capture rules → Hand refill → Scoring → Round summary
Room system → Bot AI → Turn timer
```

### Platform Dependencies

- **Family:** `card` (existing) — uses `/api/rooms/*` and `room:*` socket events
- **Socket events:** Reuse existing `game:play` for card plays, `game:pass` for passing
- **Catalog registration:** Add `pickred` to `GAME_CATALOG` with `familyKey: "card"`
- **No new infrastructure needed:** Pure card game, standard CSS card rendering

---

## Game 3: Big Two (大老二) — Four-Player Poker Card Game

### How It Typically Works

**Core Flow:**
1. 4 players. Standard 52-card deck. All 13 cards dealt to each player.
2. Player with 3 of diamonds starts (must include it in their first play).
3. Players play valid poker-type hands, each play must beat the previous.
4. If all 3 other players pass, the last player who played leads a new hand.
5. First player to empty their hand wins.

**Hand Types (from weakest to strongest):**
- **Single:** One card
- **Pair:** Two cards of same rank
- **Triple:** Three cards of same rank (not always allowed in all variants)
- **Straight:** 5 consecutive cards (A-2-3-4-5 is lowest; 10-J-Q-K-A is highest)
- **Flush:** 5 cards of same suit
- **Full House:** Triple + Pair
- **Four of a Kind + 1:** Four same-rank + any kicker
- **Straight Flush:** 5 consecutive cards of same suit
- **Royal Flush:** 10-J-Q-K-A of same suit (highest)

**Card Ranking:**
- Rank order: 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2
- Suit order: Diamonds < Clubs < Hearts < Spades
- 2 of Spades is the single highest card

**Comparison Rules:**
- Same type only (can't play a straight against a pair)
- Higher rank beats lower rank
- Same rank: higher suit wins
- Straights: compare highest card, then suit of highest card

### Table Stakes Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 52-card deck, 13 cards per player | Fundamental | Low | Standard deal |
| All hand type detection | Core gameplay | High | Must correctly identify singles, pairs, straights, flushes, full houses, etc. |
| Hand comparison logic | Core gameplay | High | Must handle all type matchups correctly |
| Card ranking (2 of spades highest) | Core rule | Low | Non-standard ranking |
| Starting player (3 of diamonds) | Core rule | Low | Must find and enforce |
| Pass mechanism | Core interaction | Low | Player can pass instead of playing |
| Auto-lead when all pass | Core flow | Low | Track pass count |
| Bot AI | Platform requirement | High | Must understand hand decomposition and strategy |
| Turn timer | Prevents stalling | Low | Standard platform pattern |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Hand suggestion | Helps new players identify valid plays | Medium | Highlight playable combinations |
| Card sorting options | Sort by rank or by suit | Low | Quality of life |
| Play history | See what was played in previous rounds | Low | Helps strategy |
| Spectator mode | Watch games | Medium | Read-only socket subscription |
| Tournament mode | Multi-round scoring | High | Track wins across multiple games |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 2-player or 3-player variants | Game is fundamentally 4-player; variants change strategy significantly | Keep as 4-player only |
| Complex betting/gambling mechanics | Not a gambling platform | Use platform's existing point economy if needed |
| Card animation with physics | Overkill for a turn-based card game | Use simple card placement animations |

### Feature Dependencies

```
Card deck → Dealing (13 each) → Find 3-of-diamonds holder
Hand type detection → Hand comparison → Play validation
Play validation → Pass mechanism → Auto-lead → Win detection
Room system → Bot AI → Turn timer
```

### Platform Dependencies

- **Family:** `card` (existing) — uses `/api/rooms/*` and `room:*` socket events
- **Socket events:** Reuse `game:play` for card plays, `game:pass` for passing
- **Catalog registration:** Add `bigtwo` to `GAME_CATALOG` with `familyKey: "card"`
- **No new infrastructure needed:** Card game with standard CSS rendering

---

## Game 4: Racing (賽車) — 3D Racing Game

### How It Typically Works

**Core Flow:**
1. 2-6 players select vehicles and join a race.
2. 3D track with curves, straights, and obstacles.
3. Real-time input: accelerate, brake, steer left/right.
4. Physics simulation: speed, acceleration, friction, collision.
5. Lap-based or point-to-point racing.
6. First to finish wins; positions tracked in real-time.

**Typical Browser Racing Implementation:**
- Three.js for 3D rendering (WebGL)
- Physics engine (cannon-es, rapier.js, or ammo.js) for car physics
- Fixed timestep game loop (typically 60fps)
- Client-side prediction + server reconciliation for multiplayer
- Track defined as spline curves with road width

### Table Stakes Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| 3D track rendering | Core visual | Very High | Three.js scene, camera, lighting, track mesh |
| Car physics (acceleration, braking, steering) | Core gameplay | High | Suspension, friction, drift |
| Real-time multiplayer sync | Core multiplayer | Very High | Position interpolation, client prediction |
| Lap tracking and finish detection | Core scoring | Medium | Checkpoint system |
| Player position display | Core UI | Low | HUD showing race position |
| Start countdown | Expected UX | Low | 3-2-1-GO |
| Basic track (1-2 tracks minimum) | Minimum viable | High | Track modeling + collision mesh |
| Minimap | Expected UX | Medium | Top-down track view with player dots |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Drift mechanics | Fun factor | Medium | Drift boost, visual drift smoke |
| Power-ups/items | Party game feel | Medium | Speed boost, obstacle placement |
| Multiple tracks | Replay value | High | Each track needs modeling + collision |
| Vehicle customization | Personalization | Medium | Colors, accessories |
| Replay camera | Entertainment | Medium | Cinematic replay of race |
| Sound effects (engine, drift) | Immersion | Low | Web Audio API |
| Track editor | Community content | Very High | Long-term feature |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Realistic racing simulation | Wrong audience; party platform needs casual fun | Use Mario Kart-style physics, not Gran Turismo |
| Complex vehicle tuning | Overwhelming for casual players | Keep vehicle selection simple |
| Mobile touch controls (initially) | Adds significant input complexity | Focus on keyboard/gamepad first; add touch later |
| Photo-realistic graphics | Too heavy for browser; wrong art style | Use stylized/cartoon 3D art matching platform aesthetic |
| Server-authoritative physics | Extremely complex for real-time 3D | Use client-authoritative with server validation |

### Feature Dependencies

```
Three.js setup → Track rendering → Car model rendering
Car physics → Input handling → Collision detection
Collision detection → Lap tracking → Position tracking → Finish detection
Multiplayer sync → Position interpolation → Client prediction
Room system → Race start/end → Scoring
```

### Platform Dependencies

- **Family:** `light-3d` (existing in catalog, currently "coming-soon")
- **New infrastructure required:**
  - Three.js or equivalent 3D renderer (npm dependency)
  - Physics engine (cannon-es or rapier.js)
  - New socket event family for real-time position updates (high-frequency, low-latency)
  - New page route: `/games/racing` or `/light-3d/racing`
  - New game loop pattern (not present in any existing game)
- **Socket events:** Need a new high-frequency event family (e.g., `race:position`, `race:input`) — current socket events are turn-based, not real-time
- **Catalog registration:** Add `racing` to `GAME_CATALOG` with `familyKey: "light-3d"`

---

## Game 5: 2.5D Fighting (打斗) — Bleach vs Naruto Style

### How It Typically Works

**Core Flow:**
1. 2 players select characters from a roster.
2. Side-scrolling arena with parallax background layers (2.5D effect).
3. Real-time input: move left/right, jump, crouch, attack (light/heavy), special, block.
4. Hit detection via hitboxes/hurtboxes on character sprites.
5. Health bars deplete on hit. Round ends when one player's health reaches 0.
6. Best of 3 rounds wins the match.

**Typical Browser 2.5D Fighting Implementation:**
- HTML5 Canvas or Pixi.js for 2D rendering with parallax layers
- Sprite sheet animation system (idle, walk, jump, attack, special, hit, block)
- Hitbox/hurtbox system per animation frame
- Frame data system (startup frames, active frames, recovery frames)
- Input buffer for responsive controls
- State machine for character states (idle, attacking, blocking, hit-stun, knocked-down)

### Table Stakes Features

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Character sprite animation | Core visual | High | Idle, walk, jump, attack, hit, block animations |
| Hitbox/hurtbox system | Core combat | High | Frame-accurate hit detection |
| Health bar UI | Core scoring | Low | Standard fighting game HUD |
| Basic attacks (light, heavy) | Core combat | Medium | Different damage, speed, range |
| Special moves | Core combat | High | Unique per character, higher damage |
| Block mechanic | Core defense | Medium | Hold to block, chip damage |
| Round system (best of 3) | Standard format | Low | Round start/end flow |
| Character selection screen | Expected UX | Medium | Roster display with previews |
| Basic AI opponent | Platform requirement | High | Must be beatable but challenging |
| Input system | Core gameplay | Medium | Keyboard mapping, responsive controls |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Multiple characters (3-5 roster) | Replay value, main selling point | Very High | Each character needs unique sprites, moves, hitboxes |
| Combo system | Skill expression | High | Chain attacks together for bonus damage |
| Super meter | Comeback mechanics | Medium | Builds from attacking/blocking, spend for super move |
| Stage backgrounds (2-3 stages) | Visual variety | Medium | Parallax layers, stage-specific hazards |
| Character-specific intros/victories | Personality | Medium | Short animation sequences |
| Online multiplayer with rollback | Competitive integrity | Very High | Rollback netcode is extremely complex |
| Tutorial mode | Accessibility | Medium | Teach controls and basic combos |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full 3D fighting game | 2.5D is the specified style; 3D is a different genre | Keep 2.5D (sprites + parallax) |
| 3+ player fights | Fighting games are fundamentally 1v1 | Keep as 1v1 only |
| Frame-perfect competitive balance | Wrong audience; party platform | Aim for fun over competitive balance |
| Complex input motions (quarter-circle, etc.) | Too hard for casual players | Use simple button combos (e.g., forward+special) |
| Realistic gore/violence | Wrong platform tone | Use cartoon/anime-style hit effects |

### Feature Dependencies

```
Canvas/Pixi.js setup → Sprite rendering → Animation system
Animation system → Hitbox/hurtbox → Hit detection → Damage application
Input system → Character state machine → Move execution
Health system → Round system → Match result
Character selection → Character data → Move set definition
Room system → Multiplayer sync → Input relay
```

### Platform Dependencies

- **Family:** Needs a new family (e.g., `action` or `arena`) — does not fit existing card/party/board/solo/light-3d
- **New infrastructure required:**
  - Canvas/Pixi.js renderer (npm dependency)
  - Sprite sheet animation system
  - Hitbox/hurtbox engine
  - Frame data system
  - Input buffer and state machine
  - New socket event family for real-time input relay
  - New page route
- **Socket events:** Need real-time input relay events (e.g., `fight:input`, `fight:state`) — low-latency requirement
- **Catalog registration:** Add to `GAME_CATALOG` with new `familyKey`

---

## Cross-Game Complexity Summary

| Game | Player Count | Family | Rendering | Logic Complexity | Netcode Complexity | Overall |
|------|-------------|--------|-----------|-----------------|-------------------|---------|
| Mahjong | 4 | card | CSS/SVG tiles | Very High | Low (turn-based) | **High** |
| Pick Red | 2 | card | CSS cards | Low | Low (turn-based) | **Low** |
| Big Two | 4 | card | CSS cards | High | Low (turn-based) | **Medium** |
| Racing | 2-6 | light-3d | Three.js/WebGL | High | Very High (real-time) | **Very High** |
| Fighting | 2 | action (new) | Canvas/Pixi.js | Very High | High (real-time) | **Very High** |

## Feature Dependency Graph (Cross-Game)

```
Card family games (Mahjong, Pick Red, Big Two):
  No new infrastructure needed
  Each game adds: catalog entry + game logic module + manager integration
  Mahjong may need new socket events for claiming (chi/pong/kong)

3D/Action games (Racing, Fighting):
  Require new rendering infrastructure
  Require new high-frequency socket event patterns
  Fighting requires a new game family
  Both require physics/collision engines
  These are independent of each other but share infrastructure needs
```

## MVP Recommendation

### Recommended Build Order

1. **Pick Red** — Lowest complexity, validates card family expansion, quick win
   - Reason: Simplest game, can reuse all existing card infrastructure
   - Estimated effort: 1-2 phases

2. **Big Two** — Medium complexity, validates more complex card game patterns
   - Reason: Hand type detection is reusable knowledge; still uses existing card infrastructure
   - Estimated effort: 2-3 phases

3. **Mahjong** — High complexity but uses existing infrastructure
   - Reason: Most complex card game but no new rendering infrastructure needed
   - Estimated effort: 3-4 phases

4. **Racing** — New infrastructure (Three.js + physics), high effort
   - Reason: light-3d family already exists in catalog; natural next step for 3D
   - Estimated effort: 4-5 phases

5. **Fighting** — New infrastructure + new family, highest effort
   - Reason: Requires the most new infrastructure; best done after Racing validates 3D/real-time patterns
   - Estimated effort: 5-6 phases

### Prioritize (Table Stakes)

For each game, these features must ship first:
- **Mahjong:** Tile set, draw/discard, chi/pong/kong, win detection, basic fan scoring
- **Pick Red:** Card deck, capture rules (same-rank, sum-to-10), scoring
- **Big Two:** Card deck, all hand types, comparison logic, pass mechanism
- **Racing:** 3D track, car physics, multiplayer sync, lap tracking
- **Fighting:** Character sprites, hitbox system, health bars, basic attacks, round system

### Defer

- **Mahjong:** Multiple rule variants, replay system, spectator mode
- **Pick Red:** Hint system, card back customization
- **Big Two:** Tournament mode, hand suggestion
- **Racing:** Track editor, vehicle customization, power-ups
- **Fighting:** Full roster (start with 2 characters), rollback netcode, tutorial mode

## Sources

- Platform codebase analysis: `lib/games/catalog.js`, `lib/party/manager.js`, `lib/board/manager.js`, `lib/board/flyingchess.js`, `lib/party/drawguess.js`, `lib/shared/network-contract.js`, `docs/architecture/backend-contract.md`, `docs/overview/project-overview.md`
- Game rule knowledge from training data (Mahjong, Pick Red, Big Two standard rulesets)
- Browser game rendering knowledge from training data (Three.js, Pixi.js, Canvas patterns)
- Confidence: MEDIUM — game rules are well-established; rendering/infrastructure recommendations are based on training data patterns that may have evolved

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Mahjong rules | HIGH | Well-documented traditional game; Taiwan rules are standard |
| Pick Red rules | MEDIUM | Regional variations exist; core mechanics are consistent |
| Big Two rules | HIGH | Well-documented card game; hand types are standard |
| Racing implementation | MEDIUM | Three.js patterns from training data; may have newer/better approaches |
| Fighting implementation | MEDIUM | Canvas/Pixi.js patterns from training data; rollback netcode is complex topic |
| Platform integration | HIGH | Directly analyzed from codebase |
| Complexity estimates | MEDIUM | Based on experience; actual effort depends on team skill and scope decisions |
