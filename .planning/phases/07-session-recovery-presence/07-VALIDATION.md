---
phase: 7
slug: session-recovery-presence
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-22
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for room recovery, reconnect state, and host-visible presence behavior.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + Playwright |
| **Config file** | `package.json` scripts + Playwright default config |
| **Quick run command** | `node --test test-logic/hub-room-entry.test.js test-logic/client-network-contract.test.js` |
| **Full suite command** | `npm run check && node --test test-logic/hub-room-entry.test.js test-logic/client-network-contract.test.js test-logic/session-recovery.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/room-ui.spec.js tests/arcade-party.spec.js tests/board-games.spec.js tests/undercover.spec.js tests/reversi.spec.js --workers=1` |
| **Estimated runtime** | ~180 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test-logic/hub-room-entry.test.js test-logic/client-network-contract.test.js`
- **After every plan wave:** Run `npm run check && node --test test-logic/hub-room-entry.test.js test-logic/client-network-contract.test.js test-logic/session-recovery.test.js`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | ROOM-01 / ROOM-02 | T-07-01 / T-07-02 | Session and room-detail payloads expose one additive recovery contract for real users and scoped guests | unit | `node --test test-logic/hub-room-entry.test.js test-logic/client-network-contract.test.js` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | ROOM-01 / ROOM-02 | T-07-03 | Recovery metadata stays aligned across `/api/me` and the three room detail handlers | unit + integration | `node --test test-logic/hub-room-entry.test.js test-logic/client-network-contract.test.js && npm run check` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 2 | ROOM-01 | T-07-04 / T-07-05 | Disconnect/reconnect transitions preserve the existing seat and move through `reconnecting` before `disconnected` | unit | `node --test test-logic/session-recovery.test.js` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 2 | ROOM-02 | T-07-06 | Scoped guests can recover only the same room/game session and are still rejected outside scope | unit + integration | `node --test test-logic/session-recovery.test.js test-logic/hub-room-entry.test.js` | ❌ W0 | ⬜ pending |
| 07-02-03 | 02 | 2 | ROOM-01 / ROOM-03 | T-07-07 | Dou Dizhu trustee behavior coexists with reconnect grace instead of erasing recovery state | unit | `node --test test-logic/session-recovery.test.js test-logic/ddz-logic.test.js` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 3 | ROOM-01 / ROOM-02 | T-07-08 | Room pages survive refresh/reconnect and recover the seated viewer without manual rejoin | UI smoke | `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/room-ui.spec.js tests/arcade-party.spec.js tests/board-games.spec.js tests/undercover.spec.js tests/reversi.spec.js --workers=1` | ✅ | ⬜ pending |
| 07-03-02 | 03 | 3 | ROOM-03 | T-07-09 | Hosts see `connected` / `reconnecting` / `disconnected` cues from the authoritative room payload | UI smoke | `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/arcade-party.spec.js tests/board-games.spec.js tests/undercover.spec.js --workers=1` | ✅ | ⬜ pending |
| 07-03-03 | 03 | 3 | ROOM-01 / ROOM-02 / ROOM-03 | T-07-10 | Recovery and presence regressions stay covered alongside the existing shipped room smoke surface | full | `npm run check && node --test test-logic/hub-room-entry.test.js test-logic/client-network-contract.test.js test-logic/session-recovery.test.js && FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/room-ui.spec.js tests/arcade-party.spec.js tests/board-games.spec.js tests/undercover.spec.js tests/reversi.spec.js --workers=1` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/session-recovery.test.js` — focused manager/socket recovery-state coverage

Existing infrastructure otherwise covers this phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Presence badges feel obvious without overpowering the existing room layout | ROOM-03 | Visual hierarchy and copy tone are still easier to judge by eye than by DOM assertions | Open a room as host on desktop and mobile widths, confirm each occupant shows a clear connected/reconnecting/disconnected treatment without forcing a layout redesign |
| Recovery messaging during transient socket loss feels reassuring instead of alarming | ROOM-01 / ROOM-02 | UX tone and timing matter more than pure field presence | Simulate a reconnect on a live room page, confirm the viewer sees a bounded "recovering/reconnected" message rather than being dumped to login or shown a hard failure immediately |

---

## Validation Sign-Off

- [ ] All tasks have automated verify commands
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all missing references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter after implementation proves stable

**Approval:** pending
