// 主菜单
// 入口顺序固定：开始游戏 / 继续游戏 / 入门卷 / 设置 / 说明
// 次级入口：传世名篇 · 图鉴阁 · 存档码 · 版本测试
const storage = require('../../utils/storage');
const cloudUtil = require('../../utils/cloud');

const SUBPKG = {
  album: '/pkg-codex/pages/album/album',
  codex: '/pkg-codex/pages/codex/codex',
  tutorial: '/pkg-meta/pages/tutorial/tutorial',
  settings: '/pkg-meta/pages/settings/settings',
};

Page({
  data: {
    hasRun: false,
    greeting: '',
    cloudReady: false,
  },

  onLoad() {
    this.refresh();
  },

  onShow() {
    // 从对局返回时「继续游戏」的可用性会变化
    this.refresh();
  },

  refresh() {
    const hasRun = !!storage.getItem('fhq_current_run');
    const app = getApp();
    this.setData({
      hasRun,
      greeting: this.buildGreeting(),
      cloudReady: !!(app && app.globalData.cloudReady),
    });
  },

  buildGreeting() {
    const hour = new Date().getHours();
    if (hour < 6) return '夜深人静，宜静心布局';
    if (hour < 11) return '晨光初照，正是开卷时';
    if (hour < 14) return '日正中天，笔力当盛';
    if (hour < 18) return '午后风清，宜推敲字句';
    return '灯火可亲，且下一局';
  },

  startGame() {
    wx.navigateTo({ url: '/pages/school/school' });
  },

  continueGame() {
    if (!this.data.hasRun) return;
    wx.navigateTo({ url: '/pages/game/game?mode=continue' });
  },

  openRank() {
    wx.navigateTo({ url: '/pages/rank/rank' });
  },

  openSub(e) {
    const key = e.currentTarget.dataset.key;
    const url = SUBPKG[key];
    if (!url) return;
    wx.navigateTo({
      url,
      fail: () => {
        // 分包未下载完成时兜底提示，不要静默失败
        wx.showToast({ title: '内容加载中，请稍候重试', icon: 'none' });
      },
    });
  },

  onShareAppMessage() {
    const app = getApp();
    const channel = (app && app.globalData.channel) || 'direct';
    return {
      title: '一局文心棋，看你能不能金榜题名',
      path: '/pages/index/index?ch=share_card',
      imageUrl: '',
    };
  },

  onShareTimeline() {
    return { title: '文心棋 · 科举题材的诗词棋局' };
  },

  // 首屏静默上报渠道，用于投放归因
  reportChannel() {
    const app = getApp();
    cloudUtil.silent('trackChannel', { channel: app && app.globalData.channel });
  },
});
