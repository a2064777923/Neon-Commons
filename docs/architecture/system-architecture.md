# 系統架構

## 進程

- `frontend`: Next.js 頁面與靜態資產，默認 `3100`
- `backend`: Node.js API + Socket.IO，默認 `3101`
- `postgres`: 玩家、模板、配置、戰績持久化
- `redis`: 預留給後續多節點房間狀態與任務調度

## 主要模塊

- `backend/server.js`: 後端 HTTP / Socket 入口
- `backend/handlers/*`: REST 介面處理器
- `lib/db.js`: 初始化資料表、默認模板與管理員
- `lib/auth.js`: JWT Cookie 認證
- `lib/games/catalog.js`: 遊戲目錄與各模式默認配置
- `lib/game/combo.js`: 牌型識別與比較
- `lib/game/room-manager.js`: 房間、對局輪轉、機器人與結算
- `lib/board/manager.js`: 五子棋 / 跳棋房間、棋盤規則、AI 補位與同步
- `lib/party/manager.js`: 狼人殺 / 阿瓦隆房間、擴展角色狀態機、AI 補位、語音信令與通用派對房間
- `lib/client/api.js`: 前端 API / Socket URL 入口
- `pages/room/[roomNo].js`: 斗地主實時房間頁
- `pages/board/[roomNo].js`: 五子棋 / 跳棋通用棋盤房間頁
- `pages/party/[roomNo].js`: 狼人殺 / 阿瓦隆通用房間頁

## 單機前提

- 前端與後端是獨立進程，但仍在同一倉庫中維護
- 房間與對局暫態保存在進程內存
- 重啟服務會清空進行中的房間，但玩家與戰績保留在 PostgreSQL
- 語音採用 WebRTC P2P，Socket.IO 僅負責信令轉發
