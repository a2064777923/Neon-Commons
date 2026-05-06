# Phase 21: Fighting (打斗) - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

2.5D arena fighting game with sprite-based characters, hitbox combat, and configurable round system. Two players fight on multi-level platforms with ring-out win conditions. Uses PixiJS for rendering, server-authoritative 60Hz simulation, and the light-3d game family established by Racing. Rich combat system with light/heavy attacks, combos, specials, energy finishers, blocking with parry, and dodge with i-frames.

</domain>

<decisions>
## Implementation Decisions

### Character Sprites & Animation
- **D-01:** Sprite sheets (2D art) for character rendering — not geometric shapes or skeletal animation
- **D-02:** Medium-frame animation: 8-12 frames per character state
- **D-03:** Vector / flat color visual style (clean lines, scalable, modern look)
- **D-04:** Framework supports N characters, ship 1-2 for v1
- **D-05:** Packed atlas format (JSON + image) for sprite sheets — standard for PixiJS
- **D-06:** Separate left/right art for character facing (not horizontal flip)
- **D-07:** Attack animation speed varies by move type — light attacks fast (~10-12 frames), heavy attacks slow (~20-25 frames)
- **D-08:** Sprite-based hit effects for visualizing impacts (animated sparks/slashes as separate overlays)

### Combat System
- **D-09:** Rich attack vocabulary: light attack, heavy attack, combos, special skills, energy finisher, jump, dodge, character-specific abilities
- **D-10:** Combo system: natural chain (light → heavy) with timing windows — cancel-based system deferred
- **D-11:** Energy meter charges from both damage dealt/taken AND successful combos (combos charge faster)
- **D-12:** Blocking: integrated system — hold block button for normal block, perfectly-timed block triggers parry/counter
- **D-13:** Dodge: dash with invincibility frames (i-frames) for evasion

### Arena & Movement
- **D-14:** Multi-level platforms for vertical movement (not flat ground)
- **D-15:** Ring-out win condition — falling off the arena loses the round (like Smash Bros)
- **D-16:** Single jump + air dash for aerial mobility (not double jump)

### Character Design
- **D-17:** Characters have unique stats (speed, power, weight) and unique special moves
- **D-18:** Configurable round count — host picks at room creation (default: best of 3)
- **D-19:** Health display: hybrid horizontal bar with segments + percentage-based knockback scaling
- **D-20:** Round transition: slow-motion on final hit + winner pose animation, then next round

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Game Patterns
- `lib/racing/manager.js` — Room manager singleton pattern (light-3d family)
- `lib/racing/physics.js` — Physics engine integration pattern (cannon-es)
- `lib/racing/delta.js` — Delta-state broadcasting pattern
- `lib/shared/network-contract.js` — API routes and socket events contract
- `lib/games/catalog.js` — Game catalog registration (light-3d family already defined)

### Frontend Patterns
- `pages/racing/[roomNo].js` — Game room page pattern (dynamic import, socket, input handling)
- `components/racing/RacingScene.js` — PixiJS/Three.js scene setup pattern
- `components/racing/HUD.js` — HUD overlay pattern
- `components/racing/TouchControls.js` — Mobile input handling pattern
- `styles/RacingRoom.module.css` — Game room CSS pattern

### Prior Phase Context
- `.planning/phases/20-racing/20-CONTEXT.md` — Racing decisions (light-3d family, server-authoritative loop, delta-state, client prediction)
- `.planning/phases/20-racing/20-RESEARCH.md` — Racing research (patterns reusable for Fighting)

### Dependencies (to install)
- `pixi.js` — 2D rendering library (replaces Three.js for this game)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/racing/manager.js` — Room manager singleton pattern can be adapted for FightingRoomManager
- `lib/racing/delta.js` — Delta-state broadcasting pattern reusable (60Hz instead of 20Hz)
- `lib/shared/network-contract.js` — Add fighting socket events and API routes following racing pattern
- `lib/games/catalog.js` — Register fighting under light-3d family (familyKey already exists)
- `components/racing/TouchControls.js` — Touch input pattern adaptable for fighting controls
- `components/racing/HUD.js` — HUD overlay pattern reusable for health bars and round display

### Established Patterns
- Server-authoritative game loop with delta-state broadcasting (Racing at 20Hz, Fighting needs 60Hz)
- Client-side prediction with server reconciliation for responsive input
- Game room page with dynamic import (ssr: false) for renderer libraries
- Socket event contract: subscribe, ready, input, update, error, chat
- API routes: list rooms, create room, room detail, join room

### Integration Points
- `lib/games/catalog.js` — Register fighting game entry under light-3d family
- `lib/shared/network-contract.js` — Add fighting API routes and socket events
- `lib/socket-server.js` — Register fighting socket handlers
- `components/game-hub/GameIcon.js` — Add fighting icon SVG
- `lib/admin/live-room-ops.js` — Add fighting room provider for admin management

</code_context>

<specifics>
## Specific Ideas

- Combat system inspired by traditional fighting games (Street Fighter, Guilty Gear) with modern accessibility
- Ring-out mechanic adds strategic depth — positioning matters as much as health
- Multi-level platforms create vertical gameplay (like Smash Bros arena stages)
- Energy finisher system rewards aggressive, skilled play
- Parry mechanic adds high-skill defensive option
- Separate left/right sprite art for more natural character animation
- Percentage-based knockback scaling means damage compounds — early hits are safe, late hits are deadly

</specifics>

<deferred>
## Deferred Ideas

- Cancel-based combo system (more technical, better for competitive play)
- Additional characters beyond the initial 1-2
- Character-specific intro/victory animations
- Stage hazards and interactive arena elements
- Ranked matchmaking and ELO system
- Replay system
- Tutorial/training mode
- Sound effects and music

</deferred>

---

*Phase: 21-fighting*
*Context gathered: 2026-05-06*
