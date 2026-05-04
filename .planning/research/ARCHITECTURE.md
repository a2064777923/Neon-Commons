# Architecture Patterns: 5 New Game Integration

**Domain:** Browser-based real-time party arcade platform
**Researched:** 2026-05-04
**Overall confidence:** HIGH

## Executive Summary

This document analyzes how five new games integrate with the existing doudezhu platform architecture. The platform currently has three multiplayer game families (card, party, board), each with its own room manager class, socket event namespace, and API route family. A fourth family (`light-3d`) exists in the catalog but has no shipped games yet.

The five new games decompose into three architectural categories:

1. **Card family extensions** (Mahjong, Big Two, Pick Red) -- These follow the existing card room pattern with turn-based hand/card management. They reuse `lib/card/manager.js` infrastructure (or extend it) and the `room:*` / `game:*` socket event namespace.

2. **Action/Realtime family** (Racing, Fighting) -- These break the turn-based assumption embedded in all three existing managers. They require a new game family with continuous state broadcasting, higher socket message rates, and client-authoritative rendering with server validation.

3. **Game logic modules** (all five) -- Each game needs a pure-logic module (like `lib/board/flyingchess.js` or `lib/party/drawguess.js`) that owns rules, state transitions, and serialization, separate from room lifecycle management.

## Current Architecture Summary

### Game Family Pattern

Every multiplayer game family follows this structure:

```
lib/games/catalog.js          -- Game metadata, family key, config defaults, limits
lib/{family}/manager.js       -- Singleton room manager (global.{family}RoomManager)
lib/{family}/{game}.js        -- Pure game logic module (state machine, rules, serialization)
backend/handlers/{family}/**  -- REST endpoints for room CRUD
lib/socket-server.js          -- Socket event binding per family
lib/shared/network-contract.js -- API_ROUTES + SOCKET_EVENTS constants
```

### Socket Event Namespaces

| Family | Client -> Server | Server -> Client |
|--------|-----------------|-----------------|
| card   | `room:subscribe`, `room:ready`, `room:add-bot`, `game:bid`, `game:play`, `game:pass`, `game:trustee`, `room:chat` | `room:update`, `room:error` |
| party  | `party:subscribe`, `party:ready`, `party:add-bot`, `party:message`, `party:action` | `party:update`, `party:error` |
| board  | `board:subscribe`, `board:ready`, `board:add-bot`, `board:move` | `board:update`, `board:error` |

### Room Manager Contract

Each manager class provides:

- `createRoom(owner, gameKey, overrides)` -- allocate room number, register in directory
- `joinRoom(roomNo, user)` -- seat player, emit update
- `setReady(roomNo, userId, ready)` -- ready check, auto-start when full
- `addBot(roomNo, userId, count)` -- AI backfill
- `registerSocket(roomNo, userId, socket)` -- bind socket to room
- `unregisterSocket(socketId)` -- handle disconnect, schedule reconnect grace
- `submitAction / submitMove` -- game-specific input handler
- `serializeRoom(room, viewerUserId)` -- per-viewer state (hide hidden info)
- `emitRoom(room)` -- push full state to all connected sockets
- Reconnect grace timers, room expiry timers, admin drain/close/remove

### Shared Infrastructure (Reusable by All New Games)

| Component | Path | Reuse |
|-----------|------|-------|
| Room directory | `lib/rooms/directory.js` | All new rooms register here; room-number allocation, snapshot persistence, share-link support all work automatically |
| Network contract | `lib/shared/network-contract.js` | Add new API_ROUTES entries and SOCKET_EVENTS entries |
| Catalog | `lib/games/catalog.js` | Add game entries, family entries, config defaults, limits |
| Economy | `lib/economy.js` | Settlement on game finish; standard win/loss/draw deltas |
| Auth | JWT cookie flow | All socket and REST auth flows reused as-is |
| Room entry | `lib/client/room-entry.js` | Invite links, guest claim, deep-link resolution |
| Availability | `lib/shared/availability.js` | Admin capability gating, degraded state envelopes |
| Presence | `buildSeatRecoveryState` | Connected/reconnecting/disconnected states |
| Admin control plane | `lib/admin/control-plane.js` | Capability toggles, runtime controls, live-room ops |

