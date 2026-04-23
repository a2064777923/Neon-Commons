# Phase 12: Voice Reliability Foundation - Research

**Researched:** 2026-04-23
**Domain:** Making party-room voice recover more reliably on top of the current browser WebRTC mesh plus Socket.IO signaling baseline
**Confidence:** MEDIUM-HIGH

<user_constraints>
## User Constraints

- Phase 12 must satisfy `VOICE-01` and `VOICE-02` from `.planning/REQUIREMENTS.md`: party-room voice needs a relay-assisted fallback path, and players need voice recovery during transient network changes without manually rejoining the room.
- The locked decisions in `12-CONTEXT.md` are not negotiable for this phase:
  - fallback is automatic, lightweight, and truthful
  - fallback triggers both on startup failure and on persistent later degradation
  - once a room visit falls back to relay, that room visit stays on relay
  - reconnect recovery target is about 30-45 seconds
  - recovery returns joined-but-muted/listening and never auto-opens mic
  - continuity matters more than absolute latency or fidelity
- `AGENTS.md` keeps the brownfield split runtime fixed:
  - frontend stays on `3100`
  - backend stays on `3101`
  - `/api/*` and `/socket.io/*` stay backend-owned
- The shipped party-room Socket.IO and room-number join flow are the compatibility target. Phase 12 must extend them instead of creating a second backend or a new transport stack outside the existing contract.
- Dedicated SFU/media-platform work remains out of scope. This phase needs a reliability foundation, not a media re-platform.
- Undercover's turn-based speaking rules must stay intact even if shared party voice code is refactored.
- The user wants meaningful progress redeployed against the canonical `3100/3101` stack, so plans should preserve `npm run deploy:3100` and `npm run verify:release -- --skip-deploy` as real gates.

</user_constraints>

<current_state_audit>
## Current State Audit

### What already works

1. **Party-family voice already has a working signaling baseline.**
   - `lib/socket-server.js` already owns `voice:join`, `voice:leave`, `voice:state`, and `voice:signal`.
   - `lib/party/manager.js` already tracks `voiceConnected` and `voiceMuted` per seat and emits room updates.
   - `pages/party/[roomNo].js` and `pages/undercover/[roomNo].js` already negotiate `RTCPeerConnection` instances from Socket.IO signaling.

2. **Party-family rooms already have reconnect semantics at the seat level.**
   - `lib/party/manager.js` preserves human seats through a reconnect grace window and exposes `reconnectGraceEndsAt`.
   - `lib/shared/network-contract.js` and `lib/client/room-entry.js` already provide shared recovery-state helpers and reconnect banner copy.
   - `test-logic/session-recovery.test.js` already proves the "reconnecting" to "disconnected" lifecycle for party seats.

3. **Player-facing degraded voice vocabulary already exists.**
   - `lib/shared/availability.js` can already express `healthy`, `degraded`, and `blocked` voice states.
   - Phase 11 hardened truthful Undercover-specific voice messaging instead of generic text-only fallback.
   - Entry, hub, and party-room pages already consume backend-authored degraded voice status instead of inventing separate client vocabularies.

4. **The backend already has a typed config path for system behavior.**
   - `lib/defaults.js`, `lib/system-config.js`, and `backend/handlers/admin/config/index.js` already provide the persistence path for typed runtime defaults.
   - Phase 12 can extend that path for voice transport thresholds and ICE-server configuration without inventing a new config family.

### Gaps that still block Phase 12

1. **ICE configuration is still page-local and STUN-only.**
   - `pages/party/[roomNo].js` and `pages/undercover/[roomNo].js` both hardcode `ICE_SERVERS` to two Google STUN hosts.
   - There is no backend-owned relay/TURN contract, no typed config, and no room payload field describing how voice transport should behave.

2. **There is no sticky relay mode.**
   - Current voice code either succeeds on direct peer negotiation or silently fails per peer.
   - There is no shared notion of "this room visit has switched into stable relay mode and must stay there."

3. **Reconnect restores the room seat, but not voice participation.**
   - When a voice-connected socket disconnects, `lib/party/manager.js` clears `voiceConnected` immediately and broadcasts `voice:user-left`.
   - When the socket reconnects, the client only re-subscribes to the room; it does not auto-rejoin voice, and the backend does not preserve a joined-but-muted voice recovery contract.

4. **The party and Undercover pages duplicate the same fragile WebRTC lifecycle code.**
   - Both pages own their own `getUserMedia`, peer connection creation, ICE candidate handling, and connection-state cleanup.
   - Adding fallback timers, relay rebuilds, and muted auto-resume in two separate implementations is a high-regression path.

