import Link from "next/link";
import { useEffect, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import GameIcon from "../../components/game-hub/GameIcon";
import SokobanBoard from "../../components/solo/SokobanBoard";
import {
  SOKOBAN_LEVELS,
  applySokobanMove,
  createSokobanSession,
  goToNextSokobanLevel,
  goToPreviousSokobanLevel,
  resetSokobanLevel
} from "../../lib/solo/sokoban";
import styles from "../../styles/Sokoban.module.css";

const { getGameMeta } = require("../../lib/games/catalog");

const KEY_TO_DIRECTION = Object.freeze({
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  a: "left",
  s: "down",
  d: "right",
  W: "up",
  A: "left",
  S: "down",
  D: "right"
});

export default function SokobanPage() {
  const meta = getGameMeta("sokoban");
  const [session, setSession] = useState(() => createSokobanSession());

  useEffect(() => {
    function onKeyDown(event) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }

      const direction = KEY_TO_DIRECTION[event.key];
      if (!direction) {
        return;
      }

      event.preventDefault();
      setSession((current) => applySokobanMove(current, direction));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <SiteLayout>
      <div className={styles.page}>
        <div className={styles.backdrop} />
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <div className={styles.heroHead}>
              <div className={styles.heroIcon}>
                <GameIcon gameKey="sokoban" />
              </div>
              <div>
                <span className={styles.liveChip}>立即遊玩</span>
                <h1>{meta.title}</h1>
                <p>{meta.description}</p>
              </div>
            </div>

            <div className={styles.heroMeta}>
              <span>直接開始，不需房號</span>
              <span>鍵盤方向鍵 / WASD</span>
              <span>{session.levelIndex + 1} / {SOKOBAN_LEVELS.length} 關</span>
            </div>

            <div className={styles.statStrip}>
              <div>
                <strong data-sokoban-level>{session.levelTitle}</strong>
                <span>目前關卡</span>
              </div>
              <div>
                <strong data-sokoban-moves>{session.moveCount}</strong>
                <span>步數</span>
              </div>
              <div>
                <strong data-sokoban-pushes>{session.pushCount}</strong>
                <span>推箱次數</span>
              </div>
            </div>
          </div>

          <div className={styles.heroActions}>
            <Link href="/" className={styles.ghostButton}>
              返回遊戲家族
            </Link>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={() => setSession((current) => resetSokobanLevel(current))}
            >
              重開本關
            </button>
          </div>
        </section>

        <section className={styles.layout}>
          <div className={styles.boardCard}>
            <SokobanBoard session={session} />
            <div className={styles.mobileControls}>
              <button type="button" onClick={() => setSession((current) => applySokobanMove(current, "up"))}>
                向上
              </button>
              <div className={styles.horizontalControls}>
                <button
                  type="button"
                  onClick={() => setSession((current) => applySokobanMove(current, "left"))}
                >
                  向左
                </button>
                <button
                  type="button"
                  onClick={() => setSession((current) => applySokobanMove(current, "down"))}
                >
                  向下
                </button>
                <button
                  type="button"
                  onClick={() => setSession((current) => applySokobanMove(current, "right"))}
                >
                  向右
                </button>
              </div>
            </div>
          </div>

          <aside className={styles.sideCard}>
            <div className={styles.sideSection}>
              <span className={styles.sectionEyebrow}>PROGRESSION</span>
              <strong>{session.levelTitle}</strong>
              <p>
                {session.solved
                  ? "本關完成，現在可以直接切到下一關。"
                  : "先把所有箱子推到標記點上；牆會擋路，兩個箱子不能連推。"}
              </p>
            </div>

            <div className={styles.progressActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={session.levelIndex === 0}
                onClick={() => setSession((current) => goToPreviousSokobanLevel(current))}
              >
                上一關
              </button>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={session.levelIndex === SOKOBAN_LEVELS.length - 1}
                onClick={() => setSession((current) => goToNextSokobanLevel(current))}
              >
                下一關
              </button>
            </div>

            <div
              className={`${styles.statusCard} ${session.solved ? styles.statusSolved : ""}`.trim()}
              data-sokoban-status={session.solved ? "solved" : "active"}
            >
              <strong>{session.solved ? "本關完成" : "繼續推進"}</strong>
              <span>
                {session.solved
                  ? "所有箱子都已停在目標點。"
                  : "留意牆角與箱子排列，卡死後請直接重開本關。"}
              </span>
            </div>
          </aside>
        </section>
      </div>
    </SiteLayout>
  );
}
