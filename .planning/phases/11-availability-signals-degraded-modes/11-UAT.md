---
status: complete
phase: 11-availability-signals-degraded-modes
source:
  - 11-04-SUMMARY.md
started: 2026-04-23T14:11:00+08:00
updated: 2026-04-23T14:19:58+08:00
---

## Current Test

[testing complete]

## Tests

### 1. Hub 和入口的 Undercover 语音提示
expected: 在首页 hub 卡片或 `/entry/undercover/[roomNo]` 入口页里，誰是臥底不应再被描述成“只能文字继续”。如果语音处于降级态，页面应明确说明这是“轮到描述者再开咪 / 其他人先旁听”这类 turn-based 语义，而不是把整个游戏说成纯文字 fallback。
result: pass

### 2. Undercover 当前描述者可开咪
expected: 进入 `/undercover/[roomNo]` 后，如果你正好是当前 clue speaker，页面应出现明确的语音状态面板，且你可以接入语音并开咪描述；如果语音是 degraded，按钮文案也应仍然是“重试开咪/开咪描述”这类可用路径，而不是完全关闭。
result: pass

### 3. Undercover 旁听者等待轮次
expected: 当你不是当前描述者时，Undercover 房间应明确告诉你先旁听、等待轮到自己再开咪；此时页面不应误导你立即发言，但也不应把整个房间说成没有语音能力。
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
