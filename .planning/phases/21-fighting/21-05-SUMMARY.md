---
phase: 21-fighting
plan: 05
status: complete
started: "2026-05-06"
completed: "2026-05-06"
commits:
  - hash: a5dbce5
    message: "feat(21-05): add fighting GameIcon SVG and set catalog launchState to live"
    files:
      - components/game-hub/GameIcon.js
      - lib/games/catalog.js
      - test-logic/fighting-logic.test.js
  - hash: 77ac7f8
    message: "feat(21-05): register fighting room manager in admin live-room-ops"
    files:
      - lib/admin/live-room-ops.js
---

# Plan 21-05: Fighting Final Integration - Icon, Catalog, Admin

## What Was Built

Final wiring plan making the fighting game visible in the hub and manageable by admins. 4 files across 2 atomic commits.

### Commit 1: GameIcon SVG + Catalog LaunchState + Test Fix

| File | Change | Purpose |
|------|--------|---------|
| `components/game-hub/GameIcon.js` | +35 lines | Added fighting icon SVG with two fighter silhouettes (red/green), punching and blocking stances, and yellow impact lines on a dark red gradient background |
| `lib/games/catalog.js` | 2 lines | Changed fighting entry `launchState` from `"coming-soon"` to `"live"` and `isShipped` from `false` to `true` |
| `test-logic/fighting-logic.test.js` | 1 line | Updated catalog assertion from `"coming-soon"` to `"live"` to match new launch state |

### Commit 2: Admin Live-Room-Ops Registration

| File | Change | Purpose |
|------|--------|---------|
| `lib/admin/live-room-ops.js` | +6 lines | Added `getFightingRoomManager` import and fighting provider entry (`familyKey: "light-3d"`) to the room provider registry |

## Key Design Decisions

- **No explicit control-plane.js changes needed**: `CONTROLLED_GAME_KEYS`, `ROLLOUT_MANAGED_GAME_KEYS`, and `SHIPPED_GAME_KEYS` are all dynamically computed from `GAME_CATALOG` entries filtered by `isShipped` and `capabilityManaged`. Setting `isShipped: true` automatically registers fighting in the admin control plane.
- **Family-based room provider**: Fighting uses `familyKey: "light-3d"` consistent with the racing provider pattern and the catalog entry's `familyKey`.
- **Test updated atomically**: The catalog test assertion was updated in the same commit as the catalog change to keep tests green at every commit boundary.

## Verification

All automated verifications pass:
- `getGameMeta('fighting')` returns `launchState: "live"`, `isShipped: true`
- `getGameLimits('fighting')` returns `{minPlayers: 2, maxPlayers: 2}`
- `buildCapabilityFamilies` includes fighting under `light-3d` family
- `grep -c "fighting" components/game-hub/GameIcon.js` returns 1
- `grep -c "fighting" lib/games/catalog.js` returns 5
- `node --test test-logic/fighting-logic.test.js` passes (0 failures)

## Dependencies

- Plans 21-01 (fighting catalog entry), 21-03 (fighting backend manager), 21-04 (fighting frontend)
- Admin control plane capability system (dynamic catalog-driven registration)
- Live-room-ops provider pattern (explicit per-game manager registration)
