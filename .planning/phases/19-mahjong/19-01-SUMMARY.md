---
phase: 19-mahjong
plan: 01
subsystem: game-logic
tags: [mahjong, tile-encoding, win-detection, fan-scoring, recursive-backtracking]

# Dependency graph
requires: []
provides:
  - "Pure tile logic module for Mahjong (lib/card/mahjong-tiles.js)"
  - "144-tile encoding with Chinese labels"
  - "Claim detection (chi/pong/kong/win) with priority ordering"
  - "Win detection: basic form, seven pairs, thirteen orphans"
  - "Fan scoring with 14 MCR fan types"
  - "100 test fixtures for tile logic"
affects: [19-02, 19-03, 19-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [recursive-backtracking-win-detection, fan-stacking-scoring]

key-files:
  created:
    - lib/card/mahjong-tiles.js
    - test-logic/mahjong-tiles.test.js
  modified: []

key-decisions:
  - "FAN_TABLE uses 'fan' field name (not 'points') for consistency"
  - "Fans stack (sum all applicable) - 大四喜 + 碰碰胡 + 自摸 all count"
  - "Win detection returns {type, melds, pair} structure for basic wins"
  - "tileValue sorts by suit*100+rank for consistent ordering"

patterns-established:
  - "Recursive backtracking for meld decomposition"
  - "Fan stacking: all applicable fans sum without exclusion"

requirements-completed: [MJ-03, MJ-04, MJ-06, MJ-07, MJ-08, MJ-09, MJ-10, MJ-11, MJ-12]

# Metrics
duration: 15min
completed: 2026-05-04
---

# Phase 19 Plan 01: Tile Logic Module Summary

**144-tile Mahjong encoding with recursive backtracking win detection, 14 MCR fan types, and 100 test fixtures**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-04T09:20:42Z
- **Completed:** 2026-05-04T09:35:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Complete 144-tile encoding with correct distribution and Chinese labels
- Claim detection (chi/pong/kong/win) with proper priority ordering
- Win detection via recursive backtracking: basic form, seven pairs, thirteen orphans
- Fan scoring with 14 MCR fan types that stack correctly
- 100 test fixtures covering all logic paths

## Task Commits

Each task was committed atomically:

1. **Task 1: Tile encoding, wall building, claim detection** - `27e210e` (feat)
2. **Task 2: Win detection and fan scoring** - `513f252` (feat)

## Files Created/Modified
- `lib/card/mahjong-tiles.js` - Pure tile logic module with all exports
- `test-logic/mahjong-tiles.test.js` - 100 test fixtures for tile logic

## Decisions Made
- FAN_TABLE uses 'fan' field name (not 'points') for consistency with test expectations
- Fans stack (sum all applicable) - 大四喜 + 碰碰胡 + 自摸 all count without exclusion
- Win detection returns {type, melds, pair} structure for basic wins to support fan calculation
- tileValue sorts by suit*100+rank for consistent ordering across all suits

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wind tile labels**
- **Found during:** Task 1
- **Issue:** Wind labels returned "東" instead of "東風"
- **Fix:** Updated getWindLabel to return "東風", "南風", "西風", "北風"
- **Files modified:** lib/card/mahjong-tiles.js
- **Verification:** Test "Chinese labels for wind tiles are correct" passes
- **Committed in:** 27e210e (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TILE_SUITS constant names**
- **Found during:** Task 1
- **Issue:** TILE_SUITS used FENG/JIAN instead of WIND/DRAGON
- **Fix:** Renamed to WIND and DRAGON to match plan spec
- **Files modified:** lib/card/mahjong-tiles.js
- **Verification:** Test "TILE_SUITS has all 6 suits defined" passes
- **Committed in:** 27e210e (Task 1 commit)

**3. [Rule 1 - Bug] Fixed tileValue to sort by suit then rank**
- **Found during:** Task 1
- **Issue:** tileValue returned only rank, not suit*100+rank
- **Fix:** Changed to tile.suit * 100 + tile.rank
- **Files modified:** lib/card/mahjong-tiles.js
- **Verification:** All tileValue sorting tests pass
- **Committed in:** 27e210e (Task 1 commit)

**4. [Rule 1 - Bug] Fixed test tile counts for exposed melds**
- **Found during:** Task 2
- **Issue:** Tests had wrong tile counts (11 instead of 14 total)
- **Fix:** Added missing tiles to hand to reach 14 total
- **Files modified:** test-logic/mahjong-tiles.test.js
- **Verification:** All exposed meld tests pass
- **Committed in:** 513f252 (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (4 bugs)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered
- Stub file had incorrect field names and tile counts that needed fixing
- Exposed meld tests required careful tile count calculation (hand + melds = 14)

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tile logic module complete and tested
- Ready for Plan 02 (Mahjong room manager) which imports from this module
- All exports match contract: createMahjongTileSet, shuffle, buildWall, detectClaims, detectWin, calculateFan, isFlower, isHonor, tileValue, TILE_SUITS, FAN_TABLE

---
*Phase: 19-mahjong*
*Completed: 2026-05-04*
