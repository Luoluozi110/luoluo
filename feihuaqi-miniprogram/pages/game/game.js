// 对局页
//
// 本页是整个架构的性能关键，遵守三条铁律：
// 1) Game 实例挂在 this.game，绝不放进 data —— 它不参与渲染，不该被 setData 序列化。
// 2) 只有 project() 产出的视图模型才进 data。
// 3) 引擎的 UI 回调每回合会触发几十次（提示、状态、飘字），
//    绝不能逐条 setData；只挑结算与提示这类真正要显示的，回合结束后一次性提交。
//
// 玩家决策走「挂起通道」：适配器发 request 事件并 await，
// 本页渲染对话框、玩家操作后调用 evt.resolve(value)，引擎才继续。
// 未实装的对话框返回 false，由适配器回退自动应答，链路不会卡死。

import { startGame, playTurn, project, projectSummary } from '../../utils/engine-runtime.js';
import { silent } from '../../utils/cloud.js';

const AUTO_MAX_TURNS = 400;

// 已实现真实界面的对话框；其余交给自动应答兜底
const HANDLED = ['quiz', 'battle', 'event', 'sky', 'bowen', 'replaceTalent'];

// 战斗台六步：遭遇 → 审题 → 选文体 → 选风格 → 掷灵感骰 → 算分对决
const BATTLE_STEP = {
  ENCOUNTER: 'encounter',
  STYLE: 'style',
  MANNER: 'manner',
  DICE: 'dice',
  RESULT: 'result',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

Page({
  data: {
    vm: null,
    busy: false,
    running: false,
    summary: null,
    toast: '',
    dialog: null,
  },

  onLoad(query) {
    this.pendingToast = '';
    this.pendingResolve = null;
    this.raw = null;
    this.battleOut = null;
    this.battleStyle = '';
    this.battleManner = '';

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

  /**
   * 事件出口。request 事件必须返回 true/false：
   * true = 本页接管，引擎等待玩家；false = 交给自动应答。
   */
  onEngineEvent(evt) {
    if (evt.type === 'request') return this.onRequest(evt);
    if (evt.type === 'result') {
      this.setData({ summary: projectSummary(evt.summary), dialog: null });
      this.submitScore(evt.summary);
    } else if (evt.type === 'toast') {
      if (evt.text) this.pendingToast = evt.text;
    }
    return undefined;
  },

  onRequest(evt) {
    if (HANDLED.indexOf(evt.key) < 0) return false;

    this.pendingResolve = evt.resolve;
    this.raw = evt.raw;
    this.battleOut = null;
    this.battleStyle = '';
    this.battleManner = '';

    const dialog = {
      key: evt.key,
      step: evt.key === 'battle' ? BATTLE_STEP.ENCOUNTER : 'main',
      view: evt.view,
      selected: -1,
      pips: [],
      diceScore: 0,
      extraCost: 0,
      result: null,
    };
    this.setData({ dialog });
    return true;
  },

  /* ---------------- 对话框通用 ---------------- */

  selectOption(e) {
    this.setData({ 'dialog.selected': Number(e.currentTarget.dataset.index) || 0 });
  },

  confirmDialog() {
    const dialog = this.data.dialog;
    if (!dialog) return;
    const key = dialog.key;

    if (key === 'quiz') {
      this.resolveDialog({
        index: dialog.selected >= 0 ? dialog.selected : 0,
        timedOut: false,
      });
    } else if (key === 'event') {
      this.resolveDialog(dialog.selected >= 0 ? dialog.selected : 0);
    } else if (key === 'sky') {
      this.resolveDialog(undefined);
    } else if (key === 'bowen') {
      this.resolveDialog(dialog.selected === 0 ? 'focus' : dialog.selected === 1 ? 'battle' : 'broad');
    } else if (key === 'replaceTalent') {
      this.resolveDialog(dialog.selected >= 0 ? dialog.selected : null);
    } else if (key === 'battle') {
      this.resolveDialog(this.battleOut);
    }
  },

  resolveDialog(value) {
    const fn = this.pendingResolve;
    this.pendingResolve = null;
    this.raw = null;
    this.battleOut = null;
    const patch = { dialog: null };
    if (this.pendingToast) {
      patch.toast = this.pendingToast;
      this.pendingToast = '';
    }
    this.setData(patch);
    if (fn) fn(value);
  },

  /* ---------------- 战斗台 ---------------- */

  battleNext() {
    const step = this.data.dialog && this.data.dialog.step;
    if (step === BATTLE_STEP.ENCOUNTER) {
      this.setData({ 'dialog.step': BATTLE_STEP.STYLE });
    }
  },

  pickStyle(e) {
    const key = e.currentTarget.dataset.key;
    if (this.raw && typeof this.raw.canUseStyle === 'function' && !this.raw.canUseStyle(key)) {
      wx.showToast({ title: '此体尚不可用', icon: 'none' });
      return;
    }
    this.battleStyle = key;
    this.setData({
      'dialog.pickedStyle': key,
      'dialog.step': BATTLE_STEP.MANNER,
    });
  },

  pickManner(e) {
    this.battleManner = e.currentTarget.dataset.key;
    this.setData({
      'dialog.pickedManner': this.battleManner,
      'dialog.step': BATTLE_STEP.DICE,
    });
  },

  rollDice() {
    const pip = 1 + Math.floor(Math.random() * 6);
    const pips = (this.data.dialog.pips || []).concat([pip]);
    this.setData({ 'dialog.pips': pips });
    this.refreshDicePreview(pips);
  },

  // 追加灵感骰：先扣灵感，成功才掷
  extraDice() {
    const session = this.raw;
    const pips = this.data.dialog.pips || [];
    if (!session || !pips.length) return;
    const cost = Number(session.extraDiceCost(this.battleStyle, pips.length, pips)) || 0;
    if (typeof session.spendExtraDice !== 'function' || !session.spendExtraDice(cost)) {
      wx.showToast({ title: '灵感不足', icon: 'none' });
      return;
    }
    const pip = 1 + Math.floor(Math.random() * 6);
    const next = pips.concat([pip]);
    this.setData({ 'dialog.pips': next });
    this.refreshDicePreview(next);
  },

  refreshDicePreview(pips) {
    const session = this.raw;
    if (!session || !pips.length) return;
    const score = session.previewDiceScore
      ? Math.round(Number(session.previewDiceScore(this.battleStyle, pips)) || 0)
      : 0;
    const cost = Number(session.extraDiceCost(this.battleStyle, pips.length, pips)) || 0;
    this.setData({ 'dialog.diceScore': score, 'dialog.extraCost': cost });
  },

  finishBattle() {
    const pips = this.data.dialog.pips || [];
    if (!pips.length || !this.raw) {
      wx.showToast({ title: '先掷灵感骰', icon: 'none' });
      return;
    }
    const out = this.raw.resolve(this.battleStyle, this.battleManner, pips);
    this.battleOut = out;
    this.setData({
      'dialog.step': BATTLE_STEP.RESULT,
      'dialog.result': {
        result: out && out.result,
        resultText: out && out.result === 'win' ? '胜' : out && out.result === 'lose' ? '负' : '平',
        self: Math.round(Number(out && out.selfCalc && out.selfCalc.total) || 0),
        opp: Math.round(Number(out && out.oppCalc && out.oppCalc.total) || 0),
      },
    });
  },

  /* ---------------- 回合推进 ---------------- */

  nextTurn() {
    if (this.data.busy || !this.game || this.data.dialog) return Promise.resolve();
    if (this.game.s && this.game.s.over) return Promise.resolve();
    this.setData({ busy: true });
    return playTurn(this.game)
      .catch((err) => console.error('[game] playTurn 失败', err))
      .then(() => this.flush());
  },

  // 自动推演：遇到对话框时由适配器自动应答兜底，用于快速验证链路
  async autoRun() {
    if (this.data.running || !this.game) return;
    this.setData({ running: true, busy: true });

    let turns = 0;
    while (this.game && this.game.s && !this.game.s.over && turns < AUTO_MAX_TURNS) {
      await playTurn(this.game).catch((err) => console.error('[game] playTurn 失败', err));
      turns++;
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
