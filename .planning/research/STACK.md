# Technology Stack Additions for 5 New Games

**Project:** Hong's Neon-Commons
**Researched:** 2026-05-04
**Overall Confidence:** MEDIUM (training data only -- external verification tools were blocked)

---

## Scope

This document covers ONLY the new dependencies and capabilities required for these 5 games:

| Game | Family | Rendering | Real-Time? |
|------|--------|-----------|------------|
| Mahjong | card | 2D tile/table | Turn-based |
| Pick Red | card | 2D card matching | Turn-based |
| Big Two | card | 2D card hand | Turn-based |
| Racing | light-3d | 3D WebGL | Yes (60fps) |
| Fighting | light-3d | 2.5D Canvas/WebGL | Yes (60fps) |

---

## Category 1: Pure Game Logic (Mahjong, Pick Red, Big Two)

**Recommendation: Zero new dependencies. Write all logic in pure JavaScript.**

This follows the existing platform pattern. Every shipped game (Dou Dizhu, Gomoku, Reversi, Chinese Checkers, Flying Chess, Werewolf, Avalon, Undercover, Draw Guess, Sokoban) implements its game logic in plain JS modules under `lib/`. No game-specific npm packages are used anywhere in the codebase.

### Mahjong Logic (lib/card/mahjong.js)

All of the following are implementable in ~500-800 lines of pure JS:

- **Tile set**: 136 tiles (1-9 wan/tiao/tong x4, 4 winds x4, 3 dragons x4, 8 flowers/seasons optional). Represent as numeric IDs.
- **Wall building and dealing**: Fisher-Yates shuffle, 13 tiles per player, 14 for dealer.
- **Hand recognition**: Detect chi (sequential meld of 3), pon (triplet), kan (quad), pair. Standard recursive decomposition algorithm.
- **Win condition**: 4 melds + 1 pair, or special hands (seven pairs, thirteen orphans).
- **Scoring**: Taiwanese 16-tile or Hong Kong Old Style fan counting. Pure arithmetic, no external dependency.

**Decision**: No `mahjong-scoring` or `mahjong-hands` npm package exists that is reliable enough to trust over custom logic. The rules vary by variant (Taiwanese, Hong Kong, Japanese Riichi, Chinese Official). Custom logic gives full control.

### Pick Red Logic (lib/card/pickred.js)

Very simple game, ~150-200 lines:

- **Deck**: Standard 52-card deck, deal 5 to each player, rest is draw pile.
- **Matching**: Find pairs in hand that sum to 10 (e.g., A+9, 2+8, 3+7, 4+6, 5+5). Face cards (J/Q/K) scored individually.
- **Turn**: Draw from deck or discard, attempt to match, discard.
- **Scoring**: Red cards (hearts, diamonds) worth points. Pure counting logic.

### Big Two Logic (lib/card/bigtwo.js)

~400-600 lines:

- **Hand types**: Single, pair, triple, straight (5+), flush, full house, four-of-a-kind + kicker, straight flush.
- **Comparison**: Same-type hands compared by rank; different types cannot be compared (must follow lead type).
- **Card ordering**: 3 < 4 < ... < K < A < 2, suits: diamond < club < heart < spade.
- **Dealing**: 13 cards each, player with 3 of diamonds leads first.

**Decision**: No npm library needed. Hand comparison is well-defined and straightforward to implement.

---

## Category 2: 3D Rendering (Racing)

### Three.js

| Property | Value |
|----------|-------|
| Purpose | 3D scene rendering for racing game |
| npm package | `three` |
| Recommended version | `^0.172.0` (latest stable) |
| Bundle size | ~600KB minified, ~150KB gzipped (core only) |
| License | MIT |

**Why Three.js over alternatives:**

- **Three.js vs Babylon.js**: Three.js is lighter, more flexible, and better suited for a "light-3d" game that does not need a full game engine. Babylon.js includes a physics engine, GUI system, and editor -- all unnecessary overhead for a racing minigame. Three.js is the de facto standard for web 3D with the largest ecosystem.
- **Three.js vs PlayCanvas**: PlayCanvas is a full cloud-hosted game engine. Overkill for this platform. Three.js integrates naturally with React via dynamic import.
- **Why not raw WebGL**: Three.js provides scene graph, camera, lights, materials, and model loading for free. Raw WebGL would require thousands of lines for basic 3D rendering.

**Integration approach**: Use `dynamic(() => import('three'))` and load the racing component only on the Racing game page. Three.js should NOT be in the main bundle.

**What to use from Three.js:**
- `THREE.Scene`, `THREE.PerspectiveCamera`, `THREE.WebGLRenderer`
- `THREE.BoxGeometry` / `THREE.CylinderGeometry` for simple car shapes (no GLTF needed for v1)
- `THREE.PlaneGeometry` for track
- `THREE.DirectionalLight` + `THREE.AmbientLight`
- `requestAnimationFrame` game loop (Three.js does not provide one -- use `renderer.setAnimationLoop`)

### cannon-es (Physics)

