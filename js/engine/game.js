/**
 * game.js —— 单人对局引擎（无 DOM）。所有表现通过注入的 ui 适配器完成。
 * 规则依据：全案 3.1–3.8。战斗与评分公式一律调用 rules.js。
 */
import * as R from './rules.js';
import * as Album from './album.js';
import * as Codex from './codex.js';

export const PASSIVE_MAX = 8;
export const ACTIVE_MAX = 4;
export const TURN_LIMIT = 84;

/** NPC 的稳定标识：机制 NPC（有 mech）优先用具名 id，普通 NPC 用其 id（档位 id）或姓名 */
function stableFoeId(npc) {
  if (!npc) return '论敌';
  return npc.id ? npc.id : npc.name;
}

/**
 * 殿试跨场适应状态键：殿试三场视作同一「考官席」互通声气地跨场适应，
 * 故层数按整段殿试（而非单个考官 foeId）分桶。sig_palace_adapt 的
 * weaknessDampen / minWeaknessRetention / maxLayers 皆由此键下的 palaceAdapt 驱动。
 */
const PALACE_KEY = '__palace__';

/**
 * 照我传灯·跨局传承：殿试结算后，若持有传说文心「照我传灯」且剩余灵感达标，
 * 记录「传承火种」到本地存储（内存兜底，便于无头测试），供「下一局」开局时继承本局属性。
 * 仅生效一次（消费即清除）。reincarnate 效果字段：
 *   inspThreshold 殿试结算所需剩余灵感；attrRatio 下局继承本局属性的比例（0~1，随等级升高）。
 */
export const REINCARNATE_KEY = 'feihua_reincarnate_v1';
export const Reincarnate = {
  _mem: null,
  _read() {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        const raw = localStorage.getItem(REINCARNATE_KEY);
        if (raw) return JSON.parse(raw);
      }
    } catch (e) { /* 存储不可用 → 内存兜底 */ }
    return this._mem;
  },
  _write(obj) {
    this._mem = obj;
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        if (obj) localStorage.setItem(REINCARNATE_KEY, JSON.stringify(obj));
        else localStorage.removeItem(REINCARNATE_KEY);
      }
    } catch (e) { /* 存储不可用 → 内存兜底 */ }
  },
  /** 殿试结算时尝试点亮传承：成功返回 true（已记录火种） */
  pend(game, talentId) {
    const s = game.s;
    const t = (s.passive || []).find(x => x.id === talentId) || (s.active || []).find(x => x.id === talentId);
    if (!t || !t.effect || t.effect.type !== 'reincarnate') return false;
    const threshold = Number(t.effect.inspThreshold) || 0;
    const ratio = Number(t.effect.attrRatio) || 0;
    if (s.inspiration < threshold || ratio <= 0) return false;
    const attrs = {};
    for (const k of R.ATTR_KEYS) attrs[k] = Math.floor((Number(s.attrs[k]) || 0) * ratio);
    this._write({ talentId, talentName: t.name || talentId, ratio, attrs, ts: (typeof Date !== 'undefined' ? Date.now() : 0) });
    return true;
  },
  /** 新局开局时消费传承：返回 { talentId, talentName, ratio, attrs } 或 null（一次性，消费即清除） */
  consume() {
    const obj = this._read();
    if (!obj || !obj.attrs) return null;
    this._write(null);
    return obj;
  },
  peek() { return this._read(); },
  reset() { this._write(null); }
};

