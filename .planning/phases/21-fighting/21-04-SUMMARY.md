---
phase: 21-fighting
plan: 04
status: complete
started: "2026-05-06"
completed: "2026-05-06"
commits:
  - hash: d140678
    message: "feat(fighting): PixiJS scene, character sprites, platforms, and hit effects"
    files:
      - styles/FightingRoom.module.css
      - components/fighting/FightingScene.js
      - components/fighting/CharacterSprite.js
      - components/fighting/PlatformRenderer.js
      - components/fighting/HitEffect.js
  - hash: 765ee7f
    message: "feat(fighting): HUD, touch controls, and room page with 60Hz input"
    files:
      - components/fighting/HUD.js
      - components/fighting/TouchControls.js
      - pages/fighting/[roomNo].js
---

# Plan 21-04: Fighting Frontend - PixiJS Arena Rendering & Room Page

## What Was Built

Complete frontend layer for the 2.5D fighting game, connecting to the backend (Plan 03) via socket events. 8 files across 2 atomic commits.

### Commit 1: PixiJS Scene + Character Sprites + Platforms + Hit Effects + CSS

| File | Lines | Purpose |
|------|-------|---------|
| `styles/FightingRoom.module.css` | ~300 | Full CSS module: game shell, HUD layout, health/energy bars, round badges, countdown animation, touch controls joystick+buttons, ready/result overlays, hit effects, toast |
| `components/fighting/FightingScene.js` | ~170 | PixiJS Application init (async import), background + platform rendering, per-character rendering with state-specific visuals (attack arms, block shield, KO stars, hit tint, invulnerability alpha) |
| `components/fighting/CharacterSprite.js` | ~120 | Character visual component with fallback colored rectangles, animation speed constants per state, facing-aware scale, walk wobble, attack/block/KO visual indicators |
| `components/fighting/PlatformRenderer.js` | ~45 | Arena platform rendering (ground vs upper platforms with distinct colors, rounded rects, border strokes) |
| `components/fighting/HitEffect.js` | ~55 | Sprite-based hit effects overlay (spark/slash/block_spark types with fade-out animation, positioned at impact point) |

### Commit 2: HUD + Touch Controls + Room Page

| File | Lines | Purpose |
|------|-------|---------|
| `components/fighting/HUD.js` | ~100 | Health bars (segmented, color-coded per player), energy meter with finisher-glow pulse, round counter, countdown display, round wins, phase-aware rendering |
| `components/fighting/TouchControls.js` | ~170 | Mobile virtual joystick (left/right/up for movement+jump), diamond button layout (jump, heavy, dodge, attack, block), touch event handling with pressed state feedback |
| `pages/fighting/[roomNo].js` | ~350 | Full room page: Socket.IO connection with reconnect, 60Hz boolean input sending (WASD+JKL+Shift), client-side movement prediction, dynamic import with ssr:false, ready/countdown/fighting/round_end/match_end phase flow, room loading with auto-join |

## Key Design Decisions

- **PixiJS v8 async init**: Uses `await app.init()` pattern (PixiJS v8 API) instead of constructor
- **Fallback rendering**: Characters render as colored rectangles since sprite art is not yet available; designed to swap to AnimatedSprite when atlas art ships
- **60Hz input**: `INPUT_SEND_INTERVAL = 16.67ms` (matches server tick rate); only sends on change
- **Client-side prediction**: Movement inputs applied locally for responsiveness; reconciles with server state (snap threshold 30px)
- **Input mapping**: W/ArrowUp=jump, A/ArrowLeft=left, D/ArrowRight=right, J=light attack, K=heavy attack, L=block, Shift=dodge
- **Touch diamond layout**: 5 buttons in cross pattern (U/H/D/A/B) centered on right side; joystick on left
- **Server delta handling**: Handles both `{room: ...}` room updates and raw `{tick, characters, ...}` delta ticks from the 60Hz game loop

## Verification

- All 8 files created and verified on disk
- 2 atomic commits with conventional commit messages
- No modifications to STATE.md or ROADMAP.md

## Dependencies

- `pixi.js` (must be installed for PixiJS Application)
- Server-side fighting manager (Plan 03) providing socket events and game loop
- Network contract (already shipped) with `SOCKET_EVENTS.fighting` and `API_ROUTES.fightingRooms`
