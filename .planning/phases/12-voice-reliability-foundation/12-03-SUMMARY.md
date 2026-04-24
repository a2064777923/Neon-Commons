---
phase: 12-voice-reliability-foundation
plan: 03
subsystem: release-diagnostics
tags: [webrtc, diagnostics, release-gate, playwright, recovery]
requires:
  - phase: 12-voice-reliability-foundation
    provides: sticky relay fallback and shared party-family voice runtime
provides:
  - lightweight room voice diagnostics for relay and recovery state
  - manager-level relay/recovery regression tests in liveops and critical gates
  - canonical release verification that covers party and undercover voice reliability on 3100/3101
affects: [verify-release, liveops suites, party room ui, undercover ui]
tech-stack:
  added:
    - test-logic/party-voice-recovery.test.js
  patterns:
    - safe additive diagnostics surface alongside full transport config
    - canonical ship gate includes voice fallback and muted recovery coverage
    - deployed-stack smoke tests use realistic per-suite timeout ceilings
key-files:
  created:
    - .planning/phases/12-voice-reliability-foundation/12-03-SUMMARY.md
    - test-logic/party-voice-recovery.test.js
  modified:
    - lib/party/manager.js
    - pages/party/[roomNo].js
    - pages/undercover/[roomNo].js
    - package.json
    - test-logic/backend-contract.test.js
    - test-logic/room-expiry.test.js
    - tests/arcade-party.spec.js
    - tests/board-games.spec.js
    - tests/reversi.spec.js
    - tests/undercover.spec.js
key-decisions:
  - Serialized a dedicated `room.voiceDiagnostics` object instead of overloading player-facing UI with raw `voiceTransport` internals.
  - Recorded `lastRecoveredAt` only when muted auto-resume actually completes, keeping diagnostics truthful and compact.
  - Enforced operator voice blocks inside `partyRoomManager.voiceJoin` so relay availability never bypasses an admin stop.
  - Added the new manager regression suite to both `test:logic:liveops` and `test:logic:critical`, because `verify:release` ships through the critical path.
patterns-established:
  - Player-safe diagnostics should expose mode, state, timestamps, and policy, but never ICE server or SDP detail.
  - Long deployed-stack board/party smoke tests need explicit per-test timeout ceilings instead of relying on generic `test.slow()` defaults.
  - System-config stubs in isolated logic tests must provide every config getter the manager now depends on.
requirements-completed: [VOICE-01, VOICE-02]
duration: unknown
completed: 2026-04-24
---

# Phase 12 Plan 03 Summary

**Lightweight relay/recovery diagnostics and release-path regression coverage for Phase 12 voice reliability**

## Accomplishments

- Added additive `room.voiceDiagnostics` serialization with public relay/recovery fields only: mode, sticky relay, runtime state, last reason, transition time, recovery time, muted-resume policy, and reconnect grace.
- Surfaced diagnostics into party and Undercover voice UI through stable selectors `data-voice-mode`, `data-voice-runtime-state`, and `data-voice-recovery`.
- Added `test-logic/party-voice-recovery.test.js` to lock startup-timeout relay promotion, persistent-disconnect relay promotion, sticky relay, muted recovery, grace expiry, and operator-blocked join rejection.
- Wired the new regression suite into package scripts so `test:logic:liveops`, `test:logic:critical`, `test:ui:liveops`, and `verify:release` all cover the new voice reliability behavior.
- Stabilized long-running board and Reversi smoke tests with explicit time ceilings and fixed the `room-expiry` system-config stub so the broader release gate remains trustworthy.

## Verification

- `node --test test-logic/backend-contract.test.js test-logic/session-recovery.test.js test-logic/party-voice-recovery.test.js`
- `npm run check`
- `npm run deploy:3100`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/arcade-party.spec.js tests/undercover.spec.js --workers=1`
- `npm run test:logic:liveops`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`
- `npm run verify:release -- --skip-deploy`

## Deviations from Plan

- `backend/handlers/party/rooms/[roomNo]/index.js` did not need a direct edit because the new diagnostics are emitted from `partyRoomManager.serializeRoom(...)`, which the handler already forwards.
- The verification sweep uncovered unrelated but real critical-suite fragility in `tests/board-games.spec.js`, `tests/reversi.spec.js`, and `test-logic/room-expiry.test.js`; those were repaired in the same wave so the canonical release gate could pass again.

## Issues Encountered

- `test:logic:liveops` initially failed because `room-expiry.test.js` stubs for `lib/system-config` no longer covered `getPartyVoiceTransportConfig`.
- `test:ui:critical` initially failed on board/reversi smoke tests because their deployed-stack flows now legitimately exceed the generic 90s slow-test ceiling.
- PostgreSQL snapshot persistence warnings remain expected in logic tests that intentionally run without a live local Postgres dependency.

## Next Phase Readiness

- Phase 12 now has a public diagnostic surface, deterministic manager coverage, browser selectors, and a green canonical release path on `3100/3101`.
- Follow-on work can build admin/live-ops visibility on top of `room.voiceDiagnostics` without reopening the fallback and recovery contract.

---
*Phase: 12-voice-reliability-foundation*
*Completed: 2026-04-24T09:31:00+08:00*
