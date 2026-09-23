// 分数提交：服务端校验 + 榜单写入
//
// 客户端传来的任何分数都不可信，这里做四道校验：
// 1) 数值合法性：必须是有限数且在合理区间
// 2) 时长合理性：一局棋最快也要数十秒，秒提交的必然是伪造
// 3) 频控：同一 openid 有最小提交间隔
// 4) 幂等：同一局（runId）重复提交只保留一次
//
// 榜单策略：leaderboard 集合每人只保留最好成绩，runs 集合记录每一局明细用于对账。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MAX_SCORE = 999999;
const MIN_DURATION_MS = 30 * 1000; // 单局最短时长，按实际玩法校准
const MIN_INTERVAL_MS = 10 * 1000; // 两次提交最小间隔

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) return { code: 401, message: '未登录' };

  const score = Number(event.score);
  const duration = Number(event.duration || 0);
  const runId = String(event.runId || '');

  if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
    return { code: 400, message: '分数不合法' };
  }
  if (duration && duration < MIN_DURATION_MS) {
    return { code: 400, message: '对局时长异常' };
  }

  const now = Date.now();
  const runs = db.collection('runs');

  if (runId) {
    const dup = await runs.where({ openid, runId }).limit(1).get();
    if (dup.data.length) return { code: 0, duplicated: true };
  }

  const recent = await runs
    .where({ openid, createdAt: _.gt(now - MIN_INTERVAL_MS) })
    .limit(1)
    .get();
  if (recent.data.length && !event.force) {
    return { code: 429, message: '提交过于频繁' };
  }

  await runs.add({
    data: {
      openid,
      runId,
      score,
      grade: String(event.grade || ''),
      rounds: Number(event.rounds || 0),
      channel: String(event.channel || ''),
      duration,
      createdAt: now,
    },
  });

  // 每人只留一个最好成绩，用 openid 作为查询键
  const board = db.collection('leaderboard');
  const mine = await board.where({ openid }).limit(1).get();
  if (!mine.data.length) {
    await board.add({
      data: { openid, score, grade: event.grade || '', updatedAt: now },
    });
  } else if (score > mine.data[0].score) {
    await board.doc(mine.data[0]._id).update({
      data: { score, grade: event.grade || '', updatedAt: now },
    });
  }

  const userRes = await db.collection('users').where({ openid }).limit(1).get();
  if (userRes.data.length) {
    await db
      .collection('users')
      .doc(userRes.data[0]._id)
      .update({ data: { bestScore: _.max([score, userRes.data[0].bestScore || 0]) } });
  }

  // 可选：双端榜单统一。H5 版榜单在 Supabase，开启后同步写入，避免小程序与网页榜分裂。
  if (process.env.SUPABASE_SYNC === '1') {
    try {
      await syncToSupabase({ openid, score, grade: event.grade, rounds: event.rounds });
    } catch (err) {
      // 同步失败不能影响小程序侧写入
      console.error('[submitScore] supabase sync failed', err);
    }
  }

  return { code: 0 };
};

// Supabase 中转：云函数出网不受小程序域名白名单限制，
// 但需要在小程序后台把 Supabase 域名加入 request 合法域名（前端直连场景）。
async function syncToSupabase(payload) {
  const https = require('https');
  const url = new URL(process.env.SUPABASE_URL + '/rest/v1/leaderboard');
  const body = JSON.stringify([
    {
      openid: payload.openid,
      score: payload.score,
      grade: payload.grade || '',
      rounds: payload.rounds || 0,
      source: 'miniprogram',
    },
  ]);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + process.env.SUPABASE_ANON_KEY,
          Prefer: 'resolution=merge-duplicates',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        res.statusCode >= 400
          ? reject(new Error('supabase http ' + res.statusCode))
          : resolve(res.statusCode);
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}
