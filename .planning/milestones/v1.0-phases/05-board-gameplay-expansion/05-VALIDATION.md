---
phase: 05
slug: board-gameplay-expansion
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-22
---

# Phase 05 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + Playwright + Next.js check script |
| **Config file** | `package.json` |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run check && node --test test-logic/board-config.test.js test-logic/chinesecheckers-logic.test.js test-logic/client-network-contract.test.js && npx playwright test tests/board-games.spec.js --workers=1` |
| **Estimated runtime** | ~90-150 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run check && node --test test-logic/board-config.test.js test-logic/chinesecheckers-logic.test.js test-logic/client-network-contract.test.js`
- **Before `$gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 150 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | BOARD-01 | T-05-01 / T-05-02 | Only normalized board options can reach live rooms, and Gomoku opening-rule enforcement happens server-side from canonical room config | unit + contract | `node --test test-logic/board-config.test.js` | ❌ W0 | ⬜ pending |
| 05-01-02 | 01 | 1 | BOARD-01 | T-05-03 | Board lobby and board room UI display the same active settings/progress derived from canonical config and serialized room state | UI smoke | `npm run check && npx playwright test tests/board-games.spec.js --workers=1` | ✅ | ⬜ pending |
| 05-02-01 | 02 | 2 | BOARD-01 | T-05-04 | Node regressions cover Gomoku opening rule, Chinese progress serialization, and board route contract stability | full node suite | `npm run check && node --test test-logic/board-config.test.js test-logic/chinesecheckers-logic.test.js test-logic/client-network-contract.test.js` | ❌ W0 | ⬜ pending |
| 05-02-02 | 02 | 2 | BOARD-01 | T-05-05 | Browser smoke proves the expanded board flow still creates rooms, starts matches, and syncs moves with the new option surfaces visible | full browser + node gate | `npm run check && node --test test-logic/board-config.test.js test-logic/chinesecheckers-logic.test.js test-logic/client-network-contract.test.js && npx playwright test tests/board-games.spec.js --workers=1` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/board-config.test.js` — board config normalization, Gomoku opening-rule enforcement, and Chinese progress serialization coverage

Existing infrastructure covers the rest of the phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Gomoku `天元开局` copy and HUD chips are understandable on desktop and mobile widths | BOARD-01 | Clarity of rule copy and chip density is a product judgment, not only a DOM assertion | Create a Gomoku room with `天元开局`, open `/games/gomoku` and the live `/board/{roomNo}` page at desktop and mobile widths, and confirm the active rule is obvious before the first move |
| Chinese Checkers progress cards remain readable over the star-board scene | BOARD-01 | Readability and visual hierarchy over the SVG board need human judgment | Create a Chinese Checkers room, start a match, and confirm per-seat target-camp progress is readable without obscuring legal targets or seat identity |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 150s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
