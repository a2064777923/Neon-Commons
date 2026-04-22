import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import SiteLayout from "../components/SiteLayout";
import { API_ROUTES, apiFetch } from "../lib/client/api";
import { copyText, getRoomEntryPath } from "../lib/client/room-entry";
import styles from "../styles/Lobby.module.css";

const CHIP_PRESETS = [20, 50, 100, 300, 1000];
const ROOM_SEAT_TOTAL = 3;
const GAME_KEY = "doudezhu";
const PAUSED_NEW_ROOM_COPY = "目前不開新房，已有房號或邀請可直接加入。";

export default function LobbyPage() {
  const router = useRouter();
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [discoveryItem, setDiscoveryItem] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [joinRoomNo, setJoinRoomNo] = useState("");
  const [form, setForm] = useState({
    templateId: "",
    baseScore: 50,
    maxRobMultiplier: 3,
    countdownSeconds: 18,
    autoTrusteeMinSeconds: 2,
    autoTrusteeMaxSeconds: 5,
    allowSpring: true,
    allowBomb: true,
    allowRocket: true,
    bombMultiplier: 2,
    rocketMultiplier: 2,
    springMultiplier: 2,
    roomVisibility: "public"
  });

  async function loadData() {
    const [meResponse, roomsResponse, templatesResponse, leaderboardResponse, hubResponse] = await Promise.all([
      apiFetch(API_ROUTES.me()),
      apiFetch(API_ROUTES.cardRooms.list()),
      apiFetch(API_ROUTES.templates()),
      apiFetch(API_ROUTES.leaderboard()),
      apiFetch(API_ROUTES.hub())
    ]);

    const [meData, roomsData, templatesData, leaderboardData, hubData] = await Promise.all([
      meResponse.json(),
      roomsResponse.json(),
      templatesResponse.json(),
      leaderboardResponse.json(),
      hubResponse.json()
    ]);

    setMe(meData.user || null);
    setRooms(roomsData.items || []);
    setTemplates(
      (templatesData.items || []).filter((item) => item.isActive && item.modeSupported)
    );
    setLeaderboard((leaderboardData.items || []).slice(0, 8));
    setDiscoveryItem(findDiscoveryItem(hubData, GAME_KEY));
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
      setForm((current) => ({
        ...current,
        ...buildFormFromTemplate(templates[0])
      }));
    }
  }, [templates, form.templateId]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => String(item.id) === String(form.templateId)),
    [templates, form.templateId]
  );

  const swingPreview = useMemo(() => {
    const base = Number(form.baseScore || 0);
    const baselineMultiplier = Number(form.maxRobMultiplier || 1);
    const bombMultiplier = form.allowBomb ? Number(form.bombMultiplier || 1) : 1;
    const rocketMultiplier = form.allowRocket ? Number(form.rocketMultiplier || 1) : 1;
    const springMultiplier = form.allowSpring ? Number(form.springMultiplier || 1) : 1;
    const capMultiplier =
      baselineMultiplier * bombMultiplier * rocketMultiplier * springMultiplier;
    return {
      farmerWin: base * baselineMultiplier,
      landlordWin: base * baselineMultiplier * 2,
      farmerWinBomb: base * baselineMultiplier * bombMultiplier,
      landlordWinBomb: base * baselineMultiplier * bombMultiplier * 2,
      landlordRocket: base * baselineMultiplier * rocketMultiplier * 2,
      farmerCap: base * capMultiplier,
      landlordCap: base * capMultiplier * 2
    };
  }, [form]);

  async function createRoom(event) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (isPaused) {
      setError(PAUSED_NEW_ROOM_COPY);
      return;
    }

    const response = await apiFetch(API_ROUTES.cardRooms.create(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateId: Number(form.templateId),
        overrides: {
          baseScore: Number(form.baseScore),
          bidOptions: buildBidOptions(form.maxRobMultiplier),
          maxRobMultiplier: Number(form.maxRobMultiplier),
          countdownSeconds: Number(form.countdownSeconds),
          autoTrusteeMinSeconds: Number(form.autoTrusteeMinSeconds),
          autoTrusteeMaxSeconds: Number(form.autoTrusteeMaxSeconds),
          allowSpring: Boolean(form.allowSpring),
          allowBomb: Boolean(form.allowBomb),
          allowRocket: Boolean(form.allowRocket),
          bombMultiplier: Number(form.bombMultiplier),
          rocketMultiplier: Number(form.rocketMultiplier),
          springMultiplier: Number(form.springMultiplier),
          roomVisibility: form.roomVisibility
        }
      })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "建房失败");
      if (response.status === 401) {
        router.push(`/login?returnTo=${encodeURIComponent("/lobby")}`);
        return;
      }
      return;
    }

    router.push(`/room/${data.room.roomNo}`);
  }

  function joinRoom(roomNo) {
    const normalizedRoomNo = String(roomNo || "").trim();
    if (!normalizedRoomNo) {
      setError("先输入房号或直接从牌桌列表进入");
      setNotice("");
      return;
    }

    setError("");
    setNotice("");
    router.push(getRoomEntryPath(GAME_KEY, normalizedRoomNo));
  }

  async function copyInvite(roomNo) {
    const normalizedRoomNo = String(roomNo || "").trim();
    if (!normalizedRoomNo) {
      setError("先輸入或選一個房號，再複製邀請。");
      setNotice("");
      return;
    }

    try {
      await copyText(getRoomEntryPath(GAME_KEY, normalizedRoomNo));
      setError("");
      setNotice(`已複製邀請 ${getRoomEntryPath(GAME_KEY, normalizedRoomNo)}`);
    } catch {
      setError("複製邀請失敗");
      setNotice("");
    }
  }

  const hallStats = [
    { label: "公开桌", value: `${rooms.length}` },
    { label: "模板", value: `${templates.length}` },
    { label: "我的金币", value: formatNumber(me?.coins) },
    { label: "入口状态", value: discoveryItem?.stateLabel || "可立即遊玩" }
  ];
  const isPaused = discoveryItem?.state === "paused-new-rooms";
  const bannerSubtitle = isPaused
    ? PAUSED_NEW_ROOM_COPY
    : "大厅中轴先处理快进与开桌，房号和邀请都走统一入口。";

  return (
    <SiteLayout>
      <div className={styles.lobby}>
        <section className={styles.banner}>
          <div>
            <span className={styles.badge}>CARD HALL</span>
            <h1>底分拉满，直接开桌。</h1>
            <p>{bannerSubtitle}</p>
            <div className={styles.bannerActions}>
              <Link href="/" className="ghost-button">
                返回遊戲家族
              </Link>
              <span className={styles.bannerState}>{discoveryItem?.stateLabel || "可立即遊玩"}</span>
            </div>
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
                  onChange={(event) =>
                    setJoinRoomNo(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="输入六位房号"
                />
                <button className="primary-button" type="button" onClick={() => joinRoom(joinRoomNo)}>
                  进房
                </button>
              </div>
              <div className={styles.quickActions}>
                <button className="ghost-button" type="button" onClick={() => copyInvite(joinRoomNo)}>
                  複製邀請
                </button>
                <Link href="/" className={styles.inlineLink}>
                  返回遊戲家族
                </Link>
              </div>
              <p>中途断线还能重回这桌，只有结算后没人在线才会关房。</p>
              {notice ? <p className={styles.statusNote}>{notice}</p> : null}
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
                {isPaused ? (
                  <div className={styles.pauseBanner}>
                    <strong>暫停新房</strong>
                    <span>{PAUSED_NEW_ROOM_COPY}</span>
                  </div>
                ) : (
                  <button type="submit" className={styles.launchButton}>
                    立即开桌
                  </button>
                )}
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
                        ...buildFormFromTemplate(template)
                      }))
                    }
                  >
                    <strong>{template.title}</strong>
                    <span>{template.description}</span>
                    <div className={styles.templateMeta}>
                      <em>底分 {template.settings.baseScore}</em>
                      <em>叫分上限 {template.settings.maxRobMultiplier}</em>
                      <em>{template.settings.countdownSeconds}s 出牌</em>
                    </div>
                    <div className={styles.roomMeta}>
                      {getDdzRuleSummary(template.settings).slice(0, 4).map((item) => (
                        <span key={`${template.id}-${item}`}>{item}</span>
                      ))}
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
                  <span>叫分上限</span>
                  <input
                    type="number"
                    min="1"
                    max="4"
                    value={form.maxRobMultiplier}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxRobMultiplier: Number(event.target.value)
                      }))
                    }
                  />
                </label>

                <label className={styles.field}>
                  <span>人工出牌</span>
                  <input
                    type="number"
                    min="8"
                    max="45"
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

                <label className={styles.field}>
                  <span>炸彈倍率</span>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={form.bombMultiplier}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        bombMultiplier: Number(event.target.value)
                      }))
                    }
                    disabled={!form.allowBomb}
                  />
                </label>

                <label className={styles.field}>
                  <span>王炸倍率</span>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={form.rocketMultiplier}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        rocketMultiplier: Number(event.target.value)
                      }))
                    }
                    disabled={!form.allowRocket}
                  />
                </label>

                <label className={styles.field}>
                  <span>春天倍率</span>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    value={form.springMultiplier}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        springMultiplier: Number(event.target.value)
                      }))
                    }
                    disabled={!form.allowSpring}
                  />
                </label>
              </div>

              <div className={styles.visibilityRow}>
                <button
                  type="button"
                  className={`${styles.switchButton} ${
                    form.allowBomb ? styles.switchActive : ""
                  }`.trim()}
                  onClick={() => setForm((current) => ({ ...current, allowBomb: !current.allowBomb }))}
                >
                  {form.allowBomb ? "炸彈開" : "炸彈關"}
                </button>
                <button
                  type="button"
                  className={`${styles.switchButton} ${
                    form.allowRocket ? styles.switchActive : ""
                  }`.trim()}
                  onClick={() =>
                    setForm((current) => ({ ...current, allowRocket: !current.allowRocket }))
                  }
                >
                  {form.allowRocket ? "王炸開" : "王炸關"}
                </button>
                <button
                  type="button"
                  className={`${styles.switchButton} ${
                    form.allowSpring ? styles.switchActive : ""
                  }`.trim()}
                  onClick={() =>
                    setForm((current) => ({ ...current, allowSpring: !current.allowSpring }))
                  }
                >
                  {form.allowSpring ? "春天結算開" : "春天結算關"}
                </button>
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

              <div className={styles.roomMeta} data-ddz-lobby-rules="selected">
                {getDdzRuleSummary(form).map((item) => (
                  <span key={`selected-${item}`}>{item}</span>
                ))}
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
                  <span>地主王炸</span>
                  <strong>+{swingPreview.landlordRocket}</strong>
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
                        {getDdzRuleSummary(room.settings).map((item) => (
                          <span key={`${room.roomNo}-${item}`}>{item}</span>
                        ))}
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
                        <div className={styles.roomActions}>
                          <button type="button" onClick={() => copyInvite(room.roomNo)}>
                            複製邀請
                          </button>
                          <button type="button" onClick={() => joinRoom(room.roomNo)}>
                            进这桌
                          </button>
                        </div>
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

