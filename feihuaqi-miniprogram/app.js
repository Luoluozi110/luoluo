// 文心棋小程序 · 入口
const storage = require('./utils/storage');
const cloudUtil = require('./utils/cloud');
const configLoader = require('./utils/config-loader');

// 在业务代码执行前把 localStorage 挂到全局，
// 使 js/engine 中的存档逻辑（save.js 等）无需任何改动即可工作。
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = storage;
}

// 主包配置：只放启动链路必需的部分，其余由分包自行注册。
configLoader.registerMany({
  talents: require('./config/talents.json'),
  synergies: require('./config/synergies.json'),
  npcs: require('./config/npcs.json'),
  board: require('./config/board.json'),
  numeric: require('./config/numeric.json'),
  attrs: require('./config/attrs.json'),
  grades: require('./config/grades.json'),
  inspiration: require('./config/inspiration.json'),
});

App({
  globalData: {
    openid: '',
    user: null,
    // 对局运行时引用。刻意不放进任何 Page 的 data，避免被 setData 序列化。
    engine: null,
    // 渠道来源，由分享卡片的 scene 解析而来，用于裂变归因
    channel: 'direct',
    cloudReady: false,
  },

  onLaunch(options) {
    this.globalData.channel = this.parseScene(options);
    cloudUtil.ensureEnv();
    this.login();
  },

  onShow(options) {
    // 从分享卡片进入时，scene 在 onShow 才能稳定拿到
    if (options && options.scene) {
      this.globalData.channel = this.parseScene(options);
    }
  },

  // scene 编码：1047/1048/1049 为分享入口，1001 为主入口，其余按渠道码透传
  parseScene(options) {
    if (!options) return 'direct';
    const scene = options.scene;
    if (scene === 1047 || scene === 1048 || scene === 1049) return 'share';
    if (scene === 1001) return 'direct';
    if (options.query && options.query.ch) return String(options.query.ch);
    return scene ? 'scene_' + scene : 'direct';
  },

  login() {
    const cached = storage.getItem('openid');
    if (cached) {
      this.globalData.openid = cached;
      this.globalData.cloudReady = true;
      return Promise.resolve(cached);
    }
    return cloudUtil
      .silent('authLogin', { channel: this.globalData.channel })
      .then((res) => {
        if (!res || !res.openid) return null;
        this.globalData.openid = res.openid;
        this.globalData.user = res.user || null;
        this.globalData.cloudReady = true;
        storage.setItem('openid', res.openid);
        return res.openid;
      })
      .catch(() => {
        // 登录失败只影响榜单与云存档，不阻断单机玩法
        this.globalData.cloudReady = false;
        return null;
      });
  },
});
