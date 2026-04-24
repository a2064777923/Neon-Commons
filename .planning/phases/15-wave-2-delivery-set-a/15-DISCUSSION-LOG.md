# Phase 15: Wave 2 Delivery Set A - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `15-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 15-wave-2-delivery-set-a
**Areas discussed:** launch title selection, launch completeness boundary, room experience shape

---

## Launch Title Selection

| Option | Description | Selected |
|--------|-------------|----------|
| `drawguess` | Reuse the current party-room contract and voice path, then add drawing / guessing rounds. | No |
| `flyingchess` | Reuse the current board-room contract and turn-sync model for the first real Wave 2 runtime. | Yes |
| `uno` | Popular title, but would need more new card-family runtime work than it first appears. | No |
| `bowling` | Light 3D party direction. | No |
| `miniracers` | Light 3D racing / bumper-car direction. | No |

**User's choice:** `flyingchess`
**Notes:** The user chose the safer board-family path over the recommended `drawguess` route. The key preference was to get the first Wave 2 runtime running cleanly on top of the existing board-family contract.

---

## Launch Completeness Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| 经典完整首发 | Ship standard `2-4` player Flying Chess with the full core ruleset and correct playable loop. | Yes |
| 超轻 MVP | Ship a much thinner ruleset first, then fill in common mechanics later. | No |
| 派对增强版 | Ship the classic rules plus stronger spectacle, richer variants, or more “hot room” enhancements immediately. | No |

**User's choice:** `经典完整首发`
**Notes:** The user explicitly chose correctness and completeness of the classic rules over a faster-but-thinner MVP.

---

## Room Experience Shape

| Option | Description | Selected |
|--------|-------------|----------|
| 棋盘家族的轻派对房 | Keep the board-family room, invite, and recovery shape; support public/private rooms without making voice-party behavior mandatory. | Yes |
| 更公开快配的热闹房 | Push harder toward public four-player fast-start and repeated quick-match rhythm. | No |
| 更熟人局的私密派对房 | Prioritize a more host-controlled private-party shell over the default board-family shape. | No |

**User's choice:** `棋盘家族的轻派对房`
**Notes:** The user wants this to stay inside the current board-family operating model. Social/lightweight is desired, but not through a new voice-first or private-party-first surface.

---

## the agent's Discretion

- Exact board presentation, room-page choreography, and config defaults.
- Whether bot fill is part of the initial Phase 15 ship or deferred, since that gray area was not selected for discussion.

## Deferred Ideas

- Voice-first or heavier party treatment for `flyingchess`.
- Faster public quick-match / rematch-centric room behavior.
- Extra launch polish or rule variants beyond the classic complete core loop.
