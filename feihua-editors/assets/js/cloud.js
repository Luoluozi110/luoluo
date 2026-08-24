/* =========================================================================
 * cloud.js —— 云端同步（发布到 GitHub，使所有玩家自动同步）
 * 把「内容编辑器」当前数据打包成 feihua-content.json，推送到：
 *   · GitHub 仓库文件：Contents API（自动取 SHA，首次创建/后续更新）
 *   · GitHub Gist：POST 新建 / PATCH 更新（单文件，raw 始终最新）
 * Token 仅用于当前发布请求，不写入浏览器存储。
 * 游戏端读取返回的 raw 地址（config/cloud.json 或菜单填写）即在启动时自动同步。
 * ========================================================================= */
(function (global) {
  "use strict";

  const PREFIX = "feihua_editors_v1_";
  function store(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }
  function load(key, fallback) {
    try { const r = localStorage.getItem(PREFIX + key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
  }

  /** UTF-8 安全 base64（GitHub API content 字段要求） */
  function b64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  /** 云端发布与手动导出共享唯一工程构造器，缺失时显式失败而非发布残缺内容。 */
  function buildProject() {
    if (!global.Common || typeof global.Common.buildProject !== "function") {
      throw new Error("工程构造器未加载，请刷新编辑器后重试");
    }
    return global.Common.buildProject();
  }

  function ghHeaders(token, extra) {
    const h = Object.assign({ "Accept": "application/vnd.github+json", "Content-Type": "application/json" }, extra || {});
    if (token) h["Authorization"] = "Bearer " + token;
    return h;
  }

  /** 将 GitHub 的常见鉴权响应转成可操作的提示，避免只显示模糊的 Bad credentials。 */
  async function githubError(res, fallback) {
    const detail = await res.json().catch(() => ({}));
    if (res.status === 401) {
      return new Error("GitHub Token 无效、已过期或已被撤销。请重新创建 Token 后粘贴重试：经典 Token 需勾选 repo；细粒度 Token 需授予目标仓库 Contents 读写权限。");
    }
    if (res.status === 403) {
      return new Error("GitHub Token 无权写入该仓库或 Gist。请确认 Token 已授权目标仓库且具备 Contents 读写权限。");
    }
    return new Error(detail.message || (fallback + " HTTP " + res.status));
  }

  /** 发布到仓库文件；返回 raw 地址 */
  async function publishRepo(s) {
    const path = s.path || "feihua-content.json";
    const branch = s.branch || "main";
    const apiBase = `https://api.github.com/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/contents/${encodeURIComponent(path)}`;
    const headers = ghHeaders(s.token);

    // 取现有 SHA（存在才更新，否则创建）
    let sha = null;
    try {
      const g = await fetch(`${apiBase}?ref=${encodeURIComponent(branch)}`, { headers });
      if (g.ok) { const j = await g.json(); sha = j.sha; }
      else if (g.status !== 404) throw await githubError(g, "读取文件失败");
    } catch (err) { if (!/HTTP 404/.test(err.message)) throw err; }

    const content = b64(JSON.stringify(buildProject(), null, 2));
    const body = { message: "feihua: 更新自定义配置（云端同步）", content, branch };
    if (sha) body.sha = sha;
    const res = await fetch(apiBase, { method: "PUT", headers, body: JSON.stringify(body) });
    if (!res.ok) throw await githubError(res, "发布失败");
    return `https://raw.githubusercontent.com/${s.owner}/${s.repo}/${branch}/${path}`;
  }

  /** 发布到 Gist；返回 raw 地址 */
  async function publishGist(s) {
    if (!s.token) throw new Error("发布到 Gist 需要 GitHub Token");
    const headers = ghHeaders(s.token);
    const content = JSON.stringify(buildProject(), null, 2);
    if (s.gistId) {
      const res = await fetch(`https://api.github.com/gists/${encodeURIComponent(s.gistId)}`, {
        method: "PATCH", headers, body: JSON.stringify({ files: { "feihua-content.json": { content } } })
      });
      if (!res.ok) throw await githubError(res, "更新 Gist 失败");
      return `https://gist.githubusercontent.com/${s.gistId}/raw/feihua-content.json`;
    }
    const res = await fetch("https://api.github.com/gists", {
      method: "POST", headers,
      body: JSON.stringify({
        description: "文心棋自定义配置（云端自动同步）", public: true,
        files: { "feihua-content.json": { content } }
      })
    });
    if (!res.ok) throw await githubError(res, "创建 Gist 失败");
    const j = await res.json();
    return `https://gist.githubusercontent.com/${j.id}/raw/feihua-content.json`;
  }

  /** 发布入口：根据 settings.mode 分发，返回 raw 地址 */
  async function publish(settings) {
    if (settings.mode === "gist") return await publishGist(settings);
    return await publishRepo(settings);
  }

  /** 由设置反算云端 raw 地址（仅读，无需 Token）；供「从云端拉取」使用 */
  function rawUrl(s) {
    if (s.mode === "gist") {
      if (!s.gistId) throw new Error("尚未发布到 Gist（无 Gist ID），无法拉取；请先『发布到云端』");
      return `https://gist.githubusercontent.com/${s.gistId}/raw/feihua-content.json`;
    }
    if (!s.owner || !s.repo) throw new Error("请先填写仓库（owner/repo）");
    const branch = s.branch || "main";
    const path = s.path || "feihua-content.json";
    return `https://raw.githubusercontent.com/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/${encodeURIComponent(branch)}/${encodeURIComponent(path)}`;
  }

  global.CloudSync = { publish, rawUrl, buildProject, saveSettings: store, loadSettings: load };
})(window);
