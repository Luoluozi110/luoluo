/**
 * leaderboard.js —— 云端排行榜（后端可切换：GitHub Contents API / Supabase / Cloudflare Worker 代理）
 *
 * 配置（config/leaderboard.json 或 window.LEADERBOARD_CFG）：
 *   { "backend": "github", "repo": "owner/repo", "path": "leaderboard.json", "branch": "main", "githubToken": "ghp_xxx" }
 *   { "backend": "supabase", "supabaseUrl": "...", "supabaseAnonKey": "...", "table": "leaderboard" }
 *   —— Supabase 走原生 fetch 直连其 PostgREST 接口（不加载第三方库），避免 esm.sh 等 CDN 在部分地区不可达导致榜单静默失效。
 *   { "backend": "cf", "workerUrl": "https://<your-worker>.workers.dev" }   // 推荐：token 留在 Worker 端，前端零密钥
 *
 * GitHub 方案：
 *   - 读：公开 raw 地址 https://raw.githubusercontent.com/{repo}/{branch}/{path}（无需 token，CDN 缓存）。
 *   - 写：GitHub Contents API（PUT）。需一枚有 contents:write 的 token，内嵌于配置（静态站点无解，token 会暴露，
 *         故仅适合自有/低风险仓库；建议用细粒度 PAT 仅授权该仓库）。写入带 SHA 乐观锁，冲突自动重试。
 *   - 数据文件 leaderboard.json 由玩家提交创建/更新，部署脚本会像 feihua-content.json 一样保留，不被清空。
 *
 * Cloudflare Worker 方案（cf，推荐用于 GitHub Pages 等公开静态站）：
 *   - 前端不持有任何 token；只调用 Worker 的 GET/POST（见 cloudflare-leaderboard-worker/worker.js）。
 *   - Worker 服务端持有 GITHUB_TOKEN（secret），代理读写仓库根 leaderboard.json，并做去重/排序/Top50 与 SHA 乐观锁。
 *   - 这样 GitHub Pages 也能安全联网上榜，且 token 不落前端、不进公开仓库历史。
 *
 * 查询接口（菜单「云端排行榜」）：fetchTop(50) 取数后前端 normalize 去重（每人最高分、同分先到优先、昵称稳定排序）取前 50。
 * 实时更新：打开弹窗即拉最新；通关提交后若弹窗开着自动刷新。
 */

let modalsInst = null;
let cfg = null;
let ready = false;
let openOv = null;              // 当前已打开的排行榜弹窗（用于提交后刷新）

const esc = s => String(s ?? '').replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '&gt;': '&gt;' }[m]));
const cleanName = n => String(n || '无名氏').trim().slice(0, 16) || '无名氏';
const LIMIT = 50;

/* unicode 安全的 base64（浏览器环境） */
function b64encode(str) {
  if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(str)));
  return Buffer.from(str, 'utf-8').toString('base64'); // Node 测试兜底
}
function b64decode(b64) {
  if (typeof atob === 'function') return decodeURIComponent(escape(atob(b64)));
  return Buffer.from(b64, 'base64').toString('utf-8');
}

/** 前端去重 + 排序：每人仅留最高分；同分先到优先；昵称码点稳定排序；截取前 LIMIT */
export function normalize(rows) {
  const byName = new Map();
  for (const r of (rows || [])) {
    const name = cleanName(r.name);
    const score = Number(r.score) || 0;
    const ts = r.ts || new Date(0).toISOString();
    const prev = byName.get(name);
    if (!prev || score > prev.score || (score === prev.score && ts < prev.ts)) {
      byName.set(name, { name, score, ts });
    }
  }
  return [...byName.values()]
    .sort((a, b) =>
      b.score - a.score ||
      (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)))
    .slice(0, LIMIT);
}

