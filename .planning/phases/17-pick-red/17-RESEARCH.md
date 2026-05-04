---
phase: 17
phase_name: "Pick Red (撿紅點)"
generated: "2026-05-04"
type: research
---

# Phase 17 Research: Pick Red (撿紅點)

## Key Findings

- **Zero new dependencies.** Pick Red uses the existing card family pattern with pure-JS game logic.
- **Reuse `lib/game/cards.js`** for deck creation. Filter jokers, add `value` property for ten-sum matching (face cards = 10).
- **New room manager** at `lib/card/pickred-manager.js` following the BoardRoomManager pattern.
- **Card family** (`familyKey: "card"`) — keeps it simple alongside Dou Dizhu.
- **Socket events:** New `pickred:` namespace to avoid polluting the Dou Dizhu socket handling.
- **API routes:** New `/api/pickred/rooms/*` endpoints.
- **Frontend:** New `pages/pickred/[roomNo].js` game room. Lobby uses existing `/pages/games/[gameKey].js`. Entry uses existing `/pages/entry/[gameKey]/[roomNo].js`.
- **Hub auto-discovers** new catalog entries — no changes to hub.js needed.
- **Recovery** copies patterns from board manager (markSeatReconnecting/Connected, reconnect grace, serializeRoom).

## Open Questions Resolved

1. **Deck:** Standard 52-card deck, no jokers.
2. **Scoring:** Count red-card points in collected pile. No bonus multipliers.
3. **Bot:** Casual/random level for v1.
4. **Multi-round:** Single-round for v1.
5. **Card family:** Yes, use `card` family.
6. **Template:** Hardcode settings (simpler than Dou Dizhu).
7. **Settlement:** Use `buildStandardSettlements()` from economy module.

## Files to Create

| File | Purpose |
|------|---------|
| `lib/card/pickred-manager.js` | Room manager (core game logic) |
| `lib/card/pickred-cards.js` | Card values and matching logic |
| `backend/handlers/pickred/rooms/index.js` | List + Create API |
| `backend/handlers/pickred/rooms/[roomNo]/index.js` | Detail API |
| `backend/handlers/pickred/rooms/[roomNo]/join.js` | Join API |
| `pages/pickred/[roomNo].js` | Game room UI |
| `styles/PickRedRoom.module.css` | Game room styles |

## Files to Modify

| File | Change |
|------|--------|
| `lib/games/catalog.js` | Add `pickred` entry, limits |
| `lib/shared/network-contract.js` | Add `pickredRooms` API patterns, `pickred` socket events |
| `lib/socket-server.js` | Register Pick Red socket handlers |
| `components/game-hub/GameIcon.js` | Add `pickred` SVG icon |
| `lib/admin/live-room-ops.js` | Register Pick Red manager |

## Card Values for Ten-Sum Matching

| Card | Value |
|------|-------|
| A | 1 |
| 2-9 | face value |
| 10, J, Q, K | 10 |

Matching rule: two cards whose values sum to 10. Valid pairs: A+9, 2+8, 3+7, 4+6, 5+5, and any two 10-value cards.

## Point Values (Red Suits Only)

| Red Card | Points |
|----------|--------|
| ♥/♦ A-9 | face value |
| ♥/♦ 10, J, Q, K | 10 each |

## Turn Flow

1. Deal 8 cards each, 4 face-up on table
2. Draw from deck OR pick up last discarded card
3. Match any hand card with table card summing to 10 → collect both
4. Discard one card to table
5. Round ends when deck exhausted
6. Highest red-card score wins
