# 2026-04-22 Release Hardening

- 新增 `npm run test:logic:critical`，把 backend contract、CORS、client runtime contract、admin、hub / room-entry、卡牌 / 派對 / 棋類 / solo 關鍵邏輯收斂成單一 node gate
- 新增 `npm run test:ui:critical`，把 hub、admin、斗地主、狼人殺、阿瓦隆、五子棋、中國跳棋、黑白棋、推箱子、誰是臥底 smoke flows 收斂成單一 Playwright gate
- 新增 `npm run deploy:3100`，明確把 canonical Docker runtime 重建到 `3100/3101`
- 新增 `npm run verify:release`，預設重新部署 `3100`，等待 frontend / backend readiness，之後再跑 `check`、critical logic、critical UI suites
- 更新部署、概覽、架構與 API 文件，讓 operator docs 與實際 shipped surface 對齊
- 更新 `.planning/REQUIREMENTS.md` traceability，補齊已完成 phase 與 quality hardening 狀態