export class Game {
  constructor(cfg, ui, rand = Math.random) {
    this.cfg = cfg;
    this.ui = ui;
    this.rand = rand;
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
    const choice = this.ui.showBowenChoice ? await this.ui.showBowenChoice() : 'broad';
    if (choice === 'focus') {
      const key = R.CREATIVE_KEYS.slice().sort((a, b) => (s.attrs[a] || 0) - (s.attrs[b] || 0))[0];
      this.addAttrs({ [key]: 3 }, { noSchoolGrowth: true });
      st.bowenFocus = key;
      this.push(`博闻·专攻一体：${R.ATTR_NAMES[key]} +3${reason ? `（${reason}）` : ''}`);
    } else if (choice === 'battle') {
      this.addAttrs({ xue: 2 }, { noSchoolGrowth: true });
      this.addInspiration(2, '博闻·以学驭战');
      st.bowenBattleHint = true;
      this.push(`博闻·以学驭战：学力 +2，灵感 +2`);
    } else {
      this.addAttrs({ shi: 1, ci: 1, lian: 1 }, { noSchoolGrowth: true });
      st.bowenBroad = true;
      this.push(`博闻·兼收并蓄：三体各 +1${reason ? `（${reason}）` : ''}`);
    }
    // 博闻 Lv5 宗师点睛：每次触发额外沉淀 +知识BonusGain 学力（厚积薄发）
    const bonusGain = Number(mech.knowledgeBonusGain) || 0;
    if (bonusGain > 0) {
      this.addAttrs({ xue: bonusGain }, { noSchoolGrowth: true });
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

  /* ---------------------------------------------------------- 开局 */
  /**
   * @param {string} schoolId
   * @param {object} [opts] - { loadout: 图鉴装配卡数组, name: 玩家自起之名 }
   */
  start(schoolId, opts = {}) {
    const cfg = this.cfg;
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
      track: 'main', pos: 0, branchId: null, branchIndex: -1,
      lap: 1, turn: 0, phase: 'lap1',
      sky: [], nextBattlePct: 0,
      battle: { win: 0, draw: 0, loss: 0, streak: 0, maxStreak: 0, upsets: 0, winsByStyle: { shi: 0, ci: 0, lian: 0 } },
      events: { total: 0, rare: 0, legend: 0, talents: 0, items: 0 },
      quiz: { asked: 0, right: 0 },
      seenEvents: new Set(), usedQuestions: new Set(),
      palaceWins: 0, palaceDone: 0,
      zeitgeist: this.seedZeitgeist(cfg.affinity),   // 当朝风潮（每局随机，制造变化性）
      affStreak: { manner: null, n: 0 },             // 气势连捷：连续同风格胜场
      synergies: [],                                 // 当前已激活的文心羁绊（id/name/desc/members）
      talentLevels: {},                              // 文心等级：{ [talentId]: level }（Lv1 起，存档持久化）
      talentState: { triggers: {}, flags: {} },       // 文心局内触发次数/一次性互斥标记（存档持久化）
      npcMech: { history: {}, palace: {} },          // NPC 三机制跨场状态
      loadout: [], titles: [],
      over: false, reachedEnd: false, endReason: '',
      log: []
    };

    const t0 = cfg.talentById.get(school.talent);
    if (t0) this.grantTalent(t0, { silent: true });
    this.push(`选择「${school.name}」，${R.ATTR_NAMES[school.attr]} +${cfg.attrs.schoolBonus ?? 3}`);
    if (_masteryGain > 0) {
      this.push(`流派造诣·${Album.masteryLevelName(this.masteryLevel)}：${R.ATTR_NAMES[school.attr]} +${_masteryGain}`);
      if (this.ui && this.ui.toast) this.ui.toast(`◆ ${school.name}造诣 ${Album.masteryLevelName(this.masteryLevel)}，${R.ATTR_NAMES[school.attr]} +${_masteryGain}`);
    }
    this.applyLoadout(opts.loadout || []);

    // 照我传灯·跨局传承：若开局消费了传承，落日志 + 提示
    if (this._inheritApplied) {
      const a = this._inheritApplied;
      const detail = R.ATTR_KEYS.filter(k => a.added[k]).map(k => `${R.ATTR_NAMES[k]} +${a.added[k]}`).join('、');
      this.push(`照我传灯·传承：继承「${a.talentName}」前世修为（${Math.round(a.ratio * 100)}%），${detail}`);
      if (this.ui && this.ui.toast) this.ui.toast(`✦ 照我传灯·传承生效：${detail}`);
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

  /** 应用图鉴装配奖励（最多 LOADOUT_MAX 项，开局一次性生效） */
  applyLoadout(cards) {
    const list = (cards || []).slice(0, Album.LOADOUT_MAX);
    for (const card of list) {
      const r = card.reward || {};
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
        if (gain > 0) {
          this.s.inspirationMax = Math.max(Number(this.cfg.inspiration.max) || 0, (Number(this.s.inspirationMax) || 0) + gain);
        }
      } else if (r.type === 'title' && r.title) {
        this.s.titles.push(r.title);
      }
      this.push(`图鉴装配「${card.name}」——${card.rewardDesc || ''}`);
    }
  }

  push(text) {
    this.s.log.push({ turn: this.s.turn, text });
    // 日志上限：防止长局把存档撑爆（截断保留最近 150 条，与 save.js 的截断阈值一致）
    if (this.s.log.length > 200) this.s.log.splice(0, this.s.log.length - 150);
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

  /** 整体进度 0–1（两圈 = 120 格），用于 NPC 取档 */
  progress() {
    const ring = this.cfg.board.ringSize;
    const laps = this.cfg.board.laps;
    const p = ((this.s.lap - 1) * ring + this.s.pos) / (ring * laps);
    return R.clamp(p, 0, 0.999);
  }

  /**
   * 取档：先按进度/殿试选出「档」（tier），再从该档的具名对手池中随机抽一名。
   * 返回对象自带 tier（档名，如「童生级」）+ name（具名，如「周小满」）+ fullName（「童生级·周小满」）。
   * 旧版扁平格式（档级直接带 attrs、无 npcs 池）自动兜底为单一对手。
   */
  pickNpc(forPalace) {
    const list = this.cfg.npcs || [];
    let tier;
    if (forPalace) {
      tier = list.find(n => n.id === 'zhukaoguan')
        || list.find(n => (n.range || [])[0] >= 1)
        || list[list.length - 1];
    } else {
      const p = this.progress();
      tier = list.find(n => n.range && p >= n.range[0] && p < n.range[1]) || list[0];
    }
    if (!tier) {
      return { name: '论敌', fullName: '论敌', attrs: { shi: 5, ci: 4, lian: 3, bi: 4, xue: 4, si: 4 } };
    }
    const label = tier.tier || tier.name || '论敌';
    const pool = Array.isArray(tier.npcs) ? tier.npcs : null;
    if (!pool || !pool.length) {
      // 旧格式兜底：整档即单一对手
      return {
        id: tier.id, tier: label, range: tier.range, desc: tier.desc,
        isFinal: tier.isFinal, battles: tier.battles, themes: tier.themes,
        name: tier.name || label, title: tier.title || '',
        attrs: tier.attrs || {}, fullName: label
      };
    }
    // 出战权重：具名 NPC 可配 weight（默认 100，0=本阶段不出战），按权重带权抽取。
    const pick = R.pickNpcByWeight(pool, this.rand) || pool[0];
    return this._npcFromPick(tier, pick);
  }

  /** 由「档」对象 + 具名对手，拼装一枚完整 NPC（含档名与 fullName） */
  _npcFromPick(tier, pick) {
    const label = tier.tier || tier.name || '论敌';
    return {
      // 稳定 id 优先：具名 NPC 配了 id（如 zhou_xiaoman）则用其标识跨局稳定；缺省回退档位 id
      //（普通 NPC 保持 tierId，图鉴键沿用「档位|姓名」兼容旧档）
      id: (pick && pick.id) ? pick.id : tier.id,
      tierId: tier.id,                      // 档位 id（童生级/秀才级等）
      tier: label, range: tier.range, desc: tier.desc,
      isFinal: tier.isFinal, battles: tier.battles, themes: tier.themes,
      name: pick.name || label,
      title: pick.title || '',
      style: pick.style || '',
      attrs: pick.attrs || tier.attrs || {},
      mech: pick.mech || null,
      fullName: `${label}·${pick.name || label}`
    };
  }

  /**
   * NPC 三机制：把跨场玩家行为状态映射为 rules 纯函数期望的 playerHistory 形态。
   *  - lastStyle / lastManner：上一场玩家文体/文风（识破重复/换体破绽用）
   *  - habitualStyle：最近 2 场同一文体（仿作惯用用）
   * @param {string|null} npcId 当前 NPC 的稳定 id（用于按 NPC 分桶历史）
   */
  _mechHistoryForNpc(npcId) {
    const nm = this.s.npcMech || {};
    const lastStyle = nm.lastPlayerStyle || null;
    const lastManner = nm.lastPlayerManner || null;
    let habitualStyle = null;
    const h = nm.history && nm.history[npcId];
    if (h && Array.isArray(h.styles) && h.styles.length >= 2) {
      if (h.styles[h.styles.length - 1] === h.styles[h.styles.length - 2]) habitualStyle = h.styles[h.styles.length - 1];
    }
    return { lastStyle, lastManner, habitualStyle, _nm: nm };
  }

  /**
   * 判断玩家「本场战法」相对「上一场同考官战法」是否更换。
   * 供 wea_cross_battle_shift（王侍郎跨场换策）判定：第二场之后，若玩家换用
   * 不同的文体或文风，则视为换策，可移除一层跨场适应层数。
   * 取该 NPC（稳定 id）分桶历史中最近一场所用文体/文风作比较，避免跨对手串场；
   * 无历史（首场）或上一场缺失则为 false。
   * @param {object} npc 当前 NPC
   * @param {string} style 本场玩家文体
   * @param {string} manner 本场玩家文风
   */
  _strategyChangedSinceLast(npc, style, manner) {
    try {
      const nm = this.s.npcMech || {};
      const h = nm.history && nm.history[stableFoeId(npc)];
      if (!h) return false;
      const lastStyle = h.styles && h.styles[h.styles.length - 1];
      const lastManner = h.manners && h.manners[h.manners.length - 1];
      if (!lastStyle) return false;                       // 首场无前一战
      return lastStyle !== style || lastManner !== manner;
    } catch (e) {
      // 存档异常时安全降级：不判定换策（E1）
      return false;
    }
  }

  /**
   * 殿试序列级「换策」判定（跨场适应专用）：不按单个考官分桶，而按整段殿试
   * 上一场的战法比较——考官席互通声气，玩家是否换了文体/文风/资源打法。
   * 首场（无 palaceLast）返回 false，与逐考官判定语义一致。
   */
  _palaceStrategyChanged(style, manner) {
    try {
      const nm = this.s.npcMech || {};
      const last = nm.palaceLast;
      if (!last || !last.style) return false;             // 首场无前一战
      return last.style !== style || last.manner !== manner;
    } catch (e) {
      return false;
    }
  }

  cellAt(track, pos, branchId, branchIndex) {
    if (track === 'branch') {
      const br = this.cfg.board.branches[branchId];
      return this.cfg.board.cellById.get(br.cells[branchIndex]);
    }
    return this.cfg.board.cellById.get(pos);
  }
  currentCell() { return this.cellAt(this.s.track, this.s.pos, this.s.branchId, this.s.branchIndex); }

  /* ------------------------------------------------------ 数值变更 */
  /**
   * 属性增减。除 opts.raw 外，一律走 config/attrs.json 的 diminish 递减曲线
   * （属性越高，同一次 +N 实得越少；见 rules.diminishGain）。
   * raw:true 用于文心 attr_flat —— 它必须与 revokeTalentFlat 严格可逆，不能递减。
   */
  addAttrs(delta, opts = {}) {
    const out = {};
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
    if (Object.keys(out).length) this.ui.floatAttrs(out, opts.anchor);
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

    // 持有副本按当前等级（Lv1）生效；升级时原地替换 effect/cost，不污染 cfg 模板。
    const lvl1 = this.leveledTalent(talent, 1);

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
      this.push(`获得文心「${talent.name}」`);
    }
    this.applyTalentFlat(lvl1);
    this.applyTalentInstant(lvl1);
    s.talentLevels[talent.id] = 1;
    s.events.talents++;

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
    this.ui.onState(s);
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
   * - 其余类型（dice_plus/ crit/ dice_mult/ copy_affinity/ 各 pct 等）效果在战斗中实时读取 t.effect，替换即生效。
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
        this.s.inspirationMax = Math.max(Number(this.cfg.inspiration.max) || 0, (Number(this.s.inspirationMax) || 0) + gain);
        this.push(`文心「${t.name}」精进，本局灵感上限 +${gain}`);
      }
    }

    s.talentLevels[id] = newLevel;
    Codex.recordTalentLevel && Codex.recordTalentLevel(id, newLevel);
    this.ui.onState(s);
    // 升级效果立即与存档绑定：触发强制落盘，使「存档重载 / 继续上局」都能还原到升级后状态，
    // 不会因升级后到下一回合存档点前重载而回退到升级前。（onForceSave 由 UI 挂接，无 UI 时安全空转）
    if (typeof this.onForceSave === 'function') this.onForceSave();
    else if (typeof this.onSavePoint === 'function') this.onSavePoint();
    this.push(`文心「${t.name}」精进至 Lv${newLevel}`);
    return { ok: true, level: newLevel, max: up.maxLevel, cost };
  }

