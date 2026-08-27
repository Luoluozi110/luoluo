// 原生 fetch 版 Supabase 后端测试（不依赖 supabase-js / esm.sh）
import assert from 'node:assert';

// 模拟浏览器 window
globalThis.window = {
  LEADERBOARD_CFG: {
    backend: 'supabase',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'sb_publishable_TESTKEY',
    table: 'leaderboard'
  }
};

let pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; console.log('  ✔ ' + label); }
  else { fail++; console.log('  �’ ' + label + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : '')); }
}

// 捕获 fetch 调用，返回 canned response
let lastCall = null;
globalThis.fetch = async (url, opts) => {
  lastCall = { url, opts: opts || {} };
  if (opts && opts.method === 'POST') {
    return { ok: true, status: 201, json: async () => ({}) };
  }
  // GET 榜单
  return { ok: true, status: 200, json: async () => ([
    { name: '甲', score: 50, ts: '2026-01-01T00:00:00Z' },
    { name: '乙', score: 80, ts: '2026-01-02T00:00:00Z' },
    { name: '甲', score: 90, ts: '2026-01-03T00:00:00Z' }
  ]) };
};

const { Leaderboard } = await import('../js/ui/leaderboard.js');

console.log('[1] init 成功（supabase 不再 import 第三方库）');
const r1 = await Leaderboard.init(null);
ok(r1 === true, 'ready=true');
ok(Leaderboard.backend() === 'supabase', 'backend=supabase');

console.log('[2] fetchTop 走 PostgREST 直连');
const top = await Leaderboard.fetchTop();
ok(top.ok === true, 'fetchTop ok');
ok(top.list.length === 2, '去重后 2 人', top.list.length);
ok(top.list[0].name === '甲' && top.list[0].score === 90, '最高分=甲 90（按昵称去重保留最高）', top.list[0]);
const u = new URL(lastCall.url);
ok(u.origin === 'https://example.supabase.co', '请求 Supabase REST 域名');
ok(u.pathname === '/rest/v1/leaderboard', '路径 /rest/v1/leaderboard');
ok(u.searchParams.get('select') === 'name,score,ts', 'select 字段');
ok(u.searchParams.get('order') === 'score.desc', 'order=score.desc');
ok(lastCall.opts.headers.apikey === 'sb_publishable_TESTKEY', '带 apikey');
ok(lastCall.opts.headers.Authorization === 'Bearer sb_publishable_TESTKEY', '带 Authorization Bearer');

console.log('[3] submit 走 POST 插入');
const s = await Leaderboard.submit('丙', 120);
ok(s.ok === true, 'submit ok');
ok(lastCall.opts.method === 'POST', 'POST 方法');
const body = JSON.parse(lastCall.opts.body);
ok(body.name === '丙' && body.score === 120 && typeof body.ts === 'string', '提交体含 name/score/ts', body);
ok(lastCall.opts.headers['Content-Type'] === 'application/json', 'POST 带 Content-Type');

console.log('[4] 异常：后端返回错误');
globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({ message: 'invalid API key' }) });
const e = await Leaderboard.fetchTop();
ok(e.ok === false && /无效|invalid/i.test(e.error) === false, 'fetchTop 失败被捕获');
ok(typeof e.error === 'string' && e.error.length > 0, '带回错误文案', e.error);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
if (fail) process.exit(1);
