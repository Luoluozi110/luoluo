// 渠道归因：记录新用户来自哪个入口
// scene 由小程序端解析后传入，这里只做累加，用于判断投放与分享裂变的真实效果。

const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const channel = String(event.channel || 'direct');
  const openid = cloud.getWXContext().OPENID || '';
  const today = new Date().toISOString().slice(0, 10);

  try {
    await db.collection('channelDaily').doc(today + '_' + channel).set({
      data: {
        date: today,
        channel,
        count: _.inc(1),
        uv: _.inc(openid ? 0 : 1),
        updatedAt: Date.now(),
      },
    });
    return { code: 0 };
  } catch (err) {
    console.error('[trackChannel] failed', err);
    return { code: 500 };
  }
};
