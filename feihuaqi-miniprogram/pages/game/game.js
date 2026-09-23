// 对局页
//
// 本页是整个架构的性能关键，遵守三条铁律：
// 1) 引擎实例挂在 this.engine，绝不放进 this.data —— 它不参与渲染，不该被序列化。
// 2) 只有 project() 产出的视图模型才进 data，且尽量用路径做增量更新。
// 3) 一次玩家操作只产生一次 setData，动画期间的中间态不上报。

const { createEngine, project } = require('../../utils/engine-host');
const storage = require('../../utils/storage');
const cloudUtil = require('../../utils/cloud');

Page({
  data: {
    vm: null,
    busy: false,
    lastStep: 0,
  },

  onLoad(query) {
    // 非响应式字段：引擎、脏标记、动画计时器
    this.engine = createEngine({ seed: Date.now() % 1000 });
    this.pending = false;
    this.mode = query && query.mode === 'continue' ? 'continue' : 'new';

    if (this.mode === 'continue') {
      this.restore();
    }
    this.flush();
  },

  onUnload() {
    this.persist();
  },

  onHide() {
    // 用户切后台时落盘，防止对局丢失
    this.persist();
  },

  // 把引擎状态投影进 data。全量刷新只在初始化与恢复存档时使用。
  flush() {
    this.setData({ vm: project(this.engine.state) });
  },

  // 增量更新：动作类交互只改动几个字段，避免整体重传 tiles
  patch(fields) {
    const payload = {};
    Object.keys(fields).forEach((key) => {
      payload['vm.' + key] = fields[key];
    });
    this.setData(payload);
  },

  roll() {
    if (this.data.busy) return;
    this.setData({ busy: true });

    const step = this.engine.roll();
    const vm = project(this.engine.state);

    // 合并成一次 setData：棋盘落点 + 数值 + 阶段同时更新
    this.setData(
      {
        vm,
        lastStep: step,
      },
      () => {
        // 渲染完成后再解除锁定，避免连点导致状态错乱
        setTimeout(() => this.setData({ busy: false }), 320);
      }
    );

    this.persist();
  },

  persist() {
    try {
      storage.setItem(
        'fhq_current_run',
        JSON.stringify({
          t: Date.now(),
          s: this.engine.state,
        })
      );
    } catch (err) {
      console.error('[game] persist failed', err);
    }
  },

  restore() {
    const raw = storage.getItem('fhq_current_run');
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.s) this.engine.state = parsed.s;
    } catch (err) {
      console.warn('[game] restore failed, start new run', err);
    }
  },

  openMenu() {
    wx.showActionSheet({
      itemList: ['保存进度', '返回主菜单'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.persist();
          wx.showToast({ title: '已存档', icon: 'success' });
        } else if (res.tapIndex === 1) {
          this.persist();
          wx.navigateBack();
        }
      },
      fail: () => {},
    });
  },

  // 结算后提交分数：静默通道，失败不影响本机体验
  submitScore(result) {
    const app = getApp();
    cloudUtil.silent('submitScore', {
      score: result.score,
      grade: result.grade,
      rounds: result.rounds,
      channel: app && app.globalData.channel,
    });
  },

  onShareAppMessage() {
    return {
      title: `我在文心棋第 ${this.data.vm ? this.data.vm.round : 0} 回合，来比一比`,
      path: '/pages/index/index?ch=ingame_share',
    };
  },
});
