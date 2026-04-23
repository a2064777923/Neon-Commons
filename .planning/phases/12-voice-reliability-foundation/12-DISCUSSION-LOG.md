# Phase 12: Voice Reliability Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `12-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 12-voice-reliability-foundation
**Areas discussed:** fallback activation and player experience, reconnect recovery behavior, reliability priority

---

## Fallback Activation And Player Experience

| Option | Description | Selected |
|--------|-------------|----------|
| Auto switch + light hint | Direct peer mode fails or degrades, system auto-switches and only shows lightweight status guidance | Yes |
| Auto switch + strong prompt | System switches automatically but surfaces a much louder notice | No |
| Manual switch | User must explicitly retry or choose stable mode | No |
| Other | Freeform alternative | No |

### Questions Asked

1. **What should fallback feel like to the player?**
   - Presented options: auto switch + light hint / auto switch + strong prompt / manual switch / other
   - User selection: `1`

2. **When should fallback trigger?**
   - Presented options: startup failure only / post-connect degradation only / both / other
   - User selection: `3`

3. **After relay fallback activates, should the system switch back to direct peer mode automatically?**
   - Presented options: stay on relay for this room session / auto-switch back when network improves / let user manually retry direct / other
   - User selection: `1`

### Outcome

- Fallback is automatic and low-friction.
- Trigger on both initial connection failure and sustained post-connect degradation.
- Relay mode stays sticky for the rest of the room visit once engaged.

---

## Reconnect Recovery Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Auto restore as joined but muted/listening | Reconnect returns user to voice without reopening mic | Yes |
| Restore full previous state | Try to reopen the exact pre-disconnect speaking state | No |
| Room only, no voice auto-restore | User must rejoin voice manually after reconnect | No |
| Other | Freeform alternative | No |

### Questions Asked

1. **What should the default reconnect restore state be?**
   - Presented options: joined but muted/listening / full previous state / no voice auto-restore / other
   - User selection: `1`

2. **What recovery window counts as a transient disconnect?**
   - Presented options: 10-15s / 30-45s / 60-90s / other
   - User selection: `2`

3. **If the user returns during that window and is currently the active speaker, should they still come back muted/listening?**
   - Presented options: always muted/listening / auto-restore speaker state / game-specific split / other
   - User selection: `1`

### Outcome

- Auto-recover voice within roughly 30-45 seconds.
- Recovery always returns the player to joined but muted/listening.
- This still applies when the player is currently allowed to speak.

---

## Reliability Priority

| Option | Description | Selected |
|--------|-------------|----------|
| Prioritize continuity | Accept some latency or quality loss if voice stays usable | Yes |
| Prioritize lowest latency/quality | Push harder to keep direct mode, even if recovery gets more fragile | No |
| Split by title | Different party titles optimize differently | No |
| Other | Freeform alternative | No |

### Questions Asked

1. **What is the main product priority when choosing between direct peer mode and relay mode?**
   - Presented options: continuity / lowest latency-quality / split by title / other
   - User selection: `1`

### Outcome

- The phase should optimize for keeping voice usable and continuous, even if relay mode is somewhat slower or less crisp than direct peer mode.

---

## Deferred / Not Chosen

- Detailed relay vendor choice and transport topology were intentionally left open for research and planning.
- Per-title rollout scope across voice-enabled party games was not locked during discussion and remains planner discretion within the Phase 12 boundary.
