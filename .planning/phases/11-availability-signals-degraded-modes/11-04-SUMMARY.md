---
phase: 11-availability-signals-degraded-modes
plan: 04
subsystem: ui
tags: [availability, degraded-mode, undercover, voice, webrtc, playwright]
requires:
  - phase: 11-availability-signals-degraded-modes
    plan: 02
    provides: shared degraded-mode envelopes across admin, hub, entry, and party-room surfaces
  - phase: 11-availability-signals-degraded-modes
    plan: 03
    provides: stable deployed-stack release reruns and critical Playwright coverage
provides:
  - truthful Undercover voice guidance across hub, entry, and dedicated room surfaces
  - turn-scoped mic controls for the active clue speaker on the dedicated Undercover route
  - hardened browser smoke session recovery for serial deployed-stack release verification
affects: [hub-entry, party-rooms, undercover, release-verification]
tech-stack:
  added: []
  patterns:
    - backend-authored degraded voice guidance can stay family-scoped while specializing safe actions per game
    - dedicated party-family routes can reuse shared voice signaling if turn ownership is enforced from room state
    - non-idempotent browser auth helpers need recovery paths when a direct registration request times out after the server already committed
key-files:
  created:
    - .planning/phases/11-availability-signals-degraded-modes/11-04-SUMMARY.md
  modified:
    - lib/shared/availability.js
    - backend/handlers/hub.js
    - backend/handlers/room-entry/resolve.js
    - backend/handlers/party/rooms/[roomNo]/index.js
    - lib/party/manager.js
    - pages/index.js
    - pages/entry/[gameKey]/[roomNo].js
    - pages/undercover/[roomNo].js
    - styles/UndercoverRoom.module.css
    - test-logic/hub-room-entry.test.js
    - test-logic/backend-contract.test.js
    - tests/hub-entry.spec.js
    - tests/undercover.spec.js
    - tests/board-games.spec.js
    - tests/reversi.spec.js
    - tests/support/auth.js
key-decisions:
  - "Keep the Undercover fix game-aware instead of redefining the whole party-family voice contract."
  - "Expose active-speaker ownership from backend room state so the dedicated room never guesses who may open mic."
  - "Treat release-smoke auth setup as recoverable: when direct registration times out or races with an already-created user, recover by logging in instead of retrying the same non-idempotent registration blindly."
patterns-established:
  - "Undercover can advertise voiceEnabled truthfully by combining shared degraded-state vocabulary with room-specific turn gating."
  - "Serial deployed-stack Playwright gates stay trustworthy when slow room-creation hops and non-idempotent auth helpers get explicit recovery/wait logic."
requirements-completed: [AVAIL-01, AVAIL-03]
duration: 1h46min
completed: 2026-04-23
---

# Phase 11 Plan 04 Summary

**Undercover now ships truthful turn-based voice guidance from hub entry through the dedicated room, with release smokes hardened enough to stay green on the canonical deployed stack.**

## Performance

- **Duration:** 1h46min
- **Started:** 2026-04-23T12:21:39+08:00
- **Completed:** 2026-04-23T14:07:32+08:00
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- Added a game-aware Undercover voice action so hub cards and room-entry pages stop misrepresenting `voiceEnabled: true` rooms as text-only fallbacks.
- Added dedicated Undercover voice UI that lets listeners join safely, lets only the active clue speaker unmute, and auto-mutes when the turn moves away.
- Stabilized the serial `verify:release -- --skip-deploy` path by hardening board/reversi browser smoke auth recovery and board-room navigation waits on the deployed `3100/3101` stack.

## Task Commits

1. **Task 1: Make party voice guidance game-aware for Undercover entry and discovery surfaces** - `95f6933` (`feat(11-04): align undercover voice guidance`)
2. **Task 2: Add turn-scoped voice affordances to the dedicated Undercover room** - `01ff7cb` (`feat(11-04): add undercover turn-based voice controls`)
3. **Release verification hardening found during closeout** - `8846551` (`test(release): harden board and reversi smoke setup`)

