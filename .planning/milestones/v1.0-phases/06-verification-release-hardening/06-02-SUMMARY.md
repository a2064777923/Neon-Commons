---
phase: 06-verification-release-hardening
plan: 02
subsystem: infra
tags: [docker-compose, readiness, release-gate, operator-flow]
requires:
  - phase: 06-01
    provides: Named critical logic and UI suites
provides:
  - Canonical `deploy:3100` command for Docker app redeploy
  - Readiness-aware `verify:release` command for the deployed runtime
affects: [deployment-ops, release-verification, docs]
tech-stack:
  added: []
  patterns: [single Node release runner orchestrates deploy, readiness, and verification]
key-files:
  created: [scripts/verify-release.js]
  modified: [package.json]
key-decisions:
  - "Use one Node runner for deploy and verify flows instead of shell pipelines so readiness and stage output stay readable."
patterns-established:
  - "Release validation defaults to redeploying the canonical 3100/3101 stack before smoke checks."
requirements-completed: [QUAL-01]
duration: 18 min
completed: 2026-04-22
---

# Phase 6 Plan 02: Canonical 3100 redeploy and release verification runner

**`deploy:3100` and `verify:release` now rebuild the canonical Docker app, wait for frontend/backend readiness, and run the critical suites against the deployed runtime.**

## Performance

- **Duration:** 18 min
- **Started:** 2026-04-22T10:19:00Z
- **Completed:** 2026-04-22T10:37:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `scripts/verify-release.js` as the operator-owned release runner for deploy and verification stages.
- Added `npm run deploy:3100` to refresh the Docker `app` service on `3100/3101` and wait for `/login` plus `/api/hub` readiness.
- Added `npm run verify:release` with default redeploy behavior and `--skip-deploy` support for immediate reruns after the stack is already current.

## Task Commits

No isolated task commits were created in this session because Phase 6 executed on an already-dirty working tree and the user did not ask for partial git commits.

## Files Created/Modified

- `scripts/verify-release.js` - Implements canonical deploy, readiness polling, stage logging, and release verification orchestration.
- `package.json` - Exposes `deploy:3100` and `verify:release`.

## Decisions Made

- Used `/login` and `/api/hub` as readiness probes because they validate both the deployed frontend and the real backend contract surface.
- Kept redeploy-on-run as the default verification behavior and treated `--skip-deploy` as an explicit opt-out for reruns only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added explicit stage logging to the release runner**
- **Found during:** Task 2 (release verification command)
- **Issue:** The first version of the runner verified correctly but did not make stage boundaries obvious enough for operator-facing docs.
- **Fix:** Added structured release-stage logging for readiness, check, logic, UI, and final success output.
- **Files modified:** `scripts/verify-release.js`
- **Verification:** `npm run verify:release -- --skip-deploy`
- **Committed in:** Not committed in this dirty-worktree session

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Improved operator clarity without changing scope or runtime contract.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Deployment and release docs can now point at real commands instead of reconstructed shell snippets.
- Phase 03 docs refresh can treat `verify:release` as the single canonical pre-ship gate.

## Self-Check: PASSED
