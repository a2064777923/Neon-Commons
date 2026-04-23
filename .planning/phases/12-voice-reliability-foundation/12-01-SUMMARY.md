---
phase: 12-voice-reliability-foundation
plan: 01
subsystem: api
tags: [webrtc, socket.io, contracts, config, voice]
requires:
  - phase: 11-availability-signals-degraded-modes
    provides: truthful degraded voice vocabulary and blocked voice precedence
provides:
  - typed party voice transport config in the shared system-config path
  - stable voice transport enums and the voice report socket event
  - additive party room voiceTransport and viewer.voiceRecovery payload fields
  - runtime voice degradation merged into degradedState without weakening operator blocks
affects: [12-02, 12-03, party-room voice runtime, undercover voice]
tech-stack:
  added: []
  patterns: [backend-owned voice transport contract, additive room payload extension]
key-files:
  created: [.planning/phases/12-voice-reliability-foundation/12-01-SUMMARY.md]
  modified:
    - lib/defaults.js
    - lib/system-config.js
    - lib/shared/network-contract.js
    - lib/shared/availability.js
    - lib/party/manager.js
    - backend/handlers/party/rooms/[roomNo]/index.js
    - test-logic/client-network-contract.test.js
    - test-logic/backend-contract.test.js
    - test-logic/session-recovery.test.js
key-decisions:
  - Kept relay and recovery policy backend-owned instead of leaving STUN and fallback vocabulary page-local.
  - Reused the existing availability envelope for runtime voice degradation so Phase 11 truthful messaging remains authoritative.
  - Added default room and viewer contract state now so Wave 2 can switch transport modes without reshaping payloads again.
patterns-established:
  - Room payload changes for party voice must stay additive and backward-compatible.
  - Runtime voice degradation may elevate availability state, but operator blocked state always wins.
requirements-completed: [VOICE-01, VOICE-02]
duration: unknown
completed: 2026-04-23
---

# Phase 12 Plan 01 Summary

**Backend-owned voice transport config, fallback enums, and additive party room relay/recovery payloads for Phase 12 voice reliability**

## Accomplishments

- Added typed `partyVoiceTransport` defaults and normalization through the existing system-config cache.
- Extended shared network contracts with stable transport modes, report reasons, and `voice:report`.
- Added additive `room.voiceTransport` and `viewer.voiceRecovery` fields to serialized party rooms.
- Merged `runtimeVoiceState` into `degradedState.subsystems.voice` while keeping operator `blocked` precedence.
- Locked the new contract surface with backend, client, and recovery tests.

## Verification

- `node --test test-logic/client-network-contract.test.js test-logic/backend-contract.test.js`
- `node --test test-logic/backend-contract.test.js test-logic/session-recovery.test.js`
- `npm run check`

## Deviations from Plan

None. The work stayed within the Wave 1 file list and acceptance criteria.

## Issues Encountered

- Logic tests that instantiate live room managers still emit expected PostgreSQL snapshot persistence warnings when local Postgres is absent. The warnings are non-blocking and tests still pass because room-directory persistence already soft-fails in test contexts.

## Next Phase Readiness

- Wave 2 can now consume `room.voiceTransport`, `viewer.voiceRecovery`, and `SOCKET_EVENTS.voice.report` without redefining the payload boundary.
- The remaining work is runtime behavior: sticky relay switching, muted auto-resume, and shared client transport extraction.

---
*Phase: 12-voice-reliability-foundation*
*Completed: 2026-04-23T15:55:01+08:00*