  applyTalentFlat(t) {
    if (t.effect && t.effect.type === 'attr_flat' && t.effect.attrs) this.addAttrs(t.effect.attrs, { raw: true });
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
        this.s.inspirationMax = Math.max(Number(this.cfg.inspiration.max) || 0, (Number(this.s.inspirationMax) || 0) + gain);
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
  randomTalent(kind) {
    const s = this.s;
    const have = new Set([...s.passive, ...s.active].map(t => t.id));
    const ts = s.talentState || (s.talentState = { triggers: {}, flags: {} });
    ts.flags = ts.flags || {};
    const ownedCount = have.size;
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

    // 首回合开始前：弹窗说明当朝文风（风潮）及其效果（续玩存档 turn>0 不触发）
    if (s.turn === 0 && typeof this.ui.showZeitgeist === 'function') {
      await this.ui.showZeitgeist(s.zeitgeist);
    }
    s.turn++;
    if (s.turn > TURN_LIMIT) return this.endGame('turnlimit');

    this.tickSky();
    s.phase = s.lap >= 2 ? 'lap2' : 'lap1';
    this.ui.onState(s);

    const dice = this.d6();
    await this.ui.showDice(dice);
    const arrived = await this.moveSteps(dice);
    if (s.over) return;

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

  /** 逐格前进；返回 'palace' 表示第二圈抵达起点 */
  async moveSteps(steps) {
    const s = this.s;
    const board = this.cfg.board;

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
    this.addAttrs({ bi: g, xue: g, si: g });
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
        this.addAttrs({ [key]: gain });
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
      // 抉择题无对错，但「超时未选」不算作出抉择——不给属性奖励，并照扣灵感
      if (!ans.timedOut && ans.index >= 0) {
        s.quiz.right++;
        const opt = q.options[ans.index];
        if (opt && opt.attr) this.addAttrs({ [opt.attr]: this.cfg.attrs.quizCorrectGain ?? 2 });
        this.addInspiration(this.cfg.inspiration.quizCorrectInsp ?? 0, '抉择');
        await this.gainBowenKnowledge('完成抉择');
        for (const t of s.passive) if ((t.effect || {}).type === 'insp_on_quiz') this.triggerTalentLimited(t, `文心·${t.name}`);
        await this.ui.showQuizResult(q, ans, true);
      } else {
        this.addInspiration(this.cfg.inspiration.quizWrong ?? -2, '超时');
        this.push(`抉择题「${q.id}」超时未决`);
        await this.ui.showQuizResult(q, ans, false);
      }
    }
  }

  /* ------------------------------------------------------ 辞宗战后轻奇遇 */
  _eventHasTalentReward(ev) {
    const has = e => !!(e && (e.talent || (Array.isArray(e.choices) && e.choices.some(c => c && c.effect && c.effect.talent))));
    return has(ev) || has(ev && ev.challenge && ev.challenge.winAll);
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
      const c = (ev.choices || [])[idx] || (ev.choices || [])[0] || {};
      await this.applyEffect(c.effect || {});
    } else await this.applyEffect(ev.effect || {});
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
      const c = (ev.choices || [])[choiceIdx] || (ev.choices || [])[0] || {};
      await this.applyEffect(c.effect || {});
    } else if (ev.kind === 'challenge') {
      await this.runChallenge(ev);
    } else {
      await this.applyEffect(ev.effect || {});
    }
    this.ui.onState(s);
  }

  async applyEffect(effect) {
    if (!effect) return;
    if (effect.attrs) this.addAttrs(effect.attrs);
    if (effect.inspiration) this.addInspiration(Number(effect.inspiration), '奇遇');
    if (effect.inspirationMax) {
      const gain = Math.max(0, Number(effect.inspirationMax) || 0);
      if (gain > 0) {
        this.s.inspirationMax = Math.max(Number(this.cfg.inspiration.max) || 0, (Number(this.s.inspirationMax) || 0) + gain);
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
    const n = Number((ev.challenge || {}).battles) || 1;
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
      this.ui.toast(`${ev.name}：全胜！`);
      await this.applyEffect((ev.challenge || {}).winAll || {});
    } else {
      this.ui.toast(`${ev.name}：${wins}/${n} 胜，未竟全功`);
    }
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
  // 停留时，可消耗灵感随机抽取一枚文心（玩家可选：抽 / 不抽）。
  async doScenic(cell) {
    const cost = this.cfg.inspiration.scenicCost ?? 8;
    const go = await this.ui.askScenic(cell, cost, this.s.inspiration);
    if (!go) { this.ui.toast(`${cell.name}——览胜片刻，继续前行`); return; }
    if (this.s.inspiration < cost) { this.ui.toast('灵感不足，无缘访胜抽签'); return; }
    this.addInspiration(-cost, '访胜抽签');
    const t = this.randomTalent();
    if (t) {
      await this.grantTalent(t);
      this.push(`于${cell.name}访胜，灵感 -${cost}，得文心「${t.name}」`);
    } else {
      this.ui.toast('胸中已藏尽天下文心，再无可抽');
    }
  }

  /* ====================================================== 战斗 */
  async doBattleCell(cell) {
    if (this.s.inspiration <= 0) { this.ui.toast('灵感枯竭，无力应战'); return; }
    await this.doBattle({ npc: this.pickNpc(false), label: cell.name });
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
        templates: tplLib
      });
      // 联力未解锁时，若意图锁定了联体，回退期望分最优（避免锁死不可用文体）
      if (npcIntent.style === 'lian' && !this.lianUnlocked) {
        npcIntent.style = R.pickNpcStyle(npc.attrs, false);
      }
    }
    const intentLocked = npcIntent
      ? { style: npcIntent.style, manner: npcIntent.manner, styleDisclosed: npcIntent.styleDisclosed, mannerDisclosed: npcIntent.mannerDisclosed }
      : null;

    const session = {
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
      // 殿试跨场适应层数（若本场为殿试且这是机制主考官）：供 UI 出「场间评语」
      palaceLayers: (() => {
        if (!opts.isPalace || !(npc && npc.mech)) return 0;
        const pal = (s.npcMech && s.npcMech.palace && s.npcMech.palace[PALACE_KEY]) || null;
        return pal ? (Number(pal.layers) || 0) : 0;
      })(),
      playerAttrs: this.effectiveAttrs(),
      lianUnlocked: this.lianUnlocked,
      activeTalents: s.active.slice(),
      usedActive: [],
      inspiration: s.inspiration,
      // 败北灵感惩罚的「预览值」：与结算逻辑完全一致（lateVal × 科场风起倍数），
      // 供 UI 判词精确显示，避免文案与实际扣分不一致。
      projLoseInsp: (() => {
        const insp = this.cfg.inspiration || {};
        const base = this.lateVal(insp.battleLoseExtra ?? -3, insp.battleLoseExtraLate);
        const mult = this.skyActive('battle_reward_mult') ? 2 : 1;
        return base * mult;
      })(),

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
      styleHint(style) {
        return style === 'lian' && !g.lianUnlocked ? '联力尚浅，先积淀对仗功底（需联力 ≥8）' : '';
      },
      /** 使用主动文心：扣灵感并登记 */
      useActive(id) {
        const t = s.active.find(x => x.id === id);
        if (!t || this.usedActive.some(x => x.id === id)) return false;
        const cost = Number(t.cost) || 1;
        if (s.inspiration < cost) return false;
        g.addInspiration(-cost, `文心·${t.name}`);
        this.usedActive.push(t);
        this.inspiration = s.inspiration;
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

    // 多枚灵感骰支持：dice 可为点数数组（每枚一枚），也可仍是单数字向后兼容。
    // 总点数 = 各枚求和，与「灵感骰 = 点数 × diceMult」公式自洽；lucky_six 取「任一枚为 6」。
    const dicePips = Array.isArray(dice) ? dice.slice() : [Number(dice) || 1];
    const totalPips = dicePips.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    const hasSix = dicePips.includes(6);
    const extraDice = dicePips.length > 1 ? dicePips.length - 1 : 0;   // 玩家本场追加的灵感骰数

    /* ---- 玩家侧修正 ---- */
    const pct = [], flat = [];
    let dicePlus = 0, diceMult = R.BATTLE_COEF.diceMult, diceFixed = null, critMult = 1;
    const schoolMech = this.schoolMechanics();
    const schoolDicePlus = schoolMech.type === 'cizong_bi'
      ? Math.min(Number(schoolMech.creativeDicePlus) || 0, Number(schoolMech.freeDiceCap) || 5) : 0;

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

    for (const t of s.passive) {
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

    // 文心羁绊：拥有特定组合即激活的联动加成（实时按当前持有重算，无持久状态）
    for (const sy of this.synergySet()) {
      for (const ef of (sy.effects || [])) {
        if (ef.type === 'dice_plus') dicePlus += Number(ef.value) || 0;
        else if (ef.type === 'crit' && this.rand() < (Number(ef.chance) || 0)) critMult = Math.max(critMult, Number(ef.mult) || 1);
        else if (ef.type === 'syn_pct') pct.push({ source: 'synergy', label: `羁绊·${sy.name}`, value: Number(ef.value) || 0 });
      }
    }

    /* ---- NPC 侧 ---- */
    const npcAttrs = session.npc.attrs;
    // 意图锁定：机制 NPC 用 createSession 锁定的意图文体/文风；普通 NPC 走旧规则
    const npcStyle = (session.intentLocked && session.intentLocked.style)
      ? session.intentLocked.style : R.pickNpcStyle(npcAttrs, npcAttrs.lian >= 8);
    const npcManner = (session.intentLocked && session.intentLocked.manner)
      ? session.intentLocked.manner : R.pickNpcManner(af.matrix, session.manners, session.theme);
    const npcAff = R.affinityValue(af.matrix, npcManner, session.theme);
    const npcDice = this.d6();
    // NPC 最佳文体期望分（阶段 E：供 sig_steady_pressure 的 floorPct / sig_dice_response
    // 的 perDicePct 作等效比例基准，使招牌强度在全档位稳定落入 5-10% 预算）。
    const npcExpected = Math.max(R.expectedScore(npcAttrs, npcStyle),
      ...(R.CREATIVE_KEYS||[]).map(s => s==='lian'&&(npcAttrs.lian||0)<8 ? -1 : R.expectedScore(npcAttrs, s)));

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
      pm = { style, manner, extraDice, matchesIntent };
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
        palaceAdapt
      });
      // 招牌（后）
      const tri = R.signatureTriggered({
        mech: npcMech, npcStyle, npcManner,
        playerMove: pm, playerHistory, templates: tplLib
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

    if (diceFixed == null) dicePlus += schoolDicePlus;
    const selfCalc = R.battleScore({
      attrs: session.playerAttrs, style, dice: totalPips, dicePlus, diceMult, diceFixed, critMult,
      pctMods: pct, flatMods: flat
    });
    let oppPct = npcAff !== 0 ? [{ source: 'affinity', label: `相性·${af.mannerNames[npcManner]}`, value: npcAff }] : [];
    let oppFlat = [];
    if (mechOut) {
      for (const m of mechOut.mods.pct) oppPct.push(m);
      for (const m of mechOut.mods.flat) oppFlat.push(m);
    }
    let oppCalc = R.battleScore({
      attrs: npcAttrs, style: npcStyle, dice: npcDice,
      pctMods: oppPct, flatMods: oppFlat
    });
    let result = R.judgeBattle(selfCalc.total, oppCalc.total, (this.cfg.grades.battle || {}).drawRatio);
    const upset = result === 'win'
      && R.expectedScore(npcAttrs, npcStyle) > R.expectedScore(session.playerAttrs, style);

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
      const pm2 = { style, manner, extraDice, matchesIntent };
      const wea2 = R.weaknessResolution({
        mech: npcMech, npcStyle,
        playerMove: pm2,
        playerHistory: this._mechHistoryForNpc(stableFoeId(session.npc)), npcManner,
        templates: this.cfg['npc-mechanics'] || {},
        result, relativeMargin: relMarg, strategyChanged,
        palaceAdapt
      });
      const mods2 = R.signatureScoreMods(mechOut.tri, wea2, npcMech.signature, { extraDice, npcSi: npcAttrs.si || 0, npcExpected });
      if (mods2 !== mechOut.mods) {
        oppPct = npcAff !== 0 ? [{ source: 'affinity', label: `相性·${af.mannerNames[npcManner]}`, value: npcAff }] : [];
        oppFlat = [];
        for (const m of mods2.pct) oppPct.push(m);
        for (const m of mods2.flat) oppFlat.push(m);
        oppCalc = R.battleScore({ attrs: npcAttrs, style: npcStyle, dice: npcDice, pctMods: oppPct, flatMods: oppFlat });
        result = R.judgeBattle(selfCalc.total, oppCalc.total, (this.cfg.grades.battle || {}).drawRatio);
        mechOut = { tri: mechOut.tri, wea: wea2, mods: mods2 };
        session._mechOut = mechOut;
      }
    }

    return {
      style, manner, dice: totalPips, dicePips, selfCalc,
      npcStyle, npcManner, npcDice, oppCalc,
      npcMannerName: af.mannerNames[npcManner], result, upset,
      mech: mechOut
    };
  }

  /** 应用战斗奖惩（UI 播完算分动画后调用） */
  async settleBattle(session, out) {
    const s = this.s;
    const insp = this.cfg.inspiration;
    const schoolMech = this.schoolMechanics();
    const schoolState = s.schoolState || (s.schoolState = this.createSchoolState(s.school));
    const battleId = `${s.turn}:${schoolState.battleSeq || 0}:${session.label || ''}`;
    if (schoolState.settledBattleIds && schoolState.settledBattleIds.includes(battleId)) return;
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

    if (out.result === 'win') {
      s.battle.win++; s.battle.streak++; s.battle.maxStreak = Math.max(s.battle.maxStreak, s.battle.streak);
      s.battle.winsByStyle[out.style] = (s.battle.winsByStyle[out.style] || 0) + 1;
      if (out.upset) s.battle.upsets++;

      // 获胜属性奖励区间由 config/attrs.json 的 battleWinGain 决定
      const range = this.cfg.attrs.battleWinGain || [2, 3];
      const lo = Math.min(Number(range[0]) || 2, Number(range[1]) || 3);
      const hi = Math.max(Number(range[0]) || 2, Number(range[1]) || 3);
      let gain = lo + Math.floor(this.rand() * (hi - lo + 1));
      for (const t of s.passive) {
        const ef = t.effect || {};
        if (ef.type === 'on_win_bonus' && (ef.style === out.style || ef.style === 'any')) gain += Number(ef.value) || 0;
        if (ef.type === 'insp_on_win') this.addInspiration(Number(ef.value) || 0, `文心·${t.name}`);
      }
      for (const sy of this.synergySet()) {
        for (const ef of (sy.effects || [])) {
          if (ef.type === 'on_win_bonus' && (ef.style === out.style || ef.style === 'any')) gain += Number(ef.value) || 0;
        }
      }
      // 雪球收敛：以强凌弱所得渐薄（全案 4.4 降方差）
      const scale = R.winRewardScale(
        R.expectedScore(session.playerAttrs, out.style),
        R.expectedScore(session.npc.attrs, out.npcStyle),
        this.cfg.attrs.winScale || null);
      gain = Math.max(1, Math.round(gain * scale));
      this.addAttrs({ [out.style]: gain });
      if (session.isPalace) { s.palaceWins++; }
      this.push(`论战胜「${session.npc.fullName || session.npc.name}」，${R.ATTR_NAMES[out.style]} +${gain}`);
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
      this.applyStudyGain(this.cfg.attrs.battleDrawGain, `与「${session.npc.fullName || session.npc.name}」平分秋色`, out.style);
      // 文心「曲水流觞」：平局时出战文体额外 +1
      for (const t of s.passive) {
        const ef = t.effect || {};
        if (ef.type === 'draw_bonus') this.applyStudyGain({ [out.style]: Number(ef.value) || 0 }, `「曲水流觞」助益`, out.style);
      }
      this.push(`与「${session.npc.fullName || session.npc.name}」平分秋色`);
    } else {
      s.battle.loss++; s.battle.streak = 0;
      this.addInspiration(this.lateVal(insp.battleLoseExtra ?? -3, insp.battleLoseExtraLate) * mult, '败北');
      /* 败中有得（Round 3 F1 降方差的关键）：
       * Round 2 的战斗是纯正反馈——胜者得属性、败者一无所获。于是「胜→变强→再胜」
       * 复利成链，同一档玩家被劈成「一路碾压」与「一路挨打」两个峰（高手档 500 局里
       * 仍有 9% 零胜、也有 15 胜的），创作力和的档内 σ 高达 12，几乎全部来自这条链。
       * 信噪比诊断（tools/r3_snr.mjs）显示：不斩断它，任何线性计分公式都不可能
       * 同时满足「三档中位」与「sd ≤ 500」（Fisher 上界 2.35 < 需求 2.89）。
       * 故让属性成长与胜负「脱钩」——败者也长，只是长得慢；胜负改由战绩分体现。
       * 文化上亦有出处：败于名家而有所悟，正是「转益多师是汝师」。 */
      this.applyStudyGain(this.cfg.attrs.battleLoseGain, `败于「${session.npc.fullName || session.npc.name}」而有所悟`, out.style);
      this.push(`不敌「${session.npc.fullName || session.npc.name}」`);
    }
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
    for (const t of s.passive) {
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
      this.addAttrs({ [key]: gain });
      schoolState.basicProgress = schoolState.basicProgress || { bi: 0, xue: 0, si: 0 };
      schoolState.basicProgress[key] = (schoolState.basicProgress[key] || 0) + gain;
      const threshold = Number(schoolMech.basicMinThreshold) || 4;
      if (schoolState.basicProgress[key] >= threshold) {
        schoolState.basicProgress[key] -= threshold;
        this.addAttrs({ [key]: Number(schoolMech.basicMinAccelerate) || 1 });
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
    for (const t of s.passive) {
      const ef = t.effect || {};
      if (ef.type === 'insp_battle_recover' && s.inspiration <= (Number(ef.threshold) || 0)) {
        this.triggerTalentLimited(t, `文心·${t.name}`);
      }
    }

    if (schoolMech.type === 'cizong_bi' && out.result !== 'lose') await this.runCizongLightEvent();
    this.ui.onState(s);
  }

  /**
   * 「败中有得 / 平分秋色」的补偿成长。配置缺省即整套关闭。
   * @param {object|null} gain config/attrs.json 的 battleLoseGain / battleDrawGain
   * @param {string} label 飘字与吐司文案
   */
  applyStudyGain(gain, label, style) {
    if (!gain) return;
    const delta = {};
    for (const [k, v] of Object.entries(gain)) {
      // 特殊键 style = 本场出战的文体，让补偿落在玩家正在钻研的那一门上
      const key = k === 'style' ? style : k;
      if (key) delta[key] = (delta[key] || 0) + Number(v);
    }
    // 文心「转益多师」：败中有得 / 平局补偿的属性额外 +value（落在同一门上）
    let extra = 0;
    for (const t of (this.s.passive || [])) {
      const ef = t.effect || {};
      if (ef.type === 'study_bonus') extra += Number(ef.value) || 0;
    }
    if (extra) for (const k of Object.keys(delta)) delta[k] += extra;
    const got = this.addAttrs(delta);
    if (Object.keys(got).length) this.ui.toast(label);
  }

  /**
   * 后期灵感压力：进入会试圈（lap2）与殿试后，改用 *Late 档消耗。
   * 全案 3.3「灵感有真实压力但不残酷」——早期宽松保住新手体验，后期收紧才有封笔风险。
   */
  lateVal(base, late) {
    if (late === undefined || late === null) return Number(base) || 0;
    const isLate = this.s.phase === 'lap2' || this.s.phase === 'palace' || this.s.lap >= 2;
    return Number(isLate ? late : base) || 0;
  }

  /** 完整一场战斗（引擎发起 → UI 六步 → 结算） */
  async doBattle(opts) {
    const s = this.s;
    const insp0 = this.cfg.inspiration;
    this.addInspiration(this.lateVal(insp0.battleCost ?? -2, insp0.battleCostLate), '应战');
    const session = this.createSession(opts);
    const out = await this.ui.runBattle(session);
    await this.settleBattle(session, out);
    return out.result;
  }

  /* ------------------------------------------------------ 殿试 */
  async runPalace() {
    const s = this.s;
    s.phase = 'palace';
    s.reachedEnd = true;
    this.ui.onState(s);

    // 殿试题材与场次取自主考官配置（npcs.json 的 zhukaoguan.themes），不再硬编码，
    // 便于内容方增减殿试科目；场次数与「全胜」阈值同步由题材数量决定。
    const zk = (this.cfg.npcs || []).find(n => n.isFinal) || {};
    const themes = (zk.themes && zk.themes.length ? zk.themes : ['yongwu', 'songbie', 'huaigu']).slice();
    const themeNames = (this.cfg.affinity || {}).themeNames || {};
    const names = themes.map(t => themeNames[t] || t);
    await this.ui.showPalaceIntro(themes, names);

    const n = themes.length;
    // 殿试三场对手：从主考官具名池「按出战权重加权、不重复抽取 n 个」（幂等去重，防止撞同名考官）。
    // weight 省略=默认 100，weight=0=本阶段不出战；池不足 n 时按实际返回，余下场次退化为独立抽取，
    // 池为 0 时退化为档内随机。注意：场次仍以主考官档优先，若主考官档全被 weight=0 关停则退化为档内随机兜底。
    const zkPool = Array.isArray(zk.npcs) ? zk.npcs : null;
    const palaceFoes = [];
    if (zkPool && zkPool.length) {
      const weighted = R.pickNpcByWeightUnique(zkPool, n, this.rand);
      for (let i = 0; i < n; i++) {
        const entry = weighted[i] || zkPool[Math.floor(this.rand() * zkPool.length)];
        palaceFoes.push(this._npcFromPick(zk, entry));
      }
    } else {
      for (let i = 0; i < n; i++) palaceFoes.push(this.pickNpc(true));
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
      await this.doBattle({
        npc: palaceFoes[i], theme: themes[i], isPalace: true,
        label: `殿试第 ${i + 1} 场·${names[i]}`
      });
    }
    if (s.palaceWins >= n) this.ui.toast('殿试全胜——金榜题名！');
    // 照我传灯·跨局传承：殿试结算时尝试点亮下一局传承火种
    this._maybePendReincarnate();
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
        palaceSweep: s.palaceWins >= 3
      }
    }, this.cfg.grades);

    summary.reason = reason;
    summary.reasonText = {
      fengbi: '灵感耗尽，就此封笔——江郎才尽·悔',
      turnlimit: '岁月不居，六十回合已尽',
      palace: '殿试已毕，静候放榜',
      jinbang: '殿试三连捷，金榜题名！'
    }[reason] || '对局结束';
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
    if (summary.reason === 'jinbang' && typeof this.onVictory === 'function') {
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
        palaceSweep: s.palaceWins >= 3,
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
