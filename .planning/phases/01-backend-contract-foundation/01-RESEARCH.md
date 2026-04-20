# Phase 1: Backend Contract Foundation - Research

**Researched:** 2026-04-20
**Domain:** Split-runtime contract hardening for a Next.js frontend and dedicated Node.js + Socket.IO backend
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

No user constraints - all decisions at the agent's discretion.

Derived project constraints from `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, and `AGENTS.md`:
- Keep `Next.js 15 + React 18` on the frontend and the dedicated `backend/server.js` runtime on the backend.
- Do not reintroduce `pages/api`; backend feature work must stay under `backend/handlers/*` or shared backend modules.
- Preserve existing account flows, room-number join behavior, admin console behavior, and live Socket.IO room updates.
- Keep the current single-node in-memory room model; this phase is about contract clarity, not distributed state.
- Update planning and deployment docs so later game/admin phases inherit the real split-runtime model instead of stale monolith assumptions.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| REST route ownership and auth boundaries | API/Backend | Database/Storage | Route shape, verbs, and auth gates are enforced in `backend/router.js`, `backend/handlers/*`, and `lib/auth.js`. |
| Browser API and Socket.IO entry resolution | Browser/Client | Frontend Server | Pages and shared client helpers decide which origin/path to call, while the frontend runtime or reverse proxy may forward traffic. |
| Socket event naming and payload contracts | API/Backend | Browser/Client | `lib/socket-server.js` is the source of truth for event registration, but room pages must consume the same event names and payload keys. |
| Split-runtime deployment and proxy behavior | Frontend Server | API/Backend | Frontend/backed ports, reverse-proxy routing, and public origin rules must be documented at the runtime boundary. |
| Contract verification and regression tests | Browser/Client | API/Backend | Contract drift shows up in both backend route coverage and frontend call sites, so tests need to span both sides. |
</architectural_responsibility_map>

<research_summary>
## Summary

Phase 1 is not a greenfield architecture exercise. The split runtime already exists in production shape: `backend/server.js` boots a dedicated Node.js API + Socket.IO process, `backend/router.js` maps `backend/handlers/**` to `/api/*`, and the frontend already calls backend URLs through `lib/client/api.js`. The main gap is not "make a backend" but "make the backend contract explicit enough that later feature work cannot silently drift."

The code shows three concrete issues. First, there is no explicit shared route or socket contract; the backend, frontend pages, and tests all know paths/event names independently. Second, the frontend runtime helper still hardcodes `http://127.0.0.1:3101` as the default backend origin, while at least one browser smoke test still assumes same-origin `/api/*` access. Third, the internal codebase map under `.planning/codebase/` still describes the old `pages/api` + `server.js` monolith shape, which would mislead future planning.

**Primary recommendation:** Introduce a shared network-contract module plus backend handler metadata, then normalize all frontend REST/socket entry points and refresh docs/tests around that contract.
</research_summary>

<current_state_audit>
## Current State Audit

### What is already working

- The backend is already separated into `backend/server.js`, `backend/router.js`, and `backend/handlers/**`.
- The router derives `/api/*` paths from handler file layout, so the backend boundary is already file-scoped.
- Frontend pages and `components/SiteLayout.js` mostly use `lib/client/api.js` and `getSocketUrl()`, so there is already one shared network helper.
- Public docs in `README.md`, `docs/architecture/system-architecture.md`, `docs/api/api-reference.md`, and `docs/ops/deployment.md` already acknowledge the split runtime.

### Gaps that block safe expansion

- There is no shared contract inventory for route paths, allowed methods, auth level, or socket event names.
- Backend handlers duplicate method/auth/body assumptions independently, which makes route-family drift hard to catch before runtime.
- `rg` finds 41 inline `/api/*` literals across pages, components, and tests, plus repeated socket event literals across the room pages and `lib/socket-server.js`.
- `tests/room-ui.spec.js` still uses browser `fetch("/api/rooms")`, which assumes a same-origin proxy even though the app pages currently default to an explicit backend origin.
- `lib/client/api.js` hardcodes `http://127.0.0.1:3101` as the fallback backend origin, which is convenient locally but brittle for proxied or alternate-host deployments.
- `.planning/codebase/ARCHITECTURE.md` and `.planning/codebase/STRUCTURE.md` still describe `pages/api/**` and root `server.js`, so the planning map is stale.
</current_state_audit>

<recommended_direction>
## Recommended Direction

### 1. Make the network contract explicit and shared

Create a shared module such as `lib/shared/network-contract.js` that names:
- REST endpoint builders for auth, me/profile, card rooms, party rooms, board rooms, leaderboard, templates, and admin families
- Socket event groups for room, party, board, and voice flows
- Optional metadata keys that backend tests can use to verify coverage

This file should become the source of truth consumed by backend tests first and frontend callers second.

### 2. Add explicit backend contract metadata

Each `backend/handlers/**/*.js` file should declare explicit contract metadata:
- allowed methods
- auth level (`public`, `user`, `admin`)
- route family or contract key

`backend/router.js` should surface this metadata in `router.routes` so regression tests can fail if a handler is missing metadata or if a shared contract path no longer maps to a handler.

### 3. Normalize frontend runtime resolution instead of scattering path rules

`lib/client/api.js` should own:
- backend origin resolution
- same-origin vs explicit-origin fallback behavior
- route builders or route imports from the shared contract module
- Socket.IO URL/path resolution
- JSON fetch helpers for the common "fetch + response.json()" pattern

Frontend pages, layout components, and browser tests should stop hardcoding `/api/*` strings or socket event names directly when a shared helper already exists.

### 4. Refresh human and planning docs together

Public docs should describe:
- which process owns `/api/*` and `/socket.io/*`
- when reverse-proxy same-origin routing is expected
- which env vars control frontend/backend origin resolution
- how local dev differs from proxied production

Planning docs under `.planning/codebase/` should be refreshed in the same phase so later planning commands stop inheriting the old monolith description.
</recommended_direction>

## Validation Architecture

### Fast feedback

- `npm run check`
- `node --test test-logic/backend-contract.test.js`
- `node --test test-logic/client-network-contract.test.js`

### Wave-level validation

- `npm run test:logic`

### High-risk smoke validation

- `npx playwright test tests/room-ui.spec.js --workers=1`

### Expected artifacts

- Backend contract regression test covering route inventory and handler metadata
- Frontend network helper regression test covering origin resolution and route builders
- Updated docs that reference `backend/server.js`, `backend/handlers/*`, `lib/client/api.js`, and the split 3100/3101 runtime

## Open Questions

1. **Should the browser default to same-origin `/api` when no explicit public backend URL is configured?**
   - What we know: Nginx deployment docs already recommend proxying `/api` and `/socket.io` to `3101`, but local development currently favors explicit `3101` URLs.
   - What's unclear: whether the team wants browser traffic to prefer proxy mode by default or explicit backend URLs by default.
   - Recommendation: plan for a helper that supports both, with explicit env overrides and tests for each branch.

2. **How far should handler metadata go in Phase 1?**
   - What we know: methods, auth level, and route family are enough to make the contract explicit and testable.
   - What's unclear: whether payload schemas should also be encoded now.
   - Recommendation: stop at method/auth/route metadata in Phase 1; reserve payload schema work for later backend/admin phases unless tests show immediate need.

<sources>
## Sources

### Primary (HIGH confidence)
- `backend/server.js` - backend process entry and CORS/origin rules
- `backend/router.js` - file-to-route mapping and request parsing
- `backend/handlers/**` - live REST surface
- `lib/socket-server.js` - live socket surface
- `lib/client/api.js` - frontend network entry helper
- `pages/**`, `components/SiteLayout.js`, `tests/room-ui.spec.js` - current consumers of the contract
- `README.md`, `docs/architecture/system-architecture.md`, `docs/api/api-reference.md`, `docs/ops/deployment.md` - current human-facing docs
- `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md`, `.planning/codebase/STACK.md` - stale planning artifacts that need refresh

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `AGENTS.md` - planning and constraint context
</sources>
