import { io } from "socket.io-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import SiteLayout from "../../components/SiteLayout";
import GameIcon from "../../components/game-hub/GameIcon";
import MatchResultOverlay from "../../components/MatchResultOverlay";
import { API_ROUTES, SOCKET_EVENTS, apiFetch, getSocketUrl } from "../../lib/client/api";
import {
  clearPendingGuestMatchClaim,
  readPendingGuestMatchClaim,
  writePendingGuestMatchClaim
} from "../../lib/client/room-entry";
import styles from "../../styles/BoardRoom.module.css";

const { getGameMeta, getBoardConfigSummary } = require("../../lib/games/catalog");

let socket;
const BOARD_EVENTS = SOCKET_EVENTS.board;
const GOMOKU_SIZE = 15;
const REVERSI_SIZE = 8;
const CHINESE_CHECKERS_ROW_LENGTHS = [1, 2, 3, 4, 13, 12, 11, 10, 9, 10, 11, 12, 13, 4, 3, 2, 1];
const CHINESE_VERTICAL_GAP = 0.8660254037844386;

export default function BoardRoomPage() {
  const router = useRouter();
  const { roomNo } = router.query;
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [socketReady, setSocketReady] = useState(false);
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedPiece, setSelectedPiece] = useState(null);
  const [activePanel, setActivePanel] = useState(null);
  const [dismissedResultKey, setDismissedResultKey] = useState("");
  const messageTimerRef = useRef(null);
  const previousViewerCanMoveRef = useRef(false);
  const guestClaimSyncRef = useRef("");

  const meta = useMemo(() => getGameMeta(room?.gameKey), [room?.gameKey]);
  const boardSummary = useMemo(
    () => getBoardConfigSummary(room?.gameKey, room?.config || {}),
    [room?.config, room?.gameKey]
  );
  const mySeat = room?.viewer || null;
  const phaseRemainingMs = room?.turnEndsAt ? Math.max(0, room.turnEndsAt - nowMs) : 0;
  const players = room?.players || [];
  const playerBySeat = useMemo(
    () => Object.fromEntries(players.map((player) => [player.seatIndex, player])),
    [players]
  );
  const chineseProgress = room?.gameKey === "chinesecheckers" ? room?.match?.progress || [] : [];
  const chineseProgressBySeat = useMemo(
    () => Object.fromEntries(chineseProgress.map((item) => [item.seatIndex, item])),
    [chineseProgress]
  );

  useEffect(() => {
    if (!roomNo) {
      return;
    }

    loadRoom().catch(() => showMessage("读取房间失败"));

    return () => {
      clearTimeout(messageTimerRef.current);
    };
  }, [roomNo]);

  useEffect(() => {
    if (!roomNo || !me || !mySeat) {
      setSocketReady(false);
      return undefined;
    }

    if (!socket) {
      socket = io(getSocketUrl(), { withCredentials: true });
    }

    function subscribe() {
      socket.emit(BOARD_EVENTS.subscribe, { roomNo });
    }

    function onConnect() {
      setSocketReady(true);
      subscribe();
    }

    function onDisconnect() {
      setSocketReady(false);
    }

    function onRoomUpdate({ room: nextRoom }) {
      setRoom(nextRoom);
      setNowMs(Date.now());
    }

    function onRoomError({ error }) {
      showMessage(error || "房间操作失败");
    }

    if (socket.connected) {
      setSocketReady(true);
      subscribe();
    } else {
      setSocketReady(false);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(BOARD_EVENTS.update, onRoomUpdate);
    socket.on(BOARD_EVENTS.error, onRoomError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(BOARD_EVENTS.update, onRoomUpdate);
      socket.off(BOARD_EVENTS.error, onRoomError);
      setSocketReady(false);
    };
  }, [roomNo, me, mySeat]);

  useEffect(() => {
    if (!room?.turnEndsAt) {
      return undefined;
    }

    setNowMs(Date.now());
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 200);

    return () => clearInterval(timer);
  }, [room?.turnEndsAt]);

  useEffect(() => {
    if (!room?.match?.viewerLegalMoves?.[selectedPiece]) {
      setSelectedPiece(null);
    }
  }, [room?.match?.viewerLegalMoves, selectedPiece]);

  useEffect(() => {
    const viewerCanMove = Boolean(room?.match?.viewerCanMove);
    if (viewerCanMove && !previousViewerCanMoveRef.current) {
      setActivePanel(null);
      showMessage(
        room?.gameKey === "chinesecheckers" ? "轮到你走子了，可借任意已占用棋子起跳" : "轮到你落子了"
      );
    }
    previousViewerCanMoveRef.current = viewerCanMove;
  }, [room?.match?.viewerCanMove, room?.gameKey]);

  useEffect(() => {
    if (me?.kind !== "user" || !roomNo) {
      return;
    }

    const pendingClaim = readPendingGuestMatchClaim();
    const currentRoute = `/board/${roomNo}`;
    if (!pendingClaim || pendingClaim.returnTo !== currentRoute) {
      return;
    }

    const claimKey = `${pendingClaim.guestId}:${pendingClaim.gameKey}:${pendingClaim.roomNo}`;
    if (guestClaimSyncRef.current === claimKey) {
      return;
    }

    guestClaimSyncRef.current = claimKey;
    let cancelled = false;

    async function syncPendingClaim() {
      const response = await apiFetch(API_ROUTES.roomEntry.guestSync(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestId: pendingClaim.guestId,
          gameKey: pendingClaim.gameKey,
          roomNo: pendingClaim.roomNo,
          summary: pendingClaim.summary
        })
      });
      const data = await response.json();

      if (cancelled) {
        return;
      }

      if (response.ok) {
        clearPendingGuestMatchClaim();
        showMessage("本局已同步到帳號紀錄");
        return;
      }

      if (response.status !== 401) {
        clearPendingGuestMatchClaim();
      }
      guestClaimSyncRef.current = "";
      showMessage(data.error || "本局同步失敗");
    }

    syncPendingClaim().catch(() => {
      if (!cancelled) {
        guestClaimSyncRef.current = "";
        showMessage("本局同步失敗");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [me?.kind, roomNo]);

  async function loadRoom() {
    if (!roomNo) {
      return;
    }

    const [meResponse, roomResponse] = await Promise.all([
      apiFetch(API_ROUTES.me()),
      apiFetch(API_ROUTES.boardRooms.detail(roomNo))
    ]);

    const [meData, roomData] = await Promise.all([meResponse.json(), roomResponse.json()]);
    const nextSession = meData.session || meData.user || null;
    if (!nextSession) {
      router.push(`/login?returnTo=${encodeURIComponent(getCurrentBoardRoute(router.asPath, roomNo))}`);
      return;
    }

    if (!roomResponse.ok) {
      showMessage(roomData.error || "房间不存在");
      return;
    }

    setMe(nextSession);
    setRoom(roomData.room);
  }

  function showMessage(text, duration = 2600) {
    clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = setTimeout(() => setMessage(""), duration);
  }

  async function joinRoom() {
    setJoining(true);
    const response = await apiFetch(API_ROUTES.boardRooms.join(roomNo), { method: "POST" });
    const data = await response.json();
    setJoining(false);

    if (!response.ok) {
      showMessage(data.error || "加入房间失败");
      return;
    }

    setRoom(data.room);
    socket?.emit(BOARD_EVENTS.subscribe, { roomNo });
  }

  function emitReady(ready) {
    if (!socket?.connected) {
      showMessage("实时连线同步中，请稍候");
      return;
    }
    socket?.emit(BOARD_EVENTS.ready, { roomNo, ready });
  }

  function emitAddBot(count = 1) {
    if (!socket?.connected) {
      showMessage("实时连线同步中，请稍候");
      return;
    }
    socket?.emit(BOARD_EVENTS.addBot, { roomNo, count });
  }

  function emitMove(payload) {
    if (!socket?.connected) {
      showMessage("实时连线同步中，请稍候");
      return;
    }
    socket?.emit(BOARD_EVENTS.move, { roomNo, payload });
  }

  function queueGuestClaimSync() {
    if (me?.kind !== "guest" || !room?.lastResult) {
      return;
    }

    writePendingGuestMatchClaim(buildBoardGuestClaim(room, me, mySeat));
    router.push(`/login?returnTo=${encodeURIComponent(getCurrentBoardRoute(router.asPath, room.roomNo, meta))}`);
  }

  if (!room || !meta) {
    return (
      <SiteLayout immersive>
        <div className={styles.loading}>正在同步棋盘房间状态...</div>
      </SiteLayout>
    );
  }

  const isMyTurn = Boolean(room.match?.viewerCanMove);
  const actingPlayerName = players[room.match?.turnSeat || 0]?.displayName || "当前棋手";
  const resultKey = room?.lastResult
    ? [
        room.gameKey,
        room.lastResult.headline,
        room.lastResult.detail || "",
        typeof room.lastResult.winnerSeat === "number" ? room.lastResult.winnerSeat : "draw",
        room.feed[room.feed.length - 1]?.id || room.roomNo
      ].join("|")
    : "";
  const resultOpen = Boolean(room.lastResult) && dismissedResultKey !== resultKey;

  return (
    <SiteLayout immersive>
      <section className={`${styles.scene} ${getBoardThemeClass(room.gameKey)}`}>
        <div className={styles.sceneGlow} />
        <div className={styles.sceneDust} />
        <div className={styles.sceneSweep} />

        <header className={styles.hud}>
            <div className={styles.hudMain}>
              <div className={styles.hudIcon}>
                <GameIcon gameKey={room.gameKey} />
              </div>
              <div>
                <span className={styles.roomTag}>房号 {room.roomNo}</span>
                <h1>{meta.title}</h1>
                <p>
                  {meta.strapline} · {players.length}/{room.config.maxPlayers} 人
                </p>
                {boardSummary.length > 0 ? (
                  <div className={styles.stageBadges}>
                    {boardSummary.map((item) => (
                      <span key={`${room.roomNo}-${item}`} data-board-chip={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

          <div className={styles.hudActions}>
            <TurnTimer
              remainingMs={phaseRemainingMs}
              durationMs={room.turnDurationMs}
              label={room.state === "playing" ? "回合" : "待开局"}
            />
            <button type="button" className={styles.hudButton} onClick={() => router.push(meta.route)}>
              返回大厅
            </button>
          </div>
        </header>

        <div className={styles.layout}>
          <section className={styles.stage}>
            {room.gameKey === "chinesecheckers" && chineseProgress.length > 0 ? (
              <div className={styles.stageTopline}>
                <div className={styles.progressRow}>
                  {chineseProgress.map((item) => (
                    <span
                      key={`${room.roomNo}-progress-${item.seatIndex}`}
                      className={styles.progressBadge}
                      data-progress-seat={item.seatIndex}
                      data-progress-value={`${item.goalReached}/${item.goalTotal}`}
                    >
                      <strong>{item.pieceLabel}</strong>
                      <span>
                        {item.targetCampLabel} {item.goalReached}/{item.goalTotal}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div
              className={`${styles.boardBody} ${isMyTurn ? styles.boardBodyActive : ""} ${
                room.gameKey === "gomoku"
                  ? styles.boardBodyGomoku
                  : room.gameKey === "reversi"
                    ? styles.boardBodyReversi
                    : styles.boardBodyChinese
              }`.trim()}
            >
              {room.state === "playing" ? (
                <div className={`${styles.turnBanner} ${isMyTurn ? styles.turnBannerActive : ""}`.trim()}>
                  <span>{isMyTurn ? "你的操作窗口" : "当前行动者"}</span>
                  <strong>
                    {isMyTurn
                      ? room.gameKey === "chinesecheckers"
                        ? "现在走子，可借任意已占用棋子连跳"
                        : room.gameKey === "reversi"
                          ? "现在落子，抢角与边线"
                          : "现在落子"
                      : actingPlayerName}
                  </strong>
                </div>
              ) : null}

              {room.gameKey === "gomoku" ? (
                <GomokuBoard room={room} emitMove={emitMove} />
              ) : room.gameKey === "reversi" ? (
                <ReversiBoard room={room} emitMove={emitMove} />
              ) : (
                <ChineseCheckersBoard
                  room={room}
                  selectedPiece={selectedPiece}
                  setSelectedPiece={setSelectedPiece}
                  emitMove={emitMove}
                  playerBySeat={playerBySeat}
                />
              )}
            </div>

            <div className={styles.actionDock}>
              {!mySeat ? (
                <button type="button" className={styles.primaryButton} onClick={joinRoom}>
                  {joining ? "加入中..." : "加入房间"}
                </button>
              ) : room.state === "waiting" ? (
                <div className={styles.waitingBar}>
                  <div className={styles.waitingActions}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={() => emitReady(!mySeat.ready)}
                      disabled={!socketReady}
                    >
                      {mySeat.ready ? "取消准备" : room.lastResult ? "准备再来" : "准备开局"}
                    </button>
                    {mySeat?.isOwner && players.length < room.config.maxPlayers ? (
                      <button
                        type="button"
                        className={styles.hudButton}
                        onClick={() => emitAddBot(1)}
                        disabled={!socketReady}
                      >
                        补机器人
                      </button>
                    ) : null}
                  </div>
                  <span>
                    当前 {players.filter((player) => player.ready).length}/{players.length} 人已准备
                  </span>
                </div>
              ) : (
                <div
                  className={`${styles.actionPanel} ${isMyTurn ? styles.actionPanelActive : ""}`.trim()}
                >
                  <strong>{mySeat?.pieceLabel || "观战中"}</strong>
                  <p>{getTurnHint(room, mySeat, selectedPiece)}</p>
                </div>
              )}

              <div className={styles.infoDock}>
                <button
                  type="button"
                  className={`${styles.dockButton} ${
                    activePanel === "viewer" ? styles.dockButtonActive : ""
                  }`.trim()}
                  onClick={() =>
                    setActivePanel((current) => (current === "viewer" ? null : "viewer"))
                  }
                >
                  <span>{mySeat ? "我的席位" : "入座信息"}</span>
                  <strong>{mySeat?.pieceLabel || "未入座"}</strong>
                </button>
                <button
                  type="button"
                  className={`${styles.dockButton} ${
                    activePanel === "seats" ? styles.dockButtonActive : ""
                  }`.trim()}
                  onClick={() =>
                    setActivePanel((current) => (current === "seats" ? null : "seats"))
                  }
                >
                  <span>席位</span>
                  <strong>
                    {players.length}/{room.config.maxPlayers}
                  </strong>
                </button>
                <button
                  type="button"
                  className={`${styles.dockButton} ${
                    activePanel === "log" ? styles.dockButtonActive : ""
                  }`.trim()}
                  onClick={() => setActivePanel((current) => (current === "log" ? null : "log"))}
                >
                  <span>日志</span>
                  <strong>{room.feed.length} 条</strong>
                </button>
              </div>
            </div>
          </section>
        </div>

        {activePanel ? <button type="button" className={styles.drawerBackdrop} onClick={() => setActivePanel(null)} /> : null}
        {activePanel ? (
          <aside className={styles.drawer}>
            <div className={styles.drawerHead}>
              <div>
                <span className={styles.drawerEyebrow}>
                  {activePanel === "viewer"
                    ? "Viewer"
                    : activePanel === "seats"
                      ? "Seats"
                      : "Feed"}
                </span>
                <strong>
                  {activePanel === "viewer"
                    ? "当前席位"
                    : activePanel === "seats"
                      ? "对局席位"
                      : "房内日志"}
                </strong>
              </div>
              <button type="button" className={styles.drawerClose} onClick={() => setActivePanel(null)}>
                关闭
              </button>
            </div>

            {activePanel === "viewer" ? (
              <section className={styles.viewerCard}>
                <div className={styles.viewerHead}>
                  <div>
                    <span>你的席位</span>
                    <strong>{mySeat ? `#${mySeat.seatIndex + 1} ${mySeat.displayName}` : "尚未入座"}</strong>
                  </div>
                  {mySeat?.pieceLabel ? <span className={styles.rolePill}>{mySeat.pieceLabel}</span> : null}
                </div>
                <div className={styles.noteList}>
                  {(getViewerNotes(room, mySeat) || ["加入房间后即可开始对弈。"]).map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
                {room.lastResult ? (
                  <div className={styles.resultReveal}>
                    <strong>{room.lastResult.headline}</strong>
                    {room.lastResult.detail ? <span>{room.lastResult.detail}</span> : null}
                  </div>
                ) : null}
              </section>
            ) : null}

            {activePanel === "seats" ? (
              <section className={styles.seatPanel}>
                <div className={styles.panelTitle}>
                  <strong>对局席位</strong>
                  <span>{players.length} / {room.config.maxPlayers}</span>
                </div>
                <div className={styles.seatList}>
                  {players.map((player) => {
                    const progress = chineseProgressBySeat[player.seatIndex] || null;

                    return (
                    <div
                      key={player.userId}
                      className={`${styles.seatCard} ${
                        mySeat?.seatIndex === player.seatIndex ? styles.seatSelf : ""
                      } ${room.match?.turnSeat === player.seatIndex ? styles.seatActive : ""}`}
                      data-accent={player.pieceAccent || "neutral"}
                    >
                      <div className={styles.seatHead}>
                        <strong>{player.displayName}</strong>
                        <span>#{player.seatIndex + 1}</span>
                      </div>
                      <div className={styles.seatMeta}>
                        {player.isBot ? <span className={styles.botChip}>AI</span> : null}
                        <span>{player.pieceLabel}</span>
                        {player.campLabel ? <span>{player.campLabel}</span> : null}
                        <span>{player.connected ? "在线" : "离线"}</span>
                      </div>
                      {player.targetCampLabel ? (
                        <div className={styles.seatTrail}>目标营地 · {player.targetCampLabel}</div>
                      ) : null}
                      {progress ? (
                        <div
                          className={styles.seatProgress}
                          data-progress-seat={player.seatIndex}
                          data-progress-value={`${progress.goalReached}/${progress.goalTotal}`}
                        >
                          <strong>
                            {progress.goalReached}/{progress.goalTotal}
                          </strong>
                          <span>剩余 {progress.remaining} 格</span>
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {activePanel === "log" ? (
              <section className={styles.logCard}>
                <div className={styles.panelTitle}>
                  <strong>房内日志</strong>
                  <span>实时滚动</span>
                </div>
                <div className={styles.logList}>
                  {room.feed.map((item) => (
                    <div key={item.id} className={`${styles.logItem} ${styles[`tone${capitalize(item.tone)}`]}`}>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        ) : null}

        <MatchResultOverlay
          open={resultOpen}
          onClose={() => setDismissedResultKey(resultKey)}
          eyebrow={`${meta.title} 结算`}
          title={getBoardResultTitle(room, mySeat)}
          subtitle={getBoardResultSubtitle(room, mySeat)}
          badges={getBoardResultBadges(room, mySeat)}
          rows={getBoardResultRows(room)}
          notice={
            me?.kind === "guest"
              ? {
                  title: "保留這局紀錄",
                  body: "登入或綁定帳號後，這場對局可同步到你的戰績與歷史紀錄。",
                  secondaryAction: {
                    label: "稍後再說",
                    onClick: () => setDismissedResultKey(resultKey)
                  },
                  primaryAction: {
                    label: "登入並同步本局",
                    onClick: queueGuestClaimSync
                  }
                }
              : null
          }
          secondaryAction={{
            label: "返回大厅",
            onClick: () => router.push(meta.route)
          }}
          primaryAction={
            mySeat
              ? {
                  label: mySeat.ready ? "取消准备" : "准备再来",
                  onClick: () => {
                    emitReady(!mySeat.ready);
                    setDismissedResultKey(resultKey);
                  }
                }
              : null
          }
        />

        {message ? <div className={styles.toast}>{message}</div> : null}
      </section>
    </SiteLayout>
  );
}

function GomokuBoard({ room, emitMove }) {
  const match = room.match;
  const board = match?.board || Array.from({ length: GOMOKU_SIZE }, () => Array(GOMOKU_SIZE).fill(null));

  return (
    <div className={styles.gomokuWrap}>
      {!match ? (
        <div className={styles.boardWaitingOverlay}>
          <strong>等待棋手准备</strong>
          <span>双方准备后会立即点亮完整 15 路棋盘。</span>
        </div>
      ) : null}
      <div className={styles.gomokuBoard}>
        {board.map((line, rowIndex) =>
          line.map((cell, colIndex) => {
            const isLast =
              match?.lastMove?.row === rowIndex && match?.lastMove?.col === colIndex;
            return (
              <button
                key={`${rowIndex}-${colIndex}`}
                type="button"
                data-gomoku-cell={`${rowIndex}-${colIndex}`}
                data-gomoku-piece={cell || "empty"}
                className={`${styles.gomokuCell} ${isLast ? styles.gomokuLast : ""}`}
                disabled={!match?.viewerCanMove || Boolean(cell)}
                onClick={() => {
                  if (match?.viewerCanMove && !cell) {
                    emitMove({ row: rowIndex, col: colIndex });
                  }
                }}
              >
                <span className={styles.crossHair} />
                {cell ? (
                  <span
                    className={`${styles.stone} ${
                      cell === "black" ? styles.stoneBlack : styles.stoneWhite
                    }`}
                  />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ReversiBoard({ room, emitMove }) {
  const match = room.match;
  const board = match?.board || Array.from({ length: REVERSI_SIZE }, () => Array(REVERSI_SIZE).fill(null));
  const legalMoves = new Set((match?.viewerLegalMoves || []).map((move) => `${move.row}-${move.col}`));
  const score = match?.score || { black: 2, white: 2 };

  return (
    <div className={styles.reversiWrap}>
      {!match ? (
        <div className={styles.boardWaitingOverlay}>
          <strong>等待棋手准备</strong>
          <span>雙方準備後會立即展開 8x8 黑白棋盤。</span>
        </div>
      ) : null}
      <div className={styles.reversiScore}>
        <span data-reversi-score="black">黑棋 {score.black}</span>
        <span data-reversi-score="white">白棋 {score.white}</span>
      </div>
      <div className={styles.reversiBoard}>
        {board.map((line, rowIndex) =>
          line.map((cell, colIndex) => {
            const moveKey = `${rowIndex}-${colIndex}`;
            const isLast = match?.lastMove?.row === rowIndex && match?.lastMove?.col === colIndex;
            const isLegal = legalMoves.has(moveKey);
            return (
              <button
                key={moveKey}
                type="button"
                data-reversi-cell={moveKey}
                data-reversi-piece={cell || "empty"}
                data-reversi-legal={isLegal ? "true" : "false"}
                className={`${styles.reversiCell} ${isLast ? styles.reversiCellLast : ""}`}
                disabled={!match?.viewerCanMove || !isLegal}
                onClick={() => {
                  if (match?.viewerCanMove && isLegal) {
                    emitMove({ row: rowIndex, col: colIndex });
                  }
                }}
              >
                {isLegal && !cell ? <span className={styles.reversiHint} /> : null}
                {cell ? (
                  <span
                    className={`${styles.reversiStone} ${
                      cell === "black" ? styles.stoneBlack : styles.stoneWhite
                    }`}
                  />
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function ChineseCheckersBoard({
  room,
  selectedPiece,
  setSelectedPiece,
  emitMove,
  playerBySeat
}) {
  const match = room.match;
  const cells = match?.cells || createChineseCheckersDisplayCells();
  const legalMoves = match?.viewerLegalMoves || {};
  const selectedMoves = selectedPiece ? legalMoves[selectedPiece] || [] : [];
  const legalTargets = new Set(selectedMoves.map((item) => item.toCellId));
  const minX = Math.min(...cells.map((cell) => cell.x));
  const minY = Math.min(...cells.map((cell) => cell.y));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const maxY = Math.max(...cells.map((cell) => cell.y));
  const lastFromCell = match?.lastMove?.fromCellId
    ? cells.find((cell) => cell.id === match.lastMove.fromCellId)
    : null;
  const lastToCell = match?.lastMove?.toCellId
    ? cells.find((cell) => cell.id === match.lastMove.toCellId)
    : null;

  function mapX(value) {
    return 20 + ((value - minX) / Math.max(1, maxX - minX)) * 160;
  }

  function mapY(value) {
    return 16 + ((value - minY) / Math.max(1, maxY - minY)) * 188;
  }

  const campPolygons = getJumpCampPolygons(cells, mapX, mapY);
  const boardTrace = getJumpBoardTrace(cells, mapX, mapY);
  const boardPlate = expandPolygonFromCentroid(boardTrace, 10);
  const starOutline = expandPolygonFromCentroid(boardTrace, 18);

  function onCellClick(cell) {
    if (!match) {
      return;
    }

    const cellMoves = legalMoves[cell.id] || [];
    if (cellMoves.length > 0) {
      setSelectedPiece((current) => (current === cell.id ? null : cell.id));
      return;
    }

    if (selectedPiece && legalTargets.has(cell.id)) {
      emitMove({ fromCellId: selectedPiece, toCellId: cell.id });
      setSelectedPiece(null);
      return;
    }

    setSelectedPiece(null);
  }

  return (
    <div className={styles.jumpWrap}>
      {!match ? (
        <div className={styles.boardWaitingOverlay}>
          <strong>等待棋手准备</strong>
          <span>{room.config.maxPlayers} 位棋手全部准备后会立即点亮完整星盘。</span>
        </div>
      ) : null}
      <svg
        className={styles.jumpBoard}
        viewBox="0 0 200 220"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="跳棋棋盘"
      >
        <defs>
          <linearGradient id="jumpBoardGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffd69d" />
            <stop offset="100%" stopColor="#b57c39" />
          </linearGradient>
          <radialGradient id="pieceRed" cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#ffd6d0" />
            <stop offset="48%" stopColor="#ff755f" />
            <stop offset="100%" stopColor="#81281f" />
          </radialGradient>
          <radialGradient id="pieceAmber" cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#ffe4bf" />
            <stop offset="48%" stopColor="#ffae57" />
            <stop offset="100%" stopColor="#7c4514" />
          </radialGradient>
          <radialGradient id="pieceGold" cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#fff2c4" />
            <stop offset="48%" stopColor="#ffd059" />
            <stop offset="100%" stopColor="#86611a" />
          </radialGradient>
          <radialGradient id="pieceGreen" cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#ddffd7" />
            <stop offset="48%" stopColor="#53db7d" />
            <stop offset="100%" stopColor="#1d6a33" />
          </radialGradient>
          <radialGradient id="pieceBlue" cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#dce8ff" />
            <stop offset="48%" stopColor="#6fa8ff" />
            <stop offset="100%" stopColor="#234d8d" />
          </radialGradient>
          <radialGradient id="pieceViolet" cx="34%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#efdcff" />
            <stop offset="48%" stopColor="#b981ff" />
            <stop offset="100%" stopColor="#5a2891" />
          </radialGradient>
        </defs>

        <g className={styles.jumpCampLayer}>
          <polygon points={toSvgPointList(boardPlate)} className={styles.jumpBoardPlate} />
          <polygon
            points={toSvgPointList(starOutline)}
            className={styles.jumpStarOutline}
          />
          {campPolygons.map((polygon) => (
            <polygon
              key={polygon.campKey}
              points={toSvgPointList(polygon.points)}
              className={
                polygon.campKey === "center" ? styles.jumpCenterPlate : styles.jumpCampPlate
              }
              style={getJumpCampBackdrop(polygon.campKey)}
            />
          ))}
        </g>

        {lastFromCell && lastToCell ? (
          <g className={styles.jumpTraceGroup}>
            <line
              x1={mapX(lastFromCell.x)}
              y1={mapY(lastFromCell.y)}
              x2={mapX(lastToCell.x)}
              y2={mapY(lastToCell.y)}
              className={styles.jumpTrace}
            />
            <circle cx={mapX(lastFromCell.x)} cy={mapY(lastFromCell.y)} r={7.8} className={styles.jumpTracePulse} />
            <circle cx={mapX(lastToCell.x)} cy={mapY(lastToCell.y)} r={8.8} className={styles.jumpTraceTarget} />
          </g>
        ) : null}

        {cells.map((cell) => {
          const x = mapX(cell.x);
          const y = mapY(cell.y);
          const isSelected = selectedPiece === cell.id;
          const isTarget = legalTargets.has(cell.id);
          const occupantSeat = cell.occupantSeat;
          const occupantToken =
            occupantSeat === null ? null : playerBySeat[occupantSeat]?.pieceToken || "red";
          return (
            <g
              key={cell.id}
              data-jump-cell={cell.id}
              data-jump-occupant={occupantSeat === null ? "empty" : String(occupantSeat)}
              data-jump-movable={legalMoves[cell.id]?.length ? "true" : "false"}
              data-jump-target={legalTargets.has(cell.id) ? "true" : "false"}
              className={styles.jumpCellGroup}
              onClick={() => onCellClick(cell)}
            >
              <circle
                cx={x}
                cy={y}
                r={8.7}
                fill={getCampGlow(cell.camp)}
                className={styles.jumpCampAura}
              />
              <circle
                cx={x}
                cy={y}
                r={6.6}
                className={`${styles.jumpHole} ${
                  isSelected ? styles.jumpSelected : isTarget ? styles.jumpTarget : ""
                }`}
              />
              {occupantSeat !== null ? (
                <>
                  <circle cx={x} cy={y + 1} r={5.8} className={styles.jumpPieceShadow} />
                  <circle
                    cx={x}
                    cy={y}
                    r={5.3}
                    className={styles.jumpPiece}
                    fill={`url(#${getPieceGradientId(occupantToken)})`}
                  />
                  <circle
                    cx={x - 1.6}
                    cy={y - 1.8}
                    r={1.6}
                    className={styles.jumpPieceGleam}
                  />
                </>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TurnTimer({ remainingMs, durationMs, label }) {
  const progress = Math.max(0, Math.min(1, remainingMs / Math.max(1, durationMs || 1)));
  return (
    <div
      className={`${styles.timer} ${durationMs && progress <= 0.25 ? styles.timerUrgent : ""}`}
      style={{
        background: `conic-gradient(#ffd978 ${progress * 360}deg, rgba(255,255,255,0.08) 0deg)`
      }}
    >
      <div className={styles.timerInner}>
        <strong>{Math.max(0, Math.ceil(remainingMs / 1000))}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function getTurnHint(room, mySeat, selectedPiece) {
  if (!mySeat) {
    return "加入房间后即可开始对弈。";
  }

  if (!room.match?.viewerCanMove) {
    return `等待 ${room.players[room.match?.turnSeat || 0]?.displayName || "对手"} 操作。`;
  }

  if (room.gameKey === "gomoku") {
    if (room.config.openingRule === "center-opening" && room.match?.moveCount === 0) {
      return "本局採用天元开局，首手必须落在棋盘中心。";
    }

    return "点击棋盘交叉点即可落子，五连成线直接获胜。";
  }

  if (room.gameKey === "reversi") {
    return "只能落在高亮位置，必須形成包夾翻面；若沒有合法落點會自動過手。";
  }

  if (selectedPiece) {
    return room.gameKey === "gomoku"
      ? "已选中落点。"
      : "已选中棋子，点击高亮孔位完成走子；可借任意已占用棋子连续跳进。";
  }

  return `${mySeat.pieceLabel} 从 ${mySeat.campLabel} 出发，目标是 ${mySeat.targetCampLabel}，先点棋子，再用高亮孔位走子或借任何已占用棋子连跳。`;
}

function getViewerNotes(room, mySeat) {
  if (!mySeat) {
    return [];
  }

  if (room.gameKey === "gomoku") {
    return [
      `${mySeat.pieceLabel} ${mySeat.seatIndex === 0 ? "先手" : "后手"}，在 15 路棋盘中抢先形成五连。`,
      room.config.openingRule === "center-opening"
        ? "本局採用天元开局，首手必须先占住棋盘中心。"
        : "本局採用標準开局，首手可自由选择空位。"
    ];
  }

  if (room.gameKey === "reversi") {
    return [
      `${mySeat.pieceLabel} ${
        mySeat.seatIndex === 0 ? "先手" : "後手"
      }，開局四子固定落在棋盤中央。`,
      "角位最穩，邊線次之；沒有合法落點時系統會自動過手。"
    ];
  }

  return [
    `${mySeat.pieceLabel} 从 ${mySeat.campLabel} 出发，目标是占满 ${mySeat.targetCampLabel}。`,
    `${room.config.maxPlayers} 人轮转制中，可借任意已占用棋子起跳，优先制造长连跳会更容易一口气穿场。`
  ];
}

function getCampGlow(campKey) {
  return {
    top: "rgba(255, 103, 90, 0.16)",
    upperRight: "rgba(255, 175, 90, 0.14)",
    lowerRight: "rgba(255, 213, 89, 0.14)",
    bottom: "rgba(85, 223, 132, 0.15)",
    lowerLeft: "rgba(108, 167, 255, 0.14)",
    upperLeft: "rgba(186, 126, 255, 0.14)"
  }[campKey] || "rgba(255,255,255,0.04)";
}

function getPieceGradientId(token) {
  return {
    red: "pieceRed",
    amber: "pieceAmber",
    gold: "pieceGold",
    green: "pieceGreen",
    blue: "pieceBlue",
    violet: "pieceViolet"
  }[token] || "pieceRed";
}

function getPieceSwatch(token) {
  return {
    red: "radial-gradient(circle at 30% 30%, #ffd6d0, #ff755f 56%, #81281f 100%)",
    amber: "radial-gradient(circle at 30% 30%, #ffe4bf, #ffae57 56%, #7c4514 100%)",
    gold: "radial-gradient(circle at 30% 30%, #fff2c4, #ffd059 56%, #86611a 100%)",
    green: "radial-gradient(circle at 30% 30%, #ddffd7, #53db7d 56%, #1d6a33 100%)",
    blue: "radial-gradient(circle at 30% 30%, #dce8ff, #6fa8ff 56%, #234d8d 100%)",
    violet: "radial-gradient(circle at 30% 30%, #efdcff, #b981ff 56%, #5a2891 100%)"
  }[token] || "radial-gradient(circle at 30% 30%, #ffd6d0, #ff755f 56%, #81281f 100%)";
}

function createChineseCheckersDisplayCells() {
  const cells = [];
  for (let row = 0; row < CHINESE_CHECKERS_ROW_LENGTHS.length; row += 1) {
    const length = CHINESE_CHECKERS_ROW_LENGTHS[row];
    const xStart = -((length - 1) / 2);
    for (let index = 0; index < length; index += 1) {
      cells.push({
        id: `c${row}_${index}`,
        row,
        index,
        x: xStart + index,
        y: row * CHINESE_VERTICAL_GAP,
        camp: getChineseCheckersDisplayCampKey(row, index, length),
        occupantSeat: null
      });
    }
  }

  return cells;
}

function getChineseCheckersDisplayCampKey(row, index, length) {
  if (row <= 3) {
    return "top";
  }

  if (row >= 13) {
    return "bottom";
  }

  if (row >= 4 && row <= 7) {
    const edgeSize = 8 - row;
    if (index < edgeSize) {
      return "upperLeft";
    }
    if (index >= length - edgeSize) {
      return "upperRight";
    }
  }

  if (row >= 9 && row <= 12) {
    const edgeSize = row - 8;
    if (index < edgeSize) {
      return "lowerLeft";
    }
    if (index >= length - edgeSize) {
      return "lowerRight";
    }
  }

  return "center";
}

function getJumpCampPolygons(cells, mapX, mapY) {
  const groups = new Map();
  for (const cell of cells) {
    const points = groups.get(cell.camp) || [];
    points.push({ x: mapX(cell.x), y: mapY(cell.y) });
    groups.set(cell.camp, points);
  }

  return ["center", "top", "upperRight", "lowerRight", "bottom", "lowerLeft", "upperLeft"]
    .map((campKey) => {
      const points = groups.get(campKey) || [];
      const hull = buildConvexHull(points);
      if (hull.length < 3) {
        return null;
      }

      return {
        campKey,
        points: expandPolygonFromCentroid(hull, campKey === "center" ? 16 : 22)
      };
    })
    .filter(Boolean);
}

function buildConvexHull(points) {
  const sorted = Array.from(
    new Map(points.map((point) => [`${point.x}:${point.y}`, point])).values()
  ).sort((left, right) => {
    if (left.x === right.x) {
      return left.y - right.y;
    }
    return left.x - right.x;
  });

  if (sorted.length <= 1) {
    return sorted;
  }

  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function cross(origin, left, right) {
  return (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x);
}

function expandPolygonFromCentroid(points, padding) {
  const centroid = {
    x: points.reduce((sum, point) => sum + point.x, 0) / Math.max(1, points.length),
    y: points.reduce((sum, point) => sum + point.y, 0) / Math.max(1, points.length)
  };

  return points.map((point) => {
    const dx = point.x - centroid.x;
    const dy = point.y - centroid.y;
    const distance = Math.hypot(dx, dy) || 1;
    return {
      x: point.x + (dx / distance) * padding,
      y: point.y + (dy / distance) * padding
    };
  });
}

function toSvgPointList(points) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
}

function getJumpBoardTrace(cells, mapX, mapY) {
  const rows = new Map();

  for (const cell of cells) {
    const rowCells = rows.get(cell.row) || [];
    rowCells.push(cell);
    rows.set(cell.row, rowCells);
  }

  const orderedRows = [...rows.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([, rowCells]) => rowCells.sort((left, right) => left.x - right.x));

  return dedupePolygonPoints([
    ...orderedRows.map((rowCells) => ({
      x: mapX(rowCells[0].x),
      y: mapY(rowCells[0].y)
    })),
    ...orderedRows
      .slice()
      .reverse()
      .map((rowCells) => ({
        x: mapX(rowCells[rowCells.length - 1].x),
        y: mapY(rowCells[rowCells.length - 1].y)
      }))
  ]);
}

function dedupePolygonPoints(points) {
  return points.filter((point, index) => {
    const previous = points[index - 1];
    if (!previous) {
      return true;
    }

    return Math.hypot(point.x - previous.x, point.y - previous.y) > 0.12;
  });
}

function getJumpCampBackdrop(campKey) {
  return {
    top: {
      fill: "rgba(255, 118, 96, 0.16)",
      stroke: "rgba(255, 192, 180, 0.46)"
    },
    upperRight: {
      fill: "rgba(255, 176, 92, 0.16)",
      stroke: "rgba(255, 214, 158, 0.42)"
    },
    lowerRight: {
      fill: "rgba(255, 214, 97, 0.16)",
      stroke: "rgba(255, 232, 168, 0.42)"
    },
    bottom: {
      fill: "rgba(86, 216, 129, 0.16)",
      stroke: "rgba(178, 255, 205, 0.42)"
    },
    lowerLeft: {
      fill: "rgba(112, 170, 255, 0.16)",
      stroke: "rgba(190, 216, 255, 0.42)"
    },
    upperLeft: {
      fill: "rgba(192, 136, 255, 0.16)",
      stroke: "rgba(227, 198, 255, 0.42)"
    },
    center: {
      fill: "rgba(255, 241, 205, 0.08)",
      stroke: "rgba(255, 226, 174, 0.34)"
    }
  }[campKey] || {
    fill: "rgba(255,255,255,0.04)",
    stroke: "rgba(255,255,255,0.16)"
  };
}

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
}

function getBoardResultTitle(room, mySeat) {
  if (!room?.lastResult) {
    return "";
  }

  if (mySeat && typeof room.lastResult.winnerSeat === "number") {
    return room.lastResult.winnerSeat === mySeat.seatIndex ? "你赢了" : "你输了";
  }

  return room.lastResult.headline;
}

function getBoardResultSubtitle(room, mySeat) {
  if (!room?.lastResult) {
    return "";
  }

  const detail = room.lastResult.detail || room.lastResult.headline;
  const viewerDelta =
    room.lastResult.deltas?.find((entry) => entry.seatIndex === mySeat?.seatIndex)?.delta ?? null;
  if (mySeat && typeof room.lastResult.winnerSeat === "number") {
    return room.lastResult.winnerSeat === mySeat.seatIndex
      ? `${detail}${viewerDelta !== null ? ` · 金币 ${formatSigned(viewerDelta)}` : ""}`
      : `${room.lastResult.headline} · ${detail}${viewerDelta !== null ? ` · 金币 ${formatSigned(viewerDelta)}` : ""}`;
  }

  return detail;
}

function getBoardResultBadges(room, mySeat) {
  if (!room?.lastResult) {
    return [];
  }

  return [
    room.gameKey === "gomoku" ? "五子棋" : room.gameKey === "reversi" ? "黑白棋" : "中国跳棋",
    `房号 ${room.roomNo}`,
    mySeat
      ? typeof room.lastResult.winnerSeat === "number"
        ? room.lastResult.winnerSeat === mySeat.seatIndex
          ? "本局胜利"
          : "本局失利"
        : "本局结束"
      : room.lastResult.headline
  ];
}

function getBoardResultRows(room) {
  if (!room?.lastResult) {
    return [];
  }

  return room.players.map((player) => {
    const didWin =
      typeof room.lastResult.winnerSeat === "number" &&
      room.lastResult.winnerSeat === player.seatIndex;
    const delta =
      room.lastResult.deltas?.find((entry) => entry.seatIndex === player.seatIndex)?.delta || 0;
    return {
      label: player.displayName,
      meta: [
        player.pieceLabel,
        player.campLabel ? `${player.campLabel} → ${player.targetCampLabel}` : null,
        typeof room.lastResult.winnerSeat === "number" ? (didWin ? "胜利" : "失利") : "平局"
      ]
        .filter(Boolean)
        .join(" · "),
      value: formatSigned(delta),
      tone:
        delta > 0 ? "positive" : delta < 0 ? "negative" : "neutral"
    };
  });
}

function buildBoardGuestClaim(room, session, mySeat) {
  const viewerDelta =
    room?.lastResult?.deltas?.find((entry) => entry.seatIndex === mySeat?.seatIndex)?.delta ?? null;
  const didWin =
    typeof room?.lastResult?.winnerSeat === "number" &&
    room.lastResult.winnerSeat === mySeat?.seatIndex;

  return {
    guestId: session.guestId || session.id,
    gameKey: room.gameKey,
    roomNo: room.roomNo,
    familyKey: "board",
    returnTo: getCurrentBoardRoute("", room.roomNo, { detailRoutePrefix: room.gameKey === "reversi" ? "/reversi" : "/board" }),
    summary: {
      title: room.title,
      headline: room.lastResult?.headline || "",
      detail: room.lastResult?.detail || "",
      viewerDisplayName: session.displayName,
      delta: viewerDelta,
      outcome:
        typeof room?.lastResult?.winnerSeat === "number"
          ? didWin
            ? "win"
            : "loss"
          : "draw"
    }
  };
}

function getBoardThemeClass(gameKey) {
  if (gameKey === "gomoku") {
    return styles.themeGomoku;
  }

  if (gameKey === "reversi") {
    return styles.themeReversi;
  }

  return styles.themeChinesecheckers;
}

function getCurrentBoardRoute(asPath, roomNo, meta = null) {
  const normalizedAsPath = String(asPath || "").split("?")[0];
  if (normalizedAsPath && /\d{6}$/.test(normalizedAsPath)) {
    return normalizedAsPath;
  }

  const prefix = meta?.detailRoutePrefix || "/board";
  return `${prefix}/${roomNo}`.replace(/\/+/g, "/");
}

function formatSigned(value) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : ""}${amount}`;
}
