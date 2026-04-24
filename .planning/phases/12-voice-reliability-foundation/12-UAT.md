---
status: complete
phase: 12-voice-reliability-foundation
source:
  - 12-01-SUMMARY.md
  - 12-02-SUMMARY.md
  - 12-03-SUMMARY.md
started: 2026-04-24T14:19:20+08:00
updated: 2026-04-24T14:41:35+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Party 房间的 relay 诊断与静音恢复提示
expected: 在一个已经触发语音降级或 relay fallback 的 Party 房间里，页面应明确显示稳定模式/降级中的语音状态，并出现“重连后将以静音恢复”这类恢复提示。用户不应看到 ICE/TURN 细节，且页面不应暗示已经自动热麦恢复。
result: pass

### 2. Party 房间重连后先以静音/旁听恢复
expected: 如果玩家在 Party 房间里已经接通过语音，然后在 grace window 内刷新或短暂断线再回来，房间应把语音恢复成静音/旁听态，而不是直接恢复开咪。用户需要显式操作后才会重新发声。
result: pass

### 3. Undercover 当前描述者仍可走开咪路径
expected: 在誰是臥底房间里，如果当前玩家正好是 active clue speaker，即使语音处于 degraded 或 stable relay 模式，页面仍应提供“重试开咪/开咪描述”这类可用路径，而不是把语音完全关掉。
result: pass

### 4. Undercover 非当前描述者只能旁听等待
expected: 在誰是臥底房间里，如果当前玩家不是 active clue speaker，页面应明确告诉用户先旁听、等待轮到自己，而不是给出会误导用户立即发言的语音入口。
result: pass

### 5. Operator blocked 仍然压过 relay 可用性
expected: 如果运营侧把 Party 语音切到 blocked，房间页面应优先显示语音暂停/先用文字继续等提示，并阻止接通语音；即便该房间本身已经处于 stable relay 模式，也不能绕过这个封锁。
result: pass

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
