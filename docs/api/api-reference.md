# API 參考

## 認證

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`

## 大廳

- `GET /api/templates`
- `GET /api/rooms`
- `POST /api/rooms`
- `GET /api/rooms/:roomNo`
- `POST /api/rooms/:roomNo/join`
- `GET /api/leaderboard`

## 派對房

- `GET /api/party/rooms?gameKey=werewolf|avalon`
- `POST /api/party/rooms?gameKey=werewolf|avalon`
- `GET /api/party/rooms/:roomNo`
- `POST /api/party/rooms/:roomNo/join`

## 棋類房

- `GET /api/board/rooms?gameKey=gomoku|chinesecheckers`
- `POST /api/board/rooms?gameKey=gomoku|chinesecheckers`
- `GET /api/board/rooms/:roomNo`
- `POST /api/board/rooms/:roomNo/join`

## 管理

- `GET /api/admin/players`
- `POST /api/admin/players/:id/adjust`
- `GET|PATCH|POST /api/admin/templates`
- `GET|POST /api/admin/config`

## Socket 事件

- `room:subscribe`
- `room:ready`
- `room:add-bot`
- `game:bid`
- `game:play`
- `game:pass`
- `game:trustee`
- 服務端事件：`room:update`、`room:error`

- `party:subscribe`
- `party:ready`
- `party:add-bot`
- `party:message`
- `party:action`
- `voice:join`
- `voice:leave`
- `voice:state`
- `voice:signal`
- 服務端事件：`party:update`、`party:error`、`voice:peers`、`voice:user-joined`、`voice:user-left`

- `board:subscribe`
- `board:ready`
- `board:add-bot`
- `board:move`
- 服務端事件：`board:update`、`board:error`
