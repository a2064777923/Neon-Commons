import { useEffect, useRef, useState } from "react";

const {
  VOICE_REPORT_REASONS,
  VOICE_TRANSPORT_MODES
} = require("../shared/network-contract");

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function cloneRemoteStreams(current) {
  return { ...current };
}

export function usePartyVoiceRuntime(options = {}) {
  const initialMuted = normalizeBoolean(options.initialMuted, false);
  const [voiceJoined, setVoiceJoined] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(initialMuted);
  const [voiceError, setVoiceError] = useState("");
  const [remoteStreams, setRemoteStreams] = useState({});

  const roomRef = useRef(options.room || null);
  const viewerRef = useRef(options.viewer || null);
  const socketRef = useRef(options.socket || null);
  const subscribeToRoomRef = useRef(options.subscribeToRoom || null);
  const getManualJoinOptionsRef = useRef(options.getManualJoinOptions || null);
  const getRecoveryJoinOptionsRef = useRef(options.getRecoveryJoinOptions || null);
  const showMessageRef = useRef(options.showMessage || null);
  const roomNoRef = useRef(options.roomNo || "");
  const joinedVoiceRef = useRef(false);
  const joinReceiveOnlyRef = useRef(false);
  const voiceMutedRef = useRef(initialMuted);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const remoteStreamsRef = useRef({});
  const remoteAudioRefs = useRef({});
  const startupProbeTimerRef = useRef(null);
  const persistentFailureTimersRef = useRef(new Map());
  const healthyPeersRef = useRef(new Set());
  const localForceRelayRef = useRef(false);
  const autoRecoveryKeyRef = useRef("");

  useEffect(() => {
    roomRef.current = options.room || null;
    viewerRef.current = options.viewer || null;
    socketRef.current = options.socket || null;
    subscribeToRoomRef.current = options.subscribeToRoom || null;
    getManualJoinOptionsRef.current = options.getManualJoinOptions || null;
    getRecoveryJoinOptionsRef.current = options.getRecoveryJoinOptions || null;
    showMessageRef.current = options.showMessage || null;
    roomNoRef.current = String(options.roomNo || "");
  }, [
    options.room,
    options.viewer,
    options.socket,
    options.subscribeToRoom,
    options.getManualJoinOptions,
    options.getRecoveryJoinOptions,
    options.showMessage,
    options.roomNo
  ]);

  useEffect(() => {
    const socket = options.socket || null;
    if (!socket || socket.connected !== false || !joinedVoiceRef.current) {
      return;
    }

    cleanupVoice(true, false);
  }, [options.socket, options.socket?.connected]);

  useEffect(() => {
    const room = options.room || null;
    if (room?.degradedState?.subsystems?.voice?.state === "blocked" && joinedVoiceRef.current) {
      cleanupVoice(true, true);
    }
  }, [options.room?.degradedState?.subsystems?.voice?.state]);

  useEffect(() => {
    const room = options.room || null;
    if (
      room?.voiceTransport?.mode !== VOICE_TRANSPORT_MODES.relayRequired ||
      !joinedVoiceRef.current ||
      localForceRelayRef.current
    ) {
      return;
    }

    localForceRelayRef.current = true;
    rebuildPeerConnections().catch(() => null);
  }, [options.room?.voiceTransport?.mode]);

  useEffect(() => {
    const recovery = options.viewer?.voiceRecovery || null;
    if (!recovery?.autoResumeEligible) {
      autoRecoveryKeyRef.current = "";
      return;
    }

    const socket = options.socket || null;
    if (!socket?.connected || joinedVoiceRef.current) {
      return;
    }

    const recoveryOptions =
      getRecoveryJoinOptionsRef.current?.({
        room: roomRef.current,
        viewer: viewerRef.current
      }) || {};
    if (recoveryOptions.allowed === false) {
      return;
    }

    const recoveryKey = [
      viewerRef.current?.userId || "",
      recovery.rejoinBy || "",
      recovery.lastMode || ""
    ].join("|");
    if (!recoveryKey || autoRecoveryKeyRef.current === recoveryKey) {
      return;
    }

    beginJoin({
      muted: true,
      receiveOnly: true,
      recoveryKey,
      ...recoveryOptions
    }).catch(() => null);
  }, [
    options.socket,
    options.socket?.connected,
    options.viewer?.voiceRecovery?.autoResumeEligible,
    options.viewer?.voiceRecovery?.rejoinBy,
    options.viewer?.voiceRecovery?.lastMode
  ]);

  useEffect(() => {
    return () => {
      cleanupVoice(true, false);
    };
  }, []);

  function getCurrentRoom() {
    return roomRef.current || null;
  }

  function getCurrentTransport() {
    return getCurrentRoom()?.voiceTransport || {};
  }

  function getEffectiveMode() {
    return localForceRelayRef.current
      ? VOICE_TRANSPORT_MODES.relayRequired
      : getCurrentTransport().mode || VOICE_TRANSPORT_MODES.directPreferred;
  }

  function getTransportThreshold(name, fallback) {
    const numeric = Number(getCurrentTransport()?.[name]);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
  }

  function getTransportIceServers() {
    const iceServers = getCurrentTransport()?.iceServers;
    return Array.isArray(iceServers) ? iceServers : [];
  }

  function clearStartupProbe() {
    if (startupProbeTimerRef.current) {
      clearTimeout(startupProbeTimerRef.current);
      startupProbeTimerRef.current = null;
    }
  }

  function clearPersistentFailureTimer(userId) {
    const timer = persistentFailureTimersRef.current.get(userId);
    if (timer) {
      clearTimeout(timer);
      persistentFailureTimersRef.current.delete(userId);
    }
  }

  function clearAllPersistentFailureTimers() {
    for (const timer of persistentFailureTimersRef.current.values()) {
      clearTimeout(timer);
    }
    persistentFailureTimersRef.current.clear();
  }

  function applyRemoteStream(userId, stream) {
    remoteStreamsRef.current = {
      ...remoteStreamsRef.current,
      [userId]: stream
    };
    setRemoteStreams(remoteStreamsRef.current);

    const audio = remoteAudioRefs.current[userId];
    if (audio) {
      if (audio.srcObject !== stream) {
        audio.srcObject = stream;
      }
      audio.play?.().catch(() => null);
    }
  }

  function bindRemoteAudioRef(userId, node) {
    if (!node) {
      delete remoteAudioRefs.current[userId];
      return;
    }

    remoteAudioRefs.current[userId] = node;
    const stream = remoteStreamsRef.current[userId];
    if (stream && node.srcObject !== stream) {
      node.srcObject = stream;
      node.play?.().catch(() => null);
    }
  }

  function applyLocalTrackEnabled(enabled) {
    if (!localStreamRef.current) {
      return;
    }

    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }

  async function ensureLocalStream() {
    if (localStreamRef.current) {
      return localStreamRef.current;
    }

    const mediaDevices = navigator?.mediaDevices;
    if (!mediaDevices?.getUserMedia) {
      throw new Error(options.permissionsErrorText || "麥克風權限未開啟或裝置不可用。");
    }

    localStreamRef.current = await mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    return localStreamRef.current;
  }

  function getCurrentVoicePeerIds() {
    const room = getCurrentRoom();
    const viewer = viewerRef.current;
    if (!room || !viewer) {
      return [];
    }

    return (Array.isArray(room.players) ? room.players : [])
      .filter((player) => player.userId !== viewer.userId && player.voiceConnected)
      .map((player) => player.userId);
  }

  function detachRemotePeer(userId) {
    clearPersistentFailureTimer(userId);
    healthyPeersRef.current.delete(userId);

    const pc = peerConnectionsRef.current[userId];
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.close();
      delete peerConnectionsRef.current[userId];
    }

    if (remoteStreamsRef.current[userId]) {
      const nextRemoteStreams = cloneRemoteStreams(remoteStreamsRef.current);
      delete nextRemoteStreams[userId];
      remoteStreamsRef.current = nextRemoteStreams;
      setRemoteStreams(nextRemoteStreams);
    }
  }

  async function reportAndSwitch(reason) {
    if (getEffectiveMode() === VOICE_TRANSPORT_MODES.relayRequired) {
      return;
    }

    localForceRelayRef.current = true;
    socketRef.current?.emit(options.voiceEvents.report || "voice:report", {
      roomNo: roomNoRef.current,
      reason
    });
    await rebuildPeerConnections();
  }

  function scheduleStartupProbe() {
    clearStartupProbe();
    if (!joinedVoiceRef.current || getEffectiveMode() !== VOICE_TRANSPORT_MODES.directPreferred) {
      return;
    }

    const startupProbeMs = getTransportThreshold("startupProbeMs", 4000);
    startupProbeTimerRef.current = setTimeout(() => {
      if (joinedVoiceRef.current && healthyPeersRef.current.size === 0) {
        reportAndSwitch(VOICE_REPORT_REASONS.startupTimeout).catch(() => null);
      }
    }, startupProbeMs);
  }

  function schedulePersistentFailure(userId) {
    clearPersistentFailureTimer(userId);
    if (!joinedVoiceRef.current || getEffectiveMode() !== VOICE_TRANSPORT_MODES.directPreferred) {
      return;
    }

    const persistentFailureMs = getTransportThreshold("persistentFailureMs", 6000);
    const timer = setTimeout(() => {
      reportAndSwitch(VOICE_REPORT_REASONS.persistentDisconnect).catch(() => null);
    }, persistentFailureMs);
    persistentFailureTimersRef.current.set(userId, timer);
  }

  function markHealthyPeer(userId) {
    healthyPeersRef.current.add(userId);
    clearPersistentFailureTimer(userId);
    clearStartupProbe();
  }

  function getOrCreatePeerConnection(userId) {
    if (peerConnectionsRef.current[userId]) {
      return peerConnectionsRef.current[userId];
    }

    const config = {
      iceServers: getTransportIceServers()
    };
    if (getEffectiveMode() === VOICE_TRANSPORT_MODES.relayRequired) {
      config.iceTransportPolicy = "relay";
    }

    const pc = new RTCPeerConnection(config);
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit(options.voiceEvents.signal, {
          roomNo: roomNoRef.current,
          targetUserId: userId,
          data: {
            type: "candidate",
            candidate: event.candidate
          }
        });
      }
    };
    pc.ontrack = (event) => {
      const [stream] = event.streams || [];
      if (stream) {
        applyRemoteStream(userId, stream);
      }
      markHealthyPeer(userId);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") {
        markHealthyPeer(userId);
        return;
      }

      if (
        pc.connectionState === "failed" &&
        getEffectiveMode() === VOICE_TRANSPORT_MODES.directPreferred
      ) {
        reportAndSwitch(VOICE_REPORT_REASONS.persistentDisconnect).catch(() => null);
        return;
      }

      if (
        pc.connectionState === "disconnected" &&
        getEffectiveMode() === VOICE_TRANSPORT_MODES.directPreferred
      ) {
        schedulePersistentFailure(userId);
        return;
      }

      if (["closed", "failed", "disconnected"].includes(pc.connectionState)) {
        detachRemotePeer(userId);
      }
    };
    pc.oniceconnectionstatechange = () => {
      if (
        pc.iceConnectionState === "failed" &&
        getEffectiveMode() === VOICE_TRANSPORT_MODES.directPreferred
      ) {
        reportAndSwitch(VOICE_REPORT_REASONS.iceFailed).catch(() => null);
      }

      if (["connected", "completed"].includes(pc.iceConnectionState)) {
        markHealthyPeer(userId);
      }
    };

    if (joinReceiveOnlyRef.current || !localStreamRef.current) {
      pc.addTransceiver("audio", { direction: "recvonly" });
    } else {
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
    socketRef.current?.emit(options.voiceEvents.signal, {
      roomNo: roomNoRef.current,
      targetUserId,
      data: {
        type: "offer",
        sdp: pc.localDescription
      }
    });
  }

  async function rebuildPeerConnections() {
    if (!joinedVoiceRef.current) {
      return;
    }

    clearStartupProbe();
    clearAllPersistentFailureTimers();
    healthyPeersRef.current.clear();

    const peerIds = getCurrentVoicePeerIds();
    Object.keys(peerConnectionsRef.current).forEach((userId) => detachRemotePeer(userId));

    scheduleStartupProbe();
    for (const userId of peerIds) {
      await createOffer(userId);
    }
  }

  async function beginJoin(joinOptions = {}) {
    if (!socketRef.current || !roomNoRef.current) {
      return false;
    }

    const muted = normalizeBoolean(joinOptions.muted, voiceMutedRef.current);
    const receiveOnly = normalizeBoolean(joinOptions.receiveOnly, false);

    setVoiceError("");

    if (!receiveOnly) {
      try {
        await ensureLocalStream();
      } catch (_error) {
        setVoiceError(options.permissionsErrorText || "麥克風權限未開啟或裝置不可用。");
        return false;
      }
    }

    joinReceiveOnlyRef.current = receiveOnly;
    if (localStreamRef.current) {
      applyLocalTrackEnabled(!muted && !receiveOnly);
    }

    subscribeToRoomRef.current?.();
    joinedVoiceRef.current = true;
    setVoiceJoined(true);
    voiceMutedRef.current = muted;
    setVoiceMuted(muted);
    socketRef.current.emit(options.voiceEvents.join, {
      roomNo: roomNoRef.current,
      muted
    });
    scheduleStartupProbe();

    if (joinOptions.recoveryKey) {
      autoRecoveryKeyRef.current = joinOptions.recoveryKey;
    } else {
      autoRecoveryKeyRef.current = "";
    }

    return true;
  }

  async function enableVoice() {
    const manualJoinOptions =
      getManualJoinOptionsRef.current?.({
        room: roomRef.current,
        viewer: viewerRef.current
      }) || {};

    if (manualJoinOptions.allowed === false) {
      setVoiceError(manualJoinOptions.error || "");
      return false;
    }

    return beginJoin(manualJoinOptions);
  }

  function cleanupVoice(stopTracks = true, notifyServer = true) {
    clearStartupProbe();
    clearAllPersistentFailureTimers();
    healthyPeersRef.current.clear();

    if (notifyServer && joinedVoiceRef.current) {
      socketRef.current?.emit(options.voiceEvents.leave, {
        roomNo: roomNoRef.current
      });
    }

    joinedVoiceRef.current = false;
    joinReceiveOnlyRef.current = false;
    localForceRelayRef.current =
      getCurrentTransport().mode === VOICE_TRANSPORT_MODES.relayRequired;
    setVoiceJoined(false);

    Object.keys(peerConnectionsRef.current).forEach((userId) => detachRemotePeer(userId));

    if (stopTracks && localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    voiceMutedRef.current = initialMuted;
    setVoiceMuted(initialMuted);
  }

  async function setVoiceMutedState(nextMuted, notifyServer = false) {
    const muted = Boolean(nextMuted);

    if (!muted && (!localStreamRef.current || joinReceiveOnlyRef.current)) {
      try {
        await ensureLocalStream();
      } catch (_error) {
        setVoiceError(options.permissionsErrorText || "麥克風權限未開啟或裝置不可用。");
        return false;
      }

      joinReceiveOnlyRef.current = false;
      await rebuildPeerConnections();
    }

    setVoiceError("");
    voiceMutedRef.current = muted;
    setVoiceMuted(muted);
    applyLocalTrackEnabled(!muted && !joinReceiveOnlyRef.current);

    if (notifyServer && joinedVoiceRef.current) {
      socketRef.current?.emit(options.voiceEvents.state, {
        roomNo: roomNoRef.current,
        muted
      });
    }

    return true;
  }

  async function toggleVoiceMute() {
    return setVoiceMutedState(!voiceMutedRef.current, true);
  }

  function handleVoicePeers({ peers }) {
    if (!joinedVoiceRef.current) {
      return;
    }

    for (const peer of peers || []) {
      if (peer.userId !== viewerRef.current?.userId) {
        createOffer(peer.userId).catch(() => {
          showMessageRef.current?.(
            options.negotiationErrorText || "語音連線協商失敗"
          );
        });
      }
    }
  }

  function handleVoiceUserLeft({ userId }) {
    detachRemotePeer(userId);
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
      socketRef.current?.emit(options.voiceEvents.signal, {
        roomNo: roomNoRef.current,
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
      } catch (_error) {
        return;
      }
    }
  }

  return {
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
    setVoiceError,
    setVoiceMutedState,
    toggleVoiceMute
  };
}