export const Leaderboard = {
  async init(modals) {
    modalsInst = modals;
    cfg = (typeof window !== 'undefined' && window.LEADERBOARD_CFG) ? window.LEADERBOARD_CFG : null;
    if (!cfg) {
      try {
        const r = await fetch('config/leaderboard.json', { cache: 'no-store' });
        if (r.ok) cfg = await r.json();
      } catch (_) { /* 本地 file:// 或离线时忽略 */ }
    }
    cfg = cfg || {};
    cfg.backend = cfg.backend || (cfg.supabaseUrl ? 'supabase' : (cfg.repo ? 'github' : 'github'));

    if (cfg.backend === 'supabase' && cfg.supabaseUrl && cfg.supabaseAnonKey) {
      // Supabase 走原生 fetch 直连 PostgREST，无需加载第三方库——
      // 规避 esm.sh / supabase-js 在部分地区被墙/超时导致榜单静默失效。
      cfg.table = cfg.table || 'leaderboard';
      ready = true;
    } else if (cfg.backend === 'github' && cfg.repo && cfg.path && cfg.githubToken) {
      cfg.branch = cfg.branch || 'main';
      ready = true;
    } else if (cfg.backend === 'cf' && cfg.workerUrl) {
      cfg.workerUrl = String(cfg.workerUrl).replace(/\/+$/, '');   // 去尾部斜杠，便于拼接 ?_cb=
      ready = true;
    }
    return ready;
  },

  isReady() { return ready; },
  backend() { return cfg ? cfg.backend : null; },

  /** 查询接口：返回 { ok, list:[{name,score,ts}], error }。list 已去重置顶 50。 */
  async fetchTop() {
    if (!ready) return { ok: false, error: '排行榜未配置' };
    if (cfg.backend === 'cf') return cfFetchTop();
    return cfg.backend === 'supabase' ? supaFetchTop() : githubFetchTop();
  },

  /** 提交分数（通关时调用）。返回 { ok, error }。 */
  async submit(name, score) {
    if (!ready) return { ok: false, error: '排行榜未配置' };
    if (cfg.backend === 'cf') return cfSubmit(name, score);
    return cfg.backend === 'supabase' ? supaSubmit(name, score) : githubSubmit(name, score);
  },

  /** 菜单查询接口：弹出榜单弹窗，打开即拉取最新数据。 */
  async openModal() {
    if (!modalsInst) return;
    const ov = modalsInst.open(`
      <div class="modal paper" style="width:min(420px,92vw)">
        <div class="mtitle"><h2>☁ 云端排行榜 · 前 ${LIMIT} 名</h2></div>
        <div id="lbBody" class="lb-body">读取中…</div>
        <div style="text-align:center;margin-top:14px">
          <button class="btn btn-ink" data-close>关闭</button>
        </div>
      </div>`, 'leaderboard');
    openOv = ov;
    ov.querySelector('[data-close]').addEventListener('click', () => { modalsInst.close(ov); openOv = null; });
    ov.addEventListener('click', e => { if (e.target === ov) { modalsInst.close(ov); openOv = null; } });
    await refresh(ov);
  }
};

/* ====================================================== GitHub 后端 */
function ghHeaders(extra) {
  const h = Object.assign({ 'Accept': 'application/vnd.github+json', 'User-Agent': 'feihua-leaderboard' }, extra || {});
  if (cfg.githubToken) h.Authorization = 'token ' + cfg.githubToken;
  return h;
}

async function githubGet() {
  const r = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`, { headers: ghHeaders() });
  if (r.status === 404) return { notFound: true };
  if (!r.ok) throw new Error('GitHub 读取失败 HTTP ' + r.status);
  const j = await r.json();
  let rows = [];
  try { rows = JSON.parse(b64decode(j.content)); } catch (_) { rows = []; }
  return { sha: j.sha, rows: Array.isArray(rows) ? rows : [] };
}

async function githubPut(rows, sha) {
  const body = { message: 'leaderboard: 更新榜单', content: b64encode(JSON.stringify(rows)), encoding: 'utf-8' };
  if (sha) body.sha = sha;
  const r = await fetch(`https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`, {
    method: 'PUT',
    headers: ghHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body)
  });
  if (!r.ok) {
    let m = ''; try { m = (await r.json()).message || ''; } catch (_) {}
    const e = new Error('GitHub 写入失败 HTTP ' + r.status + ' ' + m);
    e.status = r.status; throw e;
  }
  return r.json();
}

async function githubFetchTop() {
  const url = `https://raw.githubusercontent.com/${cfg.repo}/${cfg.branch}/${cfg.path}?_cb=${Date.now()}`;
  const r = await fetch(url, { cache: 'no-store' });
  if (r.status === 404) return { ok: true, list: [] };
  if (!r.ok) return { ok: false, error: '读取失败 HTTP ' + r.status };
  let rows; try { rows = await r.json(); } catch (_) { return { ok: false, error: '榜单数据格式错误' }; }
  return { ok: true, list: normalize(Array.isArray(rows) ? rows : []) };
}

