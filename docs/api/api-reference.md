# API 參考

## Contract 邊界

- `/api/*` 由 `backend/server.js` 提供，並透過 `backend/router.js` 分派到 `backend/handlers/**`
- `/socket.io/*` 由同一個 backend process 提供，不走 Next.js `pages/api`
- 前端頁面應透過 `lib/client/api.js` 的 `API_ROUTES`、`apiFetch()`、`getSocketUrl()` 呼叫這些接口
- HTTP 與 Socket 共用 `ddz_token` JWT cookie；前端 fetch 需帶 `credentials: "include"`

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

### Public Data

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
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

`/api/party/rooms` 目前使用 `gameKey=werewolf|avalon` 區分家族。

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/party/rooms?gameKey=werewolf|avalon` | `GET` | public | 派對房列表 |
| `/api/party/rooms?gameKey=werewolf|avalon` | `POST` | user | 建立派對房 |
| `/api/party/rooms/:roomNo` | `GET` | public | 讀取派對房詳情 |
| `/api/party/rooms/:roomNo/join` | `POST` | user | 加入派對房 |

### Board Room Family

`/api/board/rooms` 目前使用 `gameKey=gomoku|chinesecheckers` 區分棋類。

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/board/rooms?gameKey=gomoku|chinesecheckers` | `GET` | public | 棋類房列表 |
| `/api/board/rooms?gameKey=gomoku|chinesecheckers` | `POST` | user | 建立棋類房 |
| `/api/board/rooms/:roomNo` | `GET` | public | 讀取棋類房詳情 |
| `/api/board/rooms/:roomNo/join` | `POST` | user | 加入棋類房 |

### Admin Family

| 路徑 | 方法 | Auth | 說明 |
| --- | --- | --- | --- |
| `/api/admin/players` | `GET` | admin | 玩家清單 |
| `/api/admin/players/:id/adjust` | `POST` | admin | 調整玩家狀態 / 資產 |
| `/api/admin/templates` | `GET`, `POST`, `PATCH` | admin | 讀寫模板與模板配置 |
| `/api/admin/config` | `GET`, `POST` | admin | 讀寫系統配置 |
| `/api/admin/capabilities` | `GET`, `PATCH` | admin | 依遊戲家族讀寫新房開關，僅影響後續新建房 |
| `/api/admin/runtime` | `GET`, `PATCH` | admin | 讀寫 allowlist 運行控制，如 `maxOpenRoomsPerUser` 與 `maintenanceMode` |
| `/api/admin/logs` | `GET` | admin | 讀取最近 50 筆後台留痕，按時間倒序 |

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

## 維護規則

- 新增或修改 REST 路徑時，同步更新 `lib/shared/network-contract.js`
- 新增或修改 Socket event 時，同步更新 `lib/shared/network-contract.js`
- 不新增 `pages/api/**` 作為旁路契約