function findDiscoveryItem(hubData, gameKey) {
  for (const family of hubData?.families || []) {
    const matched = (family.items || []).find((item) => item.gameKey === gameKey);
    if (matched) {
      return matched;
    }
  }

  return null;
}

function buildFormFromTemplate(template) {
  return {
    templateId: String(template.id),
    baseScore: template.settings.baseScore,
    maxRobMultiplier: template.settings.maxRobMultiplier || 3,
    countdownSeconds: template.settings.countdownSeconds,
    autoTrusteeMinSeconds: template.settings.autoTrusteeMinSeconds || 2,
    autoTrusteeMaxSeconds:
      template.settings.autoTrusteeMaxSeconds || template.settings.autoTrusteeSeconds || 5,
    allowSpring: template.settings.allowSpring !== false,
    allowBomb: template.settings.allowBomb !== false,
    allowRocket: template.settings.allowRocket !== false,
    bombMultiplier: template.settings.bombMultiplier || 2,
    rocketMultiplier: template.settings.rocketMultiplier || 2,
    springMultiplier: template.settings.springMultiplier || 2,
    roomVisibility: template.settings.roomVisibility || "public"
  };
}

function buildBidOptions(maxRobMultiplier) {
  const ceiling = Math.max(1, Math.min(4, Number(maxRobMultiplier || 3)));
  return Array.from({ length: ceiling + 1 }, (_item, index) => index);
}

function getDdzRuleSummary(settings) {
  const maxRobMultiplier = Number(settings?.maxRobMultiplier || 3);
  const autoMin = Number(settings?.autoTrusteeMinSeconds || 2);
  const autoMax = Number(settings?.autoTrusteeMaxSeconds || settings?.autoTrusteeSeconds || 5);

  return [
    `${settings?.baseScore || 0} 底分`,
    `叫分至 ${maxRobMultiplier}`,
    `${settings?.countdownSeconds || 0}s 出牌`,
    `托管 ${autoMin}-${autoMax}s`,
    settings?.allowBomb === false
      ? "禁炸彈"
      : `炸彈 x${Number(settings?.bombMultiplier || 2)}`,
    settings?.allowRocket === false
      ? "禁王炸"
      : `王炸 x${Number(settings?.rocketMultiplier || 2)}`,
    settings?.allowSpring === false
      ? "春天關閉"
      : `春天 x${Number(settings?.springMultiplier || 2)}`,
    settings?.roomVisibility === "private" ? "私密桌" : "公開桌"
  ];
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-Hant-HK");
}
