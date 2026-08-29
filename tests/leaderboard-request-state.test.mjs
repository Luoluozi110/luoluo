// leaderboard-request-state.test.mjs —— 云端排行榜请求的成功、失败与超时回归
import assert from 'node:assert/strict';

globalThis.window = {
  LEADERBOARD_CFG: {
    backend: 'supabase',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'sb_publishable_TESTKEY',
    table: 'leaderboard',
    requestTimeoutMs: 30
  }
};

const { Leaderboard } = await import('../js/ui/leaderboard.js');
await Leaderboard.init(null);

// 成功：请求完成并返回标准结果，调用方可结束“读取中”状态。
globalThis.fetch = async () => ({
  ok: true,
  status: 200,
  json: async () => [{ name: '甲', score: 88, ts: '2026-01-01T00:00:00Z' }]
});
let result = await Leaderboard.fetchTop();
assert.equal(result.ok, true);
assert.equal(result.list[0].name, '甲');

// 失败：网络异常应被归一化为可展示的错误结果，不向 UI 抛出未处理异常。
globalThis.fetch = async () => { throw new TypeError('network offline'); };
result = await Leaderboard.fetchTop();
assert.equal(result.ok, false);
assert.match(result.error, /网络请求失败/);

// 超时：悬挂的 fetch 必须在配置的超时后返回，避免弹窗永久停在“读取中”。
globalThis.fetch = () => new Promise(() => {});
const startedAt = Date.now();
result = await Leaderboard.fetchTop();
const elapsed = Date.now() - startedAt;
assert.equal(result.ok, false);
assert.match(result.error, /请求超时/);
assert.ok(elapsed >= 20 && elapsed < 500, `超时应及时结束，实际 ${elapsed}ms`);

console.log('leaderboard-request-state.test.mjs: success / failure / timeout passed');
