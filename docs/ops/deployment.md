# 部署手冊

## Runtime Contract

此專案是 split runtime，不是單一 Next.js 進程：

- Frontend：Next.js，默認對外 `3100`
- Backend：`backend/server.js`，默認對外 `3101`
- Backend 擁有 `/api/*` 與 `/socket.io/*`
- PostgreSQL：持久化資料
- Redis：目前保留給後續擴展

若部署在反向代理之後，必須把：

- `/` 導向 `3100`
- `/api` 導向 `3101`
- `/socket.io` 導向 `3101`

## Canonical Operator Commands

Phase 6 之後，釋出前檢查以這三條命令為準：

```bash
npm run deploy:3100
npm run verify:release
npm run verify:release -- --skip-deploy
```

語義如下：

- `npm run deploy:3100`
  重新建置並重啟 Docker `app` 服務，然後等待 `http://127.0.0.1:3100/login` 與 `http://127.0.0.1:3101/api/hub` ready。
- `npm run verify:release`
  預設先執行 canonical `3100` redeploy，之後依序跑 `npm run check`、`npm run test:logic:critical`、`npm run test:ui:critical`。
- `npm run verify:release -- --skip-deploy`
  用於剛 redeploy 過後的文件校對或重跑，不再第二次重建容器，但仍會做 readiness 檢查。

若只是單獨調查某一層回歸，可使用：

```bash
npm run check
npm run test:logic:critical
FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical
```

## 重要環境變數

| 變數 | 用途 |
| --- | --- |
| `APP_URL` | backend CORS 所信任的 frontend public origin |
| `FRONTEND_PORT` | frontend 監聽端口，默認 `3100` |
| `BACKEND_PORT` | backend 監聽端口，默認 `3101` |
| `PORT` | backend 實際 listen 端口，通常等於 `BACKEND_PORT` |
| `NEXT_PUBLIC_API_BASE_URL` | 顯式指定瀏覽器 REST 目標；同源反代可留空 |
| `NEXT_PUBLIC_BACKEND_URL` | `NEXT_PUBLIC_API_BASE_URL` 的 legacy alias |
| `NEXT_PUBLIC_SOCKET_URL` | 顯式指定瀏覽器 Socket.IO 目標；未設時跟隨 API origin |
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `JWT_SECRET` | JWT cookie 簽章密鑰 |
| `RELEASE_READY_TIMEOUT_MS` | `verify-release.js` readiness 等待毫秒數，默認 `90000` |

## 本地開發

```bash
cp .env.example .env
npm install
npm run dev
```

默認入口：

- Frontend：`http://127.0.0.1:3100`
- Backend：`http://127.0.0.1:3101`

在 split-port 本地模式下：

- backend 以 `APP_URL` 決定允許的 frontend origin
- frontend 透過 `lib/client/network-runtime.js` 自動把 `3100` 映射到 `3101`
- 若要指向非默認地址，可顯式設置 `NEXT_PUBLIC_API_BASE_URL` 與 `NEXT_PUBLIC_SOCKET_URL`

## Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

Compose 對外端口：

- App frontend：`3100`
- App backend：`3101`
- PostgreSQL：服務名 `postgres`
- Redis：服務名 `redis`

若你剛更新了程式碼而要驗證 shipped surface，不要只跑舊容器上的 Playwright；請先：

```bash
npm run deploy:3100
```

## 建議的釋出流程

```bash
npm run verify:release
```

這是目前唯一推薦的 pre-ship 指令，因為它會：

1. 先刷新 canonical `3100/3101` Docker runtime
2. 明確等待 frontend 與 backend ready
3. 跑結構檢查
4. 跑 critical node suite
5. 跑 critical Playwright suite

只有在你已經剛執行過 `deploy:3100`、只是要重跑文件或測試時，才改用：

```bash
npm run verify:release -- --skip-deploy
```

## Same-Origin Reverse Proxy

Nginx / Traefik / Caddy 之類的代理建議目標：

- `/` -> `http://127.0.0.1:3100`
- `/api` -> `http://127.0.0.1:3101`
- `/socket.io` -> `http://127.0.0.1:3101`

在這種部署下推薦：

- `APP_URL` 設成外部網站 origin，例如 `https://play.example.com`
- `NEXT_PUBLIC_API_BASE_URL` 留空
- `NEXT_PUBLIC_SOCKET_URL` 留空

參考基礎配置：`nginx/doudezhu.conf`

## 語音與房間狀態說明

- 房內語音使用瀏覽器 `getUserMedia` + WebRTC
- Socket.IO 只負責 `voice:*` 信令
- 活躍房間狀態仍是單節點記憶體模型
- 若未來要支援跨節點恢復，屬於後續里程碑範圍，不在目前 release hardening 內

## 備份

- PostgreSQL volume：`docker-data/postgres`
- Redis volume：`docker-data/redis`
