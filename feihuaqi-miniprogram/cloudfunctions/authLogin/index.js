// 静默登录：换取 openid 并建立用户档案
// 设计要点：不调用 wx.getUserProfile，不做任何授权弹窗。
// 首版只拿 openid，昵称与头像等用户主动填写时再补齐，避免隐私协议审核风险。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

// 云开发不会自动创建集合，首次调用查询不存在的集合会抛 -502005。
// 与其让联调卡在「忘了建集合」，不如让函数自己补建一次。
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
      /* 已存在（-502002）或并发创建，均忽略 */
    }
  }
}

exports.main = async (event) => run(event, false);

async function run(event, retried) {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { code: 401, message: '无法获取用户标识' };
  }

  const now = Date.now();
  const users = db.collection('users');

  try {
    const exist = await users.where({ openid }).limit(1).get();
    if (exist.data.length) {
      const user = exist.data[0];
      await users.doc(user._id).update({
        data: { lastActiveAt: now, activeDays: _.inc(0) },
      });
      return { code: 0, openid, user };
    }

    const doc = {
      openid,
      nickname: '',
      title: '',
      school: '',
      channel: event.channel || 'direct',
      createdAt: now,
      lastActiveAt: now,
      bestScore: 0,
    };
    const added = await users.add({ data: doc });
    return { code: 0, openid, user: Object.assign({ _id: added._id }, doc) };
  } catch (err) {
    if (!retried && isMissingCollection(err)) {
      await ensureCollections();
      return run(event, true);
    }
    console.error('[authLogin] failed', err);
    return { code: 500, message: '登录失败' };
  }
}
