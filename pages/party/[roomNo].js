import { io } from "socket.io-client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import MatchResultOverlay from "../../components/MatchResultOverlay";
import SiteLayout from "../../components/SiteLayout";
import GameIcon from "../../components/game-hub/GameIcon";
import { API_ROUTES, SOCKET_EVENTS, apiFetch, getSocketUrl } from "../../lib/client/api";
import { usePartyVoiceRuntime } from "../../lib/client/party-voice-runtime";
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
import styles from "../../styles/PartyRoom.module.css";

const {
  getGameMeta,
  getGameLimits,
  getPartyRolePackSummary
} = require("../../lib/games/catalog");

let socket;
const PARTY_EVENTS = SOCKET_EVENTS.party;
const VOICE_EVENTS = SOCKET_EVENTS.voice;

const QUICK_LINES = {
  werewolf: ["过麦", "先听发言", "这票我压", "给我一分钟", "别着急下结论"],
  avalon: ["这队能过", "我不信这票", "任务稳住", "我来带队", "刺客注意视角"]
};

export default function PartyRoomPage() {
  const router = useRouter();
  const { roomNo } = router.query;
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const [noteText, setNoteText] = useState("");
  const [dismissedResultKey, setDismissedResultKey] = useState("");
  const [socketConnected, setSocketConnected] = useState(null);
  const [recoveryRestoreNotice, setRecoveryRestoreNotice] = useState("");
  const [witchPlan, setWitchPlan] = useState({
    saveTarget: false,
    poisonSeat: null
  });
  const roomRef = useRef(null);
  const messageTimerRef = useRef(null);
  const recoveryTimerRef = useRef(null);
  const guestClaimSyncRef = useRef("");
  const previousSocketConnectedRef = useRef(null);

  const meta = useMemo(() => getGameMeta(room?.gameKey), [room?.gameKey]);
  const mySeat = room?.viewer || null;
  const phaseRemainingMs = room?.phaseEndsAt ? Math.max(0, room.phaseEndsAt - nowMs) : 0;
  const limits = getGameLimits(room?.gameKey);
  const players = room?.players || [];
  const rolePackSummary = useMemo(
    () =>
      room?.gameKey && room?.gameKey !== "undercover"
        ? getPartyRolePackSummary(
            room.gameKey,
            Number(room.config?.maxPlayers || room.players?.length || 0),
            room.config?.rolePack
          )
        : null,
    [room?.gameKey, room?.config?.maxPlayers, room?.config?.rolePack, room?.players?.length]
  );
  const resultKey = room?.lastResult
    ? [
        room.roomNo,
        room.lastResult.headline,
        room.lastResult.detail || "",
        room.lastResult.winnerSide,
        room.feed?.[room.feed.length - 1]?.id || ""
      ].join("|")
    : "";
  const resultOpen = Boolean(room?.lastResult) && dismissedResultKey !== resultKey;
  const recoveryBanner = getRecoveryBannerMessage(mySeat, socketConnected, nowMs);
  const recoveryNotice = recoveryBanner || recoveryRestoreNotice;
  const voiceStatus = getDegradedSubsystem(room, "voice");
  const voiceBlocked = isSubsystemBlocked(room, "voice");
  const voiceDegraded = isSubsystemDegraded(room, "voice");
  const voiceSafeActionLabels = getSafeActionLabels(voiceStatus.safeActions);
  const {
    voiceJoined,
    voiceMuted,
    voiceError,
    remoteStreams,
    bindRemoteAudioRef,
    cleanupVoice,
    enableVoice,
    handleVoicePeers,
    handleVoiceSignal,
    handleVoiceUserLeft,
    toggleVoiceMute
  } = usePartyVoiceRuntime({
    roomNo,
    room,
    viewer: mySeat,
    socket,
    initialMuted: false,
    voiceEvents: VOICE_EVENTS,
    subscribeToRoom() {
      if (socket && roomNo) {
        socket.emit(PARTY_EVENTS.subscribe, { roomNo });
      }
    },
    getManualJoinOptions() {
      if (!mySeat) {
        return {
          allowed: false,
          error: "请先加入房间并入座，再接通语音"
        };
      }

      if (voiceBlocked) {
        return {
          allowed: false,
          error: voiceStatus.message || "語音暫時停用，請先使用文字溝通。"
        };
      }

      if (room?.config?.voiceEnabled === false) {
        return {
          allowed: false,
          error: "当前房间未开启语音"
        };
      }

      if (!socket) {
        return {
          allowed: false,
          error: "房间连接尚未建立，请稍后再试"
        };
      }

      return {
        allowed: true,
        muted: false,
        receiveOnly: false
      };
    },
    getRecoveryJoinOptions() {
      return {
        allowed: Boolean(mySeat) && !voiceBlocked && room?.config?.voiceEnabled !== false && Boolean(socket),
        muted: true,
        receiveOnly: true
      };
    },
    permissionsErrorText: "麦克风权限未开启或设备不可用",
    negotiationErrorText: "语音连接协商失败",
    showMessage
  });
  const voiceDiagnostics = room?.voiceDiagnostics || null;
  const voiceModeState = voiceDiagnostics?.mode || room?.voiceTransport?.mode || "direct-preferred";
  const voiceRuntimeState =
    voiceDiagnostics?.runtimeState || room?.voiceTransport?.runtimeState || "healthy";
  const voiceRecoveryState = getPartyVoiceRecoveryState({ mySeat, voiceJoined, voiceMuted });

  useEffect(() => {
    if (!roomNo) {
      return;
    }

    loadRoom().catch(() => showMessage("读取房间失败"));

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
      showMessage(error || "房间操作失败");
    }

    function onVoiceSignal(payload) {
      handleVoiceSignal(payload).catch(() => {
        showMessage("语音连接协商失败");
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
    socket.on(PARTY_EVENTS.voicePeers, handleVoicePeers);
    socket.on(PARTY_EVENTS.voiceUserLeft, handleVoiceUserLeft);
    socket.on(VOICE_EVENTS.signal, onVoiceSignal);

    subscribeIfSeated();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(PARTY_EVENTS.update, onRoomUpdate);
      socket.off(PARTY_EVENTS.error, onRoomError);
      socket.off(PARTY_EVENTS.voicePeers, handleVoicePeers);
      socket.off(PARTY_EVENTS.voiceUserLeft, handleVoiceUserLeft);
      socket.off(VOICE_EVENTS.signal, onVoiceSignal);
    };
  }, [roomNo, me, handleVoicePeers, handleVoiceUserLeft]);

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
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 200);

    return () => clearInterval(timer);
  }, [room?.phaseEndsAt]);

  useEffect(() => {
    setWitchPlan({
      saveTarget: Boolean(room?.round?.witchStatus?.plan?.saveTarget),
      poisonSeat:
        room?.round?.witchStatus?.plan?.poisonSeat === undefined
          ? null
          : room?.round?.witchStatus?.plan?.poisonSeat
    });
  }, [room?.round?.stage, room?.round?.nightNo, room?.round?.witchStatus?.committed]);

  useEffect(() => {
    if (me?.kind !== "user" || !roomNo) {
      return;
    }

    const pendingClaim = readPendingGuestMatchClaim();
    const currentRoute = `/party/${roomNo}`;
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
      router.push(`/login?returnTo=${encodeURIComponent(`/party/${roomNo}`)}`);
      return;
    }

    if (!roomResponse.ok) {
      showMessage(roomData.error || "房间不存在");
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
      showMessage(data.error || "加入房间失败");
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

  async function sendNote(event) {
    event.preventDefault();
    const text = noteText.trim();
    if (!text) {
      return;
    }

    socket?.emit(PARTY_EVENTS.message, { roomNo, text });
    setNoteText("");
  }

  function queueGuestClaimSync() {
    if (me?.kind !== "guest" || !room?.lastResult) {
      return;
    }

    writePendingGuestMatchClaim(buildPartyGuestClaim(room, me, mySeat));
    router.push(`/login?returnTo=${encodeURIComponent(`/party/${room.roomNo}`)}`);
  }

  if (!room || !meta) {
    return (
      <SiteLayout immersive>
        <div className={styles.loading}>正在同步房间状态...</div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout immersive>
      <section
        className={`${styles.scene} ${
          room.gameKey === "werewolf" ? styles.themeWerewolf : styles.themeAvalon
        }`}
      >
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
                {meta.strapline} · {players.length}/{room.config.maxPlayers} 人 ·
                最低开局 {limits.minPlayers} 人
              </p>
            </div>
          </div>

          <div className={styles.hudActions}>
            <PhaseTimer
              remainingMs={phaseRemainingMs}
              durationMs={room.phaseDurationMs}
              label={getPhaseText(room)}
            />
            <button type="button" className={styles.hudButton} onClick={() => router.push(meta.route)}>
              返回大厅
            </button>
            {!voiceJoined ? (
              <button
                type="button"
                className={styles.primaryButton}
                data-voice-status={voiceStatus.state}
                data-voice-action="join"
                disabled={voiceBlocked}
                onClick={enableVoice}
              >
                {getVoiceButtonLabel({
                  voiceBlocked,
                  voiceDegraded,
                  hasSeat: Boolean(mySeat)
                })}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.hudButton}
                  data-voice-action="toggle"
                  onClick={toggleVoiceMute}
                >
                  {voiceMuted ? "取消静音" : "麦克风静音"}
                </button>
                <button
                  type="button"
                  className={styles.hudButton}
                  data-voice-action="leave"
                  onClick={() => cleanupVoice(true, true)}
                >
                  断开语音
                </button>
              </>
            )}
          </div>
        </header>

        <div className={styles.layout}>
          <section className={styles.stage}>
            <div className={styles.boardHeader}>
              <div>
                <strong>{getStageHeadline(room)}</strong>
                <span>{getStageSubline(room)}</span>
              </div>
              <div className={styles.stageBadges} data-party-config="true">
                <span>{room.state === "waiting" ? "等待准备" : "对局进行中"}</span>
                <span>{room.config.visibility === "private" ? "私密房" : "公开房"}</span>
                <span>{room.config.voiceEnabled ? "语音已开启" : "文字房"}</span>
                <span data-voice-mode={voiceModeState}>{getPartyVoiceModeLabel(voiceModeState)}</span>
                <span data-voice-runtime-state={voiceRuntimeState}>
                  {getPartyVoiceRuntimeLabel(voiceRuntimeState, voiceModeState)}
                </span>
                <span data-voice-recovery={voiceRecoveryState}>
                  {getPartyVoiceRecoveryLabel(voiceRecoveryState)}
                </span>
                {voiceDegraded ? (
                  <span data-voice-status={voiceStatus.state}>
                    {voiceBlocked ? "語音暫停" : "語音降級"}
                  </span>
                ) : null}
                {rolePackSummary?.label ? <span>{rolePackSummary.label}</span> : null}
                {room.gameKey === "werewolf" ? (
                  <span>猎人反击 {Number(room.config.hunterSeconds || 20)}s</span>
                ) : null}
                {(rolePackSummary?.roles || []).map((item) => (
                  <span key={`${item.key}-${item.count}`}>
                    {item.label}
                    {item.count > 1 ? ` x${item.count}` : ""}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.boardBody}>
              {room.gameKey === "werewolf" ? (
                <WerewolfBoard room={room} mySeat={mySeat} emitAction={emitAction} />
              ) : (
                <AvalonBoard room={room} mySeat={mySeat} emitAction={emitAction} />
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
                    >
                      {mySeat.ready ? "取消准备" : "准备开局"}
                    </button>
                    {mySeat?.isOwner && players.length < room.config.maxPlayers ? (
                      <button
                        type="button"
                        className={styles.hudButton}
                        onClick={() => emitAddBot(1)}
                      >
                        补机器人
                      </button>
                    ) : null}
                  </div>
                  <span>
                    当前 {players.filter((player) => player.ready).length}/{players.length} 人已准备
                  </span>
                </div>
              ) : room.gameKey === "werewolf" ? (
                <WerewolfActions
                  room={room}
                  mySeat={mySeat}
                  witchPlan={witchPlan}
                  setWitchPlan={setWitchPlan}
                  emitAction={emitAction}
                />
              ) : (
                <AvalonActions room={room} mySeat={mySeat} emitAction={emitAction} />
              )}

              <form className={styles.noteForm} onSubmit={sendNote}>
                <input
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  placeholder="发一条简短房内消息"
                />
                <button type="submit" className={styles.hudButton}>
                  发送
                </button>
              </form>

              <div className={styles.quickLineRow}>
                {(QUICK_LINES[room.gameKey] || []).map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={styles.quickLine}
                    onClick={() => socket?.emit(PARTY_EVENTS.message, { roomNo, text: item })}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <aside className={styles.sidePanel}>
            <section className={styles.viewerCard}>
              <div
                className={styles.viewerHead}
                data-presence-state={mySeat?.presenceState || "disconnected"}
              >
                <div>
                  <span>你的席位</span>
                  <strong>{mySeat ? `#${mySeat.seatIndex + 1} ${mySeat.displayName}` : "尚未入座"}</strong>
                </div>
                <div className={styles.stageBadges}>
                  {mySeat?.roleLabel ? <span className={styles.rolePill}>{mySeat.roleLabel}</span> : null}
                  {mySeat ? (
                    <span
                      className={styles.rolePill}
                      data-presence-state={mySeat.presenceState || "disconnected"}
                    >
                      {getPresenceLabel(mySeat)}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className={styles.noteList}>
                {(mySeat?.notes || ["加入房间后即可看到你的身份信息。"]).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
              {room.lastResult ? (
                <div className={styles.resultReveal}>
                  <strong>{room.lastResult.headline}</strong>
                  {room.lastResult.detail ? <span>{room.lastResult.detail}</span> : null}
                  <div className={styles.revealGrid}>
                    {room.lastResult.players.map((player) => (
                      <div key={player.seatIndex}>
                        <strong>{player.displayName}</strong>
                        <span>
                          {player.roleLabel} · {player.side === "evil" ? "邪恶" : "正义"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>

            <section
              className={styles.voiceCard}
              data-voice-status={voiceStatus.state}
              data-availability-reason={voiceStatus.reasonCode || `voice:${voiceStatus.state}`}
            >
              <div className={styles.panelTitle}>
                <strong>语音席</strong>
                <span>{players.filter((player) => player.voiceConnected).length} 人在线语音</span>
              </div>
              {voiceDegraded ? (
                <div className={styles.noteList}>
                  <span>{voiceStatus.message || "語音目前處於受控降級模式。"}</span>
                  {voiceSafeActionLabels.map((label, index) => (
                    <span
                      key={`${voiceStatus.subsystem}:${voiceStatus.safeActions[index] || label}`}
                      data-safe-action={voiceStatus.safeActions[index] || ""}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              ) : null}
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
                          ? "静音"
                          : "通话中"
                        : "未接通"}
                    </strong>
                  </div>
                ))}
              </div>
              {Object.entries(remoteStreams).map(([userId, stream]) => (
                <audio
                  key={userId}
                  autoPlay
                  ref={(node) => bindRemoteAudioRef(userId, node)}
                />
              ))}
            </section>

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
          </aside>
        </div>

        <MatchResultOverlay
          open={resultOpen}
          onClose={() => setDismissedResultKey(resultKey)}
          eyebrow={`${meta?.title || "派对房"} 结算`}
          title={getPartyResultTitle(room, mySeat)}
          subtitle={getPartyResultSubtitle(room)}
          badges={getPartyResultBadges(room, mySeat)}
          rows={getPartyResultRows(room)}
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
            onClick: () => router.push(meta?.route || "/")
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

        {recoveryNotice ? (
          <div
            className={styles.recoveryBanner}
            data-recovery-banner="true"
            data-recovery-state={mySeat?.presenceState || (socketConnected === false ? "reconnecting" : "connected")}
          >
            {recoveryNotice}
          </div>
        ) : null}
        {message ? <div className={styles.toast}>{message}</div> : null}
      </section>
    </SiteLayout>
  );
}

function WerewolfBoard({ room, mySeat }) {
  return (
    <div className={styles.gameBoard}>
      <div className={styles.boardTopline}>
        <span>
          {room.round?.stage === "night"
            ? `第 ${room.round?.nightNo || 1} 夜`
            : `第 ${room.round?.dayNo || 1} 天`}
        </span>
        <span>
          {room.round?.stage === "night"
            ? "夜晚行动"
            : room.round?.stage === "vote"
              ? "公开投票"
              : room.round?.stage === "hunter-shot"
                ? "猎人反击"
                : "白天讨论"}
        </span>
      </div>
      <div className={styles.seatGrid}>
        {room.players.map((player) => (
          <div
            key={player.userId}
            className={`${styles.seatCard} ${player.alive ? "" : styles.seatDead} ${
              mySeat?.seatIndex === player.seatIndex ? styles.seatSelf : ""
            }`}
            data-presence-state={player.presenceState || "disconnected"}
          >
            <div className={styles.seatHead}>
              <strong>{player.displayName}</strong>
              <span>#{player.seatIndex + 1}</span>
            </div>
            <div className={styles.seatMeta}>
              {player.isBot ? <span className={styles.botChip}>AI</span> : null}
              <span>{player.alive ? "存活" : "出局"}</span>
              <span>{getPresenceLabel(player)}</span>
              {player.voiceConnected ? <span>{player.voiceMuted ? "静音" : "语音中"}</span> : null}
            </div>
            {player.roleLabel ? <span className={styles.roleChip}>{player.roleLabel}</span> : null}
            {player.sideHint ? (
              <span className={styles.sideChip}>
                {player.sideHint === "evil" ? "已知邪恶" : player.sideHint === "good" ? "正义" : player.sideHint}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function AvalonBoard({ room, mySeat }) {
  return (
    <div className={styles.gameBoard}>
      <div className={styles.questTrack}>
        {(room.round?.questResults || []).map((quest) => (
          <div
            key={quest.roundNo}
            className={`${styles.questNode} ${quest.passed ? styles.questPass : styles.questFail}`}
          >
            <strong>{quest.roundNo}</strong>
            <span>{quest.passed ? "成功" : `${quest.failVotes} 败`}</span>
          </div>
        ))}
        {Array.from({
          length: Math.max(0, 5 - (room.round?.questResults?.length || 0))
        }).map((_, index) => (
          <div key={`pending-${index}`} className={styles.questNode}>
            <strong>{(room.round?.questResults?.length || 0) + index + 1}</strong>
            <span>待定</span>
          </div>
        ))}
      </div>

      <div className={styles.teamStrip}>
        <span>当前队长：{room.players[room.round?.leaderSeat || 0]?.displayName}</span>
        <span>本轮组队人数：{room.round?.teamSize}</span>
        <span>否决计数：{room.round?.rejectTrack || 0}/5</span>
      </div>

      <div className={styles.seatGrid}>
        {room.players.map((player) => (
          <div
            key={player.userId}
            className={`${styles.seatCard} ${
              room.round?.leaderSeat === player.seatIndex ? styles.seatLeader : ""
            } ${room.round?.selectedTeam?.includes(player.seatIndex) ? styles.seatSelected : ""} ${
              mySeat?.seatIndex === player.seatIndex ? styles.seatSelf : ""
            }`}
            data-presence-state={player.presenceState || "disconnected"}
          >
            <div className={styles.seatHead}>
              <strong>{player.displayName}</strong>
              <span>#{player.seatIndex + 1}</span>
            </div>
            <div className={styles.seatMeta}>
              {player.isBot ? <span className={styles.botChip}>AI</span> : null}
              {room.round?.leaderSeat === player.seatIndex ? <span>队长</span> : null}
              {room.round?.selectedTeam?.includes(player.seatIndex) ? <span>入队</span> : null}
              <span>{getPresenceLabel(player)}</span>
              {player.voiceConnected ? <span>{player.voiceMuted ? "静音" : "语音中"}</span> : null}
            </div>
            {player.roleLabel ? <span className={styles.roleChip}>{player.roleLabel}</span> : null}
            {player.sideHint ? (
              <span className={styles.sideChip}>
                {player.sideHint === "evil" ? "已知邪恶" : player.sideHint}
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function WerewolfActions({ room, mySeat, witchPlan, setWitchPlan, emitAction }) {
  if (!mySeat?.alive && room.round?.pendingHunterSeat !== mySeat?.seatIndex) {
    return <div className={styles.actionPanel}>你已出局，继续旁听语音并观察票型。</div>;
  }

  const aliveTargets = room.players.filter(
    (player) => player.alive && player.seatIndex !== mySeat.seatIndex
  );

  if (room.round?.stage === "night") {
    if (mySeat.role === "werewolf") {
      return (
        <div className={styles.actionPanel}>
          <strong>狼人夜刀</strong>
          <div className={styles.targetGrid}>
            {aliveTargets
              .filter((player) => player.sideHint !== "evil" && player.roleLabel !== "狼人")
              .map((player) => (
                <button
                  key={player.seatIndex}
                  type="button"
                  className={`${styles.choiceButton} ${
                    room.round?.myWolfTarget === player.seatIndex ? styles.choiceActive : ""
                  }`}
                  onClick={() => emitAction({ type: "wolf-target", targetSeat: player.seatIndex })}
                >
                  刀 {player.displayName}
                </button>
              ))}
          </div>
        </div>
      );
    }

    if (mySeat.role === "seer") {
      return (
        <div className={styles.actionPanel}>
          <strong>预言家查验</strong>
          {room.round?.seerResult ? (
            <p>
              {room.round.seerResult.displayName} 是
              {room.round.seerResult.side === "evil" ? " 邪恶阵营" : " 好人阵营"}
            </p>
          ) : null}
          <div className={styles.targetGrid}>
            {aliveTargets.map((player) => (
              <button
                key={player.seatIndex}
                type="button"
                className={`${styles.choiceButton} ${
                  room.round?.myInspectTarget === player.seatIndex ? styles.choiceActive : ""
                }`}
                onClick={() => emitAction({ type: "seer-inspect", targetSeat: player.seatIndex })}
              >
                查验 {player.displayName}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (mySeat.role === "witch") {
      return (
        <div className={styles.actionPanel}>
          <strong>女巫用药</strong>
          <div className={styles.checkRow}>
            <label>
              <input
                type="checkbox"
                checked={witchPlan.saveTarget}
                disabled={
                  room.round?.incomingVictimSeat === null || room.round?.witchStatus?.healUsed
                }
                onChange={(event) =>
                  setWitchPlan((current) => ({
                    ...current,
                    saveTarget: event.target.checked
                  }))
                }
              />
              救下 {room.players[room.round?.incomingVictimSeat || 0]?.displayName || "无人"}
            </label>
          </div>
          <div className={styles.targetGrid}>
            {aliveTargets.map((player) => (
              <button
                key={player.seatIndex}
                type="button"
                disabled={room.round?.witchStatus?.poisonUsed}
                className={`${styles.choiceButton} ${
                  witchPlan.poisonSeat === player.seatIndex ? styles.choiceActive : ""
                }`}
                onClick={() =>
                  setWitchPlan((current) => ({
                    ...current,
                    poisonSeat: current.poisonSeat === player.seatIndex ? null : player.seatIndex
                  }))
                }
              >
                毒 {player.displayName}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() =>
              emitAction({
                type: "witch-plan",
                saveTarget: witchPlan.saveTarget,
                poisonSeat: witchPlan.poisonSeat
              })
            }
          >
            提交女巫行动
          </button>
        </div>
      );
    }

    if (mySeat.role === "guard") {
      return (
        <div className={styles.actionPanel}>
          <strong>守卫守护</strong>
          <p>每晚可守一人，且不能连续两晚守同一目标。</p>
          <div className={styles.targetGrid}>
            {room.players
              .filter((player) => player.alive && player.seatIndex !== room.round?.lastGuardTarget)
              .map((player) => (
                <button
                  key={player.seatIndex}
                  type="button"
                  className={`${styles.choiceButton} ${
                    room.round?.myGuardTarget === player.seatIndex ? styles.choiceActive : ""
                  }`}
                  onClick={() => emitAction({ type: "guard-protect", targetSeat: player.seatIndex })}
                >
                  守 {player.displayName}
                </button>
              ))}
          </div>
        </div>
      );
    }

    return <div className={styles.actionPanel}>夜晚请保持安静，等待神职和狼人完成操作。</div>;
  }

  if (room.round?.stage === "discussion") {
    return <div className={styles.actionPanel}>白天讨论阶段，打开语音发言，准备下一轮公开投票。</div>;
  }

  if (room.round?.stage === "hunter-shot") {
    if (room.round?.pendingHunterSeat !== mySeat?.seatIndex) {
      return <div className={styles.actionPanel}>猎人正在选择要带走的目标。</div>;
    }

    return (
      <div className={styles.actionPanel}>
        <strong>猎人开枪</strong>
        <div className={styles.targetGrid}>
          {aliveTargets.map((player) => (
            <button
              key={player.seatIndex}
              type="button"
              className={styles.choiceButton}
              onClick={() => emitAction({ type: "hunter-shot", targetSeat: player.seatIndex })}
            >
              带走 {player.displayName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (room.round?.stage === "vote") {
    return (
      <div className={styles.actionPanel}>
        <strong>公开投票</strong>
        <div className={styles.targetGrid}>
          {aliveTargets.map((player) => (
            <button
              key={player.seatIndex}
              type="button"
              className={`${styles.choiceButton} ${
                room.round?.myVote === player.seatIndex ? styles.choiceActive : ""
              }`}
              onClick={() => emitAction({ type: "day-vote", targetSeat: player.seatIndex })}
            >
              投 {player.displayName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

function AvalonActions({ room, mySeat, emitAction }) {
  if (room.round?.stage === "team-building") {
    if (room.round?.leaderSeat !== mySeat?.seatIndex) {
      return <div className={styles.actionPanel}>等待队长选择任务小队。</div>;
    }

    return (
      <div className={styles.actionPanel}>
        <strong>队长组队</strong>
        <div className={styles.targetGrid}>
          {room.players.map((player) => (
            <button
              key={player.seatIndex}
              type="button"
              className={`${styles.choiceButton} ${
                room.round?.selectedTeam?.includes(player.seatIndex) ? styles.choiceActive : ""
              }`}
              onClick={() => emitAction({ type: "select-team", targetSeat: player.seatIndex })}
            >
              {player.displayName}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          disabled={room.round?.selectedTeam?.length !== room.round?.teamSize}
          onClick={() => emitAction({ type: "confirm-team" })}
        >
          提交队伍
        </button>
      </div>
    );
  }

  if (room.round?.stage === "team-vote") {
    return (
      <div className={styles.actionPanel}>
        <strong>全员表决</strong>
        <div className={styles.inlineActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => emitAction({ type: "team-vote", value: "approve" })}
          >
            同意队伍
          </button>
          <button
            type="button"
            className={styles.hudButton}
            onClick={() => emitAction({ type: "team-vote", value: "reject" })}
          >
            拒绝队伍
          </button>
        </div>
      </div>
    );
  }

  if (room.round?.stage === "quest") {
    if (!room.round?.selectedTeam?.includes(mySeat?.seatIndex)) {
      return <div className={styles.actionPanel}>等待任务成员暗投任务牌。</div>;
    }

    return (
      <div className={styles.actionPanel}>
        <strong>任务暗投</strong>
        <div className={styles.inlineActions}>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => emitAction({ type: "quest-vote", value: "success" })}
          >
            成功
          </button>
          {mySeat?.side === "evil" ? (
            <button
              type="button"
              className={styles.hudButton}
              onClick={() => emitAction({ type: "quest-vote", value: "fail" })}
            >
              失败
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  if (room.round?.stage === "assassination") {
    if (mySeat?.role !== "assassin") {
      return <div className={styles.actionPanel}>刺客正在锁定梅林目标。</div>;
    }

    return (
      <div className={styles.actionPanel}>
        <strong>刺杀梅林</strong>
        <div className={styles.targetGrid}>
          {room.players.map((player) => (
            <button
              key={player.seatIndex}
              type="button"
              className={styles.choiceButton}
              onClick={() => emitAction({ type: "assassin-pick", targetSeat: player.seatIndex })}
            >
              指向 {player.displayName}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
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

function getPhaseText(room) {
  if (room.state === "waiting") {
    return "待开局";
  }

  if (room.gameKey === "werewolf") {
    const map = {
      night: "夜晚",
      discussion: "讨论",
      vote: "投票",
      "hunter-shot": "开枪"
    };
    return map[room.round?.stage] || "对局";
  }

  const map = {
    "team-building": "组队",
    "team-vote": "表决",
    quest: "任务",
    assassination: "刺杀"
  };
  return map[room.round?.stage] || "对局";
}

function getStageHeadline(room) {
  if (room.state === "waiting") {
    return "等待玩家准备";
  }

  if (room.gameKey === "werewolf") {
    if (room.round?.stage === "night") {
      return "夜色已落，神职与狼人开始行动";
    }
    if (room.round?.stage === "discussion") {
      return "天亮发言，打开语音互相试探";
    }
    if (room.round?.stage === "hunter-shot") {
      return "猎人翻枪，局势正在瞬间改写";
    }
    return "公开投票阶段";
  }

  if (room.round?.stage === "team-building") {
    return "队长正在组队";
  }
  if (room.round?.stage === "team-vote") {
    return "全员表决当前小队";
  }
  if (room.round?.stage === "quest") {
    return "任务成员暗投任务牌";
  }
  return "刺客锁定梅林";
}

function getStageSubline(room) {
  if (room.state === "waiting") {
    return `当前 ${room.players.length}/${room.config.maxPlayers} 人，最低 ${getGameLimits(room.gameKey).minPlayers} 人可开局`;
  }

  if (room.gameKey === "werewolf") {
    if (room.round?.stage === "hunter-shot") {
      return `存活 ${room.round?.aliveCount || 0} 人，等待猎人决定最后一枪`;
    }
    return `存活 ${room.round?.aliveCount || 0} 人，第 ${room.round?.dayNo || 1} 天`;
  }

  return `第 ${room.round?.roundNo || 1} 轮任务，当前否决计数 ${room.round?.rejectTrack || 0}/5`;
}

function getPartyResultTitle(room, mySeat) {
  if (!room?.lastResult) {
    return "";
  }

  const viewerRecord = room.lastResult.players?.find((player) => player.seatIndex === mySeat?.seatIndex);
  if (viewerRecord) {
    return viewerRecord.side === room.lastResult.winnerSide ? "你赢了" : "你输了";
  }

  return room.lastResult.headline;
}

function getPartyResultSubtitle(room) {
  if (!room?.lastResult) {
    return "";
  }

  const viewerRecord = room.lastResult.players?.find((player) => player.seatIndex === room.viewer?.seatIndex);
  const signedDelta =
    typeof viewerRecord?.delta === "number" ? ` · 金币 ${formatSigned(viewerRecord.delta)}` : "";

  return room.lastResult.detail
    ? `${room.lastResult.headline} · ${room.lastResult.detail}${signedDelta}`
    : `${room.lastResult.headline}${signedDelta}`;
}

function getPartyResultBadges(room, mySeat) {
  if (!room?.lastResult) {
    return [];
  }

  const viewerRecord = room.lastResult.players?.find((player) => player.seatIndex === mySeat?.seatIndex);

  return [
    `房号 ${room.roomNo}`,
    room.gameKey === "werewolf" ? "狼人杀" : "阿瓦隆",
    viewerRecord
      ? viewerRecord.side === room.lastResult.winnerSide
        ? "本局胜利"
        : "本局失利"
      : room.lastResult.headline
  ];
}

function getPartyResultRows(room) {
  if (!room?.lastResult) {
    return [];
  }

  return room.lastResult.players.map((player) => ({
    label: player.displayName,
    meta: `${player.roleLabel} · ${player.side === "evil" ? "邪恶" : "正义"} · ${
      player.side === room.lastResult.winnerSide ? "胜利" : "失利"
    }`,
    value: formatSigned(player.delta || 0),
    tone:
      Number(player.delta || 0) > 0
        ? "positive"
        : Number(player.delta || 0) < 0
          ? "negative"
          : "neutral"
  }));
}

function buildPartyGuestClaim(room, session, mySeat) {
  const viewerRecord = room?.lastResult?.players?.find((player) => player.seatIndex === mySeat?.seatIndex);

  return {
    guestId: session.guestId || session.id,
    gameKey: room.gameKey,
    roomNo: room.roomNo,
    familyKey: "party",
    returnTo: `/party/${room.roomNo}`,
    summary: {
      title: room.title,
      headline: room.lastResult?.headline || "",
      detail: room.lastResult?.detail || "",
      viewerDisplayName: session.displayName,
      outcome: viewerRecord
        ? viewerRecord.side === room.lastResult?.winnerSide
          ? "win"
          : "loss"
        : "completed"
    }
  };
}

function getVoiceButtonLabel({ voiceBlocked, voiceDegraded, hasSeat }) {
  if (voiceBlocked) {
    return "語音暫停";
  }

  if (!hasSeat) {
    return "入座后接通语音";
  }

  if (voiceDegraded) {
    return "重試語音";
  }

  return "接通语音";
}

function getPartyVoiceModeLabel(mode) {
  return mode === "relay-required" ? "稳定模式" : "直连优先";
}

function getPartyVoiceRuntimeLabel(state, mode) {
  if (state === "blocked") {
    return "语音暂停";
  }

  if (state === "degraded") {
    return mode === "relay-required" ? "已切稳定" : "语音降级";
  }

  return "语音正常";
}

function getPartyVoiceRecoveryState({ mySeat, voiceJoined, voiceMuted }) {
  if (mySeat?.voiceRecovery?.autoResumeEligible) {
    return "rejoin-ready";
  }

  if (voiceJoined) {
    return voiceMuted ? "joined-muted" : "joined-live";
  }

  if (getPresenceState(mySeat) === "reconnecting") {
    return "reconnecting";
  }

  return "idle";
}

function getPartyVoiceRecoveryLabel(state) {
  if (state === "rejoin-ready") {
    return "重连后将以静音恢复";
  }

  if (state === "joined-muted") {
    return "已接入静音";
  }

  if (state === "joined-live") {
    return "语音已接通";
  }

  if (state === "reconnecting") {
    return "房间重连中";
  }

  return "等待接通";
}

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
}

function formatSigned(value) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : ""}${amount}`;
}
