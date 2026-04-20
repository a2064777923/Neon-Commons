import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import SiteLayout from "../../components/SiteLayout";
import GameIcon from "../../components/game-hub/GameIcon";
import { apiFetch } from "../../lib/client/api";
import styles from "../../styles/GameLobby.module.css";

const {
  PARTY_GAME_KEYS,
  BOARD_GAME_KEYS,
  getGameMeta,
  getGameMode,
  getPartyDefaultConfig,
  getBoardDefaultConfig,
  getGameLimits,
  getBoardPlayerOptions
} = require("../../lib/games/catalog");

export default function GameLobbyPage() {
  const router = useRouter();
  const { gameKey } = router.query;
  const meta = useMemo(() => getGameMeta(gameKey), [gameKey]);
  const gameMode = useMemo(() => getGameMode(gameKey), [gameKey]);
  const limits = useMemo(() => getGameLimits(gameKey), [gameKey]);
  const boardPlayerOptions = useMemo(() => getBoardPlayerOptions(gameKey), [gameKey]);
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [joinRoomNo, setJoinRoomNo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => ({
    visibility: "public"
  }));

  useEffect(() => {
    if (!gameKey || !["party", "board"].includes(gameMode)) {
      return;
    }

    const defaults =
      gameMode === "party" ? getPartyDefaultConfig(gameKey) : getBoardDefaultConfig(gameKey);
    setForm(defaults);
  }, [gameKey, gameMode]);

  useEffect(() => {
    if (!gameKey || !["party", "board"].includes(gameMode)) {
      return;
    }

    loadData(gameKey, gameMode).catch(() => setError("读取房间列表失败"));
    const timer = setInterval(() => {
      loadData(gameKey, gameMode).catch(() => null);
    }, 5000);

    return () => clearInterval(timer);
  }, [gameKey, gameMode]);

  async function loadData(activeGameKey, activeMode = gameMode) {
    const [meResponse, roomsResponse] = await Promise.all([
      apiFetch("/api/me"),
      apiFetch(`/${activeMode === "party" ? "api/party/rooms" : "api/board/rooms"}?gameKey=${activeGameKey}`)
    ]);

    const [meData, roomsData] = await Promise.all([meResponse.json(), roomsResponse.json()]);
    setMe(meData.user || null);
    setRooms(roomsData.items || []);
  }

  async function createRoom(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await apiFetch(`/${gameMode === "party" ? "api/party/rooms" : "api/board/rooms"}?gameKey=${gameKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameKey,
        config: form
      })
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      setError(data.error || "创建房间失败");
      return;
    }

    router.push(gameMode === "party" ? `/party/${data.room.roomNo}` : `/board/${data.room.roomNo}`);
  }

  async function joinRoom(roomNo) {
    setError("");
    const base = gameMode === "party" ? "/api/party/rooms" : "/api/board/rooms";
    const response = await apiFetch(`${base}/${roomNo}/join`, { method: "POST" });
    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      setError(data.error || "加入房间失败");
      return;
    }

    router.push(gameMode === "party" ? `/party/${data.room.roomNo}` : `/board/${data.room.roomNo}`);
  }

  if (!meta || ![...PARTY_GAME_KEYS, ...BOARD_GAME_KEYS].includes(gameKey)) {
    return (
      <SiteLayout>
        <section className={styles.invalidState}>未找到对应的游戏入口。</section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className={`${styles.page} ${styles[`theme${capitalize(gameKey)}`]}`}>
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <div className={styles.heroBadge}>房间入口</div>
            <div className={styles.heroHeading}>
              <GameIcon gameKey={gameKey} className={styles.heroIcon} />
              <div>
                <h1>{meta.title}</h1>
                <p>{meta.description}</p>
              </div>
            </div>

            <div className={styles.statGrid}>
              <div>
                <strong>{meta.players}</strong>
                <span>建议人数</span>
              </div>
              <div>
                <strong>{gameMode === "party" ? "WebRTC" : "AI 补位"}</strong>
                <span>{gameMode === "party" ? "房内语音直连" : "单人也可开局"}</span>
              </div>
              <div>
                <strong>实时阶段</strong>
                <span>{getRealtimeCopy(gameKey)}</span>
              </div>
            </div>
          </div>

          <aside className={styles.quickPanel}>
            <h2>房号快进</h2>
            <div className={styles.quickJoin}>
                <input
                  value={joinRoomNo}
                onChange={(event) => setJoinRoomNo(event.target.value)}
                placeholder="输入 6 位房号"
              />
              <button type="button" onClick={() => joinRoom(joinRoomNo)}>
                进房
              </button>
            </div>
            <p>
              {getQuickJoinCopy(gameKey, gameMode)}
            </p>
          </aside>
        </section>

        <section className={styles.content}>
          <form className={styles.createPanel} onSubmit={createRoom}>
            <div className={styles.panelHead}>
              <div>
                <h2>创建 {meta.title} 房间</h2>
                <span>
                  {gameKey === "chinesecheckers"
                    ? "支持 2 / 4 / 6 人完整中国跳棋房"
                    : `最低 ${limits.minPlayers} 人，最高 ${limits.maxPlayers} 人`}
                </span>
              </div>
              {me ? (
                <div className={styles.meTag}>
                  <strong>{me.displayName}</strong>
                  <span>@{me.username}</span>
                </div>
              ) : (
                <div className={styles.meTag}>
                  <strong>未登录</strong>
                  <span>创建房间时会跳转登录</span>
                </div>
              )}
            </div>

            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                <span>{gameKey === "chinesecheckers" ? "房间规模" : "人数上限"}</span>
                {gameMode === "board" && boardPlayerOptions.length > 1 ? (
                  <select
                    value={form.maxPlayers || boardPlayerOptions[0]}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxPlayers: Number(event.target.value)
                      }))
                    }
                  >
                    {boardPlayerOptions.map((count) => (
                      <option key={count} value={count}>
                        {count} 人房
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min={limits.minPlayers}
                    max={limits.maxPlayers}
                    value={form.maxPlayers || limits.minPlayers}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        maxPlayers: Number(event.target.value)
                      }))
                    }
                  />
                )}
              </label>

              <label className={styles.field}>
                <span>房间类型</span>
                <select
                  value={form.visibility || "public"}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, visibility: event.target.value }))
                  }
                >
                  <option value="public">公开房</option>
                  <option value="private">私密房</option>
                </select>
              </label>

              {gameMode === "party" ? (
                gameKey === "werewolf" ? (
                <>
                  <label className={styles.field}>
                    <span>夜晚行动秒数</span>
                    <input
                      type="number"
                      min="20"
                      max="90"
                      value={form.nightSeconds || 45}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          nightSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>白天讨论秒数</span>
                    <input
                      type="number"
                      min="30"
                      max="180"
                      value={form.discussionSeconds || 70}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          discussionSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>公开投票秒数</span>
                    <input
                      type="number"
                      min="15"
                      max="90"
                      value={form.voteSeconds || 35}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          voteSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                </>
                ) : (
                <>
                  <label className={styles.field}>
                    <span>组队选人秒数</span>
                    <input
                      type="number"
                      min="20"
                      max="120"
                      value={form.teamBuildSeconds || 45}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          teamBuildSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>全员表决秒数</span>
                    <input
                      type="number"
                      min="15"
                      max="90"
                      value={form.voteSeconds || 30}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          voteSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>任务投票秒数</span>
                    <input
                      type="number"
                      min="15"
                      max="90"
                      value={form.questSeconds || 25}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          questSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>刺杀阶段秒数</span>
                    <input
                      type="number"
                      min="15"
                      max="90"
                      value={form.assassinSeconds || 30}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          assassinSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                </>
                )
              ) : (
                <label className={styles.field}>
                  <span>单回合秒数</span>
                  <input
                    type="number"
                    min="10"
                    max="90"
                    value={form.turnSeconds || 25}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        turnSeconds: Number(event.target.value)
                      }))
                    }
                  />
                </label>
              )}
            </div>

            <div className={styles.featureRow}>
              {meta.features.map((feature) => (
                <span key={feature}>{feature}</span>
              ))}
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            <button className={styles.launchButton} disabled={loading}>
              {loading ? "创建中..." : `立即开 ${meta.title} 房`}
            </button>
          </form>

          <section className={styles.roomPanel}>
            <div className={styles.panelHead}>
              <div>
                <h2>公开房间</h2>
                <span>最近 5 秒自动刷新</span>
              </div>
              <button
                type="button"
                className={styles.refreshButton}
                onClick={() => loadData(gameKey, gameMode)}
              >
                刷新
              </button>
            </div>

            <div className={styles.roomList}>
              {rooms.length === 0 ? (
                <div className={styles.emptyState}>当前没有公开房，自己开一桌会更快。</div>
              ) : (
                rooms.map((room) => (
                  <article key={room.roomNo} className={styles.roomCard}>
                    <div>
                      <strong>房号 {room.roomNo}</strong>
                      <span>
                        {room.playerCount}/{room.config.maxPlayers} 人
                      </span>
                    </div>
                    <div>
                      <span>
                        {room.state === "waiting"
                          ? "等待准备"
                          : room.phase
                            ? `阶段：${room.phase}`
                            : "进行中"}
                      </span>
                      <span>{room.config.visibility === "private" ? "私密" : "公开"}</span>
                    </div>
                    <button type="button" onClick={() => joinRoom(room.roomNo)}>
                      立即加入
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>
      </div>
    </SiteLayout>
  );
}

function capitalize(value) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : "";
}

function getRealtimeCopy(gameKey) {
  if (gameKey === "werewolf") {
    return "昼夜 / 发言 / 投票";
  }

  if (gameKey === "avalon") {
    return "组队 / 表决 / 任务 / 刺杀";
  }

  if (gameKey === "gomoku") {
    return "落子 / 判胜 / 再开一局";
  }

  return "走子 / 连跳 / 抢营地";
}

function getQuickJoinCopy(gameKey, gameMode) {
  if (gameMode === "party") {
    return gameKey === "werewolf"
      ? "建议全员先接通语音再准备开局，白天讨论阶段更顺。"
      : "组队和表决都会同步倒计时，语音连上后更适合快速推进。";
  }

  return gameKey === "gomoku"
    ? "两人都准备后立即开局；如果没人陪练，房主可在房内补 AI。"
    : "可创建 2 / 4 / 6 人完整中国跳棋房，房主可补 AI 凑满整桌后直接开局。";
}
