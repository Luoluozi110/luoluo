/**
 * game.js —— 单人对局引擎（无 DOM）。所有表现通过注入的 ui 适配器完成。
 * 规则依据：全案 3.1–3.8。战斗与评分公式一律调用 rules.js。
 */
import * as R from './rules.js';
import * as Album from './album.js';
import * as Codex from './codex.js';
import { Reincarnate, REINCARNATE_KEY } from './reincarnate.js?v=20260824reincarnate2';
import * as NpcSelection from './npc-selection.js';
import { stableFoeId } from './npc-selection.js';

export { Reincarnate, REINCARNATE_KEY } from './reincarnate.js?v=20260824reincarnate2';

export const PASSIVE_MAX = 8;
export const ACTIVE_MAX = 4;
export const TURN_LIMIT = 84;

/**
 * 殿试跨场适应状态键：殿试三场视作同一「考官席」互通声气地跨场适应，
 * 故层数按整段殿试（而非单个考官 foeId）分桶。sig_palace_adapt 的
 * weaknessDampen / minWeaknessRetention / maxLayers 皆由此键下的 palaceAdapt 驱动。
 */
const PALACE_KEY = '__palace__';

export class Game {
  constructor(cfg, ui, rand = Math.random) {
    this.cfg = cfg;
    this.ui = ui;
    this.rand = rand;
    // 运行时兜底：即使调用方传入的是旧格式 session，也不能对同一对象重复结算。
    this._settledBattleSessions = new WeakSet();
    this.d6 = () => 1 + Math.floor(this.rand() * 6);
  }

  /**
   * 由流派熟练度等级增强后的机制（基准为 school.schoolMechanics）。
   * 所有机制消费点统一走本方法 → 改一处即全游戏生效。
   * 等级 1 = 与现网完全一致；等级越高，机制越贴合该派性格。
   */
  schoolMechanics(school = this.s && this.s.school) {
    const base = (school && school.schoolMechanics) || {};
    const lv = Math.max(1, Math.min(Album.MASTERY_LEVELS, Number(this.masteryLevel) || 1));
    if (lv <= 1 || !school) return base;
    return Album.applyMasteryMechanics(base, school.id, lv);
  }

  async gainBowenKnowledge(reason) {
    const mech = this.schoolMechanics();
    if (mech.type !== 'bowen') return false;
    const s = this.s;
    const st = s.schoolState || (s.schoolState = this.createSchoolState(s.school));
    st.knowledge = (Number(st.knowledge) || 0) + 1;
    const threshold = Math.max(1, Number(mech.knowledgeThreshold) || 2);
    const pity = Number(mech.knowledgePityTurn) || 3;
    if (st.knowledge < threshold && !(s.turn <= pity && !st.knowledgeTriggered)) return false;
    st.knowledge = 0;
    st.knowledgeTriggered = true;
    // 方案 B：知识转化为可分配心得，不再自动把成长灌入某个文体。
    if (mech.knowledgeInsight != null) {
      const gained = this.gainInsight((Number(mech.knowledgeInsight) || 0) + (Number(mech.knowledgeInsightBonus) || 0), `博闻·融会${reason ? `（${reason}）` : ''}`);
      this.push(`博闻·融会：心得 +${gained}`);
      this.ui.toast(`博闻融会：心得 +${gained}，可在「修习」中分配`);
      return true;
    }
    const choice = this.ui.showBowenChoice ? await this.ui.showBowenChoice() : 'broad';
    if (choice === 'focus') {
      const key = R.CREATIVE_KEYS.slice().sort((a, b) => (s.attrs[a] || 0) - (s.attrs[b] || 0))[0];
      this.addAttrs({ [key]: 3 }, { noSchoolGrowth: true, reason: '博闻·专攻一体' });
      st.bowenFocus = key;
      this.push(`博闻·专攻一体：${R.ATTR_NAMES[key]} +3${reason ? `（${reason}）` : ''}`);
    } else if (choice === 'battle') {
      this.addAttrs({ xue: 2 }, { noSchoolGrowth: true, reason: '博闻·以学驭战' });
      this.addInspiration(2, '博闻·以学驭战');
      st.bowenBattleHint = true;
      this.push(`博闻·以学驭战：学力 +2，灵感 +2`);
    } else {
      this.addAttrs({ shi: 1, ci: 1, lian: 1 }, { noSchoolGrowth: true, reason: '博闻·兼收并蓄' });
      st.bowenBroad = true;
      this.push(`博闻·兼收并蓄：三体各 +1${reason ? `（${reason}）` : ''}`);
    }
    // 博闻 Lv5 宗师点睛：每次触发额外沉淀 +知识BonusGain 学力（厚积薄发）
    const bonusGain = Number(mech.knowledgeBonusGain) || 0;
    if (bonusGain > 0) {
      this.addAttrs({ xue: bonusGain }, { noSchoolGrowth: true, reason: '博闻·宗师沉潜' });
      this.push(`博闻·宗师沉潜：学力 +${bonusGain}`);
    }
    this.ui.toast(`博闻抉择已兑现：${choice === 'focus' ? '专攻一体' : choice === 'battle' ? '以学驭战' : '兼收并蓄'}`);
    return true;
  }

  createSchoolState(school) {
    const mech = this.schoolMechanics(school);
    return {
      type: mech.type || school.id,
      knowledge: 0,
      knowledgeTriggered: false,
      inspirationAccumulator: 0,
      qishiTalentDropObtained: false,
      battleSeq: 0,
      settledBattleIds: []
    };
  }

  /* -------------------------------------------------- 方案 B：三功系统 */
  abilityConfig() { return ((this.cfg.attrs || {}).abilitySystem || {}); }
  styleConfig() { return ((this.cfg.attrs || {}).styleSystem || {}); }
  techniqueConfig() { return ((this.cfg.attrs || {}).techniqueSystem || { version: 1, thresholds: [], nodes: {} }); }

  studySlots(attrs = this.s && this.s.attrs, school = this.s && this.s.school) {
    const c = this.abilityConfig().study || {};
    const mech = this.schoolMechanics(school);
    const albumPlus = Number(this.s && this.s.albumState && this.s.albumState.flags && this.s.albumState.flags.studySlotPlus) || 0;
    return Math.max(1, Math.min(Number(c.maxSlots) || 3,
      (Number(c.baseSlots) || 1) + Math.floor((Number(attrs && attrs.xue) || 0) / (Number(c.slotPerXue) || 12)) + (Number(mech.studySlotsPlus) || 0) + albumPlus));
  }

  insightCap(attrs = this.s && this.s.attrs) {
    const c = this.abilityConfig().study || {};
    return Math.max(1, (Number(c.baseInsightCap) || 6) + Math.floor((Number(attrs && attrs.xue) || 0) / (Number(c.insightCapPerXue) || 4)));
  }

  studyProgressRate(attrs = this.s && this.s.attrs) {
    const c = this.abilityConfig().study || {};
    const rate = 1 + (Number(attrs && attrs.xue) || 0) * (Number(c.progressPerXue) || 0.04);
    return Math.round(Math.min(2, Math.max(1, rate)) * 100) / 100;
  }

  strategyPlans() {
    const plans = this.abilityConfig().strategy?.plans;
    return plans && typeof plans === 'object' ? plans : {};
  }

  strategyDefaultPlan() {
    const c = this.abilityConfig().strategy || {};
    const ids = Object.keys(this.strategyPlans());
    return ids.includes(c.defaultPlan) ? c.defaultPlan : (ids[0] || 'guard');
  }

  strategyCap(attrs = this.s && this.s.attrs, school = this.s && this.s.school) {
    const c = this.abilityConfig().strategy || {};
    const mech = this.schoolMechanics(school);
    const albumPlus = Number(this.s && this.s.albumState && this.s.albumState.flags && this.s.albumState.flags.strategyCapPlus) || 0;
    const raw = (Number(c.maxCharges) || 3)
      + Math.floor((Number(attrs && attrs.si) || 0) / (Number(c.capPerSi) || 10))
      + (Number(mech.strategyMaxPlus) || 0) + albumPlus;
    return Math.max(1, Math.min(Number(c.maxCap) || 6, raw));
  }

  strategyIncome(attrs = this.s && this.s.attrs, school = this.s && this.s.school) {
    const c = this.abilityConfig().strategy || {};
    const mech = this.schoolMechanics(school);
    const charges = (Number(c.baseCharges) || 1)
      + (Number(attrs && attrs.si) || 0) / (Number(c.chargePerSi) || 10)
      + (Number(mech.strategyChargePlus) || 0);
    return Math.round(Math.max(1, charges) * 100) / 100;
  }

  manuscriptCap(attrs = this.s && this.s.attrs, school = this.s && this.s.school) {
    const c = this.abilityConfig().manuscript || {};
    const mech = this.schoolMechanics(school);
    return Math.max(1, Math.min(Number(c.maxCap) || 6,
      (Number(c.baseCap) || 2) + Math.floor((Number(attrs && attrs.bi) || 0) / (Number(c.capPerBi) || 6)) + (Number(mech.manuscriptCapPlus) || 0)));
  }

  manuscriptFragmentRate(attrs = this.s && this.s.attrs) {
    const c = this.abilityConfig().manuscript || {};
    const rate = (Number(attrs && attrs.bi) || 0) * (Number(c.fragmentPerBi) || 0.05);
    return Math.round(Math.min(1.5, Math.max(0, rate)) * 100) / 100;
  }

  abilityFeedback() {
    const attrs = this.s && this.s.attrs || {};
    const study = this.abilityConfig().study || {};
    const strategy = this.abilityConfig().strategy || {};
    const manuscript = this.abilityConfig().manuscript || {};
    const xue = Number(attrs.xue) || 0;
    const si = Number(attrs.si) || 0;
    const bi = Number(attrs.bi) || 0;
    const slotMilestones = Array.isArray(study.slotMilestones) ? study.slotMilestones.map(Number).filter(Number.isFinite) : [10, 20];
    const nextSlot = slotMilestones.find(v => xue < v);
    const nextCap = Math.floor(xue / (Number(study.insightCapPerXue) || 3) + 1) * (Number(study.insightCapPerXue) || 3);
    const a = this.ensureAbilityState();
    return {
      studyRate: this.studyProgressRate(),
      studySlots: this.studySlots(),
      insightCap: this.insightCap(),
      nextStudySlotIn: nextSlot == null ? 0 : Math.max(0, nextSlot - xue),
      nextInsightCapIn: Math.max(0, nextCap - xue),
      strategyIncome: this.strategyIncome(),
      strategyCap: this.strategyCap(),
      strategyRemainder: Number(a && a.strategy && a.strategy.chargeRemainder) || 0,
      manuscriptFragmentRate: this.manuscriptFragmentRate(),
      manuscriptCap: this.manuscriptCap(),
      nextManuscriptCapIn: Math.max(0, (Math.floor(bi / (Number(manuscript.capPerBi) || 6)) + 1) * (Number(manuscript.capPerBi) || 6) - bi),
      attrs: { xue, si, bi },
      config: { study, strategy, manuscript }
    };
  }

  createAbilityState(attrs, school) {
    const first = R.CREATIVE_KEYS.slice().sort((a, b) => (Number(attrs && attrs[a]) || 0) - (Number(attrs && attrs[b]) || 0))[0] || 'shi';
    const tc = this.techniqueConfig();
    return {
      version: Number(this.abilityConfig().version) || 1,
      insight: 0,
      familiarity: { shi: 0, ci: 0, lian: 0 },
      study: { focus: [first], nextFocus: [first], progress: {} },
      strategy: { charges: 0, chargeRemainder: 0, refillPhase: '', plan: this.strategyDefaultPlan(), nextPlan: this.strategyDefaultPlan(), freeUsed: false },
      manuscript: { pages: 0, fragments: 0, volumes: 0, polish: 0, bonusPagePhases: {}, schoolPagePhases: {}, firstPolishPhases: {} },
      lastStyle: null,
      phaseStyles: {},
      technique: {
        version: Number(tc.version) || 1,
        xp: { shi: 0, ci: 0, lian: 0 },
        level: { shi: 0, ci: 0, lian: 0 },
        unlocked: { shi: [], ci: [], lian: [] },
        equipped: { shi: [], ci: [], lian: [] }
      }
    };
  }

  ensureAbilityState() {
    const s = this.s;
    if (!s) return null;
    const base = this.createAbilityState(s.attrs, s.school);
    const a = (s.abilityState && typeof s.abilityState === 'object') ? s.abilityState : {};
    s.abilityState = a;
    a.version = Math.max(base.version, Number(a.version) || 1);
    a.insight = Math.max(0, Math.min(this.insightCap(), Number(a.insight) || 0));
    a.familiarity = Object.assign({}, base.familiarity, a.familiarity || {});
    a.study = Object.assign({}, base.study, a.study || {});
    a.study.focus = Array.isArray(a.study.focus) ? a.study.focus.filter(k => R.ATTR_KEYS.includes(k)).slice(0, this.studySlots()) : base.study.focus;
    if (!a.study.focus.length) a.study.focus = base.study.focus;
    a.study.nextFocus = Array.isArray(a.study.nextFocus)
      ? a.study.nextFocus.filter(k => R.ATTR_KEYS.includes(k)).slice(0, this.studySlots())
      : a.study.focus.slice();
    if (!a.study.nextFocus.length) a.study.nextFocus = a.study.focus.slice();
    a.study.progress = Object.assign({}, a.study.progress || {});
    a.strategy = Object.assign({}, base.strategy, a.strategy || {});
    const planIds = Object.keys(this.strategyPlans());
    a.strategy.plan = planIds.includes(a.strategy.plan) ? a.strategy.plan : base.strategy.plan;
    a.strategy.nextPlan = planIds.includes(a.strategy.nextPlan) ? a.strategy.nextPlan : a.strategy.plan;
    a.strategy.charges = Math.max(0, Math.min(this.strategyCap(), Number(a.strategy.charges) || 0));
    a.strategy.chargeRemainder = Math.max(0, Math.min(0.999, Number(a.strategy.chargeRemainder) || 0));
    a.strategy.freeUsed = !!a.strategy.freeUsed;
    a.manuscript = Object.assign({}, base.manuscript, a.manuscript || {});
    a.manuscript.pages = Math.max(0, Math.min(this.manuscriptCap(), Number(a.manuscript.pages) || 0));
    a.manuscript.fragments = Math.max(0, Number(a.manuscript.fragments) || 0);
    a.manuscript.volumes = Math.max(0, Number(a.manuscript.volumes) || 0);
    a.manuscript.polish = Math.max(0, Number(a.manuscript.polish) || 0);
    a.manuscript.bonusPagePhases = Object.assign({}, a.manuscript.bonusPagePhases || {});
    a.manuscript.schoolPagePhases = Object.assign({}, a.manuscript.schoolPagePhases || {});
    a.manuscript.firstPolishPhases = Object.assign({}, a.manuscript.firstPolishPhases || {});
    a.phaseStyles = Object.assign({}, a.phaseStyles || {});
    a.technique = Object.assign({}, base.technique, a.technique || {});
    a.technique.xp = Object.assign({}, base.technique.xp, a.technique.xp || {});
    a.technique.level = Object.assign({}, base.technique.level, a.technique.level || {});
    a.technique.unlocked = Object.assign({}, base.technique.unlocked, a.technique.unlocked || {});
    a.technique.equipped = Object.assign({}, base.technique.equipped, a.technique.equipped || {});
    return a;
  }

  gainInsight(n, reason = '') {
    const a = this.ensureAbilityState();
    if (!a || !(n > 0)) return 0;
    const before = a.insight;
    a.insight = Math.min(this.insightCap(), before + Math.max(0, Math.floor(Number(n) || 0)));
    const got = a.insight - before;
    if (got && reason) this.push(`${reason}：心得 +${got}`);
    return got;
  }

  /** 创作抉择兼容旧 attr 字段；新内容以 studyTarget 明确写入修习方向。 */
  choiceStudyTarget(option) {
    const target = String((option && (option.studyTarget || option.attr)) || 'bi');
    return R.ATTR_KEYS.includes(target) ? target : 'bi';
  }

  choiceResultText(option) {
    const text = String(option && option.resultText || '').trim();
    if (text) return text;
    const picked = String(option && option.text || '这一笔').trim();
    return `你把「${picked}」记入行卷，留待日后再看。`;
  }

  choiceInkTags(option) {
    const tags = Array.isArray(option && option.inkTags) ? option.inkTags : [];
    return tags.map(x => String(x || '').trim()).filter(Boolean).slice(0, 2);
  }

  ensureChoiceHistory() {
    const s = this.s;
    if (!Array.isArray(s.choiceHistory)) s.choiceHistory = [];
    return s.choiceHistory;
  }

  /** 研修进度的唯一推进入口；论战与创作抉择共用同一阈值和属性兑现规则。 */
  gainStudyProgress(attr, amount = 1, reason = '') {
    if (!R.ATTR_KEYS.includes(attr)) return { attr, added: 0, progress: 0, need: 1, gained: 0 };
    const a = this.ensureAbilityState();
    const need = Math.max(1, Number((this.abilityConfig().study || {}).progressNeed) || 3);
    const added = Math.max(0, Number(amount) || 0);
    a.study.progress[attr] = Math.max(0, Number(a.study.progress[attr]) || 0) + added;
    const gained = Math.floor(a.study.progress[attr] / need);
    if (gained > 0) {
      a.study.progress[attr] = Math.round((a.study.progress[attr] - gained * need) * 1000) / 1000;
      this.addAttrs({ [attr]: gained }, { reason: reason || '学力·研修' });
      this.push(`${reason || '学力·研修'}：${R.ATTR_NAMES[attr]} +${gained}`);
    }
    return { attr, added, progress: Number(a.study.progress[attr]) || 0, need, gained };
  }

  /** 创作抉择只产生一次修习单位：同向推进研修，旁通沉淀为心得。 */
  applyChoiceStudy(q, optionIndex) {
    const option = (q && q.options && q.options[optionIndex]) || {};
    const target = this.choiceStudyTarget(option);
    const a = this.ensureAbilityState();
    const focused = (a.study.focus || []).includes(target);
    let mode = 'insight';
    let insight = 0;
    let study = null;
    if (focused) {
      mode = 'study';
      study = this.gainStudyProgress(target, this.studyProgressRate(), `创作抉择·${q.id}`);
    } else {
      insight = this.gainInsight(1, `创作抉择·${q.id}`);
      // 心得已满时不吞掉收益：转为同方向的一格临场研修。
      if (!insight) {
        mode = 'overflow-study';
        study = this.gainStudyProgress(target, this.studyProgressRate(), `创作抉择·${q.id}·心得已满`);
      }
    }
    const mark = {
      questionId: String(q && q.id || ''), optionIndex: Math.max(0, Number(optionIndex) || 0),
      target, inkTags: this.choiceInkTags(option), resultText: this.choiceResultText(option),
      optionText: String(option.text || ''), phase: String(this.s.phase || ''), turn: Number(this.s.turn) || 0
    };
    const history = this.ensureChoiceHistory();
    history.push(mark);
    if (history.length > 24) history.splice(0, history.length - 24);
    const targetName = R.ATTR_NAMES[target] || target;
    let rewardText;
    if (mode === 'insight') rewardText = `修习所得：旁通${targetName}，心得 +${insight}`;
    else if (study && study.gained) rewardText = `修习所得：${targetName}研修完成，${targetName} +${study.gained}`;
    else if (mode === 'overflow-study') rewardText = `心得已满，转入${targetName}研修，进度 +${study.added}（${study.progress}/${study.need}）`;
    else rewardText = `修习所得：${targetName}研修进度 +${study.added}（${study.progress}/${study.need}）`;
    this.push(`墨痕·${q.id}：${targetName}${mark.inkTags.length ? `（${mark.inkTags.join('、')}）` : ''}；${rewardText}`);
    return { ...mark, mode, insight, study, rewardText, targetName };
  }

