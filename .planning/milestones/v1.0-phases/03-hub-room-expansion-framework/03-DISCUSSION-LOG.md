# Phase 3: Hub & Room Expansion Framework - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-22
**Phase:** 03-Hub & Room Expansion Framework
**Areas discussed:** Hub structure, room creation model, capability visibility, future title surfacing, cross-game entry, invite identity flow, disabled-title access

---

## Hub structure

| Option | Description | Selected |
|--------|-------------|----------|
| Flat hub | Keep the current per-title flat launcher | |
| Family hub | Group games under family sections and future expansion buckets | ✓ |
| Metadata only | Keep UI mostly unchanged and only prepare data structures | |

**User's choice:** Family hub.
**Notes:** The user wants the arcade to feel broader and more expandable, with room for many more titles.

---

## Room creation model

| Option | Description | Selected |
|--------|-------------|----------|
| Unified create form | One cross-game create-room form for all families | |
| Per-game create pages | Keep each game/family owning its own create-room experience | ✓ |
| Hidden create flow | Push create-room deeper behind room discovery first | |

**User's choice:** Keep per-game create-room flows.
**Notes:** The user wants consistency in entry, not one giant merged create-room workflow.

---

## Capability visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Hide unavailable games | Remove disabled titles from the hub entirely | |
| Grey them out | Keep unavailable titles visible but visibly disabled | ✓ |
| Show as plain text only | Mention unavailable titles without proper cards | |

**User's choice:** Grey them out.
**Notes:** The user wants the arcade to feel full and forward-looking, even when some entries are not currently open.

---

## Future title surfacing

| Option | Description | Selected |
|--------|-------------|----------|
| Show only shipped games | No placeholders until a game is fully playable | |
| Playable now or upcoming | Finished games appear directly; unfinished ones show `即將推出` | ✓ |
| Upcoming only | Announce many titles first, ship playability later | |

**User's choice:** Playable now or upcoming.
**Notes:** The user explicitly wants finished titles added quickly and unfinished ones surfaced as `即將推出`.

---

## Cross-game entry

| Option | Description | Selected |
|--------|-------------|----------|
| Per-page only | Keep room-number entry only inside each game's page | |
| Hub universal entry | Add a cross-game room-number / invite-link entry point on the homepage | ✓ |
| Invite-link only | Focus on shared links instead of a universal room-number box | |

**User's choice:** Hub universal entry.
**Notes:** The homepage should become the common door into all families.

---

## Invite identity flow

| Option | Description | Selected |
|--------|-------------|----------|
| Login only | Invite links require account login before entry | |
| Login or guest | Invite links let unauthenticated users choose guest mode or account login | ✓ |
| Fully anonymous | Drop users straight into rooms with no identity choice | |

**User's choice:** Login or guest.
**Notes:** Returning logged-in users should enter directly. Guests should be able to link an account after the match and sync that session's information.

---

## Disabled-title access

| Option | Description | Selected |
|--------|-------------|----------|
| Hard closed | Greyed titles are completely inaccessible | |
| Existing rooms still joinable | Disabled-for-new-room titles can still be joined by room number or invite link if a live room exists | ✓ |
| Admin-only bypass | Only operators can still enter disabled titles | |

**User's choice:** Existing rooms still joinable.
**Notes:** The user chose the equivalent of "A": grey the title but preserve room-number/invite access for already-open rooms.

---

## Specific title priority

**User's choice:** `UNO 類`, `誰是臥底`, `你畫我猜`, `黑白棋`, `飛行棋`, `推箱子`, `保齡球`, `迷你賽車/碰碰車`

**Notes:** The user wants the product to expand aggressively across single-player, multiplayer, and light 3D categories.

## the agent's Discretion

- Exact family naming and ordering.
- Exact visual treatment for `暫停新房` vs `即將推出`.
- Exact placement of the cross-game entry surface and the invite-link CTA details.

## Deferred Ideas

- Full gameplay implementation of every candidate title may spill beyond Phase 3 even if the hub framework prepares their slots now.
- Guest-to-account merge hardening beyond the initial "sync this match" contract may need later dedicated follow-up.
