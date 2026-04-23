import { io } from "socket.io-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import MatchResultOverlay from "../../components/MatchResultOverlay";
import SiteLayout from "../../components/SiteLayout";
import GameIcon from "../../components/game-hub/GameIcon";
import { API_ROUTES, SOCKET_EVENTS, apiFetch, getSocketUrl } from "../../lib/client/api";
import {
  clearPendingGuestMatchClaim,
  getDegradedSubsystem,
  getPresenceLabel,
  getPresenceState,
  getRecoveryBannerMessage,
  getSafeActionLabels,
  isSubsystemBlocked,
  isSubsystemDegraded,
  readPendingGuestMatchClaim,
  writePendingGuestMatchClaim
} from "../../lib/client/room-entry";
import styles from "../../styles/UndercoverRoom.module.css";

const { getGameMeta } = require("../../lib/games/catalog");

let socket;
const PARTY_EVENTS = SOCKET_EVENTS.party;
const VOICE_EVENTS = SOCKET_EVENTS.voice;
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" }
];

export default function UndercoverRoomPage() {
  const router = useRouter();
  const { roomNo } = router.query;
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);
  const [clueText, setClueText] = useState("");
  const [dismissedResultKey, setDismissedResultKey] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [voiceJoined, setVoiceJoined] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(true);
  const [voiceError, setVoiceError] = useState("");
  const [remoteStreams, setRemoteStreams] = useState({});
  const [socketConnected, setSocketConnected] = useState(null);
  const [recoveryRestoreNotice, setRecoveryRestoreNotice] = useState("");
  const roomRef = useRef(null);
  const messageTimerRef = useRef(null);
  const recoveryTimerRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const remoteAudioRefs = useRef({});
  const joinedVoiceRef = useRef(false);
  const voiceMutedRef = useRef(true);
  const guestClaimSyncRef = useRef("");
  const previousSocketConnectedRef = useRef(null);

  const meta = useMemo(() => getGameMeta("undercover"), []);
  const mySeat = room?.viewer || null;
  const players = room?.players || [];
  const playerBySeat = Object.fromEntries(players.map((player) => [player.seatIndex, player]));
  const phaseRemainingMs = room?.phaseEndsAt ? Math.max(0, room.phaseEndsAt - nowMs) : 0;
  const voiceStatus = getDegradedSubsystem(room, "voice");
  const voiceBlocked = isSubsystemBlocked(room, "voice");
  const voiceDegraded = isSubsystemDegraded(room, "voice");
  const voiceSafeActionLabels = getSafeActionLabels(voiceStatus.safeActions);
  const activeClueSpeaker =
    room?.state === "playing" && room?.round?.stage === "clue"
      ? playerBySeat[room.round?.activeSeat] || null
      : null;
  const canTakeVoiceTurn = canUseUndercoverMicTurn(room, mySeat);
  const canJoinVoice =
    Boolean(mySeat) &&
    room?.config?.voiceEnabled !== false &&
    room?.state === "playing" &&
    room?.round?.stage === "clue" &&
    !voiceBlocked;
  const voiceTurnState = getUndercoverVoiceTurnState({
    room,
    mySeat,
    activeClueSpeaker,
    voiceBlocked
  });
  const canSubmitClue =
    room?.state === "playing" &&
    room?.round?.stage === "clue" &&
    room?.round?.activeSeat === mySeat?.seatIndex &&
    mySeat?.alive;
  const canVote = room?.state === "playing" && room?.round?.stage === "vote" && mySeat?.alive;
  const resultKey = room?.lastResult
    ? [
        room.roomNo,
        room.lastResult.headline,
        room.lastResult.detail || "",
        room.feed?.[room.feed.length - 1]?.id || ""
      ].join("|")
    : "";
  const resultOpen = Boolean(room?.lastResult) && dismissedResultKey !== resultKey;
  const recoveryBanner = getRecoveryBannerMessage(mySeat, socketConnected, nowMs);
  const recoveryNotice = recoveryBanner || recoveryRestoreNotice;

  useEffect(() => {
    if (!roomNo) {
      return;
    }

    loadRoom().catch(() => showMessage("讀取房間失敗"));

    return () => {
      clearTimeout(messageTimerRef.current);
      clearTimeout(recoveryTimerRef.current);
      cleanupVoice(true, false);
    };
  }, [roomNo]);

  useEffect(() => {
    clearTimeout(recoveryTimerRef.current);

    if (!mySeat) {
      setRecoveryRestoreNotice("");
      previousSocketConnectedRef.current = socketConnected;
      return undefined;
    }

    if (
      previousSocketConnectedRef.current === false &&
      socketConnected === true &&
      getPresenceState(mySeat) === "connected"
    ) {
      setRecoveryRestoreNotice("已恢复到当前房间。");
      recoveryTimerRef.current = setTimeout(() => {
        setRecoveryRestoreNotice("");
      }, 2200);
    } else if (recoveryBanner) {
      setRecoveryRestoreNotice("");
    }

    previousSocketConnectedRef.current = socketConnected;

    return () => clearTimeout(recoveryTimerRef.current);
  }, [mySeat, recoveryBanner, socketConnected]);

  useEffect(() => {
    if (!roomNo || !me) {
      return undefined;
    }

    if (!socket) {
      socket = io(getSocketUrl(), { withCredentials: true });
    }

    function subscribeIfSeated() {
      if (roomRef.current?.viewer) {
        socket.emit(PARTY_EVENTS.subscribe, { roomNo });
      }
    }

    function onConnect() {
      setSocketConnected(true);
      subscribeIfSeated();
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    function onRoomUpdate({ room: nextRoom }) {
      roomRef.current = nextRoom;
      setRoom(nextRoom);
      setNowMs(Date.now());
    }

    function onRoomError({ error }) {
      showMessage(error || "房間操作失敗");
    }

    function onVoicePeers({ peers }) {
      if (!joinedVoiceRef.current) {
        return;
      }

      for (const peer of peers || []) {
        if (peer.userId !== me.id) {
          createOffer(peer.userId).catch(() => {
            showMessage("語音連線協商失敗");
          });
        }
      }
    }

    function onVoiceUserLeft(payload) {
      detachRemotePeer(payload.userId);
    }

    function onVoiceSignal(payload) {
      handleVoiceSignal(payload).catch(() => {
        showMessage("語音連線協商失敗");
      });
    }

    if (socket.connected) {
      setSocketConnected(true);
    } else {
      setSocketConnected(null);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(PARTY_EVENTS.update, onRoomUpdate);
    socket.on(PARTY_EVENTS.error, onRoomError);
    socket.on(PARTY_EVENTS.voicePeers, onVoicePeers);
    socket.on(PARTY_EVENTS.voiceUserLeft, onVoiceUserLeft);
    socket.on(VOICE_EVENTS.signal, onVoiceSignal);

    subscribeIfSeated();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(PARTY_EVENTS.update, onRoomUpdate);
      socket.off(PARTY_EVENTS.error, onRoomError);
      socket.off(PARTY_EVENTS.voicePeers, onVoicePeers);
      socket.off(PARTY_EVENTS.voiceUserLeft, onVoiceUserLeft);
      socket.off(VOICE_EVENTS.signal, onVoiceSignal);
    };
  }, [roomNo, me]);

  useEffect(() => {
    if (!roomNo || !mySeat || !socket) {
      return;
    }

    socket.emit(PARTY_EVENTS.subscribe, { roomNo });
  }, [roomNo, mySeat]);

  useEffect(() => {
    if (!room?.phaseEndsAt) {
      return undefined;
    }

    setNowMs(Date.now());
    const timer = setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(timer);
  }, [room?.phaseEndsAt]);

  useEffect(() => {
    if (!voiceBlocked) {
      return;
    }

    if (joinedVoiceRef.current) {
      cleanupVoice(true, true);
    }
  }, [voiceBlocked]);

  useEffect(() => {
    if (!joinedVoiceRef.current || voiceMutedRef.current || canTakeVoiceTurn) {
      return;
    }

    setVoiceMutedState(true, true);
  }, [canTakeVoiceTurn, room?.round?.activeSeat, room?.round?.stage, room?.state]);

  useEffect(() => {
    if (!joinedVoiceRef.current || room?.state === "playing") {
      return;
    }

    cleanupVoice(true, true);
  }, [room?.state]);

  useEffect(() => {
    if (me?.kind !== "user" || !roomNo) {
      return;
    }

    const pendingClaim = readPendingGuestMatchClaim();
    const currentRoute = getUndercoverRoute(roomNo);
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
      apiFetch(API_ROUTES.partyRooms.detail(roomNo))
    ]);

    const [meData, roomData] = await Promise.all([meResponse.json(), roomResponse.json()]);
    const nextSession = meData.session || meData.user || null;
    if (!nextSession) {
      router.push(`/login?returnTo=${encodeURIComponent(getUndercoverRoute(roomNo))}`);
      return;
    }

    if (!roomResponse.ok) {
      showMessage(roomData.error || "房間不存在");
      return;
    }

    setMe(nextSession);
    roomRef.current = roomData.room;
    setRoom(roomData.room);
  }

  function showMessage(text, duration = 2600) {
    clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = setTimeout(() => setMessage(""), duration);
  }

  async function joinRoom() {
    setJoining(true);
    const response = await apiFetch(API_ROUTES.partyRooms.join(roomNo), { method: "POST" });
    const data = await response.json();
    setJoining(false);

    if (!response.ok) {
      showMessage(data.error || "加入房間失敗");
      return;
    }

    roomRef.current = data.room;
    setRoom(data.room);
    socket?.emit(PARTY_EVENTS.subscribe, { roomNo });
  }

  function emitReady(ready) {
    socket?.emit(PARTY_EVENTS.ready, { roomNo, ready });
  }

  function emitAddBot(count = 1) {
    socket?.emit(PARTY_EVENTS.addBot, { roomNo, count });
  }

  function emitAction(payload) {
    socket?.emit(PARTY_EVENTS.action, { roomNo, payload });
  }

  function setVoiceMutedState(nextMuted, notifyServer = false) {
    voiceMutedRef.current = nextMuted;
    setVoiceMuted(nextMuted);

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
    }

    if (notifyServer && joinedVoiceRef.current) {
      socket?.emit(VOICE_EVENTS.state, { roomNo, muted: nextMuted });
    }
  }

  async function enableVoice() {
    if (!mySeat) {
      setVoiceError("請先加入房間並入座，再接入語音。");
      return;
    }

    if (voiceBlocked) {
      setVoiceError(voiceStatus.message || "語音暫停中，請先等待恢復。");
      return;
    }

    if (room?.config?.voiceEnabled === false) {
      setVoiceError("這個房間目前沒有開啟語音。");
      return;
    }

    if (room?.state !== "playing") {
      setVoiceError("開局後再接入語音，輪到描述時再開咪。");
      return;
    }

    if (room?.round?.stage !== "clue") {
      setVoiceError("公開投票階段先看票型，下一輪描述再接入語音。");
      return;
    }

    if (!socket) {
      setVoiceError("房間連線尚未建立，請稍後再試。");
      return;
    }

    try {
      setVoiceError("");
      if (!localStreamRef.current) {
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      }

      const nextMuted = !canUseUndercoverMicTurn(roomRef.current || room, roomRef.current?.viewer || mySeat);
      setVoiceMutedState(nextMuted, false);
      socket.emit(PARTY_EVENTS.subscribe, { roomNo });
      joinedVoiceRef.current = true;
      setVoiceJoined(true);
      socket.emit(VOICE_EVENTS.join, { roomNo, muted: nextMuted });
    } catch (error) {
      setVoiceError("麥克風權限未開啟或裝置不可用。");
    }
  }

  function cleanupVoice(stopTracks = true, notifyServer = true) {
    if (notifyServer && joinedVoiceRef.current) {
      socket?.emit(VOICE_EVENTS.leave, { roomNo });
    }

    joinedVoiceRef.current = false;
    setVoiceJoined(false);

    Object.keys(peerConnectionsRef.current).forEach((userId) => detachRemotePeer(userId));

    if (stopTracks && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    voiceMutedRef.current = true;
    setVoiceMuted(true);
  }

  function detachRemotePeer(userId) {
    const pc = peerConnectionsRef.current[userId];
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
      delete peerConnectionsRef.current[userId];
    }

    delete remoteAudioRefs.current[userId];
    setRemoteStreams((current) => {
      if (!current[userId]) {
        return current;
      }
      const next = { ...current };
      delete next[userId];
      return next;
    });
  }

  function getOrCreatePeerConnection(userId) {
    if (peerConnectionsRef.current[userId]) {
      return peerConnectionsRef.current[userId];
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket?.emit(VOICE_EVENTS.signal, {
          roomNo,
          targetUserId: userId,
          data: {
            type: "candidate",
            candidate: event.candidate
          }
        });
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) {
        return;
      }

      setRemoteStreams((current) => ({
        ...current,
        [userId]: stream
      }));

      const audio = remoteAudioRefs.current[userId];
      if (audio) {
        if (audio.srcObject !== stream) {
          audio.srcObject = stream;
        }
        audio.play?.().catch(() => null);
      }
    };
    pc.onconnectionstatechange = () => {
      if (["closed", "failed", "disconnected"].includes(pc.connectionState)) {
        detachRemotePeer(userId);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    peerConnectionsRef.current[userId] = pc;
    return pc;
  }

  async function createOffer(targetUserId) {
    if (!joinedVoiceRef.current) {
      return;
    }

    const pc = getOrCreatePeerConnection(targetUserId);
    if (pc.signalingState !== "stable") {
      return;
    }

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket?.emit(VOICE_EVENTS.signal, {
      roomNo,
      targetUserId,
      data: {
        type: "offer",
        sdp: pc.localDescription
      }
    });
  }

  async function handleVoiceSignal({ fromUserId, data }) {
    if (!joinedVoiceRef.current) {
      return;
    }

    const pc = getOrCreatePeerConnection(fromUserId);
    if (data.type === "offer") {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit(VOICE_EVENTS.signal, {
        roomNo,
        targetUserId: fromUserId,
        data: {
          type: "answer",
          sdp: pc.localDescription
        }
      });
      return;
    }

    if (data.type === "answer") {
      if (pc.signalingState === "have-local-offer") {
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      }
      return;
    }

    if (data.type === "candidate" && data.candidate) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      } catch (error) {
        return;
      }
    }
  }

  function toggleVoiceTurn() {
    if (!canTakeVoiceTurn) {
      setVoiceError(
        getUndercoverVoiceTurnCopy({
          room,
          mySeat,
          activeClueSpeaker,
          voiceBlocked
        })
      );
      return;
    }

    setVoiceError("");
    setVoiceMutedState(!voiceMutedRef.current, true);
  }

  function submitClue(event) {
    event.preventDefault();
    const text = clueText.trim();
    if (!text) {
      return;
    }

    emitAction({
      type: "undercover-clue",
      text
    });
    setClueText("");
  }

  function queueGuestClaimSync() {
    if (me?.kind !== "guest" || !room?.lastResult) {
      return;
    }

    writePendingGuestMatchClaim(buildUndercoverGuestClaim(room, me, mySeat));
    router.push(`/login?returnTo=${encodeURIComponent(getUndercoverRoute(room.roomNo))}`);
  }

  if (!room) {
    return (
      <SiteLayout immersive>
        <div className={styles.loading}>正在同步誰是臥底房間狀態...</div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout immersive>
      <section className={styles.scene}>
        <div className={styles.sceneGlow} />
        <div className={styles.sceneSweep} />

        <header className={styles.hud}>
          <div className={styles.hudMain}>
            <div className={styles.hudIcon}>
              <GameIcon gameKey="undercover" />
            </div>
            <div>
              <span className={styles.roomTag}>房號 {room.roomNo}</span>
              <h1>{meta.title}</h1>
              <p>
                {meta.strapline} · {players.length}/{room.config.maxPlayers} 人
              </p>
            </div>
          </div>

          <div className={styles.hudActions}>
            <PhaseTimer
              remainingMs={phaseRemainingMs}
              durationMs={room.phaseDurationMs}
              label={getStageLabel(room)}
            />
            <button type="button" className={styles.hudButton} onClick={() => router.push(meta.route)}>
              返回大廳
            </button>
          </div>
        </header>

        <div className={styles.layout}>
          <section className={styles.stage}>
            <div className={styles.stageCard}>
            <div className={styles.stageHead}>
              <div>
                <strong>{getStageHeadline(room)}</strong>
                <span>{getStageSubline(room, mySeat)}</span>
              </div>
              <div className={styles.stageBadges}>
                <span>{room.state === "waiting" ? "等待準備" : "對局進行中"}</span>
                <span>{room.config.visibility === "private" ? "私密房" : "公開房"}</span>
                <span>{room.config.voiceEnabled ? "輪流開咪" : "文字房"}</span>
                {voiceDegraded ? (
                  <span data-voice-status={voiceStatus.state}>
                    {voiceBlocked ? "語音暫停" : "語音降級"}
                  </span>
                ) : null}
                <span>{room.round?.privateRole === "undercover" ? "你的身份：臥底" : "你的身份：平民"}</span>
              </div>
            </div>

              <div className={styles.promptCard}>
                <span className={styles.cardEyebrow}>YOUR WORD</span>
                <strong data-undercover-word>{room.round?.privatePrompt || "等待發詞"}</strong>
                <p>
                  {room.round?.privateRole === "undercover"
                    ? "你拿到的是臥底詞，描述要像平民但不要說穿。"
                    : "你拿到的是平民詞，聽描述和票型抓出那個詞題不同的人。"}
                </p>
              </div>

              {!mySeat ? (
                <button type="button" className={styles.primaryButton} onClick={joinRoom}>
                  {joining ? "加入中..." : "加入房間"}
                </button>
              ) : room.state === "waiting" ? (
                <div className={styles.waitingBar}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => emitReady(!mySeat.ready)}
                  >
                    {mySeat.ready ? "取消準備" : room.lastResult ? "準備再來" : "準備開局"}
                  </button>
                  {mySeat.isOwner && players.length < room.config.maxPlayers ? (
                    <button type="button" className={styles.hudButton} onClick={() => emitAddBot(1)}>
                      補機器人
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className={styles.playArea}>
                  <section className={styles.actionPanel}>
                    <div className={styles.panelHeader}>
                      <strong>{room.round?.stage === "clue" ? "本輪描述" : "公開投票"}</strong>
                      <span>
                        {room.round?.stage === "clue"
                          ? `輪到 ${playerBySeat[room.round?.activeSeat]?.displayName || "下一位"}`
                          : `${room.round?.votesSubmitted || 0} / ${room.round?.aliveCount || 0} 已投票`}
                      </span>
                    </div>

                    {room.round?.stage === "clue" ? (
                      canSubmitClue ? (
                        <form className={styles.clueForm} onSubmit={submitClue}>
                          <textarea
                            value={clueText}
                            onChange={(event) => setClueText(event.target.value)}
                            placeholder="輸入一句不直接點名詞題的描述"
                            rows={3}
                          />
                          <button type="submit" className={styles.primaryButton}>
                            提交描述
                          </button>
                        </form>
                      ) : (
                        <p className={styles.panelHint}>
                          {mySeat.alive
                            ? "等待輪到你描述。機器人會在自己的回合自動補描述。"
                            : "你已出局，現在只能觀察描述和票型。"}
                        </p>
                      )
                    ) : null}

                    {room.round?.stage === "vote" ? (
                      canVote && room.round?.myVote === null ? (
                        <div className={styles.voteGrid}>
                          {players
                            .filter((player) => player.alive && player.seatIndex !== mySeat?.seatIndex)
                            .map((player) => (
                              <button
                                key={player.userId}
                                type="button"
                                className={styles.voteButton}
                                onClick={() =>
                                  emitAction({
                                    type: "undercover-vote",
                                    targetSeat: player.seatIndex
                                  })
                                }
                              >
                                投給 {player.displayName}
                              </button>
                            ))}
                        </div>
                      ) : (
                        <p className={styles.panelHint}>
                          {room.round?.myVote !== null
                            ? `你已投給 ${playerBySeat[room.round.myVote]?.displayName || "該玩家"}。`
                            : "等待其他玩家完成投票。"}
                        </p>
                      )
                    ) : null}
                  </section>

                  <section className={styles.clueTimeline}>
                    <div className={styles.panelHeader}>
                      <strong>描述紀錄</strong>
                      <span>{room.round?.clues?.length || 0} 條</span>
                    </div>
                    <div className={styles.clueList}>
                      {(room.round?.clues || []).map((entry) => (
                        <div key={`${entry.roundNo}-${entry.seatIndex}-${entry.text}`} className={styles.clueItem}>
                          <strong>
                            第 {entry.roundNo} 輪 · {playerBySeat[entry.seatIndex]?.displayName || `#${entry.seatIndex + 1}`}
                          </strong>
                          <span>{entry.text}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          </section>

          <aside className={styles.sidebar}>
            <section className={styles.sidebarCard}>
              <div className={styles.panelHeader}>
                <strong>座位</strong>
                <span>{players.length} / {room.config.maxPlayers}</span>
              </div>
              <div className={styles.playerList}>
                {players.map((player) => (
                  <div
                    key={player.userId}
                    className={`${styles.playerCard} ${
                      mySeat?.seatIndex === player.seatIndex ? styles.playerSelf : ""
                    } ${player.alive === false ? styles.playerOut : ""}`}
                    data-presence-state={player.presenceState || "disconnected"}
                  >
                    <div>
                      <strong>{player.displayName}</strong>
                      <span>
                        #{player.seatIndex + 1} · {getPresenceLabel(player, {
                          connected: "在線",
                          reconnecting: "重連中",
                          disconnected: "離線"
                        })}
                      </span>
                    </div>
                    <div className={styles.playerMeta}>
                      {player.isBot ? <span>AI</span> : null}
                      {player.ready ? <span>已準備</span> : null}
                      {player.voiceConnected ? (
                        <span data-player-voice={player.voiceMuted ? "muted" : "live"}>
                          {player.voiceMuted ? "旁聽中" : "開咪中"}
                        </span>
                      ) : null}
                      {player.roleLabel ? <span>{player.roleLabel}</span> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section
              className={styles.sidebarCard}
              data-voice-status={voiceStatus.state}
              data-voice-turn={voiceTurnState}
            >
              <div className={styles.panelHeader}>
                <strong>順序語音</strong>
                <span>{players.filter((player) => player.voiceConnected).length} 人已接入</span>
              </div>
              <div
                className={styles.noteList}
                data-voice-status={voiceStatus.state}
                data-availability-reason={voiceStatus.reasonCode || `voice:${voiceStatus.state}`}
              >
                <span>
                  {getUndercoverVoiceTurnCopy({
                    room,
                    mySeat,
                    activeClueSpeaker,
                    voiceBlocked
                  })}
                </span>
                {voiceDegraded ? <span>{voiceStatus.message}</span> : null}
                {voiceSafeActionLabels.map((label, index) => (
                  <span
                    key={`${voiceStatus.subsystem}:${voiceStatus.safeActions[index] || label}`}
                    data-safe-action={voiceStatus.safeActions[index] || ""}
                  >
                    {label}
                  </span>
                ))}
              </div>
              <div className={styles.voiceActions}>
                {!voiceJoined ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    data-voice-action="join"
                    disabled={!canJoinVoice}
                    onClick={enableVoice}
                  >
                    {getUndercoverVoiceJoinLabel({
                      room,
                      mySeat,
                      canTakeVoiceTurn,
                      voiceBlocked,
                      voiceDegraded
                    })}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      data-voice-action="toggle"
                      disabled={!canTakeVoiceTurn}
                      onClick={toggleVoiceTurn}
                    >
                      {getUndercoverVoiceToggleLabel({
                        canTakeVoiceTurn,
                        voiceMuted,
                        voiceDegraded
                      })}
                    </button>
                    <button
                      type="button"
                      className={styles.hudButton}
                      data-voice-action="leave"
                      onClick={() => cleanupVoice(true, true)}
                    >
                      離開語音
                    </button>
                  </>
                )}
              </div>
              {voiceError ? <p className="error-text">{voiceError}</p> : null}
              <div className={styles.voiceList}>
                {players.map((player) => (
                  <div key={player.userId} className={styles.voiceItem}>
                    <span>{player.displayName}</span>
                    <strong>
                      {player.isBot
                        ? "AI 待命"
                        : player.voiceConnected
                        ? player.voiceMuted
                          ? "旁聽中"
                          : "開咪中"
                        : "未接入"}
                    </strong>
                  </div>
                ))}
              </div>
              {Object.entries(remoteStreams).map(([userId, stream]) => (
                <audio
                  key={userId}
                  autoPlay
                  ref={(node) => {
                    if (!node) {
                      return;
                    }
                    remoteAudioRefs.current[userId] = node;
                    if (node.srcObject !== stream) {
                      node.srcObject = stream;
                    }
                    node.play?.().catch(() => null);
                  }}
                />
              ))}
            </section>

            <section className={styles.sidebarCard}>
              <div className={styles.panelHeader}>
                <strong>房內動態</strong>
                <span>{room.feed.length} 條</span>
              </div>
              <div className={styles.feedList}>
                {room.feed.map((entry) => (
                  <div key={entry.id} className={styles.feedItem}>
                    <span>{entry.text}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        {message ? <div className={styles.toast}>{message}</div> : null}

        <MatchResultOverlay
          open={resultOpen}
          onClose={() => setDismissedResultKey(resultKey)}
          eyebrow="誰是臥底 結算"
          title={getResultTitle(room, mySeat)}
          subtitle={room.lastResult?.detail || ""}
          badges={[
            "誰是臥底",
            `房號 ${room.roomNo}`,
            room.lastResult?.winnerSide === "civilian" ? "平民勝" : "臥底勝"
          ]}
          rows={(room.lastResult?.players || []).map((player) => ({
            label: player.displayName,
            meta: [player.roleLabel, player.side === "undercover" ? "臥底" : "平民"].join(" · "),
            value: formatSigned(player.delta),
            tone: player.delta > 0 ? "positive" : player.delta < 0 ? "negative" : "neutral"
          }))}
          notice={
            me?.kind === "guest"
              ? {
                  title: "要把這局紀錄綁回帳號嗎？",
                  body: "登入後即可把這一局與你的正式帳號關聯起來。",
                  primaryAction: {
                    label: "登入並同步",
                    onClick: queueGuestClaimSync
                  }
                }
              : null
          }
          primaryAction={{
            label: "再來一局",
            onClick: () => setDismissedResultKey("")
          }}
        />

        {recoveryNotice ? (
          <div
            className={styles.recoveryBanner}
            data-recovery-banner="true"
            data-recovery-state={mySeat?.presenceState || (socketConnected === false ? "reconnecting" : "connected")}
          >
            {recoveryNotice}
          </div>
        ) : null}
      </section>
    </SiteLayout>
  );
}

function PhaseTimer({ remainingMs, durationMs, label }) {
  const progress = Math.max(0, Math.min(1, remainingMs / Math.max(1, durationMs || 1)));
  return (
    <div
      className={styles.timer}
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

function getStageLabel(room) {
  if (room.state === "waiting") {
    return "待開局";
  }

  return room.round?.stage === "vote" ? "投票" : "描述";
}

function getStageHeadline(room) {
  if (room.state === "waiting") {
    return "房主確認人數後即可發詞開局";
  }

  if (room.round?.stage === "vote") {
    return "公開投票階段";
  }

  return "輪流描述，別把詞說穿";
}

function getStageSubline(room, mySeat) {
  if (room.state === "waiting") {
    return "至少 4 人準備後即可開始第一輪。";
  }

  if (room.round?.stage === "vote") {
    return mySeat?.alive ? "根據描述與票型，投出你最懷疑的人。" : "你已出局，觀察剩餘票型。";
  }

  return mySeat?.alive
    ? "描述只講感覺，不要直接暴露自己的詞題。"
    : "你已出局，現在只能看其他玩家繼續描述。";
}

function canUseUndercoverMicTurn(room, mySeat) {
  return Boolean(
    room?.state === "playing" &&
      room?.round?.stage === "clue" &&
      mySeat?.alive &&
      room?.round?.activeSeat === mySeat?.seatIndex
  );
}

function getUndercoverVoiceTurnState({ room, mySeat, activeClueSpeaker, voiceBlocked }) {
  if (voiceBlocked) {
    return "blocked";
  }

  if (!mySeat) {
    return "spectator";
  }

  if (room?.config?.voiceEnabled === false) {
    return "disabled";
  }

  if (room?.state !== "playing") {
    return "waiting";
  }

  if (room?.round?.stage !== "clue") {
    return "paused";
  }

  if (canUseUndercoverMicTurn(room, mySeat)) {
    return "speaker";
  }

  return activeClueSpeaker ? "listener" : "waiting";
}

function getUndercoverVoiceTurnCopy({ room, mySeat, activeClueSpeaker, voiceBlocked }) {
  if (voiceBlocked) {
    return "這局語音目前暫停，先留在房內等恢復，恢復後再按描述順序開咪。";
  }

  if (!mySeat) {
    return "入座後可先接入旁聽，輪到描述者時再開咪。";
  }

  if (room?.config?.voiceEnabled === false) {
    return "這個房間目前沒有開啟語音，只能用畫面與票型推理。";
  }

  if (room?.state !== "playing") {
    return "開局後可先接入旁聽；輪到描述者時才開咪。";
  }

  if (room?.round?.stage !== "clue") {
    return "公開投票階段先看描述與票型，下一輪描述再輪流開咪。";
  }

  if (canUseUndercoverMicTurn(room, mySeat)) {
    return "現在輪到你描述；接入後即可開咪，其餘玩家先旁聽。";
  }

  return `等待 ${activeClueSpeaker?.displayName || "當前描述者"} 發言；你可以先接入旁聽，輪到自己再開咪。`;
}

function getUndercoverVoiceJoinLabel({
  room,
  mySeat,
  canTakeVoiceTurn,
  voiceBlocked,
  voiceDegraded
}) {
  if (!mySeat) {
    return "入座後接入語音";
  }

  if (voiceBlocked) {
    return "語音暫停";
  }

  if (room?.config?.voiceEnabled === false) {
    return "本房未開語音";
  }

  if (room?.state !== "playing") {
    return "開局後接入語音";
  }

  if (room?.round?.stage !== "clue") {
    return "下一輪再接入語音";
  }

  if (canTakeVoiceTurn) {
    return voiceDegraded ? "重試開咪" : "開咪描述";
  }

  return "接入旁聽";
}

function getUndercoverVoiceToggleLabel({ canTakeVoiceTurn, voiceMuted, voiceDegraded }) {
  if (!canTakeVoiceTurn) {
    return "等待輪到你開咪";
  }

  if (voiceMuted) {
    return voiceDegraded ? "重試開咪" : "開咪描述";
  }

  return "收咪旁聽";
}

function getResultTitle(room, mySeat) {
  if (!room?.lastResult) {
    return "";
  }

  const viewer = room.lastResult.players.find((player) => player.seatIndex === mySeat?.seatIndex);
  if (!viewer) {
    return room.lastResult.headline;
  }

  return viewer.delta > 0 ? "你贏了" : viewer.delta < 0 ? "你輸了" : room.lastResult.headline;
}

function buildUndercoverGuestClaim(room, session, mySeat) {
  const viewer = room.lastResult?.players?.find((player) => player.seatIndex === mySeat?.seatIndex);
  return {
    guestId: session.guestId || session.id,
    gameKey: room.gameKey,
    roomNo: room.roomNo,
    familyKey: "party",
    returnTo: getUndercoverRoute(room.roomNo),
    summary: {
      title: room.title,
      headline: room.lastResult?.headline || "",
      detail: room.lastResult?.detail || "",
      viewerDisplayName: session.displayName,
      delta: viewer?.delta ?? null,
      outcome: viewer?.delta > 0 ? "win" : viewer?.delta < 0 ? "loss" : "draw"
    }
  };
}

function getUndercoverRoute(roomNo) {
  return `/undercover/${roomNo}`;
}

function formatSigned(value) {
  const amount = Number(value || 0);
  if (amount > 0) {
    return `+${amount}`;
  }
  return String(amount);
}