async function githubSubmit(name, score) {
  const entry = { name: cleanName(name), score: Number(score) || 0, ts: new Date().toISOString() };
  for (let attempt = 0; attempt < 3; attempt++) {
    let cur;
    try { cur = await githubGet(); }
    catch (e) { return { ok: false, error: e.message }; }
    const merged = new Map();
    for (const r of cur.rows) {
      const n = cleanName(r.name), sc = Number(r.score) || 0, t = r.ts || new Date(0).toISOString();
      const p = merged.get(n);
      if (!p || sc > p.score || (sc === p.score && t < p.ts)) merged.set(n, { name: n, score: sc, ts: t });
    }
    const mine = merged.get(entry.name);
    if (!mine || entry.score > mine.score || (entry.score === mine.score && entry.ts < mine.ts)) merged.set(entry.name, entry);
    try {
      await githubPut(normalize([...merged.values()]), cur.notFound ? null : cur.sha);
      if (openOv) refresh(openOv);
      return { ok: true };
    } catch (e) {
      if (e.status === 409) continue;            // 并发 SHA 冲突：重试（重新拉取最新 sha）
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: '并发写入冲突，请稍后重试' };
}

/* ====================================================== Cloudflare Worker 后端 */
async function cfFetchTop() {
  const r = await fetch(`${cfg.workerUrl}?_cb=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) return { ok: false, error: 'Worker 读取失败 HTTP ' + r.status };
  let j;
  try { j = await r.json(); } catch (_) { return { ok: false, error: '榜单数据格式错误' }; }
  const rows = Array.isArray(j) ? j : (j.rows || []);
  return { ok: true, list: normalize(rows) };
}

async function cfSubmit(name, score) {
  const r = await fetch(cfg.workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: cleanName(name), score: Number(score) || 0 }),
  });
  if (!r.ok) {
    let m = '';
    try { m = (await r.json()).error || ''; } catch (_) {}
    return { ok: false, error: m || ('Worker 写入失败 HTTP ' + r.status) };
  }
  const j = await r.json().catch(() => ({}));
  if (openOv) refresh(openOv);
  return { ok: true, rows: j.rows || null };
}

/* ====================================================== Supabase 后端（原生 fetch 直连 PostgREST，不依赖 supabase-js） */
function supaHeaders(extra) {
  return Object.assign({
    apikey: cfg.supabaseAnonKey,
    Authorization: 'Bearer ' + cfg.supabaseAnonKey
  }, extra || {});
}

async function supaFetchTop() {
  const url = `${cfg.supabaseUrl}/rest/v1/${cfg.table}?select=name,score,ts&order=score.desc&limit=200`;
  const r = await fetch(url, { headers: supaHeaders(), cache: 'no-store' });
  if (!r.ok) return { ok: false, error: '读取失败 HTTP ' + r.status };
  let data; try { data = await r.json(); } catch (_) { return { ok: false, error: '榜单数据格式错误' }; }
  return { ok: true, list: normalize(Array.isArray(data) ? data : []) };
}

async function supaSubmit(name, score) {
  const url = `${cfg.supabaseUrl}/rest/v1/${cfg.table}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: supaHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name: cleanName(name), score: Number(score) || 0, ts: new Date().toISOString() })
  });
  if (!r.ok) {
    let m = '';
    try { m = (await r.json()).message || ''; } catch (_) {}
    return { ok: false, error: m || ('写入失败 HTTP ' + r.status) };
  }
  if (openOv) refresh(openOv);
  return { ok: true };
}

/* ====================================================== 弹窗渲染 */
async function refresh(ov) {
  const body = ov.querySelector('#lbBody');
  if (!body) return;
  if (!ready) {
    body.innerHTML = '<div class="lb-empty">排行榜未配置（缺少 GitHub token / Supabase 密钥 / Cloudflare Worker 地址）。<br/>请在 config/leaderboard.json 中填入后重新部署。</div>';
    return;
  }
  body.innerHTML = '<div class="lb-empty">读取中…</div>';
  const res = await Leaderboard.fetchTop();
  if (!res.ok) {
    body.innerHTML = `<div class="lb-empty" style="color:var(--bad)">读取失败：${esc(res.error)}</div>`;
    return;
  }
  if (!res.list.length) {
    body.innerHTML = '<div class="lb-empty">榜上暂无记录，去通关一局，抢占头名！</div>';
    return;
  }
  body.innerHTML = `<ol class="lb-list">` + res.list.map((r, i) => `
    <li class="lb-row${i < 3 ? ' top' + (i + 1) : ''}">
      <span class="lb-rk">${i + 1}</span>
      <span class="lb-nm">${esc(r.name)}</span>
      <span class="lb-sc">${r.score}</span>
    </li>`).join('') + `</ol>`;
}

// 暴露到 window，供引擎（game.js）在通关时解耦调用
if (typeof window !== 'undefined') window.Leaderboard = Leaderboard;
