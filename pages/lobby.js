import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import SiteLayout from "../components/SiteLayout";
import { API_ROUTES, apiFetch } from "../lib/client/api";
import styles from "../styles/Lobby.module.css";

const CHIP_PRESETS = [20, 50, 100, 300, 1000];
const ROOM_SEAT_TOTAL = 3;

export default function LobbyPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [error, setError] = useState("");
  const [joinRoomNo, setJoinRoomNo] = useState("");
  const [form, setForm] = useState({
    templateId: "",
    baseScore: 50,
    countdownSeconds: 18,
    autoTrusteeMinSeconds: 2,
    autoTrusteeMaxSeconds: 5,
    roomVisibility: "public"
  });

  async function loadData() {
    const [meResponse, roomsResponse, templatesResponse, leaderboardResponse] = await Promise.all([
      apiFetch(API_ROUTES.me()),
      apiFetch(API_ROUTES.cardRooms.list()),
      apiFetch(API_ROUTES.templates()),
      apiFetch(API_ROUTES.leaderboard())
    ]);

    const [meData, roomsData, templatesData, leaderboardData] = await Promise.all([
      meResponse.json(),
      roomsResponse.json(),
      templatesResponse.json(),
      leaderboardResponse.json()
    ]);

    if (!meData.user) {
      router.push("/login");
      return;
    }

    setMe(meData.user);
    setRooms(roomsData.items || []);
    setTemplates((templatesData.items || []).filter((item) => item.isActive));
    setLeaderboard((leaderboardData.items || []).slice(0, 8));
  }

  useEffect(() => {
    loadData().catch(() => setError("大厅资料读取失败"));
    const timer = setInterval(() => {
      loadData().catch(() => null);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (templates.length > 0 && !form.templateId) {
      const template = templates[0];
      setForm((current) => ({
        ...current,
        templateId: String(template.id),
        baseScore: template.settings.baseScore,
        countdownSeconds: template.settings.countdownSeconds,
        autoTrusteeMinSeconds: template.settings.autoTrusteeMinSeconds || 2,
        autoTrusteeMaxSeconds:
          template.settings.autoTrusteeMaxSeconds ||
          template.settings.autoTrusteeSeconds ||
          5,
        roomVisibility: template.settings.roomVisibility || "public"
      }));
    }
  }, [templates, form.templateId]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => String(item.id) === String(form.templateId)),
    [templates, form.templateId]
  );

  const swingPreview = useMemo(() => {
    const base = Number(form.baseScore || 0);
    const baselineMultiplier = 3;
    const bombMultiplier = selectedTemplate?.settings?.bombMultiplier || 2;
    const springMultiplier = selectedTemplate?.settings?.springMultiplier || 2;
    const capMultiplier = baselineMultiplier * bombMultiplier * springMultiplier;
    return {
      farmerWin: base * baselineMultiplier,
      landlordWin: base * baselineMultiplier * 2,
      farmerWinBomb: base * baselineMultiplier * bombMultiplier,
      landlordWinBomb: base * baselineMultiplier * bombMultiplier * 2,
      farmerCap: base * capMultiplier,
      landlordCap: base * capMultiplier * 2
    };
  }, [form.baseScore, selectedTemplate]);

  async function createRoom(event) {
    event.preventDefault();
    setError("");

    const response = await apiFetch(API_ROUTES.cardRooms.create(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: Number(form.templateId),
        overrides: {
          baseScore: Number(form.baseScore),
          countdownSeconds: Number(form.countdownSeconds),
          autoTrusteeMinSeconds: Number(form.autoTrusteeMinSeconds),
          autoTrusteeMaxSeconds: Number(form.autoTrusteeMaxSeconds),
          roomVisibility: form.roomVisibility
        }
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "建房失败");
      return;
    }

    router.push(`/room/${data.room.roomNo}`);
  }

  async function joinRoom(roomNo) {
    const normalizedRoomNo = String(roomNo || "").trim();
    if (!normalizedRoomNo) {
      setError("先输入房号或直接从牌桌列表进入");
      return;
    }

    const response = await apiFetch(API_ROUTES.cardRooms.join(normalizedRoomNo), { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "加入房间失败");
      return;
    }

    router.push(`/room/${data.room.roomNo}`);
  }

  const hallStats = [
    { label: "公开桌", value: `${rooms.length}` },
    { label: "模板", value: `${templates.length}` },
    { label: "我的金币", value: formatNumber(me?.coins) },
    { label: "段位", value: formatNumber(me?.rankScore) }
  ];

  return (
    <SiteLayout>
      <div className={styles.lobby}>
        <section className={styles.banner}>
          <div>
            <span className={styles.badge}>CARD HALL</span>
            <h1>底分拉满，直接开桌。</h1>
            <p>大厅中轴只做两件事: 选模板，进房开打。</p>
          </div>

          <div className={styles.bannerStats}>
            {hallStats.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.floor}>
          <aside className={styles.rail}>
            <article className={styles.quickJoinCard}>
              <span className={styles.panelEyebrow}>FAST JOIN</span>
              <strong>输房号秒进桌</strong>
              <div className={styles.inlineJoin}>
                <input
                  value={joinRoomNo}
                  onChange={(event) => setJoinRoomNo(event.target.value)}
                  placeholder="输入六位房号"
                />
                <button className="primary-button" type="button" onClick={() => joinRoom(joinRoomNo)}>
                  进房
                </button>
              </div>
              <p>中途断线还能重回这桌，只有结算后没人在线才会关房。</p>
            </article>

            <article className={styles.walletCard}>
              <span className={styles.panelEyebrow}>PLAYER WALLET</span>
              <strong>{me?.displayName || "载入中"}</strong>
              <p>{me?.bio || "今晚准备狠狠干一桌。"}</p>
              <div className={styles.metricStack}>
                <div>
                  <span>金币</span>
                  <strong>{formatNumber(me?.coins)}</strong>
                </div>
                <div>
                  <span>战绩</span>
                  <strong>
                    {me?.wins || 0}-{me?.losses || 0}
                  </strong>
                </div>
              </div>
            </article>
          </aside>

          <main className={styles.centerStage}>
            <form className={styles.launchPanel} onSubmit={createRoom}>
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.panelEyebrow}>OPEN TABLE</span>
                  <h2>开一桌新的斗地主</h2>
                  <p>{selectedTemplate?.description || "选一套今晚想玩的节奏。"} </p>
                </div>
                <button type="submit" className={styles.launchButton}>
                  立即开桌
                </button>
              </div>

              <div className={styles.templateGrid}>
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={`${styles.templateCard} ${
                      String(form.templateId) === String(template.id) ? styles.templateActive : ""
                    }`.trim()}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        templateId: String(template.id),
                        baseScore: template.settings.baseScore,
                        countdownSeconds: template.settings.countdownSeconds,
                        autoTrusteeMinSeconds: template.settings.autoTrusteeMinSeconds || 2,
                        autoTrusteeMaxSeconds:
                          template.settings.autoTrusteeMaxSeconds ||
                          template.settings.autoTrusteeSeconds ||
                          5,
                        roomVisibility: template.settings.roomVisibility || "public"
                      }))
                    }
                  >
                    <strong>{template.title}</strong>
                    <span>{template.description}</span>
                    <div className={styles.templateMeta}>
                      <em>底分 {template.settings.baseScore}</em>
                      <em>{template.settings.countdownSeconds}s 出牌</em>
                    </div>
                  </button>
                ))}
              </div>

              <div className={styles.controlGrid}>
                <label className={styles.field}>
                  <span>底分</span>
                  <input
                    type="number"
                    min="10"
                    step="10"
                    value={form.baseScore}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, baseScore: Number(event.target.value) }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>人工出牌</span>
                  <input
                    type="number"
                    min="8"
                    max="30"
                    value={form.countdownSeconds}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        countdownSeconds: Number(event.target.value)
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>托管最短</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={form.autoTrusteeMinSeconds}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        autoTrusteeMinSeconds: Number(event.target.value)
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>托管最长</span>
                  <input
                    type="number"
                    min={form.autoTrusteeMinSeconds}
                    max="15"
                    value={form.autoTrusteeMaxSeconds}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        autoTrusteeMaxSeconds: Number(event.target.value)
                      }))
                    }
                  />
                </label>
              </div>

              <div className={styles.chipRail}>
                {CHIP_PRESETS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`${styles.chipButton} ${
                      Number(form.baseScore) === chip ? styles.chipActive : ""
                    }`.trim()}
                    onClick={() => setForm((current) => ({ ...current, baseScore: chip }))}
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div className={styles.visibilityRow}>
                <button
                  type="button"
                  className={`${styles.switchButton} ${
                    form.roomVisibility === "public" ? styles.switchActive : ""
                  }`.trim()}
                  onClick={() => setForm((current) => ({ ...current, roomVisibility: "public" }))}
                >
                  公开桌
                </button>
                <button
                  type="button"
                  className={`${styles.switchButton} ${
                    form.roomVisibility === "private" ? styles.switchActive : ""
                  }`.trim()}
                  onClick={() => setForm((current) => ({ ...current, roomVisibility: "private" }))}
                >
                  私密桌
                </button>
              </div>

              <div className={styles.previewGrid}>
                <div>
                  <span>地主常规赢</span>
                  <strong>+{swingPreview.landlordWin}</strong>
                </div>
                <div>
                  <span>农民常规赢</span>
                  <strong>+{swingPreview.farmerWin}</strong>
                </div>
                <div>
                  <span>地主一炸</span>
                  <strong>+{swingPreview.landlordWinBomb}</strong>
                </div>
                <div>
                  <span>封顶爆发</span>
                  <strong>+{swingPreview.landlordCap}</strong>
                </div>
              </div>

              {error ? <p className="error-text">{error}</p> : null}
            </form>

            <section className={styles.roomPanel}>
              <div className={styles.panelHead}>
                <div>
                  <span className={styles.panelEyebrow}>LIVE TABLES</span>
                  <h2>正在亮着的牌桌</h2>
                </div>
                <button type="button" className="ghost-button" onClick={() => loadData().catch(() => null)}>
                  刷新
                </button>
              </div>

              <div className={styles.roomList}>
                {rooms.length > 0 ? (
                  rooms.map((room) => (
                    <article key={room.roomNo} className={styles.roomCard}>
                      <div className={styles.roomHead}>
                        <div>
                          <strong>{room.templateTitle || room.templateName || "公开桌"}</strong>
                          <span>房号 {room.roomNo}</span>
                        </div>
                        <span className={styles.stateBadge}>
                          {room.state === "playing" ? "对局中" : "等你入座"}
                        </span>
                      </div>

                      <div className={styles.roomMeta}>
                        <span>{room.settings?.baseScore || 0} 底分</span>
                        <span>{room.settings?.countdownSeconds || 0}s 出牌</span>
                        <span>{room.settings?.roomVisibility === "private" ? "私密" : "公开"}</span>
                      </div>

                      <div className={styles.occupancyTrack}>
                        <span
                          style={{
                            width: `${Math.min(
                              100,
                              ((room.players?.length || 0) / ROOM_SEAT_TOTAL) * 100
                            )}%`
                          }}
                        />
                      </div>

                      <div className={styles.roomFoot}>
                        <span>
                          {room.players?.length || 0}/{ROOM_SEAT_TOTAL} 人
                        </span>
                        <button type="button" onClick={() => joinRoom(room.roomNo)}>
                          进这桌
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className={styles.emptyState}>大厅现在空着，今晚第一桌等你开。</div>
                )}
              </div>
            </section>
          </main>

          <aside className={styles.rail}>
            <article className={styles.pulseCard}>
              <span className={styles.panelEyebrow}>PAYOUT PULSE</span>
              <strong>赢了加币，输了掉币</strong>
              <div className={styles.metricStack}>
                <div>
                  <span>农民炸弹局</span>
                  <strong>+{swingPreview.farmerWinBomb}</strong>
                </div>
                <div>
                  <span>满炸春天</span>
                  <strong>+{swingPreview.landlordCap}</strong>
                </div>
              </div>
              <p>现在所有游戏都统一吃这套金币结算，排行榜直接按总金币排。</p>
            </article>

            <article className={styles.rankPanel}>
              <span className={styles.panelEyebrow}>TOP COINS</span>
              <div className={styles.rankList}>
                {leaderboard.map((item) => (
                  <div key={item.id} className={styles.rankItem}>
                    <div>
                      <strong>#{item.rank}</strong>
                      <span>{item.displayName}</span>
                    </div>
                    <em>{formatNumber(item.coins)}</em>
                  </div>
                ))}
              </div>
            </article>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-Hant-HK");
}