---

## Game 1: Mahjong (麻將) -- Card Family

### Classification

**Family:** `card` (reuse existing card room infrastructure)
**Players:** 4
**Type:** Turn-based tile game with complex hand evaluation

### Integration Points

**REUSE (no modification needed):**
- Room directory registration, room-number allocation, share links
- Auth flow, guest claim, reconnect grace, room expiry
- Economy settlement on game finish
- Admin live-room drain/close/remove
- `room:subscribe`, `room:ready`, `room:add-bot`, `room:chat` socket events

**MODIFY:**
- `lib/games/catalog.js` -- Add `mahjong` entry to `GAME_CATALOG` with `familyKey: "card"`, config defaults (turn seconds, variant rules), player limits (4)
- `lib/shared/network-contract.js` -- Potentially add new game-specific socket events if `game:bid`/`game:play`/`game:pass` are insufficient for Mahjong's multi-action turns (draw, discard, chi/pong/kong/hu declarations)
- Card room manager (or create parallel manager) -- Mahjong has significantly different room state from Dou Dizhu: 4 seats, wall tiles, melds, flower tiles, wind rounds

**CREATE:**
- `lib/card/mahjong.js` -- Pure Mahjong logic module:
  - Tile set definition (136 tiles: 万/条/筒 x 1-9 x 4, wind tiles, dragon tiles, flower tiles)
  - Wall building, dealing, dead wall
  - Draw/discard cycle
  - Meld detection (chi, pong, kong, concealed kong)
  - Win detection (regular win, seven pairs, thirteen orphans, etc.)
  - Scoring (tai/fan calculation)
  - Bot AI (tile efficiency heuristics)
- `pages/card/[roomNo].js` or `pages/mahjong/[roomNo].js` -- Game room UI
- `components/mahjong/` -- Tile rendering (SVG or CSS), hand display, meld display, discard pool, wind indicator

### Socket Event Strategy

Mahjong needs richer actions than `game:play`/`game:pass`:

| Action | Socket Event | Payload |
|--------|-------------|---------|
| Discard tile | `game:play` | `{ tileId }` |
| Declare chi | `game:action` | `{ type: "chi", tiles: [...] }` |
| Declare pong | `game:action` | `{ type: "pong" }` |
| Declare kong | `game:action` | `{ type: "kong", variant: "exposed"|"concealed"|"added" }` |
| Declare win | `game:action` | `{ type: "hu", selfDrawn: bool }` |
| Pass declaration | `game:pass` | `{}` |

If the existing card socket events (`game:bid`, `game:play`, `game:pass`) can be overloaded with a `type` discriminator, no new socket events are needed. Otherwise, add `game:action` to the card socket namespace.

### Key Architectural Decision

**Mahjong should extend the card family manager rather than create a new family.** The card family already supports 3-player (Dou Dizhu). Adding 4-player is a capacity change, not a structural one. The manager's `submitAction` method dispatches on `gameKey`, same pattern as the party manager dispatching on `werewolf`/`avalon`/`undercover`/`drawguess`.

However, if the card manager does not yet exist (Dou Dizhu may use a separate implementation), then create `lib/card/manager.js` following the party/board manager pattern.

---

## Game 2: Pick Red (撿紅點) -- Card Family

### Classification

**Family:** `card`
**Players:** 2
**Type:** Turn-based card matching/scoring game

### Integration Points

**REUSE:** Same as Mahjong -- room directory, auth, economy, admin, reconnect.

**MODIFY:**
- `lib/games/catalog.js` -- Add `pickred` entry, `familyKey: "card"`, 2-player config
- Card room manager -- Add `pickred` dispatch in submit handler

**CREATE:**
- `lib/card/pickred.js` -- Pure logic module:
  - Standard 54-card deck (52 + 2 jokers, or variant-specific deck)
  - Dealing rules
  - Match/collect rules (which cards can be picked, point values for red cards)
  - Turn structure (draw, match, discard)
  - End-game scoring (count red-dot points)
  - Bot AI (greedy matching heuristics)
