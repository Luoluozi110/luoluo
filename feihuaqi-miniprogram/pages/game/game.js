// 对局页
//
// 本页是整个架构的性能关键，遵守三条铁律：
// 1) Game 实例挂在 this.game，绝不放进 data —— 它不参与渲染，不该被 setData 序列化。
// 2) 只有 project() 产出的视图模型才进 data。
// 3) 引擎的 UI 回调每回合会触发几十次（提示、状态、飘字），
//    绝不能逐条 setData；只挑结算与提示这类真正要显示的，回合结束后一次性提交。

import { startGame, playTurn, project, projectSummary } from '../../utils/engine-runtime.js';
import { silent } from '../../utils/cloud.js';

const AUTO_MAX_TURNS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Page({
  data: {
    vm: null,
    busy: false,
    running: false,
    summary: null,
    toast: '',
  },

  onLoad(query) {
    this.pendingToast = '';
    const schoolId = query && query.schoolId ? decodeURIComponent(query.schoolId) : '';
    try {
      const { game } = startGame({
        schoolId,
        playerName: '试笔',
        sink: (evt) => this.onEngineEvent(evt),
      });
      this.game = game;
      this.setData({ vm: project(game) });
    } catch (err) {
      console.error('[game] 开局失败', err);
      wx.showToast({ title: '开局失败', icon: 'none' });
    }
  },

  onUnload() {
    this.game = null;
  },

  onEngineEvent(evt) {
    if (evt.type === 'result') {
      const summary = projectSummary(evt.summary);
      this.setData({ summary });
      this.submitScore(evt.summary);
    } else if (evt.type === 'toast') {
      // 只保留最后一条提示，回合结束时随视图模型一起提交
      if (evt.text) this.pendingToast = evt.text;
    }
  },

  nextTurn() {
    if (this.data.busy || !this.game) return Promise.resolve();
    if (this.game.s && this.game.s.over) return Promise.resolve();
    this.setData({ busy: true });
    return playTurn(this.game)
      .catch((err) => console.error('[game] playTurn 失败', err))
      .then(() => this.flush());
  },

  // 自动推演到结算。第一周用它验证闭环；后续逐步替换为「掷骰 → 选格 → 作答」的真实交互。
  async autoRun() {
    if (this.data.running || !this.game) return;
    this.setData({ running: true, busy: true });

    let turns = 0;
    while (this.game && this.game.s && !this.game.s.over && turns < AUTO_MAX_TURNS) {
      await playTurn(this.game).catch((err) => {
        console.error('[game] playTurn 失败', err);
      });
      turns++;
      // 每 5 回合刷新一次界面并让出线程，避免长任务把渲染线程饿死
      if (turns % 5 === 0) {
        this.setData({ vm: project(this.game) });
        await sleep(0);
      }
    }
    this.flush();
    this.setData({ running: false });
  },

  flush() {
    if (!this.game) return;
    this.setData({
      vm: project(this.game),
      busy: false,
      toast: this.pendingToast,
    });
    this.pendingToast = '';
  },

  submitScore(summary) {
    if (!summary) return;
    const app = getApp();
    silent('submitScore', {
      score: Number(summary.total) || 0,
      grade: (summary.grade && summary.grade.id) || '',
      rounds: Number(summary.state && summary.state.turn) || 0,
      channel: app && app.globalData ? app.globalData.channel : 'direct',
    });
  },

  backToMenu() {
    wx.navigateBack();
  },

  onShareAppMessage() {
    const turn = this.data.vm ? this.data.vm.turn : 0;
    return {
      title: `我在文心棋走到第 ${turn} 回合，来比一比`,
      path: '/pages/index/index?ch=ingame_share',
    };
  },
});