5. **Diagnostics are too thin for reliability work.**
   - There is no stable room payload or UI surface that says whether voice is in direct mode, relay-required mode, or recovery mode.
   - Existing tests cover degraded messaging, but not relay switching, sticky fallback, or muted recovery after reconnect.

### Important landmines

- **Do not solve this with a bespoke backend audio relay over Socket.IO.**
  The repo already has browser WebRTC media and backend signaling; the smallest brownfield-safe reliability foundation is to add TURN-compatible relay preference and relay-only rebuilds, not a second media path.

- **Do not let the client alone decide truth.**
  The room/session contract must say whether the room visit is still direct-preferred or already relay-required, otherwise reconnect and multi-user behavior will drift.

- **Do not regress Undercover's turn ownership.**
  Shared transport code is desirable, but Undercover still needs its existing "listen by default, only the active clue speaker may intentionally unmute" behavior.

- **Do not auto-open the microphone on recovery.**
  Phase 12 should support joined-but-muted/listening recovery, including cases where a local send track must remain disabled or even absent until the user explicitly unmutes.

- **Do not leak TURN credentials or raw ICE diagnostics into broad room payloads.**
  Browser-required ICE server fields may need to reach the client, but diagnostics should expose mode/reason/timestamps, not SDP blobs, raw candidates, or admin-only persistence details.

</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Introduce one backend-owned party voice transport contract

Phase 12 should add an additive room payload block that describes the voice transport policy for a room visit. Recommended fields:

- `mode`: `direct-preferred` or `relay-required`
- `stickyRelay`: boolean
- `startupProbeMs`: default `4000`
- `persistentFailureMs`: default `6000`
- `reconnectGraceSeconds`: default `45`
- `resumeMutedOnRecovery`: `true`
- `iceServers`: browser-ready ICE server array (`urls`, optional `username`, optional `credential`)
- `runtimeState`: `healthy` or `degraded`
- `lastReasonCode`
- `lastTransitionAt`

This contract should be serialized from backend room state, not inferred from page-local constants.

### 2. Use TURN-compatible ICE configuration plus relay-only rebuild as the fallback path

The lowest-risk relay-assisted path in this brownfield repo is:

- keep the existing Socket.IO signaling path
- keep browser WebRTC media
- provide TURN-compatible ICE servers from backend-owned config
- start each room visit in `direct-preferred`
- if startup direct negotiation misses a short probe window, or if an established connection stays failed/disconnected long enough, promote the room visit to `relay-required`
- rebuild peer connections with `iceTransportPolicy: "relay"`

This matches the user's continuity-first preference without pretending the product already has an SFU.

### 3. Make relay mode sticky per room visit

Once a room visit falls back, Phase 12 should keep that room visit on relay. Recommended backend shape:

- room-level `voiceTransport.mode`
- room-level `stickyRelay = true` after fallback
- per-seat `voiceRecovery` state carrying `autoResumeEligible`, `resumeMuted`, `rejoinBy`, and `lastMode`

The backend should emit room updates reflecting relay mode so reconnecting clients rejoin the right transport immediately instead of bouncing between direct and relay.

### 4. Move reconnect recovery into the shared room/session contract

The current room seat grace window is the right base, but Phase 12 should widen party-family reconnect grace to the user-approved recovery target and bind voice recovery to it. Recommended behavior:

- party reconnect grace becomes typed config under `partyVoiceTransport.reconnectGraceSeconds` with default `45`
- disconnecting from voice marks a recovery-intent flag instead of forgetting voice participation completely
- reconnect within grace exposes `voiceRecovery.autoResumeEligible = true`
- the client auto-rejoins voice as muted/listening
- the client never restores `voiceMuted = false` automatically

This keeps recovery honest while preserving the existing room lifecycle model.

### 5. Extract the shared transport lifecycle now, not later

The duplicated voice code in `pages/party/[roomNo].js` and `pages/undercover/[roomNo].js` is the biggest reliability risk. Phase 12 should extract one shared client module that owns:

- local stream acquisition/caching
- optional receive-only join support
- peer connection creation and teardown
- startup timeout handling
- persistent disconnect handling
- relay-only rebuild
- muted auto-resume after reconnect

The pages should keep only their game-specific policy:

- standard party rooms: general join/mute controls
- Undercover: turn-scoped unmute permission and listener guidance

