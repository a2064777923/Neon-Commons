---
phase: 04
slug: card-party-gameplay-expansion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + Playwright + Next.js check script |
| **Config file** | `package.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && node --test test-logic/backend-contract.test.js test-logic/client-network-contract.test.js test-logic/ddz-logic.test.js test-logic/party-config.test.js test-logic/undercover-logic.test.js && npx playwright test tests/room-ui.spec.js tests/arcade-party.spec.js tests/undercover.spec.js tests/admin-console.spec.js --workers=1` |
| **Estimated runtime** | ~120-180 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && node --test test-logic/backend-contract.test.js test-logic/client-network-contract.test.js test-logic/ddz-logic.test.js test-logic/party-config.test.js test-logic/undercover-logic.test.js`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 180 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | CARD-01 | T-04-01 / T-04-02 | Only supported Dou Dizhu template modes and rule fields can reach live rooms, and runtime enforcement matches the stored template contract | unit + contract | `node --test test-logic/ddz-logic.test.js test-logic/backend-contract.test.js` | ✅ | ⬜ pending |
| 04-01-02 | 01 | 1 | CARD-01 | T-04-03 | Lobby, room, and admin surfaces describe the same supported rule set that the backend enforces | UI smoke | `npm run check && npx playwright test tests/room-ui.spec.js tests/admin-console.spec.js --workers=1` | ✅ | ⬜ pending |
| 04-02-01 | 02 | 1 | PARTY-01 | T-04-04 / T-04-05 | Werewolf/Avalon role presets and phase options normalize safely by player count without leaking regressions into Undercover | unit | `node --test test-logic/party-config.test.js test-logic/undercover-logic.test.js` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 1 | PARTY-01 | T-04-06 | Party create-room and live room UI surface the selected role pack / voice mode without breaking existing party-room flow | UI smoke | `npm run check && npx playwright test tests/arcade-party.spec.js tests/undercover.spec.js --workers=1` | ✅ | ⬜ pending |
| 04-03-01 | 03 | 2 | CARD-01 / PARTY-01 | T-04-07 | Backend/client contracts and logic coverage stay aligned with the expanded card and party config surface | full node suite | `npm run check && node --test test-logic/backend-contract.test.js test-logic/client-network-contract.test.js test-logic/ddz-logic.test.js test-logic/party-config.test.js test-logic/undercover-logic.test.js` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 2 | CARD-01 / PARTY-01 | T-04-08 | Phase 4 only ships if DDZ, Werewolf, Avalon, Undercover, and admin template flows all stay green together | full browser + node gate | `npm run check && node --test test-logic/backend-contract.test.js test-logic/client-network-contract.test.js test-logic/ddz-logic.test.js test-logic/party-config.test.js test-logic/undercover-logic.test.js && npx playwright test tests/room-ui.spec.js tests/arcade-party.spec.js tests/undercover.spec.js tests/admin-console.spec.js --workers=1` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/party-config.test.js` — Werewolf/Avalon role-pack normalization, role distribution, and config clamping coverage

Existing infrastructure covers the rest of the phase requirements through extensions to current tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dou Dizhu lobby and room rule chips remain legible after more template fields are exposed | CARD-01 | Visual clarity and cognitive load are not fully measurable by assertions alone | Open `/lobby` and one non-default `/room/{roomNo}` on desktop and mobile-width layouts; confirm the active rules are obvious without reading raw JSON |
| Werewolf/Avalon preset labels make it clear which advanced roles are active before match start | PARTY-01 | Preset comprehension is a product-language judgment, not only a DOM check | Create one Werewolf room and one Avalon room with non-default presets; confirm setup copy clearly distinguishes role pack, voice mode, and timing choices |
| Admin template editing makes unsupported `LAIZI`/invalid settings failure obvious | CARD-01 | Safety messaging quality matters as much as status code correctness | In `/admin`, attempt to preview or submit an unsupported card template mode and confirm the operator can tell why it stays unavailable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 180s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
