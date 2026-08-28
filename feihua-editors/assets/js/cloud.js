/* =========================================================================
 * cloud.js —— 通过本机 gh 发布桥接同步 GitHub 配置
 * 浏览器不再接触或保存 GitHub Token。编辑器须由
 * `npm run editor:bridge` 启动，桥接仅监听 localhost，并使用本机 gh 登录。
 * ========================================================================= */
(function (global) {
  "use strict";

  const PREFIX = "feihua_editors_v1_";
  const BRIDGE_API = "/api/github";
  function store(key, val) {
    try { localStorage.setItem(PREFIX + key, JSON.stringify(val)); return true; } catch (e) { return false; }
  }
  function load(key, fallback) {
    try { const r = localStorage.getItem(PREFIX + key); return r ? JSON.parse(r) : fallback; } catch (e) { return fallback; }
  }

  /** 云端发布与手动导出共享唯一工程构造器，缺失时显式失败而非发布残缺内容。 */
  function buildProject() {
    if (!global.Common || typeof global.Common.buildProject !== "function") {
      throw new Error("工程构造器未加载，请刷新编辑器后重试");
    }
    return global.Common.buildProject();
  }

  async function bridgeRequest(path, options) {
    let response;
    try {
      response = await fetch(BRIDGE_API + path, Object.assign({
        headers: { "Content-Type": "application/json" },
        cache: "no-store"
      }, options || {}));
    } catch (error) {
      throw new Error("本机 gh 发布桥接不可用。请用 npm run editor:bridge 打开编辑器后重试。");
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.error || ("桥接服务请求失败 HTTP " + response.status));
    }
    return result;
  }

  /** 检查当前页面是否由本机桥接启动，以及 gh 当前登录用户。 */
  async function status() {
    return bridgeRequest("/status", { method: "GET", headers: {} });
  }

  /** 发布到仓库文件；由本机 bridge 调用 gh，返回 raw 地址。 */
  async function publishRepo(s) {
    const result = await bridgeRequest("/publish", {
      method: "POST",
      body: JSON.stringify({
        mode: "repo", owner: s.owner, repo: s.repo,
        branch: s.branch || "main", path: s.path || "feihua-content.json",
        project: buildProject()
      })
    });
    return result.url;
  }

  /** 发布到 Gist；由本机 bridge 调用 gh，返回 raw 地址。 */
  async function publishGist(s) {
    const result = await bridgeRequest("/publish", {
      method: "POST",
      body: JSON.stringify({ mode: "gist", gistId: s.gistId || "", project: buildProject() })
    });
    return result.url;
  }

  /** 发布入口：根据 settings.mode 分发，返回 raw 地址 */
  async function publish(settings) {
    if (settings.mode === "gist") return await publishGist(settings);
    return await publishRepo(settings);
  }

  /** 由设置反算云端 raw 地址（仅读，无需登录）；供「从云端拉取」使用 */
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

  global.CloudSync = { publish, rawUrl, status, buildProject, saveSettings: store, loadSettings: load };
})(window);