### 6. Reuse the Phase 11 degraded vocabulary instead of adding a second reliability language

When relay fallback or recovery is active, the room should still speak through the existing voice degraded-state surface:

- runtime relay mode should map to `degraded` voice status, not a brand-new top-level state
- operator `blocked` voice from Phase 11 must still override runtime relay hints
- room-local diagnostics can add detail such as `mode`, `lastReasonCode`, and `lastRecoveredAt`

This keeps hub/entry/room/admin semantics compatible with earlier availability work.

</recommended_direction>

<phase_shape_recommendation>
## Recommended Phase Shape

Keep the roadmap's **3 plans** exactly as written:

1. **12-01: Introduce relay/fallback voice transport contracts and configuration**
   - typed transport config
   - shared transport enums/events
   - additive room payload contract for relay/recovery

2. **12-02: Implement reconnect and fallback handling in party rooms and signaling paths**
   - backend relay-mode orchestration
   - shared client transport runtime
   - muted auto-resume and sticky relay behavior

3. **12-03: Add diagnostics and regression coverage for voice degradation and recovery**
   - lightweight room diagnostics
   - targeted logic/browser regression cases
   - live-ops and release-path alignment on `3100/3101`

Recommended execution order:

- **12-01 first** because transport config and payload shape need to exist before either page or signaling code can use them.
- **12-02 second** because fallback, reconnect, and shared runtime behavior depend on the new contract.
- **12-03 last** because diagnostics and package-script promotion should lock the final runtime semantics, not an earlier draft.

</phase_shape_recommendation>

## Validation Architecture

### Fast feedback

- `npm run check`
- `node --test test-logic/backend-contract.test.js test-logic/client-network-contract.test.js test-logic/session-recovery.test.js`

### Wave-level validation

- `node --test test-logic/backend-contract.test.js test-logic/session-recovery.test.js`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/arcade-party.spec.js tests/undercover.spec.js --workers=1`

### High-risk release validation

- `npm run deploy:3100`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`
- `npm run verify:release -- --skip-deploy`

### Expected artifacts

- typed `partyVoiceTransport` config in the existing system-config path
- one additive backend-owned room payload contract for relay and recovery semantics
- shared client transport runtime reused by party and Undercover pages
- sticky relay mode per room visit
- muted/listening voice auto-resume within the approved reconnect window
- lightweight diagnostics and regression coverage for relay fallback plus reconnect recovery

## Open Questions

1. **What exact TURN provider or credential source should back `iceServers`?**
   - What we know: the browser must receive usable ICE server entries, but the milestone does not require a dedicated media platform.
   - Recommendation: keep the contract provider-agnostic and typed as a browser-ready ICE server array; leave richer admin rotation UX to Phase 13.

2. **Should the shared voice-client extraction happen now or later?**
   - What we know: both voice pages currently duplicate the exact fragile negotiation lifecycle.
   - Recommendation: extract the lifecycle now, but keep only the transport logic shared; do not homogenize page-specific turn/UI rules.

3. **Should runtime relay mode surface through the existing degraded voice contract?**
   - What we know: Phase 11 already established one truthful degraded vocabulary.
   - Recommendation: yes. Merge runtime relay/recovery state into `degradedState.subsystems.voice`, while keeping room-local diagnostics additive and ensuring operator `blocked` state still wins.

<sources>
## Sources

### Primary (HIGH confidence)
- `.planning/phases/12-voice-reliability-foundation/12-CONTEXT.md`
- `.planning/phases/11-availability-signals-degraded-modes/11-04-SUMMARY.md`
- `docs/architecture/backend-contract.md`
- `lib/socket-server.js`
- `lib/party/manager.js`
- `lib/shared/network-contract.js`
- `lib/shared/availability.js`
- `lib/system-config.js`
- `lib/defaults.js`
- `backend/handlers/party/rooms/[roomNo]/index.js`
- `pages/party/[roomNo].js`
- `pages/undercover/[roomNo].js`
- `lib/client/room-entry.js`
- `test-logic/backend-contract.test.js`
- `test-logic/client-network-contract.test.js`
- `test-logic/session-recovery.test.js`
- `tests/arcade-party.spec.js`
- `tests/undercover.spec.js`

### Secondary (MEDIUM confidence)
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/phases/11-availability-signals-degraded-modes/11-UAT.md`
- `.planning/phases/11-availability-signals-degraded-modes/11-SECURITY.md`
- `.planning/phases/11-availability-signals-degraded-modes/11-VALIDATION.md`

</sources>
