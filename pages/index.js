import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import SiteLayout from "../components/SiteLayout";
import GameIcon from "../components/game-hub/GameIcon";
import { API_ROUTES, apiFetch } from "../lib/client/api";
import styles from "../styles/Arcade.module.css";

const ROOM_NOT_FOUND_COPY =
  "找不到這個房間。請檢查房號或邀請是否正確，或回到遊戲家族重新進入。";

export default function HomePage() {
  const router = useRouter();
  const [hub, setHub] = useState(null);
  const [me, setMe] = useState(null);
  const [mode, setMode] = useState("room-no");
  const [roomNo, setRoomNo] = useState("");
  const [inviteText, setInviteText] = useState("");
  const [shareRooms, setShareRooms] = useState([]);
  const [selectedShareRoom, setSelectedShareRoom] = useState("");
  const [dockMessage, setDockMessage] = useState("");
  const [dockBusy, setDockBusy] = useState(false);

  useEffect(() => {
    loadHubData().catch(() => setDockMessage("遊戲家族讀取失敗"));

    const timer = setInterval(() => {
      loadHubData().catch(() => null);
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (mode !== "share-room" || !me?.id) {
      return;
    }

    loadShareableRooms().catch(() => setDockMessage("目前沒有可分享的房間"));
  }, [mode, me?.id]);

  async function loadHubData() {
    const [hubResponse, meResponse] = await Promise.all([
      apiFetch(API_ROUTES.hub()),
      apiFetch(API_ROUTES.me())
    ]);

    const [hubData, meData] = await Promise.all([hubResponse.json(), meResponse.json()]);
    setHub(hubData);
    setMe(meData.user || null);
  }

  async function loadShareableRooms() {
    const response = await apiFetch(API_ROUTES.roomEntry.shareable());
    const data = await response.json();

    if (!response.ok) {
      setShareRooms([]);
      setSelectedShareRoom("");
      return;
    }

    setShareRooms(data.items || []);
    setSelectedShareRoom((current) => current || data.items?.[0]?.roomNo || "");
  }

  async function submitRoomNo(event) {
    event.preventDefault();
    setDockBusy(true);
    setDockMessage("");

    const normalizedRoomNo = String(roomNo || "").trim();
    if (!normalizedRoomNo) {
      setDockBusy(false);
      setDockMessage("先輸入六位房號。");
      return;
    }

    const target = await resolveRoomTarget(normalizedRoomNo);
    setDockBusy(false);
    if (!target) {
      return;
    }

    router.push(target);
  }

  async function submitInvite(event) {
    event.preventDefault();
    setDockBusy(true);
    setDockMessage("");

    const parsed = parseInviteInput(inviteText);
    if (!parsed) {
      setDockBusy(false);
      setDockMessage("請貼上完整邀請或六位房號。");
      return;
    }

    if (parsed.type === "entry-path") {
      setDockBusy(false);
      router.push(parsed.value);
      return;
    }

    const target = await resolveRoomTarget(parsed.value);
    setDockBusy(false);
    if (!target) {
      return;
    }

    router.push(target);
  }

  async function submitShare(event) {
    event.preventDefault();
    setDockMessage("");

    const shareRoom = shareRooms.find((item) => item.roomNo === selectedShareRoom);
    if (!shareRoom) {
      setDockMessage(me ? "先去開房" : "登入後才可分享你的房間。");
      return;
    }

    await copyText(buildAbsoluteUrl(shareRoom.shareUrl));
    setDockMessage("邀請已複製。");
  }

  async function resolveRoomTarget(targetRoomNo) {
    const response = await apiFetch(API_ROUTES.roomEntry.resolve(targetRoomNo));
    const data = await response.json();

    if (!response.ok || !data.shareUrl) {
      setDockMessage(ROOM_NOT_FOUND_COPY);
      return "";
    }

    return data.shareUrl;
  }

  const families = hub?.families || [];
  const liveFeed = hub?.liveFeed || [];
  const leaderboardPreview = hub?.leaderboardPreview || [];
  const universalEntry = hub?.universalEntry || {};
  const shareHint = me
    ? "只對你目前可分享的房間生成邀請連結。"
    : "登入後即可生成自己房間的分享邀請。";

  const commandStats = useMemo(
    () => [
      {
        label: "在線房間",
        value: String(hub?.capabilitySummary?.totalPublicRooms || liveFeed.length || 0)
      },
      {
        label: "榜首金幣",
        value: formatNumber(leaderboardPreview[0]?.coins)
      },
      {
        label: "我的金幣",
        value: formatNumber(me?.coins)
      }
    ],
    [hub?.capabilitySummary?.totalPublicRooms, leaderboardPreview, liveFeed.length, me?.coins]
  );

  return (
    <SiteLayout>
      <div className={styles.arcade}>
        <section className={styles.commandBanner}>
          <div className={styles.bannerCopy}>
            <span className={styles.eyebrow}>NEON COMMONS</span>
            <h1>今晚開哪一局？霓虹大廳已經亮燈。</h1>
            <p>拉上朋友、貼上房號就進場，牌桌、推理局、棋盤戰都在這裡待命。</p>
          </div>

          <div className={styles.bannerStats}>
            {commandStats.map((item) => (
              <div key={item.label} className={styles.statCard}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className={styles.stageGrid}>
          <aside className={styles.leftRail}>
            {me ? (
              <article className={styles.profileCard}>
                <span className={styles.eyebrow}>PLAYER HUD</span>
                <strong>{me.displayName}</strong>
                <p>{me.bio || "今晚先從哪個家族開第一桌？"}</p>
                <div className={styles.metricList}>
                  <div>
                    <span>金幣</span>
                    <strong>{formatNumber(me.coins)}</strong>
                  </div>
                  <div>
                    <span>戰績</span>
                    <strong>
                      {me.wins || 0}-{me.losses || 0}
                    </strong>
                  </div>
                </div>
                <div className={styles.linkRow}>
                  <Link href="/profile" className={styles.ghostLink}>
                    改資料
                  </Link>
                  <Link href="/leaderboard" className={styles.primaryLink}>
                    看排行榜
                  </Link>
                </div>
              </article>
            ) : (
              <article className={styles.profileCard}>
                <span className={styles.eyebrow}>ENTRY SIGNAL</span>
                <strong>先登入，再把每局同步回帳號。</strong>
                <p>已登入玩家可直接從邀請進房，之後也能把更多遊戲共享在同一份身份裡。</p>
                <div className={styles.linkRow}>
                  <Link href="/login" className={styles.primaryLink}>
                    去登入
                  </Link>
                  <Link href="/register" className={styles.ghostLink}>
                    建新帳號
                  </Link>
                </div>
              </article>
            )}

            <article className={styles.utilityCard}>
              <div className={styles.utilityHead}>
                <span className={styles.eyebrow}>LIVE FEED</span>
                <strong>今晚的公開房</strong>
              </div>
              <div className={styles.feedList}>
                {liveFeed.length > 0 ? (
                  liveFeed.map((room) => (
                    <Link
                      key={`${room.gameKey}-${room.roomNo}`}
                      href={room.sharePath || room.detailRoute}
                      className={styles.feedItem}
                    >
                      <div>
                        <strong>{room.title}</strong>
                        <span>
                          {room.roomNo} · {room.playerCount} 人
                        </span>
                      </div>
                      <em>{room.roomState === "playing" ? "對局中" : "待開局"}</em>
                    </Link>
                  ))
                ) : (
                  <div className={styles.emptyFeed}>今晚還沒人開桌</div>
                )}
              </div>
            </article>
          </aside>

          <main className={styles.centerColumn}>
            <section className={styles.commandDock}>
              <div className={styles.commandHead}>
                <div>
                  <span className={styles.eyebrow}>ARCADE COMMAND DOCK</span>
                  <h2>{universalEntry.heading || "遊戲入口"}</h2>
                </div>
                <Link href="#game-families" className={styles.inlineLink}>
                  查看可玩的遊戲家族
                </Link>
              </div>

              <div className={styles.modeTabs}>
                {(universalEntry.modes || []).map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`${styles.modeTab} ${mode === entry.key ? styles.modeTabActive : ""}`.trim()}
                    onClick={() => setMode(entry.key)}
                  >
                    {entry.label}
                  </button>
                ))}
              </div>

              {mode === "room-no" ? (
                <form className={styles.commandForm} onSubmit={submitRoomNo}>
                  <label className={styles.commandField}>
                    <span>六位房號</span>
                    <input
                      value={roomNo}
                      onChange={(event) => setRoomNo(event.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="輸入 6 位房號"
                    />
                  </label>
                  <button type="submit" className={styles.commandButton} disabled={dockBusy}>
                    {dockBusy ? "解析中..." : "進入房間"}
                  </button>
                  <p className={styles.commandHint}>
                    {findModeHelper(universalEntry.modes, "room-no") ||
                      "六位房號可直接定位到對應遊戲房間。"}
                  </p>
                </form>
              ) : null}

              {mode === "invite-link" ? (
                <form className={styles.commandForm} onSubmit={submitInvite}>
                  <label className={styles.commandField}>
                    <span>邀請連結</span>
                    <textarea
                      value={inviteText}
                      onChange={(event) => setInviteText(event.target.value)}
                      placeholder="貼上完整邀請，或直接貼六位房號"
                      rows={3}
                    />
                  </label>
                  <button type="submit" className={styles.commandButton} disabled={dockBusy}>
                    {dockBusy ? "解析中..." : "解析邀請"}
                  </button>
                  <p className={styles.commandHint}>
                    {findModeHelper(universalEntry.modes, "invite-link") ||
                      "支援完整邀請連結，系統自動判斷遊戲與房間。"}
                  </p>
                </form>
              ) : null}

              {mode === "share-room" ? (
                <form className={styles.commandForm} onSubmit={submitShare}>
                  <label className={styles.commandField}>
                    <span>選擇可分享房間</span>
                    <select
                      value={selectedShareRoom}
                      onChange={(event) => setSelectedShareRoom(event.target.value)}
                    >
                      {shareRooms.length > 0 ? (
                        shareRooms.map((room) => (
                          <option key={room.roomNo} value={room.roomNo}>
                            {room.title} · {room.roomNo}
                          </option>
                        ))
                      ) : (
                        <option value="">目前沒有可分享的房間</option>
                      )}
                    </select>
                  </label>
                  <button type="submit" className={styles.commandButton}>
                    複製邀請
                  </button>
                  <p className={styles.commandHint}>
                    {findModeHelper(universalEntry.modes, "share-room") || shareHint}
                  </p>
                </form>
              ) : null}

              {dockMessage ? <div className={styles.commandMessage}>{dockMessage}</div> : null}
            </section>

            <section id="game-families" className={styles.familyStack}>
              <div className={styles.sectionHead}>
                <span className={styles.eyebrow}>FAMILY GRID</span>
                <h2>遊戲家族</h2>
              </div>

              {families.map((family) => {
                const [anchor, ...others] = family.items || [];
                if (!anchor) {
                  return null;
                }

                return (
                  <section key={family.familyKey} className={styles.familyBand}>
                    <div className={styles.familyBandHead}>
                      <div>
                        <span className={styles.familyTitle}>{family.label}</span>
                        <p>{family.strapline}</p>
                      </div>
                      {anchor.route ? (
                        <Link href={anchor.route} className={styles.inlineLink}>
                          查看這個家族
                        </Link>
                      ) : null}
                    </div>

                    <div className={styles.familyBandGrid}>
                      <article className={styles.anchorCard}>
                        <div className={styles.cardIcon}>
                          <GameIcon gameKey={anchor.gameKey} className={styles.iconGraphic} />
                        </div>
                        <div className={styles.cardCopy}>
                          <div className={styles.cardMeta}>
                            <span className={styles.stateBadge}>{anchor.stateLabel}</span>
                            <span>{getFamilyCardMetaCopy(anchor, "anchor")}</span>
                          </div>
                          <h3>{anchor.title}</h3>
                          <p>{getFamilyCardDescription(anchor)}</p>
                        </div>
                        <div className={styles.cardActions}>
                          <strong>{anchor.strapline}</strong>
                          {anchor.route && anchor.state !== "coming-soon" ? (
                            <Link href={anchor.route} className={styles.primaryLink}>
                              {getFamilyCardCta(anchor)}
                            </Link>
                          ) : (
                            <span className={styles.comingSoonChip}>即將推出</span>
                          )}
                        </div>
                      </article>

                      <div className={styles.compactGrid}>
                        {others.map((item) => (
                          <article
                            key={item.gameKey}
                            className={`${styles.compactCard} ${
                              item.state !== "playable" ? styles.compactCardMuted : ""
                            }`.trim()}
                          >
                            <div className={styles.compactHead}>
                              <div className={styles.compactIcon}>
                                <GameIcon gameKey={item.gameKey} className={styles.iconGraphic} />
                              </div>
                              <div>
                                <span className={styles.stateBadge}>{item.stateLabel}</span>
                                <h3>{item.title}</h3>
                              </div>
                            </div>
                            <p>{getFamilyCardDescription(item)}</p>
                            <div className={styles.compactFoot}>
                              <span>{getFamilyCardMetaCopy(item, "compact")}</span>
                              {item.route && item.state !== "coming-soon" ? (
                                <Link href={item.route} className={styles.compactLink}>
                                  {getFamilyCardCta(item)}
                                </Link>
                              ) : (
                                <span className={styles.comingSoonChip}>即將推出</span>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  </section>
                );
              })}
            </section>
          </main>

          <aside className={styles.rightRail}>
            <article className={styles.utilityCard}>
              <div className={styles.utilityHead}>
                <span className={styles.eyebrow}>TOP COINS</span>
                <strong>今晚誰最肥</strong>
              </div>
              <div className={styles.rankList}>
                {leaderboardPreview.map((item) => (
                  <Link key={item.id} href="/leaderboard" className={styles.rankItem}>
                    <div>
                      <strong>#{item.rank}</strong>
                      <span>{item.displayName}</span>
                    </div>
                    <em>{formatNumber(item.coins)}</em>
                  </Link>
                ))}
              </div>
            </article>

            <article className={styles.utilityCard}>
              <div className={styles.utilityHead}>
                <span className={styles.eyebrow}>FAST GATES</span>
                <strong>先去常玩家族</strong>
              </div>
              <div className={styles.quickLinks}>
                <Link href="/lobby" className={styles.ghostLink}>
                  斗地主
                </Link>
                <Link href="/games/werewolf" className={styles.ghostLink}>
                  狼人殺
                </Link>
                <Link href="/games/avalon" className={styles.ghostLink}>
                  阿瓦隆
                </Link>
                <Link href="/games/gomoku" className={styles.ghostLink}>
                  五子棋
                </Link>
                <Link href="/games/chinesecheckers" className={styles.ghostLink}>
                  中國跳棋
                </Link>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </SiteLayout>
  );
}

function parseInviteInput(value) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  if (/^\d{6}$/.test(text)) {
    return { type: "room-no", value: text };
  }

  if (text.startsWith("/entry/")) {
    return { type: "entry-path", value: text };
  }

  try {
    const url = new URL(text);
    if (url.pathname.startsWith("/entry/")) {
      return { type: "entry-path", value: `${url.pathname}${url.search}` };
    }
  } catch {
    return null;
  }

  return null;
}

function getFamilyCardCta(item) {
  if (item.launchMode === "direct") {
    return "立即遊玩";
  }

  if (item.state === "paused-new-rooms") {
    return "房號／邀請仍可進";
  }

  return "前往大廳";
}

function getFamilyCardDescription(item) {
  if (item.launchMode === "direct" && item.state === "playable") {
    return item.strapline;
  }

  return item.stateDescription || item.strapline;
}

function getFamilyCardMetaCopy(item, variant) {
  if (item.state === "coming-soon") {
    return (item.discoveryTags || []).join(" · ") || "即將推出";
  }

  if (item.launchMode === "direct") {
    return "直接開始，不需房號";
  }

  if (item.roomCount > 0) {
    return `${item.roomCount} 個公開房`;
  }

  return variant === "anchor" ? "今晚等你開第一桌" : "房號仍可直接進入";
}

function findModeHelper(modes = [], key) {
  return modes.find((entry) => entry.key === key)?.helper || "";
}

async function copyText(text) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  throw new Error("clipboard unavailable");
}

function buildAbsoluteUrl(path) {
  if (typeof window === "undefined") {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-Hant-HK");
}
