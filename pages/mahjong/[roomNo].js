import { io } from "socket.io-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import SiteLayout from "../../components/SiteLayout";
import GameIcon from "../../components/game-hub/GameIcon";
import {
  getPresenceLabel,
  getPresenceState,
  getRecoveryBannerMessage
} from "../../lib/client/room-entry";
import { API_ROUTES, SOCKET_EVENTS, apiFetch, getSocketUrl } from "../../lib/client/api";
import styles from "../../styles/MahjongRoom.module.css";

const { getGameMeta } = require("../../lib/games/catalog");

let socket;
const MAHJONG_EVENTS = SOCKET_EVENTS.mahjong;
const ROOM_LOAD_RETRY_DELAYS_MS = [0, 350, 900];
const RETRYABLE_ROOM_LOAD_STATUSES = new Set([404, 408, 425, 429, 500, 502, 503, 504]);

const SUIT_LABELS = { 0: "萬", 1: "條", 2: "筒", 3: "風", 4: "箭", 5: "花" };
const SUIT_CLASS_MAP = { 0: "tileWan", 1: "tileTiao", 2: "tileTong", 3: "tileFeng", 4: "tileJian", 5: "tileHua" };

function getTileLabel(tile) {
  if (!tile) return "";
  if (tile.label) return tile.label;
  const suitLabel = SUIT_LABELS[tile.suit] || "";
  return `${tile.rank}${suitLabel}`;
}

function getTileSuitClass(tile) {
  return styles[SUIT_CLASS_MAP[tile.suit]] || "";
}

function sortTiles(tiles) {
  if (!tiles) return [];
  return [...tiles].sort((a, b) => {
    if (a.suit !== b.suit) return a.suit - b.suit;
    return a.rank - b.rank;
  });
}

