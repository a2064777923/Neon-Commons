# 項目概覽

Hong's Neon-Commons 是瀏覽器即時派對遊戲平台。到 v1.1 為止，已交付的 shipped surface 包含：

- 統一首頁 hub，依家族展示 live / paused / coming-soon / snapshot-only 狀態
- 經典牌桌：斗地主大廳、房號加入、規則模板、沉浸式房間頁
- 推理派對：狼人殺、阿瓦隆、誰是臥底
- 棋盤對戰：五子棋、中國跳棋、黑白棋
- 單人闖關：推箱子直開頁面
- 管理後台：模板、能力開關、runtime controls、玩家調整、audit feed
- live room 營運面：房間目錄、詳情檢查、排空、關閉、移除房內身份
- 單節點恢復能力：重連恢復、guest rejoin、snapshot-only 發現與恢復提示
- 排行榜與基本帳號體系

## 當前產品邊界

- Frontend 與 backend 分離，但仍維持同倉與單機部署模型
- 前端默認 `3100`，backend 默認 `3101`
- `/api/*` 與 `/socket.io/*` 一律由 backend 擁有
- PostgreSQL 存持久化資料；活躍房間狀態目前仍保留在單節點記憶體
- 語音仍採瀏覽器 `getUserMedia` + WebRTC，Socket.IO 僅負責信令

## 已上線遊戲面

### 房間型遊戲

- 斗地主：3 人對局、模板規則、公開房列表、房號加入、補機器人、托管
- 狼人殺：角色包、夜晚/白天流程、補 AI、房內語音
- 阿瓦隆：組隊、投票、任務牌、刺殺梅林、補 AI
- 五子棋：`15 x 15` 棋盤、開局規則、房號加入、補 AI
- 中國跳棋：`2 / 4 / 6` 人房、星盤、高亮合法落點、連跳、補 AI
- 黑白棋：雙人棋局、專屬房間路由、邀請連結、補 AI
- 誰是臥底：專屬房間路由、描述 / 投票回合、邀請連結、補 AI

### 直開型遊戲

- 推箱子：不依賴房號，直接從 `/games/sokoban` 啟動單人關卡

## 恢復與營運面

### 玩家恢復體驗

- 已登入玩家可在 eligible 房間 refresh / reconnect 後恢復原 seat 或 session
- scoped guest 可在支援的 party / board 房間裡帶著既有身份回來
- 房主與管理員能看到 `connected / reconnecting / disconnected` presence
- 單節點重啟後，hub 與 room-entry 會把可恢復房間標成 `snapshot-only`，而不是假裝它仍可即時加入

### 管理與營運

- 模板與模板規則編輯
- 按遊戲家族管理 capability 開關，僅影響新建房
- runtime controls，例如 `maxOpenRoomsPerUser`、`maintenanceMode`
- admin live-room directory、detail inspect、`排空房間`、`關閉房間`、`移除玩家`
- audit feed 會把 capability、runtime、模板、玩家、live-room 介入串成一條操作時間線

## Canonical Release Flow

目前釋出前驗證以 deployed `3100/3101` runtime 為準：

```bash
npm run deploy:3100
npm run verify:release
```

其中 `verify:release` 會串起：

- `npm run check`
- `npm run test:logic:critical`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:critical`

如果只是診斷 live-ops / recovery 回歸，可額外使用兩條窄 helper：

- `npm run test:logic:liveops`
- `FRONTEND_BASE_URL=http://127.0.0.1:3100 npm run test:ui:liveops`

這兩條命令只用來縮小問題，不取代 canonical pre-ship gate。

## 當前限制

- `LAIZI` 模板仍只保留配置，默認未上線
- 房間狀態仍是單節點記憶體模型；`snapshot-only` 只提供恢復可見性，不是跨節點接管
- TURN / SFU 語音基建尚未進入當前里程碑
- Native mobile app 不在這一輪里程碑範圍內