## Files Created/Modified

- `lib/shared/availability.js` - added an Undercover-safe voice action that keeps degraded guidance truthful without forcing text-only fallback.
- `backend/handlers/hub.js` and `backend/handlers/room-entry/resolve.js` - threaded the game-aware degraded voice payload into discovery and entry responses.
- `backend/handlers/party/rooms/[roomNo]/index.js` and `lib/party/manager.js` - passed `gameKey` through the room degraded-state envelope so the dedicated route receives the same backend-authored semantics.
- `pages/undercover/[roomNo].js` - added turn-scoped voice state, mic controls, WebRTC signaling hooks, and listener/speaker guidance.
- `styles/UndercoverRoom.module.css` - styled the new voice panel, action states, and player voice badges.
- `tests/undercover.spec.js`, `tests/hub-entry.spec.js`, `test-logic/hub-room-entry.test.js`, and `test-logic/backend-contract.test.js` - locked the new Undercover guidance and dedicated-room affordances in logic and browser coverage.
- `tests/support/auth.js`, `tests/board-games.spec.js`, and `tests/reversi.spec.js` - hardened serial release reruns by adding login/register recovery for timed-out direct session bootstrap and widening slow board-route waits.

## Decisions Made

- Kept the fix centered on Undercover instead of weakening party-family guidance for werewolf and avalon.
- Reused the existing party voice signaling baseline instead of inventing a second voice transport for the dedicated Undercover route.
- Fixed release instability in the smoke helpers and waits rather than lowering assertions or skipping the deployed-stack gate.

## Deviations from Plan

### Auto-fixed Issues

**1. Release closeout exposed serial-smoke auth races**
- **Found during:** Verification after Task 2
- **Issue:** direct backend registration for board/reversi smokes could time out, race with an already-created user, and then fail on duplicate-user constraints during `verify:release -- --skip-deploy`
- **Fix:** added recovery logic in `tests/support/auth.js` so direct session bootstrap can fall back to login/register browser flows instead of replaying non-idempotent registration blindly
- **Files modified:** `tests/support/auth.js`
- **Verification:** `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`, `npm run verify:release -- --skip-deploy`
- **Committed in:** `8846551`

**2. Board-room creation hops were slower under full release load than under isolated UI reruns**
- **Found during:** Verification after Task 2
- **Issue:** the second board-room creation in `tests/board-games.spec.js` could miss Playwright's default 5s URL assertion window during full release serial execution
- **Fix:** widened board-room navigation waits and marked the Reversi smoke as slow so the browser suite matches actual deployed-stack latency
- **Files modified:** `tests/board-games.spec.js`, `tests/reversi.spec.js`
- **Verification:** `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`, `npm run verify:release -- --skip-deploy`
- **Committed in:** `8846551`

---

**Total deviations:** 2 auto-fixed
**Impact on plan:** all deviations were verification hardening only; product scope stayed anchored to the Undercover voice gap.

## Issues Encountered

- `verify:release -- --skip-deploy` initially failed outside the new Undercover coverage because the serial browser gate surfaced pre-existing board/reversi smoke fragility.
- Direct backend registration is not safely retryable for smoke setup because the server may commit the user before the client times out; recovery had to become login-aware.
- Local node tests still emit repeated `ECONNREFUSED 127.0.0.1:5432` room-directory snapshot warnings, but the suites continue exiting 0 and the warning remains non-blocking.

## User Setup Required

None.

## Verification

- `npm run deploy:3100`
- `node --test test-logic/hub-room-entry.test.js`
- `node --test test-logic/backend-contract.test.js`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/undercover.spec.js --workers=1`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`
- `npm run verify:release -- --skip-deploy`

## Next Phase Readiness

- Hub, entry, and the dedicated Undercover route now describe the same voice behavior, so future game/admin availability work no longer needs to special-case a misleading text-only fallback.
- The canonical deployed-stack release gate is green again after hardening the slowest browser smokes, so later phases can keep using `verify:release -- --skip-deploy` as the real ship gate.
