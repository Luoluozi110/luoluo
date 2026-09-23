// 排行榜读取
// 榜单页会被高频访问，这里做两层设计：
// 1) 正常走 leaderboard 集合排序分页
// 2) 命中 topCache 集合时直接返回预热好的前 100 名，减少聚合开销
//
// 用户昵称从 users 集合补齐，避免把昵称冗余写进榜单导致改名后不同步。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const PAGE_SIZE = 20;
const CACHE_LIMIT = 100;

exports.main = async (event) => {
  const page = Math.max(1, Number(event.page) || 1);
  const openid = cloud.getWXContext().OPENID;

  try {
    if (page * PAGE_SIZE <= CACHE_LIMIT) {
      const cached = await db.collection('topCache').doc('top100').get().catch(() => null);
      if (cached && cached.data && Array.isArray(cached.data.list)) {
        return {
          code: 0,
          list: cached.data.list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
          me: await myRank(openid),
          cached: true,
        };
      }
    }

    const res = await db
      .collection('leaderboard')
      .orderBy('score', 'desc')
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .get();

    const openids = res.data.map((r) => r.openid);
    const users = openids.length
      ? await db.collection('users').where({ openid: db.command.in(openids) }).get()
      : { data: [] };
    const userMap = {};
    users.data.forEach((u) => {
      userMap[u.openid] = u;
    });

    const list = res.data.map((r, idx) => ({
      rank: (page - 1) * PAGE_SIZE + idx + 1,
      openid: r.openid,
      score: r.score,
      grade: r.grade || '',
      nickname: (userMap[r.openid] && userMap[r.openid].nickname) || '无名书生',
      title: (userMap[r.openid] && userMap[r.openid].title) || '',
    }));

    return { code: 0, list, me: await myRank(openid), cached: false };
  } catch (err) {
    console.error('[getRank] failed', err);
    return { code: 500, message: '榜单读取失败', list: [] };
  }
};

async function myRank(openid) {
  if (!openid) return null;
  const better = await db
    .collection('leaderboard')
    .where({ score: db.command.gt(0) })
    .orderBy('score', 'desc')
    .get()
    .catch(() => null);
  if (!better) return null;
  const idx = better.data.findIndex((r) => r.openid === openid);
  if (idx === -1) return null;
  return { rank: idx + 1, score: better.data[idx].score };
}
