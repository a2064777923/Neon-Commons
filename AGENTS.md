<!-- GSD:project-start source:PROJECT.md -->
## Project

Hong's Neon-Commons is a browser-based real-time party arcade with live Dou Dizhu, Werewolf, Avalon, Gomoku, and Chinese Checkers rooms plus admin tooling. Treat the current shipped gameplay and admin surface as the baseline, and focus new work on expanding gameplay and backend/admin capability without regressing the separated frontend/backend architecture.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

- Frontend: Next.js 15 (pages router) + React 18
- Backend: Node.js HTTP server in `backend/server.js` with `backend/router.js` and `backend/handlers/*`
- Realtime: Socket.IO on the dedicated backend, Socket.IO client in the frontend
- Persistence: PostgreSQL via `lib/db`
- Styling: CSS modules and `styles/globals.css`
- Tests: `npm run check`, `node --test test-logic/backend-contract.test.js test-logic/client-network-contract.test.js`, `npm run test:logic`, `npx playwright test tests/room-ui.spec.js --workers=1`
- Runtime split: same repo, frontend on `3100`, backend on `3101`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

- Preserve the frontend/backend split. New backend features should land in `backend/handlers/*` or shared backend modules, not new `pages/api` endpoints.
- Keep REST and socket access flowing through shared frontend client/config paths instead of ad hoc per-page URLs.
- Treat `backend/server.js` as the owner of `/api/*` and `/socket.io/*`; deployments and docs should continue proxying both paths to the backend port instead of routing them through Next.js.
- Protect shipped room-number join flow, unified hub entry, and live Socket.IO room behavior across all game families.
- Prefer incremental expansion over re-platforming. This repo is brownfield and existing behavior is the compatibility target.
- Run the smallest relevant verification for each change, and escalate to `npm run check`, the backend/client contract node tests, and the room smoke test before shipping runtime-contract changes.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

- `pages/`, `components/`, and `lib/` contain the Next.js frontend and shared browser/server helpers.
- `backend/server.js` boots the dedicated API and Socket.IO service; `backend/router.js` dispatches file-based handlers from `backend/handlers/`.
- PostgreSQL stores persistent user, template, config, and result data; active room state is still single-node and memory-resident.
- Voice for party rooms stays browser `getUserMedia` + WebRTC with Socket.IO signaling.
- This milestone's planning focus is Phase 1: Backend Contract Foundation, which hardens the service boundary before more game/admin expansion.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `$gsd-quick` for small fixes and doc updates
- `$gsd-debug` for investigation and bug fixing
- `$gsd-plan-phase 1` to plan the current roadmap focus
- `$gsd-execute-phase` for approved phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `$gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` — do not edit manually.
<!-- GSD:profile-end -->
