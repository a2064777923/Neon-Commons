import { io } from "socket.io-client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import SiteLayout from "../../components/SiteLayout";
import HUD from "../../components/racing/HUD";
import TouchControls from "../../components/racing/TouchControls";
import { API_ROUTES, SOCKET_EVENTS, apiFetch, getSocketUrl } from "../../lib/client/api";
import styles from "../../styles/RacingRoom.module.css";

const RacingScene = dynamic(() => import("../../components/racing/RacingScene"), {
  ssr: false,
  loading: () => <div className={styles.loading}>Loading 3D scene...</div>
});

const RACING_EVENTS = SOCKET_EVENTS.racing;
const INPUT_SEND_INTERVAL = 50; // 20Hz
const PREDICTION_SNAP_THRESHOLD = 2; // units - snap to server if diverged more than this
const INTERPOLATION_TICK_MS = 50; // one server tick period

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

  // Client-side prediction state
  const predictedPosRef = useRef(null);
  const predictedRotRef = useRef(null);
  const lastServerStateRef = useRef(null);
  const prevStateRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

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
      // Store previous state for interpolation
      prevStateRef.current = lastServerStateRef.current;
      lastServerStateRef.current = state;
      lastUpdateTimeRef.current = Date.now();

      // Client-side prediction reconciliation for own car
      if (mySeatIndex != null && state.cars && predictedPosRef.current) {
        const myCar = state.cars[mySeatIndex];
        if (myCar?.pos) {
          const serverPos = myCar.pos;
          const predPos = predictedPosRef.current;
          const dx = serverPos.x - predPos.x;
          const dz = serverPos.z - predPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);

          if (dist > PREDICTION_SNAP_THRESHOLD) {
            // Snap to server position when diverged too far
            predictedPosRef.current = { x: serverPos.x, y: serverPos.y, z: serverPos.z };
            if (myCar.rot) {
              predictedRotRef.current = { ...myCar.rot };
            }
          }
          // Otherwise, keep predicted position (lerp happens in RacingScene)
        }
      }

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
  }, [roomNo, me, mySeatIndex]);

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

    // Client-side prediction: apply input locally
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
    socket?.emit(RACING_EVENTS.input, { roomNo, input });

    // Client-side prediction: apply input locally
    applyLocalPrediction(input);
  }, [roomNo]);

  // Apply simplified local prediction
  function applyLocalPrediction(input) {
    if (mySeatIndex == null) return;

    const currentPos = predictedPosRef.current ||
      (gameState?.cars?.[mySeatIndex]?.pos ? { ...gameState.cars[mySeatIndex].pos } : null);
    const currentRot = predictedRotRef.current ||
      (gameState?.cars?.[mySeatIndex]?.rot ? { ...gameState.cars[mySeatIndex].rot } : null);

    if (!currentPos) return;

    // Simplified prediction: move forward based on accel, rotate based on steer
    const speed = input.accel * 0.5 - input.brake * 0.3;
    const steerAngle = input.steer * 0.03;

    // Get forward direction from rotation
    let fx = 0, fz = 1;
    if (currentRot) {
      // Extract Y rotation from quaternion
      const siny = 2 * (currentRot.w * currentRot.y + currentRot.x * currentRot.z);
      const cosy = 1 - 2 * (currentRot.y * currentRot.y + currentRot.z * currentRot.z);
      const angle = Math.atan2(siny, cosy);
      fx = Math.sin(angle);
      fz = Math.cos(angle);
    }

    const newPos = {
      x: currentPos.x + fx * speed,
      y: currentPos.y,
      z: currentPos.z + fz * speed
    };

    predictedPosRef.current = newPos;

    // Update rotation for steering
    if (currentRot && steerAngle !== 0) {
      const siny = 2 * (currentRot.w * currentRot.y + currentRot.x * currentRot.z);
      const cosy = 1 - 2 * (currentRot.y * currentRot.y + currentRot.z * currentRot.z);
      const angle = Math.atan2(siny, cosy) + steerAngle;
      const halfAngle = angle / 2;
      predictedRotRef.current = {
        x: 0,
        y: Math.sin(halfAngle),
        z: 0,
        w: Math.cos(halfAngle)
      };
    }
  }

  // Build interpolated game state for rendering
  function getInterpolatedGameState() {
    if (!gameState) return null;

    const now = Date.now();
    const elapsed = now - lastUpdateTimeRef.current;
    const t = Math.min(1, elapsed / INTERPOLATION_TICK_MS);

    // If we have previous state, interpolate between prev and current
    if (prevStateRef.current?.cars && gameState.cars) {
      const interpolatedCars = gameState.cars.map((car, index) => {
        const prevCar = prevStateRef.current.cars[index];
        if (!prevCar || !car.pos || !prevCar.pos) return car;

        // Lerp position
        const pos = {
          x: prevCar.pos.x + (car.pos.x - prevCar.pos.x) * t,
          y: prevCar.pos.y + (car.pos.y - prevCar.pos.y) * t,
          z: prevCar.pos.z + (car.pos.z - prevCar.pos.z) * t
        };

        return { ...car, pos };
      });

      return { ...gameState, cars: interpolatedCars };
    }

    return gameState;
  }

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

  const interpolatedState = getInterpolatedGameState();
  const phase = interpolatedState?.phase || room?.state || "waiting";
  const myCar = interpolatedState?.cars?.[mySeatIndex];
  const totalLaps = room?.config?.laps || 3;
  const totalPlayers = interpolatedState?.cars?.length || room?.players?.length || 0;

  // Find my race position from raceOrder
  let myPosition = 0;
  if (interpolatedState?.raceOrder && mySeatIndex != null) {
    const orderEntry = interpolatedState.raceOrder.find((r) => r.seatIndex === mySeatIndex);
    if (orderEntry) {
      myPosition = interpolatedState.raceOrder.indexOf(orderEntry) + 1;
    }
  }

  return (
    <SiteLayout>
      <div className={styles.gameShell}>
        <canvas ref={canvasRef} className={styles.canvas} />

        <RacingScene
          gameState={interpolatedState}
          mySeatIndex={mySeatIndex}
          canvasRef={canvasRef}
        />

        <HUD
          lap={myCar?.lap ?? 0}
          totalLaps={totalLaps}
          speed={myCar?.speed ?? 0}
          position={myPosition}
          totalPlayers={totalPlayers}
          countdown={interpolatedState?.countdown}
          racePhase={phase}
          roomNo={roomNo}
        />

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
                {interpolatedState?.raceOrder?.[0] != null
                  ? `Winner: Player ${interpolatedState.raceOrder[0].seatIndex + 1}`
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
