"use client";

import styles from "../../styles/FightingRoom.module.css";

const MAX_HEALTH = 100;
const ENERGY_FINISHER_THRESHOLD = 100;

export default function HUD({
  characters = [],
  roundWins = [0, 0],
  currentRound = 1,
  roundCount = 3,
  fightPhase = "waiting",
  countdown = 0,
  myIndex = 0,
}) {
  const p1 = characters[0] || null;
  const p2 = characters[1] || null;

  const p1HealthPct = p1 ? Math.max(0, Math.min(100, (p1.health / MAX_HEALTH) * 100)) : 100;
  const p2HealthPct = p2 ? Math.max(0, Math.min(100, (p2.health / MAX_HEALTH) * 100)) : 100;

  const p1EnergyPct = p1 ? Math.max(0, Math.min(100, (p1.energy / ENERGY_FINISHER_THRESHOLD) * 100)) : 0;
  const p2EnergyPct = p2 ? Math.max(0, Math.min(100, (p2.energy / ENERGY_FINISHER_THRESHOLD) * 100)) : 0;

  const p1FinisherReady = p1 && p1.energy >= ENERGY_FINISHER_THRESHOLD;
  const p2FinisherReady = p2 && p2.energy >= ENERGY_FINISHER_THRESHOLD;

  // Render segment lines every 25hp
  const segmentLines = [];
  for (let i = 1; i < 4; i++) {
    segmentLines.push(
      <div
        key={i}
        className={styles.healthSegment}
        style={{ left: `${(i * 25 / MAX_HEALTH) * 100}%` }}
      />
    );
  }

  return (
    <div className={styles.hud}>
      {/* Player 1 (left) */}
      <div className={styles.hudLeft}>
        <div className={styles.badge}>P1</div>
        <div className={styles.healthBar}>
          <div
            className={`${styles.healthFill} ${styles.p1}`}
            style={{ width: `${p1HealthPct}%` }}
          />
          {segmentLines}
        </div>
        <div className={`${styles.energyBar} ${p1FinisherReady ? styles.energyReady : ""}`}>
          <div
            className={styles.energyFill}
            style={{ width: `${p1EnergyPct}%` }}
          />
        </div>
      </div>

      {/* Center */}
      <div className={styles.hudCenter}>
        {fightPhase === "countdown" && countdown > 0 && (
          <div className={styles.countdown}>{countdown}</div>
        )}
        {fightPhase === "countdown" && countdown === 0 && (
          <div className={styles.countdown}>FIGHT!</div>
        )}
        {fightPhase === "fighting" && (
          <>
            <div className={styles.roundBadge}>Round {currentRound}/{roundCount}</div>
            <div className={styles.roundWins}>{roundWins[0]} - {roundWins[1]}</div>
          </>
        )}
        {fightPhase === "round_end" && (
          <div className={styles.roundEndText}>Round {currentRound} Over</div>
        )}
        {fightPhase === "next_round" && (
          <div className={styles.roundEndText}>Next Round...</div>
        )}
      </div>

      {/* Player 2 (right) */}
      <div className={styles.hudRight}>
        <div className={styles.badge}>P2</div>
        <div className={styles.healthBar}>
          <div
            className={`${styles.healthFill} ${styles.p2}`}
            style={{ width: `${p2HealthPct}%` }}
          />
          {segmentLines}
        </div>
        <div className={`${styles.energyBar} ${p2FinisherReady ? styles.energyReady : ""}`}>
          <div
            className={styles.energyFill}
            style={{ width: `${p2EnergyPct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
