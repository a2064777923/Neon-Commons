# Phase 12: Voice Reliability Foundation - Context

**Gathered:** 2026-04-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Make party-room voice recover more reliably when peer-to-peer connectivity degrades. This phase covers fallback transport behavior, reconnect behavior, and compatibility with the existing party-room signaling and room lifecycle contract. It does not introduce a full dedicated SFU/media platform, and it does not redefine the frontend/backend runtime split.

</domain>

<decisions>
## Implementation Decisions

### Fallback Activation And Player Experience
- **D-01:** When direct peer connectivity degrades, fallback to relay automatically. Do not require the player to confirm or manually switch modes before voice continues.
- **D-02:** Player-facing feedback for fallback should stay lightweight and truthful, using status-panel style messaging such as reconnecting or stable-mode copy rather than disruptive modal prompts or blocking confirmation flows.
- **D-03:** Fallback should trigger in both cases: when the initial direct connection cannot be established within a short startup window, and when an already-established direct connection later degrades persistently.
- **D-04:** Once a room session falls back to relay, keep that room session on relay for the remainder of the visit instead of automatically bouncing back to direct peer mode.

### Reconnect Recovery Behavior
- **D-05:** During transient disconnects, voice should auto-recover without requiring the player to rejoin the room manually, as long as they return within an approximately 30-45 second recovery window.
- **D-06:** After reconnect recovery, restore the player into voice as connected but muted/listening by default. Never auto-open the microphone on recovery.
- **D-07:** The muted/listening recovery default still applies even if the returning player is currently the active speaker or otherwise allowed to talk; speaking must resume only after an explicit user action.

### Reliability Priority
- **D-08:** Prioritize continuity over the lowest possible latency or best audio fidelity. It is acceptable for relay mode to trade some quality or latency if that keeps voice usable and avoids dropping the user out of conversation.

### the agent's Discretion
- Exact relay provider/topology choice, ICE/TURN configuration shape, and detection thresholds are open for research and planning, as long as they satisfy the fallback and reconnect behavior above.
- Planner may decide whether to refactor shared voice client code between `pages/party/[roomNo].js` and `pages/undercover/[roomNo].js` in this phase or stage the refactor behind compatibility-preserving tasks.
- Coverage sequencing across voice-enabled party titles is open, but any rollout must preserve existing party signaling semantics and Undercover's turn-based speaking rules.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone Contract
- `.planning/PROJECT.md` — Product baseline, current milestone intent, and non-negotiable runtime constraints.
- `.planning/ROADMAP.md` — Phase 12 goal, success criteria, and adjacent milestone sequencing.
- `.planning/REQUIREMENTS.md` — `VOICE-01` and `VOICE-02` requirements, plus out-of-scope guardrails excluding full SFU replatforming.

### Existing Voice And Availability Baseline
- `.planning/phases/11-availability-signals-degraded-modes/11-04-SUMMARY.md` — The currently shipped Undercover voice behavior and deployed-stack verification hardening.
- `.planning/phases/11-availability-signals-degraded-modes/11-UAT.md` — User-accepted expectations for truthful voice behavior in degraded party-room scenarios.
- `.planning/phases/11-availability-signals-degraded-modes/11-SECURITY.md` — Threat model and constraints around voice affordances, truthful state, and shared signaling behavior.
- `.planning/phases/11-availability-signals-degraded-modes/11-VALIDATION.md` — Existing verification map for degraded voice behavior, release gates, and room-entry/hub coverage.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pages/party/[roomNo].js` — Existing party-room WebRTC voice lifecycle, local stream handling, peer negotiation, degraded-state UI, and reconnect banner behavior.
- `pages/undercover/[roomNo].js` — Dedicated party-family room with turn-scoped voice controls that must stay compatible with any fallback/reconnect changes.
- `lib/shared/network-contract.js` — Shared `SOCKET_EVENTS.party` and `SOCKET_EVENTS.voice` contract that already defines the signaling event surface.
- `lib/client/network-runtime.js` — Canonical split-port socket origin handling for `3100/3101`; any voice transport changes must preserve this runtime contract.

### Established Patterns
- The backend owns Socket.IO routing and scoped authorization; client pages connect directly to backend Socket.IO only through shared runtime helpers.
- Party voice state is serialized per seat (`voiceConnected`, `voiceMuted`) and broadcast through room updates, while the browser currently owns peer connection lifecycle.
- Degraded-mode truth already flows through shared availability helpers, so new voice reliability states should integrate with that contract instead of inventing ad hoc page-local wording.

### Integration Points
- `lib/socket-server.js` — Current voice join/leave/state/signal entrypoints for any new fallback orchestration or diagnostics events.
- `lib/party/manager.js` — Seat-level voice presence, disconnect/unregister behavior, and room update emission; likely backend insertion point for reconnect window semantics.
- `pages/party/[roomNo].js` and `pages/undercover/[roomNo].js` — Frontend insertion points for relay fallback activation, reconnect resume state, and player-facing status messaging.

</code_context>

<specifics>
## Specific Ideas

- Fallback should feel automatic and low-friction rather than asking players to babysit mode switches.
- Reconnect should never surprise a player by reopening their microphone automatically.
- Relay mode should be sticky for a room visit once the system decides direct peer mode is no longer trustworthy.

</specifics>

<deferred>
## Deferred Ideas

- Dedicated SFU-grade media architecture remains out of scope for this phase and should stay deferred beyond the current fallback/reconnect foundation.
- None otherwise — discussion stayed within the Phase 12 boundary.

</deferred>

---

*Phase: 12-voice-reliability-foundation*
*Context gathered: 2026-04-23*
