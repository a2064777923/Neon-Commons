---
phase: 3
slug: hub-room-expansion-framework
status: approved
shadcn_initialized: false
preset: none
created: 2026-04-22
reviewed_at: 2026-04-22T11:26:24+08:00
---

# Phase 3 — UI Design Contract

> Visual and interaction contract for the family-based hub, universal room entry, and invite/guest lifecycle. Generated inline for `gsd-ui-phase`, then self-verified against the checker dimensions.

---

## Objectives

- Turn the homepage into a game-family arcade instead of a flat launcher.
- Make cross-game room-number and invite entry the primary focal point on the homepage.
- Keep dedicated create-room pages for each game while aligning them to one shared hub language.
- Keep unavailable titles visible with distinct `暫停新房` and `即將推出` states.
- Preserve the current fast, low-explanation tone: short labels, direct verbs, no tutorial-heavy hero copy.

---

## Page Inventory

| Screen | Purpose | Primary focal point | Must-have states |
|----------|-------|-------|-------|
| Homepage hub `/` | Universal discovery and entry across all game families | Central `Arcade Command Dock` for room number, invite parsing, and share-link copy | playable, `暫停新房`, `即將推出`, empty live-feed |
| Family lobby `/lobby`, `/games/[gameKey]` | Dedicated per-game room creation and local quick join | Family hero + local quick-join panel | create ready, new-room paused, empty public rooms |
| Invite resolution entry | Resolve invite links before room redirect | Lightweight identity intercept sheet, not a full page detour | logged-in auto-enter, guest allowed, guest blocked |
| Post-match guest sync prompt | Offer account linking after guest play | Compact result banner with one primary conversion CTA | sync now, later |

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none |
| Preset | not applicable |
| Component library | none |
| Icon library | existing custom game icons + inline SVG utility icons |
| Font | `Chakra Petch` for body/input, `Orbitron` for headings/display, `Noto Sans TC` as Chinese fallback |

This phase stays inside the current CSS-module + global-token system. No shadcn initialization is introduced because the shipped UI already has a strong visual language and the repo convention is to expand incrementally, not re-platform.

---

## Visual Direction

- Primary direction: `Neon arcade concourse`, not admin dashboard and not flat app grid.
- Focal point on the homepage: a wide command dock centered in the main stage above the family bands.
- Secondary hierarchy: family bands first, live-room feed second, wallet/rank side information third.
- Family sections should read like themed stages with one anchor title and several compressed subcards, not like a long single-column list.
- Cyan is the only actionable accent. Pink and amber may remain as ambient glow only and must not become second interactive accents.
- Surfaces keep clipped corners, luminous borders, and soft depth already established by `styles/globals.css`, `styles/Arcade.module.css`, and `styles/GameLobby.module.css`.

---

## Family Taxonomy

| Family | Role in hub | Titles surfaced in Phase 3 contract |
|----------|-------|-------|
| 經典牌桌 | Fast, repeatable room play | 斗地主, UNO 類 |
| 推理派對 | Voice/social deduction | 狼人殺, 阿瓦隆, 誰是臥底, 你畫我猜 |
| 棋盤對戰 | Turn-based direct competition | 五子棋, 中國跳棋, 黑白棋, 飛行棋 |
| 單人闖關 | Solo retention and low-friction play | 推箱子 |
| 輕量 3D | Spectacle and party variety | 保齡球, 迷你賽車/碰碰車 |

Rules:

- Every family band must be able to mix `可立即遊玩`, `暫停新房`, and `即將推出` cards.
- Each family shows one concise family strapline and never more than one sentence of descriptive copy.
- Shipped titles stay first inside their family. Upcoming titles follow behind them in teaser order.

---

## Homepage Information Architecture

1. Top command banner: short product line, live metrics, no long explanation copy.
2. Main-stage command dock: room number join, invite parsing, and share-link generation in one unified module.
3. Family bands: stacked sections with compact card density so the hub feels broad without becoming tall and sparse.
4. Side utility surfaces: wallet/profile, live-room feed, leaderboard, and fast links to family lobbies.

Hub contract:

- The label above the family area should be `遊戲家族`.
- The label above the central entry module should be `遊戲入口`.
- The command dock must appear before the first family band on all breakpoints.
- The first viewport on desktop must show the command dock plus at least two family bands without forcing a long scroll.

---

## Layout System

| Zone | Desktop | Tablet | Mobile |
|----------|-------|-------|-------|
| Command banner | Full-width top strip | Full-width top strip | Full-width stacked strip |
| Command dock | Center column, visually dominant | Full-width above families | Full-width and first actionable module |
| Family bands | Two-column rhythm inside each band: anchor card + compressed subcards | One anchor row + two-card rows | Single-column cards with horizontal scroll chips for family jump |
| Side utilities | Left/right rails flanking center stage | Collapse into below-stage panels | Stack below family bands |

Density rules:

- Family anchor cards stay visually strong but never exceed the combined height of two compressed title cards.
- Compressed title cards use short copy, one status badge, one CTA line, and optional room-count chip only.
- No family band may rely on long paragraph descriptions to explain itself.

---

## Component Contracts

### 1. Arcade Command Dock

- Heading: `遊戲入口`
- Mode switch labels: `房號加入`, `貼上邀請`, `分享我的房`
- Default mode: `房號加入`
- Primary CTA by mode:
  - `房號加入` → `進入房間`
  - `貼上邀請` → `解析邀請`
  - `分享我的房` → `複製邀請`
- Secondary action:
  - On join modes: `查看可玩的遊戲家族`
  - On share mode with no active room: `先去開房`
- Helper copy:
  - Room number mode: `六位房號可直接定位到對應遊戲房間。`
  - Invite mode: `支援完整邀請連結，系統自動判斷遊戲與房間。`
  - Share mode: `只對你目前可分享的房間生成邀請連結。`

### 2. Family Band

- Structure: family eyebrow, family title, short strapline, one anchor card, compressed title cards, optional live-room chips.
- Family CTA text: `查看這個家族`
- Anchor card CTA text:
  - Playable title → `前往大廳`
  - `暫停新房` title → `房號／邀請仍可進`
  - `即將推出` title → `即將推出`
- Family jump navigation must use text labels, never icon-only pills.

### 3. Title Card States

| State | Badge | Visual treatment | Allowed CTA | Supporting copy |
|----------|-------|-------|-------|-------|
| Playable | `可立即遊玩` | Full-contrast surface, cyan edge, active hover | `前往大廳` | Show players, strapline, and live/open room chips |
| 暫停新房 | `暫停新房` | Desaturated surface with retained contrast and readable border | `房號／邀請仍可進` | `目前不開新房，已有房號或邀請可直接加入。` |
| 即將推出 | `即將推出` | More muted surface, teaser glow, no active hover lift | `即將推出` | `入口保留中，完成後會直接在這裡開放。` |

Rules:

- `暫停新房` and `即將推出` must not share the same explanatory body copy.
- Greyed states must remain legible and tappable for detail disclosure; they are dimmed, not hidden.
- `暫停新房` cards may still expose room-count chips when live rooms exist.
- `即將推出` cards may expose theme tags such as `多人`, `單人`, or `3D`, but not room counts.

### 4. Family Lobby Consistency

- Per-game pages keep their existing dedicated create-room form and local room-number quick join.
- Add one clear return path to the family hub: `返回遊戲家族`.
- Quick-join panels on family pages must visually echo the homepage command dock through the same border, glow, and label system.
- If a title is in `暫停新房`, the family lobby swaps the create CTA for a read-only pause banner and keeps the quick-join box active.

### 5. Invite Resolution Intercept

- Logged-in user with valid session: skip the intercept and enter the resolved room directly.
- Unauthenticated user on an invite that allows guest entry: show a centered sheet over a blurred hub backdrop.
- Sheet contents:
  - Game icon
  - Game title
  - Room number
  - Room type chip: `私密房` or `邀請房`
  - Identity choice explanation in one sentence
- Primary CTA when guest allowed: `以遊客進入`
- Secondary CTA when guest allowed: `登入後進入`
- Fallback text link: `先回遊戲家族`
- If guest is blocked for that room, replace the primary CTA with `此房僅限登入玩家` and keep `登入後進入` as the only actionable button.

### 6. Post-Match Guest Sync Prompt

