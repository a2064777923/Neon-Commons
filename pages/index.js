import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../components/SiteLayout";
import GameIcon from "../components/game-hub/GameIcon";
import { apiFetch } from "../lib/client/api";
import styles from "../styles/Arcade.module.css";

const { GAME_CATALOG } = require("../lib/games/catalog");

const HUB_ORDER = [
  { key: "doudezhu", action: "进牌桌", mood: "高压快桌" },
  { key: "werewolf", action: "组推理局", mood: "发言压场" },
  { key: "avalon", action: "开圆桌", mood: "阵营博弈" },
  { key: "gomoku", action: "落子开练", mood: "短局连胜" },
  { key: "chinesecheckers", action: "冲营地", mood: "多人穿插" }
];

export default function HomePage() {
  const [me, setMe] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [sources, setSources] = useState({
    ddz: [],
    werewolf: [],
    avalon: [],
    gomoku: [],
    chinesecheckers: []
  });

  useEffect(() => {
    loadHubData()
      .then(({ user, nextLeaderboard, nextSources }) => {
        setMe(user);
        setLeaderboard(nextLeaderboard);
        setSources(nextSources);
      })
      .catch(() => null);

    const timer = setInterval(() => {
      loadHubData()
        .then(({ user, nextLeaderboard, nextSources }) => {
          setMe(user);
          setLeaderboard(nextLeaderboard);
          setSources(nextSources);
        })
        .catch(() => null);
    }, 8000);

    return () => clearInterval(timer);
  }, []);

  const gameCards = useMemo(
    () =>
      HUB_ORDER.map((entry, index) => {
        const game = GAME_CATALOG[entry.key];
        const list = sources[entry.key] || [];
        return {
          ...game,
          action: entry.action,
          mood: entry.mood,
          count: list.length,
          featured: index === 0,
          rooms: list.slice(0, 2)
        };
      }),
    [sources]
  );

  const liveRooms = useMemo(() => {
    const rows = [
      ...normalizeRooms(sources.ddz, "斗地主", "/room"),
      ...normalizeRooms(sources.werewolf, "狼人杀", "/party"),
      ...normalizeRooms(sources.avalon, "阿瓦隆", "/party"),
      ...normalizeRooms(sources.gomoku, "五子棋", "/board"),
      ...normalizeRooms(sources.chinesecheckers, "跳棋", "/board")
    ];

    return rows
      .sort((left, right) => {
        if (left.state === right.state) {
          return right.playerCount - left.playerCount;
        }
        return left.state === "playing" ? -1 : 1;
      })
      .slice(0, 6);
  }, [sources]);

  const topCoins = leaderboard[0]?.coins || 0;

  return (
    <SiteLayout>
      <div className={styles.arcade}>
        <section className={styles.commandBar}>
          <div>
            <span className={styles.badge}>NIGHT MODE HUB</span>
            <h1>挑游戏，进房，马上打。</h1>
            <p>中间直接开局，两边只放快讯和资产，不再堆说明书。</p>
          </div>

          <div className={styles.commandStats}>
            <div>
              <span>在线牌桌</span>
              <strong>{liveRooms.length}</strong>
            </div>
            <div>
              <span>榜首金币</span>
              <strong>{formatNumber(topCoins)}</strong>
            </div>
            <div>
              <span>我的金币</span>
              <strong>{formatNumber(me?.coins)}</strong>
            </div>
          </div>
        </section>

        <section className={styles.hubGrid}>
          <aside className={styles.sideRail}>
            {me ? (
              <article className={styles.walletCard}>
                <span className={styles.panelEyebrow}>PLAYER HUD</span>
                <strong>{me.displayName}</strong>
                <p>{me.bio || "今晚准备狠狠干一桌。"}</p>
                <div className={styles.metricStack}>
                  <div>
                    <span>金币</span>
                    <strong>{formatNumber(me.coins)}</strong>
                  </div>
                  <div>
                    <span>段位</span>
                    <strong>{formatNumber(me.rankScore)}</strong>
                  </div>
                </div>
                <div className={styles.actionRow}>
                  <Link href="/profile" className="secondary-link">
                    改资料
                  </Link>
                  <Link href="/leaderboard" className="primary-link">
                    看金币榜
                  </Link>
                </div>
              </article>
            ) : (
              <article className={styles.walletCard}>
                <span className={styles.panelEyebrow}>ENTRY SIGNAL</span>
                <strong>先建号再上桌</strong>
                <p>账号一开，所有房间、金币和排行榜都能同步。</p>
                <div className={styles.actionRow}>
                  <Link href="/register" className="primary-link">
                    建号入场
                  </Link>
                  <Link href="/login" className="secondary-link">
                    已有账号
                  </Link>
                </div>
              </article>
            )}

            <article className={styles.signalCard}>
              <span className={styles.panelEyebrow}>ROOM FEED</span>
              <div className={styles.signalList}>
                {liveRooms.length > 0 ? (
                  liveRooms.map((room) => (
                    <Link key={`${room.kind}-${room.roomNo}`} href={room.href} className={styles.signalItem}>
                      <div>
                        <strong>{room.kind}</strong>
                        <span>{room.title}</span>
                      </div>
                      <span>{room.state === "playing" ? "对局中" : "待开局"}</span>
                    </Link>
                  ))
                ) : (
                  <div className={styles.emptyState}>当前还没人开桌，今晚第一局等你点亮。</div>
                )}
              </div>
            </article>
          </aside>

          <main className={styles.centerArena}>
            <div className={styles.stageHead}>
              <div>
                <span className={styles.panelEyebrow}>GAME STAGE</span>
                <h2>中间只放游戏入口</h2>
              </div>
              <Link href="/lobby" className="primary-link">
                直进斗地主大厅
              </Link>
            </div>

            <div className={styles.gameGrid}>
              {gameCards.map((game) => (
                <article
                  key={game.key}
                  className={`${styles.gameCard} ${game.featured ? styles.gameCardFeatured : ""}`.trim()}
                >
                  <div className={styles.gameIconWrap}>
                    <GameIcon gameKey={game.key} className={styles.gameIcon} />
                  </div>
                  <div className={styles.gameCopy}>
                    <div className={styles.gameMeta}>
                      <span>{game.players}</span>
                      <span>{game.count} 个公开房</span>
                    </div>
                    <h3>{game.title}</h3>
                    <p>{game.mood}</p>
                  </div>

                  <div className={styles.roomPeek}>
                    {game.rooms.length > 0 ? (
                      game.rooms.map((room) => (
                        <span key={`${game.key}-${room.roomNo}`}>
                          {room.state === "playing" ? "LIVE" : "OPEN"} · {room.roomNo}
                        </span>
                      ))
                    ) : (
                      <span>今晚等你开第一桌</span>
                    )}
                  </div>

                  <div className={styles.gameFoot}>
                    <strong>{game.strapline}</strong>
                    <Link href={game.route} className={styles.enterLink}>
                      {game.action}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </main>

          <aside className={styles.sideRail}>
            <article className={styles.rankCard}>
              <span className={styles.panelEyebrow}>TOP COINS</span>
              <div className={styles.rankList}>
                {leaderboard.slice(0, 5).map((item) => (
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

            <article className={styles.signalCard}>
              <span className={styles.panelEyebrow}>FAST GATES</span>
              <div className={styles.fastActions}>
                <Link href="/games/werewolf" className="secondary-link">
                  狼人杀
                </Link>
                <Link href="/games/avalon" className="secondary-link">
                  阿瓦隆
                </Link>
                <Link href="/games/gomoku" className="secondary-link">
                  五子棋
                </Link>
                <Link href="/games/chinesecheckers" className="secondary-link">
                  跳棋
                </Link>
              </div>
            </article>
          </aside>
        </section>
      </div>
    </SiteLayout>
  );
}

async function loadHubData() {
  const [
    meResponse,
    leaderboardResponse,
    ddzResponse,
    werewolfResponse,
    avalonResponse,
    gomokuResponse,
    chineseResponse
  ] = await Promise.all([
    apiFetch("/api/me"),
    apiFetch("/api/leaderboard"),
    apiFetch("/api/rooms"),
    apiFetch("/api/party/rooms?gameKey=werewolf"),
    apiFetch("/api/party/rooms?gameKey=avalon"),
    apiFetch("/api/board/rooms?gameKey=gomoku"),
    apiFetch("/api/board/rooms?gameKey=chinesecheckers")
  ]);

  const [meData, leaderboardData, ddzData, werewolfData, avalonData, gomokuData, chineseData] =
    await Promise.all([
      meResponse.json(),
      leaderboardResponse.json(),
      ddzResponse.json(),
      werewolfResponse.json(),
      avalonResponse.json(),
      gomokuResponse.json(),
      chineseResponse.json()
    ]);

  return {
    user: meData.user || null,
    nextLeaderboard: leaderboardData.items || [],
    nextSources: {
      ddz: ddzData.items || [],
      werewolf: werewolfData.items || [],
      avalon: avalonData.items || [],
      gomoku: gomokuData.items || [],
      chinesecheckers: chineseData.items || []
    }
  };
}

function normalizeRooms(items = [], kind, prefix) {
  return items.map((room) => ({
    roomNo: room.roomNo,
    kind,
    title: room.templateTitle || room.title || room.strapline || "公开房",
    state: room.state,
    playerCount: room.playerCount || room.players?.length || 0,
    href: `${prefix}/${room.roomNo}`
  }));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-Hant-HK");
}
