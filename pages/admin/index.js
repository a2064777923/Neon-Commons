import { useEffect, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import { apiFetch } from "../../lib/client/api";
import styles from "../../styles/UtilityPages.module.css";

export default function AdminPage() {
  const [me, setMe] = useState(null);
  const [players, setPlayers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [error, setError] = useState("");
  const [templateDraft, setTemplateDraft] = useState("");
  const [configDraft, setConfigDraft] = useState("");

  async function loadData() {
    const [meResponse, playersResponse, templatesResponse, configsResponse] =
      await Promise.all([
        apiFetch("/api/me"),
        apiFetch("/api/admin/players"),
        apiFetch("/api/admin/templates"),
        apiFetch("/api/admin/config")
      ]);

    const [meData, playersData, templatesData, configsData] = await Promise.all([
      meResponse.json(),
      playersResponse.json(),
      templatesResponse.json(),
      configsResponse.json()
    ]);

    if (!meData.user || meData.user.role !== "admin") {
      setError("需要管理員權限");
      return;
    }

    setMe(meData.user);
    setPlayers(playersData.items || []);
    setTemplates(templatesData.items || []);
    setConfigs(configsData.items || []);
  }

  useEffect(() => {
    loadData().catch(() => setError("後台資料載入失敗"));
  }, []);

  async function adjustPlayer(playerId, coinsDelta, rankDelta, status) {
    const response = await apiFetch(`/api/admin/players/${playerId}/adjust`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        coinsDelta,
        rankDelta,
        status,
        reason: "管理後台調整"
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "調整失敗");
      return;
    }

    await loadData();
  }

  async function updateTemplate() {
    try {
      const payload = JSON.parse(templateDraft);
      const response = await apiFetch("/api/admin/templates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "模板更新失敗");
        return;
      }
      setTemplateDraft("");
      await loadData();
    } catch (parseError) {
      setError("模板 JSON 格式錯誤");
    }
  }

  async function updateConfig() {
    try {
      const payload = JSON.parse(configDraft);
      const response = await apiFetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "配置更新失敗");
        return;
      }
      setConfigDraft("");
      await loadData();
    } catch (parseError) {
      setError("配置 JSON 格式錯誤");
    }
  }

  return (
    <SiteLayout>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}>Admin Console</span>
            <h1>把玩家、模板和系统参数放进一张控制台里。</h1>
            <p>
              当前管理员：{me?.displayName || "讀取中"}。这里统一管理账户状态、游戏模板和系统级配置，不再是松散的信息堆。
            </p>
            <div className={styles.heroStats}>
              <div>
                <strong>{players.length}</strong>
                <span>玩家账户</span>
              </div>
              <div>
                <strong>{templates.length}</strong>
                <span>规则模板</span>
              </div>
              <div>
                <strong>{configs.length}</strong>
                <span>系统配置项</span>
              </div>
            </div>
            {error ? <p className="error-text">{error}</p> : null}
          </div>

          <aside className={styles.heroSide}>
            <strong>当前侧重点</strong>
            <div className={styles.heroList}>
              <span>快速修正账户分数与封禁状态。</span>
              <span>直接更新模板，影响大厅和建房默认值。</span>
              <span>系统参数会作用到整站运行规则。</span>
            </div>
          </aside>
        </section>

        <div className={styles.adminGrid}>
          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>玩家管理</h2>
                <span>快捷加豆、加分与状态切换</span>
              </div>
            </div>
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>玩家</th>
                    <th>狀態</th>
                    <th>虛擬豆</th>
                    <th>段位分</th>
                    <th>對局</th>
                    <th>快捷操作</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.id}>
                      <td>
                        {player.displayName}
                        <br />
                        <span className="muted">@{player.username}</span>
                      </td>
                      <td>{player.status}</td>
                      <td>{player.coins}</td>
                      <td>{player.rankScore}</td>
                      <td>
                        {player.wins}/{player.losses}
                      </td>
                      <td>
                        <div className="button-cluster">
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => adjustPlayer(player.id, 500, 0, null)}
                          >
                            +500 豆
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() => adjustPlayer(player.id, 0, 20, null)}
                          >
                            +20 分
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            onClick={() =>
                              adjustPlayer(
                                player.id,
                                0,
                                0,
                                player.status === "active" ? "blocked" : "active"
                              )
                            }
                          >
                            {player.status === "active" ? "封禁" : "解封"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>规则模板</h2>
                <span>大厅默认值与牌局参数入口</span>
              </div>
            </div>
            <div className="template-list">
              {templates.map((template) => (
                <div key={template.id} className="template-item">
                  <strong>
                    #{template.id} {template.title}
                  </strong>
                  <span>
                    {template.mode} / {template.isActive ? "已上線" : "未上線"}
                  </span>
                  <pre>{JSON.stringify(template.settings, null, 2)}</pre>
                </div>
              ))}
            </div>
            <textarea
              value={templateDraft}
              onChange={(event) => setTemplateDraft(event.target.value)}
              placeholder='{"id":1,"isActive":true,"settings":{"baseScore":2,"autoTrusteeSeconds":18}}'
            />
            <button className="primary-button" type="button" onClick={updateTemplate}>
              更新模板
            </button>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>系统配置</h2>
                <span>影响整站的全局参数</span>
              </div>
            </div>
            <div className="template-list">
              {configs.map((item) => (
                <div key={item.key} className="template-item">
                  <strong>{item.key}</strong>
                  <pre>{JSON.stringify(item.value, null, 2)}</pre>
                </div>
              ))}
            </div>
            <textarea
              value={configDraft}
              onChange={(event) => setConfigDraft(event.target.value)}
              placeholder='{"key":"maxOpenRoomsPerUser","value":5}'
            />
            <button className="primary-button" type="button" onClick={updateConfig}>
              更新配置
            </button>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>运行摘要</h2>
                <span>给后台一个更快的整体视图</span>
              </div>
            </div>
            <div className={styles.metricStrip}>
              <div>
                <strong>{players.filter((player) => player.status === "active").length}</strong>
                <span>活跃账号</span>
              </div>
              <div>
                <strong>{players.filter((player) => player.status !== "active").length}</strong>
                <span>受限账号</span>
              </div>
              <div>
                <strong>{templates.filter((template) => template.isActive).length}</strong>
                <span>在线模板</span>
              </div>
            </div>
            <div className={styles.noteList}>
              <span>玩家调整会即时反映到排行榜与大厅数据。</span>
              <span>模板更新后，新建房间会直接读取最新默认值。</span>
              <span>系统配置更适合低频修改，先确认 JSON 再提交。</span>
            </div>
          </section>
        </div>
      </div>
    </SiteLayout>
  );
}
