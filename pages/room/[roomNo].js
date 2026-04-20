import { io } from "socket.io-client";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import CardArtwork from "../../components/game/CardArtwork";
import MatchResultOverlay from "../../components/MatchResultOverlay";
import SiteLayout from "../../components/SiteLayout";
import { createGameAudio } from "../../lib/game-ui/audio";
import { apiFetch, getSocketUrl } from "../../lib/client/api";
import styles from "../../styles/GameRoom.module.css";

const { evaluateCards, compareCombos, listSuggestedPlays } = require("../../lib/game/combo");

let socket;
const CHAT_PRESETS = ["要不起", "穩一手", "炸他", "這把看我", "別慌", "春天來了"];
const EMOJI_PRESETS = ["😎", "😤", "🤯", "😂", "😈", "👏"];

export default function RoomPage() {
  const router = useRouter();
  const { roomNo } = router.query;
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);
  const [selectedCards, setSelectedCards] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [playedAnimation, setPlayedAnimation] = useState(null);
  const [outgoingAnimation, setOutgoingAnimation] = useState(null);
  const [specialEffect, setSpecialEffect] = useState(null);
  const [chatBubbles, setChatBubbles] = useState({});
  const [showRotateHint, setShowRotateHint] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  const [dealSequence, setDealSequence] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [handLayout, setHandLayout] = useState({
    railWidth: 0,
    cardWidth: 118
  });
  const [playLayout, setPlayLayout] = useState({
    zoneWidth: 0,
    cardWidth: 102
  });
  const [pendingAction, setPendingAction] = useState(null);
  const [hintCursor, setHintCursor] = useState(0);
  const [dismissedResultKey, setDismissedResultKey] = useState("");
  const audioRef = useRef(null);
  const roomRef = useRef(null);
  const handRef = useRef(null);
  const playZoneRef = useRef(null);
  const sceneRef = useRef(null);
  const messageTimerRef = useRef(null);
  const dealTimerRef = useRef(null);
  const lastChatIdRef = useRef(null);
  const chatBubbleTimersRef = useRef({});
  const dragRef = useRef({
    active: false,
    anchorIndex: null,
    currentIndex: null,
    pointerId: null,
    moved: false
  });

  const mySeat = useMemo(() => {
    if (!room || !me) {
      return null;
    }
    return room.players.find((player) => player.userId === me.id) || null;
  }, [room, me]);

  const myHand = useMemo(() => {
    if (!room || !mySeat) {
      return [];
    }
    return room.round?.hands?.[mySeat.seatIndex] || [];
  }, [room, mySeat]);

  const selectedSet = useMemo(() => new Set(selectedCards), [selectedCards]);
  const selectedHandCards = useMemo(
    () => myHand.filter((card) => selectedSet.has(card.id)),
    [myHand, selectedSet]
  );
  const selectedCombo = useMemo(
    () => (selectedHandCards.length > 0 ? evaluateCards(selectedHandCards) : null),
    [selectedHandCards]
  );
  const selectedCardIndexes = useMemo(
    () =>
      myHand.reduce((indexes, card, index) => {
        if (selectedSet.has(card.id)) {
          indexes.push(index);
        }
        return indexes;
      }, []),
    [myHand, selectedSet]
  );
  const handSignature = useMemo(() => myHand.map((card) => card.id).join("|"), [myHand]);
  const lastPlayCombo = useMemo(() => {
    const lastCards = room?.round?.lastPlay?.cards || [];
    return lastCards.length > 0 ? evaluateCards(lastCards) : null;
  }, [room?.round?.lastPlay?.playId]);

  const seatsBySlot = useMemo(() => {
    if (!room) {
      return {};
    }

    const mapped = {};
    for (const player of room.players) {
      mapped[getSeatSlot(player.seatIndex, mySeat?.seatIndex)] = player;
    }
    return mapped;
  }, [room, mySeat]);

  const currentTurnSeat = room?.round?.currentTurn;
  const inRoom = Boolean(mySeat);
  const myTurn = inRoom && currentTurnSeat === mySeat?.seatIndex;
  const canReady = room?.state === "waiting" && inRoom;
  const canAddBot = room?.state === "waiting" && inRoom && room?.ownerId === me?.id;
  const canBid = room?.state === "bidding" && myTurn;
  const canPlay = room?.state === "playing" && myTurn;
  const canPass =
    canPlay && room?.round?.lastPlay && room.round.lastPlay.seatIndex !== mySeat?.seatIndex;
  const bottomCards = room?.round?.bottomCards || [];
  const turnPlayer = room?.players?.find((player) => player.seatIndex === currentTurnSeat);
  const statusText = room ? getStatusText(room, turnPlayer) : "";
  const turnRemainingMs = room?.round?.turnEndsAt
    ? Math.max(0, room.round.turnEndsAt - nowMs)
    : 0;
  const turnDurationMs = room?.round?.turnDurationMs || 1;
  const activeTargetCombo =
    canPlay && room?.round?.lastPlay?.seatIndex !== mySeat?.seatIndex ? lastPlayCombo : null;
  const hintSignature = useMemo(
    () => getComboSignature(activeTargetCombo),
    [activeTargetCombo]
  );
  const hintCombos = useMemo(() => {
    if (!canPlay) {
      return [];
    }
    return listSuggestedPlays(myHand, activeTargetCombo);
  }, [canPlay, handSignature, hintSignature]);
  const canBeatSelection =
    Boolean(selectedCombo) && (!activeTargetCombo || compareCombos(selectedCombo, activeTargetCombo));
  const selectionFeedback = useMemo(
    () =>
      getSelectionFeedback({
        room,
        inRoom,
        myTurn,
        canBid,
        canPlay,
        turnPlayer,
        selectedHandCards,
        selectedCombo,
        activeTargetCombo,
        hintCombos,
        pendingAction
      }),
    [
      room,
      inRoom,
      myTurn,
      canBid,
      canPlay,
      turnPlayer,
      selectedHandCards,
      selectedCombo,
      activeTargetCombo,
      hintCombos,
      pendingAction
    ]
  );
  const assistAnchorStyle = useMemo(
    () => getAssistAnchorStyle(selectedCardIndexes, myHand.length, handLayout),
    [selectedCardIndexes, myHand.length, handLayout]
  );
  const resultKey = room?.lastResult
    ? [
        room.roomNo,
        room.lastResult.winnerSide,
        room.lastResult.multiplier,
        room.lastResult.deltas?.map((item) => `${item.seatIndex}:${item.delta}`).join(","),
        room.feed?.[room.feed.length - 1]?.id || ""
      ].join("|")
    : "";
  const resultOpen = Boolean(room?.lastResult) && dismissedResultKey !== resultKey;

  useEffect(() => {
    audioRef.current = createGameAudio();
    return () => {
      clearTimeout(messageTimerRef.current);
      clearTimeout(dealTimerRef.current);
      Object.values(chatBubbleTimersRef.current).forEach((timer) => clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!room?.round?.turnEndsAt) {
      return undefined;
    }

    setNowMs(Date.now());
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 150);

    return () => clearInterval(timer);
  }, [room?.round?.turnEndsAt]);

  useEffect(() => {
    function handleOrientation() {
      if (typeof window === "undefined") {
        return;
      }
      setShowRotateHint(
        window.innerWidth <= 960 && window.matchMedia("(orientation: portrait)").matches
      );
    }

    handleOrientation();
    window.addEventListener("resize", handleOrientation);
    window.addEventListener("orientationchange", handleOrientation);
    document.addEventListener("fullscreenchange", handleFullscreen);

    return () => {
      window.removeEventListener("resize", handleOrientation);
      window.removeEventListener("orientationchange", handleOrientation);
      document.removeEventListener("fullscreenchange", handleFullscreen);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let frameId = 0;
    let observer;

    const updateHandLayout = () => {
      const rail = handRef.current;
      if (!rail) {
        return;
      }

      const firstCard = rail.querySelector("[data-card-index]");
      const railWidth = Math.round(rail.clientWidth);
      const cardWidth = Math.round(
        firstCard?.getBoundingClientRect?.().width || getFallbackHandCardWidth()
      );

      setHandLayout((current) => {
        if (current.railWidth === railWidth && current.cardWidth === cardWidth) {
          return current;
        }
        return {
          railWidth,
          cardWidth
        };
      });
    };

    const queueUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateHandLayout);
    };

    queueUpdate();

    if (handRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => queueUpdate());
      observer.observe(handRef.current);
    }

    window.addEventListener("resize", queueUpdate);
    window.addEventListener("orientationchange", queueUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener("resize", queueUpdate);
      window.removeEventListener("orientationchange", queueUpdate);
    };
  }, [myHand.length]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let frameId = 0;
    let observer;

    const updatePlayLayout = () => {
      const zone = playZoneRef.current;
      if (!zone) {
        return;
      }

      const zoneWidth = Math.round(zone.clientWidth);
      const cardWidth = getFallbackCenterCardWidth();

      setPlayLayout((current) => {
        if (current.zoneWidth === zoneWidth && current.cardWidth === cardWidth) {
          return current;
        }
        return {
          zoneWidth,
          cardWidth
        };
      });
    };

    const queueUpdate = () => {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updatePlayLayout);
    };

    queueUpdate();

    if (playZoneRef.current && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => queueUpdate());
      observer.observe(playZoneRef.current);
    }

    window.addEventListener("resize", queueUpdate);
    window.addEventListener("orientationchange", queueUpdate);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener("resize", queueUpdate);
      window.removeEventListener("orientationchange", queueUpdate);
    };
  }, []);

  useEffect(() => {
    loadRoom().catch(() => showMessage("房間資料讀取失敗"));
  }, [roomNo]);

  useEffect(() => {
    setHintCursor(0);
  }, [handSignature, hintSignature, currentTurnSeat]);

  useEffect(() => {
    if (!me || !roomNo) {
      return;
    }

    if (!socket) {
      socket = io(getSocketUrl(), {
        withCredentials: true
      });
    }

    socket.emit("room:subscribe", { roomNo });

    function onRoomUpdate({ room: nextRoom, notification }) {
      handleIncomingRoom(nextRoom, notification);
    }

    function onRoomError({ error }) {
      setPendingAction(null);
      showMessage(error || "房間操作失敗");
    }

    socket.on("room:update", onRoomUpdate);
    socket.on("room:error", onRoomError);

    return () => {
      socket.off("room:update", onRoomUpdate);
      socket.off("room:error", onRoomError);
    };
  }, [me, roomNo]);

  function handleFullscreen() {
    if (typeof document === "undefined") {
      return;
    }
    setIsFullscreen(Boolean(document.fullscreenElement));
  }

  async function loadRoom() {
    if (!roomNo) {
      return;
    }

    const [meResponse, roomResponse] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch(`/api/rooms/${roomNo}`)
    ]);

    const [meData, roomData] = await Promise.all([
      meResponse.json(),
      roomResponse.json()
    ]);

    if (!meData.user) {
      router.push("/login");
      return;
    }

    if (!roomResponse.ok) {
      showMessage(roomData.error || "房間不存在");
      return;
    }

    setMe(meData.user);
    const nextSeat = meData.user
      ? roomData.room.players.find((player) => player.userId === meData.user.id) || null
      : null;

    roomRef.current = roomData.room;
    setRoom(roomData.room);
    setPendingAction(null);

    if (shouldTriggerDealAnimation(null, roomData.room, nextSeat)) {
      startDealAnimation();
    }
  }

  function handleIncomingRoom(nextRoom, notification) {
    const previousRoom = roomRef.current;
    const nextSeat = me
      ? nextRoom.players.find((player) => player.userId === me.id) || null
      : null;
    const previousPlayId = previousRoom?.round?.lastPlay?.playId;
    const nextPlay = nextRoom?.round?.lastPlay;
    const previousTurn = previousRoom?.round?.currentTurn;
    const nextTurn = nextRoom?.round?.currentTurn;
    const previousStage = previousRoom?.round?.stage;
    const nextStage = nextRoom?.round?.stage;

    if (notification) {
      showMessage(notification, 2200);
    }

    if (shouldTriggerDealAnimation(previousRoom, nextRoom, nextSeat)) {
      startDealAnimation();
    }

    if (audioEnabled && nextStage && nextStage !== previousStage && nextStage === "bidding") {
      audioRef.current?.deal();
    }

    if (audioEnabled && nextPlay?.playId && nextPlay.playId !== previousPlayId) {
      audioRef.current?.play();
      setPlayedAnimation({
        key: `${nextPlay.playId}-${Date.now()}`,
        origin: getSeatSlot(nextPlay.seatIndex, nextSeat?.seatIndex),
        cards: nextPlay.cards || []
      });
      setTimeout(() => setPlayedAnimation(null), 520);

      if (nextPlay.type === "bomb" || nextPlay.type === "rocket") {
        setSpecialEffect({
          key: `${nextPlay.type}-${nextPlay.playId}`,
          label: nextPlay.type === "rocket" ? "王炸" : "炸彈",
          tone: nextPlay.type
        });
        setTimeout(() => setSpecialEffect(null), 1200);
      }
    }

    if (
      audioEnabled &&
      typeof nextTurn === "number" &&
      nextTurn !== previousTurn &&
      nextSeat &&
      nextTurn === nextSeat.seatIndex
    ) {
      audioRef.current?.turn();
    }

    if (audioEnabled && nextRoom.lastResult && nextRoom.lastResult !== previousRoom?.lastResult) {
      const didWin = nextSeat
        ? isSeatWinning(nextRoom.lastResult, nextSeat.seatIndex)
        : false;
      if (didWin) {
        audioRef.current?.win();
      } else {
        audioRef.current?.lose();
      }
    }

    roomRef.current = nextRoom;
    setRoom(nextRoom);
    setNowMs(Date.now());
    setPendingAction(null);

    const latestChat = nextRoom.chatFeed?.[nextRoom.chatFeed.length - 1];
    if (latestChat && latestChat.id !== lastChatIdRef.current) {
      lastChatIdRef.current = latestChat.id;
      const slot = getSeatSlot(latestChat.seatIndex, nextSeat?.seatIndex);
      setChatBubbles((current) => ({ ...current, [slot]: latestChat }));
      clearTimeout(chatBubbleTimersRef.current[slot]);
      chatBubbleTimersRef.current[slot] = setTimeout(() => {
        setChatBubbles((current) => {
          if (current[slot]?.id !== latestChat.id) {
            return current;
          }
          const next = { ...current };
          delete next[slot];
          return next;
        });
      }, 2600);
    }

    const nextHandIds = new Set(
      nextSeat ? (nextRoom.round?.hands?.[nextSeat.seatIndex] || []).map((card) => card.id) : []
    );
    setSelectedCards((current) => current.filter((cardId) => nextHandIds.has(cardId)));
    setTimeout(() => setOutgoingAnimation(null), 460);
  }

  function startDealAnimation() {
    clearTimeout(dealTimerRef.current);
    setDealSequence((current) => current + 1);
    setIsDealing(true);
    dealTimerRef.current = setTimeout(() => setIsDealing(false), 960);
  }

  function showMessage(text, duration = 2800) {
    clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = setTimeout(() => setMessage(""), duration);
  }

  function unlockAudio() {
    if (!audioEnabled) {
      return;
    }
    audioRef.current?.unlock();
  }

  async function joinRoom() {
    setJoining(true);
    const response = await apiFetch(`/api/rooms/${roomNo}/join`, { method: "POST" });
    const data = await response.json();
    setJoining(false);

    if (!response.ok) {
      showMessage(data.error || "加入失敗");
      return;
    }

    roomRef.current = data.room;
    setRoom(data.room);
    socket?.emit("room:subscribe", { roomNo });
  }

  function handleToggleCard(cardId) {
    unlockAudio();
    if (audioEnabled) {
      audioRef.current?.select();
    }
    setSelectedCards((current) =>
      current.includes(cardId)
        ? current.filter((item) => item !== cardId)
        : [...current, cardId]
    );
  }

  function handleHandPointerDown(event) {
    const cardElement = event.target.closest("[data-card-index]");
    if (!cardElement) {
      return;
    }

    unlockAudio();
    dragRef.current = {
      active: true,
      anchorIndex: Number(cardElement.dataset.cardIndex),
      currentIndex: Number(cardElement.dataset.cardIndex),
      pointerId: event.pointerId,
      moved: false
    };

    handRef.current?.setPointerCapture?.(event.pointerId);
  }

  function handleHandPointerMove(event) {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const cardElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest?.("[data-card-index]");

    if (!cardElement) {
      return;
    }

    const nextIndex = Number(cardElement.dataset.cardIndex);
    if (Number.isNaN(nextIndex) || nextIndex === dragRef.current.currentIndex) {
      return;
    }

    dragRef.current.currentIndex = nextIndex;
    dragRef.current.moved = true;
    const ids = getRangeIds(myHand, dragRef.current.anchorIndex, nextIndex);
    setSelectedCards(ids);
  }

  function handleHandPointerUp(event) {
    if (!dragRef.current.active || dragRef.current.pointerId !== event.pointerId) {
      return;
    }

    const { anchorIndex, currentIndex, moved } = dragRef.current;
    handRef.current?.releasePointerCapture?.(event.pointerId);

    if (!moved) {
      const cardId = myHand[anchorIndex]?.id;
      if (cardId) {
        handleToggleCard(cardId);
      }
    } else {
      setSelectedCards(getRangeIds(myHand, anchorIndex, currentIndex));
    }

    dragRef.current = {
      active: false,
      anchorIndex: null,
      currentIndex: null,
      pointerId: null,
      moved: false
    };
  }

  function emitBid(value) {
    if (pendingAction) {
      return;
    }
    unlockAudio();
    if (audioEnabled) {
      audioRef.current?.bid(value);
    }
    setPendingAction(`bid-${value}`);
    socket?.emit("game:bid", { roomNo, value });
  }

  function emitPass() {
    if (!canPass || pendingAction) {
      return;
    }
    unlockAudio();
    if (audioEnabled) {
      audioRef.current?.pass();
    }
    setPendingAction("pass");
    socket?.emit("game:pass", { roomNo });
  }

  function emitPlay() {
    if (!selectedHandCards.length) {
      showMessage("先選中要打出的牌");
      return;
    }

    if (pendingAction) {
      return;
    }

    if (!selectedCombo) {
      showMessage("目前選牌不是合法牌型");
      return;
    }

    if (activeTargetCombo && !compareCombos(selectedCombo, activeTargetCombo)) {
      showMessage(`這手還壓不過 ${room?.round?.lastPlay?.text || "上家"}，可先點智能提示`);
      return;
    }

    unlockAudio();
    if (audioEnabled) {
      audioRef.current?.play();
    }

    setOutgoingAnimation({
      key: `out-${Date.now()}`,
      cards: selectedHandCards
    });
    setPendingAction("play");
    socket?.emit("game:play", {
      roomNo,
      cardIds: selectedHandCards.map((card) => card.id)
    });
    setSelectedCards([]);
  }

  function clearSelection() {
    setSelectedCards([]);
  }

  function applyHintSelection() {
    if (!hintCombos.length) {
      showMessage(activeTargetCombo ? "手上沒有能壓過上家的牌" : "目前沒有可提示的牌型");
      return;
    }

    const combo = hintCombos[hintCursor % hintCombos.length];
    setSelectedCards(combo.cards.map((card) => card.id));
    setHintCursor((current) => (current + 1) % hintCombos.length);
  }

  function toggleTrustee() {
    unlockAudio();
    socket?.emit("game:trustee", { roomNo, trustee: !mySeat?.trustee });
  }

  function sendQuickChat(type, text) {
    unlockAudio();
    socket?.emit("room:chat", { roomNo, type, text });
  }

  function toggleFullscreen() {
    unlockAudio();
    const element = sceneRef.current;
    if (!element) {
      return;
    }

    if (!document.fullscreenElement) {
      element.requestFullscreen?.().catch(() => null);
    } else {
      document.exitFullscreen?.().catch(() => null);
    }
  }

  if (!room) {
    return (
      <SiteLayout immersive className={styles.gameShell}>
        <section className={styles.loadingScreen}>
          <div className={styles.loadingOrb} />
          <h1>正在載入牌桌</h1>
          {message ? <p>{message}</p> : <p>同步房間資料與對局狀態。</p>}
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout immersive className={styles.gameShell}>
      <section className={styles.scene} ref={sceneRef}>
        <div className={styles.sceneGlow} />
        <div className={styles.sceneNoise} />
        <div className={styles.sceneSweep} />

        <header className={styles.hud}>
          <div className={styles.hudBlock}>
            <span className={styles.roomTag}>房間 {room.roomNo}</span>
            <div>
              <h1 className={styles.roomTitle}>{room.templateTitle}</h1>
              <p className={styles.roomMeta}>
                {room.mode} · 底分 {room.settings.baseScore} · 倍率 x
                {room.round?.multiplier || 1}
              </p>
            </div>
          </div>

          <div className={styles.hudActions}>
            <button className={styles.hudButton} type="button" onClick={() => router.push("/lobby")}>
              返回大廳
            </button>
            <button
              className={styles.hudButton}
              type="button"
              onClick={() => {
                unlockAudio();
                setAudioEnabled((current) => !current);
              }}
            >
              {audioEnabled ? "音效開" : "音效關"}
            </button>
            <button className={styles.hudButton} type="button" onClick={toggleFullscreen}>
              {isFullscreen ? "退出全屏" : "全屏"}
            </button>
          </div>
        </header>

        {showRotateHint ? (
          <div className={styles.rotateHint}>
            <strong>建議橫屏遊玩</strong>
            <span>手機橫屏後手牌間距、對手區與操作按鈕會更完整。</span>
          </div>
        ) : null}

        <div className={styles.tableFrame}>
          <div className={styles.tableSurface}>
            <SeatPanel
              player={seatsBySlot.left}
              slot="left"
              room={room}
              currentTurnSeat={currentTurnSeat}
              bubble={chatBubbles.left}
              turnRemainingMs={turnRemainingMs}
              turnDurationMs={turnDurationMs}
              turnMode={room.round?.turnMode}
            />
            <SeatPanel
              player={seatsBySlot.right}
              slot="right"
              room={room}
              currentTurnSeat={currentTurnSeat}
              bubble={chatBubbles.right}
              turnRemainingMs={turnRemainingMs}
              turnDurationMs={turnDurationMs}
              turnMode={room.round?.turnMode}
            />

            <div className={styles.centerStage}>
              <div className={styles.centerTopRow}>
                <div className={styles.multiplierPill}>
                  <span>倍率</span>
                  <strong>x{room.round?.multiplier || 1}</strong>
                </div>
                <div className={styles.statusPill}>{statusText}</div>
              </div>

              {specialEffect ? (
                <div
                  key={specialEffect.key}
                  className={`${styles.specialEffect} ${
                    specialEffect.tone === "rocket" ? styles.specialRocket : styles.specialBomb
                  }`}
                >
                  <div className={styles.specialEffectText}>{specialEffect.label}</div>
                </div>
              ) : null}

              <div className={styles.bottomCardsArea}>
                {bottomCards.length > 0 ? (
                  bottomCards.map((card) => (
                    <div key={card.id} className={styles.bottomCard}>
                      <CardArtwork card={card} />
                    </div>
                  ))
                ) : (
                  <>
                    <div className={styles.bottomCardBack}>
                      <CardArtwork faceDown />
                    </div>
                    <div className={styles.bottomCardBack}>
                      <CardArtwork faceDown />
                    </div>
                    <div className={styles.bottomCardBack}>
                      <CardArtwork faceDown />
                    </div>
                  </>
                )}
              </div>

              <div className={styles.playZone} ref={playZoneRef}>
                {playedAnimation?.cards?.length ? (
                  <div
                    key={playedAnimation.key}
                    className={`${styles.playedBurst} ${styles[`origin${capitalize(playedAnimation.origin)}`]}`}
                  >
                    {playedAnimation.cards.map((card, index) => (
                      <div
                        key={`${playedAnimation.key}-${card.id}`}
                        data-play-card="true"
                        className={styles.playedCard}
                        style={getCenterCardStyle(index, playedAnimation.cards.length, playLayout)}
                      >
                        <CardArtwork card={card} />
                      </div>
                    ))}
                  </div>
                ) : null}

                {outgoingAnimation?.cards?.length ? (
                  <div key={outgoingAnimation.key} className={styles.outgoingBurst}>
                    {outgoingAnimation.cards.map((card, index) => (
                      <div
                        key={`${outgoingAnimation.key}-${card.id}`}
                        data-play-card="true"
                        className={styles.outgoingCard}
                        style={getCenterCardStyle(index, outgoingAnimation.cards.length, playLayout)}
                      >
                        <CardArtwork card={card} />
                      </div>
                    ))}
                  </div>
                ) : null}

                {room.round?.lastPlay?.cards?.length ? (
                  <div className={styles.playedStack}>
                    {room.round.lastPlay.cards.map((card, index) => (
                      <div
                        key={`stack-${card.id}`}
                        data-play-card="true"
                        className={styles.playedStackCard}
                        style={getCenterCardStyle(index, room.round.lastPlay.cards.length, playLayout)}
                      >
                        <CardArtwork card={card} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.playZoneEmpty}>出牌區</div>
                )}
              </div>

              <div className={styles.bidTrack}>
                {(room.round?.bidHistory || []).length > 0 ? (
                  room.round.bidHistory.map((item, index) => (
                    <div key={`${item.seatIndex}-${index}`} className={styles.bidBadge}>
                      <span>{item.playerName}</span>
                      <strong>{item.value === 0 ? "不叫" : `${item.value} 分`}</strong>
                    </div>
                  ))
                ) : (
                  <div className={styles.bidPlaceholder}>等待叫地主</div>
                )}
              </div>

              {room.lastResult ? (
                <div className={styles.resultPanel}>
                  <div className={styles.resultHeadline}>
                    {room.lastResult.winnerSide === "landlord" ? "地主勝" : "農民勝"}
                  </div>
                  <div className={styles.resultMeta}>結算倍率 x{room.lastResult.multiplier}</div>
                  <div className={styles.resultList}>
                    {room.lastResult.deltas.map((item) => (
                      <div key={item.seatIndex} className={styles.resultItem}>
                        <span>{item.displayName}</span>
                        <strong className={item.delta >= 0 ? styles.deltaUp : styles.deltaDown}>
                          {item.delta >= 0 ? "+" : ""}
                          {item.delta}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className={styles.bottomSeatArea} data-room-dock="bottom">
              <div className={styles.selfPanel} data-seat-slot="self">
                <div className={styles.selfIdentity}>
                  <div className={styles.avatarRing}>{mySeat?.displayName?.slice(0, 1) || "?"}</div>
                  <div>
                    <strong>{mySeat?.displayName || "旁觀玩家"}</strong>
                    <div className={styles.identityBadges}>
                      <span
                        className={`${styles.roleBadge} ${
                          mySeat?.isLandlord ? styles.roleLandlord : styles.roleFarmer
                        }`}
                      >
                        {mySeat?.isLandlord ? "地主" : "農民"}
                      </span>
                      <span className={styles.modeBadge}>
                        {mySeat?.trustee ? "托管中" : "手動操控"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className={styles.selfMeta}>
                  <span>手牌 {myHand.length}</span>
                  <span>{myTurn ? "輪到你" : "等待中"}</span>
                  <span>{room.settings.allowBots ? "可補 AI" : "純真人"}</span>
                </div>

                {myTurn ? (
                  <TurnTimer
                    remainingMs={turnRemainingMs}
                    durationMs={turnDurationMs}
                    mode={room.round?.turnMode}
                    compact
                  />
                ) : null}
              </div>

                {chatBubbles.bottom ? (
                <div
                  className={`${styles.chatBubble} ${styles.chatBubbleBottom}`}
                  data-chat-slot="bottom"
                >
                  {chatBubbles.bottom.type === "emoji" ? (
                    <span className={styles.chatEmoji}>{chatBubbles.bottom.text}</span>
                  ) : (
                    chatBubbles.bottom.text
                  )}
                </div>
              ) : null}

              <div className={styles.handSection}>
                <div
                  className={styles.handRail}
                  data-hand-rail="true"
                  ref={handRef}
                  onPointerDown={handleHandPointerDown}
                  onPointerMove={handleHandPointerMove}
                  onPointerUp={handleHandPointerUp}
                  onPointerCancel={handleHandPointerUp}
                  onLostPointerCapture={handleHandPointerUp}
                >
                  {myHand.length > 0 ? (
                    myHand.map((card, index) => (
                      <button
                        key={`${dealSequence}-${card.id}`}
                        type="button"
                        data-card-id={card.id}
                        data-card-index={index}
                        className={`${styles.handCardButton} ${
                          isDealing ? styles.handCardDealing : ""
                        } ${
                          selectedSet.has(card.id) ? styles.handCardSelected : ""
                        }`}
                        style={getHandCardStyle(
                          index,
                          myHand.length,
                          selectedSet.has(card.id),
                          handLayout
                        )}
                        onClick={(event) => event.preventDefault()}
                      >
                        <CardArtwork card={card} />
                      </button>
                    ))
                  ) : (
                    <div className={styles.emptyHand}>
                      {inRoom ? "等待發牌或本輪已結束" : "加入房間後可看到自己的手牌"}
                    </div>
                  )}
                </div>

                {canPlay ? (
                  <div className={styles.handAssistShelf}>
                    <div className={styles.handAssistTrack}>
                      <div
                        className={styles.playAssistBar}
                        style={assistAnchorStyle}
                        data-play-assist="true"
                      >
                        <button
                          className={styles.secondaryAction}
                          type="button"
                          onClick={applyHintSelection}
                          disabled={pendingAction === "play"}
                        >
                          智能提示
                        </button>
                        {selectedHandCards.length > 0 ? (
                          <button
                            className={styles.secondaryAction}
                            type="button"
                            onClick={clearSelection}
                            disabled={Boolean(pendingAction)}
                          >
                            重選
                          </button>
                        ) : null}
                        {canPass ? (
                          <button
                            className={styles.secondaryAction}
                            type="button"
                            onClick={emitPass}
                            disabled={Boolean(pendingAction)}
                          >
                            過牌
                          </button>
                        ) : null}
                        <button
                          className={styles.primaryAction}
                          type="button"
                          onClick={emitPlay}
                          disabled={!selectedHandCards.length || !canBeatSelection || Boolean(pendingAction)}
                        >
                          {pendingAction === "play" ? "出牌中..." : "出牌"}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className={styles.controlDock} data-control-dock="true">
                <div
                  className={`${styles.selectionBar} ${styles[`selection${capitalize(selectionFeedback.tone)}`]}`}
                  role="status"
                  aria-live="polite"
                >
                  <span className={styles.selectionTitle}>{selectionFeedback.title}</span>
                  <span className={styles.selectionCards}>
                    {selectionFeedback.detail}
                  </span>
                  {selectedHandCards.length > 0 ? (
                    <span className={styles.selectionPicked}>
                      已選：{selectedHandCards.map((card) => card.label).join(" ")}
                    </span>
                  ) : null}
                </div>

                <div className={styles.actionsRow}>
                  {!inRoom ? (
                    <button className={styles.primaryAction} type="button" onClick={joinRoom}>
                      {joining ? "加入中..." : "加入房間"}
                    </button>
                  ) : null}

                  {canReady ? (
                    <button
                      className={styles.primaryAction}
                      type="button"
                      onClick={() => {
                        unlockAudio();
                        socket?.emit("room:ready", { roomNo, ready: true });
                      }}
                    >
                      準備開局
                    </button>
                  ) : null}

                  {canAddBot ? (
                    <button
                      className={styles.secondaryAction}
                      type="button"
                      onClick={() => {
                        unlockAudio();
                        socket?.emit("room:add-bot", { roomNo, count: 1 });
                      }}
                    >
                      補機器人
                    </button>
                  ) : null}

                  {canBid
                    ? (room.settings.bidOptions || [0, 1, 2, 3]).map((value) => (
                        <button
                          key={value}
                          className={value === 0 ? styles.secondaryAction : styles.bidAction}
                          type="button"
                          disabled={Boolean(pendingAction)}
                          onClick={() => emitBid(value)}
                        >
                          {pendingAction === `bid-${value}` ? "提交中..." : value === 0 ? "不叫" : `${value} 分`}
                        </button>
                      ))
                    : null}

                  {inRoom ? (
                    <button className={styles.secondaryAction} type="button" onClick={toggleTrustee}>
                      {mySeat?.trustee ? "取消托管" : "開啟托管"}
                    </button>
                  ) : null}
                </div>

                <div className={styles.chatDock}>
                  <div className={styles.chatSection}>
                    <span className={styles.chatLabel}>快捷消息</span>
                    <div className={styles.chatButtons}>
                      {CHAT_PRESETS.map((item) => (
                        <button
                          key={item}
                          className={styles.chatButton}
                          type="button"
                          onClick={() => sendQuickChat("text", item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className={styles.chatSection}>
                    <span className={styles.chatLabel}>表情</span>
                    <div className={styles.chatButtons}>
                      {EMOJI_PRESETS.map((item) => (
                        <button
                          key={item}
                          className={`${styles.chatButton} ${styles.chatEmojiButton}`}
                          type="button"
                          onClick={() => sendQuickChat("emoji", item)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <MatchResultOverlay
          open={resultOpen}
          onClose={() => setDismissedResultKey(resultKey)}
          eyebrow="斗地主结算"
          title={getCardResultTitle(room, mySeat)}
          subtitle={getCardResultSubtitle(room)}
          badges={getCardResultBadges(room, mySeat)}
          rows={getCardResultRows(room)}
          secondaryAction={{
            label: "返回大厅",
            onClick: () => router.push("/lobby")
          }}
          primaryAction={
            mySeat
              ? {
                  label: mySeat.ready ? "等待开局" : "准备再来",
                  onClick: () => {
                    if (!mySeat.ready) {
                      unlockAudio();
                      socket?.emit("room:ready", { roomNo, ready: true });
                    }
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

function SeatPanel({
  player,
  slot,
  room,
  currentTurnSeat,
  bubble,
  turnRemainingMs,
  turnDurationMs,
  turnMode
}) {
  if (!player) {
    return (
      <div
        className={`${styles.seatPanel} ${styles[`seat${capitalize(slot)}`]} ${styles.seatEmpty}`}
        data-seat-slot={slot}
      >
        等待玩家
      </div>
    );
  }

  const handCount = player.handCount || 0;
  const visibleBacks = Math.min(handCount, 7);
  const isCurrent = currentTurnSeat === player.seatIndex;

  return (
    <div
      className={`${styles.seatPanel} ${styles[`seat${capitalize(slot)}`]}`}
      data-seat-slot={slot}
    >
      <div className={styles.opponentHead}>
        <div className={`${styles.avatarRing} ${player.isLandlord ? styles.avatarLandlord : ""}`}>
          {player.displayName.slice(0, 1)}
        </div>
        <div className={styles.opponentMeta}>
          <strong>{player.displayName}</strong>
          <span>
            {player.isBot ? "AI" : player.connected ? "在線" : "離線"} ·
            {player.trustee ? " 托管" : " 正常"}
          </span>
          <div className={styles.identityBadges}>
            <span
              className={`${styles.roleBadge} ${
                player.isLandlord ? styles.roleLandlord : styles.roleFarmer
              }`}
            >
              {player.isLandlord ? "地主" : "農民"}
            </span>
          </div>
        </div>
        {isCurrent ? <div className={styles.turnLamp}>回合中</div> : null}
      </div>

      {isCurrent ? (
        <TurnTimer remainingMs={turnRemainingMs} durationMs={turnDurationMs} mode={turnMode} />
      ) : null}

      {bubble ? (
        <div
          className={`${styles.chatBubble} ${styles[`chatBubble${capitalize(slot)}`]}`}
          data-chat-slot={slot}
        >
          {bubble.type === "emoji" ? <span className={styles.chatEmoji}>{bubble.text}</span> : bubble.text}
        </div>
      ) : null}

      <div className={styles.opponentFan}>
        {Array.from({ length: visibleBacks }).map((_, index) => (
          <div
            key={`${player.seatIndex}-back-${index}`}
            className={styles.opponentBack}
            style={getOpponentCardStyle(index, visibleBacks, slot)}
          >
            <CardArtwork faceDown />
          </div>
        ))}
      </div>

      <div className={styles.opponentStats}>
        <span>剩餘 {handCount} 張</span>
        <span>{room.state === "waiting" ? (player.ready ? "已準備" : "待準備") : "對局中"}</span>
      </div>
    </div>
  );
}

function TurnTimer({ remainingMs, durationMs, mode, compact = false }) {
  const progress = Math.max(0, Math.min(1, remainingMs / Math.max(1, durationMs)));
  const accent = mode === "trustee" ? "#ff8f6b" : "#f6d56b";

  return (
    <div
      className={`${styles.turnTimer} ${compact ? styles.turnTimerCompact : ""}`}
      style={{
        background: `conic-gradient(${accent} ${progress * 360}deg, rgba(255,255,255,0.08) 0deg)`
      }}
    >
      <div className={styles.turnTimerInner}>
        <strong>{Math.max(0, Math.ceil(remainingMs / 1000))}</strong>
        <span>{mode === "trustee" ? "托管" : "出牌"}</span>
      </div>
    </div>
  );
}

function getSeatSlot(seatIndex, mySeatIndex) {
  if (typeof mySeatIndex !== "number") {
    return seatIndex === 0 ? "bottom" : seatIndex === 1 ? "right" : "left";
  }

  const offset = (seatIndex - mySeatIndex + 3) % 3;
  if (offset === 0) {
    return "bottom";
  }
  if (offset === 1) {
    return "right";
  }
  return "left";
}

function getRangeIds(cards, startIndex, endIndex) {
  const start = Math.min(startIndex, endIndex);
  const end = Math.max(startIndex, endIndex);
  return cards.slice(start, end + 1).map((card) => card.id);
}

function getHandCardStyle(index, total, selected, layout) {
  const metrics = getHandCardMetrics(index, total, layout);
  const lift = selected ? (total > 18 ? -16 : total > 14 ? -20 : -24) : 0;
  return {
    left: metrics.left,
    zIndex: selected ? 300 + index : 10 + index,
    "--hand-y": `${Math.round(metrics.curveY + lift)}px`,
    "--hand-rotate": `${metrics.rotation}deg`,
    "--hand-scale": selected ? 1.02 : 1,
    "--deal-origin-x": metrics.dealOriginX,
    "--deal-origin-y": "-196px",
    "--deal-origin-rotate": `${metrics.rotation * 0.32}deg`,
    "--deal-delay": `${index * 24}ms`
  };
}

function getHandCardMetrics(index, total, layout) {
  const normalized =
    total <= 1 ? 0 : (index - (total - 1) / 2) / Math.max(1, (total - 1) / 2);
  const curveY = Math.pow(Math.abs(normalized), 1.42) * (total > 16 ? 18 : total > 10 ? 15 : 12);
  const rotation = normalized * (total > 18 ? 8.5 : total > 12 ? 10.5 : 12.5);

  if (!layout?.railWidth) {
    const span = total > 18 ? 76 : total > 14 ? 66 : total > 10 ? 56 : total > 6 ? 46 : 34;
    const center = total === 1 ? 50 : 50 + normalized * (span / 2);
    return {
      left: `${center}%`,
      center,
      curveY,
      rotation,
      dealOriginX: "0px"
    };
  }

  const railWidth = layout.railWidth;
  const cardWidth = layout.cardWidth || 118;
  const edgePadding = Math.min(34, Math.max(12, Math.round(cardWidth * 0.18)));
  const usableSpan = Math.max(cardWidth, railWidth - cardWidth - edgePadding * 2);
  const preferredStep =
    cardWidth * (total > 18 ? 0.34 : total > 14 ? 0.4 : total > 10 ? 0.48 : total > 6 ? 0.58 : 0.66);
  const maxStep = cardWidth * 0.7;
  const step =
    total <= 1
      ? 0
      : Math.min(maxStep, preferredStep, usableSpan / Math.max(1, total - 1));
  const center = railWidth / 2 + (index - (total - 1) / 2) * step;

  return {
    left: `${center}px`,
    center,
    curveY,
    rotation,
    dealOriginX: `${Math.round(railWidth / 2 - center)}px`
  };
}

function getFallbackHandCardWidth() {
  if (typeof window === "undefined") {
    return 118;
  }

  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  if (window.innerWidth <= 960 && isLandscape && window.innerHeight <= 430) {
    return 68;
  }
  if (window.innerWidth <= 960 && isLandscape) {
    return 72;
  }
  if (window.innerWidth <= 960) {
    return 100;
  }
  return 118;
}

function getOpponentCardStyle(index, total, slot) {
  const direction = slot === "left" ? 1 : -1;
  return {
    transform: `translateX(${index * 14 * direction}px) rotate(${direction * (index - total / 2) * 4}deg)`,
    zIndex: index + 1
  };
}

function getCenterCardStyle(index, total, layout) {
  const metrics = getTableCardMetrics(index, total, layout);
  return {
    left: metrics.left,
    zIndex: 30 + index,
    "--table-y": `${Math.round(metrics.curveY)}px`,
    "--table-rotate": `${metrics.rotation}deg`,
    "--card-delay": `${index * 18}ms`
  };
}

function getTableCardMetrics(index, total, layout) {
  const normalized =
    total <= 1 ? 0 : (index - (total - 1) / 2) / Math.max(1, (total - 1) / 2);
  const curveY = Math.pow(Math.abs(normalized), 1.28) * (total > 8 ? 16 : 12);
  const rotation = normalized * (total > 14 ? 7.5 : total > 8 ? 9.5 : 11.5);

  if (!layout?.zoneWidth) {
    const span = total > 14 ? 86 : total > 10 ? 76 : total > 6 ? 64 : total > 3 ? 50 : 34;
    const center = total === 1 ? 50 : 50 + normalized * (span / 2);
    return {
      left: `${center}%`,
      curveY,
      rotation
    };
  }

  const zoneWidth = layout.zoneWidth;
  const cardWidth = layout.cardWidth || getFallbackCenterCardWidth();
  const sidePadding = Math.round(cardWidth * 0.72);
  const usableSpan = Math.max(cardWidth, zoneWidth - sidePadding * 2);
  const preferredStep =
    cardWidth * (total > 15 ? 0.24 : total > 10 ? 0.31 : total > 6 ? 0.43 : 0.58);
  const maxStep = cardWidth * 0.64;
  const step =
    total <= 1
      ? 0
      : Math.min(maxStep, preferredStep, usableSpan / Math.max(1, total - 1));
  const center = zoneWidth / 2 + (index - (total - 1) / 2) * step;

  return {
    left: `${center}px`,
    curveY,
    rotation
  };
}

function getFallbackCenterCardWidth() {
  if (typeof window === "undefined") {
    return 102;
  }

  const isLandscape = window.matchMedia("(orientation: landscape)").matches;
  if (window.innerWidth <= 960 && isLandscape) {
    return 64;
  }
  if (window.innerWidth <= 960) {
    return 82;
  }
  return 102;
}

function getComboSignature(combo) {
  if (!combo) {
    return "none";
  }

  return `${combo.type}:${combo.mainRank}:${combo.length}:${combo.chainLength}`;
}

function getComboTypeLabel(combo) {
  if (!combo) {
    return "牌型";
  }

  return {
    single: "單張",
    pair: "對子",
    triple: "三張",
    triple_single: "三帶一",
    triple_pair: "三帶對",
    straight: "順子",
    double_straight: "連對",
    plane: "飛機",
    plane_single: "飛機帶單",
    plane_pair: "飛機帶對",
    four_two_single: "四帶二",
    four_two_pair: "四帶兩對",
    bomb: "炸彈",
    rocket: "王炸"
  }[combo.type] || "牌型";
}

function getComboCardText(cards) {
  return cards.map((card) => card.label).join(" ");
}

function getSelectionFeedback({
  room,
  inRoom,
  myTurn,
  canBid,
  canPlay,
  turnPlayer,
  selectedHandCards,
  selectedCombo,
  activeTargetCombo,
  hintCombos,
  pendingAction
}) {
  if (pendingAction === "play") {
    return {
      tone: "hint",
      title: "已送出這手牌",
      detail: "等待牌桌同步下一位玩家..."
    };
  }

  if (pendingAction === "pass") {
    return {
      tone: "hint",
      title: "已選擇過牌",
      detail: "等待牌桌同步本輪狀態..."
    };
  }

  if (pendingAction?.startsWith("bid-")) {
    return {
      tone: "hint",
      title: "叫分已送出",
      detail: "等待叫地主結果同步..."
    };
  }

  if (!inRoom) {
    return {
      tone: "hint",
      title: "加入房間後開始對局",
      detail: "入座後可看到自己的手牌、輪次與智能提示"
    };
  }

  if (room?.state === "waiting") {
    return {
      tone: "hint",
      title: "等待三人準備",
      detail: "準備完成後會立即發牌並開始叫地主"
    };
  }

  if (canBid) {
    return {
      tone: "hint",
      title: "輪到你叫分",
      detail: "根據牌力選 0 到 3 分，3 分會直接定地主"
    };
  }

  if (room?.state === "bidding") {
    return {
      tone: "hint",
      title: `等待 ${turnPlayer?.displayName || "其他玩家"} 叫分`,
      detail: "叫分結束後地主先手，底牌會立即翻開"
    };
  }

  if (!myTurn) {
    return {
      tone: "hint",
      title: `等待 ${turnPlayer?.displayName || "其他玩家"} 出牌`,
      detail: room?.round?.lastPlay?.text
        ? `桌面目前：${room.round.lastPlay.text}`
        : "等待本輪重新領出"
    };
  }

  if (!canPlay) {
    return {
      tone: "hint",
      title: "目前不可出牌",
      detail: "等待本輪進入出牌階段"
    };
  }

  if (selectedHandCards.length === 0) {
    if (activeTargetCombo) {
      return hintCombos.length > 0
        ? {
            tone: "hint",
            title: `本輪要壓 ${room?.round?.lastPlay?.text || "上家"}`,
            detail: "點智能提示可自動選出能打的牌，或直接過牌"
          }
        : {
            tone: "error",
            title: `本輪要壓 ${room?.round?.lastPlay?.text || "上家"}`,
            detail: "你手上沒有能壓過的牌，建議直接過牌"
          };
    }

    return {
      tone: "hint",
      title: "你來領出",
      detail: "任意合法牌型都能出，點牌後出牌鍵會出現在牌下方"
    };
  }

  if (!selectedCombo) {
    return {
      tone: "error",
      title: "目前選牌不是合法牌型",
      detail: "請改成單張、對子、順子、三帶等標準牌型"
    };
  }

  if (activeTargetCombo && !compareCombos(selectedCombo, activeTargetCombo)) {
    return {
      tone: "error",
      title: `這手還壓不過 ${room?.round?.lastPlay?.text || "上家"}`,
      detail: "可點智能提示快速切到下一手能出的組合"
    };
  }

  return {
    tone: "success",
    title: `可出 ${getComboTypeLabel(selectedCombo)}`,
    detail: getComboCardText(selectedHandCards)
  };
}

function getAssistAnchorStyle(selectedIndexes, total, layout) {
  if (!selectedIndexes.length) {
    return { left: "50%" };
  }

  const first = getHandCardMetrics(selectedIndexes[0], total, layout);
  const last = getHandCardMetrics(selectedIndexes[selectedIndexes.length - 1], total, layout);

  if (!layout?.railWidth) {
    return { left: `${(first.center + last.center) / 2}%` };
  }

  const anchor = Math.max(88, Math.min(layout.railWidth - 88, (first.center + last.center) / 2));
  return { left: `${anchor}px` };
}

function getStatusText(room, turnPlayer) {
  if (!room.round) {
    return room.state === "waiting" ? "等待玩家準備" : "房間同步中";
  }

  if (room.round.stage === "bidding") {
    return `${turnPlayer?.displayName || "玩家"} 正在叫地主`;
  }

  if (room.round.stage === "playing") {
    return `${turnPlayer?.displayName || "玩家"} 正在出牌`;
  }

  return "等待下一輪";
}

function isSeatWinning(result, seatIndex) {
  if (result.winnerSide === "landlord") {
    return result.landlordSeat === seatIndex;
  }
  return result.landlordSeat !== seatIndex;
}

function getCardResultTitle(room, mySeat) {
  if (!room?.lastResult) {
    return "";
  }

  if (mySeat) {
    return isSeatWinning(room.lastResult, mySeat.seatIndex) ? "你赢了" : "你输了";
  }

  return room.lastResult.winnerSide === "landlord" ? "地主胜" : "农民胜";
}

function getCardResultSubtitle(room) {
  if (!room?.lastResult) {
    return "";
  }

  return `${room.lastResult.winnerSide === "landlord" ? "地主胜" : "农民胜"} · 结算倍率 x${room.lastResult.multiplier}`;
}

function getCardResultBadges(room, mySeat) {
  if (!room?.lastResult) {
    return [];
  }

  return [
    `房号 ${room.roomNo}`,
    mySeat
      ? isSeatWinning(room.lastResult, mySeat.seatIndex)
        ? "本局胜利"
        : "本局失利"
      : room.lastResult.winnerSide === "landlord"
        ? "地主胜"
        : "农民胜",
    typeof room.lastResult.landlordSeat === "number"
      ? `地主 #${room.lastResult.landlordSeat + 1}`
      : null
  ];
}

function getCardResultRows(room) {
  if (!room?.lastResult) {
    return [];
  }

  return room.lastResult.deltas.map((item) => ({
    label: item.displayName,
    meta: item.seatIndex === room.lastResult.landlordSeat ? "地主" : "农民",
    value: `${item.delta >= 0 ? "+" : ""}${item.delta}`,
    tone: item.delta >= 0 ? "positive" : "negative"
  }));
}

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
}

function shouldTriggerDealAnimation(previousRoom, nextRoom, nextSeat) {
  if (!nextRoom || !nextSeat) {
    return false;
  }

  if (nextRoom.state !== "bidding" || nextRoom.round?.stage !== "bidding") {
    return false;
  }

  if ((nextRoom.round?.bidHistory?.length || 0) > 0 || nextRoom.round?.lastPlay) {
    return false;
  }

  const handSize = nextRoom.round?.hands?.[nextSeat.seatIndex]?.length || 0;
  if (handSize !== 17) {
    return false;
  }

  if (!previousRoom) {
    return true;
  }

  return previousRoom.state === "waiting" || previousRoom.round?.stage !== "bidding";
}
