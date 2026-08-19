/**
 * Cloudflare Worker —— 飞花棋云端排行榜代理
 *
 * 作用：把 GitHub token 留在服务端（Worker 环境变量 / secret），前端只调用本 Worker，
 *       这样 GitHub Pages（公开静态站、不能在前端暴露 token）也能安全读写榜单。
 *       前端从此不再持有任何 GitHub token。
 *
 * 依赖的环境变量（Dashboard → Settings → Variables / Secrets）：
 *   GITHUB_TOKEN    (secret)   一枚有 contents:write 的 PAT（建议细粒度，仅授权该仓库 Contents 读写）
 *   GITHUB_REPO     (var)      "owner/repo"，例如 "Luoluozi110/luoluo"
 *   GITHUB_PATH     (var)      数据文件名，例如 "leaderboard.json"
 *   GITHUB_BRANCH   (var)      分支，例如 "main"
 *   ALLOWED_ORIGIN  (var,可选) 允许跨域的源；默认 "*"（公开榜单可接受）。可设为 "https://luoluozi110.github.io"
 *
 * 接口契约（前端 leaderboard.js backend:"cf" 调用）：
 *   GET  /        → { rows: [ {name, score, ts}, ... ] }   已去重/排序/截取 Top 50
 *   POST /        body { name, score }  → { ok:true, rows:[...] } 或 { ok:false, error }
 *   OPTIONS /     → CORS 预检（返回 204）
 *
 * 部署：
 *   npm i -g wrangler       # 或 npx wrangler
 *   wrangler deploy         # 读本目录 wrangler.toml
 *   wrangler secret put GITHUB_TOKEN   # 交互输入 PAT（务必用 secret，勿写进 wrangler.toml）
 * 部署后得到 https://<name>.<subdomain>.workers.dev ，把它填进游戏 config/leaderboard.json 的 workerUrl。
 */

const LIMIT = 50;

function b64encode(s) { return Buffer.from(s, 'utf-8').toString('base64'); }
function b64decode(s) { return Buffer.from(s, 'base64').toString('utf-8'); }
const cleanName = (n) => String(n || '无名氏').trim().slice(0, 16) || '无名氏';

/** 去重 + 排序 + 截取前 LIMIT：每人仅留最高分；同分先到优先；昵称码点稳定排序 */
function normalize(rows) {
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

function cors(allow) {
  return {
    'Access-Control-Allow-Origin': allow || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

function json(obj, headers, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, headers || {}),
  });
}

async function ghGetFile(env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO || !env.GITHUB_PATH) {
    return { error: 'Worker 未配置 GITHUB_TOKEN/GITHUB_REPO/GITHUB_PATH' };
  }
  const ref = env.GITHUB_BRANCH || 'main';
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_PATH}?ref=${ref}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'cf-leaderboard',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (res.status === 404) return { notFound: true, rows: [] };
  if (!res.ok) return { error: 'github ' + res.status, body: await res.text().catch(() => '') };
  const j = await res.json();
  let rows = [];
  try { rows = JSON.parse(b64decode(j.content)); } catch (_) { rows = []; }
  return { sha: j.sha, rows: Array.isArray(rows) ? rows : [] };
}

async function ghPutFile(env, rows, sha) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPO}/contents/${env.GITHUB_PATH}`;
  const body = { message: 'leaderboard: 更新榜单', content: b64encode(JSON.stringify(rows)), encoding: 'utf-8' };
  if (sha) body.sha = sha;
  return fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'cf-leaderboard',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify(body),
  });
}

export default {
  async fetch(request, env) {
    const allow = env.ALLOWED_ORIGIN || '*';
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(allow) });
    }
    try {
      if (request.method === 'GET') {
        const f = await ghGetFile(env);
        if (f.error) return json({ rows: [], error: f.error }, cors(allow), 502);
        return json({ rows: normalize(f.notFound ? [] : f.rows) }, cors(allow));
      }
      if (request.method === 'POST') {
        let body;
        try { body = await request.json(); } catch (_) { return json({ ok: false, error: 'invalid json' }, cors(allow), 400); }
        const entry = { name: cleanName(body.name), score: Number(body.score) || 0, ts: new Date().toISOString() };
        for (let attempt = 0; attempt < 4; attempt++) {
          const f = await ghGetFile(env);
          if (f.error) return json({ ok: false, error: 'read failed: ' + f.error }, cors(allow), 502);
          const merged = new Map();
          for (const r of f.rows) {
            const n = cleanName(r.name), sc = Number(r.score) || 0, t = r.ts || new Date(0).toISOString();
            const p = merged.get(n);
            if (!p || sc > p.score || (sc === p.score && t < p.ts)) merged.set(n, { name: n, score: sc, ts: t });
          }
          const mine = merged.get(entry.name);
          if (!mine || entry.score > mine.score || (entry.score === mine.score && entry.ts < mine.ts)) merged.set(entry.name, entry);
          const next = normalize([...merged.values()]);
          const put = await ghPutFile(env, next, f.notFound ? null : f.sha);
          if (put.ok) return json({ ok: true, rows: next }, cors(allow));
          if (put.status === 409) continue; // 并发 SHA 冲突：重新拉取最新 sha 后重试
          const detail = await put.text().catch(() => '');
          return json({ ok: false, error: 'write failed ' + put.status, detail: detail.slice(0, 200) }, cors(allow), 502);
        }
        return json({ ok: false, error: 'conflict-retry-exhausted' }, cors(allow), 409);
      }
      return json({ error: 'method not allowed' }, cors(allow), 405);
    } catch (e) {
      return json({ ok: false, error: String((e && e.message) || e) }, cors(allow), 500);
    }
  },
};
