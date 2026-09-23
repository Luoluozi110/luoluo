// localStorage 同步适配器
// 目的：让 js/engine 里 66 处 localStorage 调用原样可用，不必改动引擎代码。
// 小程序没有 Web Storage，但 wx.getStorageSync / wx.setStorageSync 是同步 API，
// 语义上可以做到一一对应，因此在 App 启动时把它挂到全局即可。

const PREFIX = 'fhq_';

function safeKey(key) {
  return PREFIX + String(key);
}

const storage = {
  getItem(key) {
    try {
      const value = wx.getStorageSync(safeKey(key));
      // Web Storage 语义：键不存在返回 null
      return value === '' || value === undefined ? null : value;
    } catch (err) {
      console.error('[storage] getItem failed', key, err);
      return null;
    }
  },

  setItem(key, value) {
    try {
      wx.setStorageSync(safeKey(key), value);
    } catch (err) {
      // 超出 10MB 配额时降级：优先保留存档，丢弃统计类数据
      console.error('[storage] setItem failed', key, err);
    }
  },

  removeItem(key) {
    try {
      wx.removeStorageSync(safeKey(key));
    } catch (err) {
      console.error('[storage] removeItem failed', key, err);
    }
  },

  clear() {
    try {
      wx.clearStorageSync();
    } catch (err) {
      console.error('[storage] clear failed', err);
    }
  },

  // 配额诊断：存档写不进去时用于提示用户清理
  usage() {
    try {
      const { currentSize, limitSize } = wx.getStorageInfoSync();
      return { currentSize, limitSize };
    } catch (err) {
      return { currentSize: -1, limitSize: -1 };
    }
  },
};

module.exports = storage;
