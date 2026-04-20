import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { apiFetch } from "../lib/client/api";

const BRAND_SIGNALS = ["NEON TABLES", "COIN LADDER", "VOICE ROOMS"];

export default function SiteLayout({ children, immersive = false, className = "" }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const currentPath = router.asPath.split("?")[0];

  const navItems = [
    { href: "/", label: "夜局大厅", match: ["/"] },
    { href: "/lobby", label: "斗地主", match: ["/lobby"] },
    { href: "/games/werewolf", label: "狼人杀", match: ["/games/werewolf"] },
    { href: "/games/avalon", label: "阿瓦隆", match: ["/games/avalon"] },
    { href: "/games/gomoku", label: "五子棋", match: ["/games/gomoku"] },
    { href: "/games/chinesecheckers", label: "跳棋", match: ["/games/chinesecheckers"] },
    { href: "/leaderboard", label: "金币榜", match: ["/leaderboard"] }
  ];

  useEffect(() => {
    loadSession(setUser);
  }, [router.pathname]);

  useEffect(() => {
    function handleSessionUpdate(event) {
      setUser(event.detail || null);
    }

    window.addEventListener("session:user-updated", handleSessionUpdate);
    return () => window.removeEventListener("session:user-updated", handleSessionUpdate);
  }, []);

  async function handleLogout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("session:user-updated", { detail: null }));
    }
    router.push("/login");
  }

  function isActivePath(matchers) {
    return matchers.some((path) => {
      if (path === "/") {
        return currentPath === "/";
      }
      return currentPath === path || currentPath.startsWith(`${path}/`);
    });
  }

  const fullNavItems = [
    ...navItems,
    ...(user ? [{ href: "/profile", label: "资料库", match: ["/profile"] }] : []),
    ...(user?.role === "admin" ? [{ href: "/admin", label: "控制台", match: ["/admin"] }] : [])
  ];

  return (
    <div className={`app-shell ${immersive ? "app-shell-immersive" : ""} ${className}`.trim()}>
      <Head>
        <title>Hong's NEON COMMONS</title>
      </Head>
      {!immersive ? (
        <header className="topbar">
          <div className="topbarBrand">
            <Link href="/" className="brand">
              <span className="brandMark" aria-hidden="true">
                <span className="brandMarkCore" />
              </span>
              <span className="brandStack">
                <strong>Hong's NEON COMMONS</strong>
                <em>澳门夜局大厅</em>
              </span>
            </Link>

            <div className="brandSignals">
              {BRAND_SIGNALS.map((signal) => (
                <span key={signal}>{signal}</span>
              ))}
            </div>
          </div>

          <nav className="topnav">
            <div className="navRail">
              {fullNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`navLink ${isActivePath(item.match) ? "navLinkActive" : ""}`.trim()}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="navAccount">
              {user ? (
                <>
                  <Link
                    href="/profile"
                    className={`profileHud ${
                      isActivePath(["/profile"]) ? "profileHudActive" : ""
                    }`.trim()}
                  >
                    <span className="avatarFrame">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={`${user.displayName} 头像`} className="avatarImage" />
                      ) : (
                        <span className="avatarFallback">{getAvatarInitial(user.displayName)}</span>
                      )}
                    </span>
                    <span className="profileMeta">
                      <strong>{user.displayName}</strong>
                      <span>@{user.username}</span>
                    </span>
                    <span className="profileStatus">
                      {user.role === "admin" ? "ADMIN" : "LIVE"}
                    </span>
                  </Link>

                  <div className="walletStrip" aria-label="玩家资产信息">
                    <div className="walletMetric">
                      <span>金币</span>
                      <strong>{formatNumber(user.coins)}</strong>
                    </div>
                    <div className="walletMetric">
                      <span>战绩</span>
                      <strong>
                        {user.wins}-{user.losses}
                      </strong>
                    </div>
                    <div className="walletMetric">
                      <span>段位</span>
                      <strong>{formatNumber(user.rankScore)}</strong>
                    </div>
                  </div>

                  <button className="ghost-button" onClick={handleLogout}>
                    退出
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={`navLink ${isActivePath(["/login"]) ? "navLinkActive" : ""}`.trim()}
                  >
                    登录
                  </Link>
                  <Link href="/register" className="primary-link">
                    建号入场
                  </Link>
                </>
              )}
            </div>
          </nav>
        </header>
      ) : null}

      <main className={`page-container ${immersive ? "page-container-immersive" : ""}`.trim()}>
        {children}
      </main>
    </div>
  );
}

async function loadSession(setUser) {
  try {
    const response = await apiFetch("/api/me");
    const data = await response.json();
    setUser(data.user || null);
  } catch (error) {
    setUser(null);
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-Hant-HK");
}

function getAvatarInitial(displayName) {
  return String(displayName || "?").trim().slice(0, 1).toUpperCase() || "?";
}