  choiceInkSummary(phase) {
    const history = this.ensureChoiceHistory().filter(x => !phase || x.phase === phase);
    if (!history.length) return '';
    const counts = new Map();
    for (const item of history) for (const tag of item.inkTags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
    const tag = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const latest = history[history.length - 1];
    const voice = {
      求真: '你多次先追问意义，再决定如何落笔。',
      出新: '你不愿只沿熟路成篇，总想替旧景换一个入口。',
      与人: '你写下的句子，总还留着回应他人的位置。',
      独行: '你更愿先听清自己心里的声音。',
      守法: '你珍重前人的法度，也愿从中慢慢练成自己的笔。',
      惜身: '你知道停笔不是退却，留白也是为了下一次落笔。',
      燃笔: '你宁肯把当下写尽，也不轻易放过涌来的句子。'
    };
    return `本阶段行卷：${voice[tag] || '你在不同写法之间反复斟酌。'} 最近一笔是「${latest.optionText || latest.questionId}」。`;
  }

  choiceInkEpilogue() {
    const history = this.ensureChoiceHistory();
    if (!history.length) return '';
    const latest = history[history.length - 1];
    return `行卷留痕：${latest.resultText || `你仍记得「${latest.optionText}」的那一笔。`}`;
  }

  insightCost(attr) {
    const c = this.abilityConfig().growth || {};
    const vals = R.CREATIVE_KEYS.map(k => Number(this.s.attrs[k]) || 0);
    const mean = vals.reduce((x, y) => x + y, 0) / vals.length;
    const value = Number(this.s.attrs[attr]) || 0;
    if (R.CREATIVE_KEYS.includes(attr) && Math.max(...vals) - value >= (Number(c.catchupGap) || 6)) return Number(c.catchupCost) || 3;
    if (R.CREATIVE_KEYS.includes(attr) && value - mean >= (Number(c.specialistGap) || 6)) return Number(c.specialistCost) || 5;
    return Number(c.baseCost) || 4;
  }

  spendInsight(attr) {
    if (!R.ATTR_KEYS.includes(attr)) return { ok: false, reason: '未知属性' };
    const a = this.ensureAbilityState();
    const cost = this.insightCost(attr);
    if (a.insight < cost) return { ok: false, reason: `心得不足（需 ${cost}）` };
    a.insight -= cost;
    const got = this.addAttrs({ [attr]: 1 }, { reason: '研修心得' });
    this.push(`研修心得：${R.ATTR_NAMES[attr]} +${got[attr] || 0}`);
    this.ui.onState(this.s);
    this.onForceSave?.();
    return { ok: true, cost, gained: got[attr] || 0 };
  }

  toggleStudyFocus(attr) {
    if (!R.ATTR_KEYS.includes(attr)) return false;
    const a = this.ensureAbilityState();
    const focus = a.study.nextFocus;
    const at = focus.indexOf(attr);
    if (at >= 0) {
      if (focus.length <= 1) return false;
      focus.splice(at, 1);
    } else {
      if (focus.length >= this.studySlots()) return false;
      focus.push(attr);
    }
    this.ui.onState(this.s);
    this.onForceSave?.();
    return true;
  }

  setNextStrategyPlan(plan) {
    if (!Object.prototype.hasOwnProperty.call(this.strategyPlans(), plan)) return false;
    const a = this.ensureAbilityState();
    a.strategy.nextPlan = plan;
    this.ui.onState(this.s);
    this.onForceSave?.();
    return true;
  }

  refillStrategy(phase = this.s.phase) {
    const a = this.ensureAbilityState();
    if (!a || a.strategy.refillPhase === phase) return 0;
    const previousPlan = a.strategy.plan;
    a.strategy.refillPhase = phase;
    a.strategy.plan = a.strategy.nextPlan;
    const albumStartBonus = Math.max(0, Number(this.s.albumState && this.s.albumState.flags && this.s.albumState.flags.strategyStartPlus) || 0);
    if (this.s.albumState && this.s.albumState.flags) this.s.albumState.flags.strategyStartPlus = 0;
    const totalIncome = this.strategyIncome() + (Number(a.strategy.chargeRemainder) || 0) + albumStartBonus;
    const wholeIncome = Math.floor(totalIncome);
    a.strategy.chargeRemainder = Math.round((totalIncome - wholeIncome) * 1000) / 1000;
    a.strategy.charges = Math.min(this.strategyCap(), wholeIncome);
    a.strategy.freeUsed = false;
    a.study.focus = a.study.nextFocus.slice(0, this.studySlots());
    if (!a.study.focus.length) a.study.focus = this.createAbilityState(this.s.attrs, this.s.school).study.focus;
    a.study.nextFocus = a.study.focus.slice();
    if (previousPlan !== a.strategy.plan) this.push(`阶段章法改为「${this.strategyPlans()[a.strategy.plan]?.name || a.strategy.plan}」`);
    return a.strategy.charges;
  }

  strategyCanTrigger(plan) {
    const a = this.ensureAbilityState();
    if (!a || a.strategy.plan !== plan) return false;
    const mech = this.schoolMechanics();
    const free = mech.type === 'qishi' && Number(mech.firstPlanFreePerPhase) > 0 && !a.strategy.freeUsed;
    return free || a.strategy.charges > 0;
  }

  consumeStrategyPlan(plan, detail = '') {
    if (!this.strategyCanTrigger(plan)) return false;
    const a = this.ensureAbilityState();
    const mech = this.schoolMechanics();
    const free = mech.type === 'qishi' && Number(mech.firstPlanFreePerPhase) > 0 && !a.strategy.freeUsed;
    if (free) a.strategy.freeUsed = true;
    else a.strategy.charges -= 1;
    const name = this.strategyPlans()[plan]?.name || '章法';
    this.push(`${name}自动发动${free ? '（奇士本阶段首次免费）' : '：构思 -1'}${detail}`);
    this.ui.toast?.(`${name}发动${free ? ' · 首次免费' : ` · 构思余 ${a.strategy.charges}`}${detail}`);
    this.ui.onState(this.s);
    this.onForceSave?.();
    return true;
  }

  applyStrategyMovement(dice, planned = false) {
    const value = Math.max(1, Number(dice) || 1);
    const p = this.strategyPlans().steady || {};
    const lowMax = Number(p.lowMax) || 3;
    const fragmentGain = Math.max(0, Number(p.fragmentGain) || 1);
    if (planned || value > lowMax || !this.consumeStrategyPlan('steady', fragmentGain ? ` · 残页 +${fragmentGain}` : '')) return value;
    const a = this.ensureAbilityState();
    a.manuscript.fragments += fragmentGain;
    this.ui.onState(this.s);
    this.onForceSave?.();
    return value;
  }

  strategyBattlePct(session, style) {
    if (!session || !session.lastStyle || session.lastStyle === style) return 0;
    const pct = Number((this.strategyPlans().switch || {}).scorePct) || 0.06;
    if (session.strategyPlanTriggered === 'switch') return pct;
    if (session.strategyPlanTriggered || !this.consumeStrategyPlan('switch')) return 0;
    session.strategyPlanTriggered = 'switch';
    return pct;
  }

  strategyLossAmount(loss, style) {
    let reduce = style === 'lian' ? Number((this.styleConfig().lian || {}).lossInspirationReduce) || 1 : 0;
    if (this.consumeStrategyPlan('guard')) reduce += Number((this.strategyPlans().guard || {}).lossReduce) || 2;
    return Math.min(0, Number(loss) + reduce);
  }

  spendManuscript(action) {
    const a = this.ensureAbilityState();
    const c = this.abilityConfig().manuscript || {};
    const mech = this.schoolMechanics();
    let cost = action === 'polish' ? Number(c.polishCost) || 2 : action === 'publish' ? Number(c.publishCost) || 3 : Number(c.volumeCost) || 5;
    if (action === 'polish' && mech.type === 'cizong_bi' && !a.manuscript.firstPolishPhases[this.s.phase]) {
      cost = Math.max(1, cost - (Number(mech.firstPolishCostReduce) || 0));
    }
    if (a.manuscript.pages < cost) return { ok: false, reason: `稿页不足（需 ${cost}）` };
    if (action === 'volume' && a.manuscript.volumes >= (Number(c.volumeCap) || 2)) return { ok: false, reason: '成卷已达本局上限' };
    a.manuscript.pages -= cost;
    if (action === 'polish') {
      a.manuscript.polish += 1;
      a.manuscript.firstPolishPhases[this.s.phase] = true;
    } else if (action === 'publish') this.addInspiration(Number(c.publishInspiration) || 4, '稿本·刊行');
    else if (action === 'volume') {
      a.manuscript.volumes += 1;
      if ((Number(this.s.attrs.bi) || 0) >= (Number(c.volumeRefundBi) || 32)) {
        a.manuscript.pages = Math.min(this.manuscriptCap(), a.manuscript.pages + (Number(c.volumeRefundPages) || 1));
      }
    }
    this.push(`稿本·${action === 'polish' ? '润色' : action === 'publish' ? '刊行' : '定卷'}：稿页 -${cost}`);
    this.ui.onState(this.s);
    this.onForceSave?.();
    return { ok: true, cost };
  }

  /* ---------------------------------------------------------- 开局 */
  /**
   * @param {string} schoolId
   * @param {object} [opts] - { loadout: 图鉴装配卡数组, name: 玩家自起之名 }
   */
  start(schoolId, opts = {}) {
    const cfg = this.cfg;
    this._inheritApplied = null;
    const school = cfg.schools.find(s => s.id === schoolId) || cfg.schools[0];
    const attrs = { ...cfg.attrs.initial };
    attrs[school.attr] = (attrs[school.attr] || 0) + (cfg.attrs.schoolBonus ?? 3);

    // 流派熟练度：读该派跨局积累的等级，叠加主属性（每级 +MASTERY_ATTR_PER_LEVEL）
    const mastery = Album.loadStore().mastery || {};
    const mEntry = mastery[school.id] || Album.masteryEntry(0);
    this.masteryLevel = mEntry.level || 1;
    const masterAttrGain = (this.masteryLevel - 1) * Album.MASTERY_ATTR_PER_LEVEL;
    if (masterAttrGain > 0) {
      attrs[school.attr] = (attrs[school.attr] || 0) + masterAttrGain;
    }
    const _masteryGain = masterAttrGain;   // 供下方日志

    // 照我传灯·跨局传承：消费上一局点亮的「传承火种」，继承其 80%~100% 属性（一次性）
    const _inherit = Reincarnate.consume();
    if (_inherit && _inherit.attrs) {
      const _added = {};
      for (const k of R.ATTR_KEYS) {
        const v = Math.floor(Number(_inherit.attrs[k]) || 0);
        if (v > 0) { attrs[k] = (Number(attrs[k]) || 0) + v; _added[k] = v; }
      }
      if (Object.keys(_added).length) this._inheritApplied = { ..._inherit, added: _added };
    }

    // 玩家自起之名：留空（或默认）则叙事维持第二人称「你」；截断到 12 字防误输入
    const playerName = (opts.name != null ? String(opts.name).trim().slice(0, 12) : '') || '';

    this.s = {
      school,
      schoolState: this.createSchoolState(school),
      playerName,
      attrs,
      masteryLevel: this.masteryLevel,     // 开局所用流派熟练度等级（供结算/HUD 留痕）
      inspiration: cfg.inspiration.initial,
      inspirationMax: cfg.inspiration.max,
      passive: [], active: [],
      track: 'main', pos: 0, routeIndex: 0, ringId: cfg.board.routeCells?.[0]?.ring || 'outer', branchId: null, branchIndex: -1,
      lap: 1, turn: 0, phase: cfg.board.layout === 'concentric_spiral' ? 'child' : 'lap1', phaseGateSeen: {},
      sky: [], nextBattlePct: 0,
      battle: { win: 0, draw: 0, loss: 0, streak: 0, maxStreak: 0, upsets: 0, winsByStyle: { shi: 0, ci: 0, lian: 0 } },
      events: { total: 0, rare: 0, legend: 0, talents: 0, items: 0 },
      quiz: { asked: 0, right: 0 },
      choiceHistory: [],                              // 创作抉择的墨痕来源；只服务修习反馈与叙事回看
      seenEvents: new Set(), usedQuestions: new Set(),
      palaceWins: 0, palaceDone: 0,
      zeitgeist: this.seedZeitgeist(cfg.affinity),   // 当朝风潮（每局随机，制造变化性）
      tutorialState: {
        schoolSeen: true,
        firstMoveSeen: false,
        hudSeen: false,
        firstBattleSeen: false,
        scoreSeen: false,
        talentSeen: false,
        abilitySeen: false,
        rulesVisited: false
      },
      affStreak: { manner: null, n: 0 },             // 气势连捷：连续同风格胜场
      synergies: [],                                 // 当前已激活的文心羁绊（id/name/desc/members）
      talentLevels: {},                              // 文心等级：{ [talentId]: level }（Lv1 起，存档持久化）
      talentState: { triggers: {}, flags: {}, activeUses: {} }, // 文心局内触发次数/主动使用次数/一次性互斥标记（存档持久化）
      abilityState: this.createAbilityState(attrs, school),     // 方案 B 三功；内含方案 C 技法状态契约
      plannedMoveDice: null,                         // 布局谋篇待作用的下一枚地图移动骰（瞬时状态）
      npcMech: { history: {}, palace: {} },          // NPC 三机制跨场状态
      stageForcedSeen: {},                            // 各档已触发的阶段必遇 NPC
      loadout: [], titles: [],
      secretFinal: { eligible: false, invited: false, entered: false, completed: false, result: '' },
      over: false, reachedEnd: false, endReason: '',
      log: []
    };

    const t0 = cfg.talentById.get(school.talent);
    if (t0) this.grantTalent(t0, { silent: true });
    // 照我传灯：火种会把点灯文心本体及当时等级带回下一局，使传承能够继续延续。
    // 若配置已删除该文心，属性仍照常继承，只跳过无法重建的卡牌。
    const inheritedTalent = _inherit && cfg.talentById && cfg.talentById.get(_inherit.talentId);
    if (inheritedTalent && inheritedTalent.effect && inheritedTalent.effect.type === 'reincarnate') {
      this.grantTalent(inheritedTalent, { silent: true, startLevel: _inherit.talentLevel, inherited: true });
    }
    this.push(`选择「${school.name}」，${R.ATTR_NAMES[school.attr]} +${cfg.attrs.schoolBonus ?? 3}`);
    if (_masteryGain > 0) {
      this.push(`流派造诣·${Album.masteryLevelName(this.masteryLevel)}：${R.ATTR_NAMES[school.attr]} +${_masteryGain}`);
      if (this.ui && this.ui.toast) this.ui.toast(`◆ ${school.name}造诣 ${Album.masteryLevelName(this.masteryLevel)}，${R.ATTR_NAMES[school.attr]} +${_masteryGain}`);
    }
    this.applyLoadout(opts.loadout || []);
    this.applyAlbumStartEffects();

    // 照我传灯·跨局传承：若开局消费了传承，落日志 + 提示
    if (this._inheritApplied) {
      const a = this._inheritApplied;
      const detail = R.ATTR_KEYS.filter(k => a.added[k]).map(k => `${R.ATTR_NAMES[k]} +${a.added[k]}`).join('、');
      const inheritedLevel = Math.max(1, Math.floor(Number(a.talentLevel) || 1));
      this.push(`照我传灯·传承：继承「${a.talentName}」Lv${inheritedLevel} 与前世修为（${Math.round(a.ratio * 100)}%），${detail}`);
      if (this.ui && this.ui.toast) this.ui.toast(`✦ 照我传灯·传承生效：${a.talentName} Lv${inheritedLevel}，${detail}`);
    }
    return this.s;
  }

  /**
   * 当朝风潮：开局随机抽一个「热点题材」与一个「得势文体」。
   * 热点题材使该题材战斗对所有风格 +zeitgeistThemeBonus；得势文体使该风格在所有题材 +zeitgeistMannerBonus。
   * 二者每局不同 → 最优相性解随局变化，是重玩变化性的核心来源。
   */
  seedZeitgeist(af) {
    const themes = (af && af.themes) || ['yongwu'];
    const manners = (af && af.manners) || ['wanyue', 'haofang', 'zheli'];
    const pick = arr => arr[Math.floor(this.rand() * arr.length)];
    return { theme: pick(themes), manner: pick(manners) };
  }

  /** 应用图鉴装配：旧 reward 仍开局生效；成长型名篇写入本局状态并按分支启用。 */
  applyLoadout(cards) {
    const list = (cards || []).slice(0, Album.LOADOUT_MAX);
    const store = Album.loadStore();
    this.s.albumState = { progress: {}, branches: {}, flags: {} };
    for (const card of list) {
      const r = card.reward || {};
      const p = Album.normalizeAlbumProgress(store.progress && store.progress[card.id]);
      this.s.albumState.progress[card.id] = p;
      const branch = p.branch || '';
      if (branch) this.s.albumState.branches[card.id] = branch;
      this.s.loadout.push(card.id);
      if (r.type === 'attr' && R.ATTR_KEYS.includes(r.attr)) {
        this.s.attrs[r.attr] = Math.max(0, (this.s.attrs[r.attr] || 0) + (Number(r.value) || 0));
      } else if (r.type === 'inspiration') {
        this.s.inspiration = R.clamp(this.s.inspiration + (Number(r.value) || 0), 0, this.s.inspirationMax);
      } else if (r.type === 'talent') {
        const t = this.cfg.talentById.get(r.talent);
        if (t) this.grantTalent(t, { silent: true });
      } else if (r.type === 'inspirationMax') {
        const gain = Math.max(0, Number(r.value) || 0);
        if (gain > 0) this.addInspirationMax(gain, `名篇·${card.name}`);
      } else if (r.type === 'title' && r.title) {
        this.s.titles.push(r.title);
      }
      const progress = this.s.albumState.progress[card.id];
      const branchId = this.s.albumState.branches[card.id];
      const branchName = (card.branches || []).find(b => b.id === branchId)?.name;
      this.push(`图鉴装配「${card.name}」${progress.level ? `·Lv${progress.level}` : ''}${branchName ? `·${branchName}` : ''}——${card.rewardDesc || ''}`);
    }
  }

  albumCard(cardId) {
    return (this.cfg.album || []).find(c => c.id === cardId) || null;
  }

  albumProgress(cardId) {
    const a = this.ensureAlbumState();
    return a && a.progress[cardId] ? a.progress[cardId] : Album.emptyAlbumProgress();
  }

  ensureAlbumState() {
    if (!this.s) return null;
    const state = (this.s.albumState && typeof this.s.albumState === 'object') ? this.s.albumState : {};
    state.progress = Album.normalizeAlbumProgressMap(state.progress);
    state.branches = state.branches && typeof state.branches === 'object' ? state.branches : {};
    state.flags = state.flags && typeof state.flags === 'object' ? state.flags : {};
    this.s.albumState = state;
    return state;
  }

  albumBranch(cardId, branchId) {
    const card = this.albumCard(cardId);
    const selected = Album.chooseAlbumBranch(Album.loadStore(), card, branchId);
    if (!selected.ok) return selected;
    const p = this.albumProgress(cardId);
    p.branch = branchId; p.branchLocked = true;
    const a = this.ensureAlbumState();
    a.progress[cardId] = p; a.branches[cardId] = branchId;
    this.push(`名篇「${card.name}」选择路线：${selected.branch.name}`);
    this.ui.onState(this.s); this.onForceSave?.();
    return { ok: true, branch: selected.branch };
  }

  activeAlbumEffects(trigger, ctx = {}) {
    const a = this.ensureAlbumState();
    const effects = [];
    for (const [id, branchId] of Object.entries(a?.branches || {})) {
      const card = this.albumCard(id); const p = a.progress[id];
      if (!card || !p || p.level < 1) continue;
      const branch = Album.branchById(card, branchId);
      for (const ef of (branch?.effects || card.effects || [])) {
        if (ef.trigger !== trigger || (ef.minLevel && p.level < Number(ef.minLevel))) continue;
        if (ef.style && ef.style !== ctx.style) continue;
        if (ef.result && ef.result !== ctx.result) continue;
        if (ef.phase && ef.phase !== ctx.phase) continue;
        if (ef.onlyIf && !ctx[ef.onlyIf]) continue;
        const key = `${id}:${branchId}:${trigger}:${ef.name || ef.type}:${ctx.eventKey || ctx.battleId || ctx.phase || ''}`;
        if (ef.once && a.flags[key]) continue;
        effects.push({ ...ef, card, progress: p, _key: key });
      }
    }
    return effects;
  }

  _markAlbumEffect(ef) {
    if (!ef || !ef.once) return;
    const a = this.ensureAlbumState();
    a.flags[ef._key] = true;
  }

  _applyAlbumEffect(ef, ctx = {}) {
    const v = Number(ef.value) || 0;
    const a = this.ensureAbilityState();
    if (ef.type === 'attr' && R.ATTR_KEYS.includes(ef.attr)) this.addAttrs({ [ef.attr]: v }, { raw: true, reason: `名篇·${ef.card.name}` });
    else if (ef.type === 'inspiration') this.addInspiration(v, `名篇·${ef.card.name}`);
    else if (ef.type === 'inspirationMax' && v > 0) {
      this.addInspirationMax(v, `名篇·${ef.card.name}`);
    } else if (ef.type === 'insight') this.gainInsight(v, `名篇·${ef.card.name}`);
    else if (ef.type === 'manuscript') a.manuscript.pages = Math.min(this.manuscriptCap(), a.manuscript.pages + Math.max(0, v));
    else if (ef.type === 'strategy') {
      const gain = Math.max(0, v);
      if (ctx.trigger === 'start') this.s.albumState.flags.strategyStartPlus = Math.max(0, Number(this.s.albumState.flags.strategyStartPlus) || 0) + gain;
      else a.strategy.charges = Math.min(this.strategyCap(), a.strategy.charges + gain);
    } else if (ef.type === 'studySlot') this.s.albumState.flags.studySlotPlus = Math.max(0, Number(this.s.albumState.flags.studySlotPlus) || 0) + Math.max(0, v);
    else if (ef.type === 'techniqueXp' && R.CREATIVE_KEYS.includes(ef.style || ctx.style)) {
      const style = ef.style || ctx.style;
      const tc = this.techniqueConfig();
      a.technique.xp[style] = (Number(a.technique.xp[style]) || 0) + Math.max(0, v);
      a.technique.level[style] = (tc.thresholds || []).filter(t => a.technique.xp[style] >= Number(t)).length;
    }
    this._markAlbumEffect(ef);
    this.push(`名篇「${ef.card.name}」·${ef.name || '篇后余韵'}：${ef.desc || ''}`);
  }

  applyAlbumStartEffects() {
    for (const ef of this.activeAlbumEffects('start', { phase: this.s.phase })) this._applyAlbumEffect(ef, { phase: this.s.phase, trigger: 'start' });
    const a = this.ensureAbilityState();
    if (a) {
      a.strategy.charges = Math.min(this.strategyCap(), a.strategy.charges + Math.max(0, Number(this.s.albumState.flags.strategyStartPlus) || 0));
      this.s.albumState.flags.strategyStartPlus = 0;
    }
  }

  applyAlbumOutcomeEffects(trigger, out = {}) {
    const ctx = { ...out, style: out.style, result: out.result, phase: this.s.phase, battleId: out.battleId };
    for (const ef of this.activeAlbumEffects(trigger, ctx)) this._applyAlbumEffect(ef, ctx);
  }

  albumScorePct(style, phase = this.s.phase) {
    return this.activeAlbumEffects('score', { style, phase })
      .filter(ef => ef.type === 'pct')
      .reduce((sum, ef) => sum + (Number(ef.value) || 0), 0);
  }

  recordAlbumBattle(out) {
    const ids = Array.isArray(this.s.loadout) ? this.s.loadout : [];
    if (!ids.length) return [];
    const store = Album.loadStore();
    store.progress = Album.normalizeAlbumProgressMap(store.progress);
    const changes = [];
    for (const id of ids) {
      const card = this.albumCard(id);
      if (!card) continue;
      const branch = this.s.albumState?.branches?.[id] || '';
      const res = Album.addAlbumProgress(store.progress, card, { result: out.result, style: out.style, branch });
      if (res) changes.push({ id, card, ...res });
    }
    Album.saveStore(store);
    for (const x of changes) {
      if (x.leveledUp) this.push(`传世名篇「${x.card.name}」精进至 Lv${x.after.level}·${Album.albumLevelName(x.after.level)}`);
    }
    return changes;
  }

  push(text, meta = {}) {
    const entry = { turn: this.s.turn, text: String(text || ''), ...meta };
    this.s.log.push(entry);
    // 日志上限：防止长局把存档撑爆（截断保留最近 150 条，与 save.js 的截断阈值一致）
    if (this.s.log.length > 200) this.s.log.splice(0, this.s.log.length - 150);
    // 日志事件即时推给 HUD；不必等到下一次 onState 才能看见本回合发生了什么。
    if (this.ui && typeof this.ui.recordLog === 'function') this.ui.recordLog(entry);
  }

  /**
   * 读档后重建派生/引用状态（rehydrate）。
   * deserializeRun 只还原「可序列化数据」，这里把依赖运行时引用的部分补齐：
   *   - synergies 按当前持有的文心重算（存档只留 id/name，效果引用须重新指向 cfg）
   *   - 存档中的天赋/天象已在 deserializeRun 里按 ID 关联回 cfg，这里只需重算羁绊
   * 调用时机：loadGame 里 `game.s = state` 之后。
   */
  rehydrate() {
    const s = this.s;
    if (!s) return;
    this.ensureAbilityState();
    s.synergies = this.synergySet().map(sy => ({ id: sy.id, name: sy.name, desc: sy.desc, members: sy.members }));
    this.ui.onState(s);
  }

  /* ------------------------------------------------------ 派生数据 */
  get lianUnlocked() {
    return this.s.attrs.lian >= 8
      || this.s.passive.some(t => t.effect && t.effect.type === 'unlock_lian');
  }

  /** 计入天象百分比的战斗用属性 */
  effectiveAttrs() {
    const a = { ...this.s.attrs };
    let pct = 0;
    for (const sk of this.s.sky) {
      const ef = sk.card.effect || {};
      if (ef.type === 'attr_pct' && a[ef.attr] != null) {
        pct += Number(ef.value) || 0;
      }
    }
    // 文心「学富五车」：每拥有 step 枚文心，算分属性临时 +value%（收藏越多越强，但靠 diminish 收敛）
    const ownedCount = (this.s.passive ? this.s.passive.length : 0) + (this.s.active ? this.s.active.length : 0);
    for (const t of [...(this.s.passive || []), ...(this.s.active || [])]) {
      const ef = t.effect || {};
      if (ef.type === 'armory_pct' && Number(ef.step) > 0) {
        pct += Math.floor(ownedCount / Number(ef.step)) * (Number(ef.value) || 0);
      }
    }
    if (pct) for (const k of R.ATTR_KEYS) if (a[k] != null) a[k] = Math.max(0, Math.round(a[k] * (1 + pct)));
    return a;
  }

  skyActive(type) { return this.s.sky.find(sk => (sk.card.effect || {}).type === type) || null; }

  /** 整体进度 0–1；三圈路线使用 routeIndex，旧单环配置继续使用 lap/pos。 */
  progress() {
    const board = this.cfg.board;
    if (board.layout === 'concentric_spiral' && board.routeSize) {
      return R.clamp((Number(this.s.routeIndex) || 0) / board.routeSize, 0, 0.999);
    }
    const ring = board.ringSize;
    const laps = board.laps;
    const p = ((this.s.lap - 1) * ring + this.s.pos) / (ring * laps);
    return R.clamp(p, 0, 0.999);
  }

  routeCell(index = this.s.routeIndex) {
    const board = this.cfg.board;
    if (board.layout === 'concentric_spiral') {
      const cells = board.routeCells?.length ? board.routeCells : (board.mainRing || []);
      return cells[index] || null;
    }
    return this.currentCell();
  }

  routeLength() {
    const board = this.cfg.board;
    return Number(board.routeSize) || (board.routeCells?.length || board.mainRing?.length || 0);
  }

  phaseForRoute(index = this.s.routeIndex) {
    const gates = this.cfg.board.phaseGates || [];
    let phase = 'child';
    for (const gate of gates) if (index >= Number(gate.at)) phase = gate.phase || phase;
    return phase;
  }

  /** NPC 抽取与跨场历史委托给 npc-selection.js，保留 Game 公共方法兼容旧调用。 */
  pickNpc(forPalace) { return NpcSelection.pickNpc(this, forPalace); }
  _npcFromPick(tier, pick) { return NpcSelection.npcFromPick(tier, pick); }
  _mechHistoryForNpc(npcId) { return NpcSelection.mechHistoryForNpc(this.s, npcId); }
  _strategyChangedSinceLast(npc, style, manner) { return NpcSelection.strategyChangedSinceLast(this.s, npc, style, manner); }
  _palaceStrategyChanged(style, manner) { return NpcSelection.palaceStrategyChanged(this.s, style, manner); }

  /** 殿试席位：先保留满足构筑条件的必遇 NPC，再按权重填充其余席位。 */
  selectPalaceFoes(tier, count) {
    const pool = Array.isArray(tier && tier.npcs) ? tier.npcs : [];
    const n = Math.max(0, Number(count) || 0);
    if (!pool.length || !n) return { foes: [], forcedEntry: null };
    const forcedEntry = NpcSelection.forcedPalaceNpc(pool, this.s && this.s.attrs);
    const entries = forcedEntry ? [forcedEntry] : [];
    const remaining = forcedEntry ? pool.filter(entry => entry !== forcedEntry) : pool.slice();
    const weighted = R.pickNpcByWeightUnique(remaining, Math.max(0, n - entries.length), this.rand);
    const fallbackPool = remaining.length ? remaining : pool;
    for (let i = 0; entries.length < n; i++) {
      entries.push(weighted[i] || fallbackPool[Math.floor(this.rand() * fallbackPool.length)]);
    }
    return { foes: entries.map(entry => this._npcFromPick(tier, entry)), forcedEntry };
  }

  cellAt(track, pos, branchId, branchIndex) {
    if (track === 'branch') {
      const br = this.cfg.board.branches[branchId];
      return this.cfg.board.cellById.get(br.cells[branchIndex]);
    }
    return this.cfg.board.cellById.get(pos);
  }
  currentCell() {
    if (this.cfg.board.layout === 'concentric_spiral') return this.cfg.board.routeCells?.[this.s.routeIndex] || null;
    return this.cellAt(this.s.track, this.s.pos, this.s.branchId, this.s.branchIndex);
  }

  /* ------------------------------------------------------ 数值变更 */
  /**
   * 属性增减。除 opts.raw 外，一律走 config/attrs.json 的 diminish 递减曲线
   * （属性越高，同一次 +N 实得越少；见 rules.diminishGain）。
   * raw:true 用于文心 attr_flat —— 它必须与 revokeTalentFlat 严格可逆，不能递减。
   */
  addAttrs(delta, opts = {}) {
    const out = {};
    const touchesBasic = Object.keys(delta || {}).some(k => ['bi', 'xue', 'si'].includes(k));
    const milestoneBefore = touchesBasic && this.s && this.s.abilityState ? {
      studySlots: this.studySlots(), insightCap: this.insightCap(), strategyCap: this.strategyCap(), manuscriptCap: this.manuscriptCap()
    } : null;
    const basicPlus = (!opts.raw && this.skyActive('basic_gain_plus')) ? 1 : 0;
    const dim = opts.raw ? null : ((this.cfg.attrs || {}).diminish || null);
    for (const [k, v0] of Object.entries(delta || {})) {
      if (!R.ATTR_KEYS.includes(k)) continue;
      let v = Number(v0) || 0;
      if (v > 0 && basicPlus && R.BASIC_KEYS.includes(k)) v += basicPlus;
      if (v > 0 && dim) v = R.diminishGain(this.s.attrs[k] || 0, v, dim);
      if (v === 0) continue;
      this.s.attrs[k] = Math.max(0, (this.s.attrs[k] || 0) + v);  // 属性永不为负
      out[k] = v;
    }
    if (Object.keys(out).length) {
      this.ui.floatAttrs(out, opts.anchor, opts.reason || '属性变化');
      if (milestoneBefore) {
        const milestoneAfter = { studySlots: this.studySlots(), insightCap: this.insightCap(), strategyCap: this.strategyCap(), manuscriptCap: this.manuscriptCap() };
        const labels = { studySlots: '研修位', insightCap: '心得上限', strategyCap: '构思上限', manuscriptCap: '稿匣上限' };
        const breakthroughs = Object.keys(labels)
          .filter(k => milestoneAfter[k] > milestoneBefore[k])
          .map(k => `${labels[k]} +${milestoneAfter[k] - milestoneBefore[k]}`);
        if (breakthroughs.length) {
          const text = `三功突破：${breakthroughs.join('、')}`;
          this.ui.toast?.(text);
        }
      }
    }
    return out;
  }

  addInspiration(v, reason) {
    if (!v) return 0;
    const mech = this.schoolMechanics();
    const st = this.s.schoolState || (this.s.schoolState = this.createSchoolState(this.s.school));
    let amount = Number(v) || 0;
    // 奇士只放大正向、非开局来源；负向和 start_insp 不进入累积器。
    const isPositiveSource = amount > 0 && reason !== '开局' && !String(reason || '').startsWith('文心·') && !String(reason || '').startsWith('传承');
    if (mech.type === 'qishi' && isPositiveSource) {
      st.inspirationAccumulator = Number(st.inspirationAccumulator) || 0;
      const extra = amount * (Number(mech.inspirationBonusRate) || 0);
      st.inspirationAccumulator += extra;
      const whole = Math.floor(st.inspirationAccumulator);
      if (whole > 0) {
        amount += whole;
        st.inspirationAccumulator -= whole;
      }
    }
    const before = this.s.inspiration;
    this.s.inspiration = R.clamp(before + amount, 0, this.s.inspirationMax);
    const real = this.s.inspiration - before;
    if (real) this.ui.floatInspiration(real, reason);
    return real;
  }

  /** 灵感上限变更：与灵感/属性同样给出实时反馈，并保证当前值不越界。 */
  addInspirationMax(v, reason = '灵感上限') {
    const gain = Number(v) || 0;
    if (!gain) return 0;
    const base = Number(this.cfg.inspiration && this.cfg.inspiration.max) || 0;
    const before = Number(this.s.inspirationMax) || base;
    this.s.inspirationMax = Math.max(base, before + gain);
    this.s.inspiration = Math.min(this.s.inspirationMax, this.s.inspiration);
    const real = this.s.inspirationMax - before;
    if (real && this.ui && typeof this.ui.floatInspirationMax === 'function') this.ui.floatInspirationMax(real, reason);
    return real;
  }

  /* -------------------------------------------------------- 文心 */
  /**
   * 取某文心「指定等级」的生效副本：effect 取自升级表 levels[level-1]（设计 Lv1 起为权威生效值），
   * 主动文心附带该等级 cost。返回新对象，绝不改动 cfg 模板，便于升级时原地替换存储副本的 effect/cost。
   * 无升级数据时退化为直接克隆配置模板（保持旧行为）。
   */
  leveledTalent(talent, level = 1) {
    const up = this.cfg.talentUpgradeById && this.cfg.talentUpgradeById.get(talent.id);
    const clone = { ...talent };
    if (up && up.levels && up.levels[level - 1]) {
      clone.effect = JSON.parse(JSON.stringify(up.levels[level - 1].effect));
      if (up.levels[level - 1].cost != null) clone.cost = up.levels[level - 1].cost;
      else if (talent.cost != null) clone.cost = talent.cost;
    } else if (talent.effect) {
      clone.effect = JSON.parse(JSON.stringify(talent.effect));
    }
    return clone;
  }

  async grantTalent(talent, opts = {}) {
    if (!talent) return false;
    const s = this.s;
    const list = talent.kind === 'active' ? s.active : s.passive;
    const max = talent.kind === 'active' ? ACTIVE_MAX : PASSIVE_MAX;
    if (list.some(t => t.id === talent.id)) return false;   // 同名不叠加

    if (!opts.silent) await this.ui.showTalentGain(talent);

    // 持有副本按「继承等级」生效：读取图鉴记录的历史最高等级（跨局保持），
    // 升级时原地替换 effect/cost，不污染 cfg 模板。
    const maxLv = Math.max(1, Number((this.cfg.talentUpgradeById && this.cfg.talentUpgradeById.get(talent.id) || {}).maxLevel) || 1);
    const carriedLv = Math.max(1, Math.floor(Number(opts.startLevel) || 1));
    const startLv = Math.min(maxLv, Math.max(1, Codex.getTalentLevel(talent.id) || 1, carriedLv));
    const lvl1 = this.leveledTalent(talent, startLv);

    if (list.length >= max) {
      const idx = await this.ui.askReplaceTalent(talent, list.slice());
      if (idx === null || idx === undefined || idx < 0) {
        this.push(`放弃文心「${talent.name}」`);
        return false;
      }
      const removed = list[idx];
      this.revokeTalentFlat(removed);
      list.splice(idx, 1, lvl1);
      this.push(`以「${talent.name}」替换「${removed.name}」`);
    } else {
      list.push(lvl1);
      this.push(`${opts.inherited ? '传承' : '获得'}文心「${talent.name}」`);
    }
    this.applyTalentFlat(lvl1);
    this.applyTalentInstant(lvl1);
    s.talentLevels[talent.id] = startLv;
    if (startLv > 1) {
      this.push(`文心「${talent.name}」承袭前世修为，自 Lv${startLv} 起`);
      if (this.ui && this.ui.toast) this.ui.toast(`✦ 文心·${talent.name} 承袭 Lv${startLv}`);
    }
    // 传承带回的是上一局已获得的文心，不应被当成当前局的新奇遇掉落，
    // 以免错误推进“本局获得文心数”相关的解锁或统计。
    if (!opts.inherited) s.events.talents++;

    // 文心「洛阳纸贵」：每获得一枚新文心，灵感 +2（含替换所得）
    for (const t of s.passive) {
      const ef = t.effect || {};
      if (ef.type === 'insp_on_talent') this.addInspiration(Number(ef.value) || 0, `文心·${t.name}`);
    }

    // 文心羁绊：重算当前激活集合，并在「新达成」时提示
    const beforeIds = new Set((s.synergies || []).map(sy => sy.id));
    const afterSyn = this.synergySet();
    s.synergies = afterSyn.map(sy => ({ id: sy.id, name: sy.name, desc: sy.desc, members: sy.members }));
    for (const sy of afterSyn) {
      if (!beforeIds.has(sy.id)) {
        this.ui.toast(`✦ 文心羁绊达成 · ${sy.name}！${sy.desc}`);
        Codex.recordSynergy(sy.id);   // 图鉴：记录已达成的羁绊（跨局累计收集）
      }
    }

    Codex.recordTalent(talent.id);   // 图鉴：记录已获得的文心（跨局累计）
    if (!opts.inherited && s.tutorialState && !s.tutorialState.talentSeen) {
      s.tutorialState.talentSeen = true;
    }
    this.ui.onState(s);
    if (!opts.inherited && s.tutorialState && s.tutorialState.talentSeen) this.onForceSave?.();
    return true;
  }

  /**
   * 文心升级：玩家在「文心」详情中花费灵感提升某枚已持有文心的等级。
   * - 校验：必须持有、未满级、灵感足以支付「升下一级成本」。
   * - 扣灵感 → 原地替换持有副本的 effect/cost 为新等级生效值。
   * - 一次性/常驻类按差值结算，避免重复套取或重复加成：
   *     · attr_flat：先 revoke 旧等级属性，再 apply 新等级（净差值刚好）。
   *     · start_insp：仅结算 (新值 − 旧值) 的灵感差值。
   *     · insp_max：仅结算扩容差值（同 group 互斥标记不重设，替换后不回退）。
   * - 其余类型（骰面化用、骰组章法、相性与各 pct 等）效果在战斗中实时读取 t.effect，替换即生效。
   * 返回 { ok, level?, max?, cost?, reason? }。
   */
  upgradeTalent(id) {
    const s = this.s;
    const up = this.cfg.talentUpgradeById && this.cfg.talentUpgradeById.get(id);
    if (!up) return { ok: false, reason: '该文心暂不可升级' };
    const t = s.passive.find(x => x.id === id) || s.active.find(x => x.id === id);
    if (!t) return { ok: false, reason: '未持有该文心' };
    const level = Number(s.talentLevels[id]) || 1;
    if (level >= up.maxLevel) return { ok: false, reason: '已满级', level, max: up.maxLevel };
    const baseCost = Number(up.upCost[level - 1]) || 0;
    const schoolMech = this.schoolMechanics();
    const cost = schoolMech.type === 'qishi'
      ? Math.max(1, Math.ceil(baseCost * (Number(schoolMech.upgradeCostRate) || 0.65)))
      : baseCost;
    if (s.inspiration < cost) return { ok: false, reason: '灵感不足', level, max: up.maxLevel, cost, baseCost };
    const newLevel = level + 1;
    const newEntry = up.levels[newLevel - 1];
    if (!newEntry) return { ok: false, reason: '升级数据缺失', level, max: up.maxLevel };

    this.addInspiration(-cost, `升级·${t.name}`);   // 灵感不足已在上方拦截，此处必可扣

    const oldEffect = t.effect || {};
    const ef = newEntry.effect;
    // attr_flat：先撤销旧等级、再施加新等级（净差值）
    if (oldEffect.type === 'attr_flat' && ef.type === 'attr_flat') this.revokeTalentFlat(t);

    // 原地替换持有副本的 effect / cost（不污染 cfg 模板）
    t.effect = JSON.parse(JSON.stringify(ef));
    if (newEntry.cost != null) t.cost = newEntry.cost;

    if (ef.type === 'attr_flat') {
      this.applyTalentFlat(t);
    } else if (ef.type === 'start_insp') {
      const delta = (Number(ef.value) || 0) - (Number(oldEffect.value) || 0);
      if (delta > 0) this.addInspiration(delta, `升级·${t.name}`);
    } else if (ef.type === 'insp_max') {
      const delta = (Number(ef.value) || 0) - (Number(oldEffect.value) || 0);
      if (delta > 0) {
        const gain = Math.max(0, delta);
        this.addInspirationMax(gain, `文心·${t.name} 精进`);
        this.push(`文心「${t.name}」精进，本局灵感上限 +${gain}`);
      }
    }

    s.talentLevels[id] = newLevel;
    Codex.recordTalentLevel(id, newLevel);   // 图鉴：记录历史最高等级（跨局保持）
    this.push(`文心「${t.name}」精进至 Lv${newLevel}`);
    this.ui.onState(s);
    // 升级效果与日志一并立即落盘，使「存档重载 / 继续上局」都能还原到升级后状态，
    // 不会因升级后到下一回合存档点前重载而回退到升级前。（onForceSave 由 UI 挂接，无 UI 时安全空转）
    if (typeof this.onForceSave === 'function') this.onForceSave();
    else if (typeof this.onSavePoint === 'function') this.onSavePoint();
    return { ok: true, level: newLevel, max: up.maxLevel, cost };
  }

  applyTalentFlat(t) {
    if (t.effect && t.effect.type === 'attr_flat' && t.effect.attrs) this.addAttrs(t.effect.attrs, { raw: true, reason: `文心·${t.name}` });
  }
  /** 获得时一次性触发的效果（如「胸有成竹」开局灵感 +N），不随替换回滚 */
  applyTalentInstant(t) {
    const ef = t.effect || {};
    if (ef.type === 'start_insp') this.addInspiration(Number(ef.value) || 0, `文心·${t.name}`);
    // 本局永久扩容：只结算一次；即使之后替换掉该文心，上限也不回退。
    // 同 group 的扩容文心互斥，防止「蓄水成渊 + 海纳百川」叠加造成资源失衡。
    if (ef.type === 'insp_max') {
      const ts = this.s.talentState || (this.s.talentState = { triggers: {}, flags: {} });
      ts.flags = ts.flags || {};
      const group = String(ef.group || 'inspiration_capacity');
      if (!ts.flags[group]) {
        const gain = Math.max(0, Number(ef.value) || 0);
        this.addInspirationMax(gain, `文心·${t.name}`);
        ts.flags[group] = t.id;
        this.push(`文心「${t.name}」开拓心源，本局灵感上限 +${gain}`);
      }
    }
  }
  revokeTalentFlat(t) {
    if (t.effect && t.effect.type === 'attr_flat' && t.effect.attrs) {
      for (const [k, v] of Object.entries(t.effect.attrs)) this.s.attrs[k] = Math.max(0, (this.s.attrs[k] || 0) - (Number(v) || 0));
    }
  }

  /**
   * 抽一枚玩家尚未持有的文心（图鉴专属与 reincarnate 传承文心不参与随机掉落，
   * 后者只能经由指定奇遇——如「留人古寺」——的抉择获得）。
   */
  randomTalent(kind, excludeIds = []) {
    const s = this.s;
    const have = new Set([...s.passive, ...s.active].map(t => t.id));
    for (const id of Array.isArray(excludeIds) ? excludeIds : []) if (id) have.add(id);
    const ts = s.talentState || (s.talentState = { triggers: {}, flags: {} });
    ts.flags = ts.flags || {};
    const ownedCount = new Set([...s.passive, ...s.active].map(t => t.id)).size;
    const eligible = t => {
      const a = t.acquire || null;
      if (!a) return true;                         // 旧文心完全沿用原随机池
      if (a.minTurn != null && s.turn < Number(a.minTurn)) return false;
      if (a.maxInspiration != null && s.inspiration > Number(a.maxInspiration)) return false;
      if (a.minTalents != null && ownedCount < Number(a.minTalents)) return false;
      if (a.minWins != null && (s.battle.win || 0) < Number(a.minWins)) return false;
      if (a.phase && s.phase !== a.phase) return false;
      if (a.excludeFlag && ts.flags[String(a.excludeFlag)]) return false;
      return true;
    };
    const pool = this.cfg.talents.filter(t =>
      !have.has(t.id)
      && (!kind || t.kind === kind)
      && t.source !== 'album'
      && !(t.effect && t.effect.type === 'reincarnate')
      && eligible(t));
    if (!pool.length) return null;
    return pool[Math.floor(this.rand() * pool.length)];
  }

  /**
   * 名胜格的候选池：一次触发内顺次排除已抽出的文心，保证候选不重复；
   * 池不足时返回实际可抽数量，不修改持有状态，也不扣灵感。
   */
  scenicTalentCandidates(count = 3) {
    const out = [];
    const n = Math.max(0, Math.floor(Number(count) || 0));
    while (out.length < n) {
      const next = this.randomTalent(undefined, out.map(t => t.id));
      if (!next) break;
      out.push(next);
    }
    return out;
  }

  /** 受上限约束的文心触发；次数写入 talentState，替换/再获得不会刷新。 */
  triggerTalentLimited(t, reason) {
    const ef = (t && t.effect) || {};
    const ts = this.s.talentState || (this.s.talentState = { triggers: {}, flags: {} });
    ts.triggers = ts.triggers || {};
    const used = Number(ts.triggers[t.id]) || 0;
    const max = Math.max(0, Number(ef.maxTriggers) || 0);
    if (max && used >= max) return false;
    const gain = Math.max(0, Number(ef.value) || 0);
    if (!gain || this.s.inspiration >= this.s.inspirationMax) return false;
    const real = this.addInspiration(gain, reason || `文心·${t.name}`);
    if (real > 0) ts.triggers[t.id] = used + 1;
    return real > 0;
  }

  /** 布局谋篇：当前棋局下一枚移动骰的发动成本；递增次数只属于本局，不影响下一局新开局。 */
  plannedMoveCost() {
    const t = this.s.active.find(x => x.id === 'TA08');
    const ef = t && t.effect || {};
    if (!t || ef.type !== 'planned_dice') return 0;
    const used = Number((this.s.talentState && this.s.talentState.activeUses || {})[t.id]) || 0;
    const base = Math.max(1, Number(ef.baseCost ?? t.cost) || 1);
    const step = Math.max(0, Number(ef.costStep) || 0);
    return base + used * step;
  }

  /** 在地图回合掷移动骰前发动布局谋篇；每次仅锁定紧接着的一枚移动骰。 */
  planMoveDice(value = 6) {
    const t = this.s.active.find(x => x.id === 'TA08');
    const ef = t && t.effect || {};
    if (!t || ef.type !== 'planned_dice') return false;
    if (this.s.plannedMoveDice != null) return false;
    const cost = this.plannedMoveCost();
    if (this.s.inspiration < cost) return false;
    const max = Math.max(1, Number(ef.maxValue) || 6);
    const planned = Math.max(1, Math.min(max, Number(value) || 6));
    this.addInspiration(-cost, `文心·${t.name}`);
    const ts = this.s.talentState || (this.s.talentState = { triggers: {}, flags: {}, activeUses: {} });
    ts.activeUses = ts.activeUses || {};
    ts.activeUses[t.id] = (Number(ts.activeUses[t.id]) || 0) + 1;
    this.s.plannedMoveDice = planned;
    this.push(`文心「${t.name}」定策，本回合移动骰为 ${planned} 点（消耗 ${cost} 灵感）`);
    this.ui.onState(this.s);
    return true;
  }

  /** 当前已激活的文心羁绊：拥有 members 全部 id 即激活（战斗时实时重算，无持久状态需回滚）。 */
  synergySet() {
    const have = new Set([...this.s.passive, ...this.s.active].map(t => t.id));
    return (this.cfg.synergies || []).filter(sy => (sy.members || []).every(id => have.has(id)));
  }

  /* ==================================================== 回合主循环 */
  async playTurn() {
    const s = this.s;
    if (s.over) return;

    // 回合开始：灵感为 0 → 封笔
    if (s.inspiration <= 0) return this.endGame('fengbi');

    // 第0回合前先展示开局序章；续玩存档 turn>0 不重复触发。
    if (s.turn === 0 && typeof this.ui.showPrologue === 'function' && !s.prologueSeen) {
      await this.ui.showPrologue();
      s.prologueSeen = true;
      this.ui.onState(s);
    }
    // 首回合开始前：弹窗说明当朝文风（风潮）及其效果（续玩存档 turn>0 不触发）
    if (s.turn === 0 && typeof this.ui.showZeitgeist === 'function') {
      await this.ui.showZeitgeist(s.zeitgeist);
    }
    s.turn++;
    if (s.turn > TURN_LIMIT) return this.endGame('turnlimit');

    this.tickSky();
    const previousPhase = s.phase;
    s.phase = this.cfg.board.layout === 'concentric_spiral' ? this.phaseForRoute() : (s.lap >= 2 ? 'lap2' : 'lap1');
    this.refillStrategy(s.phase);
    this.ui.onState(s);
    // 布局谋篇改为玩家主动点击触发：HUD 的「布局谋篇」按钮在掷骰前可点开定策，
    // 定策值写入 s.plannedMoveDice，于下方掷骰时生效；不再每回合自动弹窗打断体验。
    if (this.cfg.board.layout !== 'concentric_spiral' && s.phase === 'lap2' && previousPhase !== 'lap2' && typeof this.ui.showLap2Intro === 'function') {
      await this.ui.showLap2Intro();
      this.ui.onState(s);
    }

    const dice = s.plannedMoveDice != null
      ? Math.max(1, Math.min(6, Number(s.plannedMoveDice) || 6))
      : this.d6();
    const plannedMove = s.plannedMoveDice != null;
    s.plannedMoveDice = null;
    await this.ui.showDice(dice);
    if (plannedMove) this.ui.toast(`布局谋篇生效：本回合移动 ${dice} 格`);
    const finalDice = this.applyStrategyMovement(dice, plannedMove);
    let movement = await this.moveSteps(finalDice);
    if (s.over) return;

    // 阶段门不能被骰子跨过而漏结算；但也不能吞掉玩家已经掷出的余步。
    // 先在门格完成“揭示下一圈 → 晋阶试”，再把这枚骰子的剩余步数走完。
    while (movement && typeof movement === 'object' && movement.arrived === 'gate') {
      await this.resolveCell();
      if (s.over) return;
      const remain = Math.max(0, Number(movement.remainingSteps) || 0);
      if (!remain) { this.ui.onState(s); this.onSavePoint?.(s); return; }
      movement = await this.moveSteps(remain);
      if (s.over) return;
    }

    const arrived = typeof movement === 'string' ? movement : movement?.arrived;
    if (arrived === 'palace') { await this.runPalace(); this.onSavePoint?.(s); return; }
    await this.resolveCell();
    this.ui.onState(s);
    // 安全保存点：回合内所有状态结算（含弹窗交互）都已完成，此时序列化是稳定快照
    this.onSavePoint?.(s);
  }

  tickSky() {
    const s = this.s;
    const keep = [];
    for (const sk of s.sky) {
      sk.left -= 1;
      if (sk.left > 0) keep.push(sk);
      else this.ui.skyExpired(sk.card);
    }
    s.sky = keep;
  }

  /** 逐格前进；三圈路线抵达 routeSize 后进入单场殿试。 */
  async moveSteps(steps) {
    const s = this.s;
    const board = this.cfg.board;

    if (board.layout === 'concentric_spiral') {
      for (let i = 0; i < steps; i++) {
        if (s.routeIndex + 1 >= board.routeSize) { await this.ui.movePiece(s); return 'palace'; }
        const fromIndex = s.routeIndex;
        const fromRing = board.routeCells[fromIndex]?.ring || s.ringId || 'outer';
        s.routeIndex++;
        s.pos = s.routeIndex;
        const toRing = board.routeCells[s.routeIndex]?.ring || fromRing;
        s.ringId = toRing;
        await this.ui.movePiece(s);

        // 每一座阶段门都是硬关口，不能只在“刚好掷到”时才结算。
        // 例如从 70 掷出 4，旧逻辑会越过 72 的举人门直接落到 74：
        // Game 已进入 middle，但棋盘仍在 outer，造成“外圈仍在、棋子透明”的半状态。
        const gate = board.routeCells[s.routeIndex]?.phaseGate;
        if (gate && !s.phaseGateSeen[gate.phase]) {
          return { arrived: 'gate', gateIndex: s.routeIndex, remainingSteps: Math.max(0, steps - i - 1) };
        }
      }
      return { arrived: 'ok', gateIndex: null };
    }

    for (let i = 0; i < steps; i++) {
      if (s.track === 'branch') {
        const len = board.branches[s.branchId].cells.length;
        if (s.branchIndex >= len - 1) break;             // 支线无需精确到达
        s.branchIndex++;
      } else {
        s.pos = (s.pos + 1) % board.ringSize;
        if (s.pos === 0) {
          s.lap++;
          if (s.lap > board.laps) { await this.ui.movePiece(s); return 'palace'; }
          this.ui.toast(`再度经过童生铺，进入「会试圈」，对手升档`);
          this.push('进入会试圈');
          if (s.phase !== 'lap2' && typeof this.ui.showLap2Intro === 'function') {
            s.phase = 'lap2';
            this.ui.onState(s);
            await this.ui.showLap2Intro();
          }
        }
      }
      await this.ui.movePiece(s);
    }
    return 'ok';
  }

  /* ---------------------------------------------- 落点格子结算 */
  async resolveCell() {
    const cell = this.currentCell();
    if (!cell) return;
    this.ui.highlightCell(cell);
    switch (cell.type) {
      case 'start': this.ui.toast('童生铺——歇脚片刻，再上征途'); break;
      case 'ping': await this.doPing(cell); break;
      case 'ze': await this.doZe(cell); break;
      case 'quiz': await this.doQuiz(cell); break;
      case 'event': await this.doEvent(cell); break;
      case 'battle': await this.doBattleCell(cell); break;
      case 'gate': await this.doBattleCell(cell); break;
      case 'sky': await this.doSky(cell); break;
      case 'mingjing': await this.doScenic(cell); break;
      default: break;
    }
    // 地图编辑器可为任意格子配置额外落地效果，与类型默认效果叠加
    if (cell.effect && Object.keys(cell.effect).length) {
      this.push(`「${cell.name}」触发额外效果`);
      await this.applyEffect(cell.effect);
    }
  }

  async doPing(cell) {
    if (this.skyActive('no_ping_recover')) {
      this.ui.toast(`${cell.name}——梅雨愁绪，纸墨皆潮，灵感未复`);
      return;
    }
    this.addInspiration(this.cfg.inspiration.pingCell ?? 1, '平韵');
    this.ui.toast(`${cell.name}——平韵格，灵感 +${this.cfg.inspiration.pingCell ?? 1}`);
  }

  async doZe(cell) {
    const g = this.cfg.attrs.zeCellGain ?? 1;
    this.addAttrs({ bi: g, xue: g, si: g }, { reason: '仄韵格·基本功' });
    const zc = this.cfg.inspiration.zeCellInsp ?? 1;
    this.addInspiration(zc, '仄韵');
    this.ui.toast(`${cell.name}——仄韵格，基本功精进，灵感 +${zc}`);
  }

  /* ------------------------------------------------------ 考题格 */
  async doQuiz(cell) {
    const s = this.s;
    const all = this.cfg.questions;
    let pool = all.filter(q => !s.usedQuestions.has(q.id));
    if (!pool.length) { s.usedQuestions.clear(); pool = all.slice(); }
    if (!pool.length) { this.ui.toast('题库空空如也，此格退化为平韵格'); return this.doPing(cell); }

    // 70% 知识问答 / 30% 创作抉择
    const wantType = this.rand() < 0.70 ? 'knowledge' : 'choice';
    let sub = pool.filter(q => q.type === wantType);
    if (!sub.length) sub = pool;

    const q = R.pickQuestion(sub, s.phase, this.rand);
    if (!q) return this.doPing(cell);
    s.usedQuestions.add(q.id);

    const ans = await this.ui.showQuiz(q, { phase: s.phase, seconds: 30 });
    s.quiz.asked++;
    if (q.type === 'knowledge') {
      const ok = !ans.timedOut && ans.index === q.answer;
      if (ok) {
        s.quiz.right++;
        const key = ['shi', 'ci', 'lian'].includes(q.category) ? q.category : 'xue';
        const sky = this.skyActive('quiz_bonus');
        const gain = (this.cfg.attrs.quizCorrectGain ?? 2) + (sky ? Number(sky.card.effect.value || 1) : 0);
        this.addAttrs({ [key]: gain }, { reason: '答对考题' });
        this.push(`答对「${q.id}」，${R.ATTR_NAMES[key]} +${gain}`);
        this.addInspiration(this.cfg.inspiration.quizCorrectInsp ?? 0, '答对'); // 核心技能↔燃料闭环
        await this.gainBowenKnowledge('答对知识题');
        for (const t of s.passive) if ((t.effect || {}).type === 'insp_on_quiz') this.triggerTalentLimited(t, `文心·${t.name}`);
      } else {
        this.addInspiration(this.cfg.inspiration.quizWrong ?? -2, ans.timedOut ? '超时' : '答错');
        this.push(`答错「${q.id}」`);
      }
      await this.ui.showQuizResult(q, ans, ok);
    } else {
      // 抉择题无对错；有效选择只接入心得/研修，不再直接堆叠属性。
      if (!ans.timedOut && ans.index >= 0) {
        s.quiz.right++;
        const feedback = this.applyChoiceStudy(q, ans.index);
        for (const t of s.passive) if ((t.effect || {}).type === 'insp_on_quiz') this.triggerTalentLimited(t, `文心·${t.name}`);
        await this.ui.showQuizResult(q, ans, true, feedback);
      } else {
        this.addInspiration(this.cfg.inspiration.quizWrong ?? -2, '超时');
        this.push(`抉择题「${q.id}」超时未决`);
        await this.ui.showQuizResult(q, ans, false);
      }
    }
    this.applyAlbumOutcomeEffects('quiz', {
      result: (!ans.timedOut && ans.index >= 0 && (q.type === 'choice' || ans.index === q.answer)) ? 'win' : 'lose',
      style: ['shi', 'ci', 'lian'].includes(q.category) ? q.category : undefined,
      phase: s.phase,
      eventKey: q.id
    });
    this.ui.onState(s);
  }

  /* ------------------------------------------------------ 辞宗战后轻奇遇 */
  _eventHasTalentReward(ev) {
    const has = e => !!(e && (e.talent || (Array.isArray(e.choices) && e.choices.some(c => c && c.effect && c.effect.talent))));
    return has(ev) || has(ev && ev.challenge && ev.challenge.winAll);
  }

  async applyEventChoice(ev, choiceIdx) {
    const choices = Array.isArray(ev && ev.choices) ? ev.choices : [];
    const c = choices[choiceIdx] || choices[0] || {};
    const choiceText = String(c.text || '未命名选择').trim();
    const resultText = String(c.resultText || '').trim() || `选择已确认：「${choiceText}」`;
    const echo = {
      eventId: String((ev && ev.id) || ''),
      eventName: String((ev && ev.name) || '奇遇'),
      choiceText,
      resultText
    };

    // 先确认玩家选择，再结算数值；即使奖励包含后续弹窗，回声也不会被延迟。
    if (this.ui.showChoiceEcho) this.ui.showChoiceEcho(echo);
    else this.ui.toast(`已选择：${choiceText}\n${resultText}`);
    this.push(`选择「${echo.eventName}」：${choiceText}｜${resultText}`);
    await this.applyEffect(c.effect || {});
    return echo;
  }

  emitEventEcho(ev, resultText, leadText = '奇遇回声') {
    const echo = {
      eventId: String((ev && ev.id) || ''),
      eventName: String((ev && ev.name) || '奇遇'),
      leadText,
      resultText: String(resultText || '').trim() || '此事既了，一笔因缘已落入你的行卷。'
    };
    if (this.ui.showEventEcho) this.ui.showEventEcho(echo);
    else this.ui.toast(`${leadText}：${echo.eventName}\n${echo.resultText}`);
    this.push(`${leadText}「${echo.eventName}」：${echo.resultText}`);
    return echo;
  }

  async applyDirectEvent(ev) {
    const echo = this.emitEventEcho(ev, ev && ev.resultText, '奇遇所得');
    await this.applyEffect((ev && ev.effect) || {});
    return echo;
  }

  async runCizongLightEvent() {
    const mech = this.schoolMechanics();
    if (mech.type !== 'cizong_bi') return false;
    const st = this.s.schoolState || (this.s.schoolState = this.createSchoolState(this.s.school));
    const every = Number(mech.lightEventEvery) || 2;
    if ((Number(st.battleSeq) || 0) % every !== 0 || st.lightEventBattle === st.battleSeq) return false;
    const pool = (this.cfg.events || []).filter(ev => {
      if (!ev || this.s.seenEvents.has(ev.id)) return false;
      if (ev.kind === 'challenge' || this._eventHasTalentReward(ev)) return false;
      return ev.kind === 'choice' || ev.kind === 'direct' || (!ev.kind && ev.effect);
    });
    if (!pool.length) { this.push('辞宗·文成有遇：今夜文缘已尽'); return false; }
    const ev = pool[Math.floor(this.rand() * pool.length)];
    this.s.seenEvents.add(ev.id);
    st.lightEventBattle = st.battleSeq;
    st.cizongEvents = (Number(st.cizongEvents) || 0) + 1;
    if (this.cfg.inspiration.eventCellCost) this.addInspiration(this.cfg.inspiration.eventCellCost, '辞宗·战后奇遇耗神');
    this.push(`辞宗·文成有遇：${ev.name}`);
    const idx = await this.ui.showEvent(ev);
    if (ev.kind === 'choice') {
      await this.applyEventChoice(ev, idx);
    } else await this.applyDirectEvent(ev);
    this.applyAlbumOutcomeEffects('event', { phase: this.s.phase, eventKey: ev.id });
    return true;
  }

  /* ------------------------------------------------------ 奇遇格 */
  async doEvent(cell) {
    const s = this.s;
    const pool = this.cfg.events.filter(e => !s.seenEvents.has(e.id));   // 同局去重
    if (!pool.length) { this.ui.toast('奇遇已尽，此格退化为平韵格'); return this.doPing(cell); }

    const ev = R.pickByRarity(pool, this.rand);
    s.seenEvents.add(ev.id);
    s.events.total++;
    if (ev.rarity === 'rare') s.events.rare++;
    if (ev.rarity === 'legend') s.events.legend++;

    // 「奇遇耗神」：参与奇遇先耗一份心神（每格落地扣一次，替代已回退的逐格「行路耗神」；调参见 inspiration.json）
    if (this.cfg.inspiration.eventCellCost) this.addInspiration(this.cfg.inspiration.eventCellCost, '奇遇耗神');

    const choiceIdx = await this.ui.showEvent(ev);

    if (ev.kind === 'choice') {
      await this.applyEventChoice(ev, choiceIdx);
    } else if (ev.kind === 'challenge') {
      await this.runChallenge(ev);
    } else {
      await this.applyDirectEvent(ev);
    }
    this.applyAlbumOutcomeEffects('event', { phase: s.phase, eventKey: ev.id });
    this.ui.onState(s);
  }

  async applyEffect(effect) {
    if (!effect) return;
    if (effect.attrs) this.addAttrs(effect.attrs, { reason: '奇遇所得' });
    if (effect.inspiration) this.addInspiration(Number(effect.inspiration), '奇遇');
    if (effect.inspirationMax) {
      const gain = Math.max(0, Number(effect.inspirationMax) || 0);
      if (gain > 0) {
        this.addInspirationMax(gain, '奇遇·心源拓阔');
        this.push(`心源拓阔，本局灵感上限 +${gain}`);
      }
    }
    if (effect.item) { this.s.events.items++; this.ui.toast(`获得道具「${effect.item}」`); }
    if (effect.talent) {
      const t = this.cfg.talentById.get(effect.talent) || this.randomTalent();
      await this.grantTalent(t);
    }
  }

  async runChallenge(ev) {
    const challenge = ev.challenge || {};
    const n = Number(challenge.battles) || 1;
    let wins = 0;
    for (let i = 0; i < n; i++) {
      if (this.s.inspiration <= 0) { this.ui.toast('灵感枯竭，挑战中止'); break; }
      const res = await this.doBattle({
        npc: this.pickNpc(false),
        label: `${ev.name}·第 ${i + 1}/${n} 场`
      });
      if (res === 'win') wins++;
    }
    if (wins >= n) {
      this.emitEventEcho(ev, challenge.winText, '挑战全胜');
      await this.applyEffect(challenge.winAll || {});
    } else {
      this.emitEventEcho(ev, challenge.failText, `挑战未竟 · ${wins}/${n} 胜`);
    }
    return { wins, total: n, complete: wins >= n };
  }

  /* ------------------------------------------------------ 天象格 */
  async doSky(cell) {
    const pool = this.cfg.sky || [];
    if (!pool.length) return this.doPing(cell);
    const card = pool[Math.floor(this.rand() * pool.length)];
    const isNextBattle = (card.effect || {}).type === 'next_battle_pct';
    if (isNextBattle) {
      // 「金榜题名时」是「下一场论战」一次性增益，与回合无关，不计入回合倒计时列表；
      // 仅写入 nextBattlePct，由结算（resolveBattle）在下一场所论战消耗掉。
      this.s.nextBattlePct = Number(card.effect.value) || 0;
    } else {
      const exist = this.s.sky.find(x => x.card.id === card.id);
      // 契约字段是 duration；turns 为引擎侧别名，两者都认
      const turns = Number(card.turns) || Number(card.duration) || 6;
      if (exist) exist.left = turns;
      else this.s.sky.push({ card, left: turns });
    }
    await this.ui.showSky(card);
    Codex.recordSky(card.id); // 图鉴：记录本次邂逅的天象（跨局累计收集）
    this.ui.onState(this.s);
  }

  /* ------------------------------------------------------ 名胜格 */
  // 停留时，可消耗灵感抽取三枚候选文心，玩家只保留一枚；未选候选不进入持有状态。
  async doScenic(cell) {
    const cost = this.cfg.inspiration.scenicCost ?? 8;
    const go = await this.ui.askScenic(cell, cost, this.s.inspiration);
    if (!go) { this.ui.toast(`${cell.name}——览胜片刻，继续前行`); return; }
    if (this.s.inspiration < cost) { this.ui.toast('灵感不足，无缘访胜抽签'); return; }

    const candidates = this.scenicTalentCandidates(3);
    if (!candidates.length) {
      this.ui.toast('胸中已藏尽天下文心，再无可抽');
      return;
    }
    let pickResult;
    try {
      pickResult = typeof this.ui.chooseScenicTalent === 'function'
        ? await this.ui.chooseScenicTalent(candidates, { cell, cost })
        : -1;
    } catch (err) {
      this.ui.toast('文心选择未完成，访胜抽签取消，灵感未扣');
      return;
    }
    const index = Number(pickResult);
    if (!Number.isInteger(index) || index < 0 || index >= candidates.length) {
      this.ui.toast('未作选择，访胜抽签取消，灵感未扣');
      return;
    }
    const talent = candidates[index];
    if (!talent || candidates.some((t, i) => i !== index && t && t.id === talent.id)) {
      this.ui.toast('文心选择状态异常，访胜抽签取消，灵感未扣');
      return;
    }
    // 选择已确认后才扣费；候选生成、取消和异常均不会产生半笔消耗。
    this.addInspiration(-cost, '访胜抽签');
    let granted = false;
    try {
      granted = await this.grantTalent(talent);
    } catch (err) {
      granted = false;
    }
    if (!granted) {
      // 回退必须避开奇士的正向灵感放大，确保异常路径精确恢复原值。
      this.addInspiration(cost, '文心·访胜抽签回退');
      this.ui.toast('所选文心当前无法收入，访胜抽签已回退');
      return;
    }
    this.push(`于${cell.name}访胜，灵感 -${cost}，得文心「${talent.name}」`);
    this.ui.onState(this.s);
  }

  /* ====================================================== 战斗 */
  async doBattleCell(cell) {
    if (this.s.inspiration <= 0) { this.ui.toast('灵感枯竭，无力应战'); return; }
    const gate = cell.phaseGate;
    if (this.cfg.board.layout === 'concentric_spiral' && gate && !this.s.phaseGateSeen[gate.phase]) {
      const gateWithInk = Object.assign({}, gate, { inkSummary: this.choiceInkSummary(this.s.phase) });
      // 状态先落定，UI 再展示：即使弹窗/资源加载被中断，棋盘也能按 routeIndex 自愈到正确圈层。
      if (gate.transition) this.s.ringId = gate.transition;
      this.s.phaseGateSeen[gate.phase] = true;
      this.s.phase = gate.phase;
      this.refillStrategy(gate.phase);
      this.applyAlbumOutcomeEffects('phase', { phase: gate.phase, eventKey: gate.phase });
      if (typeof this.ui.syncStageRing === 'function') this.ui.syncStageRing(this.s);
      if (typeof this.ui.showStageChange === 'function') await this.ui.showStageChange(gateWithInk, this.s);
      // 二次同步是故障自愈：阶段弹窗曾是唯一切圈入口，任何旧 UI/缓存路径都会留下外圈+透明棋子。
      if (typeof this.ui.syncStageRing === 'function') this.ui.syncStageRing(this.s);
      const tier = (this.cfg.npcs || []).find(n => n.id === gate.exam);
      const pick = tier ? NpcSelection.pickNpcFromTier(this, tier) : this.pickNpc(false);
      if (pick.stageForced) {
        this.push(`三力构筑应验，晋阶试必遇「${pick.name}」`);
        this.ui.toast(`本阶段必遇：${pick.name}`);
      }
      await this.doBattle({ npc: pick, label: `晋阶试·${gate.phase === 'xiucai' ? '秀才' : gate.phase === 'juren' ? '举人' : '进士'}` });
      return;
    }
    const npc = this.pickNpc(false);
    if (npc.stageForced) {
      this.push(`三力构筑应验，本阶段必遇「${npc.name}」`);
      this.ui.toast(`本阶段必遇：${npc.name}`);
    }
    await this.doBattle({ npc, label: cell.name });
  }

  /** 建立一场战斗会话，交给 UI 逐步驱动六步流程 */
  createSession(opts) {
    const g = this;
    const s = this.s;
    const af = this.cfg.affinity;
    const themes = af.themes || ['yongwu'];
    const theme = opts.theme || themes[Math.floor(this.rand() * themes.length)];
    const npc = opts.npc;

    // 图鉴：记录本次邂逅的对手（发现进度持久化；具名 NPC 用稳定 id，无稳定 id 回退档位 id）
    if (npc && npc.name) {
      const fid = (npc.mech && npc.id) ? npc.id : (npc.id || npc.name);
      Codex.recordFoe(fid, npc.name);
    }

    // —— NPC 三机制：锁定本场意图（E0：锁定后不得暗改）——
    // 仅当 NPC 配置了 mech 才生成机制意图；其余走旧 pickNpcStyle/pickNpcManner。
    // E1 守卫（第六章 6.2/6.3）：若主公招牌或主破绽引用的模板在模板库中缺失，
    // 整套机制降级为旧行为——不生成机制意图、不展示研判区，避免「有招牌无破绽」
    // 的半成品以完整强度上线。副招牌缺失仅停用副招牌、主机制继续。
    const tplLib = this.cfg['npc-mechanics'] || {};
    const mechOk = (() => {
      const raw = npc && npc.mech;
      if (!raw) return false;
      const sigLib = tplLib.signatureTemplates || {};
      const weaLib = tplLib.weaknessTemplates || {};
      const sigMain = raw.signature && (raw.signature.main || raw.signature);
      const wea = raw.weakness;
      // 完整性（第六章 6.2）：招牌与破绽必须成对，缺一整套降级
      if (!sigMain || !wea) return false;
      // 主破绽缺失模板 → 整套降级
      if (wea && wea.template && !weaLib[wea.template]) return false;
      // 主招牌缺失模板 → 整套降级
      if (sigMain && sigMain.template && !sigLib[sigMain.template]) return false;
      return true;
    })();
    const npcMech = mechOk ? (npc && npc.mech) : null;
    let npcIntent = null;
    if (npcMech) {
      npcIntent = R.rollIntention({
        mech: npcMech,
        npcAttrs: (npc && npc.attrs) || {},
        af,
        theme,
        zeitgeist: s.zeitgeist,
        templates: tplLib
      });
      // 联力未解锁时，若意图锁定了联体，回退期望分最优（避免锁死不可用文体）
      if (npcIntent.style === 'lian' && !this.lianUnlocked) {
        npcIntent.style = R.pickNpcStyle(npc.attrs, false);
      }
    }
    const intentLocked = npcIntent
      ? {
          style: npcIntent.style, manner: npcIntent.manner,
          styleDisclosed: npcIntent.styleDisclosed, mannerDisclosed: npcIntent.mannerDisclosed,
          stance: npcIntent.stance, pattern: npcIntent.pattern, watchesActive: npcIntent.watchesActive,
          template: npcIntent.template
        }
      : null;

    // 为会话分配确定性的单场标识。结算可能因 UI 重试/读档恢复被再次调用，
    // 标识绑定“回合 + 结算前序号 + 场景标签”，不能随着 settleBattle 内 battleSeq 自增而变化。
    const battleId = `${s.turn}:${Number((s.schoolState || {}).battleSeq) || 0}:${opts.label || '挥毫论道'}`;
    const session = {
      battleId,
      label: opts.label || '挥毫论道',
      npc,
      // 本场是否以完整机制运行（模板缺失已整套降级旧行为，供结算侧复用判定）
      _mechValid: !!mechOk,
      theme,
      themeName: af.themeNames[theme] || theme,
      playerName: s.playerName || '',
      topic: opts.topic || pickTopic(theme, af, this.rand),
      intentLocked,               // NPC 三机制：本场锁定意图（E0）
      manners: af.manners || ['wanyue', 'haofang', 'zheli'],
      mannerNames: af.mannerNames,
      themeNames: af.themeNames,
      schoolHome: (this.s.school && this.s.school.homeManner) || null,
      homeResolved: (() => {
        const hm = this.s.school && this.s.school.homeManner;
        if (!hm) return null;
        if (hm === 'adaptive') return R.bestMannerForTheme(af.matrix, af.manners, theme);
        return hm;
      })(),
      schoolHomeName: af.mannerNames && this.s.school && this.s.school.homeManner
        ? (this.s.school.homeManner === 'adaptive' ? '通儒·临题自化' : af.mannerNames[this.s.school.homeManner])
        : null,
      // 本门文风恒定加成（数值，供 UI 显式展示；与 affinityOf 的隐藏相性档位区分）。
      homeBonus: (() => {
        const hm = this.s.school && this.s.school.homeManner;
        if (!hm) return 0;
        return Number(hm === 'adaptive' ? (af.homeAdaptiveBonus ?? 0.04) : (af.homeMannerBonus ?? 0.05));
      })(),
      zeitgeist: this.s.zeitgeist || null,
      synergies: this.s.synergies || [],
      // 气势连捷倍率（文心「一鼓作气」等）：拥有 streak_mult 时相乘，进入本场前算好，UI 与结算一致
      streakMult: (() => {
        let m = 1;
        for (const t of [...(this.s.passive || []), ...(this.s.active || [])]) {
          const ef = t.effect || {};
          if (ef.type === 'streak_mult') m *= (1 + (Number(ef.value) || 0));
        }
        return m;
      })(),
      isPalace: !!opts.isPalace,
      isHiddenFinal: !!opts.isHiddenFinal,
      // 殿试跨场适应层数（若本场为殿试且这是机制主考官）：供 UI 出「场间评语」
      palaceLayers: (() => {
        if (!opts.isPalace || !(npc && npc.mech)) return 0;
        const pal = (s.npcMech && s.npcMech.palace && s.npcMech.palace[PALACE_KEY]) || null;
        return pal ? (Number(pal.layers) || 0) : 0;
      })(),
      playerAttrs: this.effectiveAttrs(),
      battleCoef: (this.cfg.attrs || {}).battleFormula || null,
      styleSystem: this.styleConfig(),
      lastStyle: (this.ensureAbilityState() || {}).lastStyle || null,
      strategyPlanTriggered: null,
      usedPolish: false,
      lianUnlocked: this.lianUnlocked,
      // 文心属于「入场快照」：本场建立后即锁定 effect/cost，后续状态变化只影响下一场。
      // 深克隆避免 HUD 详情页升级原地替换持有副本时，意外改写已创建的战斗会话。
      passiveTalents: s.passive.map(t => ({ ...t, effect: t.effect ? JSON.parse(JSON.stringify(t.effect)) : t.effect })),
      // 布局谋篇属于地图回合移动骰，不进入论战主动文心栏；其余主动文心保留在本场快照。
      activeTalents: s.active.filter(t => (t.effect || {}).type !== 'planned_dice').map(t => ({ ...t, effect: t.effect ? JSON.parse(JSON.stringify(t.effect)) : t.effect })),
      usedActive: [],
      plannedDice: null,       // 「布局谋篇」预先指定的下一枚灵感骰点数
      plannedDiceCost: 0,
      plannedDiceTalentId: null,
      inspiration: s.inspiration,
      // 败北灵感惩罚的「预览值」：与结算逻辑完全一致（lateVal × 科场风起倍数），
      // 供 UI 判词精确显示，避免文案与实际扣分不一致。
      projLoseInsp: (() => {
        const insp = this.cfg.inspiration || {};
        const base = this.lateVal(insp.battleLoseExtra ?? -3, insp.battleLoseExtraLate);
        const mult = this.skyActive('battle_reward_mult') ? 2 : 1;
        return base * mult;
      })(),
      projLoseInspFor(style) {
        let loss = Number(this.projLoseInsp) || 0;
        if (style === 'lian') loss = Math.min(0, loss + (Number((this.styleSystem.lian || {}).lossInspirationReduce) || 1));
        if (g.strategyCanTrigger('guard')) loss = Math.min(0, loss + (Number((g.strategyPlans().guard || {}).lossReduce) || 2));
        return loss;
      },

      // 综合相性（基矩阵 + 门派文风 + 当朝风潮），供玩家抉择/UI 展示；不含气势连捷。
      affinityOf(manner) {
        return R.effectiveAffinity(af, manner, theme, this.schoolHome, this.zeitgeist);
      },
      starsOf(manner) { return R.affinityStars(this.affinityOf(manner)); },
      tierOf(manner) { return R.affinityTierLabel(this.affinityOf(manner)); },
      // 进入本场前的气势连捷加成（依赖连捷状态，单独展示，不并入 affinityOf 以免重复计）。
      momentumPre(manner) { return R.momentumPct(g.s.affStreak, manner, af) * (this.streakMult || 1); },
      canUseStyle(style) {
        if (style !== 'lian') return true;
        return g.lianUnlocked;
      },
      styleScore(style) { return R.styleBaseScore(this.playerAttrs, style, this.battleCoef).total; },
      styleHint(style) {
        if (style === 'lian' && !g.lianUnlocked) return '联力尚浅，先积淀对仗功底（需联力 ≥8）';
        if (style === 'shi') return '一气：单骰高低分化；追加后恢复普通骰分';
        if (style === 'ci') return '铺陈：首骰收束至 3～5；首次追加少耗灵感';
        return `对举：${this.lastStyle && this.lastStyle !== 'lian' ? '与上一场换体，作品 +8%' : '换体时得势；失利更能止损'}`;
      },
      previewDiceScore(style, pips) {
        const dicePct = Number((g.cfg.inspiration || {}).dicePct) || R.BATTLE_COEF.dicePct;
        return R.styleDiceScore(style, pips, this.styleSystem, R.BATTLE_COEF.diceMult, 0, dicePct);
      },
      /**
       * 追加骰的独立作品乘区：基础规则与文心分别列项，既供 UI 预览，也让结算明细能说明增益来源。
       * `extra_dice_pct` 的 value 为「每追加一枚」增加的乘区，避免把旧的骰面加点误当作新机制收益。
       */
      extraDiceModifiers(extraCount = 0) {
        const count = Math.max(0, Number(extraCount) || 0);
        if (!count) return [];
        const per = Number((g.cfg.inspiration || {}).extraDicePct) || 0;
        const mods = per ? [{ source: 'extraDice', label: `追加骰·${count}枚`, value: count * per }] : [];
        for (const t of [...this.passiveTalents, ...this.usedActive]) {
          const ef = t.effect || {};
          if (ef.type !== 'extra_dice_pct') continue;
          const value = Number(ef.value) || 0;
          if (value) mods.push({ source: 'talent', label: `文心·${t.name}·追加骰`, value: count * value });
        }
        return mods;
      },
      extraDicePct(extraCount = 0) {
        return this.extraDiceModifiers(extraCount).reduce((sum, mod) => sum + (Number(mod.value) || 0), 0);
      },
      extraDiceCost(style, extraIndex = 1) {
        const base = Number((g.cfg.inspiration || {}).extraDiceCost) || 5;
        let discount = 0;
        if (style === 'ci' && extraIndex === 1) discount += Number((this.styleSystem.ci || {}).firstExtraDiscount) || 0;
        if (extraIndex === 1) for (const t of this.passiveTalents) {
          const ef = t.effect || {};
          if (ef.type === 'extra_dice_pct' || ef.type === 'dice_pattern') discount += Math.max(0, Number(ef.firstCostDiscount) || 0);
        }
        const a = g.ensureAbilityState();
        if (extraIndex === 1 && a.manuscript.polish > 0) discount += Number(g.abilityConfig().manuscript?.polishDiscount) || 0;
        return Math.max(1, base - discount);
      },
      /** 当前战斗内主动文心成本；布局谋篇已移至地图移动骰，不在论战中显示。 */
      activeCost(id) {
        const t = this.activeTalents.find(x => x.id === id);
        if (!t) return 0;
        return Math.max(1, Number(t.cost) || 1);
      },
      /** 使用论战主动文心；布局谋篇不属于论战阶段。 */
      useActive(id, plannedValue = 6) {
        const t = this.activeTalents.find(x => x.id === id);
        if (!t) return false;
        const ef = t.effect || {};
        if (ef.type === 'planned_dice') return false;
        const repeatable = false;
        if (this.usedActive.some(x => x.id === id)) return false;
        if (repeatable && this.plannedDice != null) return false;
        if (repeatable) this.plannedDiceChoice = Math.max(1, Math.min(Number(ef.maxValue) || 6, Number(plannedValue) || 6));
        const ts = s.talentState || (s.talentState = { triggers: {}, flags: {}, activeUses: {} });
        ts.activeUses = ts.activeUses || {};
        const used = Number(ts.activeUses[id]) || 0;
        const cost = this.activeCost(id);
        if (s.inspiration < cost) return false;
        g.addInspiration(-cost, `文心·${t.name}`);
        ts.activeUses[id] = used + 1;
        this.usedActive.push(t);
        if (repeatable) {
          this.plannedDice = Math.max(1, Math.min(Number(ef.maxValue) || 6, Number(this.plannedDiceChoice) || 6));
          this.plannedDiceCost = cost;
          this.plannedDiceTalentId = id;
        }
        this.inspiration = s.inspiration;
        if (g.ui && g.ui.onState) g.ui.onState(s);
        return true;
      },
      /** 创作时消耗灵感多掷一枚灵感骰：扣灵感并同步快照，供 UI 判断可否继续叠加 */
      spendInspiration(n, reason) {
        if (s.inspiration < n) return false;
        g.addInspiration(-n, reason);
        this.inspiration = s.inspiration;
        if (g.ui && g.ui.onState) g.ui.onState(s);
        return true;
      },
      spendExtraDice(n) {
        if (!this.spendInspiration(n, '追加灵感骰')) return false;
        const a = g.ensureAbilityState();
        if (!this.usedPolish && a.manuscript.polish > 0) this.usedPolish = true;
        return true;
      },
      /** 结算：返回双方明细 */
      resolve(style, manner, dice) {
        return g.resolveBattle(session, style, manner, dice);
      }
    };
    return session;
  }

  resolveBattle(session, style, manner, dice) {
    const s = this.s;
    const af = this.cfg.affinity;
    const battleCoef = (this.cfg.attrs || {}).battleFormula || null;
    const styleSystem = this.styleConfig();

    // 多枚灵感骰支持：先记录原骰组，再按文心次序做无交互变形。
    // 变形后的骰组统一供文体结构、骰组花样与战后资源读取，确保「点铁成金→梦笔生花」
    // 之类的组合真正形成规则联动，而不是各自加一条互不相干的百分比。
    const rawDicePips = (Array.isArray(dice) ? dice.slice() : [Number(dice) || 1])
      .map(v => Math.max(1, Math.min(6, Number(v) || 1)));
    const battleTalents = [...(session.passiveTalents || s.passive || []), ...(session.usedActive || [])];
    const dicePips = rawDicePips.slice();
    const diceTransformNotes = [];
    for (const t of battleTalents) {
      const ef = t.effect || {};
      if (ef.type !== 'dice_transform') continue;
      if (ef.mode === 'low_lift') {
        const threshold = Math.max(1, Math.min(6, Number(ef.threshold) || 2));
        const count = Math.max(1, Number(ef.count) || 1);
        const lift = Math.max(1, Number(ef.value) || 1);
        const targets = dicePips.map((pip, i) => ({ pip, i })).filter(x => x.pip <= threshold)
          .sort((a, b) => a.pip - b.pip || a.i - b.i).slice(0, count);
        for (const x of targets) {
          const before = dicePips[x.i];
          dicePips[x.i] = Math.min(6, before + lift);
          diceTransformNotes.push(`文心·${t.name} ${before}→${dicePips[x.i]}`);
        }
      } else if (ef.mode === 'first_floor') {
        const floor = Math.max(1, Math.min(6, Number(ef.floor) || 4));
        if (dicePips[0] < floor) {
          const before = dicePips[0];
          dicePips[0] = floor;
          diceTransformNotes.push(`文心·${t.name} 首骰 ${before}→${floor}`);
        }
      } else if (ef.mode === 'lowest_to') {
        const maxPip = Math.max(1, Math.min(6, Number(ef.maxPip) || 3));
        const target = Math.max(1, Math.min(6, Number(ef.target) || 6));
        let index = 0;
        for (let i = 1; i < dicePips.length; i++) if (dicePips[i] < dicePips[index]) index = i;
        if (dicePips[index] <= maxPip && dicePips[index] < target) {
          const before = dicePips[index];
          dicePips[index] = target;
          diceTransformNotes.push(`文心·${t.name} ${before}→${target}`);
        }
      }
    }
    const totalPips = dicePips.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    const hasSix = dicePips.includes(6);
    const extraDice = dicePips.length > 1 ? dicePips.length - 1 : 0;   // 玩家本场追加的灵感骰数

    /* ---- 玩家侧修正 ---- */
    const pct = [], flat = [], talentTriggers = [];
    let dicePlus = 0, diceMult = R.BATTLE_COEF.diceMult, diceFixed = null, critMult = 1;
    const dicePct = Number((this.cfg.inspiration || {}).dicePct) || R.BATTLE_COEF.dicePct;
    const schoolMech = this.schoolMechanics();
    const schoolDicePlus = schoolMech.type === 'cizong_bi'
      ? Math.min(Number(schoolMech.creativeDicePlus) || 0, Number(schoolMech.freeDiceCap) || 5) : 0;
    const extraDiceMods = extraDice > 0
      ? (typeof session.extraDiceModifiers === 'function'
        ? session.extraDiceModifiers(extraDice)
        : [{ source: 'extraDice', label: `追加骰·${extraDice}枚`, value: extraDice * (Number((this.cfg.inspiration || {}).extraDicePct) || 0) }])
      : [];

    // 相性 2.0：四层叠加（基矩阵 / 门派文风 / 当朝风潮 / 气势连捷）
    const base = R.affinityValue(af.matrix, manner, session.theme);
    if (base !== 0) pct.push({ source: 'affinity', label: `相性·${af.mannerNames[manner]}×${session.themeName}`, value: base });

    // 门派文风（本门功底 / 通儒临题自化）：玩家专属身份层
    let home = 0;
    if (s.school && s.school.homeManner) {
      const hm = s.school.homeManner;
      if (hm === 'adaptive') {
        const best = R.bestMannerForTheme(af.matrix, session.manners, session.theme);
        if (manner === best) home = Number(af.homeAdaptiveBonus ?? 0.04);
      } else if (manner === hm) {
        home = Number(af.homeMannerBonus ?? 0.05);
      }
    }
    if (home !== 0) pct.push({ source: 'home', label: `本门功底·${af.mannerNames[manner]}`, value: home });

    // 当朝风潮：热点题材(+所有风格) / 得势文体(+所有题材)
    const zgT = (s.zeitgeist && s.zeitgeist.theme === session.theme) ? Number(af.zeitgeistThemeBonus ?? 0.04) : 0;
    const zgM = (s.zeitgeist && s.zeitgeist.manner === manner) ? Number(af.zeitgeistMannerBonus ?? 0.03) : 0;
    if (zgT) pct.push({ source: 'zeitgeist', label: `风潮·热点${session.themeName}`, value: zgT });
    if (zgM) pct.push({ source: 'zeitgeist', label: `风潮·得势${af.mannerNames[manner]}`, value: zgM });

    // 气势连捷：进入本场前已累积的同风格连胜加成（含文心「一鼓作气」倍率）
    const mom = R.momentumPct(s.affStreak, manner, af) * (session.streakMult || 1);
    if (mom !== 0) pct.push({ source: 'momentum', label: `气势连捷·${s.affStreak.n}连`, value: mom });

    for (const t of (session.passiveTalents || s.passive)) {
      const ef = t.effect || {};
      if (ef.type === 'dice_plus') dicePlus += Number(ef.value) || 0;
      if (ef.type === 'crit' && this.rand() < (Number(ef.chance) || 0)) critMult = Math.max(critMult, Number(ef.mult) || 1);
      if (ef.type === 'palace_pct' && session.isPalace) {
        pct.push({ source: 'talent', label: `文心·${t.name}`, value: Number(ef.value) || 0 });
      }
      // —— 以下为「创意文心」新增效果 ——
      if (ef.type === 'style_pct' && (ef.style === style || ef.style === 'any')) {
        pct.push({ source: 'talent', label: `文心·${t.name}`, value: Number(ef.value) || 0 });
      }
      if (ef.type === 'theme_pct' && ef.theme === session.theme) {
        pct.push({ source: 'talent', label: `文心·${t.name}`, value: Number(ef.value) || 0 });
      }
      if (ef.type === 'comeback' && s.inspiration <= (Number(ef.threshold) || 12)) {
        pct.push({ source: 'talent', label: `文心·${t.name}`, value: Number(ef.value) || 0 });
      }
      if (ef.type === 'lucky_six' && hasSix) critMult = Math.max(critMult, Number(ef.mult) || 1);
      // —— 被动「创意文心」补接（设计 P0：此前仅在主动循环生效） ——
      if (ef.type === 'dice_mult') diceMult = Number(ef.value) || R.BATTLE_COEF.diceMult;
      if (ef.type === 'copy_affinity') {
        session._copyAffinity = true;
        session._copyAffinityName = t.name;
        session._copyAffinityRatio = Math.max(session._copyAffinityRatio || 0, Number(ef.ratio) || 1);
      }
    }
    for (const t of session.usedActive) {
      const ef = t.effect || {};
      if (ef.type === 'fixed_dice') diceFixed = Number(ef.value) || 0;
      if (ef.type === 'dice_mult') diceMult = Number(ef.value) || R.BATTLE_COEF.diceMult;
      if (ef.type === 'dice_plus') dicePlus += Number(ef.value) || 0;
      if (ef.type === 'crit') { if (this.rand() < (Number(ef.chance) || 0)) critMult = Math.max(critMult, Number(ef.mult) || 1); }
      if (ef.type === 'copy_affinity') {
        session._copyAffinity = true;
        session._copyAffinityName = t.name;
        session._copyAffinityRatio = Math.max(session._copyAffinityRatio || 0, Number(ef.ratio) || 1);
      }
      // —— 主动文心亦可触发创意效果 ——
      if (ef.type === 'style_pct' && (ef.style === style || ef.style === 'any')) {
        pct.push({ source: 'talent', label: `文心·${t.name}`, value: Number(ef.value) || 0 });
      }
      if (ef.type === 'theme_pct' && ef.theme === session.theme) {
        pct.push({ source: 'talent', label: `文心·${t.name}`, value: Number(ef.value) || 0 });
      }
      if (ef.type === 'comeback' && s.inspiration <= (Number(ef.threshold) || 12)) {
        pct.push({ source: 'talent', label: `文心·${t.name}`, value: Number(ef.value) || 0 });
      }
      if (ef.type === 'lucky_six' && hasSix) critMult = Math.max(critMult, Number(ef.mult) || 1);
    }

    // 新版灵感骰文心：围绕骰组形态触发，不再覆盖整场骰倍率。
    // occurrence 同时驱动得分和战后资源，单骰/多骰、同点/异点、稳健/豪赌由此分出流派。
    for (const t of battleTalents) {
      const ef = t.effect || {};
      if (ef.type === 'dice_pattern') {
        let occurrence = 0;
        let scorePct = 0;
        if (ef.pattern === 'six') occurrence = dicePips.filter(v => v === 6).length;
        else if (ef.pattern === 'distinct') occurrence = Math.max(0, new Set(dicePips).size - 1);
        else if (ef.pattern === 'single') occurrence = dicePips.length === 1 ? 1 : 0;
        else if (ef.pattern === 'all_high') occurrence = dicePips.every(v => v >= (Number(ef.minPip) || 4)) ? 1 : 0;
        else if (ef.pattern === 'pair') occurrence = new Set(dicePips).size < dicePips.length ? 1 : 0;
        else if (ef.pattern === 'total') occurrence = totalPips >= (Number(ef.threshold) || 12) ? 1 : 0;
        else if (ef.pattern === 'extremes') {
          const high = dicePips.filter(v => v >= (Number(ef.highMin) || 5)).length;
          const low = dicePips.filter(v => v <= (Number(ef.lowMax) || 2)).length;
          occurrence = high + low;
          scorePct = high * (Number(ef.highValue) || 0) + low * (Number(ef.lowValue) || 0);
        }
        if (ef.pattern !== 'extremes') scorePct = occurrence * (Number(ef.value) || 0);
        if (scorePct) pct.push({ source: 'talent', label: `文心·${t.name}`, value: scorePct });
        if (occurrence > 0) talentTriggers.push({ id: t.id, name: t.name, pattern: ef.pattern, occurrence, reward: ef.reward || null });
      } else if (ef.type === 'style_switch_pct' && session.lastStyle && session.lastStyle !== style) {
        const value = Number(ef.value) || 0;
        if (value) pct.push({ source: 'talent', label: `文心·${t.name}·换体`, value });
        talentTriggers.push({ id: t.id, name: t.name, pattern: 'style_switch', occurrence: 1,
          reward: Number(ef.insight) > 0 ? { type: 'insight', value: Number(ef.insight) } : null });
      } else if (ef.type === 'manuscript_pct') {
        const pages = Number((this.ensureAbilityState().manuscript || {}).pages) || 0;
        const stacks = Math.floor(pages / Math.max(1, Number(ef.step) || 2));
        const value = Math.min(Number(ef.cap) || 0.1, stacks * (Number(ef.value) || 0));
        if (value) pct.push({ source: 'talent', label: `文心·${t.name}·稿本${pages}页`, value });
      }
    }

    // 文心羁绊：拥有特定组合即激活的联动加成（实时按当前持有重算，无持久状态）
    for (const sy of this.synergySet()) {
      for (const ef of (sy.effects || [])) {
        if (ef.type === 'dice_plus') dicePlus += Number(ef.value) || 0;
        else if (ef.type === 'crit' && this.rand() < (Number(ef.chance) || 0)) critMult = Math.max(critMult, Number(ef.mult) || 1);
        else if (ef.type === 'syn_pct') pct.push({ source: 'synergy', label: `羁绊·${sy.name}`, value: Number(ef.value) || 0 });
      }
    }

      // 成长型名篇的 score 修正与阶段章法一样属于公开、非交互的作品修正。
    const albumPct = this.albumScorePct(style, session.isPalace ? 'palace' : s.phase);
    if (albumPct) pct.push({ source: 'album', label: '名篇·成长效果', value: albumPct });
    this.applyAlbumOutcomeEffects('score', { style, phase: session.isPalace ? 'palace' : s.phase, eventKey: session.battleId || `${s.turn}:${style}` });

    // 阶段章法只读取已选文体与上一场历史；满足条件即自动发动，不插入战斗交互。
    const planPct = this.strategyBattlePct(session, style);
    if (planPct) pct.push({ source: 'strategy', label: '思力·换韵生新', value: planPct });
    if (style === 'lian' && session.lastStyle && session.lastStyle !== style) {
      pct.push({ source: 'style', label: '联·对举换体', value: Number((styleSystem.lian || {}).switchPct) || 0.08 });
    }

    /* ---- NPC 侧 ---- */
    const npcAttrs = session.npc.attrs;
    // 意图锁定：机制 NPC 用 createSession 锁定的意图文体/文风；普通 NPC 走旧规则
    const npcStyle = (session.intentLocked && session.intentLocked.style)
      ? session.intentLocked.style : R.pickNpcStyle(npcAttrs, npcAttrs.lian >= 8, battleCoef);
    const npcManner = (session.intentLocked && session.intentLocked.manner)
      ? session.intentLocked.manner : R.pickNpcManner(af.matrix, session.manners, session.theme);
    const npcAff = R.affinityValue(af.matrix, npcManner, session.theme);
    const npcDice = this.d6();
    // NPC 最佳文体期望分（阶段 E：供 sig_steady_pressure 的 floorPct / sig_dice_response
    // 的 perDicePct 作等效比例基准，使招牌强度在全档位稳定落入 5-10% 预算）。
    const npcExpected = Math.max(R.expectedScore(npcAttrs, npcStyle, battleCoef),
      ...(R.CREATIVE_KEYS||[]).map(s => s==='lian'&&(npcAttrs.lian||0)<8 ? -1 : R.expectedScore(npcAttrs, s, battleCoef)));

    /* ---- NPC 三机制：破绽先于招牌结算（F0）---- */
    const npcMech = session._mechValid ? (session.npc && session.npc.mech) : null;
    let mechOut = null;
    // 提升到块外，供 wea_crushing_win 二次判定复用（matchesIntent/strategyChanged）
    let pm = null, matchesIntent = false, strategyChanged = false;
    // 殿试跨场适应参数（sig_palace_adapt）：函数级作用域，供首轮与结果型二次判定共用。
    let palaceAdapt = null;
    if (npcMech) {
      const tplLib = this.cfg['npc-mechanics'] || {};
      // 意图反制破绽：玩家出战是否与 NPC 本场锁定意图一致（供 wea_counter_intent 使用）
      const il = session.intentLocked;
      matchesIntent = !!(il && style === il.style && manner === il.manner);
      pm = {
        style, manner, extraDice, matchesIntent,
        dicePips,
        activeTalentUsed: Array.isArray(session.usedActive) && session.usedActive.length > 0,
        playerAffinity: base
      };
      const playerHistory = this._mechHistoryForNpc(stableFoeId(session.npc));
      // 跨场换策破绽：殿试按整段序列（考官席互通）判换策；普通战按逐考官历史判
      strategyChanged = session.isPalace
        ? this._palaceStrategyChanged(style, manner)
        : this._strategyChangedSinceLast(session.npc, style, manner);
      // 殿试跨场适应参数（sig_palace_adapt）：仅本局殿试配置了该机制时生效，
      // 层数取自整段殿试桶（PALACE_KEY），使三场共享、maxLayers 可达。
      palaceAdapt = (session.isPalace && this.s.npcMech && this.s.npcMech.palaceAdapt)
        ? {
            layers: ((this.s.npcMech.palace && this.s.npcMech.palace[PALACE_KEY]) || { layers: 0 }).layers || 0,
            weaknessDampen: Number(this.s.npcMech.palaceAdapt.weaknessDampen) || 0,
            minWeaknessRetention: Number(this.s.npcMech.palaceAdapt.minWeaknessRetention) || 0
          }
        : null;
      // 破绽（先）
      const wea = R.weaknessResolution({
        mech: npcMech, npcStyle,
        playerMove: pm,
        playerHistory,
        npcManner,
        templates: tplLib,
        result: null, relativeMargin: null,
        strategyChanged,
        palaceAdapt, zeitgeist: s.zeitgeist, intentStance: session.intentLocked && session.intentLocked.stance
      });
      // 招牌（后）
      const tri = R.signatureTriggered({
        mech: npcMech, npcStyle, npcManner,
        playerMove: pm, playerHistory, templates: tplLib,
        zeitgeist: s.zeitgeist, intentStance: session.intentLocked && session.intentLocked.stance
      });
      mechOut = { tri, wea, mods: R.signatureScoreMods(tri, wea, npcMech.signature, { extraDice, npcSi: npcAttrs.si || 0, npcExpected }) };
      session._mechOut = mechOut;
    }

    if (session._copyAffinity && npcAff > 0) {
      const r = session._copyAffinityRatio || 1;
      pct.push({ source: 'copy', label: `复制相性·${session._copyAffinityName || '文心'}`, value: npcAff * r });
    }
    if (s.nextBattlePct) {
      pct.push({ source: 'sky', label: '金榜题名时', value: s.nextBattlePct });
      s.nextBattlePct = 0;
    }

    // 破绽带给玩家的加分
    if (mechOut && mechOut.mods.playerBonusPct) {
      pct.push({
        source: 'npcWeak',
        label: `破绽·${(mechOut.wea && mechOut.wea.shutdownLevel) === 'partial' ? '部分压制' : '压制'}`,
        value: mechOut.mods.playerBonusPct
      });
    }

    if (diceFixed == null) for (const mod of extraDiceMods) {
      if (Number(mod.value) > 0) pct.push(mod);
    }

    if (diceFixed == null) dicePlus += schoolDicePlus;
    const selfDiceProfile = diceFixed == null
      ? R.styleDiceScore(style, dicePips, styleSystem, diceMult, dicePlus, dicePct)
      : null;
    if (selfDiceProfile && diceTransformNotes.length) {
      const transformNote = `；${diceTransformNotes.join('，')}`;
      selfDiceProfile.detail += transformNote;
      selfDiceProfile.pctDetail += transformNote;
    }
    const selfCalc = R.battleScore({
      attrs: session.playerAttrs, style, dice: totalPips, dicePlus: selfDiceProfile ? 0 : dicePlus,
      diceMult, diceFixed,
      dicePct: selfDiceProfile ? selfDiceProfile.pct : undefined,
      dicePctDetail: selfDiceProfile && selfDiceProfile.pctDetail,
      diceDetail: selfDiceProfile && selfDiceProfile.detail, critMult, coef: battleCoef,
      pctMods: pct, flatMods: flat
    });
    let oppPct = npcAff !== 0 ? [{ source: 'affinity', label: `相性·${af.mannerNames[npcManner]}`, value: npcAff }] : [];
    let oppFlat = [];
    if (mechOut) {
      for (const m of mechOut.mods.pct) oppPct.push(m);
      for (const m of mechOut.mods.flat) oppFlat.push(m);
    }
    const npcDiceProfile = R.styleDiceScore(npcStyle, [npcDice], styleSystem, R.BATTLE_COEF.diceMult, 0);
    let oppCalc = R.battleScore({
      attrs: npcAttrs, style: npcStyle, dice: npcDice, diceScore: npcDiceProfile.score,
      diceDetail: npcDiceProfile.detail, coef: battleCoef,
      pctMods: oppPct, flatMods: oppFlat
    });
    let result = R.judgeBattle(selfCalc.total, oppCalc.total, (this.cfg.grades.battle || {}).drawRatio);
    const upset = result === 'win'
      && R.expectedScore(npcAttrs, npcStyle, battleCoef) > R.expectedScore(session.playerAttrs, style, battleCoef);

    // 结果型破绽（高分差压卷）：需在算出双方分后按相对分差二次判定，并据此重算 NPC 修正与胜负。
    // 注意：首轮破绽调用传入 result:null，wea_crushing_win 必不命中且其结果无 template 字段，
    // 故此处须按「NPC 配置是否含该模板」判定，而非依赖首轮 mechOut.wea.template（重构多破绽后尤为关键）。
    const hasCrushingWin = npcMech && (() => {
      const wl = Array.isArray(npcMech.weakness) ? npcMech.weakness : (npcMech.weakness ? [npcMech.weakness] : []);
      return wl.some(w => w && w.template === 'wea_crushing_win');
    })();
    if (mechOut && hasCrushingWin) {
      const hi = Math.max(selfCalc.total, oppCalc.total);
      const relMarg = hi > 0 ? (selfCalc.total - oppCalc.total) / hi : 0;
      const pm2 = { ...pm };
      const wea2 = R.weaknessResolution({
        mech: npcMech, npcStyle,
        playerMove: pm2,
        playerHistory: this._mechHistoryForNpc(stableFoeId(session.npc)), npcManner,
        templates: this.cfg['npc-mechanics'] || {},
        result, relativeMargin: relMarg, strategyChanged,
        palaceAdapt, zeitgeist: s.zeitgeist, intentStance: session.intentLocked && session.intentLocked.stance
      });
      const mods2 = R.signatureScoreMods(mechOut.tri, wea2, npcMech.signature, { extraDice, npcSi: npcAttrs.si || 0, npcExpected });
      if (mods2 !== mechOut.mods) {
        oppPct = npcAff !== 0 ? [{ source: 'affinity', label: `相性·${af.mannerNames[npcManner]}`, value: npcAff }] : [];
        oppFlat = [];
        for (const m of mods2.pct) oppPct.push(m);
        for (const m of mods2.flat) oppFlat.push(m);
        oppCalc = R.battleScore({ attrs: npcAttrs, style: npcStyle, dice: npcDice,
          diceScore: npcDiceProfile.score, diceDetail: npcDiceProfile.detail, coef: battleCoef,
          pctMods: oppPct, flatMods: oppFlat });
        result = R.judgeBattle(selfCalc.total, oppCalc.total, (this.cfg.grades.battle || {}).drawRatio);
        mechOut = { tri: mechOut.tri, wea: wea2, mods: mods2 };
        session._mechOut = mechOut;
      }
    }

    return {
      style, manner, dice: totalPips, dicePips, rawDicePips, talentTriggers, selfCalc,
      npcStyle, npcManner, npcDice, oppCalc,
      npcMannerName: af.mannerNames[npcManner], result, upset,
      mech: mechOut
    };
  }

  /** 方案 B：战斗完成后的熟练、心得、研修、稿本与技法经验。 */
  applyAbilityBattleGrowth(session, out) {
    const a = this.ensureAbilityState();
    const ac = this.abilityConfig();
    if (!a || !ac.version) return;
    const growth = ac.growth || {};
    const styleCfg = this.styleConfig();
    const phase = this.s.phase || 'child';
    const style = out.style;

    // 通用心得：胜平负都能学习；每阶段首次使用某体再给轻量广度奖励。
    let insight = out.result === 'lose' ? Number(growth.insightLose) || 2
      : out.result === 'draw' ? Number(growth.insightDraw) || 3 : Number(growth.insightWin) || 3;
    // 骰组文心的后续反馈与算分使用同一份 trigger 快照，避免结算阶段重新判断时
    // 因骰面变形、换体历史更新而出现“得分触发了、资源却没发”的割裂。
    const talentReward = { insight: 0, fragment: 0, page: 0, inspiration: 0 };
    for (const tr of (out.talentTriggers || [])) {
      const reward = tr && tr.reward;
      if (!reward || !Object.prototype.hasOwnProperty.call(talentReward, reward.type)) continue;
      const times = reward.perMatch === false ? 1 : Math.max(1, Number(tr.occurrence) || 1);
      talentReward[reward.type] += (Number(reward.value) || 0) * times;
    }
    insight += talentReward.insight;
    for (const t of (session.passiveTalents || this.s.passive || [])) {
      const ef = t.effect || {};
      if (out.result === 'win' && ef.type === 'on_win_bonus' && (ef.style === style || ef.style === 'any')) insight += Number(ef.value) || 0;
      if (out.result !== 'win' && ef.type === 'study_bonus') insight += Number(ef.value) || 0;
      if (out.result === 'draw' && ef.type === 'draw_bonus') insight += Number(ef.value) || 0;
    }
    if (out.result === 'win') for (const sy of this.synergySet()) for (const ef of (sy.effects || [])) {
      if (ef.type === 'on_win_bonus' && (ef.style === style || ef.style === 'any')) insight += Number(ef.value) || 0;
    }
    if (out.upset) insight += Number(growth.insightUpset) || 1;
    const used = a.phaseStyles[phase] || (a.phaseStyles[phase] = []);
    if (!used.includes(style)) {
      used.push(style);
      insight += Number(growth.firstStylePerPhase) || 1;
    }
    if (style === 'shi' && out.result === 'win' && (out.dicePips || []).length === 1) {
      insight += Number((styleCfg.shi || {}).singleDieInsight) || 0;
    }
    const mech = this.schoolMechanics();
    if (mech.type === 'bowen' && used.length === 2 && !a.phaseStyles[`${phase}:bowen`]) {
      insight += Number(mech.differentStyleInsight) || 0;
      a.phaseStyles[`${phase}:bowen`] = ['done'];
    }
    const insightGot = this.gainInsight(insight, '论战体悟');

    // 实战熟练与联体追赶；3 进度默认转化为 1 点属性。
    let practice = 1;
    const creative = R.CREATIVE_KEYS.map(k => Number(this.s.attrs[k]) || 0);
    if (style === 'lian' && Math.max(...creative) - (Number(this.s.attrs.lian) || 0) >= (Number((styleCfg.lian || {}).catchupGap) || 4)) {
      practice += Number((styleCfg.lian || {}).practiceBonus) || 1;
    }
    a.familiarity[style] = (Number(a.familiarity[style]) || 0) + practice;
    const need = Math.max(1, Number(growth.familiarityNeed) || 3);
    const levels = Math.floor(a.familiarity[style] / need);
    if (levels > 0) {
      a.familiarity[style] -= levels * need;
      this.addAttrs({ [style]: levels }, { reason: '实战熟练' });
      this.push(`实战熟练：${R.ATTR_NAMES[style]} +${levels}`);
    }

    // 方案 C 铺垫：经验与阈值现在就稳定累计；节点为空时只记录等级，不产生战斗效果。
    const tc = this.techniqueConfig();
    a.technique.xp[style] = (Number(a.technique.xp[style]) || 0) + practice;
    const thresholds = Array.isArray(tc.thresholds) ? tc.thresholds : [];
    a.technique.level[style] = thresholds.filter(t => a.technique.xp[style] >= Number(t)).length;

    // 学力研修：锁定的研修位每场推进，学力越高推进越快；小数进度会结转。
    const studyGain = this.studyProgressRate();
    for (const attr of a.study.focus.slice(0, this.studySlots())) {
      this.gainStudyProgress(attr, studyGain, '学力·研修');
    }

    // 笔力稿本：胜负先给结果稿页；笔力再把本场沉淀转为可结转的残页。
    const mc = ac.manuscript || {};
    let pages = out.result === 'win' ? ((out.dicePips || []).length === 1 ? 2 : 1) : out.result === 'draw' ? 1 : 0;
    a.manuscript.fragments += this.manuscriptFragmentRate() + talentReward.fragment;
    if (out.result === 'lose') a.manuscript.fragments += 1;
    const fragmentNeed = (Number(this.s.attrs.bi) || 0) >= (Number(mc.fragmentFastBi) || 16) ? 1 : (Number(mc.fragmentNeed) || 2);
    const made = Math.floor(a.manuscript.fragments / Math.max(1, fragmentNeed));
    if (made > 0) {
      pages += made;
      a.manuscript.fragments = Math.round((a.manuscript.fragments - made * fragmentNeed) * 1000) / 1000;
    }
    const firstFinished = pages > 0 && !a.manuscript.bonusPagePhases[phase];
    if (firstFinished && (Number(this.s.attrs.bi) || 0) >= (Number(mc.bonusPageBi) || 24)) pages += 1;
    if (firstFinished) a.manuscript.bonusPagePhases[phase] = true;
    pages += talentReward.page;
    const cizongFirstNoExtra = mech.type === 'cizong_bi' && (out.dicePips || []).length === 1 && !a.manuscript.schoolPagePhases[phase];
    if (cizongFirstNoExtra) {
      pages += Number(mech.firstFinishedPagePlus) || 0;
      a.manuscript.schoolPagePhases[phase] = true;
    }
    const beforePages = a.manuscript.pages;
    a.manuscript.pages = Math.min(this.manuscriptCap(), beforePages + pages);
    const pageGot = a.manuscript.pages - beforePages;

    // 文体的战后资源兑现。
    if (style === 'ci' && out.result === 'draw' && (out.dicePips || []).length > 1) {
      this.addInspiration(Number((styleCfg.ci || {}).drawRefund) || 1, '词·铺陈回环');
    }
    if (talentReward.inspiration > 0) this.addInspiration(talentReward.inspiration, '文心·骰组回响');
    if (session.usedPolish && a.manuscript.polish > 0) a.manuscript.polish -= 1;
    a.lastStyle = style;
    const fmt = n => Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
    const rewardEcho = (talentReward.insight || talentReward.fragment || talentReward.page || talentReward.inspiration)
      ? `；文心回响：心得 +${fmt(talentReward.insight)}、残页 +${fmt(talentReward.fragment)}、稿页 +${fmt(talentReward.page)}、灵感 +${fmt(talentReward.inspiration)}` : '';
    this.push(`战后所得：心得 +${insightGot}，稿页 +${pageGot}，${R.STYLE_NAMES[style]}熟练 +${practice}，研修 +${fmt(studyGain)}/位，残页 +${fmt(this.manuscriptFragmentRate() + talentReward.fragment)}${rewardEcho}`);
  }

  /** 应用战斗奖惩（UI 播完算分动画后调用） */
  async settleBattle(session, out) {
    const s = this.s;
    const battlePassives = session.passiveTalents || s.passive;
    const insp = this.cfg.inspiration;
    const schoolMech = this.schoolMechanics();
    const schoolState = s.schoolState || (s.schoolState = this.createSchoolState(s.school));
    // 结算幂等：优先复用 createSession 生成的 ID；旧测试/旧调用没有 ID 时，
    // 仍用当前序号作为兼容兜底，但不再在检查后改变用于本次判断的 ID。
    const battleId = session && session.battleId
      ? session.battleId
      : `${s.turn}:${schoolState.battleSeq || 0}:${session && session.label || ''}`;
    if (session && this._settledBattleSessions.has(session)) return;
    if (schoolState.settledBattleIds && schoolState.settledBattleIds.includes(battleId)) return;
    if (session) this._settledBattleSessions.add(session);
    schoolState.battleSeq = (Number(schoolState.battleSeq) || 0) + 1;
    schoolState.settledBattleIds = [...(schoolState.settledBattleIds || []), battleId].slice(-40);

    // 图鉴：累计该对手的胜/平/负战绩（跨局留存，供「图鉴阁·对手详情」展示胜率）
    const n0 = session.npc;
    const foeId = stableFoeId(n0);
    if (n0 && n0.name) {
      Codex.recordFoeResult(foeId, n0.name, out.result);
      // 图鉴认知升级（未识→相识→察意→破招）：本场命中破绽则推进「破招」认知
      const mechHit = !!(out.mech && out.mech.wea && out.mech.wea.hit);
      Codex.recordFoeCognition(foeId, out.result, mechHit);
    }

    // 「科场风起」只翻倍灵感奖惩，不翻倍属性奖励——属性翻倍是 Round 2 雪球的主源之一
    const mult = this.skyActive('battle_reward_mult') ? 2 : 1;
    const abilityOn = !!(this.abilityConfig() && this.abilityConfig().version);

    if (out.result === 'win') {
      s.battle.win++; s.battle.streak++; s.battle.maxStreak = Math.max(s.battle.maxStreak, s.battle.streak);
      s.battle.winsByStyle[out.style] = (s.battle.winsByStyle[out.style] || 0) + 1;
      if (out.upset) s.battle.upsets++;

      // 方案 B 开启后，胜利成长交由通用心得/熟练结算；旧配置仍可关闭 abilitySystem 回退。
      const range = this.cfg.attrs.battleWinGain || [2, 3];
      const lo = Math.min(Number(range[0]) || 2, Number(range[1]) || 3);
      const hi = Math.max(Number(range[0]) || 2, Number(range[1]) || 3);
      let gain = lo + (abilityOn ? 0 : Math.floor(this.rand() * (hi - lo + 1)));
      for (const t of battlePassives) {
        const ef = t.effect || {};
        if (!abilityOn && ef.type === 'on_win_bonus' && (ef.style === out.style || ef.style === 'any')) gain += Number(ef.value) || 0;
        if (ef.type === 'insp_on_win') this.addInspiration(Number(ef.value) || 0, `文心·${t.name}`);
      }
      for (const sy of abilityOn ? [] : this.synergySet()) {
        for (const ef of (sy.effects || [])) {
          if (ef.type === 'on_win_bonus' && (ef.style === out.style || ef.style === 'any')) gain += Number(ef.value) || 0;
        }
      }
      // 雪球收敛：以强凌弱所得渐薄（全案 4.4 降方差）
      if (!abilityOn) {
        const scale = R.winRewardScale(
          R.expectedScore(session.playerAttrs, out.style, (this.cfg.attrs || {}).battleFormula),
          R.expectedScore(session.npc.attrs, out.npcStyle, (this.cfg.attrs || {}).battleFormula),
          this.cfg.attrs.winScale || null);
        gain = Math.max(1, Math.round(gain * scale));
        this.addAttrs({ [out.style]: gain }, { reason: '论战获胜' });
      }
      if (session.isPalace) { s.palaceWins++; }
      this.push(abilityOn
        ? `论战胜「${session.npc.fullName || session.npc.name}」，战绩已录，体悟待结`
        : `论战胜「${session.npc.fullName || session.npc.name}」，${R.ATTR_NAMES[out.style]} +${gain}`);
      // 获胜后文心掉落概率：抽成可调旋钮（config/attrs.json → talentDropRate），
      // 以便在不做数值膨胀的前提下调节「联动」出现的频率。缺省回退 0.15。
      const baseDrop = Number((this.cfg.attrs && this.cfg.attrs.talentDropRate) ?? 0.15);
      const dropRate = schoolMech.type === 'qishi'
        ? Math.min(Number(schoolMech.talentDropCap) || 0.45, Number(schoolMech.talentDropRate) || 0.35)
        : baseDrop;
      const pity = schoolMech.type === 'qishi' && schoolState.battleSeq >= (Number(schoolMech.talentDropPityWin) || 5)
        && !schoolState.qishiTalentDropObtained && s.events.talents <= 1;
      if (this.rand() < dropRate || pity) {
        const t = this.randomTalent();
        if (t) {
          const got = await this.grantTalent(t);
          if (got && schoolMech.type === 'qishi') schoolState.qishiTalentDropObtained = true;
        }
      }
    } else if (out.result === 'draw') {
      s.battle.draw++; s.battle.streak = 0;
      // 平局的基础补偿与文心 draw_bonus 先合并，再只走一次 applyStudyGain。
      // 否则每次单独调用都会重复套用 study_bonus，造成同一场文体异常增长。
      if (!abilityOn) {
        const drawGain = { ...(this.cfg.attrs.battleDrawGain || {}) };
        for (const t of battlePassives) {
          const ef = t.effect || {};
          if (ef.type === 'draw_bonus') {
            drawGain[out.style] = (Number(drawGain[out.style]) || 0) + (Number(ef.value) || 0);
          }
        }
        this.applyStudyGain(drawGain, `与「${session.npc.fullName || session.npc.name}」平分秋色`, out.style, battlePassives);
      }
      this.push(`与「${session.npc.fullName || session.npc.name}」平分秋色`);
    } else {
      s.battle.loss++; s.battle.streak = 0;
      let loss = this.lateVal(insp.battleLoseExtra ?? -3, insp.battleLoseExtraLate) * mult;
      if (abilityOn) {
        loss = this.strategyLossAmount(loss, out.style);
      }
      this.addInspiration(loss, '败北');
      /* 败中有得（Round 3 F1 降方差的关键）：
       * Round 2 的战斗是纯正反馈——胜者得属性、败者一无所获。于是「胜→变强→再胜」
       * 复利成链，同一档玩家被劈成「一路碾压」与「一路挨打」两个峰（高手档 500 局里
       * 仍有 9% 零胜、也有 15 胜的），创作力和的档内 σ 高达 12，几乎全部来自这条链。
       * 信噪比诊断（tools/r3_snr.mjs）显示：不斩断它，任何线性计分公式都不可能
       * 同时满足「三档中位」与「sd ≤ 500」（Fisher 上界 2.35 < 需求 2.89）。
       * 故让属性成长与胜负「脱钩」——败者也长，只是长得慢；胜负改由战绩分体现。
       * 文化上亦有出处：败于名家而有所悟，正是「转益多师是汝师」。 */
      if (!abilityOn) this.applyStudyGain(this.cfg.attrs.battleLoseGain, `败于「${session.npc.fullName || session.npc.name}」而有所悟`, out.style, battlePassives);
      this.push(`不敌「${session.npc.fullName || session.npc.name}」`);
    }
    if (abilityOn) this.applyAbilityBattleGrowth(session, out);
    this.applyAlbumOutcomeEffects('battle', out);
    this.recordAlbumBattle(out);
    if (session.isPalace) s.palaceDone++;

    // 气势连捷：维护连续同风格胜场。胜→累加；换风格→以新风格起 1；败→清零；平局同风格保留（不惩罚）。
    {
      const prev = s.affStreak, m = out.manner, won = out.result === 'win';
      if (won) {
        s.affStreak = { manner: m, n: (prev.manner === m ? prev.n + 1 : 1) };
      } else if (out.result === 'draw' && prev.manner === m) {
        s.affStreak = { manner: m, n: prev.n };   // 平局不进不退
      } else {
        s.affStreak = { manner: m, n: 0 };
      }
    }

    // 文心「退笔成冢」：每场结算后灵感托底至下限（仅补足，不削弱惩罚，避免封笔螺旋）
    let floor = 0;
    for (const t of battlePassives) {
      const ef = t.effect || {};
      if (ef.type === 'insp_floor') floor = Math.max(floor, Number(ef.value) || 0);
    }
    if (floor > 0 && s.inspiration < floor) {
      s.inspiration = Math.min(this.s.inspirationMax, floor);
      this.push(`文心托底：「${session.npc.fullName || session.npc.name}」一役后灵感补足至 ${floor}`);
    }

    // ---- NPC 三机制：跨场状态维护 + 战后消费型招牌/破绽结算 ----
    // E1 守卫：createSession 已判定模板缺失/不完整的机制，整场按旧行为完成，
    // 不写入历史、不扣文债、不叠 palace 适应层，避免半成品污染跨场状态。
    const npcMech = session._mechValid ? (session.npc && session.npc.mech) : null;
    const mechOut = out.mech || session._mechOut || null;
    if (schoolMech.type === 'cizong_bi' && schoolMech.basicMinGain) {
      const basic = R.BASIC_KEYS || ['bi', 'xue', 'si'];
      const key = basic.slice().sort((a, b) => (s.attrs[a] || 0) - (s.attrs[b] || 0))[0];
      const gain = Number(schoolMech.basicMinGain) || 1;
      this.addAttrs({ [key]: gain }, { reason: '辞宗·一战一得' });
      schoolState.basicProgress = schoolState.basicProgress || { bi: 0, xue: 0, si: 0 };
      schoolState.basicProgress[key] = (schoolState.basicProgress[key] || 0) + gain;
      const threshold = Number(schoolMech.basicMinThreshold) || 4;
      if (schoolState.basicProgress[key] >= threshold) {
        schoolState.basicProgress[key] -= threshold;
        this.addAttrs({ [key]: Number(schoolMech.basicMinAccelerate) || 1 }, { reason: '辞宗·基础加速' });
      }
      this.push(`辞宗·一战一得：${R.ATTR_NAMES[key]} +${gain}`);
    }
    if (npcMech && foeId) {
      // ① 跨场玩家行为历史（供识破重复/仿作惯用/换体破绽读取）
      if (!s.npcMech) s.npcMech = { history: {}, palace: {} };
      if (!s.npcMech.history) s.npcMech.history = {};
      const hist = s.npcMech.history[foeId] || (s.npcMech.history[foeId] = { styles: [], manners: [] });
      hist.styles.push(out.style); if (hist.styles.length > 2) hist.styles.shift();
      hist.manners.push(out.manner); if (hist.manners.length > 2) hist.manners.shift();
      s.npcMech.lastPlayerStyle = out.style;
      s.npcMech.lastPlayerManner = out.manner;

      // ② 战后消费型招牌：文债耗神（玩家未达规定相对分差/战败 → 扣灵感；达到则反之）
      const debt = npcMech.signature && (npcMech.signature.main || npcMech.signature);
      if (debt && debt.template === 'sig_debt_drain') {
        const hi = Math.max(out.selfCalc.total, out.oppCalc.total);
        const relMarg = hi > 0 ? (out.selfCalc.total - out.oppCalc.total) / hi : 0;
        const met = out.result === 'win' && relMarg >= (Number(debt.threshold) || 0);
        if (met) {
          // 破绽命中（高分差压卷）→ 返还本场投入的灵感（最多 1 点）
          if (mechOut && mechOut.wea && mechOut.wea.hit && mechOut.mods.refundInsp) {
            const refund = Math.min(Number(mechOut.mods.refundInsp) || 1, 1);
            this.addInspiration(refund, `破绽·一气压卷`);
            this.push(`破绽反击，返还灵感 ${refund}`);
          }
        } else {
          const cost = Number(debt.cost) || 2;
          this.addInspiration(-cost, `文债·${debt.name || '文债催人'}`);
          this.push(`「${debt.name || '文债催人'}」余意未尽，耗神 ${cost}`);
        }
      }

      // ③ 殿试跨场适应：考官席每场基础叠一层（maxLayers 封顶）；
      //    玩家「跨场换策」命中 wea_cross_battle_shift 时，该场净变化 = 1 - layerReduce
      //    （layerReduce 默认 1 → 本场持平，不再叠加），使换策真实抵消适应、收益回升。
      //    层数按整段殿试分桶（PALACE_KEY），三场共享，maxLayers 因而可达。
      if (session.isPalace && s.npcMech.palaceAdapt) {
        const pa = s.npcMech.palaceAdapt;
        const maxLayers = Number(pa.maxLayers) || 2;
        if (!s.npcMech.palace) s.npcMech.palace = {};
        const pal = s.npcMech.palace[PALACE_KEY] || { layers: 0 };
        let layers = Number(pal.layers) || 0;
        const layerReduce = (mechOut && mechOut.wea && mechOut.wea.layerReduce) ? Number(mechOut.wea.layerReduce) : 0;
        const delta = layerReduce ? (1 - layerReduce) : 1;     // 每场基础 +1；换策抵消
        layers = Math.max(0, Math.min(maxLayers, layers + delta));
        s.npcMech.palace[PALACE_KEY] = { layers };
        s.npcMech.palaceLast = { style: out.style, manner: out.manner };
      }
    }

    // 限次战后恢复放在所有战斗/NPC机制资源结算之后，防止先托底再被文债扣穿。
    // 每局次数写入 talentState；灵感已满时不消耗触发次数。
    for (const t of battlePassives) {
      const ef = t.effect || {};
      if (ef.type === 'insp_battle_recover' && s.inspiration <= (Number(ef.threshold) || 0)) {
        this.triggerTalentLimited(t, `文心·${t.name}`);
      }
    }

    if (schoolMech.type === 'cizong_bi' && Number(schoolMech.lightEventEvery) > 0 && out.result !== 'lose') await this.runCizongLightEvent();
    this.ui.onState(s);
  }

  /**
   * 「败中有得 / 平分秋色」的补偿成长。配置缺省即整套关闭。
   * @param {object|null} gain config/attrs.json 的 battleLoseGain / battleDrawGain
   * @param {string} label 飘字与吐司文案
   */
  applyStudyGain(gain, label, style, passiveTalents = this.s.passive || []) {
    if (!gain) return;
    const delta = {};
    for (const [k, v] of Object.entries(gain)) {
      // 特殊键 style = 本场出战的文体，让补偿落在玩家正在钻研的那一门上
      const key = k === 'style' ? style : k;
      if (key) delta[key] = (delta[key] || 0) + Number(v);
    }
    // 文心「转益多师」：败中有得 / 平局补偿的属性额外 +value（落在同一门上）
    let extra = 0;
    for (const t of passiveTalents) {
      const ef = t.effect || {};
      if (ef.type === 'study_bonus') extra += Number(ef.value) || 0;
    }
    if (extra) for (const k of Object.keys(delta)) delta[k] += extra;
    const got = this.addAttrs(delta, { reason: label });
    if (Object.keys(got).length) this.ui.toast(label);
  }

  /**
   * 后期灵感压力：进入会试圈（lap2）与殿试后，改用 *Late 档消耗。
   * 全案 3.3「灵感有真实压力但不残酷」——早期宽松保住新手体验，后期收紧才有封笔风险。
   */
  lateVal(base, late) {
    if (late === undefined || late === null) return Number(base) || 0;
    const isLate = this.s.phase === 'lap2' || this.s.phase === 'juren' || this.s.phase === 'jinshi' || this.s.phase === 'palace' || this.s.lap >= 2;
    return Number(isLate ? late : base) || 0;
  }

  /** 完整一场战斗（引擎发起 → UI 六步 → 结算） */
  async doBattle(opts) {
    const s = this.s;
    const insp0 = this.cfg.inspiration;
    this.addInspiration(this.lateVal(insp0.battleCost ?? -2, insp0.battleCostLate), '应战');
    const session = this.createSession(opts);
    if (s.tutorialState && !s.tutorialState.firstBattleSeen) {
      const tutorial = (this.cfg.narrative && this.cfg.narrative.tutorial && this.cfg.narrative.tutorial.battle) || {};
      session.tutorialFirstBattle = !!this.ui.showBattleTutorial;
      session.tutorialFirstBattleText = tutorial.text || '先看题，再选体；先算资源，再决定要不要追加。';
    }
    const out = await this.ui.runBattle(session);
    if (s.tutorialState && !s.tutorialState.firstBattleSeen) {
      s.tutorialState.firstBattleSeen = true;
      this.onForceSave?.();
    }
    await this.settleBattle(session, out);
    if (s.tutorialState && !s.tutorialState.scoreSeen) {
      s.tutorialState.scoreSeen = true;
      this.onForceSave?.();
    }
    return opts && opts.returnOutcome ? out : out.result;
  }

  hiddenFinalConfig() {
    return (this.cfg.board && this.cfg.board.hiddenFinalRing) || null;
  }

  /**
   * 隐藏终圈资格只读取已经公开、已经发生的状态：跨局名篇收集、本局开局锁定的
   * 流派造诣，以及刚刚结算完成的殿试双方作品分。默认“一倍优势”按 2 倍分数解释。
   */
  hiddenFinalEligibility(palaceOut) {
    const cfg = this.hiddenFinalConfig();
    const req = (cfg && cfg.requirements) || {};
    const cards = this.cfg.album || [];
    const store = Album.loadStore();
    const unlocked = new Set(store.unlocked || []);
    const albumCount = cards.filter(c => c && unlocked.has(c.id)).length;
    const allAlbums = cards.length > 0 && albumCount === cards.length;
    const masteryNeed = Math.max(1, Number(req.masteryLevel) || Album.MASTERY_LEVELS);
    const masteryLevel = Math.max(1, Number(this.s.masteryLevel) || 1);
    const playerScore = Math.max(0, Number(palaceOut && palaceOut.selfCalc && palaceOut.selfCalc.total) || 0);
    const opponentScore = Math.max(0, Number(palaceOut && palaceOut.oppCalc && palaceOut.oppCalc.total) || 0);
    const scoreRatioNeed = Math.max(1, Number(req.palaceScoreRatio) || 2);
    const doubleScoreWin = palaceOut && palaceOut.result === 'win'
      && opponentScore > 0 && playerScore >= opponentScore * scoreRatioNeed;
    return {
      eligible: !!cfg && (!req.allAlbums || allAlbums) && masteryLevel >= masteryNeed && !!doubleScoreWin,
      allAlbums, albumCount, albumTotal: cards.length,
      masteryLevel, masteryNeed,
      playerScore, opponentScore, scoreRatioNeed,
      doubleScoreWin: !!doubleScoreWin
    };
  }

  hiddenFinalFoe() {
    const tier = (this.cfg.npcs || []).find(n => n && n.isHiddenFinal);
    const pick = tier && Array.isArray(tier.npcs) ? tier.npcs[0] : null;
    return tier && pick ? this._npcFromPick(tier, pick) : null;
  }

  async runHiddenFinal(meta = {}) {
    const s = this.s;
    const cfg = this.hiddenFinalConfig();
    const npc = this.hiddenFinalFoe();
    if (!cfg || !npc) return this.endGame('jinbang');

    const cells = Array.isArray(cfg.cells) ? cfg.cells : [];
    s.phase = 'secret';
    s.ringId = cfg.id || 'secret';
    s.secretFinal = {
      eligible: true, invited: true, entered: true, completed: false, result: '',
      cellId: Number(cfg.startCellId) || Number(cells[0] && cells[0].id) || 0,
      qualification: { ...meta }
    };
    this.refillStrategy('secret');
    this.ui.onState(s);
    if (typeof this.ui.showHiddenFinalRing === 'function') await this.ui.showHiddenFinalRing(s, cfg);
    s.secretFinal.cellId = Number(cfg.battleCellId) || Number(cells[cells.length - 1] && cells[cells.length - 1].id) || s.secretFinal.cellId;

    const themes = Array.isArray(npc.themes) && npc.themes.length ? npc.themes : ['huaigu'];
    const out = await this.doBattle({
      npc, theme: themes[0], isHiddenFinal: true, returnOutcome: true,
      label: `${cfg.name || '桃源终圈'}·终点论战`
    });
    s.secretFinal.completed = true;
    s.secretFinal.result = out.result;
    s.secretFinal.playerScore = Number(out.selfCalc && out.selfCalc.total) || 0;
    s.secretFinal.opponentScore = Number(out.oppCalc && out.oppCalc.total) || 0;
    if (out.result === 'win') {
      if (typeof this.ui.showHiddenFinalVictory === 'function') await this.ui.showHiddenFinalVictory(out, npc);
      await this.endGame('taoyuan');
    } else {
      if (typeof this.ui.showHiddenFinalDefeat === 'function') await this.ui.showHiddenFinalDefeat(out, npc);
      await this.endGame('secret_loss');
    }
  }

  /* ------------------------------------------------------ 殿试 */
  async runPalace() {
    const s = this.s;
    s.phase = 'palace';
    this.refillStrategy('palace');
    s.reachedEnd = true;
    if (this.cfg.board.layout === 'concentric_spiral') s.ringId = 'palace';
    this.ui.onState(s);
    // 后续由 showPalaceIntro 展示殿试阶段说明，避免重复弹窗。

    // 殿试题材与场次取自主考官配置（npcs.json 的 zhukaoguan.themes），不再硬编码，
    // 便于内容方增减殿试科目；场次数与「全胜」阈值同步由题材数量决定。
    const zk = (this.cfg.npcs || []).find(n => n.isFinal) || {};
    const themes = (zk.themes && zk.themes.length ? zk.themes : ['yongwu', 'songbie', 'huaigu']).slice();
    const themeNames = (this.cfg.affinity || {}).themeNames || {};
    const names = themes.map(t => themeNames[t] || t);
    await this.ui.showPalaceIntro(themes, names, this.choiceInkSummary());

    const n = this.cfg.board.layout === 'concentric_spiral' ? 1 : themes.length;
    // 殿试对手：三圈正式配置为单场；旧配置仍按 themes.length 兼容。「按出战权重加权、不重复抽取 n 个」（幂等去重，防止撞同名考官）。
    // weight 省略=默认 100，weight=0=本阶段不出战；池不足 n 时按实际返回，余下场次退化为独立抽取，
    // 池为 0 时退化为档内随机。注意：场次仍以主考官档优先，若主考官档全被 weight=0 关停则退化为档内随机兜底。
    const zkPool = Array.isArray(zk.npcs) ? zk.npcs : null;
    const palaceSelection = zkPool && zkPool.length
      ? this.selectPalaceFoes(zk, n)
      : { foes: Array.from({ length: n }, () => this.pickNpc(true)), forcedEntry: null };
    const palaceFoes = palaceSelection.foes;
    if (palaceSelection.forcedEntry) {
      const name = palaceSelection.forcedEntry.name || '主考官';
      this.push(`三力之中联力冠绝，殿试必遇「${name}」`);
      this.ui.toast(`联力冠绝三体——「${name}」奉诏出题`);
    }

    // 殿试跨场适应参数：取自本局殿试池中携带 sig_palace_adapt 的主考官配置，
    // 使三场「考官席互通声气」地随玩家战法调整意图（重复破绽收益递减、换策可消层）。
    // 仅当殿试池里存在该机制时开启；层数按整段殿试（PALACE_KEY）分桶，三场共享。
    const adaptFoe = palaceFoes.find(f => {
      const sg = f && f.mech && (f.mech.signature && (f.mech.signature.main || f.mech.signature));
      return sg && sg.template === 'sig_palace_adapt';
    });
    if (adaptFoe && adaptFoe.mech && adaptFoe.mech.signature) {
      const sg = adaptFoe.mech.signature.main || adaptFoe.mech.signature;
      if (sg.template === 'sig_palace_adapt') {
        s.npcMech = s.npcMech || { history: {}, palace: {} };
        s.npcMech.palaceAdapt = {
          maxLayers: Number(sg.maxLayers) || 2,
          weaknessDampen: Number(sg.weaknessDampen) || 0.25,
          minWeaknessRetention: Number(sg.minWeaknessRetention) || 0.5
        };
        s.npcMech.palace = s.npcMech.palace || {};
        s.npcMech.palace[PALACE_KEY] = { layers: 0 };
        s.npcMech.palaceLast = null;
      }
    }

    let palaceOut = null;
    for (let i = 0; i < n; i++) {
      if (s.inspiration <= 0) {
        this.ui.toast('灵感枯竭，余下场次弃权记负');
        s.battle.loss += (n - i); s.battle.streak = 0; s.palaceDone += (n - i);
        break;
      }
      // 文心「金殿对策」：殿试每场开场灵感 +value
      for (const t of (s.passive || [])) {
        const ef = t.effect || {};
        if (ef.type === 'palace_insp') this.addInspiration(Number(ef.value) || 0, `文心·${t.name}`);
      }
      palaceOut = await this.doBattle({
        npc: palaceFoes[i], theme: themes[i], isPalace: true,
        returnOutcome: true,
        label: `殿试第 ${i + 1} 场·${names[i]}`
      });
    }
    if (s.palaceWins >= n) this.ui.toast('殿试全胜——金榜题名！');
    // 照我传灯·跨局传承：殿试结算时尝试点亮下一局传承火种
    this._maybePendReincarnate();
    if (s.palaceWins >= n) {
      const eligibility = this.hiddenFinalEligibility(palaceOut);
      s.secretFinal = Object.assign({}, s.secretFinal || {}, eligibility);
      if (eligibility.eligible && typeof this.ui.askHiddenFinal === 'function') {
        s.secretFinal.invited = true;
        const enter = await this.ui.askHiddenFinal(eligibility);
        if (enter) return this.runHiddenFinal(eligibility);
      }
    }
    await this.endGame(s.palaceWins >= n ? 'jinbang' : 'palace');
  }

  /** 殿试结算：若持有「照我传灯」且剩余灵感达标，点亮下一局传承火种 */
  _maybePendReincarnate() {
    const t = [...(this.s.passive || []), ...(this.s.active || [])]
      .find(x => x.effect && x.effect.type === 'reincarnate');
    if (!t) return;
    const okPend = Reincarnate.pend(this, t.id);
    if (okPend) {
      this.push(`文心「${t.name}」感应：殿试功成，余灵 ${this.s.inspiration} 足可传灯——下一局将继承此刻修为。`);
    } else {
      this.push(`文心「${t.name}」：殿试虽毕，余灵未足（需 ≥ ${Number(t.effect.inspThreshold) || 0}），传灯未亮。`);
    }
  }

  /* ------------------------------------------------------ 结算 */
  async endGame(reason) {
    const s = this.s;
    if (s.over) return;
    s.over = true;
    s.endReason = reason;

    const summary = R.sixDimScore({
      attrs: s.attrs,
      battle: s.battle,
      events: s.events,
      finish: {
        reached: s.reachedEnd,
        inspirationLeft: s.inspiration,
        turns: s.turn,
        manuscriptVolumes: Number((s.abilityState && s.abilityState.manuscript || {}).volumes) || 0,
        manuscriptBonus: (Number((s.abilityState && s.abilityState.manuscript || {}).volumes) || 0)
          * (Number((this.abilityConfig().manuscript || {}).volumeScore) || 60),
        finalWin: this.cfg.board.layout === 'concentric_spiral' ? s.palaceWins >= 1 : s.palaceWins >= 3,
        palaceSweep: this.cfg.board.layout === 'concentric_spiral' ? s.palaceWins >= 1 : s.palaceWins >= 3
      }
    }, this.cfg.grades);

    summary.reason = reason;
    summary.reasonText = {
      fengbi: '灵感耗尽，就此封笔——江郎才尽·悔',
      turnlimit: '岁月不居，六十回合已尽',
      palace: '殿试已毕，静候放榜',
      jinbang: this.cfg.board.layout === 'concentric_spiral' ? '殿试一决夺魁，金榜题名！' : '殿试三连捷，金榜题名！',
      taoyuan: '终圈胜桃花仙人，万卷归心，走出桃源。',
      secret_loss: '金榜已定，桃源终问留待来局。'
    }[reason] || '对局结束';
    summary.inkEpilogue = this.choiceInkEpilogue();
    summary.state = s;
    Object.assign(summary, this.commitAlbum(summary));
    // 流派熟练度：结算后按本局结果累加（完成即加、通关/文宗额外）
    try {
      const st = s;
      const runForMastery = {
        reachedEnd: !!st.reachedEnd,
        wenzong: !!(summary.grade && summary.grade.id === 'wenzong'),
        schoolId: st.school && st.school.id
      };
      const mres = Album.addMasteryXp(
        Album.loadStore(), runForMastery.schoolId, runForMastery
      );
      if (mres) {
        summary.mastery = mres;
        if (mres.leveledUp) this.push(`流派造诣精进：${Album.masteryLevelName(mres.after.level)}！`);
      }
    } catch (e) { /* 熟练度累计失败不阻断结算 */ }
    // 通关（金榜题名）→ 提交分数到云端排行榜（解耦：由 app.js 注入 onVictory）
    if (['jinbang', 'taoyuan', 'secret_loss'].includes(summary.reason) && typeof this.onVictory === 'function') {
      try { this.onVictory((s.playerName || '无名氏'), summary.total); } catch (_) { /* 提交失败不阻断结算 */ }
    }
    await this.ui.showResult(summary);
    return summary;
  }

  /**
   * 把本局并入累计统计，判定新解锁的图鉴卡并落盘到 localStorage。
   * 无 localStorage 的环境（Node）自动走内存兜底，不影响引擎主流程。
   * @returns {{albumStore, newUnlocks}}
   */
  commitAlbum(summary) {
    const s = this.s;
    const cards = this.cfg.album || [];
    let store = Album.loadStore();
    try {
      Album.mergeRun(store.stats, {
        battle: s.battle,
        events: s.events,
        quizRight: s.quiz ? s.quiz.right : 0,
        endReason: s.endReason,
        finalWin: this.cfg.board.layout === 'concentric_spiral' ? s.palaceWins >= 1 : s.palaceWins >= 3,
        palaceSweep: this.cfg.board.layout === 'concentric_spiral' ? s.palaceWins >= 1 : s.palaceWins >= 3,
        reachedEnd: s.reachedEnd,
        total: summary.total
      });
      const newUnlocks = Album.findNewUnlocks(cards, store);
      for (const c of newUnlocks) store.unlocked.push(c.id);
      store = Album.saveStore(store);
      return { albumStore: store, newUnlocks };
    } catch (e) {
      return { albumStore: store, newUnlocks: [], albumError: e.message };
    }
  }
}

/* 题目文本：无题库题材时用配置里的题材名生成一个雅称 */
const TOPIC_WORDS = {
  yongwu: ['咏梅', '咏蝉', '咏石榴', '咏竹'],
  songbie: ['灞桥折柳', '江畔送客', '长亭饯别'],
  shanshui: ['溪山行旅', '烟雨江南', '空山新雨'],
  biansai: ['塞下秋来', '玉门残雪', '大漠孤烟'],
  huaigu: ['赤壁怀古', '金陵怀古', '乌衣巷口'],
  jieling: ['清明时节', '中秋对月', '重阳登高']
};
function pickTopic(theme, af, rand) {
  const arr = TOPIC_WORDS[theme] || [af.themeNames[theme] || theme];
  return arr[Math.floor(rand() * arr.length)];
}
