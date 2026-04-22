import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import SiteLayout from "../../components/SiteLayout";
import GameIcon from "../../components/game-hub/GameIcon";
import { API_ROUTES, apiFetch } from "../../lib/client/api";
import { copyText, getRoomEntryPath } from "../../lib/client/room-entry";
import styles from "../../styles/GameLobby.module.css";

const {
  PARTY_GAME_KEYS,
  BOARD_GAME_KEYS,
  getGameMeta,
  getGameMode,
  getPartyDefaultConfig,
  getPartyRolePackOptions,
  getPartyRolePackSummary,
  getBoardDefaultConfig,
  getBoardOpeningOptions,
  getBoardConfigSummary,
  getGameLimits,
  getBoardPlayerOptions
} = require("../../lib/games/catalog");

const PAUSED_NEW_ROOM_COPY = "目前不開新房，已有房號或邀請可直接加入。";

export default function GameLobbyPage() {
  const router = useRouter();
  const { gameKey } = router.query;
  const meta = useMemo(() => getGameMeta(gameKey), [gameKey]);
  const gameMode = useMemo(() => getGameMode(gameKey), [gameKey]);
  const limits = useMemo(() => getGameLimits(gameKey), [gameKey]);
  const boardPlayerOptions = useMemo(() => getBoardPlayerOptions(gameKey), [gameKey]);
  const boardOpeningOptions = useMemo(() => getBoardOpeningOptions(gameKey), [gameKey]);
  const rolePackOptions = useMemo(() => getPartyRolePackOptions(gameKey), [gameKey]);
  const [me, setMe] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [discoveryItem, setDiscoveryItem] = useState(null);
  const [joinRoomNo, setJoinRoomNo] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(() => ({
    visibility: "public"
  }));
  const selectedRolePackSummary = useMemo(
    () =>
      gameMode === "party" && gameKey !== "undercover"
        ? getPartyRolePackSummary(
            gameKey,
            Number(form.maxPlayers || limits.maxPlayers || limits.minPlayers),
            form.rolePack
          )
        : null,
    [gameKey, gameMode, form.maxPlayers, form.rolePack, limits.maxPlayers, limits.minPlayers]
  );
  const selectedBoardSummary = useMemo(
    () => (gameMode === "board" ? getBoardConfigSummary(gameKey, form) : []),
    [form, gameKey, gameMode]
  );

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
    const [meResponse, roomsResponse, hubResponse] = await Promise.all([
      apiFetch(API_ROUTES.me()),
      apiFetch(getRoomsRoute(activeMode, activeGameKey)),
      apiFetch(API_ROUTES.hub())
    ]);

    const [meData, roomsData, hubData] = await Promise.all([
      meResponse.json(),
      roomsResponse.json(),
      hubResponse.json()
    ]);
    setMe(meData.user || null);
    setRooms(roomsData.items || []);
    setDiscoveryItem(findDiscoveryItem(hubData, activeGameKey));
  }

  async function createRoom(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    if (isPaused) {
      setLoading(false);
      setError(PAUSED_NEW_ROOM_COPY);
      return;
    }

    const response = await apiFetch(getRoomsRoute(gameMode, gameKey), {
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
        router.push(`/login?returnTo=${encodeURIComponent(`/games/${gameKey}`)}`);
        return;
      }
      setError(data.error || "创建房间失败");
      return;
    }

    router.push(
      getRoomDetailRoute(
        meta,
        data.room.roomNo,
        gameMode === "party" ? "/party" : "/board"
      )
    );
  }

  function joinRoom(roomNo) {
    const normalizedRoomNo = String(roomNo || "").trim();
    if (!normalizedRoomNo) {
      setError("先輸入六位房號，再走統一入口。");
      setNotice("");
      return;
    }

    setError("");
    setNotice("");
    router.push(getRoomEntryPath(gameKey, normalizedRoomNo));
  }

  async function copyInvite(roomNo) {
    const normalizedRoomNo = String(roomNo || "").trim();
    if (!normalizedRoomNo) {
      setError("先輸入或選一個房號，再複製邀請。");
      setNotice("");
      return;
    }

    try {
      const invitePath = getRoomEntryPath(gameKey, normalizedRoomNo);
      await copyText(invitePath);
      setError("");
      setNotice(`已複製邀請 ${invitePath}`);
    } catch {
      setError("複製邀請失敗");
      setNotice("");
    }
  }

  if (!meta || ![...PARTY_GAME_KEYS, ...BOARD_GAME_KEYS].includes(gameKey)) {
    return (
      <SiteLayout>
        <section className={styles.invalidState}>未找到对应的游戏入口。</section>
      </SiteLayout>
    );
  }

  const isPaused = discoveryItem?.state === "paused-new-rooms";

  return (
    <SiteLayout>
      <div className={`${styles.page} ${styles[`theme${capitalize(gameKey)}`]}`}>
        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <div className={styles.heroBadge}>房间入口</div>
            <div className={styles.heroTopRow}>
              <Link href="/" className="ghost-button">
                返回遊戲家族
              </Link>
              <span className={styles.heroState}>{discoveryItem?.stateLabel || "可立即遊玩"}</span>
            </div>
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
                onChange={(event) =>
                  setJoinRoomNo(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="输入 6 位房号"
              />
              <button type="button" onClick={() => joinRoom(joinRoomNo)}>
                进房
              </button>
            </div>
            <div className={styles.quickActions}>
              <button type="button" className={styles.refreshButton} onClick={() => copyInvite(joinRoomNo)}>
                複製邀請
              </button>
              <Link href="/" className={styles.backLink}>
                返回遊戲家族
              </Link>
            </div>
            <p>
              {getQuickJoinCopy(gameKey, gameMode)}
            </p>
            {notice ? <p className={styles.noticeMessage}>{notice}</p> : null}
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

            {isPaused ? (
              <div className={styles.pauseBanner}>
                <strong>暫停新房</strong>
                <span>{PAUSED_NEW_ROOM_COPY}</span>
              </div>
            ) : null}

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

              {gameMode === "party" && gameKey !== "undercover" ? (
                <label className={styles.field}>
                  <span>角色預設</span>
                  <select
                    value={form.rolePack || rolePackOptions[0]?.key || ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, rolePack: event.target.value }))
                    }
                  >
                    {rolePackOptions.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

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
                  <label className={styles.field}>
                    <span>猎人反击秒数</span>
                    <input
                      type="number"
                      min="10"
                      max="45"
                      value={form.hunterSeconds || 20}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          hunterSeconds: Number(event.target.value)
                        }))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span>房内沟通</span>
                    <select
                      value={form.voiceEnabled === false ? "text" : "voice"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          voiceEnabled: event.target.value !== "text"
                        }))
                      }
                    >
                      <option value="voice">语音房</option>
                      <option value="text">文字房</option>
                    </select>
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
                  <label className={styles.field}>
                    <span>房内沟通</span>
                    <select
                      value={form.voiceEnabled === false ? "text" : "voice"}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          voiceEnabled: event.target.value !== "text"
                        }))
                      }
                    >
                      <option value="voice">语音房</option>
                      <option value="text">文字房</option>
                    </select>
                  </label>
                </>
                )
              ) : (
                <>
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
                  {gameKey === "gomoku" && boardOpeningOptions.length > 0 ? (
                    <label className={styles.field}>
                      <span>开局规则</span>
                      <select
                        value={form.openingRule || boardOpeningOptions[0].key}
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            openingRule: event.target.value
                          }))
                        }
                      >
                        {boardOpeningOptions.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                </>
              )}
            </div>

            <div className={styles.featureRow}>
              {meta.features.map((feature) => (
                <span key={feature}>{feature}</span>
              ))}
            </div>

            {selectedRolePackSummary ? (
              <div className={styles.featureRow} data-party-role-pack="selected">
                <span>{selectedRolePackSummary.label}</span>
                <span>{selectedRolePackSummary.description}</span>
                {selectedRolePackSummary.roles.map((item) => (
                  <span key={`${selectedRolePackSummary.key}-${item.key}`}>
                    {item.label}
                    {item.count > 1 ? ` x${item.count}` : ""}
                  </span>
                ))}
                {gameKey === "werewolf" ? (
                  <span>猎人反击 {Number(form.hunterSeconds || 20)}s</span>
                ) : null}
                <span>{form.voiceEnabled === false ? "文字房" : "语音房"}</span>
              </div>
            ) : null}
            {gameMode === "board" && selectedBoardSummary.length > 0 ? (
              <div className={styles.featureRow} data-board-config="selected">
                {selectedBoardSummary.map((item) => (
                  <span key={`${gameKey}-${item}`}>{item}</span>
                ))}
              </div>
            ) : null}

            {error ? <p className="error-text">{error}</p> : null}
            {!isPaused ? (
              <button className={styles.launchButton} disabled={loading}>
                {loading ? "创建中..." : `立即开 ${meta.title} 房`}
              </button>
            ) : null}
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
                    {gameMode === "party" && room.gameKey !== "undercover" ? (
                      <div className={styles.featureRow}>
                        {getPartyConfigSummary(room.gameKey, room.config).map((item) => (
                          <span key={`${room.roomNo}-${item}`}>{item}</span>
                        ))}
                      </div>
                    ) : gameMode === "board" ? (
                      <div className={styles.featureRow} data-board-config="room">
                        {getBoardConfigSummary(room.gameKey, room.config).map((item) => (
                          <span key={`${room.roomNo}-${item}`}>{item}</span>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.roomCardActions}>
                      <button type="button" className={styles.refreshButton} onClick={() => copyInvite(room.roomNo)}>
                        複製邀請
                      </button>
                      <button type="button" onClick={() => joinRoom(room.roomNo)}>
                        立即加入
                      </button>
                    </div>
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

function findDiscoveryItem(hubData, gameKey) {
  for (const family of hubData?.families || []) {
    const matched = (family.items || []).find((item) => item.gameKey === gameKey);
    if (matched) {
      return matched;
    }
  }

  return null;
}

function getRoomsRoute(gameMode, gameKey) {
  return gameMode === "party"
    ? API_ROUTES.partyRooms.list(gameKey)
    : API_ROUTES.boardRooms.list(gameKey);
}

function getRealtimeCopy(gameKey) {
  if (gameKey === "werewolf") {
    return "昼夜 / 发言 / 投票";
  }

  if (gameKey === "avalon") {
    return "组队 / 表决 / 任务 / 刺杀";
  }

  if (gameKey === "reversi") {
    return "落子 / 翻面 / 强制过手";
  }

  if (gameKey === "undercover") {
    return "描述 / 投票 / 揭晓";
  }

  if (gameKey === "gomoku") {
    return "落子 / 判胜 / 再开一局";
  }

  return "走子 / 连跳 / 抢营地";
}

function getPartyConfigSummary(gameKey, config = {}) {
  const summary = getPartyRolePackSummary(
    gameKey,
    Number(config.maxPlayers || 0),
    config.rolePack
  );

  return [
    summary.label,
    ...summary.roles.map((item) => `${item.label}${item.count > 1 ? ` x${item.count}` : ""}`),
    gameKey === "werewolf" ? `猎人反击 ${Number(config.hunterSeconds || 20)}s` : null,
    config.voiceEnabled === false ? "文字房" : "语音房"
  ].filter(Boolean);
}

function getQuickJoinCopy(gameKey, gameMode) {
  if (gameMode === "party") {
    if (gameKey === "undercover") {
      return "準備後即可進入描述與投票輪次；私密房仍可直接用邀請連結帶遊客進場。";
    }

    return gameKey === "werewolf"
      ? "建议全员先接通语音再准备开局，白天讨论阶段更顺。"
      : "组队和表决都会同步倒计时，语音连上后更适合快速推进。";
  }

  if (gameKey === "reversi") {
    return "黑棋先手；若下一手無合法落點，系統會自動過手並保持邀請路徑不變。";
  }

  return gameKey === "gomoku"
    ? "两人都准备后立即开局；如果没人陪练，房主可在房内补 AI。"
    : "可创建 2 / 4 / 6 人完整中国跳棋房，房主可补 AI 凑满整桌后直接开局。";
}

function getRoomDetailRoute(meta, roomNo, fallbackPrefix) {
  const prefix = meta?.detailRoutePrefix || fallbackPrefix;
  return `${prefix}/${roomNo}`.replace(/\/+/g, "/");
}
