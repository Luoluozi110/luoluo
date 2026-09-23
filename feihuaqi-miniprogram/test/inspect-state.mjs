// 静默登录：换取 openid 并建立用户档案
// 设计要点：不调用 wx.getUserProfile，不做任何授权弹窗。
// 首版只拿 openid，昵称与头像等用户主动填写时再补齐，避免隐私协议审核风险。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
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
    console.error('[authLogin] failed', err);
    return { code: 500, message: '登录失败' };
  }
};
