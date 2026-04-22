import styles from "../styles/MatchResultOverlay.module.css";

export default function MatchResultOverlay({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  badges = [],
  rows = [],
  notice = null,
  primaryAction,
  secondaryAction
}) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        className={styles.backdrop}
        aria-label="关闭结算面板"
        onClick={onClose}
      />
      <section className={styles.overlay} role="dialog" aria-modal="true" aria-label={title}>
        <div className={styles.head}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            关闭
          </button>
        </div>

        <div className={styles.hero}>
          <strong>{title}</strong>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>

        {notice ? (
          <div className={styles.noticePanel}>
            <div className={styles.noticeCopy}>
              <strong>{notice.title}</strong>
              {notice.body ? <p>{notice.body}</p> : null}
            </div>
            {notice.secondaryAction || notice.primaryAction ? (
              <div className={styles.noticeActions}>
                {notice.secondaryAction ? (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={notice.secondaryAction.onClick}
                  >
                    {notice.secondaryAction.label}
                  </button>
                ) : null}
                {notice.primaryAction ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={notice.primaryAction.onClick}
                  >
                    {notice.primaryAction.label}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {badges.length > 0 ? (
          <div className={styles.badgeRow}>
            {badges.filter(Boolean).map((badge) => (
              <span key={badge} className={styles.badge}>
                {badge}
              </span>
            ))}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className={styles.summaryList}>
            {rows.map((row) => (
              <div key={`${row.label}-${row.meta || ""}`} className={styles.summaryRow}>
                <div className={styles.summaryCopy}>
                  <strong>{row.label}</strong>
                  {row.meta ? <span>{row.meta}</span> : null}
                </div>
                {row.value ? (
                  <span
                    className={`${styles.summaryValue} ${
                      row.tone ? styles[`tone${capitalize(row.tone)}`] : ""
                    }`.trim()}
                  >
                    {row.value}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {(secondaryAction || primaryAction) ? (
          <div className={styles.actionRow}>
            {secondaryAction ? (
              <button type="button" className={styles.secondaryButton} onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </button>
            ) : null}
            {primaryAction ? (
              <button type="button" className={styles.primaryButton} onClick={primaryAction.onClick}>
                {primaryAction.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
    </>
  );
}

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
}
