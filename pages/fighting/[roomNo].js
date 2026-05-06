import { io } from "socket.io-client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import SiteLayout from "../../components/SiteLayout";
import HUD from "../../components/fighting/HUD";
import TouchControls from "../../components/fighting/TouchControls";
import { API_ROUTES, SOCKET_EVENTS, apiFetch, getSocketUrl } from "../../lib/client/api";
import styles from "../../styles/FightingRoom.module.css";

const FightingScene = dynamic(() => import("../../components/fighting/FightingScene"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading fight...</div>,
});

const FIGHTING_EVENTS = SOCKET_EVENTS.fighting;
const INPUT_SEND_INTERVAL = 16.67; // 60Hz

let socket;

export default function FightingRoomPage() {
  const router = useRouter();
  const { roomNo } = router.query;
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [mySeatIndex, setMySeatIndex] = useState(null);
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);
  const [socketConnected, setSocketConnected] = useState(null);
  const messageTimerRef = useRef(null);
  const keyStateRef = useRef({
    left: false, right: false, up: false,
    attack: false, heavy: false, block: false, dodge: false,
  });
  const lastInputSendRef = useRef(0);
  const lastSentInputRef = useRef(null);
  const roomRef = useRef(null);

  // Client-side prediction
  const predictedPosRef = useRef(null);
  const lastServerStateRef = useRef(null);

  // Show message toast
  const showMessage = useCallback((text, duration = 2600) => {
    clearTimeout(messageTimerRef.current);
    setMessage(text);
    messageTimerRef.current = setTimeout(() => setMessage(""), duration);
  }, []);

  // Load room data
  useEffect(() => {
    if (!roomNo) return;
    loadRoom().catch(() => showMessage("Failed to load room"));
    return () => {
      clearTimeout(messageTimerRef.current);
    };
  }, [roomNo]);

  // Socket connection
  useEffect(() => {
    if (!roomNo || !me) return;

    if (!socket) {
      socket = io(getSocketUrl(), { withCredentials: true });
    }

    function onConnect() {
      setSocketConnected(true);
      socket.emit(FIGHTING_EVENTS.subscribe, { roomNo });
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    function onGameUpdate(data) {
      // The server sends { room: ... } for room updates or delta for game ticks
      if (data?.room) {
        roomRef.current = data.room;
        setRoom(data.room);
        setGameState(data.room.match || null);

        // Find my seat index
        if (me && data.room.viewer) {
          setMySeatIndex(data.room.viewer.seatIndex);
        }

        // Client-side prediction reconciliation
        if (mySeatIndex != null && data.room.match?.characters) {
          const myChar = data.room.match.characters[mySeatIndex];
          if (myChar?.pos && predictedPosRef.current) {
            const dx = myChar.pos.x - predictedPosRef.current.x;
            const dy = myChar.pos.y - predictedPosRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 30) {
              predictedPosRef.current = { ...myChar.pos };
            }
          }
        }
      } else if (data?.tick != null) {
        // Delta update from game loop
        lastServerStateRef.current = data;
        setGameState(data);

        if (mySeatIndex != null && data.characters) {
          const myChar = data.characters[mySeatIndex];
          if (myChar?.pos && predictedPosRef.current) {
            const dx = myChar.pos.x - predictedPosRef.current.x;
            const dy = myChar.pos.y - predictedPosRef.current.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 30) {
              predictedPosRef.current = { ...myChar.pos };
            }
          }
        }
      }
    }

    function onFightingError({ error }) {
      showMessage(error || "Fighting error");
    }

    if (socket.connected) {
      setSocketConnected(true);
    } else {
      setSocketConnected(null);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(FIGHTING_EVENTS.update, onGameUpdate);
    socket.on(FIGHTING_EVENTS.error, onFightingError);

    socket.emit(FIGHTING_EVENTS.subscribe, { roomNo });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(FIGHTING_EVENTS.update, onGameUpdate);
      socket.off(FIGHTING_EVENTS.error, onFightingError);
    };
  }, [roomNo, me, mySeatIndex]);

  // Keyboard input at 60Hz
  useEffect(() => {
    if (!roomNo || !socket) return;

    function onKeyDown(e) {
      let changed = false;
      switch (e.key) {
        case "w": case "W": case "ArrowUp":
          if (!keyStateRef.current.up) { keyStateRef.current.up = true; changed = true; }
          break;
        case "a": case "A": case "ArrowLeft":
          if (!keyStateRef.current.left) { keyStateRef.current.left = true; changed = true; }
          break;
        case "d": case "D": case "ArrowRight":
          if (!keyStateRef.current.right) { keyStateRef.current.right = true; changed = true; }
          break;
        case "j": case "J":
          if (!keyStateRef.current.attack) { keyStateRef.current.attack = true; changed = true; }
          break;
        case "k": case "K":
          if (!keyStateRef.current.heavy) { keyStateRef.current.heavy = true; changed = true; }
          break;
        case "l": case "L":
          if (!keyStateRef.current.block) { keyStateRef.current.block = true; changed = true; }
          break;
        case "Shift":
          if (!keyStateRef.current.dodge) { keyStateRef.current.dodge = true; changed = true; }
          break;
      }
      if (changed) sendInput();
    }

    function onKeyUp(e) {
      let changed = false;
      switch (e.key) {
        case "w": case "W": case "ArrowUp":
          if (keyStateRef.current.up) { keyStateRef.current.up = false; changed = true; }
          break;
        case "a": case "A": case "ArrowLeft":
          if (keyStateRef.current.left) { keyStateRef.current.left = false; changed = true; }
          break;
        case "d": case "D": case "ArrowRight":
          if (keyStateRef.current.right) { keyStateRef.current.right = false; changed = true; }
          break;
        case "j": case "J":
          if (keyStateRef.current.attack) { keyStateRef.current.attack = false; changed = true; }
          break;
        case "k": case "K":
          if (keyStateRef.current.heavy) { keyStateRef.current.heavy = false; changed = true; }
          break;
        case "l": case "L":
          if (keyStateRef.current.block) { keyStateRef.current.block = false; changed = true; }
          break;
        case "Shift":
          if (keyStateRef.current.dodge) { keyStateRef.current.dodge = false; changed = true; }
          break;
      }
      if (changed) sendInput();
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [roomNo, socket]);

  function sendInput() {
    const now = Date.now();
    if (now - lastInputSendRef.current < INPUT_SEND_INTERVAL) return;

    const ks = keyStateRef.current;
    const input = {
      left: ks.left,
      right: ks.right,
      up: ks.up,
      attack: ks.attack,
      heavy: ks.heavy,
      block: ks.block,
      dodge: ks.dodge,
    };

    // Only send if input changed
    const inputStr = JSON.stringify(input);
    if (lastSentInputRef.current === inputStr) return;

    lastInputSendRef.current = now;
    lastSentInputRef.current = inputStr;
    socket?.emit(FIGHTING_EVENTS.input, { roomNo, input });

    // Client-side prediction: apply movement locally
    applyLocalPrediction(input);
  }

  // Touch input handler
  const handleTouchInput = useCallback((input) => {
    const now = Date.now();
    if (now - lastInputSendRef.current < INPUT_SEND_INTERVAL) return;

    const inputStr = JSON.stringify(input);
    if (lastSentInputRef.current === inputStr) return;

    lastInputSendRef.current = now;
    lastSentInputRef.current = inputStr;
    socket?.emit(FIGHTING_EVENTS.input, { roomNo, input });

    applyLocalPrediction(input);
  }, [roomNo]);

  // Apply simplified local prediction for movement
  function applyLocalPrediction(input) {
    if (mySeatIndex == null) return;

    const currentPos = predictedPosRef.current ||
      (gameState?.characters?.[mySeatIndex]?.pos
        ? { ...gameState.characters[mySeatIndex].pos }
        : null);

    if (!currentPos) return;

    const MOVE_SPEED = 3.3; // ~200px/s at 60Hz
    const JUMP_FORCE = -7.5; // ~-450px/s at 60Hz

    let newPos = { ...currentPos };
    if (input.left) newPos.x -= MOVE_SPEED;
    if (input.right) newPos.x += MOVE_SPEED;
    if (input.up) newPos.y += JUMP_FORCE;

    predictedPosRef.current = newPos;
  }

  async function loadRoom() {
    if (!roomNo) return;

    const [meResponse, roomResponse] = await Promise.all([
      apiFetch(API_ROUTES.me()),
      apiFetch(API_ROUTES.fightingRooms.detail(roomNo)),
    ]);

    const [meData, roomData] = await Promise.all([meResponse.json(), roomResponse.json()]);
    const nextSession = meData.session || meData.user || null;
    if (!nextSession) {
      router.push(`/login?returnTo=${encodeURIComponent(`/fighting/${roomNo}`)}`);
      return;
    }

    if (!roomResponse.ok) {
      showMessage(roomData.error || "Room not found");
      return;
    }

    setMe(nextSession);
    roomRef.current = roomData.room;
    setRoom(roomData.room);

    // Find my seat index
    const myPlayer = roomData.room?.players?.find((p) => p.userId === nextSession.id);
    if (myPlayer) {
      setMySeatIndex(myPlayer.seatIndex);
    }
  }

  async function joinRoom() {
    setJoining(true);
    const response = await apiFetch(API_ROUTES.fightingRooms.join(roomNo), { method: "POST" });
    const data = await response.json();
    setJoining(false);

    if (!response.ok) {
      showMessage(data.error || "Failed to join room");
      return;
    }

    roomRef.current = data.room;
    setRoom(data.room);
    socket?.emit(FIGHTING_EVENTS.subscribe, { roomNo });
  }

  function emitReady() {
    socket?.emit(FIGHTING_EVENTS.ready, { roomNo, ready: true });
  }

  if (!room) {
    return (
      <SiteLayout>
        <div className={styles.loading}>Loading room...</div>
      </SiteLayout>
    );
  }

  const phase = gameState?.phase || room?.fightPhase || room?.state || "waiting";
  const characters = gameState?.characters || [];
  const roundWins = gameState?.roundWins || [0, 0];
  const currentRound = gameState?.currentRound || room?.currentRound || 1;
  const roundCount = gameState?.roundCount || room?.config?.roundCount || 3;
  const countdown = gameState?.countdown ?? 0;
  const arena = room?.arena || { width: 800, height: 600, platforms: [] };

  // Find viewer seat
  const viewerSeat = room?.viewer;
  const effectiveMyIndex = mySeatIndex ?? viewerSeat?.seatIndex ?? 0;

  return (
    <SiteLayout>
      <div className={styles.gameShell}>
        <FightingScene
          gameState={gameState}
          arena={arena}
          myIndex={effectiveMyIndex}
        />

        {(phase === "fighting" || phase === "countdown" || phase === "round_end" || phase === "next_round") && (
          <HUD
            characters={characters}
            roundWins={roundWins}
            currentRound={currentRound}
            roundCount={roundCount}
            fightPhase={phase}
            countdown={countdown}
            myIndex={effectiveMyIndex}
          />
        )}

        {phase === "fighting" && <TouchControls onInput={handleTouchInput} />}

        {/* Ready overlay */}
        {phase === "waiting" && (
          <div className={styles.readyOverlay}>
            <div className={styles.readyCard}>
              <h2>Fighting</h2>
              <p>
                Room {roomNo} &middot; {room.players?.length ?? 0}/2 players
              </p>
              {!viewerSeat && (
                <button
                  type="button"
                  className={styles.readyBtn}
                  onClick={joinRoom}
                  disabled={joining}
                >
                  {joining ? "Joining..." : "Join Room"}
                </button>
              )}
              {viewerSeat && (
                <button
                  type="button"
                  className={styles.readyBtn}
                  onClick={emitReady}
                >
                  Ready
                </button>
              )}
            </div>
          </div>
        )}

        {/* Result overlay */}
        {phase === "match_end" && (
          <div className={styles.resultOverlay}>
            <div className={styles.resultCard}>
              <h2>{room.lastResult?.headline || "Match Over"}</h2>
              <p>{room.lastResult?.detail || ""}</p>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => router.push("/")}
              >
                Back to Hub
              </button>
            </div>
          </div>
        )}

        {message && <div className={styles.toast}>{message}</div>}
      </div>
    </SiteLayout>
  );
}
