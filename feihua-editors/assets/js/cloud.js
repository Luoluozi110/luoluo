/* =========================================================================
 * cloud.js —— 通过本机 gh 发布桥接同步 GitHub 配置
 * 浏览器不再接触或保存 GitHub Token。编辑器须由
 * `npm run editor:bridge` 启动，桥接仅监听 localhost，并使用本机 gh 登录。
 * ========================================================================= */
(function (global) {
  "use strict";

  const PREFIX = "feihua_editors_v1_";
  const DEFAULT_LOCAL_BRIDGE_ORIGIN = "http://127.0.0.1:8787";
  const isLoopbackHost = host => /^(localhost|127(?:\.\d{1,3}){3}|\[::1\])$/i.test(String(host || ""));
  // 本机启动页继续走同源；GitHub Pages 正式页则连接仅监听回环地址的本机桥接。
  // 这样正式编辑器不会再把 /api/github 误发给 GitHub Pages 并得到固定 404。
  const BRIDGE_API = isLoopbackHost(global.location.hostname)
    ? "/api/github"
    : DEFAULT_LOCAL_BRIDGE_ORIGIN + "/api/github";
  const cacheBust = raw => {
    const target = new URL(String(raw), global.location.href);
    target.searchParams.set("_wb", String(Date.now()));
    return target.href;
  };
  const DEPLOYMENT_CONFIG_PATHS = ["../config/cloud.json", "../feihuaqi-playable/config/cloud.json"];
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
    const requestOptions = Object.assign({ cache: "no-store" }, options || {});
    const timeoutMs = Number(requestOptions.timeoutMs) || (requestOptions.method === "POST" ? 90_000 : 12_000);
    delete requestOptions.timeoutMs;
    requestOptions.headers = Object.assign({}, requestOptions.body ? { "Content-Type": "application/json" } : {}, requestOptions.headers || {});
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
    if (controller) requestOptions.signal = controller.signal;
    let response;
    try {
      response = await fetch(BRIDGE_API + path, requestOptions);
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error(`本机 gh 发布桥接在 ${Math.ceil(timeoutMs / 1000)} 秒内未响应；请检查桥接窗口和网络后重试。`);
      }
      throw new Error("无法连接本机 gh 发布桥接。请在项目目录运行 npm run editor:bridge，保持窗口开启，再回到正式编辑器重试。");
    } finally {
      if (timer) clearTimeout(timer);
    }
    const responseText = await response.text().catch(() => "");
    let result = {};
    try { result = responseText ? JSON.parse(responseText) : {}; } catch (_) {}
    if (!response.ok || !result.ok) {
      const detail = result.error || (responseText && responseText.length < 240 ? responseText.trim() : "");
      throw new Error(detail || ("桥接服务请求失败 HTTP " + response.status));
    }
    return result;
  }

  /**
   * 将游戏部署配置中的 raw 地址还原为编辑器发布目标。
   * 不同域名/入口不能共享 localStorage，因此部署级 cloud.json 才是跨入口的共同来源。
   */
  function settingsFromUrl(raw) {
    let url;
    try { url = new URL(String(raw || "").trim()); } catch (error) { return null; }
    const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (url.hostname === "raw.githubusercontent.com" && parts.length >= 4) {
      return {
        mode: "repo",
        owner: parts[0], repo: parts[1], repoRaw: parts[0] + "/" + parts[1],
        branch: parts[2], path: parts.slice(3).join("/"), url: url.href
      };
    }
    if (url.hostname === "gist.githubusercontent.com") {
      const rawIndex = parts.indexOf("raw");
      const gistId = rawIndex >= 0 ? parts[rawIndex - 1] : (parts.length >= 2 ? parts[1] : parts[0]);
      const gistOwner = rawIndex > 1 ? parts[rawIndex - 2] : (parts.length >= 2 ? parts[0] : "");
      if (gistId) return { mode: "gist", gistId, gistOwner, url: url.href };
    }
    return null;
  }

  /** 从当前部署的 cloud.json 自动发现共同云端目标；任一路径不存在时继续尝试。 */
  async function discoverSettings() {
    for (const relative of DEPLOYMENT_CONFIG_PATHS) {
      try {
        const target = new URL(relative, global.location.href);
        target.searchParams.set("_wb", String(Date.now()));
        const response = await fetch(target.href, { cache: "no-store" });
        if (!response.ok) continue;
        const config = await response.json();
        const settings = settingsFromUrl(config && config.url);
        if (settings) return settings;
      } catch (error) { /* 当前入口没有部署配置，继续尝试下一条路径。 */ }
    }
    return null;
  }

  /** 检查当前页面是否由本机桥接启动，以及 gh 当前登录用户。 */
  async function status() {
    return bridgeRequest("/status", { method: "GET", headers: {} });
  }

  /** 读取当前云端完整工程；发布前用于拦截旧编辑器覆盖新版本。 */
  async function fetchProject(s) {
    const response = await fetch(cacheBust(rawUrl(s)), { cache: "no-store" });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("发布前读取云端失败 HTTP " + response.status);
    const project = await response.json();
    if (!project || project._type !== "feihua-content") throw new Error("发布前读取到的云端文件不是有效工程");
    return project;
  }

  /** 发布到仓库文件；由本机 bridge 调用 gh，返回 raw 地址。 */
  async function publishRepo(s, project) {
    return await bridgeRequest("/publish", {
      method: "POST",
      body: JSON.stringify({
        mode: "repo", owner: s.owner, repo: s.repo,
        branch: s.branch || "main", path: s.path || "feihua-content.json",
        project: project || buildProject()
      })
    });
  }

  /** 发布到 Gist；由本机 bridge 调用 gh，返回 raw 地址。 */
  async function publishGist(s, project) {
    return await bridgeRequest("/publish", {
      method: "POST",
      body: JSON.stringify({ mode: "gist", gistId: s.gistId || "", project: project || buildProject() })
    });
  }

  /** 发布入口：根据 settings.mode 分发，返回 raw 地址 */
  async function publish(settings, project) {
    if (settings.mode === "gist") return await publishGist(settings, project);
    return await publishRepo(settings, project);
  }

  /** 由设置反算云端 raw 地址（仅读，无需登录）；供「从云端拉取」使用 */
  function rawUrl(s) {
    if (s.url) return s.url;
    if (s.mode === "gist") {
      if (!s.gistId) throw new Error("尚未发布到 Gist（无 Gist ID），无法拉取；请先『发布到云端』");
      const owner = s.gistOwner ? encodeURIComponent(s.gistOwner) + "/" : "";
      return `https://gist.githubusercontent.com/${owner}${encodeURIComponent(s.gistId)}/raw/feihua-content.json`;
    }
    if (!s.owner || !s.repo) throw new Error("请先填写仓库（owner/repo）");
    const branch = s.branch || "main";
    const path = s.path || "feihua-content.json";
    return `https://raw.githubusercontent.com/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}/${encodeURIComponent(branch)}/${encodeURIComponent(path)}`;
  }

  global.CloudSync = {
    publish, rawUrl, fetchProject, status, buildProject, settingsFromUrl, discoverSettings,
    bridgeApi: BRIDGE_API, saveSettings: store, loadSettings: load
  };
})(window);