- UI components for 2-player card table layout

### Socket Event Strategy

Pick Red can reuse `game:play` with action types:

| Action | Socket Event | Payload |
|--------|-------------|---------|
| Draw from deck | `game:play` | `{ action: "draw" }` |
| Pick from table | `game:play` | `{ action: "pick", tableCardIds: [...] }` |
| Discard | `game:play` | `{ action: "discard", cardId }` |

No new socket events needed. The existing `game:bid`/`game:play`/`game:pass` pattern with a discriminator field is sufficient.

### Complexity Assessment

**Low.** Pick Red is the simplest of the five new games. It follows a standard draw-match-discard loop. Build this first among the card family games to validate the card manager extension pattern.

---

## Game 3: Big Two (大老二) -- Card Family

### Classification

**Family:** `card`
**Players:** 4
**Type:** Turn-based card shedding/comparison game (poker-style)

### Integration Points

**REUSE:** Same card family infrastructure as Mahjong and Pick Red.

**MODIFY:**
- `lib/games/catalog.js` -- Add `bigtwo` entry, `familyKey: "card"`, 4-player config
- Card room manager -- Add `bigtwo` dispatch

**CREATE:**
- `lib/card/bigtwo.js` -- Pure logic module:
  - Standard 52-card deck (no jokers)
  - Dealing (13 cards each)
  - Hand type validation: single, pair, triple, full house, straight, flush, straight flush, bomb
  - Comparison logic (suit ranking: diamond < club < heart < spade; card rank: 3 < 2)
  - Turn passing logic
  - Win condition (first to empty hand)
  - Scoring (penalty points for remaining cards)
  - Bot AI (greedy shedding with hand-type awareness)

### Socket Event Strategy

| Action | Socket Event | Payload |
|--------|-------------|---------|
| Play cards | `game:play` | `{ cards: [{suit, rank}, ...] }` |
| Pass | `game:pass` | `{}` |

Straightforward reuse of existing card socket events.

### Key Architectural Decision

**Big Two and Mahjong both need 4-player card rooms.** The card manager should support variable `maxPlayers` per gameKey, same as the board manager supports 2 (gomoku), 2/4/6 (chinesecheckers), 2-4 (flyingchess). Config normalization in the card manager needs a `getCardPlayerOptions(gameKey)` function.

---

## Game 4: Racing (賽車) -- New Action Family

### Classification

**Family:** `light-3d` (already exists in catalog as placeholder)
**Players:** 2-6
**Type:** Real-time continuous state (NOT turn-based)

### Why This Cannot Use Existing Families

All three existing managers (card, party, board) assume turn-based gameplay:

1. **State updates are discrete** -- Manager computes next state on player action, then broadcasts full serialized room. There is no concept of continuous physics ticking.

2. **Socket message rate is low** -- One `board:update` per turn (every 20-30 seconds). Racing needs 10-30 updates per second for smooth position sync.

3. **Turn timer model** -- `schedulePhase()` / `scheduleTurn()` use `setTimeout` for turn deadlines. Racing needs `setInterval` or requestAnimationFrame-equivalent game loop.

4. **Serialization model** -- `serializeRoom()` sends the entire room state on every update. Racing needs delta/incremental updates to keep bandwidth manageable.

### Integration Points

**REUSE:**
- Room directory registration (room-number, share links, snapshot)
- Auth, guest claim, reconnect grace
- Economy settlement
- Admin live-room operations
- Catalog metadata

**MODIFY:**
- `lib/games/catalog.js` -- Update `miniracers` entry from `coming-soon` to `live`, or add a new `racing` entry
- `lib/shared/network-contract.js` -- Add a new socket event family:
  ```
  action: {
    subscribe: "action:subscribe",
    ready: "action:ready",
    input: "action:input",       // client -> server: steering, accel, brake
    update: "action:update",     // server -> client: delta state
    snapshot: "action:snapshot", // server -> client: full state (join/reconnect)
    error: "action:error"
  }
  ```
