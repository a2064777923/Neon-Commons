---
phase: 05-board-gameplay-expansion
plan: 01
subsystem: "board"
tags:
  - gomoku
  - chinese-checkers
  - socket.io
  - ui
provides:
  - "Gomoku room config now supports standard and center-opening presets."
  - "Board lobby and live room share one canonical board config summary helper."
  - "Chinese Checkers room payload now includes per-seat target-camp progress."
affects:
  - board lobby
  - board rooms
  - phase-06-hardening
tech-stack:
  added: []
  patterns:
    - "Create-time board config normalization in the board manager"
    - "Shared board config chips derived from catalog helpers"
key-files:
  created: []
  modified:
    - lib/games/catalog.js
    - lib/board/manager.js
    - pages/games/[gameKey].js
    - pages/board/[roomNo].js
    - styles/BoardRoom.module.css
key-decisions:
  - "Keep Gomoku openingRule immutable after room creation and enforce it from room.config on the backend."
  - "Expose Chinese Checkers progress by serializing race-state data instead of changing board geometry or room flow."
patterns-established:
  - "Lobby cards and room HUD chips both use getBoardConfigSummary(gameKey, config)."
requirements-completed:
  - BOARD-01
duration: "12min"
completed: 2026-04-22
---

# Phase 5 Plan 01 Summary

**Gomoku center-opening config, shared board-setting chips, and Chinese Checkers progress serialization landed on the existing board-room contract**

## Performance

- **Duration:** 12 min
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Gomoku rooms now expose `开局规则` with `标准开局` and `天元开局`, and the board manager enforces the exact first-move rule with the locked error text.
- Chinese Checkers room payloads now include per-seat `goalReached`, `goalTotal`, `remaining`, `campLabel`, and `targetCampLabel` progress data for live race-state guidance.
- Board lobby cards, selected create-form summary, and live board-room HUD all render the same canonical config chips.

## Task Commits

1. **Task 1: Normalize board capability fields in the shared runtime** - `uncommitted working tree`
2. **Task 2: Surface board settings and race-state cues in lobby and room UI** - `uncommitted working tree`

## Files Created/Modified

- `lib/games/catalog.js` - Added Gomoku opening options plus `getBoardConfigSummary()` for shared lobby/room chip rendering.
- `lib/board/manager.js` - Normalized `openingRule`, enforced center-opening, and serialized Chinese Checkers progress fields.
- `pages/games/[gameKey].js` - Added Gomoku opening selector and board config summaries in room creation and room cards.
- `pages/board/[roomNo].js` - Rendered board config chips, Chinese progress badges, and Gomoku opening hints in the live room.
- `styles/BoardRoom.module.css` - Styled the added progress badges and seat progress summaries.

## Decisions & Deviations

- Kept the new board option strictly create-time only by storing and enforcing it from `room.config`.
- Chose low-risk board expansion scope: Gomoku gets one preset rule addition, while Chinese Checkers gets richer progress visibility without rule or geometry changes.
- No material deviation from the plan.

## Next Phase Readiness

- Plan 02 can lock this work with node and Playwright coverage against the canonical config/payload/UI surface.
