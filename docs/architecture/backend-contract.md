# Backend Contract Boundary

這份文件是 split runtime 的 source of truth，描述：

- 哪個進程擁有 `/api/*` 與 `/socket.io/*`
- 瀏覽器端如何解析 API / Socket 目標
- 哪些 backend route families 屬於當前 shipped contract
- canonical release verification 如何對 `3100/3101` runtime 生效

## 1. Runtime Ownership

### Frontend process

- 入口：Next.js pages router
- 主要檔案：`pages/**`、`components/**`、`styles/**`
- 默認端口：`3100`
- 職責：頁面渲染、瀏覽器狀態、靜態資產、UI 互動

### Backend process

- 入口：`backend/server.js`
- 路由器：`backend/router.js`
- REST handlers：`backend/handlers/**`
- Socket handlers：`lib/socket-server.js`
- 默認端口：`3101`
- 職責：`/api/*` JSON 介面、`/socket.io/*` 連線、JWT cookie 驗證、房間同步、語音信令

`backend/router.js` 會掃描 `backend/handlers/**` 並自動把檔案映射成 `/api/*` 路徑。`/socket.io/*` 不經 router，會在入口直接跳過，交由 Socket.IO server 處理。

## 2. Frontend Contract Entry Points

所有瀏覽器端 REST / Socket 訪問都應透過共享 client helper，而不是頁面自行拼 URL：

- `lib/client/api.js`
  - re-export `API_ROUTES`
  - re-export `SOCKET_EVENTS`
  - re-export `apiFetch`、`apiFetchJson`
  - re-export `getApiBaseUrl()`、`getSocketUrl()`
- `lib/client/network-runtime.js`
  - 讀取 `NEXT_PUBLIC_API_BASE_URL`
  - 支援 `NEXT_PUBLIC_BACKEND_URL` 作為 legacy alias
  - 讀取 `NEXT_PUBLIC_SOCKET_URL`
  - 若頁面 origin 是 `localhost:3100` 或 `127.0.0.1:3100`，自動映射到 backend `3101`
  - 若部署採同源反代，則沿用當前網站 origin
- `lib/client/room-entry.js`
  - 管理邀請連結與 guest claim 暫存，而不是各頁自己處理 deep-link 細節

## 3. Current Route Families

所有 REST 路由都走：

`backend/server.js -> backend/router.js -> backend/handlers/**`

| 家族 | 路徑 | 方法 | Auth |
| --- | --- | --- | --- |
| Auth | `/api/auth/register` | `POST` | public |
| Auth | `/api/auth/login` | `POST` | public |
| Auth | `/api/auth/logout` | `POST` | public |
| Session | `/api/me` | `GET` | public |
| Profile | `/api/profile` | `GET`, `PATCH` | user |
| Hub | `/api/hub` | `GET` | public |
| Public data | `/api/leaderboard` | `GET` | public |
| Public data | `/api/templates` | `GET` | public |
| Card rooms | `/api/rooms` | `GET`, `POST` | public / user |
| Card rooms | `/api/rooms/:roomNo` | `GET` | public |
| Card rooms | `/api/rooms/:roomNo/join` | `POST` | user |
| Party rooms | `/api/party/rooms?gameKey=werewolf|avalon|undercover` | `GET`, `POST` | public / user |
| Party rooms | `/api/party/rooms/:roomNo` | `GET` | public |
| Party rooms | `/api/party/rooms/:roomNo/join` | `POST` | user |
| Board rooms | `/api/board/rooms?gameKey=gomoku|chinesecheckers|reversi` | `GET`, `POST` | public / user |
| Board rooms | `/api/board/rooms/:roomNo` | `GET` | public |
| Board rooms | `/api/board/rooms/:roomNo/join` | `POST` | user |
| Room entry | `/api/room-entry/resolve` | `GET` | public |
| Room entry | `/api/room-entry/shareable` | `GET` | public |
| Room entry | `/api/room-entry/guest` | `POST` | public |
| Room entry | `/api/room-entry/guest-sync` | `POST` | public |
| Admin | `/api/admin/players` | `GET` | admin |
| Admin | `/api/admin/players/:id/adjust` | `POST` | admin |
| Admin | `/api/admin/templates` | `GET`, `POST`, `PATCH` | admin |
| Admin | `/api/admin/config` | `GET`, `POST` | admin |
| Admin | `/api/admin/capabilities` | `GET`, `PATCH` | admin |
| Admin | `/api/admin/runtime` | `GET`, `PATCH` | admin |
| Admin | `/api/admin/logs` | `GET` | admin |

