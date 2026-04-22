# Milestones

## v1.1 Live Ops & Reliability (Shipped: 2026-04-23)

**Phases completed:** 4 phases, 9 plans, 18 tasks

**Key accomplishments:**

- Session refresh/reconnect and guest rejoin now recover across the shipped room families with host-visible presence states.
- Single-node restart behavior now preserves honest room discovery through snapshot persistence, stale-room expiry, and explicit `snapshot-only` availability.
- The admin surface now exposes live-room directory, room detail, drain, close, and occupant-removal workflows with audit coverage.
- The canonical release gate now proves live-ops and recovery behavior on the deployed `3100/3101` stack, with targeted rerun helpers for diagnosis.
- Operator docs, roadmap status, and milestone state now align with the actual v1.1 delivery story.

**Known deferred items at close:** 0 open artifacts from `audit-open`; scale, voice, and future content follow-ups remain tracked in `STATE.md` and `PROJECT.md`.

**Archives:**

- [v1.1 roadmap](./milestones/v1.1-ROADMAP.md)
- [v1.1 requirements](./milestones/v1.1-REQUIREMENTS.md)

---

## v1.0 milestone (Shipped: 2026-04-22)

**Phases completed:** 7 phases, 21 plans, 50 tasks

**Key accomplishments:**

- Split runtime contract hardened across backend handlers, shared client runtime, and architecture docs.
- Admin capability toggles, runtime controls, and audit-log surfaces shipped through explicit handlers and console workflows.
- Unified hub discovery, room-entry resolution, invite links, and guest-entry claims shipped across supported families.
- Wave 1 titles shipped on top of the shared platform model: Sokoban, Reversi, and Undercover.
- Card, party, and board gameplay expansion landed without regressing the shared room framework.
- Canonical release verification now runs through `deploy:3100`, `test:logic:critical`, `test:ui:critical`, and `verify:release`.

**Known deferred items at close:** 0 open artifacts from `audit-open`; platform deferrals remain tracked in `STATE.md` and `PROJECT.md`.

**Archives:**

- [v1.0 roadmap](./milestones/v1.0-ROADMAP.md)
- [v1.0 requirements](./milestones/v1.0-REQUIREMENTS.md)

---
