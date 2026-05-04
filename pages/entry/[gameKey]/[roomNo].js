import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import SiteLayout from "../../../components/SiteLayout";
import GameIcon from "../../../components/game-hub/GameIcon";
import { API_ROUTES, apiFetch } from "../../../lib/client/api";
import {
  canRecoverRoomSession,
  getDegradedSubsystem,
  getSafeActionLabels,
  isSubsystemBlocked,
  isSubsystemDegraded
} from "../../../lib/client/room-entry";
import styles from "../../../styles/UtilityPages.module.css";

const USER_AUTO_JOIN_RETRY_DELAYS_MS = [0, 450, 1100, 2200];
const ROOM_ENTRY_AUTO_REQUEST_TIMEOUT_MS = 4500;
const ROOM_ENTRY_MANUAL_REQUEST_TIMEOUT_MS = 8000;
const EMPTY_JSON_POST_OPTIONS = Object.freeze({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}"
});
const USER_AUTO_JOIN_FATAL_ERRORS = [
  /房间人数已满/,
  /此操作需要登入帳號/,
  /帳號不可用/,
  /你不在該房間內/
];

export default function RoomEntryPage() {
  const router = useRouter();
  const { gameKey, roomNo } = router.query;
  const [session, setSession] = useState(null);
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [userJoinRetryReady, setUserJoinRetryReady] = useState(false);
  const [autoJoinAttempt, setAutoJoinAttempt] = useState(0);
  const autoEnterAttemptKeyRef = useRef("");
  const autoEnterTimerRef = useRef(null);
  const isSnapshotOnly = entry?.availability === "snapshot-only";
  const entryStatus = getDegradedSubsystem(entry, "entry");
  const voiceStatus = getDegradedSubsystem(entry, "voice");
  const entryBlocked = isSubsystemBlocked(entry, "entry");
  const entryDegraded = isSubsystemDegraded(entry, "entry");
  const showUndercoverVoiceNotice =
    entry?.gameKey === "undercover" && isSubsystemDegraded(entry, "voice");
  const entrySafeActionLabels = getSafeActionLabels(entryStatus.safeActions);
  const voiceSafeActionLabels = getSafeActionLabels(voiceStatus.safeActions);
  const canAutoEnterLiveRoom = canEnterLiveRoom(entry) && !entryBlocked;

  useEffect(() => {
    return () => {
      if (autoEnterTimerRef.current) {
        clearTimeout(autoEnterTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!gameKey || !roomNo) {
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setUserJoinRetryReady(false);
      setAutoJoinAttempt(0);
      autoEnterAttemptKeyRef.current = "";
      clearScheduledAutoEnter(autoEnterTimerRef);

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
      const nextEntryBlocked = isSubsystemBlocked(entryData, "entry");
      setSession(nextSession);
      setLoading(false);

      if (
        !nextEntryBlocked &&
        canEnterLiveRoom(entryData) &&
        nextSession?.kind === "guest" &&
        canRecoverRoomSession(nextSession, entryData)
      ) {
        router.replace(entryData.detailRoute);
        return;
      }

      if (
        !nextEntryBlocked &&
        canEnterLiveRoom(entryData) &&
        nextSession?.kind === "user"
      ) {
        const attemptKey = `${entryData.roomNo}:${
          nextSession.id || nextSession.username || "user"
        }:${entryData.joinRoute}`;
        autoEnterAttemptKeyRef.current = attemptKey;
        setAutoJoinAttempt(1);
        autoEnter(entryData.joinRoute, entryData.detailRoute, {
          auto: true,
          attemptIndex: 0,
          attemptKey
        }).catch(() => null);
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

  useEffect(() => {
    if (!entry || loading || session?.kind !== "user" || entryBlocked || !canEnterLiveRoom(entry)) {
      return;
    }

    const attemptKey = `${entry.roomNo}:${session.id || session.username || "user"}:${entry.joinRoute}`;
    if (autoEnterAttemptKeyRef.current === attemptKey) {
      return;
    }

    autoEnterAttemptKeyRef.current = attemptKey;
    setAutoJoinAttempt(1);
    autoEnter(entry.joinRoute, entry.detailRoute, {
      auto: true,
      attemptIndex: 0,
      attemptKey
    }).catch(() => null);
  }, [entry, entryBlocked, loading, session]);

  async function autoEnter(joinRoute, detailRoute, options = {}) {
    const { auto = false, attemptIndex = 0, attemptKey = "" } = options;
    let keepBusy = false;

    setBusy(true);
    if (!auto) {
      clearScheduledAutoEnter(autoEnterTimerRef);
      setAutoJoinAttempt(0);
      setError("");
      setUserJoinRetryReady(false);
    }
    try {
      const response = await apiFetchWithTimeout(joinRoute, EMPTY_JSON_POST_OPTIONS, {
        timeoutMs: auto
          ? ROOM_ENTRY_AUTO_REQUEST_TIMEOUT_MS
          : ROOM_ENTRY_MANUAL_REQUEST_TIMEOUT_MS
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (
          auto &&
          shouldRetryUserAutoEnter({
            status: response.status,
            errorMessage: data.error,
            attemptIndex
          })
        ) {
          keepBusy = scheduleUserAutoEnterRetry({
            autoEnter,
            autoEnterTimerRef,
            joinRoute,
            detailRoute,
            attemptKey,
            nextAttemptIndex: attemptIndex + 1,
            setAutoJoinAttempt
          });
          if (keepBusy) {
            return;
          }
        }

        clearScheduledAutoEnter(autoEnterTimerRef);
        setAutoJoinAttempt(0);
        setError(data.error || "進房失敗");
        if (session?.kind === "user") {
          setUserJoinRetryReady(true);
        }
        return;
      }

      clearScheduledAutoEnter(autoEnterTimerRef);
      setAutoJoinAttempt(0);
      setUserJoinRetryReady(false);
      router.replace(detailRoute);
    } catch {
      if (
        auto &&
        shouldRetryUserAutoEnter({
          status: 0,
          errorMessage: "",
          attemptIndex
        })
      ) {
        keepBusy = scheduleUserAutoEnterRetry({
          autoEnter,
          autoEnterTimerRef,
          joinRoute,
          detailRoute,
          attemptKey,
          nextAttemptIndex: attemptIndex + 1,
          setAutoJoinAttempt
        });
        if (keepBusy) {
          return;
        }
      }

      clearScheduledAutoEnter(autoEnterTimerRef);
      setAutoJoinAttempt(0);
      setError("進房失敗");
      if (session?.kind === "user") {
        setUserJoinRetryReady(true);
      }
    } finally {
      if (!keepBusy) {
        setBusy(false);
      }
    }
  }

  async function enterAsGuest() {
    if (!entry || !canAutoEnterLiveRoom) {
      if (entryBlocked) {
        setError(entryStatus.message || "入口暫時停用，請稍後再試。");
      }
      return;
    }

  setBusy(true);
  setError("");
  const response = await apiFetchWithTimeout(API_ROUTES.roomEntry.guest(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      roomNo: entry.roomNo,
      gameKey: entry.gameKey
    })
  }, {
    timeoutMs: ROOM_ENTRY_MANUAL_REQUEST_TIMEOUT_MS
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
    if (!canAutoEnterLiveRoom) {
      if (entryBlocked) {
        setError(entryStatus.message || "入口暫時停用，請稍後再試。");
      }
      return;
    }

    if (session?.kind === "user" && entry) {
      autoEnter(entry.joinRoute, entry.detailRoute).catch(() => null);
      return;
    }

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
              <div
                className={styles.loginUnlockList}
                data-room-availability={entry.availability || "live"}
                data-entry-status={entryStatus.state}
              >
                <article className={styles.loginUnlockItem}>
                  <strong>房號</strong>
                  <span>{entry.roomNo}</span>
                </article>
                <article className={styles.loginUnlockItem}>
                  <strong>房間狀態</strong>
                  <span>{isSnapshotOnly ? "重啟恢復中" : "可直接進場"}</span>
                </article>
                <article className={styles.loginUnlockItem}>
                  <strong>房間類型</strong>
                  <span>{entry.visibility === "private" ? "私密房" : "公開房"}</span>
                </article>
                <article className={styles.loginUnlockItem}>
                  <strong>進場方式</strong>
                  <span>
                    {entryBlocked
                      ? "入口暫停，請先照指引等待或保留邀請"
                      : isSnapshotOnly
                      ? "恢復快照可見，但暫停進場"
                      : entry.guestAllowed
                        ? "可選遊客或登入"
                        : "僅限登入玩家"}
                  </span>
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
                    : isSnapshotOnly
                      ? "這個房間目前只恢復了單機重啟後的入口快照。你可以先保留邀請，但要等 live 房重新建立後才能真正進場。"
                      : entryBlocked
                        ? entryStatus.message || "入口暫時停用，請先保留邀請或稍後再試。"
                      : entryDegraded
                        ? entryStatus.message || "入口狀態不穩定，但房間仍可嘗試進場。"
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
                  data-entry-action="guest"
                  data-entry-status={entryStatus.state}
                  disabled={busy || loading || !canAutoEnterLiveRoom}
                  onClick={enterAsGuest}
                >
                  {getGuestEntryLabel({ busy, canAutoEnterLiveRoom, isSnapshotOnly })}
                </button>
              ) : (
                <button type="button" className="secondary-button" disabled>
                  此房僅限登入玩家
                </button>
              )}

              <button
                type="button"
                className="primary-button"
                data-entry-action={session?.kind === "user" && userJoinRetryReady ? "retry" : "login"}
                data-entry-status={entryStatus.state}
                disabled={busy || loading || !canAutoEnterLiveRoom}
                onClick={enterWithLogin}
              >
                {getLoginEntryLabel({
                  busy,
                  canAutoEnterLiveRoom,
                  isSnapshotOnly,
                  sessionKind: session?.kind,
                  userJoinRetryReady,
                  autoJoinAttempt
                })}
              </button>
            </div>

            {entryDegraded ? (
              <div
                className={styles.noteList}
                data-entry-status={entryStatus.state}
                data-availability-reason={entryStatus.reasonCode || `entry:${entryStatus.state}`}
              >
                <span>{entryStatus.message || "入口目前處於受控降級模式。"}</span>
                {entrySafeActionLabels.map((label, index) => (
                  <span
                    key={`${entryStatus.subsystem}:${entryStatus.safeActions[index] || label}`}
                    data-safe-action={entryStatus.safeActions[index] || ""}
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            {showUndercoverVoiceNotice ? (
              <div
                className={styles.noteList}
                data-voice-status={voiceStatus.state}
                data-availability-reason={voiceStatus.reasonCode || `voice:${voiceStatus.state}`}
              >
                <span>{voiceStatus.message}</span>
                {voiceSafeActionLabels.map((label, index) => (
                  <span
                    key={`${voiceStatus.subsystem}:${voiceStatus.safeActions[index] || label}`}
                    data-safe-action={voiceStatus.safeActions[index] || ""}
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            {isSnapshotOnly ? (
              <p className={styles.entryNotice} data-entry-notice="snapshot-only">
                房間恢復完成前，這個入口只會顯示狀態，不會自動進房或補發遊客身份。
              </p>
            ) : null}
            {!isSnapshotOnly && entryBlocked ? (
              <p className={styles.entryNotice} data-entry-notice="blocked-entry">
                入口已被運行控制暫停。等後台恢復後，再用同一個邀請重新進場即可。
              </p>
            ) : null}
            {!isSnapshotOnly && !entryBlocked && entryDegraded ? (
              <p className={styles.entryNotice} data-entry-notice="degraded-entry">
                入口仍可嘗試進場，但目前處於受控降級模式；如失敗請依照安全指引重試。
              </p>
            ) : null}
            {!isSnapshotOnly && !entryBlocked && showUndercoverVoiceNotice ? (
              <p className={styles.entryNotice} data-entry-notice="undercover-voice">
                進房後請按描述順序開咪，其餘玩家先接入旁聽，等待輪到自己再發言。
              </p>
            ) : null}
            {!isSnapshotOnly && !entryBlocked && session?.kind === "user" ? (
              <p className={styles.entryNotice} data-entry-notice="recovery">
                {userJoinRetryReady
                  ? "已檢測到登入身份，但這次自動進房沒有完成；可直接重試，不必重新登入。"
                  : autoJoinAttempt > 1
                    ? `已檢測到可恢復的登入身份，系統正在第 ${autoJoinAttempt}/${USER_AUTO_JOIN_RETRY_DELAYS_MS.length} 次嘗試進房。`
                    : "已檢測到可恢復的登入身份，系統會自動帶你回到房內。"}
              </p>
            ) : null}
            {!isSnapshotOnly && !entryBlocked && session?.kind === "guest" ? (
              <p className={styles.entryNotice} data-entry-notice="guest-recovery">
                你已經持有這個房間的遊客身份，正在恢復這個席位。
              </p>
            ) : null}
            {error ? <p className="error-text">{error}</p> : null}
          </article>

          <aside className={`${styles.noteCard} ${styles.loginNoteCard}`.trim()}>
            <strong>這個入口會怎麼處理</strong>
            <div className={styles.noteList}>
              <span>
                {isSnapshotOnly
                  ? "恢復中的房間會先停在這個入口頁，不會直接帶你進 live 房。"
                  : entryBlocked
                    ? "入口暫停時，已登入或已持有遊客身份的玩家都會先停在這一頁。"
                    : showUndercoverVoiceNotice
                      ? "誰是臥底維持輪流開咪；進房後請先接入旁聽，輪到你描述時再開咪。"
                    : "已登入玩家會直接進入對應遊戲與房間。"}
              </span>
              <span>遊客只限私密邀請與非排行榜流程，不能拿來開房或進後台。</span>
              <span>
                {isSnapshotOnly
                  ? "等房主或玩家把 live 房重新開起來後，再回到這個入口即可。"
                  : entryBlocked
                    ? "等後台恢復入口後，再用同一個邀請重新進場即可。"
                    : "遊戲結束後可選擇登入並同步本局紀錄。"}
              </span>
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

function canEnterLiveRoom(entry) {
  return !entry?.availability || entry.availability === "live";
}

function getGuestEntryLabel({ busy, canAutoEnterLiveRoom, isSnapshotOnly }) {
  if (busy) {
    return "入場中...";
  }

  if (!canAutoEnterLiveRoom) {
    return isSnapshotOnly ? "房間恢復中" : "房間暫停進場";
  }

  return "以遊客進入";
}

function getLoginEntryLabel({
  busy,
  canAutoEnterLiveRoom,
  isSnapshotOnly,
  sessionKind,
  userJoinRetryReady,
  autoJoinAttempt
}) {
  if (busy && sessionKind === "user") {
    return userJoinRetryReady || autoJoinAttempt > 1 ? "重試進房中..." : "進房中...";
  }

  if (!canAutoEnterLiveRoom) {
    return isSnapshotOnly ? "等待房間恢復" : "等待重新開放";
  }

  if (sessionKind === "user") {
    return userJoinRetryReady ? "重試加入" : "以當前帳號進房";
  }

  return "登入後進入";
}

function clearScheduledAutoEnter(timerRef) {
  if (!timerRef.current) {
    return;
  }

  clearTimeout(timerRef.current);
  timerRef.current = null;
}

function scheduleUserAutoEnterRetry({
  autoEnter,
  autoEnterTimerRef,
  joinRoute,
  detailRoute,
  attemptKey,
  nextAttemptIndex,
  setAutoJoinAttempt
}) {
  const delay = USER_AUTO_JOIN_RETRY_DELAYS_MS[nextAttemptIndex];
  if (!Number.isFinite(delay)) {
    return false;
  }

  clearScheduledAutoEnter(autoEnterTimerRef);
  setAutoJoinAttempt(nextAttemptIndex + 1);
  autoEnterTimerRef.current = window.setTimeout(() => {
    autoEnterTimerRef.current = null;
    autoEnter(joinRoute, detailRoute, {
      auto: true,
      attemptIndex: nextAttemptIndex,
      attemptKey
    }).catch(() => null);
  }, delay);
  return true;
}

function shouldRetryUserAutoEnter({ status, errorMessage, attemptIndex }) {
  if (attemptIndex >= USER_AUTO_JOIN_RETRY_DELAYS_MS.length - 1) {
    return false;
  }

  if (status === 401 || status === 403) {
    return false;
  }

  return !USER_AUTO_JOIN_FATAL_ERRORS.some((pattern) => pattern.test(String(errorMessage || "")));
}

async function apiFetchWithTimeout(path, options = {}, { timeoutMs = ROOM_ENTRY_MANUAL_REQUEST_TIMEOUT_MS } = {}) {
  const controller = typeof AbortController === "function" ? new AbortController() : null;
  const timerId = controller
    ? window.setTimeout(() => controller.abort(), timeoutMs)
    : null;

  try {
    return await apiFetch(path, {
      ...options,
      ...(controller ? { signal: controller.signal } : {})
    });
  } finally {
    if (timerId) {
      window.clearTimeout(timerId);
    }
  }
}
