---
phase: 12
slug: voice-reliability-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-23
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + Playwright + existing `verify-release` runtime scripts |
| **Config file** | `package.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run test:logic:liveops && FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical && npm run verify:release -- --skip-deploy` |
| **Estimated runtime** | ~360-540 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run the narrowest phase gate for that wave, then escalate to deployed-stack browser and release checks before closing any socket or room-contract change
- **Before `$gsd-verify-work`:** `npm run verify:release -- --skip-deploy` must be green against the canonical `3100/3101` runtime
- **Max feedback latency:** 480 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | VOICE-01 | T-12-01 / T-12-02 | Typed voice transport config and shared relay enums keep fallback policy backend-owned and bounded instead of page-local | contract | `node --test test-logic/client-network-contract.test.js test-logic/backend-contract.test.js` | ✅ | ⬜ pending |
| 12-01-02 | 01 | 1 | VOICE-01, VOICE-02 | T-12-01 / T-12-03 | Party room payload exposes additive relay/recovery contract fields without breaking the existing room-detail route shape | contract | `node --test test-logic/backend-contract.test.js test-logic/session-recovery.test.js && npm run check` | ✅ | ⬜ pending |
| 12-02-01 | 02 | 2 | VOICE-01 | T-12-04 / T-12-06 | Startup timeout or persistent disconnect promotes the room visit into sticky relay mode instead of silently failing peer voice | logic + browser | `node --test test-logic/backend-contract.test.js test-logic/session-recovery.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/arcade-party.spec.js --workers=1` | ✅ | ⬜ pending |
| 12-02-02 | 02 | 2 | VOICE-02 | T-12-05 / T-12-06 | Reconnect within the approved window auto-resumes joined-but-muted/listening voice and never auto-unmutes the player | logic + browser | `node --test test-logic/session-recovery.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/undercover.spec.js --workers=1` | ✅ | ⬜ pending |
| 12-03-01 | 03 | 3 | VOICE-01, VOICE-02 | T-12-07 / T-12-09 | Room diagnostics expose relay/recovery mode, reason, and timestamps without leaking raw ICE/TURN internals | contract + browser | `node --test test-logic/backend-contract.test.js test-logic/party-voice-recovery.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/arcade-party.spec.js tests/undercover.spec.js --workers=1` | ❌ W0 | ⬜ pending |
| 12-03-02 | 03 | 3 | VOICE-01, VOICE-02 | T-12-08 / T-12-09 | Live-ops helpers and the canonical release rerun path catch relay fallback and muted-recovery regressions on `3100/3101` | release | `npm run test:logic:liveops && FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical && npm run verify:release -- --skip-deploy` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/party-voice-recovery.test.js` — manager-level sticky relay, muted recovery, and grace-expiry regression coverage
- [x] Existing `tests/arcade-party.spec.js` and `tests/undercover.spec.js` already provide the browser homes for party-family voice regression cases
- [x] Existing `deploy:3100`, `test:ui:critical`, and `verify:release` commands remain the canonical deployed-stack boundary

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Relay fallback messaging is lightweight and truthful instead of disruptive | VOICE-01 | Automated tests can prove selectors and mode changes, but not whether the copy feels low-friction to a human player | On deployed `3100`, trigger at least one relay fallback in a party room and verify the room shows a small status notice rather than a blocking modal while gameplay remains usable |
| TURN or relay credentials actually establish media on the deployed environment | VOICE-01, VOICE-02 | Local mocks can prove contract shape and switching logic, but not real external relay reachability | On deployed `3100/3101`, join the same party room from two browsers on a hostile network path, confirm direct failure promotes relay mode, and verify both users still hear each other after reconnecting one browser within the configured recovery window |

---

## Validation Sign-Off

- [ ] All tasks have automated verify commands or explicit Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 480s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
