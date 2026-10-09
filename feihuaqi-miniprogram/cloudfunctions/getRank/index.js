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

// 集合缺失时补建再重试，避免联调卡在「忘了建集合」
const COLLECTIONS = ['users', 'runs', 'leaderboard', 'channelDaily', 'channelVisits'];

function isMissingCollection(err) {
  if (!err) return false;
  return err.errCode === -502005 || /collection not exists/i.test(String(err.message || ''));
}

async function ensureCollections() {
  for (const name of COLLECTIONS) {
    try {
      await db.createCollection(name);
    } catch (e) {
      /* 已存在，忽略 */
    }
  }
}

exports.main = async (event) => run(event, false);

async function run(event, retried) {
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
    if (!retried && isMissingCollection(err)) {
      await ensureCollections();
      return run(event, true);
    }
    console.error('[getRank] failed', err);
    return { code: 500, message: '榜单读取失败', list: [] };
  }
}

/**
 * 自己的名次。
 *
 * 这里刻意不用「拉全表再 findIndex」——云开发单次 get 有条数上限，
 * 榜单一大就会截断，名次随之算错，而且每次请求都做一次全表扫描。
 * 改成两步轻量查询：先取自己的分数，再数比它高的人有几个。
 */
async function myRank(openid) {
  if (!openid) return null;
  const mine = await db.collection('leaderboard').where({ openid }).limit(1).get().catch(() => null);
  if (!mine || !mine.data.length) return null;

  const score = Number(mine.data[0].score) || 0;
  const higher = await db
    .collection('leaderboard')
    .where({ score: db.command.gt(score) })
    .count()
    .catch(() => null);

  const higherCount = (higher && Number(higher.total)) || 0;
  return { rank: higherCount + 1, score };
}
