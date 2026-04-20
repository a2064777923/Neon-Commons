import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import SiteLayout from "../components/SiteLayout";
import { apiFetch } from "../lib/client/api";
import styles from "../styles/UtilityPages.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ account: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const response = await apiFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });
    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "登入失敗");
      return;
    }

    router.push("/");
  }

  return (
    <SiteLayout>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.heroBadge}>Account Access</span>
            <h1>回到牌桌之前，先把身份接上。</h1>
            <p>
              登录后可直接创建房间、加入现有牌局、同步排行榜和后台权限。整个入口现在统一到同一套账户体系里。
            </p>
            <div className={styles.heroStats}>
              <div>
                <strong>5</strong>
                <span>已接入游戏</span>
              </div>
              <div>
                <strong>实时</strong>
                <span>房间与阶段同步</span>
              </div>
              <div>
                <strong>3100</strong>
                <span>当前站点入口</span>
              </div>
            </div>
          </div>

          <aside className={styles.heroSide}>
            <strong>登录后会解锁</strong>
            <div className={styles.heroList}>
              <span>斗地主大厅、开桌和房号进房</span>
              <span>狼人杀 / 阿瓦隆语音与实时房间</span>
              <span>五子棋 / 跳棋对弈记录与排行榜</span>
            </div>
          </aside>
        </section>

        <section className={styles.authGrid}>
          <form className={styles.authCard} onSubmit={handleSubmit}>
            <div className={styles.authMeta}>
              <span>统一账号</span>
              <span>实时状态</span>
            </div>
            <h2>登入帳號</h2>
            <label>
              帳號或郵箱
              <input
                value={form.account}
                onChange={(event) =>
                  setForm((current) => ({ ...current, account: event.target.value }))
                }
                placeholder="admin 或 your@email.com"
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
                placeholder="請輸入密碼"
              />
            </label>
            {error ? <p className="error-text">{error}</p> : null}
            <button className="primary-button" disabled={loading}>
              {loading ? "登入中..." : "登入"}
            </button>
          </form>

          <aside className={styles.noteCard}>
            <strong>还没有账号</strong>
            <div className={styles.noteList}>
              <span>注册后即可拥有独立昵称、胜负记录和段位分。</span>
              <span>管理员账号登录后会自动显示后台入口。</span>
              <span>若只是测试流程，可先用既有管理员账户登录。</span>
            </div>
            <div className={styles.ctaRow}>
              <Link href="/register" className="primary-link">
                去註冊
              </Link>
              <Link href="/" className="secondary-link">
                返回遊戲庫
              </Link>
            </div>
          </aside>
        </section>
      </div>
    </SiteLayout>
  );
}
