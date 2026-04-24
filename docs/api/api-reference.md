# API 參考

## Contract 邊界

- `/api/*` 由 `backend/server.js` 提供，透過 `backend/router.js` 分派到 `backend/handlers/**`
- `/socket.io/*` 由同一個 backend process 提供，不走 Next.js `pages/api`
- frontend 頁面應透過 `lib/client/api.js` 的 `API_ROUTES`、`apiFetch()`、`getSocketUrl()` 呼叫這些接口
- 房號 deep link / guest flow 應透過 `lib/client/room-entry.js` 與 `/api/room-entry/*`
- HTTP 與 Socket 共用 `ddz_token` JWT cookie；frontend fetch 需帶 `credentials: "include"`

系統級邊界說明請搭配 [../architecture/backend-contract.md](../architecture/backend-contract.md) 一起看。

## REST Families

### Auth / Session

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/auth/register` | `POST` | public | 註冊帳號並建立登入 cookie |
| `/api/auth/login` | `POST` | public | 登入並建立登入 cookie |
| `/api/auth/logout` | `POST` | public | 清掉登入 cookie |
| `/api/me` | `GET` | public | 讀取目前登入使用者，未登入時回 `user: null` |
| `/api/profile` | `GET`, `PATCH` | user | 讀取或更新自己的個人資料 |

### Hub / Public Data

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/hub` | `GET` | public | 返回首頁 hub 的家族、遊戲卡、live 房與 launch metadata |
| `/api/leaderboard` | `GET` | public | 金幣榜 / 排行資料 |
| `/api/templates` | `GET` | public | 斗地主模板清單 |

### Card Room Family

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/rooms` | `GET` | public | 公開斗地主房列表 |
| `/api/rooms` | `POST` | user | 建立斗地主房 |
| `/api/rooms/:roomNo` | `GET` | public | 讀取房間詳情 |
| `/api/rooms/:roomNo/join` | `POST` | user | 加入指定房間 |

### Party Room Family

`/api/party/rooms` 透過 `gameKey=werewolf|avalon|undercover` 區分具體遊戲。

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/party/rooms?gameKey=...` | `GET` | public | 派對房列表 |
| `/api/party/rooms?gameKey=...` | `POST` | user | 建立派對房 |
| `/api/party/rooms/:roomNo` | `GET` | public | 讀取派對房詳情 |
| `/api/party/rooms/:roomNo/join` | `POST` | user | 加入派對房 |

### Board Room Family

`/api/board/rooms` 透過 `gameKey=gomoku|chinesecheckers|reversi` 區分具體遊戲。

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/board/rooms?gameKey=...` | `GET` | public | 棋類房列表 |
| `/api/board/rooms?gameKey=...` | `POST` | user | 建立棋類房 |
| `/api/board/rooms/:roomNo` | `GET` | public | 讀取棋類房詳情 |
| `/api/board/rooms/:roomNo/join` | `POST` | user | 加入棋類房 |

### Room Entry / Share Link Family

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/room-entry/resolve?roomNo=...` | `GET` | public | 把房號解析成具體家族、遊戲 key 與 detail route |
| `/api/room-entry/shareable` | `GET` | public | 返回分享所需的標準化 deep-link payload |
| `/api/room-entry/guest` | `POST` | public | 對符合條件的私密房簽發 guest entry |
| `/api/room-entry/guest-sync` | `POST` | public | 將 guest 對局結果綁回正式帳號 |

### Admin Family

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/admin/players` | `GET` | admin | 玩家清單 |
| `/api/admin/players/:id/adjust` | `POST` | admin | 調整玩家狀態 / 資產 |
| `/api/admin/templates` | `GET`, `POST`, `PATCH` | admin | 讀寫模板與模板配置 |
| `/api/admin/config` | `GET`, `POST` | admin | 讀寫系統配置 |
| `/api/admin/capabilities` | `GET`, `PATCH` | admin | 按遊戲家族讀寫新房開關，並管理每個標題的 rollout 狀態（`coming-soon` / `paused-new-rooms` / `playable`） |
| `/api/admin/runtime` | `GET`, `PATCH` | admin | 讀寫 allowlist runtime controls，並返回後端彙總的 `healthSnapshot`（入口、即時房況、派對語音、rollout） |
| `/api/admin/logs` | `GET` | admin | 讀取最近 50 筆後台留痕 |

Admin family contract 補充：

- `/api/admin/capabilities` `GET` 會返回 `families`、`rolloutFamilies`、`rolloutSummary`；`PATCH` 可同時接收 `updates` 與 `rolloutUpdates`
- `/api/admin/runtime` `GET` / `PATCH` 都會返回 `controls`、`availabilityControls`、`availabilityControlList`，以及後端計算的 `healthSnapshot`
- admin live-room drill-down 會額外暴露 operator-safe `voiceDiagnostics`，只提供 mode、runtime state、時間戳與安全操作，不暴露 ICE/TURN 祕密

## Socket Event Families

### Card room (`room:*`, `game:*`)

- client -> server：`room:subscribe`、`room:ready`、`room:add-bot`、`game:bid`、`game:play`、`game:pass`、`game:trustee`、`room:chat`
- server -> client：`room:update`、`room:error`

### Party room (`party:*`)

- client -> server：`party:subscribe`、`party:ready`、`party:add-bot`、`party:message`、`party:action`
- server -> client：`party:update`、`party:error`

### Board room (`board:*`)

- client -> server：`board:subscribe`、`board:ready`、`board:add-bot`、`board:move`
- server -> client：`board:update`、`board:error`

### Voice (`voice:*`)

- client -> server：`voice:join`、`voice:leave`、`voice:state`、`voice:signal`
- server -> client：`voice:peers`、`voice:user-joined`、`voice:user-left`

## Release Verification Touchpoints

目前 release gate 直接覆蓋這些關鍵 contract 面：

- `npm run test:logic:critical`
  驗證 backend contract、CORS、client runtime contract、admin control plane、hub / room-entry、卡牌 / 派對 / 棋類 / solo 主要邏輯
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`
  驗證 hub、admin、斗地主、狼人殺、阿瓦隆、五子棋、中國跳棋、黑白棋、推箱子、誰是臥底的 shipped browser flows
- `npm run verify:release`
  預設先刷新 `3100/3101` Docker runtime，再執行上述 critical suites

## 維護規則

- 新增或修改 REST 路徑時，同步更新 `lib/shared/network-contract.js`
- 新增或修改 Socket event 時，同步更新 `lib/shared/network-contract.js`
- 不新增 `pages/api/**` 作為旁路契約
- 調整 shipped surface 後，需同步刷新：
  - `docs/overview/project-overview.md`
  - `docs/architecture/backend-contract.md`
  - `docs/ops/deployment.md`
  - `.planning/REQUIREMENTS.md`
