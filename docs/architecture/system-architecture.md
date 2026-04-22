# 系統架構

## Split Runtime 總覽

Hong's Neon-Commons 目前採用同倉前後端分離：

- `frontend`：Next.js 頁面、靜態資產與瀏覽器端 React，默認 `3100`
- `backend`：`backend/server.js` 啟動的 Node.js HTTP + Socket.IO 服務，默認 `3101`
- `postgres`：玩家、模板、配置、戰績等持久化資料
- `redis`：目前僅保留部署位，尚未進入主執行路徑

更細的接口邊界請看 [backend-contract.md](./backend-contract.md)。這份文件只保留系統級視角。

## 進程與所有權

| 邊界 | 擁有者 | 說明 |
| --- | --- | --- |
| `/`、`/login`、`/lobby`、`/games/*`、`/room/*`、`/party/*`、`/board/*` | Next.js frontend | UI 路由、頁面渲染與靜態資產 |
| `/api/*` | `backend/server.js` + `backend/router.js` | 後端 REST 契約入口；實作位於 `backend/handlers/**` |
| `/socket.io/*` | `backend/server.js` + `lib/socket-server.js` | 房間同步與語音信令入口 |
| 瀏覽器端 API / Socket URL 決策 | `lib/client/network-runtime.js` | 根據 `NEXT_PUBLIC_*` 變數、當前 origin 與本地 split-port 規則決定目標後端 |

## 主要模塊

- `backend/server.js`：啟動後端 HTTP 服務、套用 CORS、掛載 Socket.IO、初始化資料庫
- `backend/router.js`：從 `backend/handlers/**` 掃描檔案並映射成 `/api/*` 路由
- `backend/handlers/**`：認證、房間、排行榜、後台等 REST handler 家族
- `lib/socket-server.js`：卡牌房、派對房、棋類房與語音事件的 Socket.IO 綁定
- `lib/client/api.js`：前端共用入口，向頁面 re-export `API_ROUTES`、`SOCKET_EVENTS`、`apiFetch`
- `lib/client/network-runtime.js`：處理同源代理、`3100 -> 3101` 本地分流、`NEXT_PUBLIC_*` 覆寫
- `lib/shared/network-contract.js`：共用 REST 路徑模式、route builder、socket event 常數
- `lib/game/room-manager.js` / `lib/party/manager.js` / `lib/board/manager.js`：各遊戲家族的單機即時房間狀態

## 請求與資料流

### 頁面 / REST 流程

1. 瀏覽器載入 `pages/**` 頁面。
2. 頁面經由 `lib/client/api.js` 呼叫 `apiFetch`、`API_ROUTES`。
3. `lib/client/network-runtime.js` 解析目標後端：
   - 若設定 `NEXT_PUBLIC_API_BASE_URL`，優先使用該值
   - 若前端 origin 是 `http://127.0.0.1:3100` 或 `http://localhost:3100`，自動改打 `3101`
   - 若採同源反代，則沿用當前網站 origin
4. `backend/router.js` 將 `/api/*` 請求分派到 `backend/handlers/**`。
5. handler 讀寫 PostgreSQL、調用 room manager 或回傳 JSON。

### 即時房間 / 語音流程

1. 房間頁透過 `getSocketUrl()` 連到 `/socket.io/*`。
2. `lib/socket-server.js` 讀取 `ddz_token` cookie，驗證 JWT。
3. 根據事件家族把 socket 綁到對應 manager：
   - `room:*` / `game:*`：斗地主
   - `party:*` / `voice:*`：狼人殺、阿瓦隆、房內語音
   - `board:*`：五子棋、跳棋
4. manager 在記憶體內更新房間狀態並廣播 `*:update` / `*:error` 事件。

## 單機前提

- 活躍房間、定時器與對局狀態仍保存在單節點記憶體
- PostgreSQL 只保存帳號、模板、配置與結果資料，不負責恢復活躍房間
- 瀏覽器語音仍是 `getUserMedia` + WebRTC，Socket.IO 只負責信令
- 反向代理部署時，必須把 `/api` 與 `/socket.io` 一起導向 `3101`

## 延伸規則

- 新後端功能落在 `backend/handlers/**` 或共用後端模組，不新增 `pages/api/**`
- 新前端 API / socket 使用者應走 `lib/client/api.js` / `lib/client/network-runtime.js`
- 若調整 route 或 socket 契約，需同步更新 `lib/shared/network-contract.js` 與相關文檔
