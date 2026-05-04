---
phase: 15
slug: wave-2-delivery-set-a
status: clean
depth: standard
files_reviewed: 3
critical: 0
warning: 0
info: 2
total: 2
created: 2026-05-04
---

# Phase 15 - Code Review

Reviewed the three files modified by plan 15-03 to resolve the two code-review blockers (WR-01, WR-02) and close security threat T-15-08.

## Findings

```yaml
- id: F-15-R1
  severity: info
  references:
    - "pages/entry/[gameKey]/[roomNo].js:257-270"
  impact: >
    The `enterAsGuest` function body uses 2-space indentation for lines 257-270
    (from `setBusy(true)` through `setBusy(false)`) while the rest of the function
    and the enclosing component use 4-space indentation. This is a pre-existing
    style inconsistency not introduced by the WR-01 change. No runtime impact.
  recommendation: >
    Re-indent lines 257-270 to use 4-space indentation consistent with the
    surrounding code. Low priority -- can be batched with a future style pass.

- id: F-15-R2
  severity: info
  references:
    - "tests/board-games.spec.js:98-110"
  impact: >
    The retry-button fallback uses `.catch()` chained on `expect().toHaveURL()`
    instead of a standard `try/catch` block. This works correctly in Playwright
    (expect returns a promise that rejects on assertion failure) but is
    unconventional and may confuse future maintainers familiar with Playwright's
    `expect.poll` or `try/catch` patterns.
  recommendation: >
    Consider wrapping the assertion in `try/catch` for consistency with the rest
    of the test suite. No functional change required.
```

## WR-01 Verification (entry page retry fix)

The fix in `decb313` is correct and complete:

- **State management:** `userJoinRetryReady` starts `false`, resets on new room load (line 73), and is set `true` only when `session?.kind === "user"` and the join POST fails (lines 203-205, 239-240). The `enterWithLogin` handler (line 288-290) re-enters the `autoEnter` flow with `auto: false` when the session is a user, which clears the retry state and starts fresh.
- **Button semantics:** The login/retry button at line 397 sets `data-entry-action="retry"` when `session?.kind === "user" && userJoinRetryReady`, matching the test selector `[data-entry-action="retry"]`.
- **Label logic:** `getLoginEntryLabel` (line 533) returns "重試加入" when `userJoinRetryReady` is true and the user is not busy, and "重試進房中..." when busy during retry. Correct.
- **Auto-enter with backoff:** The new `autoEnter` function (line 158) uses `USER_AUTO_JOIN_RETRY_DELAYS_MS = [0, 450, 1100, 2200]` for exponential backoff on auto-attempts. `shouldRetryUserAutoEnter` (line 592) correctly stops retrying on 401/403 and fatal error patterns (room full, account unavailable, not in room). Timer cleanup is handled via `useEffect` return and `clearScheduledAutoEnter`.
- **No auth bypass:** The retry path calls the same `apiFetch(joinRoute, ...)` with credentials. No redirect to `/login` for authenticated users.
- **No XSS:** All strings rendered via React JSX escaping. `data-entry-action` values are static strings, not user input.

## WR-02 Verification (Flying Chess legend copy)

The fix in `e6deeab` corrects three copy locations to teach the correct rule:

- **Legend hint** (line 1381): "擲出 6 点可起飞；只要擲出 6 点，本回合都能再擲一次。" -- rolling 6 always grants extra roll.
- **Turn hint** (line 1541): "先擲骰；擲出 6 点可起飞，擲出 6 点即可再擲一次。" -- consistent.
- **Viewer notes** (line 1586): "擲出 6 点即可起飞，擲出 6 点必定可再擲一次。" -- consistent, emphasizes "必定" (certainly).

All three locations now match the backend behavior and the regression test at `test-logic/flyingchess-logic.test.js:97`.

## T-15-08 Verification (smoke test hardening)

The fix in `52a0c32` is correct:

- **Timeout increase:** Entry redirect timeout raised from implicit 30s to explicit 45s (line 99), giving the auto-enter with backoff enough time to complete.
- **Retry fallback:** If the 45s timeout elapses without redirect, the `.catch()` handler checks for `[data-entry-action="retry"]` (line 101), clicks it if present, and waits up to 30s more (line 104). If no retry button is found, a descriptive error is thrown (line 108).
- **Attempt budget:** `playFlyingChessUntilMove` increased from 18 to 24 max attempts (line 139) to account for no-legal-move-on-6 extra rolls consuming attempts without producing a movable turn.
- **Cleanup:** The `finally` block (lines 123-136) closes the guest browser context and admin-closes all three rooms, with `.catch(() => {})` to swallow cleanup errors.

## Files Reviewed

- `pages/entry/[gameKey]/[roomNo].js` (commit `decb313` -- WR-01 fix)
- `pages/board/[roomNo].js` (commit `e6deeab` -- WR-02 fix)
- `tests/board-games.spec.js` (commit `52a0c32` -- T-15-08 hardening)

## REVIEW COMPLETE