- `backend/handlers/` -- Add REST endpoints for action-family rooms: `/api/action/rooms`, `/api/action/rooms/:roomNo`, `/api/action/rooms/:roomNo/join`

**CREATE:**
- `lib/action/manager.js` -- Real-time room manager:
  - Same room lifecycle as other managers (create, join, ready, reconnect, expiry)
  - Game loop: `setInterval(tick, 1000/20)` for 20Hz server tick
  - Input buffering: collect client inputs between ticks, apply in batch
  - Delta state broadcasting: only send changed fields per tick
  - Snapshot on join/reconnect: send full state
  - Authoritative server: server runs physics, clients are presentation
- `lib/action/racing.js` -- Racing game logic:
  - Track definition (spline or tile-based)
  - Car physics (position, velocity, steering, collision)
  - Lap tracking, finish detection
  - Power-up/item system (if applicable)
  - Bot AI (follow optimal line, rubber-banding)
- `lib/action/game-loop.js` -- Shared real-time game loop infrastructure:
  - Fixed timestep loop
  - Input collection and batching
  - Delta state computation
  - Snapshot serialization
- Frontend: `pages/racing/[roomNo].js`
  - Three.js or Babylon.js for 3D rendering (see Stack decision below)
  - Client-side interpolation/extrapolation for smooth rendering
  - Input prediction for responsive controls

### Socket Event Strategy

Racing uses a fundamentally different event model:

| Direction | Event | Payload | Rate |
|-----------|-------|---------|------|
| Client -> Server | `action:input` | `{ steering: float, throttle: float, brake: float, timestamp }` | 20-60 Hz |
| Server -> Client | `action:update` | `{ tick, cars: [{id, x, y, z, rotation, speed}], items: [...] }` | 20 Hz |
| Server -> Client | `action:snapshot` | Full room + match state | On join/reconnect |
| Client -> Server | `action:ready` | `{}` | Once |
| Client -> Server | `action:subscribe` | `{ roomNo }` | Once |

### Key Architectural Decision

**Racing requires a new game family (`action` or `light-3d`) with its own manager.** The existing turn-based managers cannot be adapted for real-time continuous state without fundamentally breaking their abstractions. The new `action` family manager should:

1. Inherit room lifecycle patterns from existing managers (same reconnect grace, room expiry, admin ops)
2. Add a game loop (`setInterval`-based tick)
3. Use delta state broadcasting instead of full-state-per-update
4. Support input buffering for network jitter compensation

### 3D Rendering Choice

For a browser-based 3D racing game:

- **Three.js** -- Larger ecosystem, more tutorials, good for custom rendering. Better choice if the game needs custom shaders or complex visual effects.
- **Babylon.js** -- More batteries-included (physics, GUI, scene graph). Better choice for faster prototyping.

**Recommendation:** Three.js, because the platform already uses React for UI, and Three.js has better React integration (react-three-fiber). The "light-3d" family name suggests lightweight 3D, not AAA rendering, so Three.js's flexibility is preferred.

---

## Game 5: 2.5D Fighting (打斗) -- New Action Family

### Classification

**Family:** `light-3d` (same family as Racing)
**Players:** 2 (1v1)
**Type:** Real-time continuous state, frame-precise input

### Integration Points

Same as Racing -- shares the `action` family infrastructure.

**CREATE:**
- `lib/action/fighting.js` -- Fighting game logic:
  - Character state machine (idle, walk, jump, crouch, attack, hit-stun, block, special)
  - Hit-box / hurt-box collision detection
  - Frame data (startup, active, recovery frames per move)
  - Health bars, round system (best of 3)
  - Combo system
  - Special meter
  - Bot AI (reaction-based, pattern recognition)

### Socket Event Strategy

Same `action:*` family as Racing, but with different input semantics:

| Direction | Event | Payload |
|-----------|-------|---------|
| Client -> Server | `action:input` | `{ buttons: [up,down,left,right,atk,spc,blk], timestamp }` |
| Server -> Client | `action:update` | `{ tick, p1: {state,x,y,health,meter,...}, p2: {...} }` |

