import { useEffect, useMemo, useState } from "react";
import SiteLayout from "../components/SiteLayout";
import { API_ROUTES, apiFetch } from "../lib/client/api";
import styles from "../styles/Profile.module.css";

export default function ProfilePage() {
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    avatarUrl: null
  });
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProfile()
      .then((user) => {
        setAccount(user);
        setForm({
          displayName: user.displayName || "",
          bio: user.bio || "",
          avatarUrl: user.avatarUrl || null
        });
      })
      .catch(() => setError("资料读取失败"))
      .finally(() => setLoading(false));
  }, []);

  const avatarInitial = useMemo(
    () => String(form.displayName || account?.displayName || "?").trim().slice(0, 1).toUpperCase() || "?",
    [account?.displayName, form.displayName]
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await apiFetch(API_ROUTES.profile(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "资料保存失败");
      }

      setAccount(data.user);
      setForm({
        displayName: data.user.displayName || "",
        bio: data.user.bio || "",
        avatarUrl: data.user.avatarUrl || null
      });
      setMessage("资料已同步到夜局大厅");
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("session:user-updated", { detail: data.user }));
      }
    } catch (saveError) {
      setError(saveError.message || "资料保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(event) {
    const [file] = event.target.files || [];
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("请上传图片文件");
      return;
    }

    setError("");
    const avatarUrl = await resizeAvatar(file);
    setForm((current) => ({ ...current, avatarUrl }));
  }

  if (loading) {
    return (
      <SiteLayout>
        <section className={styles.loading}>正在读取玩家资料舱...</section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div>
            <span className={styles.badge}>PLAYER ID</span>
            <h1>把你的门面、签名和资产整理好。</h1>
            <p>大厅、排行榜和房间都会共用这里的资料。</p>
          </div>

          <div className={styles.heroStats}>
            <div>
              <span>金币</span>
              <strong>{formatNumber(account?.coins)}</strong>
            </div>
            <div>
              <span>段位</span>
              <strong>{formatNumber(account?.rankScore)}</strong>
            </div>
            <div>
              <span>胜负</span>
              <strong>
                {account?.wins || 0}-{account?.losses || 0}
              </strong>
            </div>
          </div>
        </section>

        <div className={styles.layout}>
          <form className={styles.editor} onSubmit={handleSubmit}>
            <div className={styles.sectionHead}>
              <div>
                <span className={styles.sectionEyebrow}>EDIT PROFILE</span>
                <h2>玩家资料</h2>
              </div>
              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "同步中..." : "保存资料"}
              </button>
            </div>

            <label className={styles.field}>
              <span>昵称</span>
              <input
                value={form.displayName}
                maxLength={60}
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayName: event.target.value }))
                }
                placeholder="输入新的大厅昵称"
              />
            </label>

            <div className={styles.accountGrid}>
              <div className={styles.accountItem}>
                <span>账号</span>
                <strong>{account?.username}</strong>
              </div>
              <div className={styles.accountItem}>
                <span>邮箱</span>
                <strong>{account?.email}</strong>
              </div>
            </div>

            <label className={styles.field}>
              <span>个性签名</span>
              <textarea
                value={form.bio}
                maxLength={160}
                onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                placeholder="一句让牌桌记住你的话"
              />
              <em>{form.bio.length}/160</em>
            </label>

            <div className={styles.avatarActions}>
              <label className={styles.uploadButton}>
                上传头像
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} />
              </label>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setForm((current) => ({ ...current, avatarUrl: null }))}
              >
                清除头像
              </button>
            </div>

            {message ? <p className={styles.success}>{message}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
          </form>

          <aside className={styles.preview}>
            <div className={styles.avatarCard}>
              <div className={styles.avatarFrame}>
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="头像预览" className={styles.avatarImage} />
                ) : (
                  <span>{avatarInitial}</span>
                )}
              </div>
              <strong>{form.displayName || account?.displayName}</strong>
              <span>@{account?.username}</span>
              <p>{form.bio || "还没写签名。给桌上的人留一句狠话。"}</p>
            </div>

            <div className={styles.statStack}>
              <div>
                <span>总对局</span>
                <strong>{formatNumber(account?.totalGames)}</strong>
              </div>
              <div>
                <span>地主胜场</span>
                <strong>{formatNumber(account?.landlordWins)}</strong>
              </div>
              <div>
                <span>农民胜场</span>
                <strong>{formatNumber(account?.farmerWins)}</strong>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </SiteLayout>
  );
}

async function fetchProfile() {
  const response = await apiFetch(API_ROUTES.profile());
  const data = await response.json();
  if (!response.ok || !data.user) {
    throw new Error(data.error || "资料读取失败");
  }
  return data.user;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("zh-Hant-HK");
}

function resizeAvatar(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);

    image.onload = () => {
      const size = 256;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        reject(new Error("头像处理失败"));
        return;
      }

      const minSide = Math.min(image.width, image.height);
      const sourceX = (image.width - minSide) / 2;
      const sourceY = (image.height - minSide) / 2;

      context.drawImage(image, sourceX, sourceY, minSide, minSide, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.84));
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("头像处理失败"));
    };

    image.src = url;
  });
}
