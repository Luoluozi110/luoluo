/**
 * game.js —— 单人对局引擎（无 DOM）。所有表现通过注入的 ui 适配器完成。
 * 规则依据：全案 3.1–3.8。战斗与评分公式一律调用 rules.js。
 */
import * as R from './rules.js';
import * as Album from './album.js';
import * as Codex from './codex.js';

export const PASSIVE_MAX = 8;
export const ACTIVE_MAX = 4;
export const TURN_LIMIT = 60;

export class Game {
  constructor(cfg, ui, rand = Math.random) {
    this.cfg = cfg;
    this.ui = ui;
    this.rand = rand;
    this.d6 = () => 1 + Math.floor(this.rand() * 6);
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

    // 玩家自起之名：留空（或默认）则叙事维持第二人称「你」；截断到 12 字防误输入
    const playerName = (opts.name != null ? String(opts.name).trim().slice(0, 12) : '') || '';

    this.s = {
      school,
      playerName,
      attrs,
      inspiration: cfg.inspiration.initial,
      inspirationMax: cfg.inspiration.max,
      passive: [], active: [],
      tendencies: {},
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
      loadout: [], titles: [],
      over: false, reachedEnd: false, endReason: '',
      log: []
    };

    const t0 = cfg.talentById.get(school.talent);
    if (t0) this.grantTalent(t0, { silent: true });
    this.push(`选择「${school.name}」，${R.ATTR_NAMES[school.attr]} +${cfg.attrs.schoolBonus ?? 3}`);
    this.applyLoadout(opts.loadout || []);
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
      } else if (r.type === 'title' && r.title) {
        this.s.titles.push(r.title);
      }
      this.push(`图鉴装配「${card.name}」——${card.rewardDesc || ''}`);
    }
  }

  push(text) { this.s.log.push({ turn: this.s.turn, text }); }

  /* ------------------------------------------------------ 派生数据 */
  get lianUnlocked() {
    return this.s.school.attr === 'lian'
      || this.s.attrs.lian >= 8
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
    const pick = pool[Math.floor(this.rand() * pool.length)] || pool[0];
    return this._npcFromPick(tier, pick);
  }

  /** 由「档」对象 + 具名对手，拼装一枚完整 NPC（含档名与 fullName） */
  _npcFromPick(tier, pick) {
    const label = tier.tier || tier.name || '论敌';
    return {
      id: tier.id, tier: label, range: tier.range, desc: tier.desc,
      isFinal: tier.isFinal, battles: tier.battles, themes: tier.themes,
      name: pick.name || label,
      title: pick.title || '',
      style: pick.style || '',
      attrs: pick.attrs || tier.attrs || {},
      fullName: `${label}·${pick.name || label}`
    };
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
    const before = this.s.inspiration;
    this.s.inspiration = R.clamp(before + v, 0, this.s.inspirationMax);
    const real = this.s.inspiration - before;
    if (real) this.ui.floatInspiration(real, reason);
    return real;
  }

  /* -------------------------------------------------------- 文心 */
  async grantTalent(talent, opts = {}) {
    if (!talent) return false;
    const s = this.s;
    const list = talent.kind === 'active' ? s.active : s.passive;
    const max = talent.kind === 'active' ? ACTIVE_MAX : PASSIVE_MAX;
    if (list.some(t => t.id === talent.id)) return false;   // 同名不叠加

    if (!opts.silent) await this.ui.showTalentGain(talent);

    if (list.length >= max) {
      const idx = await this.ui.askReplaceTalent(talent, list.slice());
      if (idx === null || idx === undefined || idx < 0) {
        this.push(`放弃文心「${talent.name}」`);
        return false;
      }
      const removed = list[idx];
      this.revokeTalentFlat(removed);
      list.splice(idx, 1, talent);
      this.push(`以「${talent.name}」替换「${removed.name}」`);
    } else {
      list.push(talent);
      this.push(`获得文心「${talent.name}」`);
    }
    this.applyTalentFlat(talent);
    this.applyTalentInstant(talent);
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

  applyTalentFlat(t) {
    if (t.effect && t.effect.type === 'attr_flat' && t.effect.attrs) this.addAttrs(t.effect.attrs, { raw: true });
  }
  /** 获得时一次性触发的效果（如「胸有成竹」开局灵感 +N），不随替换回滚 */
  applyTalentInstant(t) {
    const ef = t.effect || {};
    if (ef.type === 'start_insp') this.addInspiration(Number(ef.value) || 0, `文心·${t.name}`);
  }
  revokeTalentFlat(t) {
    if (t.effect && t.effect.type === 'attr_flat' && t.effect.attrs) {
      for (const [k, v] of Object.entries(t.effect.attrs)) this.s.attrs[k] = Math.max(0, (this.s.attrs[k] || 0) - (Number(v) || 0));
    }
  }

  /**
   * 倾向门槛：文心带 unlock.tendency 时，需玩家已累积到对应数量的倾向标签才入池。
   * 无 unlock 字段的文心不受影响。
   */
  tendencyOk(t) {
    const u = t.unlock;
    if (!u || !u.tendency) return true;
    return (this.s.tendencies[u.tendency] || 0) >= (Number(u.count) || 1);
  }

  /** 抽一枚玩家尚未持有的文心（受倾向门槛约束；图鉴专属文心不参与随机掉落） */
  randomTalent(kind) {
    const have = new Set([...this.s.passive, ...this.s.active].map(t => t.id));
    const pool = this.cfg.talents.filter(t =>
      !have.has(t.id)
      && (!kind || t.kind === kind)
      && t.source !== 'album'
      && this.tendencyOk(t));
    if (!pool.length) return null;
    return pool[Math.floor(this.rand() * pool.length)];
  }

  /** 记录一枚倾向标签 */
  addTendency(tag) {
    if (!tag) return;
    const s = this.s;
    s.tendencies[tag] = (s.tendencies[tag] || 0) + 1;
    const opened = this.cfg.talents.filter(t =>
      t.unlock && t.unlock.tendency === tag
      && (Number(t.unlock.count) || 1) === s.tendencies[tag]);
    this.ui.toast(opened.length
      ? `倾向「${tag}」×${s.tendencies[tag]}——文心「${opened.map(t => t.name).join('、')}」已入囊中之选`
      : `获得倾向标签「${tag}」×${s.tendencies[tag]}`);
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
    s.turn++;
    if (s.turn > TURN_LIMIT) return this.endGame('turnlimit');

    this.tickSky();
    s.phase = s.lap >= 2 ? 'lap2' : 'lap1';
    this.ui.onState(s);

    const dice = this.d6();
    await this.ui.showDice(dice);
    const arrived = await this.moveSteps(dice);
    if (s.over) return;

    if (arrived === 'palace') { await this.runPalace(); return; }
    await this.resolveCell();
    this.ui.onState(s);
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
      case 'branch_gate': await this.doGate(cell); break;
      case 'landmark': await this.doLandmark(cell); break;
      default: break;
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
    this.ui.toast(`${cell.name}——仄韵格，基本功精进`);
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
        this.addTendency(q.tendency);          // 答对才认这一票倾向
        this.addInspiration(this.cfg.inspiration.quizCorrectInsp ?? 0, '答对'); // 核心技能↔燃料闭环
      } else {
        this.addInspiration(this.cfg.inspiration.quizWrong ?? -2, ans.timedOut ? '超时' : '答错');
        this.push(`答错「${q.id}」`);
      }
      await this.ui.showQuizResult(q, ans, ok);
    } else {
      // 抉择题无对错，但「超时未选」不算作出抉择——不给属性/倾向奖励，并照扣灵感
      if (!ans.timedOut && ans.index >= 0) {
        s.quiz.right++;
        const opt = q.options[ans.index];
        if (opt && opt.attr) this.addAttrs({ [opt.attr]: this.cfg.attrs.quizCorrectGain ?? 2 });
        if (opt) this.addTendency(opt.tendency);
        this.addInspiration(this.cfg.inspiration.quizCorrectInsp ?? 0, '抉择');
        await this.ui.showQuizResult(q, ans, true);
      } else {
        this.addInspiration(this.cfg.inspiration.quizWrong ?? -2, '超时');
        this.push(`抉择题「${q.id}」超时未决`);
        await this.ui.showQuizResult(q, ans, false);
      }
    }
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
      const turns = Number(card.turns) || Number(card.duration) || 3;
      if (exist) exist.left = turns;
      else this.s.sky.push({ card, left: turns });
    }
    await this.ui.showSky(card);
    this.ui.onState(this.s);
  }

  /* ------------------------------------------------------ 岔路格 */
  async doGate(cell) {
    const bid = cell.branch || this.cfg.board.branchGates[String(cell.id)];
    const br = this.cfg.board.branches[bid];
    if (!br) return;
    const cost = this.cfg.inspiration.branchEnterCost ?? 4;
    const go = await this.ui.askBranch(br, cell, cost, this.s.inspiration);
    if (go) {
      if (this.s.inspiration < cost) {
        this.ui.toast('灵感不足，无法踏入支线');
        return;
      }
      this.addInspiration(-cost, '踏入支线');
      this.s.track = 'branch';
      this.s.branchId = bid;
      this.s.branchIndex = -1;
      this.ui.toast(`踏上「${br.landmark}」支线，灵感 -${cost}`);
      this.push(`进入支线 ${br.landmark}`);
    } else {
      this.ui.toast('继续主路，直取功名');
    }
  }

  /* ------------------------------------------------------ 名胜终点 */
  async doLandmark(cell) {
    const br = this.cfg.board.branches[cell.branch];
    const gain = this.cfg.attrs.branchLandmarkGain ?? 5;
    this.addAttrs({ [br.themeAttr]: gain });
    await this.ui.showLandmark(br, gain);
    const t = this.randomTalent();
    if (t) await this.grantTalent(t);
    /* 回主环：岔路格 + branchReturnAdvance 格（默认 1）。
     * Round 3 F2：支线原本要多走 ~1.7 回合才回到 gate+1，四条支线把全程从 34 推到 38。
     * 名胜「近道」让支线只花掉走支线的回合、不再倒扣主环进度。
     *
     * 近道一律不跨越主环起点：起点是 lap++ 与「进入会试圈 / 殿试」的唯一判定点，
     * 直接把 pos 取模写过去会静默吞掉一圈（岔路 57 + 近道 3 → pos 0，多跑 60 格）。 */
    const gate = this.cfg.board.gateOf[br.id] ?? cell.id;
    const adv = Math.max(1, Number(this.cfg.board.branchReturnAdvance) || 1);
    this.s.track = 'main';
    this.s.branchId = null;
    this.s.branchIndex = -1;
    this.s.pos = Math.min(gate + adv, this.cfg.board.ringSize - 1);
    await this.ui.movePiece(this.s);
    this.ui.toast(`领赏毕，返回主环 ${this.currentCell().name}`);
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

    // 图鉴：记录本次邂逅的对手（跨局累计，发现进度持久化）
    if (npc && npc.id && npc.name) Codex.recordFoe(npc.id, npc.name);

    const session = {
      label: opts.label || '挥毫论道',
      npc,
      theme,
      themeName: af.themeNames[theme] || theme,
      playerName: s.playerName || '',
      topic: opts.topic || pickTopic(theme, af, this.rand),
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

    /* ---- 玩家侧修正 ---- */
    const pct = [], flat = [];
    let dicePlus = 0, diceMult = R.BATTLE_COEF.diceMult, diceFixed = null, critMult = 1;

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
      if (ef.type === 'lucky_six' && dice === 6) critMult = Math.max(critMult, Number(ef.mult) || 1);
    }
    for (const t of session.usedActive) {
      const ef = t.effect || {};
      if (ef.type === 'fixed_dice') diceFixed = Number(ef.value) || 0;
      if (ef.type === 'dice_mult') diceMult = Number(ef.value) || R.BATTLE_COEF.diceMult;
      if (ef.type === 'dice_plus') dicePlus += Number(ef.value) || 0;
      if (ef.type === 'crit') { if (this.rand() < (Number(ef.chance) || 0)) critMult = Math.max(critMult, Number(ef.mult) || 1); }
      if (ef.type === 'copy_affinity') session._copyAffinity = true;
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
      if (ef.type === 'lucky_six' && dice === 6) critMult = Math.max(critMult, Number(ef.mult) || 1);
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
    const npcStyle = R.pickNpcStyle(npcAttrs, npcAttrs.lian >= 8);
    const npcManner = R.pickNpcManner(af.matrix, session.manners, session.theme);
    const npcAff = R.affinityValue(af.matrix, npcManner, session.theme);
    const npcDice = this.d6();

    if (session._copyAffinity && npcAff > 0) {
      pct.push({ source: 'copy', label: '夺胎换骨·复制相性', value: npcAff });
    }
    if (s.nextBattlePct) {
      pct.push({ source: 'sky', label: '金榜题名时', value: s.nextBattlePct });
      s.nextBattlePct = 0;
    }

    const selfCalc = R.battleScore({
      attrs: session.playerAttrs, style, dice, dicePlus, diceMult, diceFixed, critMult,
      pctMods: pct, flatMods: flat
    });
    const oppCalc = R.battleScore({
      attrs: npcAttrs, style: npcStyle, dice: npcDice,
      pctMods: npcAff !== 0 ? [{ source: 'affinity', label: `相性·${af.mannerNames[npcManner]}`, value: npcAff }] : []
    });

    const result = R.judgeBattle(selfCalc.total, oppCalc.total, (this.cfg.grades.battle || {}).drawRatio);
    const upset = result === 'win'
      && R.expectedScore(npcAttrs, npcStyle) > R.expectedScore(session.playerAttrs, style);

    return {
      style, manner, dice, selfCalc,
      npcStyle, npcManner, npcDice, oppCalc,
      npcMannerName: af.mannerNames[npcManner], result, upset
    };
  }

  /** 应用战斗奖惩（UI 播完算分动画后调用） */
  async settleBattle(session, out) {
    const s = this.s;
    const insp = this.cfg.inspiration;

    // 图鉴：累计该对手的胜/平/负战绩（跨局留存，供「图鉴阁·对手详情」展示胜率）
    const n0 = session.npc;
    if (n0 && n0.id && n0.name) Codex.recordFoeResult(n0.id, n0.name, out.result);

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
      const talentDropRate = Number((this.cfg.attrs && this.cfg.attrs.talentDropRate) ?? 0.15);
      if (this.rand() < talentDropRate) {
        const t = this.randomTalent();
        if (t) await this.grantTalent(t);
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
    // 殿试三场对手：从主考官具名池「任意抽取三个」且不重复（洗牌后取前 n 个），
    // 而非每场独立随机——独立随机可能撞到同一名考官，观感像「固定/重复」。
    // 池不足 n 时，余下场次退化为独立抽取（含重复兜底）；池为 0 时退化为档内随机。
    const zkPool = Array.isArray(zk.npcs) ? zk.npcs : null;
    const palaceFoes = [];
    if (zkPool && zkPool.length) {
      const shuffled = zkPool.slice();
      for (let k = shuffled.length - 1; k > 0; k--) {
        const j = Math.floor(this.rand() * (k + 1));
        const tmp = shuffled[k]; shuffled[k] = shuffled[j]; shuffled[j] = tmp;
      }
      for (let i = 0; i < n; i++) {
        const entry = shuffled[i] || shuffled[Math.floor(this.rand() * shuffled.length)];
        palaceFoes.push(this._npcFromPick(zk, entry));
      }
    } else {
      for (let i = 0; i < n; i++) palaceFoes.push(this.pickNpc(true));
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
    await this.endGame(s.palaceWins >= n ? 'jinbang' : 'palace');
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
