"use client";

import styles from "../../styles/RacingRoom.module.css";

export default function HUD({
  lap = 0,
  totalLaps = 3,
  speed = 0,
  position = 0,
  totalPlayers = 0,
  countdown = null,
  racePhase = "waiting",
  roomNo = ""
}) {
  return (
    <div className={styles.hud}>
      <div className={styles.hudLeft}>
        <div className={styles.badge}>
          Lap {lap}/{totalLaps}
        </div>
        <div className={styles.badge}>
          {Math.round(speed)} u/s
        </div>
      </div>

      <div className={styles.hudCenter}>
        {racePhase === "countdown" && countdown != null && countdown > 0 && (
          <div className={styles.countdown}>{countdown}</div>
        )}
        {racePhase === "countdown" && countdown === 0 && (
          <div className={styles.countdown}>GO!</div>
        )}
        {racePhase === "racing" && position > 0 && (
          <div className={styles.positionBadge}>
            P{position}/{totalPlayers}
          </div>
        )}
        {racePhase === "finished" && (
          <div className={styles.positionBadge}>FINISH</div>
        )}
      </div>

      <div className={styles.hudRight}>
        <div className={styles.badge}>
          Room {roomNo}
        </div>
      </div>
    </div>
  );
}
