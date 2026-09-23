// 选流派页
// 开局链第一站：主菜单 → 选流派 → 对局
import { listSchools } from '../../utils/engine-runtime.js';

Page({
  data: {
    schools: [],
    loading: true,
  },

  onLoad() {
    // 流派是纯文案配置，listSchools 直接读原始 JSON，不触发昂贵的归一化
    const schools = listSchools();
    this.setData({ schools, loading: false });
  },

  choose(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    wx.navigateTo({ url: `/pages/game/game?schoolId=${encodeURIComponent(id)}` });
  },

  back() {
    wx.navigateBack();
  },
});
