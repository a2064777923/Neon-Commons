# Hong's Neon-Commons

可在線開房的派對遊戲網站，現已集成：

- 斗地主：模板建房、機器人補位、自動托管、自動結算
- 在線狼人殺：6-10 人開房、擴展角色池、補 AI、晝夜節奏與投票出局
- 在線阿瓦隆：5-10 人開房、擴展角色池、補 AI、組隊表決與刺殺梅林
- 在線五子棋：2 人房、15 路棋盤、補 AI、實時落子
- 在線跳棋：2 人中國跳棋星盤、補 AI、連跳走位
- 帳號註冊登入
- 房間號建房與加入
- 房內 WebRTC 語音通話
- 沉浸式遊戲界面與手機適配
- 排行榜
- 管理後台玩家調整、模板配置、系統配置
- Docker Compose 部署

## 技術棧與架構

- 前端：`Next.js 15 + React 18`
- 後端：`Node.js HTTP server + Socket.IO`
- 持久化：`PostgreSQL`
- 形態：同倉前後端分離
- 前端默認端口：`3100`
- 後端默認端口：`3101`

## 快速開始

1. 複製環境文件：

```bash
cp .env.example .env
```

2. 安裝依賴：

```bash
npm install
```

3. 啟動開發服務：

```bash
npm run dev
```

4. 打開：

```text
http://127.0.0.1:3100
```

後端 API / Socket 默認跑在：

```text
http://127.0.0.1:3101
```

首頁現在是多遊戲入口頁；斗地主房間頁支持桌面與手機橫屏沉浸式牌桌；狼人殺與阿瓦隆房間帶階段倒計時、擴展身份、AI 補位與語音席位；五子棋與跳棋帶獨立棋盤房間、房號加入與單人補 AI。

默認管理員帳號來自 `.env`：

- 用戶名：`ADMIN_USERNAME`
- 密碼：`ADMIN_PASSWORD`

## Docker 部署

```bash
docker compose up -d --build
```

如果需要走系統 Nginx，參考 [nginx/doudezhu.conf](/home/choinong/doudezhu/nginx/doudezhu.conf)。

## UI Smoke Test

```bash
npm run test:ui
```

這會用 Playwright 驗證：

- 遊戲庫首頁入口
- 狼人殺 / 阿瓦隆建房進房、補 AI 開局
- 五子棋 / 跳棋建房進房、補 AI 與走一步落子
- 斗地主桌面與手機橫屏房間頁

## 文檔

- [項目概覽](/home/choinong/doudezhu/docs/overview/project-overview.md)
- [產品需求](/home/choinong/doudezhu/docs/product/product-spec.md)
- [架構設計](/home/choinong/doudezhu/docs/architecture/system-architecture.md)
- [API 清單](/home/choinong/doudezhu/docs/api/api-reference.md)
- [斗地主規則說明](/home/choinong/doudezhu/docs/game-rules/rule-engine.md)
- [狼人殺 / 阿瓦隆規則說明](/home/choinong/doudezhu/docs/game-rules/party-rules.md)
- [五子棋 / 跳棋規則說明](/home/choinong/doudezhu/docs/game-rules/board-rules.md)
- [運維手冊](/home/choinong/doudezhu/docs/ops/deployment.md)
- [後台操作](/home/choinong/doudezhu/docs/admin/admin-guide.md)
- [變更記錄 2026-04-18 棋類擴展](/home/choinong/doudezhu/docs/changelog/2026-04-18-board-games.md)