export default function MahjongRoomPage() {
  const router = useRouter();
  const { roomNo } = router.query;
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [roomLoadState, setRoomLoadState] = useState("loading");
  const [roomLoadError, setRoomLoadError] = useState("");
  const [socketConnected, setSocketConnected] = useState(null);
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedTileId, setSelectedTileId] = useState(null);
  const [recoveryRestoreNotice, setRecoveryRestoreNotice] = useState("");
  const messageTimerRef = useRef(null);
  const recoveryTimerRef = useRef(null);
  const previousSocketConnectedRef = useRef(null);
  const roomLoadRequestRef = useRef(0);

  const meta = useMemo(() => getGameMeta("mahjong"), []);
  const mySeat = room?.viewer || null;
  const players = room?.players || [];
  const round = room?.round || null;
  const hands = room?.hands || [];
  const sortedHands = useMemo(() => sortTiles(hands), [hands]);
  const isMyTurn = round?.currentTurn === mySeat?.seatIndex;
  const hasDrawn = hands.length === 14;
  const phaseRemainingMs = round?.turnEndsAt ? Math.max(0, round.turnEndsAt - nowMs) : 0;
  const isTimerUrgent = phaseRemainingMs > 0 && phaseRemainingMs < 5000;
  const socketReady = socketConnected === true;
  const recoveryBanner = getRecoveryBannerMessage(mySeat, socketConnected, nowMs);
  const recoveryNotice = recoveryBanner || recoveryRestoreNotice;
  const pendingClaim = round?.pendingClaim || null;
  const feed = room?.feed || [];
  const lastResult = room?.lastResult || null;

  useEffect(() => {
    if (!roomNo) return;
    let cancelled = false;
    async function loadMe() {
      try {
        const response = await apiFetch(API_ROUTES.me());
        if (!cancelled && response.ok) {
          const data = await response.json();
          setMe(data.user || null);
        }
      } catch { /* ignore */ }
    }
    loadMe();
    return () => { cancelled = true; };
  }, [roomNo]);

  useEffect(() => {
    if (!roomNo) return;
    let cancelled = false;
    const requestId = ++roomLoadRequestRef.current;

    async function loadRoom() {
      setRoomLoadState("loading");
      setRoomLoadError("");
      for (const delay of ROOM_LOAD_RETRY_DELAYS_MS) {
        if (cancelled || requestId !== roomLoadRequestRef.current) return;
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        try {
          const response = await apiFetch(API_ROUTES.mahjongRooms.detail(roomNo));
          if (cancelled || requestId !== roomLoadRequestRef.current) return;
          if (response.ok) {
            const data = await response.json();
            setRoom(data.room || null);
            setRoomLoadState("ready");
            return;
          }
          if (!RETRYABLE_ROOM_LOAD_STATUSES.has(response.status)) {
            const data = await response.json().catch(() => ({}));
            setRoomLoadError(data.error || "無法載入房間");
            setRoomLoadState("error");
            return;
          }
        } catch { /* retry */ }
      }
      if (!cancelled && requestId === roomLoadRequestRef.current) {
        setRoomLoadError("載入房間失敗，請稍後再試");
        setRoomLoadState("error");
      }
    }
    loadRoom();
    return () => { cancelled = true; };
  }, [roomNo]);

  useEffect(() => {
    if (!roomNo || roomLoadState !== "ready") return;
    const socketUrl = getSocketUrl();
    socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"]
    });

    socket.on("connect", () => {
      setSocketConnected(true);
      socket.emit(MAHJONG_EVENTS.subscribe, { roomNo });
    });
    socket.on("disconnect", () => setSocketConnected(false));
    socket.on(MAHJONG_EVENTS.update, ({ room: updatedRoom }) => {
      setRoom(updatedRoom);
    });
    socket.on(MAHJONG_EVENTS.error, ({ error }) => {
      setMessage(error);
      clearTimeout(messageTimerRef.current);
      messageTimerRef.current = setTimeout(() => setMessage(""), 3000);
    });

    return () => {
      if (socket) { socket.disconnect(); socket = null; }
      setSocketConnected(null);
    };
  }, [roomNo, roomLoadState]);

  useEffect(() => {
    if (previousSocketConnectedRef.current === false && socketConnected === true && roomNo) {
      socket?.emit(MAHJONG_EVENTS.subscribe, { roomNo });
      setRecoveryRestoreNotice("已恢復連線");
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = setTimeout(() => setRecoveryRestoreNotice(""), 3000);
    }
    previousSocketConnectedRef.current = socketConnected;
  }, [socketConnected, roomNo]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(messageTimerRef.current);
      clearTimeout(recoveryTimerRef.current);
    };
  }, []);

  function handleReady() {
    if (!socket || !roomNo) return;
    socket.emit(MAHJONG_EVENTS.ready, { roomNo, ready: true });
  }

  function handleTileClick(tileId) {
    if (!isMyTurn) return;
    setSelectedTileId((prev) => (prev === tileId ? null : tileId));
  }

  function handleDraw() {
    if (!socket || !roomNo || !isMyTurn || hasDrawn) return;
    socket.emit(MAHJONG_EVENTS.draw, { roomNo });
  }

  function handleDiscard() {
    if (!socket || !roomNo || !isMyTurn || !selectedTileId || !hasDrawn) return;
    socket.emit(MAHJONG_EVENTS.discard, { roomNo, tileId: selectedTileId });
    setSelectedTileId(null);
  }

  function handleClaim(claimType) {
    if (!socket || !roomNo || !pendingClaim) return;
    socket.emit(MAHJONG_EVENTS.claim, { roomNo, type: claimType, tileId: pendingClaim.tile?.id });
  }

  function handlePassClaim() {
    if (!socket || !roomNo) return;
    socket.emit(MAHJONG_EVENTS.passClaim, { roomNo });
  }

  function handleJoin() {
    if (!roomNo || joining) return;
    setJoining(true);
    apiFetch(API_ROUTES.mahjongRooms.join(roomNo), { method: "POST" })
      .then((res) => res.json())
      .then((data) => { if (data.room) setRoom(data.room); })
      .catch(() => {})
      .finally(() => setJoining(false));
  }

  function handlePlayAgain() {
    if (!socket || !roomNo) return;
    socket.emit(MAHJONG_EVENTS.ready, { roomNo, ready: true });
  }

  const opponents = players.filter((p) => p.userId !== me?.id);
  const myPlayer = players.find((p) => p.userId === me?.id);

  if (roomLoadState === "loading") {
    return (
      <SiteLayout>
        <div className={styles.container}>
          <div className={styles.loading}>載入中...</div>
        </div>
      </SiteLayout>
    );
  }

  if (roomLoadState === "error") {
    return (
      <SiteLayout>
        <div className={styles.container}>
          <div className={styles.error}>{roomLoadError}</div>
        </div>
      </SiteLayout>
    );
  }

  const isWaiting = round?.stage === "waiting" || room?.state === "waiting";
  const isPlaying = round?.stage === "playing";
  const isFinished = round?.stage === "finished";

  return (
    <SiteLayout>
      <div className={styles.container}>
        {recoveryNotice && (
          <div className={styles.recoveryBanner} data-presence-state={getPresenceState(mySeat)}>
            {recoveryNotice}
          </div>
        )}
        {message && <div className={styles.message}>{message}</div>}

        <div className={styles.header}>
          <div className={styles.title}>
            <GameIcon gameKey="mahjong" className={styles.titleIcon} />
            <span>{meta?.title || "麻將"}</span>
          </div>
          <div className={styles.roomNo}>房號: {roomNo}</div>
        </div>

        {isWaiting && (
          <div className={styles.waitingSection}>
            <div className={styles.playerList}>
              {players.map((player) => (
                <div key={player.userId} className={styles.playerItem}>
                  <span className={styles.playerName}>{player.displayName}</span>
                  <span className={styles.readyBadge}>
                    {player.ready ? "已準備" : "未準備"}
                  </span>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className={styles.playerItem}>
                  <span className={styles.playerName}>等待加入...</span>
                </div>
              ))}
            </div>
            {myPlayer && !myPlayer.ready && (
              <button className={styles.readyButton} onClick={handleReady}>準備</button>
            )}
            {!myPlayer && (
              <button className={styles.joinButton} onClick={handleJoin} disabled={joining}>
                {joining ? "加入中..." : "加入房間"}
              </button>
            )}
          </div>
        )}

        {(isPlaying || isFinished) && (
          <div className={styles.gameArea}>
            {/* Opponents */}
            <div className={styles.opponentsArea}>
              {opponents.map((opp) => {
                const oppMelds = round?.melds?.[opp.seatIndex] || [];
                const oppFlowers = round?.flowers?.[opp.seatIndex] || [];
                return (
                  <div
                    key={opp.userId}
                    className={`${styles.opponentCard} ${
                      round?.currentTurn === opp.seatIndex ? styles.activeOpponent : ""
                    }`}
                  >
                    <span className={styles.opponentName}>{opp.displayName}</span>
                    <span className={styles.handCount}>{opp.handCount} 張</span>
                    {round?.currentTurn === opp.seatIndex && (
                      <div className={styles.turnBadge}>出牌中</div>
                    )}
                    {oppMelds.length > 0 && (
                      <div className={styles.meldGroup}>
                        {oppMelds.map((tile, i) => (
                          <div key={tile.id || i} className={`${styles.meldTile} ${getTileSuitClass(tile)}`}>
                            {getTileLabel(tile)}
                          </div>
                        ))}
                      </div>
                    )}
                    {oppFlowers.length > 0 && (
                      <div className={styles.flowersArea}>
                        {oppFlowers.map((tile, i) => (
                          <div key={tile.id || i} className={styles.flowerTile}>
                            {getTileLabel(tile)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Table area */}
            <div className={styles.tableArea}>
              <div className={styles.tableInfo}>
                {round?.wallCount != null && <span>牌牆: {round.wallCount}</span>}
                {round?.deadWallCount != null && <span>嶺上: {round.deadWallCount}</span>}
              </div>
              {round?.discards && (
                <div className={styles.discardSection}>
                  {players.map((player) => {
                    const discards = round.discards[player.seatIndex] || [];
                    if (discards.length === 0) return null;
                    return (
                      <div key={player.seatIndex} className={styles.discardRow}>
                        <span className={styles.discardLabel}>{player.displayName}</span>
                        <div className={styles.discardPile}>
                          {discards.map((tile, i) => {
                            const isLastDiscard = pendingClaim?.tile?.id === tile.id;
                            return (
                              <div
                                key={tile.id || i}
                                className={`${styles.smallTile} ${getTileSuitClass(tile)} ${
                                  isLastDiscard ? styles.lastDiscardHighlight : ""
                                }`}
                              >
                                {getTileLabel(tile)}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My area */}
            <div className={styles.myArea}>
              <div className={styles.myInfo}>
                <span className={styles.myName}>{mySeat?.displayName || "你"}</span>
                {isMyTurn && <div className={styles.turnIndicator}>你的回合</div>}
                {isMyTurn && round?.turnEndsAt && (
                  <div className={`${styles.timer} ${isTimerUrgent ? styles.urgent : ""}`}>
                    {Math.ceil(phaseRemainingMs / 1000)}s
                  </div>
                )}
              </div>

              {/* My flowers */}
              {round?.flowers?.[mySeat?.seatIndex]?.length > 0 && (
                <div className={styles.flowersArea}>
                  {round.flowers[mySeat.seatIndex].map((tile, i) => (
                    <div key={tile.id || i} className={styles.flowerTile}>
                      {getTileLabel(tile)}
                    </div>
                  ))}
                </div>
              )}

              {/* My hand */}
              <div className={styles.myHand}>
                {sortedHands.map((tile) => (
                  <div
                    key={tile.id}
                    className={`${styles.tileCard} ${getTileSuitClass(tile)} ${
                      selectedTileId === tile.id ? styles.selectedTile : ""
                    }`}
                    onClick={() => handleTileClick(tile.id)}
                  >
                    <span className={styles.tileLabel}>{getTileLabel(tile)}</span>
                    <span className={styles.tileSuit}>{SUIT_LABELS[tile.suit] || ""}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action buttons */}
            <div className={styles.actionBar}>
              {isMyTurn && !hasDrawn && (
                <button className={styles.actionButton} onClick={handleDraw}>
                  摸牌
                </button>
              )}
              {isMyTurn && hasDrawn && selectedTileId && (
                <button className={styles.actionButton} onClick={handleDiscard}>
                  出牌
                </button>
              )}
            </div>

            {/* Claim bar */}
            {pendingClaim && (
              <div className={styles.claimBar}>
                <div className={styles.pendingClaimInfo}>
                  {pendingClaim.tile && (
                    <span>有人打出: {getTileLabel(pendingClaim.tile)}</span>
                  )}
                </div>
                {pendingClaim.claims?.includes("chi") && (
                  <button className={`${styles.claimButton} ${styles.claimChi}`} onClick={() => handleClaim("chi")}>
                    吃
                  </button>
                )}
                {pendingClaim.claims?.includes("pong") && (
                  <button className={`${styles.claimButton} ${styles.claimPong}`} onClick={() => handleClaim("pong")}>
                    碰
                  </button>
                )}
                {pendingClaim.claims?.includes("kong") && (
                  <button className={`${styles.claimButton} ${styles.claimKong}`} onClick={() => handleClaim("kong")}>
                    槓
                  </button>
                )}
                {pendingClaim.claims?.includes("win") && (
                  <button className={`${styles.claimButton} ${styles.claimWin}`} onClick={() => handleClaim("win")}>
                    胡
                  </button>
                )}
                <button className={`${styles.claimButton} ${styles.claimPass}`} onClick={handlePassClaim}>
                  過
                </button>
              </div>
            )}

            {/* Feed */}
            {feed.length > 0 && (
              <div className={styles.feedArea}>
                {feed.slice(-8).map((item, i) => (
                  <div key={i} className={styles.feedItem}>{item.text}</div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Result overlay */}
        {isFinished && lastResult && (
          <div className={styles.resultOverlay}>
            <div className={styles.resultCard}>
              <div className={styles.resultHeadline}>{lastResult.headline}</div>
              {lastResult.detail && (
                <div className={styles.resultDetail}>{lastResult.detail}</div>
              )}
              {lastResult.fans && lastResult.fans.length > 0 && (
                <div className={styles.fanList}>
                  {lastResult.fans.map((fan, i) => (
                    <div key={i} className={styles.fanItem}>
                      <span className={styles.fanName}>{fan.name || fan.label}</span>
                      <span className={styles.fanValue}>{fan.fan || fan.value} 番</span>
                    </div>
                  ))}
                </div>
              )}
              {lastResult.totalFan != null && (
                <div className={styles.totalFan}>總計: {lastResult.totalFan} 番</div>
              )}
              <button className={styles.playAgainButton} onClick={handlePlayAgain}>
                再來一局
              </button>
            </div>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

export async function getServerSideProps(context) {
  const { roomNo } = context.params;
  return { props: { roomNo } };
}
