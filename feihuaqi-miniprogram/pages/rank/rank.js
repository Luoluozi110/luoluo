// 排行榜页
//
// 数据来自 getRank 云函数。刻意做到「云端不可用也能看」：
// 云环境没配好、网络失败、未开云开发时，页面转为离线态并展示本地最佳成绩，
// 而不是甩一个空白页或无限转圈 —— 联调阶段这能省下大量排查时间。

import { call } from '../../utils/cloud.js';
import { loadBestRun } from '../../engine/save.js';

const PAGE_SIZE = 20;

Page({
  data: {
    list: [],
    me: null,
    page: 1,
    loading: false,
    finished: false,
    offline: false,
    errorText: '',
    myLocalBest: 0,
  },

  onLoad() {
    this.setData({ myLocalBest: localBestScore() });
    this.load(1);
  },

  onPullDownRefresh() {
    this.load(1).then(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    if (this.data.finished || this.data.loading || this.data.offline) return;
    this.load(this.data.page + 1);
  },

  async load(page) {
    if (this.data.loading) return;
    this.setData({ loading: true, errorText: '' });

    try {
      const res = await call('getRank', { page });
      const incoming = Array.isArray(res.list) ? res.list : [];
      const list = page === 1 ? incoming : this.data.list.concat(incoming);
      this.setData({
        list,
        me: res.me || null,
        page,
        loading: false,
        offline: false,
        finished: incoming.length < PAGE_SIZE,
      });
    } catch (err) {
      // 离线降级：云不可用不该挡住玩家看自己的最好成绩
      const code = (err && err.code) || '';
      this.setData({
        loading: false,
        offline: true,
        finished: true,
        errorText:
          code === 'NO_CLOUD_ENV'
            ? '云环境尚未开通，榜单暂不可用'
            : '榜单读取失败，可下拉重试',
      });
    }
  },

  retry() {
    this.load(1);
  },

  back() {
    wx.navigateBack();
  },
});

/** 本地最佳成绩：优先读最近存档的历史最高分，兜底用上局的分数 */
function localBestScore() {
  try {
    const best = loadBestRun();
    const state = best && best.obj && best.obj.state;
    if (!state) return 0;
    const stats = state.stats || {};
    return Number(stats.maxTotal) || Number(state.lastTotal) || 0;
  } catch (err) {
    return 0;
  }
}
