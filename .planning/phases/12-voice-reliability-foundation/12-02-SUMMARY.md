---
phase: 12-voice-reliability-foundation
plan: 02
subsystem: party-voice
tags: [webrtc, socket.io, relay, recovery, playwright]
requires:
  - phase: 12-voice-reliability-foundation
    provides: backend-owned voice transport contract and additive room payloads
provides:
  - sticky relay promotion on client-reported voice degradation
  - muted reconnect recovery for party-family rooms
  - shared party and undercover voice transport runtime
  - deployed-stack smoke coverage for fallback and recovery flows
affects: [12-03, party room voice runtime, undercover voice, deployed-stack smoke tests]
tech-stack:
  added:
    - lib/client/party-voice-runtime.js
  patterns:
    - shared party-family voice runtime
    - backend-authoritative relay promotion from client health reports
    - session-cookie injection for deployed-stack smoke auth recovery
key-files:
  created:
    - .planning/phases/12-voice-reliability-foundation/12-02-SUMMARY.md
    - lib/client/party-voice-runtime.js
  modified:
    - lib/socket-server.js
    - lib/party/manager.js
    - pages/party/[roomNo].js
    - pages/undercover/[roomNo].js
    - test-logic/backend-contract.test.js
    - test-logic/session-recovery.test.js
    - tests/arcade-party.spec.js
    - tests/undercover.spec.js
    - tests/support/auth.js
key-decisions:
  - Extracted one shared client voice runtime instead of maintaining duplicate WebRTC fallback logic in party and Undercover pages.
  - Kept relay switching backend-owned by routing `voice:report` through Socket.IO into the party room manager.
  - Recovery always returns as joined-but-muted/listening; explicit unmute and Undercover turn gating still decide when speech is allowed.
  - Stabilized deployed-stack smoke auth by preferring backend session register/login recovery before falling back to UI form flows.
patterns-established:
  - Party-family rooms should share one transport lifecycle module and vary only page-level permission rules.
  - Relay fallback is sticky for the room visit once a startup timeout or persistent disconnect is reported.
  - Smoke tests on `3100/3101` should prefer backend session bootstrap over slow UI registration when the goal is room-flow verification.
requirements-completed: [VOICE-01, VOICE-02]
duration: unknown
completed: 2026-04-24
---

# Phase 12 Plan 02 Summary

**Sticky relay fallback, muted reconnect recovery, and one shared party-family voice runtime for Phase 12 voice reliability**

## Accomplishments

- Wired `voice:report` through `lib/socket-server.js` into `lib/party/manager.js`, where startup timeout and persistent disconnect now promote rooms into sticky `relay-required`.
- Preserved reconnect intent in the party room manager so reconnecting seats regain voice as muted/listening only within the configured grace window.
- Extracted `lib/client/party-voice-runtime.js` and moved party plus Undercover pages onto the same voice lifecycle for local stream caching, fallback rebuilds, and muted auto-resume.
- Kept Undercover turn gating intact while still allowing degraded active speakers to reopen the mic path explicitly.
- Hardened the deployed-stack Playwright auth helper so smoke tests recover sessions through backend cookies before retrying slower UI registration.

## Verification

- `node --test test-logic/backend-contract.test.js test-logic/session-recovery.test.js`
- `npm run check`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/arcade-party.spec.js tests/undercover.spec.js --workers=1`
- `npm run deploy:3100`
- `curl -I http://127.0.0.1:3100/login`
- `curl http://127.0.0.1:3101/api/hub`

## Deviations from Plan

- Added `tests/support/auth.js` outside the original file list to stabilize deployed-stack smoke auth. This did not change product behavior; it only kept verification on `3100/3101` from falling back into slow UI registration during transient backend auth timeouts.

## Issues Encountered

- The original Playwright failures were not caused by the Phase 12 voice runtime itself. One smoke test still used UI registration, and another could time out after backend auth retries degraded into browser-form recovery.
- Logic tests continue to emit expected PostgreSQL snapshot persistence warnings when local Postgres is absent; the warnings remain non-blocking.

## Next Phase Readiness

- Wave 3 can now focus on lightweight diagnostics and release-gate coverage instead of unfinished fallback behavior.
- Party and Undercover already share the transport lifecycle, so diagnostics can now read from one runtime and one backend room state.

---
*Phase: 12-voice-reliability-foundation*
*Completed: 2026-04-24T09:09:00+08:00*
