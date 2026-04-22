import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import SiteLayout from "../components/SiteLayout";
import { API_ROUTES, apiFetch } from "../lib/client/api";
import styles from "../styles/UtilityPages.module.css";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    displayName: "",
    password: ""
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await apiFetch(API_ROUTES.auth.register(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "註冊失敗");
      return;
    }

    router.push("/");
  }

  return (
    <SiteLayout>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}>New Player Setup</span>
            <h1>先定义你的名字，再决定你要在哪一桌赢。</h1>
            <p>
              新账号会立刻接入大厅、排行榜和房间系统。注册后你可以直接开斗地主，或者去狼人杀、阿瓦隆与棋类房间试局。
            </p>
            <div className={styles.heroStats}>
              <div>
                <strong>1</strong>
                <span>套账号覆盖全站</span>
              </div>
              <div>
                <strong>實時</strong>
                <span>房间与对局同步</span>
              </div>
              <div>
                <strong>AI</strong>
                <span>无人时也能补位</span>
              </div>
            </div>
          </div>

          <aside className={styles.heroSide}>
            <strong>注册建议</strong>
            <div className={styles.heroList}>
              <span>用戶名适合用登录识别名，尽量简洁稳定。</span>
              <span>显示名称会直接出现在房间、排行榜和日志里。</span>
              <span>邮箱便于后续保留身份，密码至少 6 位。</span>
            </div>
          </aside>
        </section>

        <section className={styles.authGrid}>
          <form className={styles.authCard} onSubmit={handleSubmit}>
            <div className={styles.authMeta}>
              <span>建立身份</span>
              <span>统一入口</span>
            </div>
            <h2>註冊帳號</h2>
            <label>
              用戶名
              <input
                value={form.username}
                onChange={(event) =>
                  setForm((current) => ({ ...current, username: event.target.value }))
                }
                placeholder="player01"
              />
            </label>
            <label>
              顯示名稱
              <input
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder="牌桌暱稱"
              />
            </label>
            <label>
              郵箱
              <input
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="you@example.com"
              />
            </label>
            <label>
              密碼
              <input
                type="password"
                value={form.password}
                onChange={(event) =>
                  setForm((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="至少 6 位"
              />
            </label>
            {error ? <p className="error-text">{error}</p> : null}
            <button className="primary-button" disabled={loading}>
              {loading ? "提交中..." : "創建帳號"}
            </button>
          </form>

          <aside className={styles.noteCard}>
            <strong>完成后可以直接做什么</strong>
            <div className={styles.noteList}>
              <span>在斗地主大厅自定底分、限时和房间可见性。</span>
              <span>进入狼人杀 / 阿瓦隆房间测试语音、阶段推进和 AI 补位。</span>
              <span>用同一账号进入五子棋与跳棋，不需要重复注册。</span>
            </div>
            <div className={styles.ctaRow}>
              <Link href="/login" className="secondary-link">
                已有帳號去登入
              </Link>
              <Link href="/" className="primary-link">
                先看遊戲庫
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </SiteLayout>
  );
}
