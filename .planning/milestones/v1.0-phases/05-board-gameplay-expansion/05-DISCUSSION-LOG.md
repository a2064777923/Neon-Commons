# Phase 5: Board Gameplay Expansion - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `05-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 5-board-gameplay-expansion
**Areas discussed:** Board expansion shape, Gomoku capability direction, Chinese Checkers capability direction, Sync and visibility rules

---

## Board Expansion Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Extend the existing per-game lobby and shared `/board` room contract | Add new board capability through normalized room config and visible room summaries while preserving the current route model | ✓ |
| Build separate variant-specific setup and room routes | Give each board expansion its own setup flow and room page | |
| Keep the runtime contract unchanged and limit Phase 5 to cosmetic UI refreshes | Avoid new board capability and only restyle the existing board surface | |

**User's choice:** Extend the existing per-game lobby and shared `/board` room contract
**Notes:** `[auto]` Recommended default selected to preserve the Phase 3 room-entry contract and the existing board-family architecture.

---

## Gomoku Capability Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the current 15x15 two-player baseline and add safe pacing or rule presets around it | Expand visible player-facing capability without changing the core board shape or seat model | ✓ |
| Expand Gomoku into alternate board sizes or extra seats | Turn Phase 5 into a larger ruleset or topology change | |
| Focus primarily on undo or rollback-heavy interaction changes | Prioritize move reversal and conflict-heavy interactions over room options | |

**User's choice:** Keep the current 15x15 two-player baseline and add safe pacing or rule presets around it
**Notes:** `[auto]` Recommended default selected because it creates meaningful board expansion while keeping sync risk and UI churn contained.

---

## Chinese Checkers Capability Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Keep the standard 2/4/6-player star-board model and expand through room presets plus clearer move and turn-state assists | Build on the current board geometry and interaction language instead of replacing it | ✓ |
| Add custom board layouts or alternative camp topologies | Change the underlying board structure and seat-layout model | |
| Focus mainly on scoring or backend settlement changes | Shift the phase away from visible room options or interactions | |

**User's choice:** Keep the standard 2/4/6-player star-board model and expand through room presets plus clearer move and turn-state assists
**Notes:** `[auto]` Recommended default selected because the current Chinese Checkers implementation already has strong move-target affordances worth extending rather than replacing.

---

## Sync and Visibility Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot options at room creation, surface them in lobby and room UI, and treat realtime sync regression coverage as mandatory | Keep board expansion consistent with earlier phases and reduce live-room mutation risk | ✓ |
| Allow mid-match setting mutations for live rooms | Let room owners reconfigure active matches after the game starts | |
| Keep advanced options backend-only and leave room UI unchanged | Hide board expansion details from players and invitees | |

**User's choice:** Snapshot options at room creation, surface them in lobby and room UI, and treat realtime sync regression coverage as mandatory
**Notes:** `[auto]` Recommended default selected to carry forward the Phase 2 new-room-only model and the Phase 3 shared room-summary contract.

---

## the agent's Discretion

- Exact preset naming and microcopy for the new Gomoku and Chinese Checkers options.
- Exact choice of the initial safe option set, as long as both shipped board games gain visible player-facing expansion.
- Exact presentation of active config in room-summary cards and board-room headers.

## Deferred Ideas

- Reversi-specific expansion remains outside Phase 5 scope.
- Board-topology changes and other geometry-altering rule sets belong in a future phase.
- Rollback-heavy undo systems and mid-match rule mutation stay deferred because they raise realtime sync risk.
