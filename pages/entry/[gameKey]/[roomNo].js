import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import SiteLayout from "../../../components/SiteLayout";
import GameIcon from "../../../components/game-hub/GameIcon";
import { API_ROUTES, apiFetch } from "../../../lib/client/api";
import { canRecoverRoomSession } from "../../../lib/client/room-entry";
import styles from "../../../styles/UtilityPages.module.css";

export default function RoomEntryPage() {
  const router = useRouter();
  const { gameKey, roomNo } = router.query;
  const [session, setSession] = useState(null);
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!gameKey || !roomNo) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      const [entryResponse, meResponse] = await Promise.all([
        apiFetch(API_ROUTES.roomEntry.resolve(roomNo, gameKey)),
        apiFetch(API_ROUTES.me())
      ]);
      const [entryData, meData] = await Promise.all([entryResponse.json(), meResponse.json()]);

      if (cancelled) {
        return;
      }

      if (!entryResponse.ok) {
        setError(entryData.error || "找不到這個房間");
        setLoading(false);
        return;
      }

      setEntry(entryData);
      const nextSession = meData.session || meData.user || null;
      setSession(nextSession);
      setLoading(false);

      if (nextSession?.kind === "user") {
        await autoEnter(entryData.joinRoute, entryData.detailRoute);
        return;
      }

      if (nextSession?.kind === "guest" && canRecoverRoomSession(nextSession, entryData)) {
        router.replace(entryData.detailRoute);
      }
    }

    load().catch(() => {
      if (!cancelled) {
        setLoading(false);
        setError("入口解析失敗");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [gameKey, roomNo]);

  async function autoEnter(joinRoute, detailRoute) {
    setBusy(true);
    const response = await apiFetch(joinRoute, { method: "POST" });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data.error || "進房失敗");
      return;
    }

    router.replace(detailRoute);
  }

  async function enterAsGuest() {
    if (!entry) {
      return;
    }

    setBusy(true);
    setError("");
    const response = await apiFetch(API_ROUTES.roomEntry.guest(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomNo: entry.roomNo,
        gameKey: entry.gameKey
      })
    });
    const data = await response.json();
    setBusy(false);

    if (!response.ok) {
      setError(data.error || "遊客入場失敗");
      return;
    }

    router.replace(data.detailRoute || entry.detailRoute);
  }

  function enterWithLogin() {
    router.push(`/login?returnTo=${encodeURIComponent(`/entry/${gameKey}/${roomNo}`)}`);
  }

  return (
    <SiteLayout>
      <div className={styles.shell}>
        <section className={`${styles.hero} ${styles.loginHero}`.trim()}>
          <div className={`${styles.heroCopy} ${styles.loginHeroCopy}`.trim()}>
            <span className={styles.heroBadge}>ROOM ENTRY</span>
            <h1>房號 {roomNo || "......"}，先確認你要用哪個身份進場。</h1>
            <p>
              已登入玩家會直接進房；可遊客進入的私密邀請，會在這裡先做一次身份攔截。
            </p>
          </div>

          <aside className={`${styles.heroSide} ${styles.loginHeroSide}`.trim()}>
            <span className={styles.loginSideEyebrow}>ENTRY STATUS</span>
            <strong className={styles.loginSideTitle}>
              {loading ? "正在解析邀請" : entry?.title || "遊戲入口"}
            </strong>
            {entry ? (
              <div className={styles.loginUnlockList}>
                <article className={styles.loginUnlockItem}>
                  <strong>房號</strong>
                  <span>{entry.roomNo}</span>
                </article>
                <article className={styles.loginUnlockItem}>
                  <strong>房間類型</strong>
                  <span>{entry.visibility === "private" ? "私密房" : "公開房"}</span>
                </article>
                <article className={styles.loginUnlockItem}>
                  <strong>進場方式</strong>
                  <span>{entry.guestAllowed ? "可選遊客或登入" : "僅限登入玩家"}</span>
                </article>
              </div>
            ) : null}
          </aside>
        </section>

        <section className={`${styles.authGrid} ${styles.loginAuthGrid}`.trim()}>
          <article className={`${styles.authCard} ${styles.loginAuthCard}`.trim()}>
            <div className={styles.authMeta}>
              <span>房間入口</span>
              <span>{entry?.visibility === "private" ? "私密邀請" : "公開房間"}</span>
            </div>
            <div className={styles.entrySummary}>
              <div className={styles.entryIconWrap}>
                <GameIcon gameKey={entry?.gameKey || gameKey} className={styles.entryIcon} />
              </div>
              <div className={styles.entrySummaryCopy}>
                <h2>{entry?.title || "正在定位房間"}</h2>
                <p>
                  {error
                    ? error
                    : entry?.guestAllowed
                      ? "這是一個可遊客進入的私密房，你可以先遊玩，結束後再選擇登入同步紀錄。"
                      : "這個入口需要先登入帳號，系統會把你直接帶回這個房間。"}
                </p>
              </div>
            </div>

            <div className={styles.entryActionStack}>
              {entry?.guestAllowed ? (
                <button
                  type="button"
                  className="primary-button"
                  disabled={busy || loading}
                  onClick={enterAsGuest}
                >
                  {busy ? "入場中..." : "以遊客進入"}
                </button>
              ) : (
                <button type="button" className="secondary-button" disabled>
                  此房僅限登入玩家
                </button>
              )}

              <button type="button" className="primary-button" disabled={busy || loading} onClick={enterWithLogin}>
                登入後進入
              </button>
            </div>

            {session?.kind === "user" ? (
              <p className={styles.entryNotice}>已檢測到可恢復的登入身份，系統會自動帶你回到房內。</p>
            ) : null}
            {session?.kind === "guest" ? (
              <p className={styles.entryNotice}>你已經持有這個房間的遊客身份，正在恢復這個席位。</p>
            ) : null}
            {error ? <p className="error-text">{error}</p> : null}
          </article>

          <aside className={`${styles.noteCard} ${styles.loginNoteCard}`.trim()}>
            <strong>這個入口會怎麼處理</strong>
            <div className={styles.noteList}>
              <span>已登入玩家會直接進入對應遊戲與房間。</span>
              <span>遊客只限私密邀請與非排行榜流程，不能拿來開房或進後台。</span>
              <span>遊戲結束後可選擇登入並同步本局紀錄。</span>
            </div>
            <div className={styles.ctaRow}>
              <Link href="/" className="secondary-link">
                先回遊戲家族
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </SiteLayout>
  );
}
