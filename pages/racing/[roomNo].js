import { io } from "socket.io-client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import SiteLayout from "../../components/SiteLayout";
import { API_ROUTES, SOCKET_EVENTS, apiFetch, getSocketUrl } from "../../lib/client/api";
import styles from "../../styles/RacingRoom.module.css";

const { TRACK_DEFINITION } = require("../../lib/racing/track");

const RacingScene = dynamic(() => import("../../components/racing/RacingScene"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading 3D scene...</div>
});

const RACING_EVENTS = SOCKET_EVENTS.racing;
const INPUT_SEND_INTERVAL = 50; // 20Hz

let socket;

export default function RacingRoomPage() {
  const router = useRouter();
  const { roomNo } = router.query;
  const [me, setMe] = useState(null);
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [mySeatIndex, setMySeatIndex] = useState(null);
  const [message, setMessage] = useState("");
  const [joining, setJoining] = useState(false);
  const [socketConnected, setSocketConnected] = useState(null);
  const canvasRef = useRef(null);
  const messageTimerRef = useRef(null);
  const keyStateRef = useRef({ up: false, down: false, left: false, right: false });
  const lastInputSendRef = useRef(0);
  const lastSentInputRef = useRef(null);
  const roomRef = useRef(null);

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
      socket.emit(RACING_EVENTS.subscribe, { roomNo });
    }

    function onDisconnect() {
      setSocketConnected(false);
    }

    function onGameUpdate(state) {
      setGameState(state);

      // Find my seat index from the cars array
      if (me && state.cars) {
        const myCar = state.cars.find((c) => c.playerId === me.id || c.userId === me.id);
        if (myCar) {
          setMySeatIndex(myCar.seatIndex);
        }
      }
    }

    function onRacingError({ error }) {
      showMessage(error || "Racing error");
    }

    if (socket.connected) {
      setSocketConnected(true);
    } else {
      setSocketConnected(null);
    }

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on(RACING_EVENTS.update, onGameUpdate);
    socket.on(RACING_EVENTS.error, onRacingError);

    socket.emit(RACING_EVENTS.subscribe, { roomNo });

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off(RACING_EVENTS.update, onGameUpdate);
      socket.off(RACING_EVENTS.error, onRacingError);
    };
  }, [roomNo, me]);

  // Keyboard input
  useEffect(() => {
    if (!roomNo || !socket) return;

    function onKeyDown(e) {
      let changed = false;
      switch (e.key) {
        case "ArrowUp":
          if (!keyStateRef.current.up) { keyStateRef.current.up = true; changed = true; }
          break;
        case "ArrowDown":
          if (!keyStateRef.current.down) { keyStateRef.current.down = true; changed = true; }
          break;
        case "ArrowLeft":
          if (!keyStateRef.current.left) { keyStateRef.current.left = true; changed = true; }
          break;
        case "ArrowRight":
          if (!keyStateRef.current.right) { keyStateRef.current.right = true; changed = true; }
          break;
      }
      if (changed) sendInput();
    }

    function onKeyUp(e) {
      let changed = false;
      switch (e.key) {
        case "ArrowUp":
          if (keyStateRef.current.up) { keyStateRef.current.up = false; changed = true; }
          break;
        case "ArrowDown":
          if (keyStateRef.current.down) { keyStateRef.current.down = false; changed = true; }
          break;
        case "ArrowLeft":
          if (keyStateRef.current.left) { keyStateRef.current.left = false; changed = true; }
          break;
        case "ArrowRight":
          if (keyStateRef.current.right) { keyStateRef.current.right = false; changed = true; }
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
      accel: ks.up ? 1 : 0,
      brake: ks.down ? 1 : 0,
      steer: (ks.left ? 1 : 0) - (ks.right ? 1 : 0)
    };

    // Only send if input changed
    const inputStr = JSON.stringify(input);
    if (lastSentInputRef.current === inputStr) return;

    lastInputSendRef.current = now;
    lastSentInputRef.current = inputStr;
    socket?.emit(RACING_EVENTS.input, { roomNo, input });
  }

  // Touch input handler
  const handleTouchInput = useCallback((input) => {
    const now = Date.now();
    if (now - lastInputSendRef.current < INPUT_SEND_INTERVAL) return;

    const inputStr = JSON.stringify(input);
    if (lastSentInputRef.current === inputStr) return;

    lastInputSendRef.current = now;
    lastSentInputRef.current = inputStr;
    socket?.emit(RACING_EVENTS.input, { roomNo, input });
  }, [roomNo]);

  async function loadRoom() {
    if (!roomNo) return;

    const [meResponse, roomResponse] = await Promise.all([
      apiFetch(API_ROUTES.me()),
      apiFetch(API_ROUTES.racingRooms.detail(roomNo))
    ]);

    const [meData, roomData] = await Promise.all([meResponse.json(), roomResponse.json()]);
    const nextSession = meData.session || meData.user || null;
    if (!nextSession) {
      router.push(`/login?returnTo=${encodeURIComponent(`/racing/${roomNo}`)}`);
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
    const response = await apiFetch(API_ROUTES.racingRooms.join(roomNo), { method: "POST" });
    const data = await response.json();
    setJoining(false);

    if (!response.ok) {
      showMessage(data.error || "Failed to join room");
      return;
    }

    roomRef.current = data.room;
    setRoom(data.room);
    socket?.emit(RACING_EVENTS.subscribe, { roomNo });
  }

  function emitReady() {
    socket?.emit(RACING_EVENTS.ready, { roomNo, ready: true });
  }

  if (!room) {
    return (
      <SiteLayout>
        <div className={styles.loading}>Loading room...</div>
      </SiteLayout>
    );
  }

  const phase = gameState?.phase || room?.state || "waiting";
  const myCar = gameState?.cars?.[mySeatIndex];
  const totalLaps = room?.config?.laps || 3;
  const totalPlayers = gameState?.cars?.length || room?.players?.length || 0;

  // Find my race position from raceOrder
  let myPosition = 0;
  if (gameState?.raceOrder && mySeatIndex != null) {
    const orderEntry = gameState.raceOrder.find((r) => r.seatIndex === mySeatIndex);
    if (orderEntry) {
      myPosition = gameState.raceOrder.indexOf(orderEntry) + 1;
    }
  }

  return (
    <SiteLayout>
      <div className={styles.gameShell}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <RacingScene
          gameState={gameState}
          mySeatIndex={mySeatIndex}
          canvasRef={canvasRef}
        />

        {/* HUD */}
        <div className={styles.hud}>
          <div className={styles.hudLeft}>
            <div className={styles.badge}>
              Lap {myCar?.lap ?? 0}/{totalLaps}
            </div>
            <div className={styles.badge}>
              {Math.round(myCar?.speed ?? 0)} u/s
            </div>
          </div>

          <div className={styles.hudCenter}>
            {phase === "countdown" && gameState?.countdown > 0 && (
              <div className={styles.countdown}>{gameState.countdown}</div>
            )}
            {phase === "countdown" && gameState?.countdown === 0 && (
              <div className={styles.countdown}>GO!</div>
            )}
            {phase === "racing" && myPosition > 0 && (
              <div className={styles.positionBadge}>
                P{myPosition}/{totalPlayers}
              </div>
            )}
          </div>

          <div className={styles.hudRight}>
            <div className={styles.badge}>
              Room {roomNo}
            </div>
          </div>
        </div>

        {/* Touch controls */}
        <TouchControls onInput={handleTouchInput} />

        {/* Ready overlay */}
        {phase === "waiting" && (
          <div className={styles.readyOverlay}>
            <div className={styles.readyCard}>
              <h2>Racing</h2>
              <p>Room {roomNo} &middot; {room.players?.length ?? 0}/{room.config?.maxPlayers ?? 4} players</p>
              <button type="button" className={styles.readyBtn} onClick={emitReady}>
                Ready
              </button>
            </div>
          </div>
        )}

        {/* Result overlay */}
        {phase === "finished" && (
          <div className={styles.resultOverlay}>
            <div className={styles.resultCard}>
              <h2>Race Complete!</h2>
              <p>
                {gameState?.raceOrder?.[0] != null
                  ? `Winner: Player ${gameState.raceOrder[0].seatIndex + 1}`
                  : "Race finished"}
              </p>
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

function TouchControls({ onInput }) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const joystickRef = useRef(null);
  const knobRef = useRef(null);
  const touchIdRef = useRef(null);
  const startRef = useRef({ x: 0, y: 0 });
  const inputRef = useRef({ accel: 0, brake: 0, steer: 0 });

  useEffect(() => {
    setIsTouchDevice(
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
    );
  }, []);

  useEffect(() => {
    if (!isTouchDevice) return;

    function handleTouchStart(e) {
      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      startRef.current = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchMove(e) {
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchIdRef.current) {
          const dx = touch.clientX - startRef.current.x;
          const steer = Math.max(-1, Math.min(1, dx / 50));
          inputRef.current = { ...inputRef.current, steer };
          onInput(inputRef.current);

          if (knobRef.current) {
            knobRef.current.style.transform = `translate(calc(-50% + ${dx * 0.5}px), -50%)`;
          }
        }
      }
    }

    function handleTouchEnd(e) {
      for (const touch of e.changedTouches) {
        if (touch.identifier === touchIdRef.current) {
          touchIdRef.current = null;
          inputRef.current = { ...inputRef.current, steer: 0 };
          onInput(inputRef.current);

          if (knobRef.current) {
            knobRef.current.style.transform = "translate(-50%, -50%)";
          }
        }
      }
    }

    const el = joystickRef.current;
    if (el) {
      el.addEventListener("touchstart", handleTouchStart, { passive: true });
      el.addEventListener("touchmove", handleTouchMove, { passive: true });
      el.addEventListener("touchend", handleTouchEnd, { passive: true });
      el.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    }

    return () => {
      if (el) {
        el.removeEventListener("touchstart", handleTouchStart);
        el.removeEventListener("touchmove", handleTouchMove);
        el.removeEventListener("touchend", handleTouchEnd);
        el.removeEventListener("touchcancel", handleTouchEnd);
      }
    };
  }, [isTouchDevice, onInput]);

  function handleAccelStart() {
    inputRef.current = { ...inputRef.current, accel: 1 };
    onInput(inputRef.current);
  }

  function handleAccelEnd() {
    inputRef.current = { ...inputRef.current, accel: 0 };
    onInput(inputRef.current);
  }

  function handleBrakeStart() {
    inputRef.current = { ...inputRef.current, brake: 1 };
    onInput(inputRef.current);
  }

  function handleBrakeEnd() {
    inputRef.current = { ...inputRef.current, brake: 0 };
    onInput(inputRef.current);
  }

  if (!isTouchDevice) return null;

  return (
    <div className={styles.touchControls}>
      <div className={styles.joystick} ref={joystickRef}>
        <div className={styles.joystickKnob} ref={knobRef} />
      </div>
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.brakeBtn}`}
          onTouchStart={handleBrakeStart}
          onTouchEnd={handleBrakeEnd}
          onTouchCancel={handleBrakeEnd}
        >
          B
        </button>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.accelBtn}`}
          onTouchStart={handleAccelStart}
          onTouchEnd={handleAccelEnd}
          onTouchCancel={handleAccelEnd}
        >
          A
        </button>
      </div>
    </div>
  );
}
