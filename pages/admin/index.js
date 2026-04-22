import { useEffect, useState } from "react";
import SiteLayout from "../../components/SiteLayout";
import { API_ROUTES, apiFetch } from "../../lib/client/api";
import styles from "../../styles/UtilityPages.module.css";

const CAPABILITY_UPDATE_REASON = "管理控制台切換";
const RUNTIME_UPDATE_REASON = "管理控制台調整";
const PLAYER_UPDATE_REASON = "管理後台調整";
const TRACE_BADGES = {
  "new-rooms-only": "新房生效",
  "immediate-player-state": "即時生效"
};
const ACTION_LABELS = {
  "adjust-player": "玩家調整",
  "update-capabilities": "遊戲開關",
  "update-runtime": "運行配置",
  "update-template": "模板更新",
  "update-config": "系統配置"
};

export default function AdminPage() {
  const [me, setMe] = useState(null);
  const [players, setPlayers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [templateModes, setTemplateModes] = useState([]);
  const [configs, setConfigs] = useState([]);
  const [capabilityFamilies, setCapabilityFamilies] = useState([]);
  const [runtimeControls, setRuntimeControls] = useState([]);
  const [auditItems, setAuditItems] = useState([]);
  const [error, setError] = useState("");
  const [templateDraft, setTemplateDraft] = useState("");
  const [configDraft, setConfigDraft] = useState("");
  const [runtimeDraft, setRuntimeDraft] = useState({
    maxOpenRoomsPerUser: "",
    maintenanceMode: false
  });
  const [savingKey, setSavingKey] = useState("");

  async function loadData() {
    const responses = await Promise.all([
      apiFetch(API_ROUTES.me()),
      apiFetch(API_ROUTES.admin.players()),
      apiFetch(API_ROUTES.admin.templates()),
      apiFetch(API_ROUTES.admin.config()),
      apiFetch(API_ROUTES.admin.capabilities()),
      apiFetch(API_ROUTES.admin.runtime()),
      apiFetch(API_ROUTES.admin.logs())
    ]);

    const payloads = await Promise.all(
      responses.map(async (response) => {
        try {
          return await response.json();
        } catch {
          return {};
        }
      })
    );

    const [
      meResponse,
      playersResponse,
      templatesResponse,
      configsResponse,
      capabilitiesResponse,
      runtimeResponse,
      logsResponse
    ] = responses;
    const [meData, playersData, templatesData, configsData, capabilitiesData, runtimeData, logsData] =
      payloads;

    if (!meResponse.ok || !meData.user || meData.user.role !== "admin") {
      setError(meData.error || "需要管理員權限");
      return;
    }

    const failed = [
      [playersResponse, playersData],
      [templatesResponse, templatesData],
      [configsResponse, configsData],
      [capabilitiesResponse, capabilitiesData],
      [runtimeResponse, runtimeData],
      [logsResponse, logsData]
    ].find(([response]) => !response.ok);

    if (failed) {
      setError(failed[1]?.error || "後台資料載入失敗");
      return;
    }

    setError("");
    setMe(meData.user);
    setPlayers(playersData.items || []);
    setTemplates(templatesData.items || []);
    setTemplateModes(templatesData.supportedModes || []);
    setConfigs(configsData.items || []);
    setCapabilityFamilies(capabilitiesData.families || []);
    setRuntimeControls(runtimeData.controls || []);
    setRuntimeDraft(normalizeRuntimeDraft(runtimeData.controls || []));
    setAuditItems(logsData.items || []);
  }

  useEffect(() => {
    loadData().catch(() => setError("後台資料載入失敗"));
  }, []);

  async function adjustPlayer(playerId, coinsDelta, rankDelta, status) {
    setSavingKey(`player:${playerId}:${coinsDelta}:${rankDelta}:${status || "keep"}`);

    try {
      const response = await apiFetch(API_ROUTES.admin.playerAdjust(playerId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coinsDelta,
          rankDelta,
          status,
          reason: PLAYER_UPDATE_REASON
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "調整失敗");
        return;
      }

      await loadData();
    } finally {
      setSavingKey("");
    }
  }

  async function toggleCapability(item) {
    setSavingKey(`capability:${item.gameKey}`);

    try {
      const response = await apiFetch(API_ROUTES.admin.capabilities(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            {
              gameKey: item.gameKey,
              enabled: !item.enabled,
              reason: CAPABILITY_UPDATE_REASON
            }
          ]
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "遊戲開關更新失敗");
        return;
      }

      setCapabilityFamilies(data.families || []);
      await loadData();
    } finally {
      setSavingKey("");
    }
  }

  async function saveRuntimeControl(key, value) {
    setSavingKey(`runtime:${key}`);

    try {
      const response = await apiFetch(API_ROUTES.admin.runtime(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: [
            {
              key,
              value,
              reason: RUNTIME_UPDATE_REASON
            }
          ]
        })
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "運行配置更新失敗");
        return;
      }

      setRuntimeControls(data.controls || []);
      setRuntimeDraft(normalizeRuntimeDraft(data.controls || []));
      await loadData();
    } finally {
      setSavingKey("");
    }
  }

  async function updateTemplate() {
    try {
      const payload = JSON.parse(templateDraft);
      const response = await apiFetch(API_ROUTES.admin.templates(), {
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
    } catch {
      setError("模板 JSON 格式錯誤");
    }
  }

  async function updateConfig() {
    try {
      const payload = JSON.parse(configDraft);
      const response = await apiFetch(API_ROUTES.admin.config(), {
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
    } catch {
      setError("配置 JSON 格式錯誤");
    }
  }

  const totalManagedGames = capabilityFamilies.reduce(
    (total, family) => total + (family.items?.length || 0),
    0
  );
  const capabilityLabels = Object.fromEntries(
    capabilityFamilies.flatMap((family) =>
      (family.items || []).map((item) => [item.gameKey, item.title])
    )
  );
  const livePlayerCount = players.filter((player) => player.status === "active").length;
  const maintenanceMode = Boolean(getRuntimeValue(runtimeControls, "maintenanceMode", false));

  return (
    <SiteLayout>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}>Admin Console</span>
            <h1>把跨遊戲開關、運行控管和玩家操作收進同一張控制台。</h1>
            <p>
              當前管理員：{me?.displayName || "讀取中"}。這一版後台先把跨遊戲能力開關做成主流程，
              保留玩家快捷操作，同時把留痕壓到輕量但可追。
            </p>
            <div className={styles.heroStats}>
              <div>
                <strong>{livePlayerCount}</strong>
                <span>活躍帳號</span>
              </div>
              <div>
                <strong>{totalManagedGames}</strong>
                <span>受控遊戲</span>
              </div>
              <div>
                <strong>{auditItems.length}</strong>
                <span>最近留痕</span>
              </div>
            </div>
            {error ? <p className="error-text">{error}</p> : null}
          </div>

          <aside className={styles.heroSide}>
            <strong>控制要點</strong>
            <div className={styles.heroList}>
              <span>按遊戲家族分組，先做跨遊戲開關，再保留深度入口。</span>
              <span>能力與運行配置都標記為只影响新房，現有房間不會被原地改寫。</span>
              <span>玩家加豆、加分與封禁仍然放在第一屏，不被藏進二級流程。</span>
            </div>
          </aside>
        </section>

        <div className={styles.adminGrid}>
          <section className={`${styles.panel} ${styles.panelSpan}`}>
            <div className={styles.panelHead}>
              <div>
                <h2>遊戲家族</h2>
                <span>跨遊戲開關先決，所有能力變更只作用於新房</span>
              </div>
              <strong>現有房間不改寫</strong>
            </div>
            <p className={styles.summaryCopy}>
              只影响新房。已經建立的房間照原設定繼續跑，後台只阻擋之後的新建入口。
            </p>

            <div className={styles.controlGrid}>
              {capabilityFamilies.map((family) => (
                <article
                  key={family.key}
                  className={styles.controlFamily}
                  data-admin-family={family.key}
                >
                  <div className={styles.familyHead}>
                    <h3>{family.label}</h3>
                    <p>{family.items?.length || 0} 個入口納入同一組開關管理</p>
                  </div>

                  <div className={styles.toggleStack}>
                    {(family.items || []).map((item) => (
                      <div
                        key={item.gameKey}
                        className={styles.toggleRow}
                        data-game-key={item.gameKey}
                      >
                        <div className={styles.toggleMeta}>
                          <strong>{item.title}</strong>
                          <span>{item.strapline || "使用統一入口進房與建房"}</span>
                          <div className={styles.scopeRow}>
                            <span className={styles.scopeChip}>只影响新房</span>
                            <span>{item.enabled ? "目前允許新建房間" : "目前暫停新建房間"}</span>
                          </div>
                        </div>

                        <button
                          className={item.enabled ? "ghost-button" : "primary-button"}
                          type="button"
                          aria-label={`${item.title}${item.enabled ? "停用新房" : "重新開放"}`}
                          disabled={savingKey === `capability:${item.gameKey}`}
                          onClick={() => toggleCapability(item)}
                        >
                          {savingKey === `capability:${item.gameKey}`
                            ? "提交中..."
                            : item.enabled
                              ? "停用新房"
                              : "重新開放"}
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>玩家管理</h2>
                <span>快捷加豆、加分與狀態切換保留在主畫面</span>
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
                            disabled={savingKey === `player:${player.id}:500:0:keep`}
                            onClick={() => adjustPlayer(player.id, 500, 0, null)}
                          >
                            +500 豆
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={savingKey === `player:${player.id}:0:20:keep`}
                            onClick={() => adjustPlayer(player.id, 0, 20, null)}
                          >
                            +20 分
                          </button>
                          <button
                            className="ghost-button"
                            type="button"
                            disabled={
                              savingKey ===
                              `player:${player.id}:0:0:${
                                player.status === "active" ? "blocked" : "active"
                              }`
                            }
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
                <h2>運行控管</h2>
                <span>用顯式控制取代手寫 JSON</span>
              </div>
              <strong>{maintenanceMode ? "維護中" : "正常開放"}</strong>
            </div>

            <div className={styles.runtimeControl}>
              <div className={styles.runtimeMeta}>
                <strong>每位玩家同時開房上限</strong>
                <span className={styles.runtimeCode}>maxOpenRoomsPerUser</span>
                <p>只影响新房，新的建房請求會讀取這個值。</p>
              </div>
              <div className={styles.runtimeAction}>
                <input
                  aria-label="maxOpenRoomsPerUser"
                  className={styles.runtimeInput}
                  type="number"
                  min="1"
                  value={runtimeDraft.maxOpenRoomsPerUser}
                  onChange={(event) =>
                    setRuntimeDraft((current) => ({
                      ...current,
                      maxOpenRoomsPerUser: event.target.value
                    }))
                  }
                />
                <button
                  className="primary-button"
                  type="button"
                  disabled={savingKey === "runtime:maxOpenRoomsPerUser"}
                  onClick={() =>
                    saveRuntimeControl(
                      "maxOpenRoomsPerUser",
                      Number(runtimeDraft.maxOpenRoomsPerUser)
                    )
                  }
                >
                  {savingKey === "runtime:maxOpenRoomsPerUser" ? "提交中..." : "保存"}
                </button>
              </div>
            </div>

            <div className={styles.runtimeControl}>
              <div className={styles.runtimeMeta}>
                <strong>維護模式</strong>
                <span className={styles.runtimeCode}>maintenanceMode</span>
                <p>開啟後直接阻擋全部新房建立，現有房間照常存在。</p>
              </div>
              <div className={styles.runtimeAction}>
                <span className={styles.scopeChip}>{maintenanceMode ? "維護模式已開" : "維護模式已關"}</span>
                <button
                  className={maintenanceMode ? "ghost-button" : "primary-button"}
                  type="button"
                  disabled={savingKey === "runtime:maintenanceMode"}
                  onClick={() =>
                    saveRuntimeControl("maintenanceMode", !runtimeDraft.maintenanceMode)
                  }
                >
                  {savingKey === "runtime:maintenanceMode"
                    ? "提交中..."
                    : maintenanceMode
                      ? "解除維護"
                      : "啟用維護"}
                </button>
              </div>
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>最近變更</h2>
                <span>輕量留痕，只看最近 50 筆，不做回滾工作流</span>
              </div>
            </div>

            <ul className={styles.auditFeed} data-audit-feed="true">
              {auditItems.length === 0 ? (
                <li className={styles.auditRow}>目前還沒有可顯示的後台留痕。</li>
              ) : (
                auditItems.map((item) => {
                  const badge = TRACE_BADGES[item.detail?.appliesTo] || "";

                  return (
                    <li key={item.id} className={styles.auditRow} data-audit-row={item.id}>
                      <div className={styles.auditRowHead}>
                        <div className={styles.auditSummary}>
                          <strong>{ACTION_LABELS[item.action] || item.action}</strong>
                          <span>{formatAuditTarget(item, capabilityLabels)}</span>
                        </div>
                        <div className={styles.auditMeta}>
                          <span>{formatAuditOperator(item)}</span>
                          <time dateTime={item.createdAt}>{formatTimestamp(item.createdAt)}</time>
                          {badge ? (
                            <span className={styles.traceBadge} data-trace-badge={badge}>
                              {badge}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <p className={styles.auditReason}>
                        {item.detail?.reason || "未填寫原因"}
                      </p>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <div>
                <h2>進階入口</h2>
                <span>模板與系統配置保留為次要工作流，不再佔主視覺</span>
              </div>
            </div>

            <details className={styles.advancedDetails}>
              <summary className={styles.advancedSummary}>模板編輯器</summary>
              <div className={styles.advancedBody}>
                <p className={styles.summaryCopy} data-template-support-note="true">
                  支持上線模式：{templateModes.join(" / ") || "CLASSIC / ROB / NO_SHUFFLE"}。`LAIZI`
                  目前只可保留為未上線模板，不能啟用或拿來開房。
                </p>
                <div className={styles.heroList}>
                  <span>
                    建議只編輯已接通字段：`baseScore`、`maxRobMultiplier`、`bidOptions`、`countdownSeconds`、
                    托管窗口、炸彈 / 王炸 / 春天開關與倍率、`roomVisibility`。
                  </span>
                  <span>玩家建房、公開模板列表與牌桌 runtime 都走同一套規則正規化。</span>
                </div>
                <div className="template-list">
                  {templates.map((template) => (
                    <div key={template.id} className="template-item" data-admin-template={template.name}>
                      <strong>
                        #{template.id} {template.title}
                      </strong>
                      <span>
                        {template.mode} / {template.isActive ? "已上線" : "未上線"}
                      </span>
                      <span>
                        {template.modeSupported
                          ? getTemplateRuleSummary(template.settings).join(" · ")
                          : template.unsupportedReason}
                      </span>
                      <pre>{JSON.stringify(template.settings, null, 2)}</pre>
                    </div>
                  ))}
                </div>
                <textarea
                  value={templateDraft}
                  onChange={(event) => setTemplateDraft(event.target.value)}
                  placeholder="貼上模板更新 JSON"
                />
                <button className="primary-button" type="button" onClick={updateTemplate}>
                  更新模板
                </button>
              </div>
            </details>

            <details className={styles.advancedDetails}>
              <summary className={styles.advancedSummary}>系統配置編輯器</summary>
              <div className={styles.advancedBody}>
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
                  placeholder="貼上配置更新 JSON"
                />
                <button className="primary-button" type="button" onClick={updateConfig}>
                  更新配置
                </button>
              </div>
            </details>
          </section>
        </div>
      </div>
    </SiteLayout>
  );
}

function normalizeRuntimeDraft(controls) {
  return {
    maxOpenRoomsPerUser: String(getRuntimeValue(controls, "maxOpenRoomsPerUser", 3)),
    maintenanceMode: Boolean(getRuntimeValue(controls, "maintenanceMode", false))
  };
}

function getRuntimeValue(controls, key, fallbackValue) {
  const match = controls.find((item) => item.key === key);
  return match ? match.value : fallbackValue;
}

function formatAuditOperator(item) {
  return item.operator?.displayName || item.operator?.username || "系統";
}

function formatAuditTarget(item, capabilityLabels = {}) {
  if (item.targetUser?.displayName || item.targetUser?.username) {
    return item.targetUser.displayName || `@${item.targetUser.username}`;
  }

  const targets = Array.isArray(item.detail?.target) ? item.detail.target : [];
  if (targets.length > 0) {
    return targets
      .map((target) => capabilityLabels[target] || target)
      .join(" / ");
  }

  return item.detail?.scope || "系統操作";
}

function getTemplateRuleSummary(settings) {
  const autoMin = Number(settings?.autoTrusteeMinSeconds || 2);
  const autoMax = Number(settings?.autoTrusteeMaxSeconds || settings?.autoTrusteeSeconds || 5);

  return [
    `${settings?.baseScore || 0} 底分`,
    `叫分至 ${Number(settings?.maxRobMultiplier || 3)}`,
    `${settings?.countdownSeconds || 0}s 出牌`,
    `托管 ${autoMin}-${autoMax}s`,
    settings?.allowBomb === false ? "禁炸彈" : `炸彈 x${Number(settings?.bombMultiplier || 2)}`,
    settings?.allowRocket === false ? "禁王炸" : `王炸 x${Number(settings?.rocketMultiplier || 2)}`,
    settings?.allowSpring === false ? "春天關閉" : `春天 x${Number(settings?.springMultiplier || 2)}`,
    settings?.roomVisibility === "private" ? "私密桌" : "公開桌"
  ];
}

function formatTimestamp(value) {
  if (!value) {
    return "";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toLocaleString("zh-Hant-MO", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}