| Property | Value |
|----------|-------|
| Purpose | 3D physics for car movement, collisions |
| npm package | `cannon-es` |
| Recommended version | `^0.20.0` |
| Bundle size | ~80KB minified |
| License | MIT |

**Why cannon-es:**

- **cannon-es vs @dimforge/rapier3d**: Rapier is faster (Rust/WASM) but has a larger WASM binary (~500KB) and more complex setup. For a light racing game with 2-6 cars, cannon-es is sufficient.
- **cannon-es vs ammo.js**: ammo.js is a C++ Emscripten port of Bullet. Heavier, harder API. cannon-es has a clean ES module API.
- **Why not cannon (original)**: cannon-es is the maintained ES module fork. The original `cannon` is abandoned.

**What to use:**
- `CANNON.World` with gravity
- `CANNON.Body` with `CANNON.Box` / `CANNON.Sphere` for cars
- `CANNON.Plane` for track surface
- Basic collision detection for car-to-car and car-to-wall

### Stats.js (optional, dev only)

| Property | Value |
|----------|-------|
| Purpose | FPS counter during development |
| npm package | `stats.js` |
| Version | latest |
| Dev only | Yes, do not ship in production |

---

## Category 3: 2.5D Rendering (Fighting)

### PixiJS

| Property | Value |
|----------|-------|
| Purpose | 2D/2.5D sprite rendering for fighting game |
| npm package | `pixi.js` |
| Recommended version | `^8.6.0` (v8 is the current major) |
| Bundle size | ~200KB minified, ~60KB gzipped |
| License | MIT |

**Why PixiJS over alternatives:**

- **PixiJS vs Phaser**: Phaser is a full game framework with scene management, input, physics, audio. It is heavier (~700KB) and its opinionated structure conflicts with the platform's React architecture. PixiJS is a pure renderer that integrates cleanly as a React component.
- **PixiJS vs raw Canvas**: PixiJS provides WebGL-accelerated sprite batching, texture atlases, and a scene graph. For a fighting game with animated sprites, particle effects for hits, and smooth scrolling backgrounds, raw Canvas would require reimplementing all of this.
- **PixiJS vs HTML5 Canvas (2D context)**: Canvas 2D is CPU-bound and cannot handle the particle effects, alpha blending, and sprite sheet animation that a fighting game needs at 60fps.
- **Why not Three.js for 2.5D**: Three.js works in 3D space. A "2.5D" fighting game (side-scrolling, 2D sprites with depth illusion) is fundamentally a 2D rendering problem. PixiJS is optimized for this.

**Integration approach**: Same dynamic import pattern as Three.js. Only load on the Fighting game page.

**What to use from PixiJS v8:**
- `Application` for canvas setup and game loop
- `Sprite` with `Texture` from sprite sheets
- `Container` for layering (background, characters, UI, particles)
- `AnimatedSprite` for character frames
- `Graphics` for hitboxes and debug overlays
- Custom `Ticker` for game loop at 60fps

**Why NOT @pixi/react**: The `@pixi/react` library adds a React reconciler over PixiJS. For a fighting game with a tight 60fps loop, the React overhead is counterproductive. Use PixiJS imperatively inside a `useRef` + `useEffect` pattern instead.

### Animation Strategy for 2.5D Fighting

**Sprite sheets** are the standard approach for 2D fighting games:

- Pre-rendered character frames (idle, walk, jump, crouch, light attack, heavy attack, special, hit, block)
- Each character: ~50-100 frames at 128x128 or 256x256
- Packed into texture atlases (e.g., 2048x2048 sheets with JSON metadata)
- Total asset size per character: ~2-5MB PNG atlas + ~10KB JSON

**No external animation library needed.** PixiJS `AnimatedSprite` handles frame-based animation natively. State machine logic (idle -> attack -> recovery -> idle) is pure JS.

### Audio

**No new audio library needed for v1.**

The platform already uses browser `getUserMedia` for voice. For game audio (SFX, background music), use the native Web Audio API:

```javascript
const audioContext = new AudioContext();
const buffer = await fetch('/audio/hit.mp3').then(r => r.arrayBuffer());
const audioBuffer = await audioContext.decodeAudioData(buffer);
const source = audioContext.createBufferSource();
source.buffer = audioBuffer;
source.connect(audioContext.destination);
source.start();
```

**Why not Howler.js**: Howler.js (~10KB) provides cross-browser audio abstraction. For a modern browser-targeted platform (the existing codebase already uses `getUserMedia`, WebSocket, etc.), the Web Audio API is sufficient. Adding Howler.js for one game is not justified.

**Why not Tone.js**: Tone.js is for music synthesis. Not needed for game SFX.

---

## Category 4: Shared Additions (All Games)

### Asset Pipeline

No new build tools needed. The existing Next.js setup handles static assets via `public/`. For 3D models and sprite sheets:

- Place racing assets in `public/games/racing/` (track textures, car models)
- Place fighting assets in `public/games/fighting/` (sprite atlases, audio)
- Next.js serves these statically

### Testing

The existing Playwright + Node test runner pattern works for all 5 games. No new testing libraries needed.

### Networking