- Placement: result summary area immediately after the guest match ends.
- Title: `保留這局紀錄`
- Body: `登入或綁定帳號後，這場對局可同步到你的戰績與歷史紀錄。`
- Primary CTA: `登入並同步本局`
- Secondary CTA: `稍後再說`
- This banner is informational, compact, and dismissible after the match. It is not a blocking full-screen modal.

---

## Spacing Scale

Declared values (must be multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Chip separators, icon nudges |
| sm | 8px | Tight inline gaps, badge padding |
| md | 16px | Default component spacing |
| lg | 24px | Card padding, field gaps |
| xl | 32px | Section gaps, panel padding |
| 2xl | 48px | Major module separation, minimum control height |
| 3xl | 64px | Page-level section breaks |

Exceptions: none

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Body | 16px | 400 | 1.58 |
| Label | 12px | 700 | 1.2 |
| Heading | 28px | 700 | 1.1 |
| Display | 56px | 700 | 0.96 |

Rules:

- Only these four sizes and two weights are allowed for new Phase 3 hub surfaces.
- Body copy stays short. Most cards should not exceed two lines of body text.
- Family and dock headings use `Orbitron`; body, inputs, and button labels use `Chakra Petch` with `Noto Sans TC` fallback.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | #050913 | Page background, deep stage surfaces |
| Secondary (30%) | #091321 | Cards, rails, command dock panels |
| Accent (10%) | #67EBFF | Primary CTA fills, active mode switch, focus ring, live-room chips, share success state |
| Destructive | #FF6B8B | Error emphasis and destructive confirmations only |

Accent reserved for: primary CTAs, active dock mode, focused fields, live-room chips, and copy-success feedback. Accent must not be applied to every button, every badge, or every card border simultaneously.

State color notes:

- `暫停新房` uses muted neutral surfaces plus a restrained amber text chip, but does not introduce a second action accent.
- `即將推出` uses dimmed neutral surfaces plus decorative glow only; it does not gain an actionable accent treatment.

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Primary CTA | `進入房間` |
| Empty state heading | `今晚還沒人開桌` |
| Empty state body | `先輸入房號、貼上邀請，或直接從任一家族開第一桌。` |
| Error state | `找不到這個房間。請檢查房號或邀請是否正確，或回到遊戲家族重新進入。` |
| Destructive confirmation | `無。Phase 3 玩家端不新增刪除型操作。` |

Microcopy rules:

- Prefer short, directive labels with a concrete noun: `進入房間`, `複製邀請`, `登入並同步本局`.
- Avoid generic verbs such as `提交`, `確定`, `下一步`, `點擊這裡`.
- `暫停新房` copy must always mention that room number and invite entry still work.
- `即將推出` copy must tease future availability without pretending the title is joinable now.

---

## Responsive Behavior

- Desktop keeps the command dock visually dominant in the center stage.
- Tablet collapses side rails below the command dock and keeps family bands readable without shrinking card content into tiny tiles.
- Mobile order is fixed: command dock first, family jump chips second, family bands third, utilities last.
- On mobile, the dock mode switch remains visible without horizontal overflow and all primary controls keep at least `2xl` height.

---

## Accessibility

- Greyed cards must still meet readable contrast for labels and helper copy.
- State meaning must never rely on color alone; every unavailable card needs a text badge.
- All actionable controls require visible focus styling and text labels.
- Invite intercept buttons must present both identity options in clear language, not icon-only affordances.
- Live-room chips and badges should remain readable by screen readers as plain text phrases, not cryptic abbreviations only.

---

## Non-Goals

- Do not merge all room creation into one universal create-room form.
- Do not redesign active gameplay screens in this phase.
- Do not hide disabled titles to make the grid look cleaner.
- Do not turn the homepage into an admin-style data dashboard.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| none | none | not required |

---

## Checker Sign-Off

- [x] Dimension 1 Copywriting: PASS
- [x] Dimension 2 Visuals: PASS
- [x] Dimension 3 Color: PASS
- [x] Dimension 4 Typography: PASS
- [x] Dimension 5 Spacing: PASS
- [x] Dimension 6 Registry Safety: PASS

**Approval:** approved 2026-04-22
