---
phase: 15
slug: 15-wave-2-delivery-set-a
status: approved
shadcn_initialized: false
preset: existing board lobby + shared board room shell
created: 2026-04-24
---

# Phase 15 — UI Design Contract

> Visual and interaction contract for `flyingchess` as the first Wave 2 board-family title. Generated manually in place of `gsd-ui-researcher`, verified against the shipped board lobby and shared `/board/[roomNo]` room shell.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | existing `styles/GameLobby.module.css` + `styles/BoardRoom.module.css` board-family shell |
| Component library | none |
| Icon library | none |
| Font | `"Orbitron"` for dice / phase / hero emphasis, `"Chakra Petch"` for body and controls, `"Noto Sans TC"` fallback for Chinese copy, `monospace` for room number and compact rule chips |

Rules:
- Do not introduce a new component system or a second board-room shell.
- Do not add new webfont imports for this phase. Net-new Flying Chess UI should stay inside the fonts already loaded by `styles/globals.css`.
- `flyingchess` should feel like the same product family as `gomoku`, `reversi`, and `chinesecheckers`, but with a brighter light-party energy.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Inline icon offsets, dot badges, micro separation |
| sm | 8px | Chip gaps, short meta rows, inline action spacing |
| md | 16px | Default card padding and stacked control spacing |
| lg | 24px | Section padding, board header padding, card interiors |
| xl | 32px | Major layout gaps and room section separation |
| 2xl | 48px | Large stage breaks and board/lower-panel separation |
| 3xl | 64px | Reserved for wide-screen stage breathing room only |

Exceptions: existing board-shell radius and offset tokens `18px`, `20px`, `22px`, `30px`, and `34px` remain valid because Phase 15 extends the shipped board shell instead of replacing it.

Rules:
- Mobile layout must compress by reducing column count before shrinking tap targets.
- Dice controls, movable-piece chips, and target markers must keep at least `44px` interactive height/width on touch layouts.
- Four-seat progress and seat panels should tighten with spacing tokens, not with dense unreadable copy.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 14-16px | 400-500 | 1.5 |
| Label | 11-13px | 500-600 | 1.3 |
| Heading | 24-44px | 600-700 | 0.95-1.1 |
| Display | 32-72px | 700-800 | 0.9-1.0 |

Rules:
- Room title, dice result, and active-turn callouts use display/heading typography with `Orbitron` emphasis.
- Explanatory copy, rule hints, and seat status use `Chakra Petch` with `Noto Sans TC` fallback.
- Compact numeric readouts such as room number, progress fractions, and debug-like phase chips use `monospace` or the existing mono chip pattern.
- Do not use more than two simultaneous font voices in one cluster. Example: turn banner may use `Orbitron` for the headline and `Chakra Petch` for supporting copy, but not a third decorative typeface.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#0b1730` to `#14284a` stage gradient | Board-room background, stage, large surfaces |
| Secondary (30%) | `rgba(18, 27, 42, 0.60)` / `rgba(8, 14, 25, 0.42)` / `#f6f1df` | HUD cards, glass panels, readable text layers |
| Accent (10%) | `#ffd76f`, `#77b8ff`, `#ff8d67`, `#6fe3b9` | Dice CTA, active seat, legal move/path markers, piece progress only |
| Destructive | `#ff8c71` | Room-close, kick/force-exit, or clearly destructive admin-adjacent actions only |

Accent reserved for:
- dice roll button and resolved dice pips
- active player banner / turn halo
- legal target highlights, jump / flight path hints, and collision feedback
- per-seat progress chips and finish/home milestones

Never use accent as the default treatment for every card border, every paragraph, or every passive label.

Seat color contract:
- 2-player mode: red / green
- 3-player mode: red / yellow / blue
- 4-player mode: red / yellow / green / blue
- Purple remains available only for decorative carry-over from Chinese Checkers, not as a primary Flying Chess seat color in this phase

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `擲骰開始`, `移動棋子`, `立即開房`, `複製邀請` |
| Empty state heading | `房間還在等人` / `目前沒有公開飛行棋房` |
| Empty state body | `先準備開局或分享房號，湊滿人後就能開始飛。` |
| Error state | `{問題描述}，請稍後重試；若已在房內，優先用原房號或邀請重新進入。` |
| Destructive confirmation | `解散房間`: `確認後本房所有玩家會離開目前對局。` |

Rules:
- Turn copy must always tell the player下一步是「擲骰」還是「移動」, never just "輪到你".
- Rule hints should use classic-player language: `起飛`, `撞回機場`, `跳點`, `飛線`, `再擲一次`, `剛好進家`.
- Because this is not a voice-first room, no primary UI region should imply that voice or mic access is required.
- Recovery copy must remain aligned with the existing board-family recovery wording from the shared shell.

---

## Layout Contract

1. Keep `/games/flyingchess` inside the existing board-family lobby shell:
   - hero on top
   - create-room panel + public-room list below
   - fast join / copy-invite stays in the quick panel
2. Keep live room detail inside the shared `/board/[roomNo]` shell:
   - fixed top HUD
   - board stage centered
   - supporting panels below or beside the stage depending on width
3. The Flying Chess board must be visually central and wider than any side panel. Support panels explain state; they do not compete with the board for dominance.
4. Mobile behavior:
   - at tablet widths, lower panels collapse into stacked cards
   - at phone widths, seat/progress summaries move above or below the board in compact 2-column groupings
   - primary turn action remains reachable without scrolling past the entire event log
5. The four-seat state summary must stay legible without horizontal scrolling on common mobile widths.

Required stable hooks:
- `data-flyingchess-board`
- `data-flyingchess-phase`
- `data-flyingchess-roll`
- `data-flyingchess-dice`
- `data-flyingchess-seat`
- `data-flyingchess-piece`
- `data-flyingchess-target`
- `data-flyingchess-progress`

---

## Interaction Contract

- Turn flow is explicitly two-step when a move is available:
  1. roll
  2. choose piece / target
- After a roll, the room must highlight only movable pieces and valid destinations. Players should not have to infer legal moves from raw rule text.
- Extra-roll state must be visible as a positive continuation, not as a silent turn reset.
- Collision/send-back feedback must be obvious and social, but brief; it should celebrate the event without blocking the next action with a heavy modal.
- If a roll produces no legal move, the UI must say so directly and advance/retain turn state truthfully.
- Bot-related controls must be truthful:
  - if bot fill is unsupported for `flyingchess`, the UI should hide or disable it with clear copy
  - do not expose a generic shared button that fails only after click

Animation rules:
- Prefer short board-local motion for piece travel and collision return
- Keep animations under roughly 500ms for normal moves
- Never delay turn-state updates until long celebratory motion finishes

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | existing CSS modules only | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-04-24
