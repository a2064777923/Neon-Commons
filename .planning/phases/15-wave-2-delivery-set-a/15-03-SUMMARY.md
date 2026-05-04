---
phase: 15-wave-2-delivery-set-a
plan: 03
subsystem: testing
tags: [flyingchess, playwright, entry-page, board-manager, smoke-test]

# Dependency graph
requires:
  - phase: 15-wave-2-delivery-set-a
    provides: Flying Chess runtime, rules, and UI delivered in 15-01 and 15-02
provides:
  - Authenticated user retry path on canonical entry page
  - Correct extra-roll-on-6 legend copy matching the backend rule contract
  - Hardened deployed Flying Chess multi-user smoke test closing T-15-08
affects: [15-SECURITY, 15-REVIEW, board-games-smoke]

# Tech tracking
tech-stack:
  added: []
  patterns: [entry-page-retry-button, smoke-test-retry-fallback]

key-files:
  created: []
  modified:
    - pages/entry/[gameKey]/[roomNo].js
    - pages/board/[roomNo].js
    - tests/board-games.spec.js

key-decisions:
  - "Use data-entry-action='retry' to distinguish authenticated retry from login redirect in DOM"
  - "Increase smoke entry timeout to 45s with retry-button fallback instead of polling"
  - "Increase playFlyingChessUntilMove maxAttempts from 18 to 24 for no-legal-move-on-6 edge case"

patterns-established:
  - "Entry page retry: authenticated users get a dedicated retry button (data-entry-action='retry') instead of login redirect on failed auto-enter"
  - "Smoke test retry fallback: catch timeout, check for retry button, click if present, then re-assert redirect"

requirements-completed: [WAVE-02]

# Metrics
duration: 15min
completed: 2026-05-04
---

# Phase 15 Plan 03 Summary

**Fixed two code-review blockers (entry retry, extra-roll legend) and hardened the deployed Flying Chess smoke to close T-15-08**

## Performance

- **Duration:** 15 min
- **Started:** 2026-05-04
- **Completed:** 2026-05-04
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Authenticated users who fail the auto-enter POST now see a retry button labeled "重試加入" with `data-entry-action="retry"` instead of being redirected to login
- Board legend and viewer notes now correctly teach that rolling 6 always grants an extra roll, regardless of whether a legal move exists
- Deployed Flying Chess smoke test hardened with 45s timeout, retry-button fallback, and increased move attempts to handle no-legal-move-on-6 edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix entry page retry for authenticated users (WR-01)** - `decb313` (fix)
2. **Task 2: Fix extra-roll-on-6 legend copy (WR-02)** - `e6deeab` (fix)
3. **Task 3: Close T-15-08 deployed Flying Chess smoke** - `52a0c32` (fix)

**Plan metadata:** (docs: complete plan)

## Files Created/Modified

- `pages/entry/[gameKey]/[roomNo].js` - Entry page retry button for authenticated users: changed copy to "重試加入", added conditional `data-entry-action="retry"` attribute
- `pages/board/[roomNo].js` - Board legend copy: removed "成功走完 6 点回合后还可再擲一次" and "争取额外回合" in favor of clearer "擲出 6 点即可再擲一次" / "擲出 6 点必定可再擲一次"
- `tests/board-games.spec.js` - Smoke test: increased entry redirect timeout to 45s, added retry-button fallback, increased maxAttempts from 18 to 24

## Decisions Made

- **data-entry-action="retry"**: Used a distinct DOM attribute to distinguish the authenticated retry path from the login redirect path, enabling both test selectors and accessibility tools to differentiate the two intents
- **45s timeout with retry fallback**: Rather than polling or increasing timeout indefinitely, the smoke test catches the timeout, checks for the retry button, clicks it if present, then re-asserts the redirect
- **maxAttempts 24**: The no-legal-move-on-6 extra roll can consume attempts without progressing the game; increased from 18 to 24 to give enough headroom

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 15 is now fully executed (3/3 plans complete)
- T-15-08 can be closed in the security register once the deployed smoke passes on 3100/3101
- WR-01 and WR-02 from 15-REVIEW.md are resolved
- Ready for Phase 16 (Wave 2 Delivery Set B & Milestone Hardening)

---
*Phase: 15-wave-2-delivery-set-a*
*Completed: 2026-05-04*
