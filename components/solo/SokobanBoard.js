import { buildSokobanGrid } from "../../lib/solo/sokoban";
import styles from "../../styles/Sokoban.module.css";

export default function SokobanBoard({ session }) {
  const grid = buildSokobanGrid(session);

  return (
    <div className={styles.boardWrap}>
      <div
        className={styles.board}
        style={{ gridTemplateColumns: `repeat(${session.width}, minmax(0, 1fr))` }}
        role="img"
        aria-label={`推箱子第 ${session.levelIndex + 1} 關棋盤`}
      >
        {grid.flat().map((cell) => (
          <div
            key={cell.id}
            data-sokoban-cell={cell.id}
            data-sokoban-player={cell.hasPlayer ? "true" : "false"}
            data-sokoban-crate={cell.hasCrate ? "true" : "false"}
            data-sokoban-goal={cell.isGoal ? "true" : "false"}
            className={`${styles.cell} ${
              cell.isWall ? styles.cellWall : styles.cellFloor
            } ${cell.isGoal ? styles.cellGoal : ""}`.trim()}
          >
            {cell.hasCrate ? <span className={styles.crate} /> : null}
            {cell.hasPlayer ? <span className={styles.player} /> : null}
            {cell.isGoal ? <span className={styles.goal} /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
