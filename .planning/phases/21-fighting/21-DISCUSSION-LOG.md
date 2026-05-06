# Discussion Log: Phase 21 Fighting (打斗)

**Date:** 2026-05-06
**Mode:** Default (interactive)

## Area 1: Character Sprites & Animation

| # | Question | Options Presented | User Selection |
|---|----------|------------------|----------------|
| 1 | How should fighting characters be rendered? | Sprite sheets, Geometric shapes, Skeletal animation | Sprite sheets (2D art) |
| 2 | How many animation frames per state? | Low-frame (3-5), Medium-frame (8-12), Placeholder first | Medium-frame (8-12 per state) |
| 3 | What visual style? | Pixel art, Vector/flat color, High-res illustrated | Vector / flat color |
| 4 | How many playable characters? | Mirror match, 2 characters, Framework for N ship 1-2 | Framework for N, ship 1-2 |
| 5 | Sprite sheet structure? | Single sheet, Per-state, Packed atlas (JSON+image) | Packed atlas (JSON + image) |
| 6 | How should characters face left/right? | Flip horizontally, Separate left/right art | Separate left/right art |
| 7 | Attack animation speed? | Fast (12f), Medium (20f), Varies by move | Varies by move type |
| 8 | How should hits be visualized? | Screen shake, Sprite-based effects, Minimal VFX | Sprite-based hit effects |

## Area 2: Combat System & Attacks

| # | Question | Options Presented | User Selection |
|---|----------|------------------|----------------|
| 1 | How many attack types? | 2 buttons+direction, 3 buttons+direction, 1 button+direction | Full system: light/heavy attacks, combos, specials, energy finisher, jump/dodge, character abilities |
| 2 | How should combos work? | Fixed sequences, Natural chain, Cancel-based | Natural chain (light → heavy) |
| 3 | Energy meter charging? | Damage builds, Combos build faster, Passive time | Hybrid: damage + combos build faster |
| 4 | How should blocking work? | Hold to block, Timed parry, Hold+parry | Integrated: hold block + timed parry |
| 5 | How should dodge work? | Dash with i-frames, Sidestep (2.5D), Backdash | Dash with i-frames |

## Area 3: Arena Design & Movement

| # | Question | Options Presented | User Selection |
|---|----------|------------------|----------------|
| 1 | Platforms for vertical movement? | Flat ground, Multi-level, Ground+1 platform | Platforms (multi-level) |
| 2 | Arena boundaries? | Walls, Ring-out, Side walls+bottom open | Ring-out (fall = lose round) |
| 3 | How should jumping work? | Double jump, Single jump, Single jump+air dash | Single jump + air dash |

## Area 4: Character Variety & Rounds

| # | Question | Options Presented | User Selection |
|---|----------|------------------|----------------|
| 1 | How different should characters be? | Unique stats+specials, Same base, Completely different | Unique stats + unique specials |
| 2 | How many rounds per match? | Best of 3, Best of 5, Configurable | Configurable (host picks) |
| 3 | How should health be displayed? | Horizontal bar, Segmented bar, Percentage | Hybrid: horizontal bar + segments + percentage knockback |
| 4 | Round transition on KO? | Slow-mo+winner pose, Quick KO, Dramatic zoom | Slow-mo + winner pose |

## Deferred Ideas

- Cancel-based combo system (more technical, competitive depth)
- Additional characters beyond initial 1-2
- Character-specific intro/victory animations
- Stage hazards and interactive elements
- Ranked matchmaking and ELO
- Replay system
- Tutorial/training mode
- Sound effects and music

## Summary

User wants a feature-rich fighting game with deep combat mechanics (light/heavy attacks, combos, specials, finishers, parry, dodge with i-frames), multi-level platform arenas with ring-out, and configurable rounds. Visual style is vector/flat color sprite sheets with packed atlas format, separate left/right art, and sprite-based hit effects. Framework supports multiple characters but ships 1-2 for v1.
