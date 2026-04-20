# 規則引擎

## 已支持牌型

- 單張、對子、三張
- 三帶一、三帶二
- 順子
- 連對
- 飛機、飛機帶單、飛機帶對
- 四帶二單、四帶二對
- 炸彈、王炸

## 倍率

- 初始倍率 = 最高叫分，最低為 1
- 炸彈倍率乘 `bombMultiplier`
- 王炸倍率乘 `rocketMultiplier`
- 春天 / 反春天倍率乘 `springMultiplier`

## 計時

- `countdownSeconds` 控制人工玩家每回合可操作時間
- 超時後玩家才切入托管
- 托管 / 機器人出牌延時在 `autoTrusteeMinSeconds` 與 `autoTrusteeMaxSeconds` 間隨機

## 模板說明

- `CLASSIC`: 標準叫分模式
- `ROB`: 快節奏搶地主房
- `NO_SHUFFLE`: 使用固定牌序發牌的娛樂模板
- `LAIZI`: 已保留模板配置，首版未開放
