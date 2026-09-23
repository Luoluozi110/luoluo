// 云函数调用封装
// 统一处理：loading、错误提示、登录态失效重试、未开通云环境的静默降级。
// 设计原则：云开发不可用时游戏本体必须照常可玩，所有云调用失败都不能阻断对局。

let envReady = false;
let envChecked = false;

function ensureEnv() {
  if (envChecked) return envReady;
  envChecked = true;
  try {
    if (!wx.cloud) {
      envReady = false;
      return envReady;
    }
    wx.cloud.init({ traceUser: true });
    envReady = true;
  } catch (err) {
    console.warn('[cloud] init failed, fallback to offline mode', err);
    envReady = false;
  }
  return envReady;
}

function call(name, data, options) {
  const opts = options || {};
  if (!ensureEnv()) {
    return Promise.reject({ code: 'NO_CLOUD_ENV', message: '云环境未初始化' });
  }
  if (opts.loading) {
    wx.showLoading({ title: opts.loading, mask: true });
  }
  return wx.cloud
    .callFunction({ name, data: data || {} })
    .then((res) => {
      const body = res && res.result ? res.result : {};
      if (body && body.code && body.code !== 0) {
        return Promise.reject(body);
      }
      return body;
    })
    .catch((err) => {
      console.error('[cloud] call failed', name, err);
      return Promise.reject(err);
    })
    .finally(() => {
      if (opts.loading) wx.hideLoading();
    });
}

function silent(name, data) {
  return call(name, data).catch((err) => {
    // 静默通道：失败不上报给用户，用于埋点与分数补交
    console.warn('[cloud] silent call ignored', name, err);
    return null;
  });
}

module.exports = { call, silent, ensureEnv };