新增 handler 時，必須同步更新 `lib/shared/network-contract.js`，讓 `API_ROUTES`、handler contract metadata、前端呼叫端保持一致。

## 4. Socket.IO Ownership

Socket 由 `backend/server.js` 建立的 Socket.IO server 接手，事件綁定在 `lib/socket-server.js`。

### Card room family

- client -> server：`room:subscribe`、`room:ready`、`room:add-bot`、`game:bid`、`game:play`、`game:pass`、`game:trustee`、`room:chat`
- server -> client：`room:update`、`room:error`

### Party room family

- client -> server：`party:subscribe`、`party:ready`、`party:add-bot`、`party:message`、`party:action`
- server -> client：`party:update`、`party:error`

### Board room family

- client -> server：`board:subscribe`、`board:ready`、`board:add-bot`、`board:move`
- server -> client：`board:update`、`board:error`

### Voice family

- client -> server：`voice:join`、`voice:leave`、`voice:state`、`voice:signal`
- server -> client：`voice:peers`、`voice:user-joined`、`voice:user-left`

## 5. Auth Cookie Flow

HTTP 與 Socket 共用 `ddz_token` JWT cookie：

1. 使用者經由 `/api/auth/login` 或 `/api/auth/register` 建立登入狀態
2. backend 設置 `ddz_token` cookie
3. frontend fetch 一律帶 `credentials: "include"`
4. Socket.IO middleware 從握手 cookie 讀取 `ddz_token`
5. 驗證成功後，把 `socket.user` 掛到連線上供各 room manager 使用

若 cookie 缺失或失效：

- REST handler 回 `401`
- Socket middleware 回未登入或登入失效錯誤

## 6. Deployment and Verification Boundary

### Local split-port development

- Frontend origin：`http://127.0.0.1:3100`
- Backend origin：`http://127.0.0.1:3101`
- `APP_URL`：backend CORS 所信任的 frontend origin
- `NEXT_PUBLIC_API_BASE_URL`：可顯式指定 REST 目標
- `NEXT_PUBLIC_SOCKET_URL`：可顯式指定 Socket 目標

本地 `3100 -> 3101` 的默認映射由 `lib/client/network-runtime.js` 處理。

### Same-origin proxy deployment

若外部只暴露一個網站 origin，建議：

- `/` 代理到 `3100`
- `/api` 代理到 `3101`
- `/socket.io` 代理到 `3101`
- `APP_URL` 設成對外 frontend origin
- `NEXT_PUBLIC_API_BASE_URL` 與 `NEXT_PUBLIC_SOCKET_URL` 留空

### Canonical release contract

Phase 6 之後，以 deployed runtime 為準：

```bash
npm run deploy:3100
npm run verify:release
```

`verify:release` 預設會再次刷新 `3100/3101`，之後等待：

- `http://127.0.0.1:3100/login`
- `http://127.0.0.1:3101/api/hub`

ready，再執行：

- `npm run check`
- `npm run test:logic:critical`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`

這條 release gate 驗證的是 deployed stack，不是隨手啟的臨時 debug port。

## 7. Extension Rules

- 新 REST 能力：加在 `backend/handlers/**`，不要回到 `pages/api/**`
- 新 socket 事件：更新 `lib/shared/network-contract.js`，再更新 `lib/socket-server.js` 與前端呼叫端
- 新前端資料請求：走 `lib/client/api.js` 的 `API_ROUTES` / `apiFetch`
- 調整部署或 public origin 規則時，需同步刷新：
  - `docs/ops/deployment.md`
  - `docs/api/api-reference.md`
  - `docs/overview/project-overview.md`
  - `.planning/REQUIREMENTS.md`
