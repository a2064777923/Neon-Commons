---
phase: 06-verification-release-hardening
plan: 01
subsystem: testing
tags: [node:test, playwright, package-scripts, release-gate]
requires:
  - phase: 04-card-party-gameplay-expansion
    provides: Card and party regression surface used by the critical suites
  - phase: 05-board-gameplay-expansion
    provides: Board and dedicated-route regression surface used by the critical suites
provides:
  - Named node critical suite for shared contracts, admin, hub, and shipped gameplay logic
  - Named Playwright critical suite for the shipped browser surface on 3100
affects: [package-scripts, release-verification, deployment-docs]
tech-stack:
  added: []
  patterns: [operator-facing critical verification scripts in package.json]
key-files:
  created: []
  modified: [package.json]
key-decisions:
  - "Promote the existing brownfield test inventory into named critical suites instead of inventing a new harness."
patterns-established:
  - "Critical release checks are exposed as stable npm scripts instead of ad hoc filename bundles."
requirements-completed: [QUAL-01]
duration: 12 min
completed: 2026-04-22
---

# Phase 6 Plan 01: Critical logic and UI suites for the shipped platform surface

**Named `test:logic:critical` and `test:ui:critical` gates now cover the shared backend contract, admin, hub, room, and shipped gameplay surface.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-22T10:07:00Z
- **Completed:** 2026-04-22T10:19:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Added `npm run test:logic:critical` for backend contract, CORS, client runtime contract, admin, hub / room-entry, card, party, board, and solo logic coverage.
- Added `npm run test:ui:critical` for hub, admin, Dou Dizhu, party rooms, board rooms, Reversi, Sokoban, and Undercover smoke coverage.
- Verified the new critical suites against the deployed `3100` runtime after a fresh Docker rebuild.

## Task Commits

No isolated task commits were created in this session because Phase 6 executed on an already-dirty working tree and the user did not ask for partial git commits.

## Files Created/Modified

- `package.json` - Added operator-facing `test:logic:critical` and `test:ui:critical` scripts.

## Decisions Made

- Reused the shipped test inventory as the critical release surface instead of creating a second verification layer.
- Kept `test:logic` and `test:ui` intact while adding explicit critical gates for release use.

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The repo now exposes stable critical suites that Plan 02 can compose into a canonical release gate.
- Browser smoke already respects `FRONTEND_BASE_URL`, so the next plan can target deployed `3100` directly.

## Self-Check: PASSED
