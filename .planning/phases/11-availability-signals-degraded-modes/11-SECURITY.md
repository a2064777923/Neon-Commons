---
phase: 11
slug: availability-signals-degraded-modes
status: verified
threats_open: 0
asvs_level: 1
created: 2026-04-23
---

# Phase 11 - Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| backend-frontend availability contract | Hub, room-entry, party rooms, and the dedicated Undercover route all consume one backend-authored degraded-state envelope. | room availability truth, degraded subsystem state, reason codes, safe actions, game key |
| admin runtime control plane | `/api/admin/runtime` is the only operator-facing surface that can change degraded behavior for live users. | scope, family key, subsystem, state, reason, audit metadata |
| recovery/live payload parity | `200` room detail and recovery-aware `409` snapshot-only flows must carry compatible availability semantics. | additive `degradedState`, preserved top-level `availability`, share/join affordances |
| voice turn ownership | Undercover mic affordances depend on backend room state rather than local client guesses. | viewer seat, active clue speaker, voice degradation state, `voiceEnabled` |
| split-port local runtime | Frontend stays on `3100`, backend and Socket.IO stay on `3101`, while browser routing remains truthful. | API origin, socket origin, auth/session cookies, live room state |
| release verification gate | The canonical deploy and rerun flow must prove readiness and coverage on the shipped stack. | runtime readiness, critical logic/UI checks, release verification result |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-11-01 | Tampering | shared availability contract | mitigate | Centralized enums, normalization, safe actions, and envelope building in `lib/shared/availability.js`; shared handlers call `buildAvailabilityEnvelope`. | closed |
| T-11-02 | Repudiation | admin runtime degraded defaults | mitigate | Existing `/api/admin/runtime` GET/PATCH returns structured degraded controls and records audit context; covered by `test-logic/admin-control-plane.test.js`. | closed |
| T-11-03 | Availability | payload compatibility across recovery and live detail flows | mitigate | `backend/handlers/hub.js`, `backend/handlers/room-entry/resolve.js`, and party room handlers preserve top-level `availability` while adding `degradedState`; recovery paths are asserted in `test-logic/hub-room-entry.test.js`. | closed |
| T-11-04 | Tampering | degraded-mode admin controls | mitigate | `lib/admin/control-plane.js` strictly validates scope, family, subsystem, state, and safe actions before persisting updates. | closed |
| T-11-05 | Availability | scoped entry and voice gating | mitigate | Entry and room UX only gate affected subsystems while healthy rooms remain live; logic/browser coverage proves scoped behavior. | closed |
| T-11-06 | Repudiation | player-facing degraded messaging | mitigate | Shared selectors in `lib/client/room-entry.js` keep hub, entry, party, and Undercover copy aligned with backend-authored reasons and safe actions. | closed |
| T-11-07 | Repudiation | degraded-state regression coverage | mitigate | Deterministic node/browser assertions cover degraded-state precedence, compatibility, and specialized Undercover behavior. | closed |
| T-11-08 | Tampering | live-ops helper commands | mitigate | `package.json` keeps `test:logic:liveops`, `test:ui:liveops`, `test:ui:critical`, and `verify:release` aligned with the real deployed surface. | closed |
| T-11-09 | Availability | release rerun path on `3100/3101` | mitigate | `scripts/verify-release.js` redeploys the canonical stack, waits for `/login` and `/api/hub`, then runs structural, logic, and UI gates. | closed |
| T-11-10 | Spoofing | Undercover voice affordance | mitigate | `pages/undercover/[roomNo].js` derives mic access from serialized room turn state; `lib/party/manager.js` carries backend room/viewer state into the client payload. | closed |
| T-11-11 | Tampering | degraded voice safe actions | mitigate | `resolveAvailabilityStatus()` specializes Undercover voice copy and safe actions centrally in `lib/shared/availability.js`, preventing per-page wording drift. | closed |
| T-11-12 | Availability | dedicated Undercover room | mitigate | The dedicated Undercover route reuses the existing party voice baseline and stays covered by deployed-stack Playwright and release rerun verification. | closed |

*Status: open / closed*
*Disposition: mitigate (implementation required) / accept (documented risk) / transfer (third-party)*

---

## Mitigation Evidence

- T-11-01, T-11-03, and T-11-11 close through the shared contract layer in `lib/shared/availability.js:1-549`, with hub/entry/party handlers all attaching the same envelope in `backend/handlers/hub.js:229-239`, `backend/handlers/room-entry/resolve.js:37-80`, and `backend/handlers/party/rooms/[roomNo]/index.js:24-46`.
- T-11-02 and T-11-04 close through strict control-plane normalization and audited runtime writes in `lib/admin/control-plane.js:193-232` and `lib/admin/control-plane.js:510-536`, exposed through `/api/admin/runtime` in `backend/handlers/admin/runtime/index.js:25-109`, and locked by `test-logic/admin-control-plane.test.js:41-104` plus `test-logic/admin-control-plane.test.js:251-308`.
- T-11-05 and T-11-06 close through shared frontend selectors in `lib/client/room-entry.js:83-109`, scoped entry gating in `pages/entry/[gameKey]/[roomNo].js:24-33` and `pages/entry/[gameKey]/[roomNo].js:259-312`, and party-room degraded voice rendering in `pages/party/[roomNo].js:101-105`.
- T-11-07 and T-11-08 close through explicit regression coverage and helper command alignment in `package.json:13-22`, `test-logic/backend-contract.test.js:144-176`, `test-logic/hub-room-entry.test.js:1149-1294`, `tests/hub-entry.spec.js:643-812`, `tests/arcade-party.spec.js:121-210`, and `tests/admin-console.spec.js:407-493`.
- T-11-09 closes through the canonical release script in `scripts/verify-release.js:23-65` and `scripts/verify-release.js:68-113`, plus Phase 11 summary evidence that `npm run verify:release -- --skip-deploy` passed after the Undercover and browser-smoke hardening work.
- T-11-10 and T-11-12 close through backend-driven turn ownership and dedicated-room mic gating in `lib/party/manager.js:1391-1455`, `pages/undercover/[roomNo].js:64-84`, and `pages/undercover/[roomNo].js:1100-1195`, with dedicated Undercover coverage in `tests/undercover.spec.js:36-120`.
- Phase summaries contain no unresolved `Threat Flags` section entries; the only late-breaking issues recorded in `11-04-SUMMARY.md` were auto-fixed before UAT closure, and `11-UAT.md` is already `status: complete` with `passed: 3` and `issues: 0`.

---

## Accepted Risks Log

No accepted risks.

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-04-23 | 12 | 12 | 0 | Codex (`$gsd-secure-phase 11`) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-04-23
