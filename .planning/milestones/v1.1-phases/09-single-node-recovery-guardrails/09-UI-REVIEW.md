# Phase 9 — UI Review

**Audited:** 2026-04-22
**Baseline:** Abstract 6-pillar standards (no UI-SPEC.md found)
**Screenshots:** captured (`.planning/ui-reviews/09-20260422-222728/home-desktop.png`); current runtime had `0` public rooms, so snapshot-only visuals were audited primarily from code paths rather than live fixture screenshots

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Recovery copy is specific and fail-closed, but terminology drifts across home, share, and entry flows. |
| 2. Visuals | 2/4 | Snapshot-only rooms are safer than before, but they still read too much like normal live entries at first glance. |
| 3. Color | 3/4 | Both pages have intentional palettes, but recovery state lacks one shared color treatment across the full journey. |
| 4. Typography | 4/4 | Headline, metadata, and body roles are clear and deliberate on both touched surfaces. |
| 5. Spacing | 4/4 | Layout spacing is disciplined, responsive, and consistent across both modules. |
| 6. Experience Design | 3/4 | Core safety behavior is solid, but recovery-only discovery still looks too action-forward before the user clicks in. |

**Overall: 19/24**

---

## Top 3 Priority Fixes

1. **Promote `snapshot-only` into a first-class visual state** — users can still mistake recovery cards for playable live rooms — add a persistent badge/icon/tinted container on both the live-feed card and the entry hero instead of relying on a dashed border plus small label text.
2. **Split recovery actions from live actions more explicitly** — the home feed and share-room picker still funnel into generic, high-energy CTA patterns — relabel recovery-only affordances as status-view or recovery-link actions so the user is not invited into a join mental model before the entry page explains the block.
3. **Normalize recovery vocabulary across the flow** — mixed terms like `重啟恢復中`, `恢復中`, `等待房間恢復`, and `live 房` make the state feel less productized — define one canonical phrase set for feed, picker, entry summary, and button copy.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- Good: the recovery branch explains the restriction in plain language instead of silently failing. The entry page tells the user that the room is only a recovered snapshot and that auto-entry / guest minting are blocked in this state (`pages/entry/[gameKey]/[roomNo].js:186-205`, `pages/entry/[gameKey]/[roomNo].js:223-230`).
- Good: the home surface also avoids vague errors. Input and empty-state copy is concrete (`pages/index.js:10`, `pages/index.js:75`, `pages/index.js:96`, `pages/index.js:257`).
- Gap: recovery terminology is inconsistent across adjacent surfaces. The same state appears as `重啟恢復中`, `恢復中`, `恢復快照可見，但暫停進場`, `房間恢復中`, and `等待房間恢復` (`pages/index.js:250`, `pages/index.js:341`, `pages/index.js:587-591`, `pages/entry/[gameKey]/[roomNo].js:152`, `pages/entry/[gameKey]/[roomNo].js:162`, `pages/entry/[gameKey]/[roomNo].js:205`, `pages/entry/[gameKey]/[roomNo].js:219`).
- Gap: the main explanatory paragraph mixes Chinese UI copy with `live 房`, which weakens polish in a user-facing sentence (`pages/entry/[gameKey]/[roomNo].js:189`).

### Pillar 2: Visuals (2/4)

- Good: the overall information hierarchy is strong. The home live-feed cards and the entry-page status rail both make room metadata immediately scannable (`pages/index.js:232-254`, `pages/entry/[gameKey]/[roomNo].js:145-168`).
- Gap: the snapshot-only live-feed card is still fundamentally the same clickable tile as a live room. The only visual distinction in the touched CSS is a dashed border and darker background, plus a warmer `em` color (`pages/index.js:239-254`, `styles/Arcade.module.css:311-334`). For the core Phase 9 state, that is not enough separation.
- Gap: the recovery-only entry page keeps the same hero and card framing as a normal room-entry page. The state change is carried mostly by copy and disabled buttons rather than by a dedicated alert, status panel, or recovery-specific header treatment (`pages/entry/[gameKey]/[roomNo].js:173-225`, `styles/UtilityPages.module.css:128-226`).

