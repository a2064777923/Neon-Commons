---
phase: 15
slug: wave-2-delivery-set-a
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + Playwright + existing release verification scripts |
| **Config file** | `package.json` |
| **Quick run command** | `node --test test-logic/board-config.test.js test-logic/flyingchess-logic.test.js && npm run check` |
| **Full suite command** | `node --test test-logic/backend-contract.test.js test-logic/hub-room-entry.test.js test-logic/admin-control-plane.test.js test-logic/board-config.test.js test-logic/flyingchess-logic.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/board-games.spec.js tests/hub-entry.spec.js --workers=1 && FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run verify:release -- --skip-deploy` |
| **Estimated runtime** | ~300-480 seconds |

---

## Sampling Rate

- **After every task commit:** Run the narrowest affected `node --test` slice plus `npm run check`
- **After every plan wave:** Run the board-focused Playwright slice on `3100`, then escalate to release verification before closing the wave
- **Before `$gsd-verify-work`:** `npm run verify:release -- --skip-deploy` must be green against the canonical `3100/3101` runtime
- **Max feedback latency:** 420 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | WAVE-02 | T-15-01 / T-15-02 | Catalog promotion and board config helpers expose `flyingchess` through the existing board-family contract without opening a parallel API family | contract | `node --test test-logic/board-config.test.js test-logic/hub-room-entry.test.js` | ✅ | ⬜ pending |
| 15-01-02 | 01 | 1 | WAVE-02 | T-15-03 / T-15-04 | Pure Flying Chess rules keep takeoff, jump/flight, collision, extra-roll, and exact-finish behavior deterministic and backend-owned | logic | `node --test test-logic/flyingchess-logic.test.js` | ❌ W0 | ⬜ pending |
| 15-01-03 | 01 | 1 | WAVE-02 | T-15-04 / T-15-05 | Board-room serialization exposes roll/move state, recovery-safe viewer data, and room-entry-compatible payloads without regressing existing board titles | contract | `node --test test-logic/backend-contract.test.js test-logic/board-config.test.js test-logic/flyingchess-logic.test.js` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | WAVE-02 | T-15-06 / T-15-07 | `/games/flyingchess` and `/board/[roomNo]` present truthful create/join/play flow with stable selectors and mobile-safe affordances | browser | `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/board-games.spec.js --workers=1` | ✅ | ⬜ pending |
| 15-02-02 | 02 | 2 | WAVE-02 | T-15-07 / T-15-08 | Hub, launch-contract, and admin capability surfaces stay aligned once `flyingchess` becomes live instead of `coming-soon` | contract + browser | `node --test test-logic/hub-room-entry.test.js test-logic/admin-control-plane.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/hub-entry.spec.js tests/board-games.spec.js --workers=1` | ✅ | ⬜ pending |
| 15-02-03 | 02 | 2 | WAVE-02 | T-15-08 / T-15-09 | Canonical release verification on `3100/3101` proves the new board title lands without regressing shipped families or rollout gates | release | `npm run test:logic:critical && FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical && npm run verify:release -- --skip-deploy` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/flyingchess-logic.test.js` — pure rules coverage for takeoff, jump/flight, collisions, extra rolls, and exact finish
- [ ] Stable `data-*` hooks in the Flying Chess room UI for roll button, movable pieces, legal targets, and per-seat progress
- [ ] `tests/board-games.spec.js` additions that create, join, ready, play, and recover a `flyingchess` room on `3100`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The Flying Chess board stays understandable on mobile when four players, dice state, and progress indicators are all visible | WAVE-02 | Automated tests can prove selectors and flows, but not whether the board feels legible and tappable on a real phone viewport | On deployed `3100`, open a 4-player `flyingchess` room on a phone-sized viewport, roll through several turns, and confirm the active action, movable pieces, and progress summary remain clear without horizontal trap states |
| Classic rules feel correct to a human player across jump, flight, collision, and exact-finish edge cases | WAVE-02 | Logic tests can prove deterministic cases, but a human pass is still useful for validating that the shipped interaction matches user expectations of classic Flying Chess | On `3100/3101`, play at least one near-finish game and manually verify takeoff, color jump/flight, send-back collisions, extra-roll moments, and exact home entry all match the documented classic rule table |

---

## Validation Sign-Off

- [ ] All tasks have automated verify commands or explicit Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 420s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
