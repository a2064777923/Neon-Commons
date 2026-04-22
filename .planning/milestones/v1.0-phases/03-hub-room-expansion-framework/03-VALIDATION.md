---
phase: 3
slug: hub-room-expansion-framework
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-04-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for hub discovery, universal room entry, and invite/guest lifecycle work.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `node:test` + Playwright |
| **Config file** | `package.json` scripts + Playwright default config |
| **Quick run command** | `node --test test-logic/hub-room-entry.test.js` |
| **Full suite command** | `npm run check && node --test test-logic/admin-control-plane.test.js test-logic/hub-room-entry.test.js && npx playwright test tests/hub-entry.spec.js tests/arcade-party.spec.js tests/board-games.spec.js --workers=1` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test test-logic/hub-room-entry.test.js`
- **After every plan wave:** Run `npm run check && node --test test-logic/admin-control-plane.test.js test-logic/hub-room-entry.test.js`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | HUB-01 | T-01-01 / T-01-02 | Discovery metadata exposes shipped + upcoming titles without duplicating capability truth | unit | `node --test test-logic/hub-room-entry.test.js` | ✅ | ⬜ pending |
| 03-01-02 | 01 | 1 | HUB-01 | T-01-03 | `/api/hub` returns capability-aware family payload and preserves joinable paused rooms | unit + integration | `node --test test-logic/hub-room-entry.test.js && npm run check` | ✅ | ⬜ pending |
| 03-02-01 | 02 | 2 | ROOM-01 | T-02-01 | All newly created rooms receive globally unique cross-family room numbers | unit | `node --test test-logic/hub-room-entry.test.js` | ✅ | ⬜ pending |
| 03-02-02 | 02 | 2 | ROOM-01 | T-02-02 / T-02-03 | Resolver/shareable APIs route room numbers and deep links to the correct family without reopening paused-new-room creation | unit + integration | `node --test test-logic/hub-room-entry.test.js && npm run check` | ✅ | ⬜ pending |
| 03-02-03 | 02 | 2 | ROOM-01 | T-02-04 / T-02-05 | Guest sessions are only minted for eligible private invite flows and can be claimed later | unit + integration | `node --test test-logic/hub-room-entry.test.js && npm run check` | ✅ | ⬜ pending |
| 03-03-01 | 03 | 3 | HUB-01 | T-03-01 | Homepage family hub renders playable, paused, and upcoming cards from backend payload | UI smoke | `npx playwright test tests/hub-entry.spec.js --workers=1` | ✅ | ⬜ pending |
| 03-03-02 | 03 | 3 | ROOM-01 | T-03-02 / T-03-03 | Entry page, login return path, family lobbies, and guest sync prompt honor the room-entry contract | UI smoke | `npx playwright test tests/hub-entry.spec.js tests/arcade-party.spec.js tests/board-games.spec.js --workers=1` | ✅ | ⬜ pending |
| 03-03-03 | 03 | 3 | HUB-01 / ROOM-01 | T-03-04 | Hub and room-entry regressions stay covered together with existing party/board flows | full | `npm run check && node --test test-logic/admin-control-plane.test.js test-logic/hub-room-entry.test.js && npx playwright test tests/hub-entry.spec.js tests/arcade-party.spec.js tests/board-games.spec.js --workers=1` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/hub-room-entry.test.js` — new unit/integration coverage for hub payload, room directory, resolver, and guest eligibility
- [ ] `tests/hub-entry.spec.js` — Playwright smoke for homepage command dock and invite deep link flow

Existing infrastructure covers lint/build and existing room-family smoke flows.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual density of family bands and greyed card semantics | HUB-01 | Copy hierarchy and compactness are design-sensitive beyond pure DOM assertions | Open `/`, verify the first viewport shows the command dock and at least two family bands, and confirm `暫停新房` vs `即將推出` read differently |
| Invite intercept tone and guest-to-login prompt clarity | ROOM-01 | Modal tone and CTA prominence need human review after automation passes | Open a private invite link while logged out, confirm `以遊客進入` and `登入後進入` are clearly differentiated and the prompt is not a full-page detour |

---

## Validation Sign-Off

- [ ] All tasks have automated verify commands
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all new Phase 3 regression risk
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter after implementation proves stable

**Approval:** pending
