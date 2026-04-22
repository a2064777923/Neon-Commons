# 部署手冊

## Runtime Contract

此專案不是單進程 monolith，而是同倉 split runtime：

- Frontend：Next.js，默認 `3100`
- Backend：`backend/server.js` 提供 `/api/*` 與 `/socket.io/*`，默認 `3101`
- PostgreSQL：持久化資料
- Redis：保留未來擴展使用

若部署在反向代理後方，務必把 `/api` 與 `/socket.io` 一起導向 `3101`，其餘頁面導向 `3100`。

## 重要環境變數

| 變數 | 用途 |
| --- | --- |
| `APP_URL` | backend CORS 所信任的前端 public origin |
| `FRONTEND_PORT` | frontend 監聽端口，默認 `3100` |
| `BACKEND_PORT` | backend 監聽端口，默認 `3101` |
| `PORT` | backend 實際 listen 端口，通常與 `BACKEND_PORT` 相同 |
| `NEXT_PUBLIC_API_BASE_URL` | 顯式指定瀏覽器 REST 目標；同源反代可留空 |
| `NEXT_PUBLIC_BACKEND_URL` | `NEXT_PUBLIC_API_BASE_URL` 的 legacy alias |
| `NEXT_PUBLIC_SOCKET_URL` | 顯式指定瀏覽器 Socket.IO 目標；未設時跟隨 API origin |
| `DATABASE_URL` | PostgreSQL 連線字串 |
| `JWT_SECRET` | JWT cookie 簽章密鑰 |

## 開發模式

```bash
cp .env.example .env
npm install
npm run dev
```

預設開發入口：

- Frontend: `http://127.0.0.1:3100`
- Backend: `http://127.0.0.1:3101`

在本地 split-port 模式下：

- backend 用 `APP_URL` 控制 CORS 允許的 frontend origin
- frontend 會由 `lib/client/network-runtime.js` 自動把 `3100` 轉到 `3101`
- 若你要改成非默認地址，可顯式設置 `NEXT_PUBLIC_API_BASE_URL` 與 `NEXT_PUBLIC_SOCKET_URL`

## Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

Compose 內部服務：

- Frontend: `3100`
- Backend: `3101`
- PostgreSQL: 服務名 `postgres`
- Redis: 服務名 `redis`

## Same-Origin Reverse Proxy

Nginx / Traefik / Caddy 這類代理的目標應是：

- `/` -> `http://127.0.0.1:3100`
- `/api` -> `http://127.0.0.1:3101`
- `/socket.io` -> `http://127.0.0.1:3101`

推薦在這種部署下：

- `APP_URL` 設成外部網站 origin，例如 `https://play.example.com`
- `NEXT_PUBLIC_API_BASE_URL` 留空
- `NEXT_PUBLIC_SOCKET_URL` 留空

參考基礎配置：`nginx/doudezhu.conf`

## 驗證命令

合約層與基本 smoke 驗證至少包含：

```bash
npm run check
node --test test-logic/backend-contract.test.js test-logic/client-network-contract.test.js
FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/room-ui.spec.js --workers=1
```

若 smoke test 目標不是默認前端，覆蓋 `FRONTEND_BASE_URL` 即可。

## 語音說明

- 房內語音使用瀏覽器 `getUserMedia` + WebRTC
- Socket.IO 只負責 `voice:*` 信令
- 若部署在 NAT / 防火牆限制環境，後續建議補 TURN

## 備份

- 數據庫卷：`docker-data/postgres`
- Redis 卷：`docker-data/redis`