### Key Architectural Decision

**Fighting games are the most latency-sensitive genre.** The server tick model works for Racing (20Hz is acceptable with client-side interpolation), but fighting games traditionally run at 60fps with 2-3 frame input latency targets.

**Approach:** Use the same `action` family manager but with a higher tick rate (60Hz or 30Hz with client-side prediction). The server should be authoritative for hit detection and health, but the client should predict movement for responsiveness. Rollback netcode is ideal but complex; start with delay-based netcode and upgrade later.

---

## New vs Modified Components Matrix

| Component | Mahjong | Pick Red | Big Two | Racing | Fighting |
|-----------|---------|----------|---------|--------|----------|
| `catalog.js` | MODIFY | MODIFY | MODIFY | MODIFY | MODIFY |
| `network-contract.js` | MODIFY | - | - | MODIFY | MODIFY |
| Card manager | MODIFY | MODIFY | MODIFY | - | - |
| `lib/card/mahjong.js` | CREATE | - | - | - | - |
| `lib/card/pickred.js` | - | CREATE | - | - | - |
| `lib/card/bigtwo.js` | - | - | CREATE | - | - |
| `action/manager.js` | - | - | - | CREATE | REUSE |
| `lib/action/racing.js` | - | - | - | CREATE | - |
| `lib/action/fighting.js` | - | - | - | - | CREATE |
| `lib/action/game-loop.js` | - | - | - | CREATE | REUSE |
| REST handlers (card) | REUSE | REUSE | REUSE | - | - |
| REST handlers (action) | - | - | - | CREATE | REUSE |
| Room directory | REUSE | REUSE | REUSE | REUSE | REUSE |
| Economy settlement | REUSE | REUSE | REUSE | REUSE | REUSE |
| Admin control plane | REUSE | REUSE | REUSE | REUSE | REUSE |
| Frontend page | CREATE | CREATE | CREATE | CREATE | CREATE |
| 3D renderer | - | - | - | CREATE | REUSE |

---

## Suggested Build Order

### Phase 1: Card Family Foundation + Pick Red

**Rationale:** Pick Red is the simplest game (2 players, basic card matching). It validates the card family manager extension pattern with minimal risk. If the card manager does not exist yet, this phase creates it.

**Deliverables:**
1. `lib/card/manager.js` (if not existing) -- following party/board manager pattern
2. `lib/card/pickred.js` -- Pick Red logic
3. Catalog + network-contract updates for `pickred`
4. REST handlers for card rooms (if not existing)
5. Frontend: Pick Red room page

**Dependencies:** None. Pure extension of existing patterns.

### Phase 2: Big Two

**Rationale:** Second card family game. Validates 4-player card rooms and more complex hand-type validation. Reuses the card manager infrastructure built in Phase 1.

**Deliverables:**
1. `lib/card/bigtwo.js` -- Big Two logic
2. Catalog update for `bigtwo`
3. Frontend: Big Two room page with hand-type display

**Dependencies:** Phase 1 (card manager).

### Phase 3: Mahjong

**Rationale:** Most complex card-family game. 4 players, 136 tiles, multiple simultaneous declaration windows (chi/pong/kong/hu), complex scoring. Build last among card games to avoid blocking on complexity.

**Deliverables:**
1. `lib/card/mahjong.js` -- Mahjong logic (largest single module)
2. Possibly new socket events in card namespace for declaration windows
3. Catalog update for `mahjong`
4. Frontend: Mahjong room page with tile rendering (SVG-based tiles)

**Dependencies:** Phase 1 (card manager), Phase 2 (4-player card room validation).

### Phase 4: Racing (Action Family)

**Rationale:** First real-time game. Creates the entire `action` family infrastructure (game loop, delta state, input buffering). This is the highest-risk phase because it introduces a new architectural pattern.

**Deliverables:**
1. `lib/action/manager.js` -- Real-time room manager
2. `lib/action/game-loop.js` -- Shared game loop
3. `lib/action/racing.js` -- Racing logic
4. Socket events: `action:*` family
5. REST handlers: `/api/action/rooms`
6. Frontend: Racing page with Three.js renderer
7. `network-contract.js` updates for action family