### Pillar 3: Color (3/4)

- Good: each touched surface has a coherent palette. The arcade home uses cyan/amber neon accents, while the entry page uses warm cream/green utility styling. Neither page feels accidental (`styles/Arcade.module.css:15-35`, `styles/UtilityPages.module.css:10-35`, `styles/UtilityPages.module.css:128-171`).
- Evidence: the two modules rely on repeated, controlled tokens rather than purely random one-off values. The most common recurring values are `rgba(36, 64, 51, 0.08)` and `#22392f` in utility pages, with `rgba(103, 235, 255, 0.14)` reused across the arcade surface.
- Gap: recovery color semantics are not consistent across the journey. On home, recovery gets a warmer label color (`styles/Arcade.module.css:333-334`), but the entry page does not introduce a matching recovery-specific accent or state block at all (`styles/UtilityPages.module.css:128-226`). The user moves from one page to the next without a stable visual signal for the same recovery state.

### Pillar 4: Typography (4/4)

- Good: the typography roles are intentional. The home page uses a clear display stack for the arcade surface (`styles/Arcade.module.css:72-77`), while the entry page uses `Space Grotesk` for major headings and `IBM Plex Mono` for metadata chips (`styles/UtilityPages.module.css:61-72`, `styles/UtilityPages.module.css:145-153`).
- Good: size distribution is broad but still controlled. Across the audited modules, the typography system stays inside a readable ladder from `11px` metadata through `16px` body copy and multiple responsive display clamps, without collapsing into one-size-fits-all text.
- No material typography issue was found in the Phase 9 UI changes themselves.

### Pillar 5: Spacing (4/4)

- Good: spacing is consistent and deliberate in both modules. The dominant rhythm values cluster around `10px`, `12px`, `14px`, `16px`, and `18px`, which keeps cards and panels aligned without arbitrary spacing drift.
- Good: responsive fallbacks exist on the arcade surface, including one-column collapse for the main stage grid and family cards on narrower widths (`styles/Arcade.module.css:505-528`).
- Good: the entry page also preserves structure at smaller widths via simplified grid layouts and reduced padding (`styles/UtilityPages.module.css:601-647`).
- No spacing regression specific to the recovery-state work was found.

### Pillar 6: Experience Design (3/4)

- Good: the most important behavioral guardrails are present. Snapshot-only rooms do not auto-enter, and both guest and login CTAs are disabled in that state (`pages/entry/[gameKey]/[roomNo].js:18-19`, `pages/entry/[gameKey]/[roomNo].js:197-220`).
- Good: supporting states exist for loading, errors, and empty rooms (`pages/entry/[gameKey]/[roomNo].js:24-70`, `pages/entry/[gameKey]/[roomNo].js:232`, `pages/index.js:257`, current `/api/hub` runtime response: `liveFeed: []`).
- Gap: the home live-feed still routes snapshot-only rooms through the same large-card click treatment as live rooms (`pages/index.js:239-254`, `pages/index.js:582-588`). The safety block only becomes fully obvious after navigation, so the pre-click affordance remains more optimistic than the actual state.
- Gap: the share-room mode still uses the same primary `複製邀請` CTA even when the selected room is marked `恢復中` in the picker (`pages/index.js:337-353`). The backend behavior is safe, but the interaction language does not yet tell the user that this is now a recovery-status link rather than a normal “come join now” invite.

---

## Files Audited

- `.planning/phases/09-single-node-recovery-guardrails/09-03-PLAN.md`
- `.planning/phases/09-single-node-recovery-guardrails/09-01-SUMMARY.md`
- `.planning/phases/09-single-node-recovery-guardrails/09-02-SUMMARY.md`
- `.planning/phases/09-single-node-recovery-guardrails/09-03-SUMMARY.md`
- `pages/index.js`
- `pages/entry/[gameKey]/[roomNo].js`
- `styles/Arcade.module.css`
- `styles/UtilityPages.module.css`
