# 部署手冊

## 開發模式

```bash
cp .env.example .env
npm install
npm run dev
```

## 前端冒煙測試

```bash
npm run test:ui
```

測試會自動登入測試玩家，驗證：

- 遊戲庫首頁
- 狼人殺 / 阿瓦隆建房進房
- 斗地主建房、補機器人與桌面 / 橫屏房間頁

## Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

服務：

- Frontend: `http://127.0.0.1:3100`
- Backend: `http://127.0.0.1:3101`
- PostgreSQL: compose 內部服務名 `postgres`
- Redis: compose 內部服務名 `redis`

## 語音說明

- 房內語音使用瀏覽器 `getUserMedia` + WebRTC
- 若部署在反向代理或公網環境，請確保 `APP_URL` 指向實際對外地址
- 若存在 NAT / 防火牆限制，建議後續追加 TURN 服務

## Nginx 反代

建議把前端頁面代理到 `3100`，把 `/api` 與 `/socket.io` 代理到 `3101`。

基礎配置可參考 [nginx/doudezhu.conf](/home/choinong/doudezhu/nginx/doudezhu.conf) 再按前後端雙端口調整。

## 備份

- 數據庫卷：`docker-data/postgres`
- Redis 卷：`docker-data/redis`