**Dependencies:** None architecturally, but should come after card games to avoid parallel complexity. The action family is a greenfield subsystem.

### Phase 5: Fighting

**Rationale:** Second real-time game. Reuses the action family infrastructure from Phase 4. Only adds fighting-specific logic (hitboxes, frame data, combos).

**Deliverables:**
1. `lib/action/fighting.js` -- Fighting logic
2. Frontend: Fighting page with 2.5D sprite renderer (Canvas or WebGL)
3. Potential tick rate upgrade for the action manager (30Hz -> 60Hz option)

**Dependencies:** Phase 4 (action family manager, game loop).

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `lib/games/catalog.js` | Game metadata, family definitions, config defaults, limits | All managers, all handlers, hub, frontend |
| `lib/card/manager.js` | Card room lifecycle, turn scheduling, bot turns | Room directory, economy, network-contract |
| `lib/card/{game}.js` | Pure game logic (rules, state machine, serialization) | Card manager only |
| `lib/action/manager.js` | Real-time room lifecycle, game loop, delta broadcasting | Room directory, economy, network-contract |
| `lib/action/{game}.js` | Pure game logic (physics, hit detection, scoring) | Action manager only |
| `lib/action/game-loop.js` | Fixed timestep loop, input batching, delta computation | Action manager |
| `lib/rooms/directory.js` | Room registration, room-number allocation, snapshot persistence | All managers |
| `lib/socket-server.js` | Socket.IO event binding, middleware, family routing | All managers |
| `lib/shared/network-contract.js` | API routes, socket event constants, presence states | All frontend + backend code |

---

## Data Flow

### Card Family (Mahjong / Big Two / Pick Red)

```
Client action (game:play / game:pass)
  -> lib/socket-server.js (route by room family)
  -> lib/card/manager.js (validate seat, turn, state)
  -> lib/card/{game}.js (apply action, compute next state)
  -> lib/card/manager.js (serializeRoom per viewer, emit room:update)
  -> Room directory (sync snapshot)
```

### Action Family (Racing / Fighting)

```
Client input (action:input, 20-60Hz)
  -> lib/socket-server.js (route to action family)
  -> lib/action/manager.js (buffer input, queue for next tick)

Tick (setInterval, 20Hz):
  -> lib/action/manager.js (drain input buffer)
  -> lib/action/{game}.js (apply all buffered inputs, step physics/combat)
  -> lib/action/manager.js (compute delta, broadcast action:update)
  -> Room directory (sync snapshot, lower frequency)
```

---

## Scalability Considerations

| Concern | Current (100 users) | At 10K users | At 1M users |
|---------|---------------------|--------------|-------------|
| Room state | Single-node in-memory | Single-node in-memory (sufficient) | Redis/external store needed |
| Socket connections | Single Socket.IO server | Multiple nodes + Redis adapter | Horizontal scaling with sticky sessions |
| Game loop (action family) | `setInterval` in main thread | Worker threads per game room | Dedicated game server processes |
| 3D assets | Static CDN | Static CDN | CDN + asset streaming |
| Database | Single PostgreSQL | Read replicas | Sharded by region |

The single-node in-memory model is sufficient for the current scale. The action family's game loop is the first component that will need CPU isolation (worker threads) when concurrent rooms exceed ~50.

---

## Sources

- Architecture analysis based on direct source code reading of:
  - `lib/shared/network-contract.js` (socket events, API routes, presence states)
  - `lib/games/catalog.js` (game metadata, family catalog, config defaults)
  - `lib/party/manager.js` (party room manager pattern)
  - `lib/board/manager.js` (board room manager pattern)
  - `lib/board/flyingchess.js` (game logic module pattern)
  - `lib/party/drawguess.js` (game logic module pattern)
  - `lib/rooms/directory.js` (shared room directory)
  - `docs/architecture/backend-contract.md` (API/socket ownership)
  - `docs/overview/project-overview.md` (platform overview)
  - `package.json` (dependency versions)