No new networking libraries. Socket.IO 4.8.1 already handles:

- Turn-based games (Mahjong, Pick Red, Big Two): Use existing `board:*` or `card:*` socket event families
- Real-time games (Racing, Fighting): Use Socket.IO for state synchronization at ~20 ticks/second. The game loop runs client-side; server validates positions at a lower rate.

**For Racing and Fighting networking specifically:**

Socket.IO is NOT ideal for high-frequency real-time sync (60fps). However, for a "light-3d" party game (not a competitive esports title), the approach is:

1. **Client-authoritative rendering**: Each client runs its own 60fps game loop locally
2. **Server reconciliation at 20Hz**: Clients send input state 20 times/second via Socket.IO
3. **Server broadcasts positions at 20Hz**: Other players receive interpolated positions
4. **Client-side interpolation**: Smooth between received server states

This is the "good enough" approach used by most browser party games. Full client-side prediction with server reconciliation (like FPS games use) is not needed for a casual racing/fighting game.

---

## Summary: What to Add to package.json

### New production dependencies

```json
{
  "three": "^0.172.0",
  "cannon-es": "^0.20.0",
  "pixi.js": "^8.6.0"
}
```

### What NOT to add

| Package | Why Not |
|---------|---------|
| `babylonjs` | Too heavy for light-3d; Three.js is sufficient |
| `phaser` | Too opinionated; conflicts with React architecture |
| `@pixi/react` | Adds React reconciler overhead; use imperative PixiJS |
| `howler.js` | Web Audio API is sufficient for browser SFX |
| `rapier3d` | WASM binary too large for casual racing |
| `ammo.js` | Heavy C++ Emscripten port; cannon-es is cleaner |
| `cannon` (original) | Abandoned; use cannon-es |
| `mahjong-*` npm packages | Unreliable; implement game logic in pure JS |
| `playing-cards` / `card-deck` | Trivial to implement; adds unnecessary dependency |
| `gsap` / `anime.js` | PixiJS handles sprite animation natively |
| `tone.js` | Music synthesis; not needed for game SFX |
| `matter-js` | 2D physics; not needed (fighting uses hitbox checks, not physics) |
| `stats.js` | Dev-only; optional, do not ship |

---

## Integration Points with Existing Architecture

### Catalog (lib/games/catalog.js)

Add 5 new entries to `GAME_CATALOG`:
- `mahjong` -> familyKey: `card`
- `pickred` -> familyKey: `card`
- `bigtwo` -> familyKey: `card`
- `racing` -> familyKey: `light-3d`
- `fighting` -> familyKey: `light-3d`

Add `mahjong`, `pickred`, `bigtwo` to a new `CARD_GAME_KEYS` array (or extend the existing card family pattern).

### Socket Events (lib/shared/network-contract.js)

Card games (Mahjong, Pick Red, Big Two) reuse the existing `room:*` socket family:
- `room:subscribe`, `room:ready`, `room:add-bot`, `game:play`, `game:pass`, `room:chat`

Light-3D games (Racing, Fighting) need a new socket event family:
- `light3d:subscribe`, `light3d:ready`, `light3d:input`, `light3d:update`, `light3d:error`

### Room Manager

Card games: Extend existing `CardRoomManager` or create a new manager per game family pattern.

Light-3D games: Need a new `Light3DRoomManager` (following `BoardRoomManager` / `PartyRoomManager` pattern) that handles:
- Room lifecycle (create, join, ready, start, finish)
- Real-time input relay at 20Hz
- Server-side game state at reduced tick rate

### Pages

- `pages/card/[roomNo].js` -- extend or create game-specific pages for Mahjong/Pick Red/Big Two
- `pages/racing/[roomNo].js` -- new page with dynamic Three.js import
- `pages/fighting/[roomNo].js` -- new page with dynamic PixiJS import

---

## Confidence Assessment

| Area | Confidence | Reason |
|------|------------|--------|
| Pure JS game logic (Mahjong, Pick Red, Big Two) | HIGH | Follows exact pattern of all existing games; no external libs needed |
| Three.js for Racing | MEDIUM | Well-established library, but version number could not be verified against live npm |
| cannon-es for Racing physics | MEDIUM | Correct library choice, version needs verification |
| PixiJS for Fighting | MEDIUM | v8 is current major, but exact latest minor could not be verified |
| Web Audio API for SFX | HIGH | Native browser API, no dependency risk |
| Socket.IO for real-time sync at 20Hz | HIGH | Already used by the platform; 20Hz is standard for casual games |
| Bundle impact estimates | LOW | Sizes are from training data, may be outdated |

---

## Sources

- **Codebase analysis**: `package.json`, `lib/games/catalog.js`, `lib/board/manager.js`, `lib/party/manager.js`, `lib/shared/network-contract.js`, `docs/architecture/backend-contract.md`
- **Training data**: Three.js docs, PixiJS docs, cannon-es docs, Web Audio API MDN
- **Confidence note**: All external tool access (WebSearch, WebFetch, Context7, Bash) was blocked during this research. Version numbers and bundle sizes are from training data and should be verified against npm before implementation.
