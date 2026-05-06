# Phase 21: Fighting (打斗) - Research

**Researched:** 2026-05-06
**Domain:** 2.5D arena fighting game with sprite-based characters, hitbox combat, and round system
**Confidence:** MEDIUM

## Summary

Phase 21 introduces a real-time 2.5D fighting game using PixiJS for 2D rendering, replacing Three.js used in Racing. The game features sprite-based characters with packed atlas animations, hitbox/hurtbox combat, multi-level platforms with ring-out mechanics, and a configurable round system. This is the second game in the "light-3d" family, reusing the room manager singleton pattern, delta-state broadcasting, and socket event contract established by Racing, but adapted for 60Hz server simulation (3x faster than Racing's 20Hz).

**Primary recommendation:** Build `FightingRoomManager` as a singleton following the `RacingRoomManager` pattern, with a 60Hz `setInterval` game loop. Use PixiJS v8.18.1 for client-side 2D rendering with `@pixi/react` for React integration. Implement hitbox/hurtbox collision detection server-side using AABB (Axis-Aligned Bounding Box) checks against character state frames. No external physics engine needed — fighting game physics are simpler than car physics and benefit from deterministic frame-accurate collision.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- PixiJS for 2D rendering (replaces Three.js)
- Packed atlas format (JSON + image) for sprite sheets
- Separate left/right art for character facing
- 8-12 frames per character state
- Vector / flat color visual style
- Rich combat: light/heavy attacks, combos (natural chain), specials, energy finisher, parry, dodge with i-frames
- Multi-level platforms with ring-out (fall = lose)
- Single jump + air dash
- Server-authoritative 60Hz simulation (Racing uses 20Hz, Fighting needs 60Hz)
- Delta-state broadcasting pattern from Racing is reusable
- Configurable rounds (host picks)
- Hybrid health bar (horizontal + segments + percentage knockback)

### Claude's Discretion
- Specific sprite dimensions and atlas layout
- Hitbox/hurtbox sizes and positioning per state
- Platform layout geometry for arenas
- Frame data for specific attacks (startup, active, recovery)
- Knockback values and scaling curves
- Energy meter thresholds and gain rates
- Parry timing window (frames)
- i-frame duration on dodge
- Character stat ranges and balance values
- Arena background art and theme
- Sound effects (deferred)

### Deferred Ideas (OUT OF SCOPE)
- Cancel-based combo system (more technical, better for competitive play)
- Additional characters beyond the initial 1-2
- Character-specific intro/victory animations
- Stage hazards and interactive arena elements
- Ranked matchmaking and ELO system
- Replay system
- Tutorial/training mode
- Sound effects and music
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FIGHT-01 | Create Fighting room from hub with action-game options | Extends catalog.js and room creation pattern |
| FIGHT-02 | 2 players join via room-number entry | Reuse existing room-entry flow from network-contract.js |
| FIGHT-03 | 2.5D arena rendering with PixiJS | PixiJS v8 Application, AnimatedSprite, Spritesheet |
| FIGHT-04 | Hitbox/hurtbox combat with frame-accurate detection | AABB collision on server, frame data per attack |
| FIGHT-05 | Combo system with natural chain (light → heavy) | Timing windows, input buffering |
| FIGHT-06 | Server validates at 60Hz with delta-state broadcasting | setInterval(16.67ms) game loop, compute delta per tick |
| FIGHT-07 | Multi-level platforms with ring-out | Platform AABB bodies, fall detection |
| FIGHT-08 | Configurable round system | Round state machine, host picks round count |
| FIGHT-09 | Health bar with segments + percentage knockback | Hybrid horizontal bar, knockback scaling |
| FIGHT-10 | Energy meter + finisher | Energy gain from damage/combos, finisher threshold |
| FIGHT-11 | Blocking with parry + dodge with i-frames | Hold block, perfect timing parry, i-frame invincibility |
| PLAT-01 | Fighting registered in game catalog with light-3d family | Add to GAME_CATALOG under light-3d |
| PLAT-02 | Hub displays fighting with correct icon | New GameIcon entry for fighting |
| PLAT-03 | Room-entry flow works for fighting | New API routes + socket events in network-contract.js |
| PLAT-04 | Admin control plane manages fighting rooms | Register FightingRoomManager with admin |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Character state machine | API / Backend | — | Server-authoritative; determines valid state transitions |
| Hitbox/hurtbox collision | API / Backend | — | Server validates all hits authoritatively |
| 60Hz game loop | API / Backend | — | setInterval on server, drives state + delta broadcast |
| Input collection | Browser / Client | API / Backend | Client captures keyboard/touch, forwards to server |
| Client-side prediction | Browser / Client | — | Client applies inputs locally for responsiveness |
| 2D rendering | Browser / Client | — | PixiJS in browser only |
| Sprite animation | Browser / Client | — | AnimatedSprite driven by server state |
| Platform physics | API / Backend | — | Server validates positions, gravity, platform collision |
| Round management | API / Backend | — | Server tracks round wins, health, transitions |
| Room management | API / Backend | — | Singleton manager per game family pattern |
| Delta-state broadcast | API / Backend | — | Server computes and sends delta via socket.io |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pixi.js | 8.18.1 | 2D rendering engine | Industry standard for 2D browser games; WebGL renderer; sprite sheet support; [VERIFIED: npm registry] |
| @pixi/react | 8.0.5 | React integration for PixiJS | Declarative JSX components for PixiJS; [VERIFIED: npm registry] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next | current (in project) | Framework | Already in project; dynamic imports for PixiJS |
| socket.io | current (in project) | Real-time comms | Already in project; handles reconnection, rooms |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pixi.js | Phaser 3 | Phaser includes physics/audio/tilemap but is heavier; PixiJS is rendering-only, lighter |
| @pixi/react | Raw PixiJS API | Raw API gives more control but requires manual React lifecycle management |
| Custom hitbox system | Matter.js / Planck.js | Physics engines add overhead for simple AABB checks; fighting games need frame-accurate hitboxes, not continuous physics |

**Installation:**
```bash
npm install pixi.js @pixi/react
```

**Version verification:** pixi.js@8.18.1 and @pixi/react@8.0.5 confirmed current via npm registry on 2026-05-06.

## Architecture Patterns

### System Architecture Diagram

```
[Client Browser]
  |
  |-- Keyboard/Touch Input --> {fighting:input socket event}
  |-- PixiJS Renderer <-- {fighting:update socket event (delta state)}
  |-- AnimatedSprite <-- {character state from server}
  |-- Client-side Prediction (apply local inputs)
  |-- HUD (health bars, round counter, energy meter)
  |
  v
[Socket.io Server]
  |
  v
[FightingRoomManager (singleton)]
  |
  |-- Per-room: CharacterState[]
  |   |-- position { x, y }
  |   |-- velocity { x, y }
  |   |-- state: "idle" | "walk" | "jump" | "attack_light" | "attack_heavy" | ...
  |   |-- facing: "left" | "right"
  |   |-- health: number
  |   |-- energy: number
  |   |-- currentFrame: number
  |   |-- hitboxes: AABB[] (active during attack frames)
  |   |-- hurtboxes: AABB[] (always active)
  |
  |-- 60Hz Game Loop (setInterval 16.67ms)
  |   |-- Collect inputs from all players
  |   |-- Update character states (state machine transitions)
  |   |-- Apply gravity + platform collision
  |   |-- Check hitbox/hurtbox overlaps
  |   |-- Apply damage + knockback
  |   |-- Check round win conditions (health=0 or ring-out)
  |   |-- Compute delta (changed state)
  |   |-- Broadcast delta to all sockets in room
  |
  |-- Round State Machine: waiting -> countdown -> fighting -> round_end -> next_round -> match_end
  |
  v
[Room Directory] -- registerRoomEntry / updateRoomEntry / unregisterRoomEntry
```

### Recommended Project Structure
```
lib/
  fighting/
    manager.js          # FightingRoomManager singleton (room lifecycle, game loop)
    character.js        # Character state machine, frame data, hitbox/hurtbox definitions
    combat.js           # Hitbox collision detection, damage calculation, knockback
    physics.js          # Gravity, platform collision, ring-out detection
    delta.js            # Delta-state computation and serialization (60Hz optimized)
    arena.js            # Arena/platform definitions
    constants.js        # Game constants (frame data, timing windows, balance values)
pages/
  fighting/
    [roomNo].js         # Fighting room page (PixiJS scene, input handling, socket)
components/
  fighting/
    FightingScene.js    # PixiJS Application setup, sprite rendering
    CharacterSprite.js  # AnimatedSprite wrapper for character states
    PlatformRenderer.js # Platform/arena rendering
    HitEffect.js        # Sprite-based hit effects (sparks/slashes overlays)
    HUD.js              # Health bars, round counter, energy meter
    TouchControls.js    # Mobile on-screen buttons (attack, jump, block, dodge)
styles/
  FightingRoom.module.css  # Fighting room styles
test-logic/
  fighting-logic.test.js   # Character state, hitbox, combat, round tests
```

### Pattern 1: Character State Machine
**What:** A finite state machine governing character behavior with explicit transitions.
**When to use:** Any character with multiple behavioral states (idle, walk, jump, attack, block, hit, KO).
**Example:**
```javascript
// Source: Standard fighting game architecture pattern
const CHARACTER_STATES = Object.freeze({
  IDLE: "idle",
  WALK: "walk",
  JUMP: "jump",
  FALL: "fall",
  ATTACK_LIGHT: "attack_light",
  ATTACK_HEAVY: "attack_heavy",
  SPECIAL: "special",
  FINISHER: "finisher",
  BLOCK: "block",
  PARRY: "parry",
  DODGE: "dodge",
  HIT_STUN: "hit_stun",
  KNOCKBACK: "knockback",
  KO: "ko",
  RING_OUT: "ring_out"
});

// Valid transitions map
const TRANSITIONS = Object.freeze({
  idle: ["walk", "jump", "attack_light", "attack_heavy", "special", "finisher", "block", "dodge"],
  walk: ["idle", "jump", "attack_light", "attack_heavy", "special", "finisher", "block", "dodge"],
  jump: ["fall", "attack_light", "attack_heavy", "dodge"], // air attacks
  fall: ["idle"], // landing
  attack_light: ["idle", "attack_heavy"], // natural chain
  attack_heavy: ["idle"],
  special: ["idle"],
  finisher: ["idle"],
  block: ["idle", "parry"],
  parry: ["idle"],
  dodge: ["idle"],
  hit_stun: ["idle", "knockback"],
  knockback: ["idle", "ring_out", "ko"],
  ko: [],
  ring_out: []
});

function canTransition(fromState, toState) {
  return TRANSITIONS[fromState]?.includes(toState) ?? false;
}

function updateCharacterState(character, input, dt) {
  const { state, frameCount } = character;

  // Check if current animation is complete
  if (frameCount >= getFrameDuration(state)) {
    // Auto-transition to idle (or next state)
    if (state === "attack_light" && input.attack_heavy) {
      character.state = "attack_heavy"; // natural chain
      character.frameCount = 0;
    } else {
      character.state = "idle";
      character.frameCount = 0;
    }
    return;
  }

  // Process input during current state
  if (canTransition(state, input.requestedState)) {
    character.state = input.requestedState;
    character.frameCount = 0;
  }

  character.frameCount += 1;
}
```
[ASSUMED] — Frame durations and transition rules need tuning during implementation.

### Pattern 2: Hitbox/Hurtbox System
**What:** Frame-accurate collision detection using AABB (Axis-Aligned Bounding Boxes) attached to character states.
**When to use:** 2D fighting games where attacks have specific active frames and hit areas.
**Example:**
```javascript
// Source: Standard fighting game hitbox architecture
// Each attack state defines hitboxes per frame
const FRAME_DATA = {
  attack_light: {
    totalFrames: 10,
    startup: 3,    // frames before hitbox appears
    active: 3,     // frames hitbox is active
    recovery: 4,   // frames after hitbox disappears
    hitboxes: [
      // Active frames: hitbox relative to character position
      { frame: 3, x: 20, y: -10, w: 40, h: 30, damage: 5, knockback: { x: 3, y: 0 } },
      { frame: 4, x: 25, y: -10, w: 45, h: 30, damage: 5, knockback: { x: 3, y: 0 } },
      { frame: 5, x: 20, y: -10, w: 40, h: 30, damage: 5, knockback: { x: 3, y: 0 } }
    ],
    // Hurtbox always active (where character can be hit)
    hurtbox: { x: -15, y: -40, w: 30, h: 80 }
  },
  attack_heavy: {
    totalFrames: 20,
    startup: 8,
    active: 5,
    recovery: 7,
    hitboxes: [
      { frame: 8, x: 15, y: -20, w: 50, h: 50, damage: 12, knockback: { x: 8, y: -3 } },
      // ... more frames
    ],
    hurtbox: { x: -15, y: -40, w: 30, h: 80 }
  }
};

function checkHitboxCollision(attacker, defender) {
  const attackerData = FRAME_DATA[attacker.state];
  if (!attackerData) return null;

  // Find hitbox for current frame
  const hitbox = attackerData.hitboxes.find(h => h.frame === attacker.frameCount);
  if (!hitbox) return null;

  // Get defender's hurtbox
  const defenderData = FRAME_DATA[defender.state] || { hurtbox: { x: -15, y: -40, w: 30, h: 80 } };
  const hurtbox = defenderData.hurtbox;

  // AABB overlap check
  const ax = attacker.facing === "right" ? attacker.pos.x + hitbox.x : attacker.pos.x - hitbox.x - hitbox.w;
  const ay = attacker.pos.y + hitbox.y;
  const dx = defender.pos.x + hurtbox.x;
  const dy = defender.pos.y + hurtbox.y;

  if (ax < dx + hurtbox.w && ax + hitbox.w > dx && ay < dy + hurtbox.h && ay + hitbox.h > dy) {
    return {
      damage: hitbox.damage,
      knockback: {
        x: hitbox.knockback.x * (attacker.facing === "right" ? 1 : -1),
        y: hitbox.knockback.y
      }
    };
  }

  return null;
}
```
[ASSUMED] — Hitbox dimensions and frame data need per-character tuning.

### Pattern 3: 60Hz Server Game Loop with Delta-State Broadcasting
**What:** Adapted from Racing's 20Hz pattern — 60Hz (16.67ms) game loop for fighting games requiring frame-precise timing.
**When to use:** Real-time games where frame data matters (fighting games, rhythm games).
**Example:**
```javascript
// Adapted from lib/racing/manager.js pattern
const TICK_INTERVAL_MS = 16.67; // 60Hz

class FightingRoomManager {
  startFight(room) {
    room.state = "fighting";
    room.fightPhase = "countdown";
    room.tick = 0;
    room.inputs = new Map();
    room.characters = [];
    room.previousState = null;
    room.roundWins = new Map();
    room.currentRound = 1;

    // Create characters for each player
    room.players.forEach((player, index) => {
      room.characters[index] = createCharacter(index, index === 0 ? "left" : "right");
      room.roundWins.set(index, 0);
    });

    // Start 60Hz game loop
    room.lastTickTime = Date.now();
    room.loopTimer = setInterval(() => this.gameTick(room), TICK_INTERVAL_MS);
  }

  gameTick(room) {
    if (room.fightPhase !== "fighting") return;

    room.tick += 1;

    // 1. Process inputs → state transitions
    for (const [seatIndex, input] of room.inputs) {
      updateCharacterState(room.characters[seatIndex], input, 1/60);
    }

    // 2. Apply physics (gravity, platform collision)
    for (const char of room.characters) {
      applyGravity(char, 1/60);
      resolvePlatformCollision(char, room.arena);
    }

    // 3. Check hitbox/hurtbox collisions
    for (let i = 0; i < room.characters.length; i++) {
      for (let j = i + 1; j < room.characters.length; j++) {
        const hit = checkHitboxCollision(room.characters[i], room.characters[j]);
        if (hit && !room.characters[j].invulnerable) {
          applyDamage(room.characters[j], hit);
        }
        const hit2 = checkHitboxCollision(room.characters[j], room.characters[i]);
        if (hit2 && !room.characters[i].invulnerable) {
          applyDamage(room.characters[i], hit2);
        }
      }
    }

    // 4. Check ring-out
    for (const char of room.characters) {
      if (char.pos.y > room.arena.bounds.bottom + 100) {
        char.state = "ring_out";
        this.handleRoundEnd(room, char.seatIndex === 0 ? 1 : 0);
        return;
      }
    }

    // 5. Check KO
    for (const char of room.characters) {
      if (char.health <= 0) {
        char.state = "ko";
        this.handleRoundEnd(room, char.seatIndex === 0 ? 1 : 0);
        return;
      }
    }

    // 6. Compute and broadcast delta
    const delta = computeDelta(room, room.previousState);
    room.previousState = delta;
    this.io?.to(getSocketRoom(room.roomNo)).emit(SOCKET_EVENTS.fighting.update, delta);
  }
}
```
[ASSUMED] — 60Hz game loop performance in Node.js needs profiling; may need optimization if CPU-bound.

### Pattern 4: Platform Collision for 2.5D Arena
**What:** Multi-level platforms with AABB collision detection for a 2.5D fighter.
**When to use:** Games with vertical movement and multiple platform levels.
**Example:**
```javascript
// Platform definition
const ARENA_LAYOUT = {
  bounds: { left: -400, right: 400, top: -300, bottom: 500 }, // ring-out at bottom
  platforms: [
    { x: 0, y: 0, w: 600, h: 20 },      // main ground
    { x: -200, y: -120, w: 200, h: 15 }, // left platform
    { x: 200, y: -120, w: 200, h: 15 },  // right platform
    { x: 0, y: -240, w: 150, h: 15 }     // top platform
  ]
};

function applyGravity(character, dt) {
  character.velocity.y += GRAVITY * dt;
  character.pos.y += character.velocity.y * dt;
}

function resolvePlatformCollision(character, arena) {
  // Check each platform
  for (const plat of arena.platforms) {
    // Only check if falling (don't snap to platform from below)
    if (character.velocity.y <= 0) continue;

    // AABB check: character bottom vs platform top
    const charBottom = character.pos.y + character.hurtbox.y + character.hurtbox.h;
    const charLeft = character.pos.x + character.hurtbox.x;
    const charRight = charLeft + character.hurtbox.w;

    if (charRight > plat.x && charLeft < plat.x + plat.w) {
      if (charBottom >= plat.y && charBottom <= plat.y + 10) { // tolerance
        character.pos.y = plat.y - character.hurtbox.y - character.hurtbox.h;
        character.velocity.y = 0;
        character.grounded = true;
        if (character.state === "fall") character.state = "idle";
      }
    }
  }
}
```
[ASSUMED] — Platform layout and dimensions need arena-specific tuning.

### Pattern 5: Client-Side Prediction for Fighting
**What:** Client applies inputs locally before server confirms, for zero perceived input lag.
**When to use:** Real-time games where input responsiveness matters.
**Example:**
```javascript
// Adapted from Racing client prediction pattern
// Input structure for fighting
const input = {
  left: keys.left,
  right: keys.right,
  up: keys.up,      // jump
  attack: keys.j,    // light attack
  heavy: keys.k,     // heavy attack
  block: keys.l,     // hold block
  dodge: keys.shift   // dodge
};

// Client-side prediction
function applyLocalPrediction(input) {
  if (myCharacterIndex == null) return;

  const char = localCharacters[myCharacterIndex];
  if (!char) return;

  // Movement prediction
  if (input.left) char.pos.x -= MOVE_SPEED * (1/60);
  if (input.right) char.pos.x += MOVE_SPEED * (1/60);

  // Jump prediction
  if (input.up && char.grounded) {
    char.velocity.y = JUMP_FORCE;
    char.grounded = false;
  }

  // Apply gravity
  char.velocity.y += GRAVITY * (1/60);
  char.pos.y += char.velocity.y * (1/60);
}
```
[ASSUMED] — Client prediction for fighting is more complex than racing due to hitbox interactions; may need reconciliation for hit detection.

### Anti-Patterns to Avoid
- **Full state broadcast every tick at 60Hz:** Wastes bandwidth; use delta-state with aggressive thresholding
- **Client-only hit detection:** Allows cheating; hits must be validated server-side
- **Using physics engine for hitboxes:** Overkill; AABB checks are deterministic and frame-accurate
- **PixiJS on server:** PixiJS is browser-only; all rendering is client-side
- **Sharing character state between rooms:** Each room needs isolated character instances
- **setInterval without drift correction:** At 60Hz, drift accumulates faster; use setTimeout with elapsed time tracking
- **Treating 60Hz like 20Hz:** 3x more ticks means 3x more delta computations; optimize delta with higher thresholds

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 2D rendering | Custom Canvas/WebGL | PixiJS | Mature library with sprite sheets, animations, scene graph |
| Sprite animation | Custom frame counter + drawImage | PixiJS AnimatedSprite | Built-in frame management, speed control, looping |
| Sprite sheet loading | Custom JSON parser + image loader | PixiJS Assets.load + Spritesheet | Automatic atlas parsing, texture management |
| React integration | Manual PixiJS lifecycle in useEffect | @pixi/react | Declarative JSX, automatic cleanup, hooks (useTick) |
| Room management | Custom singleton | Existing RacingRoomManager pattern | Proven pattern with reconnection, directory, admin hooks |
| Delta-state broadcasting | Custom diff algorithm | Existing delta.js pattern | Already optimized, tested, handles edge cases |
| Socket event contract | Ad-hoc event names | Existing SOCKET_EVENTS pattern | Consistent with all other games, admin tools work |

**Key insight:** The hitbox/hurtbox collision system IS hand-rolled — this is intentional. Fighting game hitboxes are frame-data-driven, not physics-engine-driven. AABB checks are simple, deterministic, and frame-accurate. Using a physics engine would add unnecessary complexity and non-determinism.

## Common Pitfalls

### Pitfall 1: PixiJS SSR Crash
**What goes wrong:** PixiJS accesses `window`/`document` at import time; crashes during Next.js SSR.
**Why it happens:** Next.js renders pages server-side by default; PixiJS requires browser APIs.
**How to avoid:** Use `dynamic(() => import('./FightingScene'), { ssr: false })` or check `typeof window !== 'undefined'` before creating Application.
**Warning signs:** `window is not defined` or `document is not defined` errors on page load.

### Pitfall 2: 60Hz Game Loop CPU Pressure
**What goes wrong:** Server CPU maxed out running 60Hz game loops for multiple rooms.
**Why it happens:** 3x more ticks per second than Racing; each tick does collision detection for all characters.
**How to avoid:** Profile early; consider reducing to 30Hz if CPU-bound; optimize delta computation to skip unchanged characters; use typed arrays for hitbox data.
**Warning signs:** Tick count falls behind wall clock time; rooms lag when multiple active.

### Pitfall 3: Delta-State Bandwidth at 60Hz
**What goes wrong:** 60 updates per second overwhelms client bandwidth.
**Why it happens:** Each delta contains character positions, states, frame counts, health, energy.
**How to avoid:** Aggressive delta thresholding — only send if position changed > 1px or state changed; batch multiple ticks into single broadcast if behind; consider 30Hz broadcast with 60Hz simulation.
**Warning signs:** Client receives updates faster than it can render; visual stuttering.

### Pitfall 4: Hitbox Desync Between Client and Server
**What goes wrong:** Client shows hit connecting but server says miss (or vice versa).
**Why it happens:** Client and server have slightly different positions due to prediction/interpolation.
**How to avoid:** Client shows hit effects based on server confirmation only (not local prediction); use "hit confirm" event from server to trigger effects; visual-only hitboxes on client for feedback.
**Warning signs:** Players report "phantom hits" or "hits that didn't register".

### Pitfall 5: Frame Data Off-by-One Errors
**What goes wrong:** Hitbox active on wrong frames; attacks feel too fast or too slow.
**Why it happens:** Frame counting starts at 0 vs 1; startup/active/recovery frame counts don't match total.
**How to avoid:** Define frame data with explicit frame numbers (not ranges); validate that startup + active + recovery = totalFrames; unit test all frame data.
**Warning signs:** Attacks feel inconsistent; hitbox appears one frame early/late.

### Pitfall 6: Ring-Out Detection False Positives
**What goes wrong:** Characters ring out when they should land on platform edge.
**Why it happens:** Platform collision check uses character center but ring-out uses character bottom.
**How to avoid:** Use consistent coordinate reference (character bottom for both); add tolerance zone above ring-out boundary.
**Warning signs:** Characters die near platform edges unexpectedly.

### Pitfall 7: Combo Input Buffering
**What goes wrong:** Combo inputs dropped or registered twice.
**Why it happens:** Input arrives between server ticks; timing window check is off by one tick.
**How to avoid:** Buffer inputs with timestamps; check timing window in frames, not real time; allow 2-3 frame input buffer for combos.
**Warning signs:** Combos only work sometimes; players report "dropped inputs".

## Code Examples

### PixiJS Application in Next.js
```javascript
// pages/fighting/[roomNo].js
import dynamic from "next/dynamic";

const FightingScene = dynamic(() => import("../../components/fighting/FightingScene"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading fight...</div>
});
```
[VERIFIED: Next.js dynamic import pattern from pages/racing/[roomNo].js]

### PixiJS Sprite Sheet Loading
```javascript
// Source: PixiJS v8 API
import { Assets, AnimatedSprite } from "pixi.js";

// Load sprite sheet (JSON atlas + image)
const sheet = await Assets.load("/sprites/character-idle.json");

// Access named animations
const idleFrames = sheet.animations["idle"];
const walkFrames = sheet.animations["walk"];

// Create animated sprite
const sprite = new AnimatedSprite(idleFrames);
sprite.animationSpeed = 0.167; // ~10fps at 60Hz
sprite.anchor.set(0.5, 1); // bottom-center anchor
sprite.play();
```
[VERIFIED: PixiJS v8 API — Assets.load returns Spritesheet for JSON atlas files]

### Sprite Sheet JSON Format (TexturePacker)
```json
{
  "frames": {
    "idle_001.png": {
      "frame": { "x": 0, "y": 0, "w": 64, "h": 96 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 96 },
      "sourceSize": { "w": 64, "h": 96 }
    },
    "idle_002.png": {
      "frame": { "x": 64, "y": 0, "w": 64, "h": 96 },
      "rotated": false,
      "trimmed": false,
      "spriteSourceSize": { "x": 0, "y": 0, "w": 64, "h": 96 },
      "sourceSize": { "w": 64, "h": 96 }
    }
  },
  "animations": {
    "idle": ["idle_001.png", "idle_002.png", "idle_003.png", "idle_004.png"],
    "walk": ["walk_001.png", "walk_002.png", "walk_003.png", "walk_004.png"],
    "attack_light": ["atk_l_001.png", "atk_l_002.png", "atk_l_003.png"]
  },
  "meta": {
    "image": "character-idle.png",
    "size": { "w": 256, "h": 256 },
    "scale": "1"
  }
}
```
[VERIFIED: PixiJS Spritesheet expects TexturePacker JSON Hash/Array format]

### @pixi/react Component
```javascript
// Source: @pixi/react documentation
import { Application, extend, useTick } from "@pixi/react";
import { Container, Sprite, AnimatedSprite, Graphics } from "pixi.js";

extend({ Container, Sprite, AnimatedSprite, Graphics });

function FightingScene({ gameState, myIndex }) {
  return (
    <Application width={800} height={600} background="#1a1a2e">
      <pixiContainer>
        {gameState?.characters?.map((char, i) => (
          <CharacterSprite key={i} character={char} isLocal={i === myIndex} />
        ))}
      </pixiContainer>
    </Application>
  );
}
```
[VERIFIED: @pixi/react API — extend() registers PixiJS components for JSX use]

### Socket Event Registration (Following Racing Pattern)
```javascript
// Add to SOCKET_EVENTS in network-contract.js:
fighting: Object.freeze({
  subscribe: "fighting:subscribe",
  ready: "fighting:ready",
  input: "fighting:input",
  update: "fighting:update",
  error: "fighting:error",
  chat: "fighting:chat"
})

// Add to API_ROUTE_PATTERNS:
fightingRooms: Object.freeze({
  list: "/api/fighting/rooms",
  detail: "/api/fighting/rooms/:roomNo",
  join: "/api/fighting/rooms/:roomNo/join"
})
```
[VERIFIED: Pattern from lib/shared/network-contract.js — SOCKET_EVENTS.racing structure]

### Room Manager Singleton (Following Racing Pattern)
```javascript
// Source: lib/racing/manager.js pattern
function getFightingRoomManager() {
  if (!global.fightingRoomManager) {
    global.fightingRoomManager = new FightingRoomManager();
  }
  return global.fightingRoomManager;
}
```
[VERIFIED: Pattern from lib/racing/manager.js line 32-37]

### Socket Handler Registration (Following Racing Pattern)
```javascript
// Add to lib/socket-server.js:
const { getFightingRoomManager } = require("./fighting/manager");
// ...
const fightingManager = getFightingRoomManager();
fightingManager.attachIo(io);

socket.on(SOCKET_EVENTS.fighting.subscribe, ({ roomNo }) => {
  handleScopedEvent(socket, SOCKET_EVENTS.fighting.error, "light-3d", roomNo, () => {
    fightingManager.registerSocket(roomNo, socket.user.id, socket);
  });
});
```
[VERIFIED: Pattern from lib/socket-server.js lines 270-284]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Three.js for 2D | PixiJS for 2D | Phase 21 decision | Lighter bundle, better 2D sprite support |
| 20Hz game loop | 60Hz game loop | Fighting game requirement | Frame-accurate hitbox detection |
| cannon-es physics | Custom AABB hitboxes | Fighting game architecture | Deterministic, frame-accurate, no physics engine overhead |
| Skeletal animation | Sprite sheet animation | D-01 decision | Simpler art pipeline, packed atlas format |

**Deprecated/outdated:**
- Three.js for 2D games: PixiJS is the standard for 2D browser games
- Physics engines for fighting games: AABB hitboxes are more appropriate for frame-accurate combat

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PixiJS 8.18.1 works with Next.js dynamic import `{ ssr: false }` | Common Pitfalls | May need additional SSR guards |
| A2 | 60Hz game loop is feasible in Node.js for 2-player rooms | Architecture | May need to reduce to 30Hz or optimize |
| A3 | AABB hitbox collision is sufficient for fighting game combat | Pattern 2 | May need more complex collision for special moves |
| A4 | @pixi/react 8.0.5 is compatible with pixi.js 8.18.1 | Standard Stack | Version mismatch could cause runtime errors |
| A5 | Frame data (startup/active/recovery) needs per-character tuning | Pattern 1 | Game feel may be poor without iteration |
| A6 | Combo timing windows of 6-10 frames are standard | Pattern 1 | Too tight = dropped inputs, too loose = button mashing |
| A7 | Parry window of 3-5 frames is standard | Claude's Discretion | Too tight = unusable, too loose = overpowered |
| A8 | i-frames on dodge last 8-12 frames | Claude's Discretion | Balance between evasion and invulnerability |
| A9 | 2-player fighting needs less CPU than 4-player racing | Performance | Hitbox checks may be more expensive than physics |
| A10 | Delta-state broadcasting at 60Hz needs higher thresholds than 20Hz | Architecture | Bandwidth could be 3x Racing |

## Open Questions (RESOLVED)

1. **PixiJS + @pixi/react version compatibility** (RESOLVED — Plan 01 risk spike)
   - Decision: Install both in Wave 1 (Plan 01); test CJS import and dynamic import compatibility immediately
   - Fallback: If @pixi/react has issues, use raw PixiJS API directly (no React wrapper)

2. **60Hz vs 30Hz broadcast rate** (RESOLVED — Claude's Discretion)
   - Decision: Start with 60Hz simulation + 60Hz broadcast; profile in Plan 03 testing
   - Fallback: If bandwidth > 2KB/tick, reduce broadcast to 30Hz while keeping 60Hz simulation

3. **Client-side hitbox visualization** (RESOLVED — Claude's Discretion / Deferred)
   - Decision: Defer debug hitbox visualization to post-v1; not required for gameplay
   - Rationale: Server-authoritative validation means debug visualization is a developer tool, not a player feature

4. **Sprite sheet art pipeline** (RESOLVED — Claude's Discretion)
   - Decision: Use placeholder geometric shapes (rectangles with state labels) for v1; real art deferred
   - Rationale: Art pipeline is external to code; placeholder sprites validate the animation system

5. **Separate left/right sprite art storage** (RESOLVED — Claude's Discretion)
   - Decision: Single atlas per character with `_left` and `_right` suffixes in frame names
   - Pattern: `character_idle_left_01`, `character_idle_right_01` in same atlas JSON

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Server game loop | ✓ | v24.15.0 | — |
| npm | Package install | ✓ | — | — |
| pixi.js | 2D rendering (client) | Will install | 8.18.1 | — |
| @pixi/react | React integration | Will install | 8.0.5 | — |
| socket.io | Real-time comms | ✓ | (in project) | — |
| TexturePacker | Sprite sheet generation | ✗ | — | Manual JSON + ShoeBox/SpriteSheet Packer |

**Missing dependencies with no fallback:**
- None — all dependencies are npm packages or already available

**Missing dependencies with fallback:**
- TexturePacker (paid tool): Use free alternatives like ShoeBox, SpriteSheet Packer, or manual JSON creation

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (`node --test`) |
| Config file | none — uses `node --test` directly per package.json scripts |
| Quick run command | `node --test test-logic/fighting-logic.test.js` |
| Full suite command | `npm run test:logic:critical` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIGHT-04 | Hitbox collision detection correct | unit | `node --test test-logic/fighting-logic.test.js` | Wave 0 |
| FIGHT-05 | Combo timing windows work | unit | `node --test test-logic/fighting-logic.test.js` | Wave 0 |
| FIGHT-06 | Delta-state at 60Hz computed correctly | unit | `node --test test-logic/fighting-logic.test.js` | Wave 0 |
| FIGHT-07 | Platform collision + ring-out | unit | `node --test test-logic/fighting-logic.test.js` | Wave 0 |
| FIGHT-08 | Round state machine transitions | unit | `node --test test-logic/fighting-logic.test.js` | Wave 0 |
| FIGHT-01 | Room creation via API | integration | `playwright test tests/fighting-entry.spec.js` | Wave 0 |
| FIGHT-02 | Player join flow | integration | `playwright test tests/fighting-entry.spec.js` | Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test test-logic/fighting-logic.test.js`
- **Per wave merge:** `npm run test:logic:critical`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test-logic/fighting-logic.test.js` — covers FIGHT-04, FIGHT-05, FIGHT-06, FIGHT-07, FIGHT-08
- [ ] `tests/fighting-entry.spec.js` — covers FIGHT-01, FIGHT-02
- [ ] PixiJS SSR compatibility test: verify dynamic import works with `{ ssr: false }`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing auth flow (login/guest) |
| V3 Session Management | yes | Socket.io auth via cookie/JWT |
| V4 Access Control | yes | Room ownership, spectator vs player |
| V5 Input Validation | yes | Validate input ranges (booleans for buttons, no arbitrary values) |
| V6 Cryptography | no | No custom crypto needed |

### Known Threat Patterns for Real-Time Fighting Games

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Speed hack (fake inputs) | Tampering | Server-authoritative state; clamp input to valid buttons |
| Hit spoofing (fake hit events) | Tampering | Server validates all hitbox collisions; client can't trigger hits |
| Input flooding (DoS) | Denial of Service | Rate-limit inputs to 60Hz per player; drop excess |
| Room hijacking | Elevation of Privilege | Validate userId matches room occupant on every input |
| State manipulation | Tampering | Server owns all character state; client sends only inputs |

## Sources

### Primary (HIGH confidence)
- npm registry: pixi.js@8.18.1, @pixi/react@8.0.5 — verified versions on 2026-05-06
- Project codebase: lib/racing/manager.js — room manager singleton pattern (797 lines)
- Project codebase: lib/racing/delta.js — delta-state broadcasting pattern (124 lines)
- Project codebase: lib/shared/network-contract.js — API routes and socket events (406 lines)
- Project codebase: lib/games/catalog.js — game registration pattern (921 lines)
- Project codebase: pages/racing/[roomNo].js — game room page pattern (450 lines)
- Project codebase: components/racing/RacingScene.js — Three.js scene setup (186 lines)
- Project codebase: components/racing/TouchControls.js — mobile input handling (126 lines)
- Project codebase: lib/socket-server.js — socket handler registration pattern

### Secondary (MEDIUM confidence)
- PixiJS v8 documentation: Assets.load, AnimatedSprite, Spritesheet API
- @pixi/react documentation: extend(), Application, useTick hooks
- Fighting game architecture: standard hitbox/hurtbox AABB pattern (industry standard)
- Client-side prediction: adapted from Racing pattern (proven in codebase)

### Tertiary (LOW confidence)
- 60Hz game loop performance in Node.js (ASSUMED — needs profiling)
- @pixi/react 8.0.5 compatibility with pixi.js 8.18.1 (ASSUMED — needs testing)
- Frame data tuning values (ASSUMED — needs iteration)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified, PixiJS is industry standard for 2D
- Architecture: MEDIUM — room manager pattern proven, but 60Hz loop and hitbox system are new
- Pitfalls: MEDIUM — common pitfalls known from training data, but specific to this project's patterns

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (30 days — stable libraries)
