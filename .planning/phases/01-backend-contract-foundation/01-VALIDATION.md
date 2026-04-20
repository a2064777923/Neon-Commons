---
phase: 1
slug: backend-contract-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-20
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test + Playwright |
| **Config file** | none |
| **Quick run command** | `npm run check` |
| **Full suite command** | `npm run test:logic` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run check`
- **After every plan wave:** Run `npm run test:logic`
- **Before `$gsd-verify-work`:** Run `npx playwright test tests/room-ui.spec.js --workers=1`
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | PLAT-01 | T-01-01 / T-01-02 | Shared route/socket inventory cannot drift from handler coverage silently | unit | `node --test test-logic/backend-contract.test.js` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | PLAT-01 | T-01-01 / T-01-03 | Handler metadata and method/error guards stay explicit across route families | unit | `node --test test-logic/backend-contract.test.js` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | PLAT-01 | T-01-01 / T-01-02 / T-01-03 | Router and handler surface fail fast on missing metadata or route drift | unit | `node --test test-logic/backend-contract.test.js` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 2 | PLAT-01 | T-02-01 / T-02-02 | Frontend runtime resolves backend and socket origins deterministically | unit | `node --test test-logic/client-network-contract.test.js` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 2 | PLAT-01 | T-02-02 / T-02-03 | Pages and browser tests stop bypassing the shared route/socket helpers | unit | `node --test test-logic/client-network-contract.test.js` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 2 | PLAT-01 | T-02-01 / T-02-03 | Split-port room smoke flow still works after frontend contract normalization | e2e | `npx playwright test tests/room-ui.spec.js --workers=1` | ✅ | ⬜ pending |
| 1-03-01 | 03 | 3 | PLAT-01 | T-03-01 / T-03-02 | Public docs describe the real backend contract and proxy behavior | docs | `rg -n "backend/server.js|backend/handlers|lib/client/api.js" README.md docs/architecture/system-architecture.md docs/api/api-reference.md docs/ops/deployment.md` | ✅ | ⬜ pending |
| 1-03-02 | 03 | 3 | PLAT-01 | T-03-01 / T-03-02 | Planning docs no longer describe `pages/api` or root `server.js` as the live API layer | docs | `rg -n "pages/api|server.js" .planning/codebase/ARCHITECTURE.md .planning/codebase/STRUCTURE.md .planning/codebase/STACK.md` | ✅ | ⬜ pending |
| 1-03-03 | 03 | 3 | PLAT-01 | T-03-01 / T-03-02 | Planning and operator docs stay consistent with the executed runtime | docs | `npm run check` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test-logic/backend-contract.test.js` — route inventory, handler metadata, method/auth surface checks
- [ ] `test-logic/client-network-contract.test.js` — frontend runtime resolution and route-builder checks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reverse-proxy deployment still routes `/api` and `/socket.io` correctly | PLAT-01 | Requires a deployed or Nginx-backed runtime, not just local unit tests | Start the stack behind the documented proxy config, visit the site from the public origin, log in, create a room, and confirm room updates and socket events still work without cross-origin cookie failures. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
