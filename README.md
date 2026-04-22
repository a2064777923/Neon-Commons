# Hong's Neon-Commons

可在線開房的派對遊戲網站，現已集成：

- 斗地主：模板建房、機器人補位、自動托管、自動結算
- 在線狼人殺：6-10 人開房、擴展角色池、補 AI、晝夜節奏與投票出局
- 在線阿瓦隆：5-10 人開房、擴展角色池、補 AI、組隊表決與刺殺梅林
- 在線五子棋：2 人房、15 路棋盤、補 AI、實時落子
- 在線跳棋：2 / 4 / 6 人中國跳棋星盤、補 AI、連跳走位
- 帳號註冊登入
- 房間號建房與加入
- 房內 WebRTC 語音通話
- 沉浸式遊戲界面與手機適配
- 排行榜
- 管理後台玩家調整、模板配置、系統配置

## 技術棧與 Runtime

- 前端：`Next.js 15 + React 18`
- 後端：`backend/server.js` 啟動的 `Node.js HTTP + Socket.IO`
- 持久化：`PostgreSQL`
- 形態：同倉前後端分離
- Frontend 默認端口：`3100`
- Backend 默認端口：`3101`

## Split Runtime Contract

- UI 路由與靜態資產由 Next.js frontend 提供
- `/api/*` 與 `/socket.io/*` 由 `backend/server.js` 提供，REST 會經過 `backend/router.js -> backend/handlers/**`
- 前端頁面應統一經由 `lib/client/api.js` / `lib/client/network-runtime.js` 呼叫後端，不要在頁面裡手寫來源 URL

### Public origin 變數

| 變數 | 用途 |
| --- | --- |
| `APP_URL` | backend CORS 允許的 frontend public origin |
| `NEXT_PUBLIC_API_BASE_URL` | 顯式指定瀏覽器 REST 目標 |
| `NEXT_PUBLIC_BACKEND_URL` | `NEXT_PUBLIC_API_BASE_URL` 的 legacy alias |
| `NEXT_PUBLIC_SOCKET_URL` | 顯式指定瀏覽器 Socket.IO 目標 |

本地開發時，如果頁面跑在 `http://127.0.0.1:3100`，`lib/client/network-runtime.js` 會自動把 API / Socket 目標解析到 `3101`。若是同源反代部署，`NEXT_PUBLIC_API_BASE_URL` 和 `NEXT_PUBLIC_SOCKET_URL` 可以留空。

## 快速開始

1. 複製環境文件：

```bash
cp .env.example .env
```

2. 安裝依賴：

```bash
npm install
```

3. 啟動前後端：

```bash
npm run dev
```

4. 打開：

```text
http://127.0.0.1:3100
```

Backend 默認地址：

```text
http://127.0.0.1:3101
```

## Docker / 反代部署

```bash
docker compose up -d --build
```

如果前面還有系統代理，請把：

- `/` -> `3100`
- `/api` -> `3101`
- `/socket.io` -> `3101`

基礎反代配置可參考 `nginx/doudezhu.conf`。

## 合約與 Smoke 驗證

```bash
npm run check
node --test test-logic/backend-contract.test.js test-logic/client-network-contract.test.js
FRONTEND_BASE_URL=http://127.0.0.1:3100 npx playwright test tests/room-ui.spec.js --workers=1
```

如果 smoke test 要打別的 frontend runtime，改 `FRONTEND_BASE_URL` 即可。

## 文檔

- [項目概覽](docs/overview/project-overview.md)
- [產品需求](docs/product/product-spec.md)
- [系統架構](docs/architecture/system-architecture.md)
- [後端契約邊界](docs/architecture/backend-contract.md)
- [API 清單](docs/api/api-reference.md)
- [斗地主規則說明](docs/game-rules/rule-engine.md)
- [狼人殺 / 阿瓦隆規則說明](docs/game-rules/party-rules.md)
- [五子棋 / 跳棋規則說明](docs/game-rules/board-rules.md)
- [運維手冊](docs/ops/deployment.md)
- [後台操作](docs/admin/admin-guide.md)
