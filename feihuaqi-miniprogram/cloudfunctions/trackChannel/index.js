// 渠道归因：记录新用户来自哪个入口
// scene 由小程序端解析后传入，这里只做累加，用于判断投放与分享裂变的真实效果。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 集合缺失时补建再重试
const COLLECTIONS = ['channelDaily', 'channelVisits', 'users', 'runs', 'leaderboard'];

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
  const channel = String(event.channel || 'direct');
  const openid = cloud.getWXContext().OPENID || '';
  const today = new Date().toISOString().slice(0, 10);

  try {
    // count 是每次调用都累加（PV 语义）；uv 只在「当日该用户首次出现」时 +1。
    // 原先写成 openid ? 0 : 1，等于把有身份的用户排除在 UV 之外，且不去重。
    let isNewVisitor = false;
    if (openid) {
      const visitId = `${today}_${openid}`;
      const seen = await db.collection('channelVisits').doc(visitId).get().catch(() => null);
      if (!seen || !seen.data) {
        await db
          .collection('channelVisits')
          .doc(visitId)
          .set({ data: { date: today, openid, channel, at: Date.now() } });
        isNewVisitor = true;
      }
    }

    await db.collection('channelDaily').doc(`${today}_${channel}`).set({
      data: {
        date: today,
        channel,
        count: _.inc(1),
        uv: _.inc(isNewVisitor ? 1 : 0),
        updatedAt: Date.now(),
      },
    });
    return { code: 0, newVisitor: isNewVisitor };
  } catch (err) {
    if (!retried && isMissingCollection(err)) {
      await ensureCollections();
      return run(event, true);
    }
    console.error('[trackChannel] failed', err);
    return { code: 500 };
  }
}
