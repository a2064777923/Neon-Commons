import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../components/SiteLayout";
import { API_ROUTES, apiFetch } from "../lib/client/api";
import styles from "../styles/Leaderboard.module.css";

export default function LeaderboardPage() {
  const [items, setItems] = useState([]);
  const [me, setMe] = useState(null);

  useEffect(() => {
    Promise.all([apiFetch(API_ROUTES.leaderboard()), apiFetch(API_ROUTES.me())])
      .then(async ([leaderboardResponse, meResponse]) => {
        const [leaderboardData, meData] = await Promise.all([
          leaderboardResponse.json(),
          meResponse.json()
        ]);
        setItems(leaderboardData.items || []);
        setMe(meData.user || null);
      })
      .catch(() => {
        setItems([]);
        setMe(null);
      });
  }, []);

  const podium = useMemo(() => items.slice(0, 3), [items]);
  const richest = items[0]?.coins || 0;
  const totalCoins = items.reduce((sum, item) => sum + Number(item.coins || 0), 0);

  return (
    <SiteLayout>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <span className={styles.badge}>COIN LADDER</span>
            <h1>今晚谁最有钱，一眼看完。</h1>
            <p>全站金币统一按所有对局结算累计。赢了吃币，输了掉币，所有游戏共用这一张榜。</p>
          </div>

          <div className={styles.heroStats}>
            <div>
              <span>榜首资产</span>
              <strong>{formatNumber(richest)}</strong>
            </div>
            <div>
              <span>全站总金币</span>
              <strong>{formatNumber(totalCoins)}</strong>
            </div>
            <div>
              <span>我的资产</span>
              <strong>{formatNumber(me?.coins)}</strong>
            </div>
          </div>
        </section>

        <section className={styles.podium}>
          {podium.map((item, index) => (
            <article key={item.id} className={styles.podiumCard} data-rank={index + 1}>
              <div className={styles.avatarFrame}>
                {item.avatarUrl ? (
                  <img src={item.avatarUrl} alt={`${item.displayName} 头像`} className={styles.avatarImage} />
                ) : (
                  <span>{getAvatarInitial(item.displayName)}</span>
                )}
              </div>
              <span className={styles.rankLabel}>#{item.rank}</span>
              <strong>{item.displayName}</strong>
              <p>@{item.username}</p>
              <div className={styles.podiumMetric}>
                <span>金币</span>
                <strong>{formatNumber(item.coins)}</strong>
              </div>
              <div className={styles.podiumMeta}>
                <span>段位 {formatNumber(item.rankScore)}</span>
                <span>胜率 {item.winRate}%</span>
              </div>
            </article>
          ))}
        </section>

        <section className={styles.tableCard}>
          <div className={styles.tableHead}>
            <div>
              <span className={styles.sectionEyebrow}>GLOBAL RANKING</span>
              <h2>总金币排行榜</h2>
            </div>
            <div className={styles.tableHint}>排序：金币 {" > "} 段位 {" > "} 胜场</div>
          </div>

          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>排名</th>
                  <th>玩家</th>
                  <th>金币</th>
                  <th>段位</th>
                  <th>胜场</th>
                  <th>败场</th>
                  <th>胜率</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={me?.id === item.id ? styles.meRow : ""}
                  >
                    <td>#{item.rank}</td>
                    <td>
                      <div className={styles.playerCell}>
                        <span className={styles.cellAvatar}>
                          {item.avatarUrl ? (
                            <img src={item.avatarUrl} alt="" className={styles.cellAvatarImage} />
                          ) : (
                            getAvatarInitial(item.displayName)
                          )}
                        </span>
                        <span>
                          <strong>{item.displayName}</strong>
                          <em>@{item.username}</em>
                        </span>
                      </div>
                    </td>
                    <td>{formatNumber(item.coins)}</td>
                    <td>{formatNumber(item.rankScore)}</td>
                    <td>{item.wins}</td>
                    <td>{item.losses}</td>
                    <td>{item.winRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-Hant-HK");
}

function getAvatarInitial(displayName) {
  return String(displayName || "?").trim().slice(0, 1).toUpperCase() || "?";
}
