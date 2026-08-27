// leaderboard-cf.test.mjs —— 验证 leaderboard.js 的 backend:"cf" 路径
// 用一个本地 http 服务模拟 Cloudflare Worker 契约（GET 返回 rows、POST 合并写入），
// 验证前端 cfFetchTop / cfSubmit 的去重、排序、Top50 截断均正确。
import http from 'http';
import assert from 'assert';

const { Leaderboard } = await import('../js/ui/leaderboard.js');

let store = [];   // 模拟 Worker 的仓库根 leaderboard.json（原始合并数组，未去重）

const server = http.createServer((req, res) => {
  const allow = { 'Access-Control-Allow-Origin': '*' };
  if (req.method === 'OPTIONS') { res.writeHead(204, allow); return res.end(); }
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...allow });
    return res.end(JSON.stringify({ rows: store }));
  }
  if (req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { name, score } = JSON.parse(body || '{}');
        store.push({ name: String(name || '无名氏').trim().slice(0, 16) || '无名氏', score: Number(score) || 0, ts: new Date().toISOString() });
        res.writeHead(200, { 'Content-Type': 'application/json', ...allow });
        res.end(JSON.stringify({ ok: true, rows: store }));
      } catch (e) {
        res.writeHead(400, allow); res.end(JSON.stringify({ ok: false, error: 'invalid' }));
      }
    });
    return;
  }
  res.writeHead(405, allow); res.end();
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const workerUrl = `http://127.0.0.1:${port}`;

global.window = { LEADERBOARD_CFG: { backend: 'cf', workerUrl } };

let pass = 0;
function ok(name) { console.log('  ✓', name); pass++; }

await Leaderboard.init(null);
assert.strictEqual(Leaderboard.isReady(), true, 'init 应 ready');
assert.strictEqual(Leaderboard.backend(), 'cf');
ok('init 识别 cf 后端并 ready');

// 初始空
let top = await Leaderboard.fetchTop();
assert.strictEqual(top.ok, true);
assert.strictEqual(top.list.length, 0);
ok('初始榜单为空');

// 同昵称去重保留最高分
await Leaderboard.submit('甲', 100);
await Leaderboard.submit('甲', 50);     // 更低，应被保留的 100 覆盖
await Leaderboard.submit('乙', 200);
top = await Leaderboard.fetchTop();
assert.strictEqual(top.list.length, 2, '应去重为 2 人');
assert.strictEqual(top.list[0].name, '乙'); assert.strictEqual(top.list[0].score, 200);
assert.strictEqual(top.list[1].name, '甲'); assert.strictEqual(top.list[1].score, 100);
ok('同昵称去重保留最高分 + 按分降序');

// 刷新更高分
await Leaderboard.submit('甲', 300);
top = await Leaderboard.fetchTop();
assert.strictEqual(top.list[0].name, '甲'); assert.strictEqual(top.list[0].score, 300);
ok('同昵称刷新更高分生效');

// Top50 截断：清空后塞入 60 个唯一昵称（分 1..60）
store = [];
for (let i = 1; i <= 60; i++) await Leaderboard.submit('玩家' + i, i);
top = await Leaderboard.fetchTop();
assert.strictEqual(top.list.length, 50, '应截断为 50');
assert.strictEqual(top.list[0].score, 60, '最高分应为 60');
assert.strictEqual(top.list[49].score, 11, '第 50 名应为 11（1..10 被截掉）');
ok('Top50 截断正确（保留最高 50 分）');

// 非法分数兜底：清空后只提交一个非法分
store = [];
const bad = await Leaderboard.submit('零分', 'abc');
assert.strictEqual(bad.ok, true);
top = await Leaderboard.fetchTop();
const zero = top.list.find((r) => r.name === '零分');
assert.ok(zero && zero.score === 0, '非法分数应归 0');
ok('非法分数兜底为 0');

server.close();
console.log(`\nALL ${pass} PASSED`);
