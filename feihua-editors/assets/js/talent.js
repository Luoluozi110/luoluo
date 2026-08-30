/* =========================================================================
 * talent.js — 文心编辑器模块
 * 数据结构与游戏 config/talents.json 完全兼容：
 *   {id, name, kind:'passive'|'active', school?, text,
 *    effect:{type, ...}, cost?(active), source?}
 * effect.type 由 TALENT_TYPES 统一声明；新版灵感骰效果使用 dice_transform / dice_pattern，
 * 避免继续新增彼此割裂的“固定骰”“覆盖倍率”特例。
 * 依赖 common.js（Common.*）。视觉与题库 / 奇遇编辑器保持同一套墨纸主题。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;
  const ATTR = C.ATTR, ATTR_KEYS = C.ATTR_KEYS;
  const MAX_ATTR_GAIN = 5;
  // 题材下拉（与游戏 config/affinity.json 的 themes 对齐）
  const THEMES = ["yongwu", "songbie", "shanshui", "biansai", "huaigu", "jieling"];
  const THEME_NAME = { yongwu: "咏物", songbie: "送别", shanshui: "山水", biansai: "边塞", huaigu: "怀古", jieling: "节令" };
  const TALENT_TYPES = ["on_win_bonus", "attr_flat", "dice_plus", "crit",
    "copy_affinity", "dice_mult", "palace_pct", "fixed_dice", "planned_dice", "unlock_lian",
    "insp_on_win", "draw_bonus", "insp_on_talent", "extra_dice_pct",
    "dice_transform", "dice_pattern", "extra_dice_chain", "style_switch_pct", "manuscript_pct",
    // —— 以下为「创意文心」新增效果类型 ——
    "style_pct", "theme_pct", "streak_mult", "insp_floor", "lucky_six",
    "comeback", "armory_pct", "study_bonus", "palace_insp", "start_insp", "insp_turn_regen",
    "insp_on_quiz", "insp_battle_recover", "insp_max", "reincarnate",
    "battle_history_pct", "weakness_reward", "seal_signature", "dice_commitment", "restraint_pct"];
  const TALENT_TYPE_LABELS = {
    on_win_bonus: "获胜加成（以某体出战获胜时 +属性）",
    attr_flat: "属性常驻（直接 +属性）",
    dice_plus: "灵感骰 +N",
    crit: "暴击（概率触发得分倍率）",
    copy_affinity: "复制对手相性",
    dice_mult: "普通灵感骰每点乘区",
    palace_pct: "殿试得分百分比",
    fixed_dice: "灵感波动固定值",
    planned_dice: "布局谋篇（指定下一骰点数）",
    unlock_lian: "解锁联圣流（标记）",
    insp_on_win: "获胜时灵感（每场论战取胜 +value 灵感）",
    draw_bonus: "平局时出战文体（平分秋色时出战文体 +value）",
    insp_on_talent: "获得文心时灵感（每得一枚新文心 +value 灵感）",
    extra_dice_pct: "追加骰增益（每枚追加骰 +value%，可降低首次消耗）",
    dice_transform: "骰面化用（抬低点 / 首骰保底 / 最低点化六）",
    dice_pattern: "骰组章法（构型、递升、合点与高风险总点）",
    extra_dice_chain: "一气呵成（付费首续后自动续骰）",
    style_switch_pct: "触类旁通（换文体得分与心得）",
    manuscript_pct: "稿本成章（按当前稿页提高得分）",
    style_pct: "文体偏爱（以某体出战得分常驻 +value%）",
    theme_pct: "题材偏爱（出战某题材得分 +value%）",
    streak_mult: "连捷增益（气势连捷收益 ×(1+value)）",
    insp_floor: "灵感托底（每场结算后灵感不低于 value）",
    lucky_six: "六六大顺（灵感骰掷出 6 时本场得分 ×mult）",
    comeback: "背水一战（灵感 ≤ 阈值时本场得分 +value%）",
    armory_pct: "学富五车（每 step 枚文心，算分属性 +value%）",
    study_bonus: "转益多师（败/平补偿属性额外 +value）",
    palace_insp: "金殿对策（殿试每场开场灵感 +value）",
    start_insp: "胸有成竹（获得时灵感一次性 +value）",
    insp_turn_regen: "持有回灵（每回合开始恢复 +value 灵感）",
    insp_on_quiz: "活水源头（答对/抉择额外恢复，限次）",
    insp_battle_recover: "枯木逢春（低灵感战后恢复，限次）",
    insp_max: "灵感扩容（获得时永久提高本局上限，互斥）",
    reincarnate: "跨局传承（殿试余灵达标，下局继承本局属性、此文心与当前等级）",
    battle_history_pct: "战局历史（依据上一场文体或胜负获得得分）",
    weakness_reward: "破绽回响（首次命中公开破绽获得资源/得分）",
    seal_signature: "封招（压制对手招牌并承受自身折损）",
    dice_commitment: "掷骰承诺（按付费追加骰数量结算）",
    restraint_pct: "坐忘（未发动主动文心时得分）"
  };
  const SCHOOLS = { bowen: "博闻", qishi: "奇士", cizong_bi: "辞宗", shixian: "旧诗仙流", cizong: "旧词宗流", liansheng: "旧联圣流", tongru: "旧通儒流" };
  const STYLE_NAME = { shi: "诗", ci: "词", lian: "联", any: "任意体" };
  // 这些类型在编辑器里以「百分比整数」显示，但引擎存的是小数（如 6 → 0.06）
  const PCT_VALUE_TYPES = ["style_pct", "theme_pct", "streak_mult", "comeback", "armory_pct"];

  const state = { talents: [], editIndex: -1, form: null, _ready: false };
  const officialTalentSeed = () => [...(window.GAME_TALENTS || []), ...(window.GAME_SIDEQUEST_TALENTS || [])];
  const sidequestTalentIds = () => new Set((window.GAME_SIDEQUEST_TALENTS || []).map(t => t && t.id).filter(Boolean));
  const isSidequestTalent = (talent, ids = sidequestTalentIds()) => ids.has(talent && talent.id) || talent && talent.source === "sidequest";

  /* ---------------- 效果（默认 / 归一化） ---------------- */
  function defaultEffect(type) {
    if (type === "on_win_bonus") return { type, style: "shi", value: 1 };
    if (type === "attr_flat") return { type, attrs: {} };
    if (type === "crit") return { type, chance: 0.2, mult: 1.5 };
    if (type === "copy_affinity" || type === "unlock_lian") return { type };
    if (type === "style_pct") return { type, style: "shi", value: 0.05 };
    if (type === "theme_pct") return { type, theme: "yongwu", value: 0.08 };
    if (type === "streak_mult") return { type, value: 0.4 };
    if (type === "insp_floor") return { type, value: 10 };
    if (type === "lucky_six") return { type, mult: 1.3 };
    if (type === "comeback") return { type, value: 0.12, threshold: 12 };
    if (type === "armory_pct") return { type, step: 3, value: 0.04 };
    if (type === "study_bonus") return { type, value: 1 };
    if (type === "palace_insp") return { type, value: 3 };
    if (type === "start_insp") return { type, value: 6 };
    if (type === "insp_turn_regen") return { type, value: 1 };
    if (type === "insp_on_quiz") return { type, value: 1, maxTriggers: 4 };
    if (type === "insp_battle_recover") return { type, value: 2, threshold: 14, maxTriggers: 3 };
    if (type === "insp_max") return { type, value: 6, group: "inspiration_capacity" };
    if (type === "reincarnate") return { type, inspThreshold: 40, attrRatio: 0.8 };
    if (type === "planned_dice") return { type, baseCost: 5, costStep: 2, maxValue: 6 };
    if (type === "extra_dice_pct") return { type, value: 0.05, firstCostDiscount: 0 };
    if (type === "extra_dice_chain") return { type, compare: "not_lower", value: 0.04 };
    if (type === "dice_mult") return { type, value: 5 };
    if (type === "dice_transform") return { type, mode: "low_lift", threshold: 2, value: 1, count: 1 };
    if (type === "dice_pattern") return { type, pattern: "six", value: 0.05 };
    if (type === "style_switch_pct") return { type, value: 0.08, insight: 1 };
    if (type === "manuscript_pct") return { type, step: 2, value: 0.02, cap: 0.1 };
    return { type, value: 1 }; // dice_plus / fixed_dice / palace_pct / insp_on_win / draw_bonus / insp_on_talent
  }
  function cleanAttrs(a) {
    const out = {}; a = a || {};
    for (const k of ATTR_KEYS) { const v = Number(a[k]); if (v) out[k] = v; }
    return out;
  }
  function normalizeEffect(eff) {
    eff = eff || {};
    const type = typeof eff.type === "string" && eff.type.trim() ? eff.type.trim() : "on_win_bonus";
    // 保留当前编辑器尚未提供表单的前向兼容字段（如 copy_affinity.ratio）。
    // 已知字段仍由下方分支归一化，避免云端拉取时静默删掉运行时机制参数。
    const out = eff && typeof eff === "object" && !Array.isArray(eff) ? JSON.parse(JSON.stringify(eff)) : {};
    out.type = type;
    if (type === "on_win_bonus") { out.style = ["shi", "ci", "lian", "any"].includes(eff.style) ? eff.style : "shi"; out.value = Number(eff.value) || 0; }
    else if (type === "attr_flat") { out.attrs = cleanAttrs(eff.attrs); }
    else if (type === "crit") { out.chance = Number(eff.chance) || 0; out.mult = Number(eff.mult) || 0; }
    else if (type === "palace_pct") { out.value = Number(eff.value) || 0; }
    else if (type === "insp_on_win" || type === "draw_bonus" || type === "insp_on_talent") { out.value = Number(eff.value) || 0; }
    else if (type === "battle_history_pct") {
      out.condition = ["repeat_style", "switch_style", "previous_nonwin"].includes(eff.condition) ? eff.condition : "previous_nonwin";
      if (eff.value != null) out.value = Number(eff.value) || 0;
      else delete out.value;
      if (eff.previousWinBonus != null) out.previousWinBonus = Number(eff.previousWinBonus) || 0;
      if (eff.previousNonWinBonus != null) out.previousNonWinBonus = Number(eff.previousNonWinBonus) || 0;
      if (eff.stackGroup) out.stackGroup = String(eff.stackGroup);
    }
    else if (type === "weakness_reward") {
      out.value = Number(eff.value) || 0;
      if (eff.reward && typeof eff.reward === "object") out.reward = { type: String(eff.reward.type || "inspiration"), value: Number(eff.reward.value) || 0, perMatch: eff.reward.perMatch !== false };
    }
    else if (type === "seal_signature") { out.penalty = Number(eff.penalty) || 0; }
    else if (type === "dice_commitment") {
      out.condition = eff.condition === "exactly_one_paid" ? "exactly_one_paid" : "none_paid";
      out.value = Number(eff.value) || 0;
      if (eff.firstCostDiscount != null) out.firstCostDiscount = Math.max(0, Number(eff.firstCostDiscount) || 0);
    }
    else if (type === "restraint_pct") { out.value = Number(eff.value) || 0; }
    else if (type === "style_pct") { out.style = ["shi", "ci", "lian", "any"].includes(eff.style) ? eff.style : "shi"; out.value = Number(eff.value) || 0; }
    else if (type === "theme_pct") { out.theme = THEMES.includes(eff.theme) ? eff.theme : "yongwu"; out.value = Number(eff.value) || 0; }
    else if (type === "streak_mult" || type === "insp_floor" || type === "study_bonus" || type === "palace_insp" || type === "start_insp" || type === "insp_turn_regen") { out.value = Number(eff.value) || 0; }
    else if (type === "insp_on_quiz") { out.value = Number(eff.value) || 0; out.maxTriggers = Math.max(1, Number(eff.maxTriggers) || 1); }
    else if (type === "insp_battle_recover") { out.value = Number(eff.value) || 0; out.threshold = Math.max(0, Number(eff.threshold) || 0); out.maxTriggers = Math.max(1, Number(eff.maxTriggers) || 1); }
    else if (type === "insp_max") { out.value = Number(eff.value) || 0; out.group = String(eff.group || "inspiration_capacity"); }
    else if (type === "reincarnate") { out.inspThreshold = Math.max(0, Number(eff.inspThreshold) || 0); out.attrRatio = Math.max(0, Math.min(1, Number(eff.attrRatio) || 0)); }
    else if (type === "planned_dice") { out.baseCost = Math.max(1, Number(eff.baseCost) || 5); out.costStep = Math.max(0, Number(eff.costStep) || 2); out.maxValue = Math.max(1, Math.min(6, Number(eff.maxValue) || 6)); }
    else if (type === "extra_dice_pct") { out.value = Number(eff.value) || 0; out.firstCostDiscount = Math.max(0, Number(eff.firstCostDiscount) || 0); }
    else if (type === "extra_dice_chain") { out.compare = eff.compare === "not_lower" ? "not_lower" : "not_lower"; out.value = Number(eff.value) || 0; }
    else if (type === "dice_transform") {
      out.mode = ["low_lift", "first_floor", "lowest_to", "polarize"].includes(eff.mode) ? eff.mode : "low_lift";
      if (out.mode === "low_lift") { out.threshold = Math.max(1, Math.min(6, Number(eff.threshold) || 2)); out.value = Math.max(1, Number(eff.value) || 1); out.count = Math.max(1, Number(eff.count) || 1); }
      else if (out.mode === "first_floor") {
        out.floor = Math.max(1, Math.min(6, Number(eff.floor) || 4));
        if (eff.value != null) out.value = Number(eff.value) || 0;
      }
      else if (out.mode === "polarize") {
        out.minDice = Math.max(2, Number(eff.minDice) || 2);
        out.value = Number(eff.value) || 0;
      }
      else { out.maxPip = Math.max(1, Math.min(6, Number(eff.maxPip) || 3)); out.target = Math.max(1, Math.min(6, Number(eff.target) || 6)); }
      if (eff.noExtraDice != null) out.noExtraDice = !!eff.noExtraDice;
    }
    else if (type === "dice_pattern") {
      out.pattern = ["six", "distinct", "all_distinct", "low_then_high", "ascending", "first_last_equal", "low_and_high", "single", "all_high", "pair", "total", "exact_total", "total_multiple", "total_tiers", "extremes"].includes(eff.pattern) ? eff.pattern : "six";
      if (eff.value != null) out.value = Number(eff.value) || 0;
      else delete out.value;
      if (out.pattern === "first_last_equal") { out.minDice = Math.max(2, Number(eff.minDice) || 2); out.firstCostDiscount = Math.max(0, Number(eff.firstCostDiscount) || 0); }
      if (out.pattern === "low_and_high") { out.lowMax = Math.max(1, Math.min(6, Number(eff.lowMax) || 2)); out.highMin = Math.max(1, Math.min(6, Number(eff.highMin) || 5)); }
      if (out.pattern === "all_high") out.minPip = Math.max(1, Math.min(6, Number(eff.minPip) || 4));
      if (out.pattern === "total") out.threshold = Math.max(1, Number(eff.threshold) || 12);
      if (out.pattern === "distinct") out.firstCostDiscount = Math.max(0, Number(eff.firstCostDiscount) || 0);
      if (out.pattern === "all_distinct") { out.minDice = Math.max(2, Number(eff.minDice) || 3); out.firstCostDiscount = Math.max(0, Number(eff.firstCostDiscount) || 0); }
      if (out.pattern === "low_then_high") { out.lowMax = Math.max(1, Math.min(6, Number(eff.lowMax) || 2)); out.nextHighMin = Math.max(1, Math.min(6, Number(eff.nextHighMin) || 5)); out.conditionalFirstCostDiscount = Math.max(0, Number(eff.conditionalFirstCostDiscount) || 0); }
      if (out.pattern === "ascending") { out.minDice = Math.max(2, Number(eff.minDice) || 2); out.perStepValue = Number(eff.perStepValue) || 0; out.fullDice = Math.max(out.minDice, Number(eff.fullDice) || 3); out.fullValue = Number(eff.fullValue) || 0; out.firstCostDiscount = Math.max(0, Number(eff.firstCostDiscount) || 0); if (eff.fullReward && ["insight", "fragment", "page", "inspiration"].includes(eff.fullReward.type)) out.fullReward = { type: eff.fullReward.type, value: Math.max(0, Number(eff.fullReward.value) || 0), perMatch: false }; }
      if (out.pattern === "exact_total") { out.diceCount = Math.max(2, Number(eff.diceCount) || 2); out.total = Math.max(2, Number(eff.total) || 7); out.firstExtraFree = !!eff.firstExtraFree; }
      if (out.pattern === "total_multiple") out.multiple = Math.max(1, Number(eff.multiple) || 7);
      if (out.pattern === "total_tiers") out.tiers = (Array.isArray(eff.tiers) ? eff.tiers : []).map(x => ({ threshold: Math.max(1, Number(x.threshold) || 12), value: Number(x.value) || 0, reward: x.reward && ["insight", "fragment", "page", "inspiration"].includes(x.reward.type) ? { type: x.reward.type, value: Math.max(0, Number(x.reward.value) || 0), perMatch: false } : null })).filter(x => x.value || x.reward);
      if (out.pattern === "extremes") { out.highMin = Math.max(1, Math.min(6, Number(eff.highMin) || 5)); out.highValue = Number(eff.highValue) || 0; out.lowMax = Math.max(1, Math.min(6, Number(eff.lowMax) || 2)); out.lowValue = Number(eff.lowValue) || 0; }
      if (eff.reward && ["insight", "fragment", "page", "inspiration"].includes(eff.reward.type)) out.reward = { type: eff.reward.type, value: Math.max(0, Number(eff.reward.value) || 0), perMatch: eff.reward.perMatch !== false };
    }
    else if (type === "style_switch_pct") { out.value = Number(eff.value) || 0; out.insight = Math.max(0, Number(eff.insight) || 0); }
    else if (type === "manuscript_pct") { out.step = Math.max(1, Number(eff.step) || 2); out.value = Number(eff.value) || 0; out.cap = Math.max(0, Number(eff.cap) || 0); }
    else if (type === "lucky_six") { out.mult = Number(eff.mult) || 0; }
    else if (type === "comeback") { out.value = Number(eff.value) || 0; out.threshold = Number(eff.threshold) || 12; }
    else if (type === "armory_pct") { out.step = Math.max(1, Number(eff.step) || 3); out.value = Number(eff.value) || 0; }
    else if (type === "copy_affinity" || type === "unlock_lian") { /* 无额外字段 */ }
    else if (["dice_plus", "fixed_dice", "dice_mult"].includes(type)) { out.value = Number(eff.value) || 0; }
    return out;
  }

  /* ---------------- 持久化 ---------------- */
  function save() {
    C.store("talents", state.talents);
    const t = new Date();
    C.setStatus("tal", "已自动保存 " + t.toLocaleTimeString("zh-CN", { hour12: false }));
  }
  /**
   * 已使用过编辑器的浏览器会优先读取 localStorage；默认仅补齐缺失的官方条目，
   * 不覆盖同 ID 的本地修改。需要更新官方机制时，由「同步官方文心」显式覆盖。
   */
  function upgradeSeedById() {
    const raw = window.GAME_TALENT_UPGRADE;
    return { ...(raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {}), ...(window.GAME_SIDEQUEST_TALENT_UPGRADE || {}) };
  }
  // 将游戏独立 talent-upgrade.json 合并进编辑器文心数据。
  // 只补缺失 upgrade，已有本地升级配置一律保留，避免覆盖用户编辑。
  function backfillOfficialUpgrades() {
    const seed = upgradeSeedById();
    let changed = 0;
    for (const t of state.talents) {
      if (t.upgrade || !seed[t.id]) continue;
      const raw = seed[t.id];
      const levels = Array.isArray(raw.levels) ? raw.levels.slice(1) : [];
      const baseLevel = Array.isArray(raw.levels) && raw.levels[0] ? raw.levels[0] : null;
      t.upgrade = normalizeUpgrade({ ...raw, levels, baseLevel }, t);
      t._embeddedUpgrade = false;
      changed++;
    }
    return changed;
  }
  function backfillOfficialTalents() {
    const seed = officialTalentSeed();
    const byId = new Map(state.talents.map((t, i) => [t.id, i]));
    let changed = 0;
    for (const src of seed) {
      if (!src || !src.id) continue;
      const idx = byId.get(src.id);
      if (idx == null) {
        state.talents.push(normalize(src));
        byId.set(src.id, state.talents.length - 1);
        changed++;
        continue;
      }
      const current = state.talents[idx];
      // 旧缓存可能已有同 ID 空壳：只补缺失字段，绝不覆盖用户已填写的内容。
      let patched = false;
      for (const key of ["name", "text", "source", "routeId", "axis", "quality"]) {
        if (!current[key] && src[key]) { current[key] = typeof src[key] === "string" ? String(src[key]).trim() : src[key]; patched = true; }
      }
      if (current.kind !== src.kind && !current.kind) { current.kind = src.kind; patched = true; }
      if ((!current.effect || !current.effect.type) && src.effect) { current.effect = normalizeEffect(src.effect); patched = true; }
      if (current.kind === "active" && !current.cost && src.cost) { current.cost = Math.max(1, Number(src.cost) || 1); patched = true; }
      if (patched) changed++;
    }
    return changed;
  }

  /**
   * 显式同步官方文心：替换官方种子中已有 ID 的本地副本，保留用户自建 ID。
   * 同步基础效果和升级表，避免“文心已新、升级仍旧”的配置分裂。
   */
  function syncOfficialTalents() {
    const seed = officialTalentSeed();
    if (!seed.length) { C.toast("官方文心种子尚未载入，请刷新后重试"); return; }
    const message = "将以当前线上官方文心覆盖同 ID 的本地副本，并同步升级表。\n自建文心不会删除；本地修改过的官方文心会被替换。\n\n建议先用“导出 talents.json”备份。是否继续？";
    if (!window.confirm(message)) return;
    const official = new Map(seed.filter(t => t && t.id).map(t => [t.id, t]));
    let updated = 0, added = 0;
    const next = [];
    for (const t of state.talents) {
      const src = official.get(t.id);
      if (!src) { next.push(t); continue; }
      next.push(normalize(src));
      updated++;
      official.delete(t.id);
    }
    for (const src of official.values()) { next.push(normalize(src)); added++; }
    state.talents = next;
    const upgrades = upgradeSeedById();
    for (const t of state.talents) {
      if (!upgrades[t.id]) continue;
      t.upgrade = normalizeUpgrade(upgrades[t.id], t);
    }
    C.store("talents", state.talents);
    C.store("talentOfficialSyncAt", new Date().toISOString());
    C.setStatus("tal", `已同步官方文心：更新 ${updated}，补齐 ${added}`);
    const dl = document.getElementById("talentList");
    if (dl) dl.innerHTML = state.talents.map(t => `<option value="${t.id}">${C.esc(t.name)}</option>`).join("");
    renderList();
    C.toast(`已同步官方文心：更新 ${updated}，新增 ${added}；自建文心已保留`);
  }

  // 这两枚官方文心曾使用一次性灵感效果。仅迁移精确的旧效果类型，
  // 因而不会覆盖用户后来手工改出的其他文心方案。
  function migrateOfficialInspirationTalents() {
    const seed = officialTalentSeed();
    const legacyTypes = { T019: "insp_on_talent", T029: "start_insp" };
    let changed = 0;
    for (const [id, legacyType] of Object.entries(legacyTypes)) {
      const current = state.talents.find(t => t.id === id);
      const official = seed.find(t => t && t.id === id);
      if (!current || !official || !current.effect || current.effect.type !== legacyType) continue;
      current.text = official.text;
      current.effect = normalizeEffect(official.effect);
      if (id === "T029" && current.upgrade) {
        const officialUpgrade = upgradeSeedById()[id];
        if (officialUpgrade) current.upgrade = normalizeUpgrade(officialUpgrade, official);
      }
      changed++;
    }
    return changed;
  }

  function loadData() {
    const raw = C.load("talents", null);
    if (raw && raw.length) {
      state.talents = raw.map(normalize);
      // 旧 localStorage 非破坏式补齐新发布的官方文心及升级配置，避免种子更新被永久遮蔽。
      const changed = backfillOfficialTalents() + backfillOfficialUpgrades() + migrateOfficialInspirationTalents();
      if (changed) C.store("talents", state.talents);
    } else {
      state.talents = officialTalentSeed().map(normalize);
      backfillOfficialUpgrades();
      C.store("talents", state.talents);
    }
  }

  /* ---------------- 规范化 ---------------- */
  function normalize(t) {
    t = t || {};
    const out = {
      id: String(t.id || "").trim(),
      name: String(t.name || "").trim(),
      kind: t.kind === "active" ? "active" : "passive",
      text: String(t.text || "").trim(),
      effect: normalizeEffect(t.effect)
    };
    if (t.school) out.school = t.school;
    if (out.kind === "active") out.cost = Math.max(1, Number(t.cost) || 1);
    if (t.source) out.source = String(t.source).trim();
    for (const key of ["routeId", "axis", "quality"]) {
      if (t[key] != null && String(t[key]).trim()) out[key] = String(t[key]).trim();
    }
    if (t.acquire && typeof t.acquire === "object") out.acquire = JSON.parse(JSON.stringify(t.acquire));
    if (t.acquireText) out.acquireText = String(t.acquireText).trim();
    if (t.upgrade && typeof t.upgrade === "object") {
      out.upgrade = normalizeUpgrade(t.upgrade, t);
      out._embeddedUpgrade = t._embeddedUpgrade !== false;
    }
    return out;
  }

  /* 升级配置归一化。levels 仅存 Lv2..LvMax（Lv1 恒等于文心基础 effect，由导出时回填，避免与游戏 leveledTalent 覆盖陷阱脱节）。
     maxLevel 由品质决定（也可手工覆盖 1..6），upCost 长度补齐/截断到 maxLevel-1。 */
  function normalizeUpgrade(up, base) {
    up = up || {};
    const quality = (C.QUALITY && C.QUALITY[up.quality]) ? up.quality : "common";
    const maxLevel = Math.max(1, Math.min(6, Number(up.maxLevel) || (C.QUALITY_MAX[quality] || 3)));
    const defCurve = C.QUALITY_UPCOST[quality] || [6, 10];
    let upCost = Array.isArray(up.upCost) ? up.upCost.map(Number) : [];
    while (upCost.length < maxLevel - 1) upCost.push(defCurve[upCost.length] != null ? defCurve[upCost.length] : (upCost.length ? upCost[upCost.length - 1] : 6));
    while (upCost.length > maxLevel - 1) upCost.pop();
    const rawLevels = Array.isArray(up.levels) ? up.levels.slice() : [];
    let baseLevel = up.baseLevel && typeof up.baseLevel === "object" ? JSON.parse(JSON.stringify(up.baseLevel)) : null;
    if (!baseLevel && rawLevels.length >= maxLevel) baseLevel = rawLevels.shift();
    if (baseLevel) {
      baseLevel.effect = normalizeEffect(baseLevel.effect || base.effect);
      if (base.kind === "active" && baseLevel.cost != null) baseLevel.cost = Math.max(1, Number(baseLevel.cost) || 1);
      else delete baseLevel.cost;
      delete baseLevel.style;
    }
    let levels = rawLevels.map(l => ({
      effect: normalizeEffect(l.effect),
      cost: (l.cost != null) ? Math.max(1, Number(l.cost) || 1) : undefined
    }));
    while (levels.length < maxLevel - 1) levels.push({ effect: JSON.parse(JSON.stringify(base.effect || { type: "on_win_bonus" })), cost: (base.kind === "active" && base.cost != null) ? base.cost : undefined });
    while (levels.length > maxLevel - 1) levels.pop();
    // 逐级视觉样式：索引 j 对应视觉层级 Lv(j+1)，长度恒等于 maxLevel（Lv1..LvMax 各一份）。
    let levelStyles = Array.isArray(up.levelStyles) ? up.levelStyles.map(normalizeStyle) : [];
    while (levelStyles.length < maxLevel) levelStyles.push(defaultStyle());
    while (levelStyles.length > maxLevel) levelStyles.pop();
    return { quality, maxLevel, upCost, levels, levelStyles, baseLevel };
  }

  /* ---------------- 逐级视觉样式（字体/字号/颜色/行距/对齐/缩进/段间距） ---------------- */
  const ALIGN_VALUES = ["left", "center", "right", "justify"];
  const FONT_FAMILIES = [
    { v: "", n: "（默认）" },
    { v: "SimSun, serif", n: "宋体" },
    { v: "KaiTi, serif", n: "楷体" },
    { v: "FangSong, serif", n: "仿宋" },
    { v: "SimHei, sans-serif", n: "黑体" },
    { v: "Microsoft YaHei, sans-serif", n: "微软雅黑" },
    { v: "DengXian, sans-serif", n: "等线" },
    { v: "STKaiti, serif", n: "华文楷体" }
  ];
  function defaultStyle() {
    return { fontFamily: "", fontSize: 0, color: "", lineHeight: 0, textAlign: "", textIndent: 0, marginBottom: 0 };
  }
  function normalizeStyle(s) {
    s = s || {};
    return {
      fontFamily: typeof s.fontFamily === "string" ? s.fontFamily : "",
      fontSize: Math.max(0, Number(s.fontSize) || 0),
      color: typeof s.color === "string" ? s.color : "",
      lineHeight: Math.max(0, Number(s.lineHeight) || 0),
      textAlign: ALIGN_VALUES.includes(s.textAlign) ? s.textAlign : "",
      textIndent: Math.max(0, Number(s.textIndent) || 0),
      marginBottom: Math.max(0, Number(s.marginBottom) || 0)
    };
  }
  // 由 style 对象生成可注入元素 style 的 cssText（仅输出非空字段）
  function buildCss(s) {
    s = s || {};
    const cs = [];
    if (s.fontFamily) cs.push("font-family:" + s.fontFamily);
    if (s.fontSize) cs.push("font-size:" + s.fontSize + "px");
    if (s.color) cs.push("color:" + s.color);
    if (s.lineHeight) cs.push("line-height:" + s.lineHeight);
    if (s.textAlign) cs.push("text-align:" + s.textAlign);
    if (s.textIndent) cs.push("text-indent:" + s.textIndent + "px");
    if (s.marginBottom) cs.push("margin-bottom:" + s.marginBottom + "px");
    return cs.join(";");
  }
  // 每级样式控件（data-lvl=j 绑定到 levelStyles[j]）
  function styleControls(j, st) {
    const fontOpts = FONT_FAMILIES.map(f => `<option value="${f.v}" ${f.v === st.fontFamily ? "selected" : ""}>${f.n}</option>`).join("");
    const alignOpts = ALIGN_VALUES.map(a => `<option value="${a}" ${a === st.textAlign ? "selected" : ""}>${a === "left" ? "左对齐" : a === "center" ? "居中" : a === "right" ? "右对齐" : "两端对齐"}</option>`).join("");
    return `<div class="style-grid">
      <div class="style-ctrl"><label>字体</label><select class="tal-s-font" data-lvl="${j}">${fontOpts}</select></div>
      <div class="style-ctrl"><label>字号(px)</label><input type="number" class="tal-s-size" data-lvl="${j}" value="${st.fontSize || ""}" min="0" step="1"/></div>
      <div class="style-ctrl"><label>颜色</label><input type="color" class="tal-s-color" data-lvl="${j}" value="${st.color || "#000000"}"/></div>
      <div class="style-ctrl"><label>行距</label><input type="number" class="tal-s-lh" data-lvl="${j}" value="${st.lineHeight || ""}" min="0" step="0.1"/></div>
      <div class="style-ctrl"><label>对齐</label><select class="tal-s-align" data-lvl="${j}">${alignOpts}</select></div>
      <div class="style-ctrl"><label>首行缩进(px)</label><input type="number" class="tal-s-indent" data-lvl="${j}" value="${st.textIndent || ""}" min="0" step="1"/></div>
      <div class="style-ctrl"><label>段间距(px)</label><input type="number" class="tal-s-margin" data-lvl="${j}" value="${st.marginBottom || ""}" min="0" step="1"/></div>
    </div>`;
  }

  /* ---------------- 校验（对齐 validate.py check_talents） ---------------- */
  function validate(t, all, selfIndex) {
    const errors = [], w = "文心" + (t.id ? " " + t.id : "");
    if (!t.id) errors.push("文心 ID 不能为空");
    else if (!/^[A-Za-z0-9_\-]+$/.test(t.id)) errors.push("ID 只能含字母、数字、下划线和连字符");
    else { const dup = all.findIndex((x, i) => x.id === t.id && i !== selfIndex); if (dup >= 0) errors.push("ID 与第 " + (dup + 1) + " 条重复"); }
    if (!t.name) errors.push("文心名称不能为空");
    if (t.kind !== "passive" && t.kind !== "active") errors.push("类型非法：" + t.kind);
    if (!t.text) errors.push("文心描述不能为空");
    if (!t.effect || !t.effect.type) errors.push("效果缺少 type");
    else if (!TALENT_TYPES.includes(t.effect.type)) errors.push("effect.type 非法：" + t.effect.type);
    else if (t.effect.type === "attr_flat") {
      const a = t.effect.attrs || {};
      if (!Object.keys(a).length) errors.push("attr_flat 必须提供 attrs");
      else for (const k of Object.keys(a)) {
        if (!ATTR_KEYS.includes(k)) errors.push("attrs 属性名非法：" + k);
        else if (Number(a[k]) > MAX_ATTR_GAIN) errors.push("属性 " + ATTR[k] + " +" + a[k] + " 超过红线 +" + MAX_ATTR_GAIN);
      }
    }
    else if (["insp_on_win", "draw_bonus", "insp_on_talent"].includes(t.effect.type)) {
      if (!(Number(t.effect.value) > 0)) errors.push(t.effect.type + " 的 value 须 > 0");
    }
    else if (["style_pct", "theme_pct", "streak_mult", "insp_floor", "study_bonus", "palace_insp", "start_insp", "insp_turn_regen", "insp_on_quiz", "insp_battle_recover", "insp_max"].includes(t.effect.type)) {
      if (!(Number(t.effect.value) > 0)) errors.push(t.effect.type + " 的 value 须 > 0");
      if (["insp_on_quiz", "insp_battle_recover"].includes(t.effect.type) && !(Number(t.effect.maxTriggers) >= 1)) errors.push(t.effect.type + " 的 maxTriggers 须 ≥ 1");
      if (t.effect.type === "insp_battle_recover" && !(Number(t.effect.threshold) >= 0)) errors.push("insp_battle_recover 的 threshold 须 ≥ 0");
      if (t.effect.type === "style_pct" && !["shi", "ci", "lian", "any"].includes(t.effect.style)) errors.push("style_pct 的 style 非法");
      if (t.effect.type === "theme_pct" && !THEMES.includes(t.effect.theme)) errors.push("theme_pct 的 theme 非法");
    }
    else if (t.effect.type === "reincarnate") {
      if (!(Number(t.effect.inspThreshold) >= 0)) errors.push("reincarnate 的 inspThreshold 须 ≥ 0");
      if (!(Number(t.effect.attrRatio) > 0 && Number(t.effect.attrRatio) <= 1)) errors.push("reincarnate 的 attrRatio 须 ∈ (0,1]");
    }
    else if (t.effect.type === "lucky_six") {
      if (!(Number(t.effect.mult) > 1)) errors.push("lucky_six 的 mult 须 > 1");
    }
    else if (t.effect.type === "comeback") {
      if (!(Number(t.effect.value) > 0)) errors.push("comeback 的 value 须 > 0");
      if (!(Number(t.effect.threshold) > 0)) errors.push("comeback 的 threshold 须 > 0");
    }
    else if (t.effect.type === "armory_pct") {
      if (!(Number(t.effect.step) >= 1)) errors.push("armory_pct 的 step 须 ≥ 1");
      if (!(Number(t.effect.value) > 0)) errors.push("armory_pct 的 value 须 > 0");
    }
    else if (t.effect.type === "extra_dice_pct") {
      if (!(Number(t.effect.value) >= 0)) errors.push("extra_dice_pct 的 value 须 ≥ 0");
      if (!(Number(t.effect.firstCostDiscount) >= 0)) errors.push("extra_dice_pct 的首次减费须 ≥ 0");
    }
    else if (t.effect.type === "extra_dice_chain") {
      if (!(Number(t.effect.value) >= 0)) errors.push("extra_dice_chain 的续章得分须 ≥ 0");
    }
    else if (t.effect.type === "dice_transform") {
      if (!["low_lift", "first_floor", "lowest_to", "polarize"].includes(t.effect.mode)) errors.push("dice_transform 的 mode 非法");
    }
    else if (t.effect.type === "dice_pattern") {
      if (!["six", "distinct", "all_distinct", "low_then_high", "ascending", "first_last_equal", "low_and_high", "single", "all_high", "pair", "total", "exact_total", "total_multiple", "total_tiers", "extremes"].includes(t.effect.pattern)) errors.push("dice_pattern 的 pattern 非法");
      if (t.effect.reward && !["insight", "fragment", "page", "inspiration"].includes(t.effect.reward.type)) errors.push("dice_pattern 的 reward.type 非法");
      if (t.effect.fullReward && !["insight", "fragment", "page", "inspiration"].includes(t.effect.fullReward.type)) errors.push("dice_pattern 的 fullReward.type 非法");
    }
    else if (t.effect.type === "style_switch_pct") {
      if (!(Number(t.effect.value) >= 0 && Number(t.effect.insight) >= 0)) errors.push("style_switch_pct 数值须 ≥ 0");
    }
    else if (t.effect.type === "manuscript_pct") {
      if (!(Number(t.effect.step) >= 1 && Number(t.effect.value) >= 0 && Number(t.effect.cap) >= 0)) errors.push("manuscript_pct 参数须为非负且 step ≥ 1");
    }
    if (t.kind === "active" && (t.cost == null)) errors.push("主动文心缺少 cost");
    /* 升级配置校验：quality 合法、upCost 与逐级 levels 长度均 = maxLevel-1；Lv1 恒取基础 effect（导出时回填），故只校验逐级 type 合法。 */
    if (t.upgrade && typeof t.upgrade === "object") {
      const u = t.upgrade;
      if (!(C.QUALITY && C.QUALITY[u.quality])) errors.push("升级品质非法：" + u.quality);
      if (!(u.maxLevel >= 1 && u.maxLevel <= 6)) errors.push("升级 maxLevel 须 1..6（当前 " + u.maxLevel + "）");
      if (!Array.isArray(u.upCost) || u.upCost.length !== u.maxLevel - 1) errors.push("升级 upCost 项数须 = maxLevel-1（" + (u.maxLevel - 1) + "，当前 " + (Array.isArray(u.upCost) ? u.upCost.length : 0) + "）");
      if (!Array.isArray(u.levels) || u.levels.length !== u.maxLevel - 1) errors.push("升级逐级效果数须 = maxLevel-1（" + (u.maxLevel - 1) + "，当前 " + (Array.isArray(u.levels) ? u.levels.length : 0) + "）");
      (u.levels || []).forEach((lv, i) => {
        if (!lv || !lv.effect || !TALENT_TYPES.includes(lv.effect.type)) errors.push("Lv" + (i + 2) + " 效果类型非法：" + (lv && lv.effect && lv.effect.type));
      });
    }
    return { ok: errors.length === 0, errors };
  }
  function validateAll() {
    return state.talents.map((t, i) => ({ i, ...validate(t, state.talents, i) })).filter(r => !r.ok);
  }

  /* ---------------- 效果文本 ---------------- */
  function dicePatternText(eff) {
    const pct = n => Math.round((Number(n) || 0) * 100) + "%";
    let base = "";
    if (eff.pattern === "six") base = (eff.reward && eff.reward.perMatch === false ? "本场首次出现最终六点骰时" : "每枚最终六点骰") + "：得分 +" + pct(eff.value);
    else if (eff.pattern === "distinct") base = "每多一种不同点数：得分 +" + pct(eff.value) + (eff.firstCostDiscount ? "；首枚追加少耗 " + eff.firstCostDiscount : "");
    else if (eff.pattern === "all_distinct") base = (eff.minDice || 3) + " 枚骰点各不相同：得分 +" + pct(eff.value) + (eff.firstCostDiscount ? "；首枚续掷少耗 " + eff.firstCostDiscount : "");
    else if (eff.pattern === "low_then_high") base = "首骰 ≤" + (eff.lowMax || 2) + " 后续骰 ≥" + (eff.nextHighMin || 5) + "：得分 +" + pct(eff.value) + "；低开时首枚续掷少耗 " + (eff.conditionalFirstCostDiscount || 0);
    else if (eff.pattern === "first_last_equal") base = "至少 " + (eff.minDice || 2) + " 枚骰且首尾同点：得分 +" + pct(eff.value) + (eff.firstCostDiscount ? "；首枚追加少耗 " + eff.firstCostDiscount : "");
    else if (eff.pattern === "low_and_high") base = "骰组同时有 ≤" + (eff.lowMax || 2) + " 与 ≥" + (eff.highMin || 5) + " 点：得分 +" + pct(eff.value);
    else if (eff.pattern === "ascending") base = "续骰逐枚递升：每次 +" + pct(eff.perStepValue) + "；" + (eff.fullDice || 3) + " 骰连升另 +" + pct(eff.fullValue);
    else if (eff.pattern === "single") base = "仅以一枚骰结算：得分 +" + pct(eff.value);
    else if (eff.pattern === "all_high") base = "全部骰不低于 " + (eff.minPip || 4) + " 点：得分 +" + pct(eff.value);
    else if (eff.pattern === "pair") base = "骰组出现同点：得分 +" + pct(eff.value);
    else if (eff.pattern === "total") base = "骰组总点数不少于 " + (eff.threshold || 12) + "：得分 +" + pct(eff.value);
    else if (eff.pattern === "exact_total") base = "前 " + (eff.diceCount || 2) + " 骰合计恰为 " + (eff.total || 7) + "：得分 +" + pct(eff.value) + (eff.firstExtraFree ? "；首枚续掷免费" : "");
    else if (eff.pattern === "total_multiple") base = "骰组总点数为 " + (eff.multiple || 7) + " 的倍数（不限制骰子枚数）：得分 +" + pct(eff.value);
    else if (eff.pattern === "total_tiers") base = (eff.tiers || []).map(x => "总点 ≥" + x.threshold + "：+" + pct(x.value)).join("；") || "总点分档";
    else if (eff.pattern === "extremes") base = "每枚 ≥" + (eff.highMin || 5) + " 点骰 +" + pct(eff.highValue) + "；每枚 ≤" + (eff.lowMax || 2) + " 点骰 " + pct(eff.lowValue);
    else base = "骰组章法";
    const r = eff.reward;
    if (r && Number(r.value) > 0) {
      const rn = { insight: "心得", fragment: "残页", page: "稿页", inspiration: "灵感" }[r.type] || r.type;
      base += "；触发后 " + rn + " +" + r.value + (r.perMatch === false ? "（每场一次）" : "（按命中数）");
    }
    const fr = eff.fullReward;
    if (fr && Number(fr.value) > 0) base += "；连升完成后 " + ({ insight: "心得", fragment: "残页", page: "稿页", inspiration: "灵感" }[fr.type] || fr.type) + " +" + fr.value;
    return base;
  }
  function talentEffectText(eff) {
    if (!eff || !eff.type) return "（无效果）";
    switch (eff.type) {
      case "on_win_bonus": { const sn = eff.style === "any" ? "任意体" : (ATTR[eff.style] || eff.style); return "以" + sn + "出战获胜时，" + sn + " +" + (eff.value || 0); }
      case "attr_flat": { const a = eff.attrs || {}; const p = ATTR_KEYS.filter(k => a[k]).map(k => ATTR[k] + " +" + a[k]); return "属性常驻：" + (p.length ? p.join("、") : "（无）"); }
      case "dice_plus": return "灵感骰点数 +" + (eff.value || 0);
      case "crit": return Math.round((eff.chance || 0) * 100) + "% 概率得分 ×" + (eff.mult || 0);
      case "copy_affinity": return "复制对手所选风格的相性加成";
      case "dice_mult": return "普通灵感骰每点乘区 +" + (eff.value || 0) + "%";
      case "palace_pct": return "殿试三场得分 +" + Math.round((eff.value || 0) * 100) + "%";
      case "fixed_dice": return "灵感波动锁定为固定 +" + (eff.value || 0);
      case "planned_dice": return "可指定下次灵感骰为 1—" + (eff.maxValue || 6) + " 点；本局每次使用消耗递增（首用 " + (eff.baseCost || 5) + "，每次 +" + (eff.costStep || 2) + "）";
      case "unlock_lian": return "解锁「联圣流」";
      case "insp_on_win": return "每场论战取胜，灵感 +" + (eff.value || 0);
      case "draw_bonus": return "与对手平分秋色时，出战文体额外 +" + (eff.value || 0);
      case "insp_on_talent": return "每获得一枚新文心，灵感 +" + (eff.value || 0);
      case "extra_dice_pct": return "每追加一枚灵感骰，作品得分 +" + Math.round((eff.value || 0) * 100) + "%" + (eff.firstCostDiscount ? "；首枚少耗 " + eff.firstCostDiscount + " 灵感" : "");
      case "extra_dice_chain": return "支付首枚续掷后自动续得第二枚骰；自动骰不低于首枚续骰时得分 +" + Math.round((eff.value || 0) * 100) + "%";
      case "dice_transform": {
        if (eff.mode === "first_floor") return "本场首骰最低视为 " + (eff.floor || 4) + " 点" + (eff.noExtraDice ? "；本场不能追加骰" : "") + (eff.value ? "；得分 +" + Math.round(eff.value * 100) + "%" : "");
        if (eff.mode === "polarize") return "至少 " + (eff.minDice || 2) + " 枚骰时，将最低骰化为 1、最高骰化为 6" + (eff.value ? "；得分 +" + Math.round(eff.value * 100) + "%" : "");
        if (eff.mode === "lowest_to") return "将最低且不高于 " + (eff.maxPip || 3) + " 点的一骰化为 " + (eff.target || 6) + " 点";
        return "将 " + (eff.count || 1) + " 枚不高于 " + (eff.threshold || 2) + " 点的最低骰抬高 " + (eff.value || 1) + " 点";
      }
      case "dice_pattern": return dicePatternText(eff);
      case "style_switch_pct": return "换用不同于上一场的文体：得分 +" + Math.round((eff.value || 0) * 100) + "%、心得 +" + (eff.insight || 0);
      case "manuscript_pct": return "每持有 " + (eff.step || 2) + " 页稿本，得分 +" + Math.round((eff.value || 0) * 100) + "%（上限 " + Math.round((eff.cap || 0) * 100) + "%）";
      case "style_pct": { const sn = eff.style === "any" ? "任意体" : (ATTR[eff.style] || eff.style); return "以" + sn + "出战，得分常驻 +" + Math.round((eff.value || 0) * 100) + "%"; }
      case "theme_pct": return "出战「" + (THEME_NAME[eff.theme] || eff.theme) + "」题材时，得分 +" + Math.round((eff.value || 0) * 100) + "%";
      case "streak_mult": return "气势连捷收益 ×" + (1 + (eff.value || 0)).toFixed(2) + "（连捷越久越强）";
      case "insp_floor": return "每场结算后灵感托底至 " + (eff.value || 0) + "（防封笔螺旋）";
      case "lucky_six": return "灵感骰掷出 6 时，本场得分 ×" + (eff.mult || 0);
      case "comeback": return "灵感 ≤ " + (eff.threshold || 12) + " 的绝境中，本场得分 +" + Math.round((eff.value || 0) * 100) + "%";
      case "armory_pct": return "每拥有 " + (eff.step || 3) + " 枚文心，算分属性 +" + Math.round((eff.value || 0) * 100) + "%";
      case "study_bonus": return "「败中有得」「平分秋色」补偿属性额外 +" + (eff.value || 0);
      case "palace_insp": return "殿试每场开场，灵感 +" + (eff.value || 0);
      case "start_insp": return "获得此文心时，灵感一次性 +" + (eff.value || 0);
      case "insp_turn_regen": return "持有时，每回合开始恢复灵感 +" + (eff.value || 0);
      case "insp_on_quiz": return "答对/完成抉择额外 +" + (eff.value || 0) + " 灵感（每局最多 " + (eff.maxTriggers || 0) + " 次）";
      case "insp_battle_recover": return "战后灵感 ≤" + (eff.threshold || 0) + " 时恢复 " + (eff.value || 0) + "（每局最多 " + (eff.maxTriggers || 0) + " 次）";
      case "insp_max": return "获得时，本局灵感上限永久 +" + (eff.value || 0) + "（同类扩容互斥）";
      case "reincarnate": return "殿试结算时若剩余灵感 ≥ " + (Number(eff.inspThreshold) || 0) + "，下一局继承本局属性的 " + Math.round((Number(eff.attrRatio) || 0) * 100) + "%、此文心与当前等级";
      default: return eff.type;
    }
  }

  /* ---------------- 筛选 / 列表 ---------------- */
  function getFilters() {
    return {
      q: document.getElementById("talFSearch").value.trim().toLowerCase(),
      kind: document.getElementById("talFKind").value,
      school: document.getElementById("talFSchool").value
    };
  }
  function filtered() {
    const f = getFilters();
    return state.talents.filter(t => {
      if (f.kind !== "all" && t.kind !== f.kind) return false;
      if (f.school !== "all" && (t.school || "") !== f.school) return false;
      if (f.q) {
        const hay = [t.id, t.name, t.text, talentEffectText(t.effect)].join(" ").toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });
  }
  function renderStats() {
    const total = state.talents.length;
    const passive = state.talents.filter(t => t.kind === "passive").length;
    const active = total - passive;
    document.getElementById("talStatStrip").innerHTML = `
      <div class="stat"><b>${total}</b><span>文心总数</span></div>
      <div class="stat"><b>${passive}</b><span>被动</span></div>
      <div class="stat"><b>${active}</b><span>主动</span></div>`;
  }
  function renderList() {
    renderStats();
    const list = document.getElementById("tallist");
    const items = filtered();
    if (!items.length) {
      list.innerHTML = `<div class="empty"><b>${state.talents.length ? "没有符合筛选条件的文心" : "文心库还是空的"}</b>
        ${state.talents.length ? "试着调整上方筛选条件。" : "点击「＋ 新增文心」开始，或「导入 JSON」载入现有的 talents.json。"}</div>`;
      return;
    }
    list.innerHTML = items.map(t => {
      const idx = state.talents.indexOf(t);
      const srcN = talentSources(t.id).length;
      const eff = talentEffectText(t.effect);
      const cost = t.kind === "active" ? ` · 灵感消耗 ${t.cost}` : "";
      const desc = String(t.text || "").trim();
      return `<div class="q-card" data-idx="${idx}">
        <div class="meta">
          <span class="q-id">${C.esc(t.id)}</span>
          <span class="badge k-${t.kind}">${t.kind === "passive" ? "被动" : "主动"}</span>
          ${t.school ? `<span class="badge school">${SCHOOLS[t.school] || t.school}</span>` : ""}
          ${t.source ? `<span class="badge src">${t.source === "album" ? "图鉴" : t.source}</span>` : ""}
          ${t.upgrade ? `<span class="badge r-${t.upgrade.quality}" title="可升级">${C.QUALITY[t.upgrade.quality] || t.upgrade.quality}·Lv${t.upgrade.maxLevel}</span>` : ""}
          ${srcN ? `<span class="badge src-ev">产出奇遇 ${srcN}</span>` : `<span class="badge orphan">孤儿</span>`}
        </div>
        <div class="q-main">
          <p class="q-name">${C.esc(t.name)}</p>
          <div class="q-tags"><span class="t">${TALENT_TYPE_LABELS[t.effect.type] || t.effect.type}</span></div>
          <div class="q-opts">${C.esc(eff)}${cost}</div>
          ${desc ? `<div class="q-desc" title="${C.esc(desc)}">${C.esc(desc)}</div>` : ""}
        </div>
        <div class="q-actions">
          <button class="btn sm" data-preview="${idx}">预览</button>
          <button class="btn sm" data-edit="${idx}">编辑</button>
          <button class="btn sm" data-dup="${idx}">复制</button>
          <button class="btn sm danger" data-del="${idx}">删除</button>
        </div>
      </div>`;
    }).join("");
  }

  /* ---------------- 效果编辑器（按 type 动态渲染） ---------------- */
  function effectDyn(eff) {
    const type = eff.type;
    if (type === "on_win_bonus") {
      return `<div class="row2">
        <div class="field" style="margin:0"><label>出战体</label>
          <select class="tal-style">${["shi", "ci", "lian", "any"].map(s => `<option value="${s}" ${s === eff.style ? "selected" : ""}>${STYLE_NAME[s]}</option>`).join("")}</select></div>
        <div class="field" style="margin:0"><label>获胜额外 +值</label>
          <input type="number" class="tal-value" value="${eff.value || 0}" step="1" min="0"/></div>
      </div>`;
    }
    if (type === "attr_flat") {
      const rows = Object.keys(eff.attrs || {}).map((k, i) => `
        <div class="opt-row eff-attr" data-k="${k}">
          <span class="ord">${i + 1}</span>
          <select class="tal-attr-k">${ATTR_KEYS.map(k2 => `<option value="${k2}" ${k2 === k ? "selected" : ""}>${ATTR[k2]}</option>`).join("")}</select>
          <input type="number" class="tal-attr-v" value="${eff.attrs[k]}" step="1"/>
          <button class="opt-del tal-attr-del" title="删除属性">×</button>
        </div>`).join("");
      return `<div class="field" style="margin:6px 0"><label>常驻属性（attrs）</label>
        <div class="eff-attrs">${rows || '<div style="font-size:12px;color:var(--ink2)">暂无属性加成</div>'}</div>
        <button class="btn sm opt-add tal-attr-add">＋ 添加属性</button></div>`;
    }
    if (type === "crit") {
      return `<div class="row2">
        <div class="field" style="margin:0"><label>触发概率（0~1，如 0.2）</label>
          <input type="number" class="tal-chance" value="${eff.chance || 0}" step="0.05" min="0" max="1"/></div>
        <div class="field" style="margin:0"><label>得分倍率（如 1.5）</label>
          <input type="number" class="tal-mult" value="${eff.mult || 0}" step="0.1" min="1"/></div>
      </div>`;
    }
    if (type === "copy_affinity" || type === "unlock_lian") {
      return `<div class="hint">该类型无需额外参数。</div>`;
    }
    if (type === "planned_dice") {
      return `<div class="row3">
        <div class="field" style="margin:0"><label>可指定的最高骰点</label><input type="number" class="tal-planned-max" value="${eff.maxValue || 6}" min="1" max="6" step="1"/></div>
        <div class="field" style="margin:0"><label>首次消耗灵感</label><input type="number" class="tal-planned-base" value="${eff.baseCost || 5}" min="1" step="1"/></div>
        <div class="field" style="margin:0"><label>每次递增消耗</label><input type="number" class="tal-planned-step" value="${eff.costStep || 2}" min="0" step="1"/></div>
      </div>`;
    }
    if (type === "extra_dice_pct") {
      return `<div class="row2"><div class="field" style="margin:0"><label>每枚追加骰得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" min="0" step="1"/></div><div class="field" style="margin:0"><label>首枚追加少耗灵感</label><input type="number" class="tal-first-discount" value="${eff.firstCostDiscount || 0}" min="0" step="1"/></div></div>`;
    }
    if (type === "extra_dice_chain") {
      return `<div class="row2"><div class="field" style="margin:0"><label>自动续骰条件</label><select class="tal-chain-compare"><option value="not_lower">不低于首枚续骰</option></select></div><div class="field" style="margin:0"><label>条件命中得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" min="0" step="1"/></div></div><div class="hint">发动后支付第一枚续掷，即自动掷出第二枚；不会出现额外交互弹窗。</div>`;
    }
    if (type === "dice_transform") {
      const mode = eff.mode || "low_lift";
      const opts = [["low_lift", "抬高低点"], ["first_floor", "首骰保底"], ["lowest_to", "最低点化用"], ["polarize", "两极化用"]];
      let dyn = "";
      if (mode === "low_lift") dyn = `<div class="row3"><div class="field" style="margin:0"><label>低点阈值</label><input type="number" class="tal-threshold" value="${eff.threshold || 2}" min="1" max="6"/></div><div class="field" style="margin:0"><label>抬高点数</label><input type="number" class="tal-value" value="${eff.value || 1}" min="1"/></div><div class="field" style="margin:0"><label>最多处理枚数</label><input type="number" class="tal-count" value="${eff.count || 1}" min="1" max="3"/></div></div>`;
      else if (mode === "first_floor") dyn = `<div class="row2"><div class="field" style="margin:0"><label>首骰最低点</label><input type="number" class="tal-floor" value="${eff.floor || 4}" min="1" max="6"/></div><div class="field" style="margin:0"><label>本场不能追加骰</label><select class="tal-no-extra"><option value="0" ${!eff.noExtraDice ? "selected" : ""}>否</option><option value="1" ${eff.noExtraDice ? "selected" : ""}>是</option></select></div></div>`;
      else if (mode === "polarize") dyn = `<div class="row2"><div class="field" style="margin:0"><label>至少骰数</label><input type="number" class="tal-min-dice" value="${eff.minDice || 2}" min="2" max="3"/></div><div class="field" style="margin:0"><label>命中得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" min="0" step="1"/></div></div>`;
      else dyn = `<div class="row2"><div class="field" style="margin:0"><label>最低骰须不高于</label><input type="number" class="tal-max-pip" value="${eff.maxPip || 3}" min="1" max="6"/></div><div class="field" style="margin:0"><label>化为点数</label><input type="number" class="tal-target-pip" value="${eff.target || 6}" min="1" max="6"/></div></div>`;
      return `<div class="field"><label>化用方式</label><select class="tal-transform-mode">${opts.map(([v, n]) => `<option value="${v}" ${v === mode ? "selected" : ""}>${n}</option>`).join("")}</select></div>${dyn}`;
    }
    if (type === "dice_pattern") {
      const pattern = eff.pattern || "six";
      const opts = [["six", "最终六点"], ["distinct", "不同点数"], ["all_distinct", "三骰各异"], ["low_then_high", "低开高走"], ["ascending", "逐骰递升"], ["first_last_equal", "首尾同点"], ["low_and_high", "低高并见"], ["single", "只用单骰"], ["all_high", "全骰高点"], ["pair", "出现同点"], ["total", "总点达标"], ["exact_total", "合点命中"], ["total_multiple", "总点为倍数"], ["total_tiers", "总点分档"], ["extremes", "高低两极"]];
      let dyn = "";
      if (pattern === "extremes") dyn = `<div class="row2"><div class="field" style="margin:0"><label>高点门槛 / 每枚 +%</label><input type="number" class="tal-high-min" value="${eff.highMin || 5}" min="1" max="6"/><input type="number" class="tal-high-pct" value="${Math.round((eff.highValue || 0) * 100)}" step="1"/></div><div class="field" style="margin:0"><label>低点门槛 / 每枚 +%（可负）</label><input type="number" class="tal-low-max" value="${eff.lowMax || 2}" min="1" max="6"/><input type="number" class="tal-low-pct" value="${Math.round((eff.lowValue || 0) * 100)}" step="1"/></div></div>`;
      else if (pattern === "all_distinct") dyn = `<div class="row3"><div class="field" style="margin:0"><label>至少骰数</label><input type="number" class="tal-min-dice" value="${eff.minDice || 3}" min="2" max="3"/></div><div class="field" style="margin:0"><label>命中得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" step="1"/></div><div class="field" style="margin:0"><label>首枚续掷减费</label><input type="number" class="tal-first-discount" value="${eff.firstCostDiscount || 0}" min="0"/></div></div>`;
      else if (pattern === "low_then_high") dyn = `<div class="row4"><div class="field" style="margin:0"><label>首骰不高于</label><input type="number" class="tal-low-max" value="${eff.lowMax || 2}" min="1" max="6"/></div><div class="field" style="margin:0"><label>续骰不低于</label><input type="number" class="tal-next-high-min" value="${eff.nextHighMin || 5}" min="1" max="6"/></div><div class="field" style="margin:0"><label>命中得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" step="1"/></div><div class="field" style="margin:0"><label>低开续掷减费</label><input type="number" class="tal-conditional-discount" value="${eff.conditionalFirstCostDiscount || 0}" min="0"/></div></div>`;
      else if (pattern === "first_last_equal") dyn = `<div class="row3"><div class="field" style="margin:0"><label>至少骰数</label><input type="number" class="tal-min-dice" value="${eff.minDice || 2}" min="2" max="3"/></div><div class="field" style="margin:0"><label>首尾同点得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" step="1"/></div><div class="field" style="margin:0"><label>首枚续掷减费</label><input type="number" class="tal-first-discount" value="${eff.firstCostDiscount || 0}" min="0"/></div></div>`;
      else if (pattern === "low_and_high") dyn = `<div class="row3"><div class="field" style="margin:0"><label>低点不高于</label><input type="number" class="tal-low-max" value="${eff.lowMax || 2}" min="1" max="6"/></div><div class="field" style="margin:0"><label>高点不低于</label><input type="number" class="tal-high-min" value="${eff.highMin || 5}" min="1" max="6"/></div><div class="field" style="margin:0"><label>命中得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" step="1"/></div></div>`;
      else if (pattern === "ascending") dyn = `<div class="row4"><div class="field" style="margin:0"><label>每次递升 +%</label><input type="number" class="tal-step-pct" value="${Math.round((eff.perStepValue || 0) * 100)}" step="1"/></div><div class="field" style="margin:0"><label>连升骰数</label><input type="number" class="tal-full-dice" value="${eff.fullDice || 3}" min="2" max="3"/></div><div class="field" style="margin:0"><label>连升额外 +%</label><input type="number" class="tal-full-pct" value="${Math.round((eff.fullValue || 0) * 100)}" step="1"/></div><div class="field" style="margin:0"><label>首枚续掷减费</label><input type="number" class="tal-first-discount" value="${eff.firstCostDiscount || 0}" min="0"/></div></div>`;
      else if (pattern === "exact_total") dyn = `<div class="row4"><div class="field" style="margin:0"><label>骰数</label><input type="number" class="tal-dice-count" value="${eff.diceCount || 2}" min="2" max="3"/></div><div class="field" style="margin:0"><label>目标合点</label><input type="number" class="tal-exact-total" value="${eff.total || 7}" min="2" max="18"/></div><div class="field" style="margin:0"><label>命中得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" step="1"/></div><div class="field" style="margin:0"><label>首枚续掷免费</label><select class="tal-first-free"><option value="0" ${!eff.firstExtraFree ? "selected" : ""}>否</option><option value="1" ${eff.firstExtraFree ? "selected" : ""}>是</option></select></div></div>`;
      else if (pattern === "total_multiple") dyn = `<div class="row2"><div class="field" style="margin:0"><label>倍数</label><input type="number" class="tal-total-multiple" value="${eff.multiple || 7}" min="1" step="1"/></div><div class="field" style="margin:0"><label>命中得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" step="1"/></div></div>`;
      else if (pattern === "total_tiers") { const tiers = (eff.tiers || []).slice().sort((a,b) => (b.threshold || 0) - (a.threshold || 0)); const hi = tiers[0] || {}; const lo = tiers[1] || {}; dyn = `<div class="row4"><div class="field" style="margin:0"><label>高档阈值</label><input type="number" class="tal-tier-high-threshold" value="${hi.threshold || 16}" min="1"/></div><div class="field" style="margin:0"><label>高档得分 +%</label><input type="number" class="tal-tier-high-pct" value="${Math.round((hi.value || 0) * 100)}" step="1"/></div><div class="field" style="margin:0"><label>低档阈值</label><input type="number" class="tal-tier-low-threshold" value="${lo.threshold || 12}" min="1"/></div><div class="field" style="margin:0"><label>低档得分 +%</label><input type="number" class="tal-tier-low-pct" value="${Math.round((lo.value || 0) * 100)}" step="1"/></div></div><div class="field"><label>各档回还灵感</label><input type="number" class="tal-tier-reward" value="${hi.reward && hi.reward.value || lo.reward && lo.reward.value || 3}" min="0" step="1"/></div>`; }
      else dyn = `<div class="row2"><div class="field" style="margin:0"><label>每次命中得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" step="1"/></div>${pattern === "all_high" ? `<div class="field" style="margin:0"><label>最低骰点</label><input type="number" class="tal-min-pip" value="${eff.minPip || 4}" min="1" max="6"/></div>` : pattern === "total" ? `<div class="field" style="margin:0"><label>总点阈值</label><input type="number" class="tal-threshold" value="${eff.threshold || 12}" min="1"/></div>` : pattern === "distinct" ? `<div class="field" style="margin:0"><label>首枚追加减费</label><input type="number" class="tal-first-discount" value="${eff.firstCostDiscount || 0}" min="0"/></div>` : ""}</div>`;
      const patternReward = pattern === "ascending" ? eff.fullReward : eff.reward;
      const rt = patternReward && patternReward.type || "none";
      const rv = patternReward && patternReward.value || 0;
      const once = patternReward && patternReward.perMatch === false;
      return `<div class="field"><label>骰组条件</label><select class="tal-pattern">${opts.map(([v, n]) => `<option value="${v}" ${v === pattern ? "selected" : ""}>${n}</option>`).join("")}</select></div>${dyn}<div class="row3"><div class="field" style="margin:0"><label>${pattern === "ascending" ? "连升完成回响" : "后续收益"}</label><select class="tal-reward-type"><option value="none">无</option>${[["insight", "心得"], ["fragment", "残页"], ["page", "稿页"], ["inspiration", "灵感"]].map(([v,n]) => `<option value="${v}" ${v === rt ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="field" style="margin:0"><label>收益数值</label><input type="number" class="tal-reward-value" value="${rv}" min="0" step="0.25"/></div><div class="field" style="margin:0"><label>结算方式</label><select class="tal-reward-once"><option value="0" ${!once ? "selected" : ""}>按命中数</option><option value="1" ${once ? "selected" : ""}>每场一次</option></select></div></div>`;
    }
    if (type === "style_switch_pct") return `<div class="row2"><div class="field" style="margin:0"><label>换体得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" min="0"/></div><div class="field" style="margin:0"><label>战后心得 +</label><input type="number" class="tal-insight" value="${eff.insight || 0}" min="0"/></div></div>`;
    if (type === "manuscript_pct") return `<div class="row3"><div class="field" style="margin:0"><label>每 N 页稿本</label><input type="number" class="tal-step" value="${eff.step || 2}" min="1"/></div><div class="field" style="margin:0"><label>每档得分 +%</label><input type="number" class="tal-value-pct" value="${Math.round((eff.value || 0) * 100)}" min="0" step="0.5"/></div><div class="field" style="margin:0"><label>总上限 %</label><input type="number" class="tal-cap-pct" value="${Math.round((eff.cap || 0) * 100)}" min="0" step="0.5"/></div></div>`;
    if (type === "insp_on_win" || type === "draw_bonus" || type === "insp_on_talent") {
      const lbl = type === "insp_on_win" ? "获胜时灵感 +" : type === "draw_bonus" ? "平局时出战文体 +" : "获得文心时灵感 +";
      return `<div class="field" style="margin:6px 0"><label>${lbl}</label>
        <input type="number" class="tal-value" value="${eff.value || 0}" step="1" min="0"/></div>`;
    }
    if (type === "style_pct") {
      const pct = (Number(eff.value) || 0) * 100;
      return `<div class="row2">
        <div class="field" style="margin:0"><label>出战体</label>
          <select class="tal-style">${["shi", "ci", "lian", "any"].map(s => `<option value="${s}" ${s === eff.style ? "selected" : ""}>${STYLE_NAME[s]}</option>`).join("")}</select></div>
        <div class="field" style="margin:0"><label>常驻得分 +%（如 6 = 6%）</label>
          <input type="number" class="tal-value" value="${pct}" step="1" min="0"/></div>
      </div>`;
    }
    if (type === "theme_pct") {
      const pct = (Number(eff.value) || 0) * 100;
      return `<div class="row2">
        <div class="field" style="margin:0"><label>题材</label>
          <select class="tal-theme">${THEMES.map(t => `<option value="${t}" ${t === eff.theme ? "selected" : ""}>${THEME_NAME[t]}</option>`).join("")}</select></div>
        <div class="field" style="margin:0"><label>得分 +%（如 8 = 8%）</label>
          <input type="number" class="tal-value" value="${pct}" step="1" min="0"/></div>
      </div>`;
    }
    if (type === "streak_mult") {
      const pct = Math.round((Number(eff.value) || 0) * 100);
      return `<div class="field" style="margin:6px 0"><label>连捷收益加成 +%（如 40 = ×1.4）</label>
        <input type="number" class="tal-value" value="${pct}" step="5" min="0"/></div>`;
    }
    if (type === "insp_floor") {
      return `<div class="field" style="margin:6px 0"><label>灵感托底值（每场结算后不低于此数）</label>
        <input type="number" class="tal-value" value="${eff.value || 0}" step="1" min="0"/></div>`;
    }
    if (type === "lucky_six") {
      return `<div class="field" style="margin:6px 0"><label>得分倍率（灵验骰 6 时触发，如 1.3）</label>
        <input type="number" class="tal-mult" value="${eff.mult || 0}" step="0.1" min="1"/></div>`;
    }
    if (type === "comeback") {
      const pct = Math.round((Number(eff.value) || 0) * 100);
      return `<div class="row2">
        <div class="field" style="margin:0"><label>绝境得分 +%（如 12 = 12%）</label>
          <input type="number" class="tal-value" value="${pct}" step="1" min="0"/></div>
        <div class="field" style="margin:0"><label>灵感阈值（≤ 此值触发）</label>
          <input type="number" class="tal-threshold" value="${eff.threshold || 12}" step="1" min="0"/></div>
      </div>`;
    }
    if (type === "armory_pct") {
      const pct = Math.round((Number(eff.value) || 0) * 100);
      return `<div class="row2">
        <div class="field" style="margin:0"><label>每拥有 N 枚文心</label>
          <input type="number" class="tal-step" value="${eff.step || 3}" step="1" min="1"/></div>
        <div class="field" style="margin:0"><label>算分属性 +%（如 4 = 4%）</label>
          <input type="number" class="tal-value" value="${pct}" step="1" min="0"/></div>
      </div>`;
    }
    if (type === "study_bonus" || type === "palace_insp" || type === "start_insp" || type === "insp_turn_regen" || type === "insp_max") {
      const lbl = type === "study_bonus" ? "败/平补偿属性额外 +" : type === "palace_insp" ? "殿试每场开场灵感 +" : type === "start_insp" ? "获得时灵感一次性 +" : type === "insp_turn_regen" ? "持有时每回合开始恢复 +" : "本局灵感上限永久 +";
      return `<div class="field" style="margin:6px 0"><label>${lbl}</label>
        <input type="number" class="tal-value" value="${eff.value || 0}" step="1" min="0"/></div>`;
    }
    if (type === "insp_on_quiz") {
      return `<div class="row2"><div class="field" style="margin:0"><label>每次恢复灵感</label><input type="number" class="tal-value" value="${eff.value || 0}" min="1"/></div><div class="field" style="margin:0"><label>每局最多触发</label><input type="number" class="tal-max-triggers" value="${eff.maxTriggers || 1}" min="1"/></div></div>`;
    }
    if (type === "insp_battle_recover") {
      return `<div class="row3"><div class="field" style="margin:0"><label>战后恢复</label><input type="number" class="tal-value" value="${eff.value || 0}" min="1"/></div><div class="field" style="margin:0"><label>灵感阈值</label><input type="number" class="tal-threshold" value="${eff.threshold || 0}" min="0"/></div><div class="field" style="margin:0"><label>每局最多触发</label><input type="number" class="tal-max-triggers" value="${eff.maxTriggers || 1}" min="1"/></div></div>`;
    }
    if (type === "reincarnate") {
      const th = Number(eff.inspThreshold) || 0;
      const ratioPct = Math.round((Number(eff.attrRatio) || 0) * 100);
      return `<div class="row2">
        <div class="field" style="margin:0"><label>殿试结算所需剩余灵感门槛</label>
          <input type="number" class="tal-reinc-th" value="${th}" step="1" min="0"/></div>
        <div class="field" style="margin:0"><label>下局继承比例（%，如 80 = 继承 80%）</label>
          <input type="number" class="tal-reinc-ratio" value="${ratioPct}" step="1" min="0" max="100"/></div>
      </div>`;
    }
    const lbl = type === "palace_pct" ? "比例（如 0.05 = 5%）"
      : type === "dice_mult" ? "每点普通灵感骰乘区（如 6 = 每点 +6%；基础为 5%）"
      : "数值";
    return `<div class="field" style="margin:6px 0"><label>${lbl}</label>
      <input type="number" class="tal-value" value="${eff.value || 0}" step="${type === "palace_pct" ? "0.01" : "1"}" ${type === "palace_pct" ? "" : "min=\"0\""}/></div>`;
  }
  function renderEffectFields() {
    const eff = state.form.effect;
    document.getElementById("talEffectBox").innerHTML = `
      <div class="field" style="margin:6px 0"><label>效果类型</label>
        <select class="tal-eff-type" id="tal-eff-type">${TALENT_TYPES.map(t => `<option value="${t}" ${t === eff.type ? "selected" : ""}>${TALENT_TYPE_LABELS[t]}</option>`).join("")}</select></div>
      <div class="tal-eff-dyn" data-lvl="-1" id="tal-eff-dyn">${effectDyn(eff)}</div>`;
  }

  /* ---------------- 升级面板渲染 ---------------- */
  function renderUpgradePanel() {
    const box = document.getElementById("talUpgradeBox");
    if (!box) return;
    const up = state.form && state.form.upgrade;
    if (!up) { box.innerHTML = '<div class="hint">勾选后此处可设置品质档、等级上限、升级成本与逐级数值（Lv1 始终等于上方「效果」）。</div>'; return; }
    const qOpts = C.QUALITY ? Object.keys(C.QUALITY).map(q => `<option value="${q}" ${q === up.quality ? "selected" : ""}>${C.QUALITY[q]}</option>`).join("") : "";
    box.innerHTML = `
      <div class="row2">
        <div class="field" style="margin:0"><label>品质档（决定等级上限与成本基准）</label>
          <select id="tal-quality">${qOpts}</select></div>
        <div class="field" style="margin:0"><label>等级上限 maxLevel</label>
          <input type="number" id="tal-maxlevel" value="${up.maxLevel}" min="1" max="6" step="1"/></div>
      </div>
      <div class="field" style="margin:6px 0"><label>升级成本 upCost（升至下一级所需灵感，共 ${Math.max(0, up.maxLevel - 1)} 项）</label>
        <div id="talUpcostBox" class="eff-attrs"></div>
        <button class="btn sm opt-add" id="talUpcostAuto" type="button">按品质自动填充</button></div>
      <div class="field" style="margin:6px 0"><label>逐级效果（Lv1 = 上方「效果」；以下为 Lv2…Lv${up.maxLevel}）</label>
        <div id="talUpgradeLevels"></div></div>
      <div class="field" style="margin:6px 0"><label>逐级视觉样式（对每一级分别设置字体/字号/颜色/行距/对齐/缩进/段间距，右侧实时预览，保存后随文心数据导出）</label>
        <div id="talStyleBox"></div></div>`;
    renderUpcost();
    renderLevelEffects();
    renderStylePanel();
  }
  function renderUpcost() {
    const box = document.getElementById("talUpcostBox");
    if (!box || !(state.form && state.form.upgrade)) return;
    const up = state.form.upgrade;
    box.innerHTML = (up.upCost && up.upCost.length)
      ? up.upCost.map((c, i) => `
        <div class="opt-row"><span class="ord">${i + 1}</span>
          <span style="font-size:12px;color:var(--ink2)">→ Lv${i + 2}</span>
          <input type="number" class="tal-upcost" data-i="${i}" value="${c}" min="0" step="1"/></div>`).join("")
      : '<div style="font-size:12px;color:var(--ink2)">满级 1 级，无需成本。</div>';
  }
  function renderLevelEffects() {
    const box = document.getElementById("talUpgradeLevels");
    if (!box || !(state.form && state.form.upgrade)) return;
    const up = state.form.upgrade;
    if (!up.levels.length) { box.innerHTML = '<div style="font-size:12px;color:var(--ink2)">满级 1 级，无逐级效果。</div>'; return; }
    box.innerHTML = up.levels.map((lv, i) => `
      <div class="lvl-eff" data-lvl="${i}" style="border:1px solid var(--ink2);border-radius:8px;padding:8px;margin:8px 0;background:rgba(0,0,0,.02)">
        <div class="lvl-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <b>Lv${i + 2}</b>
          <button class="opt-del lv-del" type="button" data-lvl="${i}" title="重置为 Lv1 效果">重置</button>
        </div>
        <div class="field" style="margin:4px 0"><label>效果类型</label>
          <select class="tal-eff-type" data-lvl="${i}">${TALENT_TYPES.map(t => `<option value="${t}" ${t === lv.effect.type ? "selected" : ""}>${TALENT_TYPE_LABELS[t]}</option>`).join("")}</select></div>
        <div class="lvl-eff-dyn" data-lvl="${i}">${effectDyn(lv.effect)}</div>
        ${state.form.kind === "active" ? `<div class="field" style="margin:4px 0"><label>灵感消耗 cost（该级）</label><input type="number" class="tal-lvl-cost" data-lvl="${i}" value="${lv.cost != null ? lv.cost : (state.form.cost || 1)}" min="1" step="1"/></div>` : ""}
      </div>`).join("");
  }

  /* 逐级视觉样式面板：每级一份控件 + 实时预览。 */
  function renderStylePanel() {
    const box = document.getElementById("talStyleBox");
    if (!box || !(state.form && state.form.upgrade)) return;
    const up = state.form.upgrade;
    const ml = up.maxLevel;
    const ls = up.levelStyles || [];
    const effText = (j) => {
      const eff = j === 0 ? state.form.effect : (up.levels[j - 1] && up.levels[j - 1].effect);
      return eff ? talentEffectText(eff) : "（无效果）";
    };
    if (ml <= 1) { box.innerHTML = '<div style="font-size:12px;color:var(--ink2)">满级 1 级（仅 Lv1），无逐级样式可配。</div>'; return; }
    let html = "";
    for (let j = 0; j < ml; j++) {
      const st = ls[j] || defaultStyle();
      const txt = `<b>Lv${j + 1}</b> · ${C.esc(state.form.name || "文心")} — ${C.esc(effText(j))}`;
      html += `<div class="lvl-style" data-lvl="${j}" style="border:1px solid var(--ink2);border-radius:8px;padding:8px;margin:8px 0;background:rgba(0,0,0,.02)">
        <div class="lvl-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <b>Lv${j + 1} 视觉样式</b>
          <button class="opt-del lv-style-reset" type="button" data-lvl="${j}" title="清除该级样式（恢复默认）">清除</button>
        </div>
        ${styleControls(j, st)}
        <div class="style-prev-wrap"><div class="style-prev" id="talStylePrev-${j}" style="${buildCss(st)}">${txt}</div></div>
      </div>`;
    }
    box.innerHTML = html;
  }

  /* 轻量刷新某级样式预览文案（不重建输入框，避免失焦）。
     j 为视觉层级索引（0=Lv1 取基础 effect，j≥1 取 levels[j-1].effect）。 */
  function updateStylePreviewText(j) {
    if (!state.form || !state.form.upgrade) return;
    const prev = document.getElementById("talStylePrev-" + j);
    if (!prev) return;
    const up = state.form.upgrade;
    const eff = j === 0 ? state.form.effect : (up.levels[j - 1] && up.levels[j - 1].effect);
    const effText = eff ? talentEffectText(eff) : "（无效果）";
    prev.innerHTML = `<b>Lv${j + 1}</b> · ${C.esc(state.form.name || "文心")} — ${C.esc(effText)}`;
  }

  /* ---------------- 编辑弹窗 ---------------- */
  function toggleCost() {
    document.getElementById("talCostField").style.display = state.form.kind === "active" ? "" : "none";
  }
  function openEditor(index) {
    state.editIndex = index;
    state._suggestedId = null;
    const src = index >= 0 ? state.talents[index] : null;
    if (src) {
      state.form = {
        id: src.id, name: src.name, kind: src.kind, school: src.school || "", text: src.text,
        effect: JSON.parse(JSON.stringify(src.effect)),
        cost: src.cost, source: src.source || "", routeId: src.routeId || "", axis: src.axis || "", quality: src.quality || "",
        acquire: src.acquire ? JSON.parse(JSON.stringify(src.acquire)) : null,
        acquireText: src.acquireText || "",
        upgrade: src.upgrade ? JSON.parse(JSON.stringify(src.upgrade)) : null
      };
    } else {
      state.form = { id: "", name: "", kind: "passive", school: "", text: "", effect: defaultEffect("on_win_bonus"), cost: 1, source: "", acquire: null, acquireText: "", upgrade: null };
      const tp = state.form.kind === "active" ? "TA" : "T";
      state.form.id = C.nextSeqId(tp, state.talents.map(t => t.id), state.form.kind === "active" ? 2 : 3);
      state._suggestedId = state.form.id;
    }
    document.getElementById("talTitle").textContent = src ? "编辑文心 · " + src.id : "新增文心";
    document.getElementById("tal-id").value = state.form.id;
    document.getElementById("tal-name").value = state.form.name;
    document.querySelector(`input[name=tal-kind][value=${state.form.kind}]`).checked = true;
    document.getElementById("tal-school").value = state.form.school;
    document.getElementById("tal-text").value = state.form.text;
    document.getElementById("tal-source").value = state.form.source;
    document.getElementById("tal-cost").value = state.form.cost || 1;
    const upOn = document.getElementById("tal-upgrade-on");
    if (upOn) upOn.checked = !!state.form.upgrade;
    const msg = document.getElementById("talMsg"); msg.className = "msg"; msg.textContent = "";
    toggleCost();
    renderEffectFields();
    renderTalentLinksPanel();
    renderUpgradePanel();
    C.openOverlay("talOverlay");
  }
  function renderTalentLinksPanel() {
    const box = document.getElementById("talLinksBox");
    if (box && state.form) box.innerHTML = talentLinkPanel(state.form.id, true);
  }
  function closeEditor() { C.closeOverlay("talOverlay"); state.editIndex = -1; state.form = null; }

  function toTalent(form) {
    const out = { id: form.id.trim(), name: form.name.trim(), kind: form.kind, text: form.text.trim(), effect: normalizeEffect(form.effect) };
    if (form.school) out.school = form.school;
    if (form.kind === "active") out.cost = Math.max(1, Number(form.cost) || 1);
    if (form.source) out.source = form.source.trim();
    for (const key of ["routeId", "axis", "quality"]) if (form[key] && String(form[key]).trim()) out[key] = String(form[key]).trim();
    if (form.acquire && typeof form.acquire === "object") out.acquire = JSON.parse(JSON.stringify(form.acquire));
    if (form.acquireText) out.acquireText = String(form.acquireText).trim();
    if (form.upgrade && typeof form.upgrade === "object") out.upgrade = normalizeUpgrade(form.upgrade, out);
    return out;
  }
  function saveEditor() {
    const t = toTalent(state.form);
    const { ok, errors } = validate(t, state.talents, state.editIndex);
    const msg = document.getElementById("talMsg");
    if (!ok) { msg.className = "msg err"; msg.innerHTML = "✗ 无法保存：<br>• " + errors.join("<br>• "); return; }
    if (state.editIndex >= 0) { state.talents[state.editIndex] = t; C.toast("已更新 " + t.id); }
    else { state.talents.push(t); C.toast("已新增 " + t.id); }
    save(); closeEditor(); renderList();
  }

  /* ---------------- 操作 ---------------- */
  function duplicate(idx) {
    const copy = JSON.parse(JSON.stringify(state.talents[idx]));
    let base = copy.id, n = 1, newId;
    do { newId = base + "_" + n; n++; } while (state.talents.some(t => t.id === newId));
    copy.id = newId;
    state.talents.splice(idx + 1, 0, copy);
    save(); renderList(); C.toast("已复制为 " + newId);
  }
  function remove(idx) {
    const t = state.talents[idx];
    if (!confirm(`确定删除文心「${t.id} · ${t.name}」？此操作不可撤销。`)) return;
    state.talents.splice(idx, 1);
    save(); renderList(); C.toast("已删除 " + t.id);
  }

  /* ---------------- 反向追溯：哪些奇遇产出此文心 ---------------- */
  function talentSources(tid) {
    const advs = (global.ADV && global.ADV._ready) ? global.ADV.get() : (window.GAME_EVENTS || []);
    const out = [];
    for (const e of advs) {
      const how = [];
      if (e.kind === "direct" && e.effect && e.effect.talent === tid) how.push("直接奖励");
      else if (e.kind === "challenge" && e.challenge && e.challenge.winAll && e.challenge.winAll.talent === tid) how.push("全胜奖励");
      else if (e.kind === "choice") (e.choices || []).forEach((c, i) => { if (c.effect && c.effect.talent === tid) how.push("选项" + (i + 1)); });
      if (how.length) out.push({ id: e.id, name: e.name, how: how.join("、") });
    }
    return out;
  }

  /* ---------------- 预览与奇遇双向关联 ---------------- */
  function talentLinkPanel(tid, interactive) {
    const adv = global.ADV;
    if (!interactive) {
      const links = adv && adv._ready && adv.listTalentLinks ? adv.listTalentLinks(tid) : [];
      return links.length ? `<div class="src-box"><b>已关联奇遇</b><div class="dim">关联操作请在“编辑文心”中进行。</div></div>` : "";
    }
    if (!adv || !adv._ready || !adv.eventTargets || !adv.linkTalent) {
      return `<div class="src-box empty"><b>关联奇遇编辑器</b><br>奇遇编辑器尚未初始化，暂时无法操作关联。</div>`;
    }
    const links = adv.listTalentLinks(tid) || [];
    const choices = [];
    for (const ev of adv.get()) for (const x of adv.eventTargets(ev)) {
      const eff = ev.kind === "direct" ? ev.effect : ev.kind === "challenge" ? (ev.challenge && ev.challenge.winAll) : (ev.choices && ev.choices[Number(x.target.slice(1))] && ev.choices[Number(x.target.slice(1))].effect);
      if (!eff || eff.talent) continue;
      choices.push({ value: ev.id + "::" + x.target, label: ev.id + " · " + ev.name + " · " + x.label });
    }
    const existing = links.length
      ? links.map(x => `<div class="src-chip" style="display:flex;align-items:center;justify-content:space-between;gap:6px"><span>${C.esc(x.eventId)} · ${C.esc(x.eventName)} <span class="dim">${C.esc(x.targetLabel)}${x.draft ? " · 草稿" : ""}</span></span><button class="btn sm danger" data-unlink-talent="${C.esc(tid)}" data-event-id="${C.esc(x.eventId)}" data-target="${C.esc(x.target)}">取消关联</button></div>`).join("")
      : `<div class="src-box empty">当前没有奇遇关联。</div>`;
    const add = choices.length
      ? `<div style="display:flex;gap:6px;align-items:center;margin-top:8px"><select data-link-select="${C.esc(tid)}" style="flex:1"><option value="">选择一个未关联的奇遇位置…</option>${choices.map(x => `<option value="${C.esc(x.value)}">${C.esc(x.label)}</option>`).join("")}</select><button class="btn sm primary" data-link-talent="${C.esc(tid)}">关联</button></div>`
      : `<div class="hint" style="margin-top:8px">没有可关联的空奖励位置；可先在奇遇编辑器新增/清空一个文心奖励。</div>`;
    return `<div class="src-box talent-links"><b>关联奇遇编辑器</b><div class="dim" style="margin:4px 0">从这里建立或取消奇遇奖励中的文心引用，两侧会立即同步。</div>${existing}${add}</div>`;
  }

  /* ---------------- 预览 ---------------- */
  function previewTalent(t) {
    const effTxt = talentEffectText(t.effect);
    const cost = t.kind === "active" ? `<div class="etext" style="margin-top:8px;color:#b23a2e">灵感消耗：${t.cost}</div>` : "";
    const sources = talentSources(t.id);
    const sourceHtml = sources.length
      ? `<div class="src-box"><b>产出来源奇遇（${sources.length}）</b>${sources.map(s => `<button class="src-chip" data-jump-ev="${C.esc(s.id)}">${C.esc(s.id)} · ${C.esc(s.name)} <span class="dim">${C.esc(s.how)}</span></button>`).join("")}</div>`
      : `<div class="src-box empty">暂无奇遇产出此文心（可在奇遇编辑器中将其设为奖励文心）</div>`;
    const upHtml = t.upgrade ? (() => {
      const u = t.upgrade;
      const ls = u.levelStyles || [];
      const lvLine = (txt, j) => `<li style="${buildCss(ls[j] || {})}">${txt}</li>`;
      const lv1Line = lvLine(`<b>Lv1</b>：${talentEffectText(t.effect)}`, 0);
      const lvLines = u.levels.map((lv, i) => lvLine(`<b>Lv${i + 2}</b>：${talentEffectText(lv.effect)}${t.kind === "active" && lv.cost != null ? `（cost ${lv.cost}）` : ""}`, i + 1)).join("");
      return `<div class="src-box" style="margin-top:10px">
        <b>可升级 · ${C.QUALITY[u.quality] || u.quality}（等级上限 ${u.maxLevel}）</b>
        <div style="font-size:12px;color:var(--ink2);margin:4px 0">升级成本：${(u.upCost || []).map((c, i) => `→Lv${i + 2} ${c}`).join("，") || "（满级 1 级）"}</div>
        <ul class="up-lv-list" style="margin:4px 0 0;padding-left:18px">${lv1Line}${lvLines}</ul>
      </div>`;
    })() : "";
    document.getElementById("talPreviewBody").innerHTML = `
      <div class="talent-card k-${t.kind}">
        <span class="rarity-tag k-${t.kind}">${t.kind === "passive" ? "被动文心" : "主动文心"}</span>
        <h3>${C.esc(t.name)} <small style="font-size:12px;color:var(--ink2)">${C.esc(t.id)}</small></h3>
        <div class="etext">${C.esc(t.text)}</div>
        <div class="ev-accept" style="margin-top:10px">${effTxt}</div>
        ${cost}${sourceHtml}${upHtml}
        ${t.school ? `<div class="q-tags" style="margin-top:10px"><span class="t">流派：${SCHOOLS[t.school] || t.school}</span></div>` : ""}
      </div>`;
    C.openOverlay("talPreviewOverlay");
  }

  /* ---------------- 导入 / 导出 ---------------- */
  function importData(arr, mode) {
    const norm = arr.map(normalize).filter(t => t.id);
    if (mode) { state.talents = norm; C.toast("已替换为 " + norm.length + " 条"); }
    else {
      const map = new Map(state.talents.map((t, i) => [t.id, i]));
      let added = 0, updated = 0;
      norm.forEach(t => { if (map.has(t.id)) { state.talents[map.get(t.id)] = t; updated++; } else { state.talents.push(t); added++; } });
      C.toast(`合并完成：新增 ${added}，更新 ${updated}`);
    }
    // 云端工程可能来自旧版本，替换/合并后仍确保官方新增卡不会被旧内容反向删掉。
    backfillOfficialTalents();
    save(); renderList();
  }
  /* 导入文心升级配置（talent-upgrade.json）：按 ID 回填各文心的 upgrade 子对象。
     levels 为完整数组 Lv1..LvMax，去掉 Lv1（导出时恒从基础 effect 回填），保留 Lv2..LvMax。 */
  function importUpgrade(upData, mode) {
    const map = new Map(state.talents.map((t, i) => [t.id, i]));
    let applied = 0, skipped = 0;
    for (const [tid, u] of Object.entries(upData)) {
      if (!u || !Array.isArray(u.levels) || !("maxLevel" in u)) { skipped++; continue; }
      const idx = map.get(tid);
      if (idx == null) { skipped++; continue; }
      const base = state.talents[idx];
      const full = u.levels || [];
      const levelStyles = full.map(lv => normalizeStyle(lv.style));
      const levels = full.slice(1).map(lv => ({
        effect: normalizeEffect(lv.effect),
        cost: (lv.cost != null) ? Math.max(1, Number(lv.cost) || 1) : undefined
      }));
      const baseLevel = full[0] ? { effect: normalizeEffect(full[0].effect), cost: full[0].cost } : null;
      base.upgrade = normalizeUpgrade({ quality: u.quality, maxLevel: u.maxLevel, upCost: u.upCost || [], levels, levelStyles, baseLevel }, base);
      if (base._embeddedUpgrade !== true) base._embeddedUpgrade = false;
      applied++;
    }
    save(); renderList();
    C.toast(`升级配置回填：应用 ${applied} 枚，跳过（无对应文心）${skipped} 枚`);
  }
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { alert("JSON 解析失败：" + e.message); return; }
      // 优先识别「文心升级配置」：对象按 id 索引，值为 {quality, maxLevel, upCost, levels}
      if (!Array.isArray(data) && data && typeof data === "object") {
        const isUpgrade = Object.values(data).some(v => v && typeof v === "object" && Array.isArray(v.levels) && "maxLevel" in v);
        if (isUpgrade) {
          const mode = confirm(`读取到「文心升级配置」（含 ${Object.keys(data).length} 枚）。\n\n点击「确定」= 按 ID 覆盖升级数据；\n点击「取消」= 取消导入。`);
          if (mode) importUpgrade(data, true);
          return;
        }
      }
      let arr;
      if (Array.isArray(data)) arr = data;
      else if (Array.isArray(data.talents)) arr = data.talents;
      else if (Array.isArray(data.questions)) { alert("这是题库文件，请在「题库编辑器」中导入。"); return; }
      else if (Array.isArray(data.events)) { alert("这是奇遇文件，请在「奇遇编辑器」中导入。"); return; }
      else { alert("未识别的 JSON 结构（应为文心数组，或含 talents 字段的对象）。"); return; }
      const type = C.classify(arr);
      if (type !== "talents") { alert("未能识别为文心数据（需要含 kind:passive/active 字段）。"); return; }
      const norm = arr.map(normalize);
      const mode = confirm(`成功读取 ${norm.length} 条文心。\n\n点击「确定」= 替换当前文心；\n点击「取消」= 按 ID 合并（已存在则覆盖，不存在则追加）。`);
      importData(norm, mode);
    };
    reader.readAsText(file, "utf-8");
  }
  function exportTalent(t) {
    const out = JSON.parse(JSON.stringify(t));
    if (!out._embeddedUpgrade) delete out.upgrade;
    else if (out.upgrade) delete out.upgrade.baseLevel;
    delete out._embeddedUpgrade;
    return out;
  }
  function exportRaw() { return state.talents.map(exportTalent); }
  function exportMainRaw() {
    const ids = sidequestTalentIds();
    return state.talents.filter(t => !isSidequestTalent(t, ids)).map(exportTalent);
  }
  function exportSidequestRaw() {
    const ids = sidequestTalentIds();
    return state.talents.filter(t => isSidequestTalent(t, ids)).map(exportTalent);
  }
  function exportData() {
    const bad = validateAll();
    if (bad.length) {
      const names = bad.slice(0, 8).map(r => state.talents[r.i].id || "(无ID)").join("、");
      if (!confirm(`有 ${bad.length} 条文心存在校验问题（如：${names}…）。\n仍要导出吗？建议先修正再导出。`)) return;
    }
    if (!state.talents.length) { alert("文心库是空的，无可导出内容。"); return; }
    const data = JSON.stringify(exportRaw(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "talents.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    C.toast("已导出 talents.json（" + state.talents.length + " 条）");
  }
  /* 构造游戏可直接消费的文心升级表。工程文件与独立 talent-upgrade.json 共用此函数，
     防止云端只同步 talents、却继续沿用旧升级表而造成等级/effect/cost 来源分裂。 */
  function exportUpgradeRaw(filter) {
    const out = {};
    for (const t of state.talents.filter(t => t.upgrade && (!filter || filter(t)))) {
      const storedBaseEffect = t.upgrade.baseLevel && t.upgrade.baseLevel.effect;
      const baseEffect = normalizeEffect(storedBaseEffect || t.effect);
      const ls = t.upgrade.levelStyles || [];
      const levels = [{ effect: baseEffect }];
      const baseStyle = normalizeStyle(ls[0]);
      if (Object.values(baseStyle).some(Boolean)) levels[0].style = baseStyle;
      if (t.kind === "active" && t.cost != null) levels[0].cost = t.cost;
      for (let i = 0; i < t.upgrade.levels.length; i++) {
        const lv = t.upgrade.levels[i];
        const e = { effect: normalizeEffect(lv.effect) };
        const levelStyle = normalizeStyle(ls[i + 1]);
        if (Object.values(levelStyle).some(Boolean)) e.style = levelStyle;
        if (t.kind === "active" && lv.cost != null) e.cost = lv.cost;
        levels.push(e);
      }
      out[t.id] = { quality: t.upgrade.quality, maxLevel: t.upgrade.maxLevel, upCost: t.upgrade.upCost.map(Number), levels };
    }
    return out;
  }
  function exportMainUpgradeRaw() {
    const ids = sidequestTalentIds();
    return exportUpgradeRaw(t => !isSidequestTalent(t, ids));
  }
  function exportSidequestUpgradeRaw() {
    const ids = sidequestTalentIds();
    return exportUpgradeRaw(t => isSidequestTalent(t, ids));
  }
  /* 导出文心升级配置 talent-upgrade.json：仅含「可升级」文心。
     levels[0]（Lv1）恒等于文心基础 effect（主动文心附 base cost），Lv2..LvMax 取 upgrade.levels，
     与游戏 leveledTalent / upgradeTalent 的取值约定完全一致，并消除「改基础 effect 不生效」陷阱。 */
  function exportUpgrade() {
    const out = exportUpgradeRaw();
    const count = Object.keys(out).length;
    if (!count) { alert("尚无文心设置「可升级」。请在文心编辑里勾选「可升级文心」并填写品质档 / 等级上限 / 逐级数值后导出。"); return; }
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "talent-upgrade.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    C.toast("已导出 talent-upgrade.json（" + count + " 枚可升级文心）");
  }

  /* ---------------- 统计弹窗 ---------------- */
  function showStats() {
    const passive = state.talents.filter(t => t.kind === "passive").length;
    const active = state.talents.length - passive;
    const orphans = state.talents.filter(t => talentSources(t.id).length === 0).length;
    const bySchool = {};
    state.talents.forEach(t => { const s = t.school || "（无流派）"; bySchool[s] = (bySchool[s] || 0) + 1; });
    const row = (k, v) => `<tr><td>${k}</td><td class="num">${v}</td></tr>`;
    document.getElementById("talStBody").innerHTML = `
      <p><b>文心总数：</b>${state.talents.length}（被动 ${passive}，主动 ${active}）· <b style="color:${orphans ? "#b23a2e" : "inherit"}">孤儿文心 ${orphans}</b></p>
      <h4 style="margin:14px 0 6px">按流派</h4>
      <table class="stat-table"><tr><th>流派</th><th>数量</th></tr>
        ${Object.keys(bySchool).map(s => row(SCHOOLS[s] || s, bySchool[s])).join("")}</table>`;
    C.openOverlay("talStOverlay");
  }

  /* ---------------- 字段输入处理（事件委托） ---------------- */
  function handleField(e) {
    const t = e.target;
    if (!state.form) return;
    // 升级面板：品质档切换 → 同步 maxLevel / upCost 默认 / levels / levelStyles 长度并整体重渲染
    if (t.id === "tal-quality" && state.form.upgrade) {
      const q = t.value;
      state.form.upgrade.quality = q;
      state.form.upgrade.maxLevel = C.QUALITY_MAX[q] || 3;
      state.form.upgrade.upCost = (C.QUALITY_UPCOST[q] || [6, 10]).slice(0, state.form.upgrade.maxLevel - 1);
      const ml = state.form.upgrade.maxLevel;
      const baseEff = state.form.effect || { type: "on_win_bonus" };
      // levels 须按新 maxLevel-1 补全/截断，否则高品质档只显示低品质档的级数（如 common→legend 仍只有 2 级可编辑）
      while (state.form.upgrade.levels.length < ml - 1) state.form.upgrade.levels.push({ effect: JSON.parse(JSON.stringify(baseEff)), cost: (state.form.kind === "active" && state.form.cost != null) ? state.form.cost : undefined });
      while (state.form.upgrade.levels.length > ml - 1) state.form.upgrade.levels.pop();
      while (state.form.upgrade.levelStyles.length < ml) state.form.upgrade.levelStyles.push(defaultStyle());
      while (state.form.upgrade.levelStyles.length > ml) state.form.upgrade.levelStyles.pop();
      renderUpgradePanel();
      return;
    }
    // 升级面板：等级上限变更 → 重新钳制 upCost / levels / levelStyles 长度
    if (t.id === "tal-maxlevel" && state.form.upgrade) {
      const v = Math.max(1, Math.min(6, Number(t.value) || 1));
      const up = state.form.upgrade;
      up.maxLevel = v;
      const def = C.QUALITY_UPCOST[up.quality] || [6, 10];
      while (up.upCost.length < v - 1) up.upCost.push(def[up.upCost.length] != null ? def[up.upCost.length] : (up.upCost.length ? up.upCost[up.upCost.length - 1] : 6));
      while (up.upCost.length > v - 1) up.upCost.pop();
      const baseEff = state.form.effect || { type: "on_win_bonus" };
      // levels 同步按 v-1 补全/截断（此前遗漏，导致调大 maxLevel 后新级无法编辑）
      while (up.levels.length < v - 1) up.levels.push({ effect: JSON.parse(JSON.stringify(baseEff)), cost: (state.form.kind === "active" && state.form.cost != null) ? state.form.cost : undefined });
      while (up.levels.length > v - 1) up.levels.pop();
      while (up.levelStyles.length < v) up.levelStyles.push(defaultStyle());
      while (up.levelStyles.length > v) up.levelStyles.pop();
      renderUpgradePanel();
      return;
    }
    if (t.classList.contains("tal-upcost") && state.form.upgrade) {
      const i = Number(t.dataset.i);
      if (!Number.isNaN(i)) state.form.upgrade.upCost[i] = Math.max(0, Number(t.value) || 0);
      return;
    }
    // 升级：逐级效果类型切换 → 重置该级 effect 并重渲染
    if (t.classList.contains("tal-eff-type")) {
      const lb = t.closest(".lvl-eff");
      if (lb && state.form.upgrade) {
        const i = Number(lb.dataset.lvl);
        state.form.upgrade.levels[i].effect = defaultEffect(t.value);
        renderLevelEffects();
        // 同步刷新该级样式预览文案（此前遗漏，致改类型后预览仍显旧文案）
        updateStylePreviewText(i + 1);
        return;
      }
      state.form.effect = defaultEffect(t.value); renderEffectFields();
      // 基础效果类型切换也会影响 Lv1 预览
      updateStylePreviewText(0);
      return;
    }
    // 升级：逐级 cost（主动文心）
    if (t.classList.contains("tal-lvl-cost") && state.form.upgrade) {
      const i = Number(t.dataset.lvl);
      if (!Number.isNaN(i)) state.form.upgrade.levels[i].cost = Math.max(1, Number(t.value) || 1);
      return;
    }
    // 升级：逐级视觉样式（实时更新预览，不重渲染输入框以免失焦）
    if (state.form.upgrade && ["tal-s-font", "tal-s-size", "tal-s-color", "tal-s-lh", "tal-s-align", "tal-s-indent", "tal-s-margin"].some(c => t.classList.contains(c))) {
      const j = Number(t.dataset.lvl);
      if (!Number.isNaN(j) && state.form.upgrade.levelStyles[j]) {
        const st = state.form.upgrade.levelStyles[j];
        if (t.classList.contains("tal-s-font")) st.fontFamily = t.value;
        else if (t.classList.contains("tal-s-size")) st.fontSize = Math.max(0, Number(t.value) || 0);
        else if (t.classList.contains("tal-s-color")) st.color = t.value;
        else if (t.classList.contains("tal-s-lh")) st.lineHeight = Math.max(0, Number(t.value) || 0);
        else if (t.classList.contains("tal-s-align")) st.textAlign = t.value;
        else if (t.classList.contains("tal-s-indent")) st.textIndent = Math.max(0, Number(t.value) || 0);
        else if (t.classList.contains("tal-s-margin")) st.marginBottom = Math.max(0, Number(t.value) || 0);
        const prev = document.getElementById("talStylePrev-" + j);
        if (prev) prev.style.cssText = buildCss(st);
      }
      return;
    }
    if (t.id === "tal-id") state.form.id = t.value;
    else if (t.id === "tal-name") {
      state.form.name = t.value;
      // 文心名出现在每一级样式预览文案里，需逐级刷新
      if (state.form.upgrade) for (let j = 0; j < state.form.upgrade.maxLevel; j++) updateStylePreviewText(j);
    }
    else if (t.id === "tal-text") state.form.text = t.value;
    else if (t.id === "tal-school") state.form.school = t.value;
    else if (t.id === "tal-source") state.form.source = t.value;
    else if (t.id === "tal-cost") state.form.cost = Math.max(1, Number(t.value) || 1);
    else {
      // 决定当前编辑的 effect 对象（基础效果 或 某一级效果）
      const dyn = t.closest(".lvl-eff-dyn");
      const lvlIdx = dyn ? Number(dyn.dataset.lvl) : -1;
      const eff = (dyn && state.form.upgrade) ? state.form.upgrade.levels[lvlIdx].effect : (state.form.effect || null);
      if (!eff) return;
      if (t.classList.contains("tal-transform-mode")) {
        const next = defaultEffect("dice_transform"); next.mode = t.value;
        if (t.value === "first_floor") { delete next.threshold; delete next.value; delete next.count; next.floor = 4; next.noExtraDice = false; }
        if (t.value === "polarize") { delete next.threshold; delete next.count; next.minDice = 2; next.value = 0; }
        if (t.value === "lowest_to") { delete next.threshold; delete next.value; delete next.count; delete next.noExtraDice; next.maxPip = 3; next.target = 6; }
        if (dyn && state.form.upgrade) state.form.upgrade.levels[lvlIdx].effect = next; else state.form.effect = next;
        dyn ? renderLevelEffects() : renderEffectFields(); return;
      }
      if (t.classList.contains("tal-pattern")) {
        const next = defaultEffect("dice_pattern"); next.pattern = t.value;
        if (t.value === "all_high") next.minPip = 4;
        if (t.value === "total") next.threshold = 12;
        if (t.value === "first_last_equal") { next.minDice = 2; next.firstCostDiscount = 1; next.value = 0.12; }
        if (t.value === "low_and_high") { next.lowMax = 2; next.highMin = 5; next.value = 0.12; }
        if (t.value === "distinct") next.firstCostDiscount = 0;
        if (t.value === "all_distinct") { next.minDice = 3; next.firstCostDiscount = 2; next.value = 0.15; }
        if (t.value === "low_then_high") { next.lowMax = 2; next.nextHighMin = 5; next.conditionalFirstCostDiscount = 2; next.value = 0.1; }
        if (t.value === "ascending") { next.minDice = 2; next.perStepValue = 0.05; next.fullDice = 3; next.fullValue = 0.1; next.firstCostDiscount = 1; }
        if (t.value === "exact_total") { next.diceCount = 2; next.total = 7; next.firstExtraFree = true; next.value = 0.18; }
        if (t.value === "total_multiple") { next.multiple = 7; next.value = 0.18; }
        if (t.value === "total_tiers") { delete next.value; next.tiers = [{ threshold: 16, value: 0.3, reward: { type: "inspiration", value: 3, perMatch: false } }, { threshold: 12, value: 0.16, reward: { type: "inspiration", value: 3, perMatch: false } }]; }
        if (t.value === "extremes") { delete next.value; next.highMin = 5; next.highValue = 0.14; next.lowMax = 2; next.lowValue = -0.07; }
        if (dyn && state.form.upgrade) state.form.upgrade.levels[lvlIdx].effect = next; else state.form.effect = next;
        dyn ? renderLevelEffects() : renderEffectFields(); return;
      }
      if (t.classList.contains("tal-style")) eff.style = t.value;
      else if (t.classList.contains("tal-theme")) eff.theme = t.value;
      else if (t.classList.contains("tal-value-pct")) eff.value = (Number(t.value) || 0) / 100;
      else if (t.classList.contains("tal-value")) {
        // 百分比类效果：编辑器填整数百分比，引擎存小数（6 → 0.06）
        eff.value = PCT_VALUE_TYPES.includes(eff.type) ? (Number(t.value) || 0) / 100 : (Number(t.value) || 0);
      }
      else if (t.classList.contains("tal-chance")) eff.chance = Number(t.value) || 0;
      else if (t.classList.contains("tal-mult")) eff.mult = Number(t.value) || 0;
      else if (t.classList.contains("tal-threshold")) eff.threshold = Number(t.value) || 0;
      else if (t.classList.contains("tal-step")) eff.step = Math.max(1, Number(t.value) || 1);
      else if (t.classList.contains("tal-max-triggers")) eff.maxTriggers = Math.max(1, Number(t.value) || 1);
      else if (t.classList.contains("tal-reinc-th")) eff.inspThreshold = Math.max(0, Number(t.value) || 0);
      else if (t.classList.contains("tal-reinc-ratio")) eff.attrRatio = Math.max(0, Math.min(1, (Number(t.value) || 0) / 100));
      else if (t.classList.contains("tal-planned-max")) eff.maxValue = Math.max(1, Math.min(6, Number(t.value) || 6));
      else if (t.classList.contains("tal-planned-base")) eff.baseCost = Math.max(1, Number(t.value) || 5);
      else if (t.classList.contains("tal-planned-step")) eff.costStep = Math.max(0, Number(t.value) || 0);
      else if (t.classList.contains("tal-first-discount")) eff.firstCostDiscount = Math.max(0, Number(t.value) || 0);
      else if (t.classList.contains("tal-conditional-discount")) eff.conditionalFirstCostDiscount = Math.max(0, Number(t.value) || 0);
      else if (t.classList.contains("tal-next-high-min")) eff.nextHighMin = Math.max(1, Math.min(6, Number(t.value) || 5));
      else if (t.classList.contains("tal-min-dice")) eff.minDice = Math.max(2, Math.min(3, Number(t.value) || 3));
      else if (t.classList.contains("tal-step-pct")) eff.perStepValue = (Number(t.value) || 0) / 100;
      else if (t.classList.contains("tal-full-dice")) eff.fullDice = Math.max(2, Math.min(3, Number(t.value) || 3));
      else if (t.classList.contains("tal-full-pct")) eff.fullValue = (Number(t.value) || 0) / 100;
      else if (t.classList.contains("tal-dice-count")) eff.diceCount = Math.max(2, Math.min(3, Number(t.value) || 2));
      else if (t.classList.contains("tal-exact-total")) eff.total = Math.max(2, Number(t.value) || 7);
      else if (t.classList.contains("tal-total-multiple")) eff.multiple = Math.max(1, Number(t.value) || 7);
      else if (t.classList.contains("tal-first-free")) eff.firstExtraFree = t.value === "1";
      else if (t.classList.contains("tal-no-extra")) eff.noExtraDice = t.value === "1";
      else if (t.classList.contains("tal-chain-compare")) eff.compare = t.value;
      else if (t.classList.contains("tal-tier-high-threshold") || t.classList.contains("tal-tier-high-pct") || t.classList.contains("tal-tier-low-threshold") || t.classList.contains("tal-tier-low-pct") || t.classList.contains("tal-tier-reward")) {
        const tiers = Array.isArray(eff.tiers) ? eff.tiers.slice().sort((a,b) => (b.threshold || 0) - (a.threshold || 0)) : [];
        while (tiers.length < 2) tiers.push({ threshold: tiers.length ? 12 : 16, value: tiers.length ? 0.16 : 0.3, reward: { type: "inspiration", value: 3, perMatch: false } });
        if (t.classList.contains("tal-tier-high-threshold")) tiers[0].threshold = Math.max(1, Number(t.value) || 16);
        else if (t.classList.contains("tal-tier-high-pct")) tiers[0].value = (Number(t.value) || 0) / 100;
        else if (t.classList.contains("tal-tier-low-threshold")) tiers[1].threshold = Math.max(1, Number(t.value) || 12);
        else if (t.classList.contains("tal-tier-low-pct")) tiers[1].value = (Number(t.value) || 0) / 100;
        else { const value = Math.max(0, Number(t.value) || 0); for (const tier of tiers) tier.reward = { type: "inspiration", value, perMatch: false }; }
        eff.tiers = tiers;
      }
      else if (t.classList.contains("tal-count")) eff.count = Math.max(1, Number(t.value) || 1);
      else if (t.classList.contains("tal-floor")) eff.floor = Math.max(1, Math.min(6, Number(t.value) || 4));
      else if (t.classList.contains("tal-max-pip")) eff.maxPip = Math.max(1, Math.min(6, Number(t.value) || 3));
      else if (t.classList.contains("tal-target-pip")) eff.target = Math.max(1, Math.min(6, Number(t.value) || 6));
      else if (t.classList.contains("tal-min-pip")) eff.minPip = Math.max(1, Math.min(6, Number(t.value) || 4));
      else if (t.classList.contains("tal-high-min")) eff.highMin = Math.max(1, Math.min(6, Number(t.value) || 5));
      else if (t.classList.contains("tal-high-pct")) eff.highValue = (Number(t.value) || 0) / 100;
      else if (t.classList.contains("tal-low-max")) eff.lowMax = Math.max(1, Math.min(6, Number(t.value) || 2));
      else if (t.classList.contains("tal-low-pct")) eff.lowValue = (Number(t.value) || 0) / 100;
      else if (t.classList.contains("tal-insight")) eff.insight = Math.max(0, Number(t.value) || 0);
      else if (t.classList.contains("tal-cap-pct")) eff.cap = Math.max(0, (Number(t.value) || 0) / 100);
      else if (t.classList.contains("tal-reward-type")) {
        const key = eff.pattern === "ascending" ? "fullReward" : "reward";
        if (t.value === "none") delete eff[key];
        else eff[key] = { type: t.value, value: Number(eff[key] && eff[key].value) || 1, perMatch: eff[key] ? eff[key].perMatch !== false : true };
      }
      else if (t.classList.contains("tal-reward-value")) {
        const key = eff.pattern === "ascending" ? "fullReward" : "reward";
        if (!eff[key]) eff[key] = { type: "fragment", value: 0, perMatch: true };
        eff[key].value = Math.max(0, Number(t.value) || 0);
      }
      else if (t.classList.contains("tal-reward-once")) {
        const key = eff.pattern === "ascending" ? "fullReward" : "reward";
        if (!eff[key]) eff[key] = { type: "fragment", value: 1, perMatch: true };
        eff[key].perMatch = t.value !== "1";
      }
      else if (t.classList.contains("tal-attr-k")) {
        const row = t.closest(".eff-attr"); const oldK = row.dataset.k; const newK = t.value;
        if (newK && newK !== oldK && !(newK in eff.attrs)) { eff.attrs[newK] = eff.attrs[oldK]; delete eff.attrs[oldK]; row.dataset.k = newK; }
      }
      else if (t.classList.contains("tal-attr-v")) { const row = t.closest(".eff-attr"); eff.attrs[row.dataset.k] = Number(t.value) || 0; }
      // 同步刷新对应级样式预览文案（此前遗漏，致改数值后预览仍显旧文案）。轻量更新文本节点，不重建输入框，避免失焦。
      if (state.form.upgrade) updateStylePreviewText(lvlIdx >= 0 ? lvlIdx + 1 : 0);
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById("talBtnAdd").addEventListener("click", () => openEditor(-1));
    document.getElementById("talBtnSyncOfficial").addEventListener("click", syncOfficialTalents);
    document.getElementById("talBtnExport").addEventListener("click", exportData);
    document.getElementById("talBtnExportUpgrade").addEventListener("click", exportUpgrade);
    document.getElementById("talBtnStats").addEventListener("click", showStats);
    document.getElementById("talBtnImport").addEventListener("click", () => document.getElementById("talFileInput").click());
    document.getElementById("talFileInput").addEventListener("change", e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });

    document.getElementById("talCancel").addEventListener("click", closeEditor);
    document.getElementById("talSave").addEventListener("click", saveEditor);
    document.getElementById("talPreviewBtn").addEventListener("click", () => previewTalent(toTalent(state.form)));

    document.querySelectorAll('input[name=tal-kind]').forEach(r => r.addEventListener("change", () => {
      state.form.kind = r.value; toggleCost();
      if (state._suggestedId && (state.form.id === state._suggestedId || state.form.id === "")) {
        const tp = r.value === "active" ? "TA" : "T";
        state.form.id = C.nextSeqId(tp, state.talents.map(t => t.id), r.value === "active" ? 2 : 3);
        state._suggestedId = state.form.id;
        const el = document.getElementById("tal-id"); if (el) el.value = state.form.id;
      }
    }));

    const ov = document.getElementById("talOverlay");
    ["input", "change"].forEach(ev => ov.addEventListener(ev, handleField));
    ov.addEventListener("click", e => {
      const t = e.target;
      const link = t.closest("[data-link-talent]");
      if (link) {
        const tid = link.dataset.linkTalent;
        const sel = ov.querySelector(`[data-link-select="${tid}"]`);
        const raw = sel && sel.value;
        if (!raw) { C.toast("请先选择奇遇奖励位置"); return; }
        const p = raw.split("::");
        const result = global.ADV.linkTalent(tid, p[0], p[1]);
        if (!result.ok) { C.toast(result.message); return; }
        C.toast(result.message); renderTalentLinksPanel(); return;
      }
      const unlink = t.closest("[data-unlink-talent]");
      if (unlink) {
        const result = global.ADV.unlinkTalent(unlink.dataset.unlinkTalent, unlink.dataset.eventId, unlink.dataset.target);
        if (!result.ok) { C.toast(result.message); return; }
        C.toast(result.message); renderTalentLinksPanel(); return;
      }
      // 逐级样式「清除」按钮：重置该级样式为默认（输入态，可重渲染）
      if (t.classList.contains("lv-style-reset") && state.form && state.form.upgrade) {
        const j = Number(t.dataset.lvl);
        if (!Number.isNaN(j) && state.form.upgrade.levelStyles[j]) { state.form.upgrade.levelStyles[j] = defaultStyle(); renderStylePanel(); }
        return;
      }
      const dyn = t.closest(".lvl-eff-dyn");
      const lvlIdx = dyn ? Number(dyn.dataset.lvl) : -1;
      const eff = (dyn && state.form.upgrade) ? state.form.upgrade.levels[lvlIdx].effect : (state.form ? state.form.effect : null);
      if (t.classList.contains("tal-attr-add") && eff) {
        const free = ATTR_KEYS.find(k => !(k in eff.attrs));
        if (free) { eff.attrs[free] = 0; dyn ? renderLevelEffects() : renderEffectFields(); if (state.form.upgrade) updateStylePreviewText(lvlIdx >= 0 ? lvlIdx + 1 : 0); }
        return;
      }
      if (t.classList.contains("tal-attr-del") && eff) {
        const row = t.closest(".eff-attr"); delete eff.attrs[row.dataset.k]; dyn ? renderLevelEffects() : renderEffectFields(); if (state.form.upgrade) updateStylePreviewText(lvlIdx >= 0 ? lvlIdx + 1 : 0);
        return;
      }
      // 逐级「重置」按钮：该级效果恢复为 Lv1（基础 effect）
      if (t.classList.contains("lv-del") && state.form.upgrade) {
        const i = Number(t.dataset.lvl);
        if (!Number.isNaN(i)) {
          state.form.upgrade.levels[i].effect = JSON.parse(JSON.stringify(state.form.effect || { type: "on_win_bonus" }));
          if (state.form.kind === "active") state.form.upgrade.levels[i].cost = state.form.cost;
          renderLevelEffects();
          updateStylePreviewText(i + 1);
        }
        return;
      }
    });

    // 升级开关
    const upOn = document.getElementById("tal-upgrade-on");
    if (upOn) upOn.addEventListener("change", () => {
      if (upOn.checked) {
        if (!state.form.upgrade) {
          const q = "common";
          const ml = C.QUALITY_MAX[q];
          const baseEff = state.form.effect || { type: "on_win_bonus", style: "shi", value: 1 };
          // levels 须按 maxLevel-1 初始补全，否则渲染器会给出空的「满级 1 级」面板而无法编辑逐级效果
          const levels = Array.from({ length: ml - 1 }, () => ({ effect: JSON.parse(JSON.stringify(baseEff)), cost: (state.form.kind === "active" && state.form.cost != null) ? state.form.cost : undefined }));
          state.form.upgrade = { quality: q, maxLevel: ml, upCost: (C.QUALITY_UPCOST[q] || [6, 10]).slice(), levels, levelStyles: Array.from({ length: ml }, () => defaultStyle()) };
        }
      } else {
        state.form.upgrade = null;
      }
      renderUpgradePanel();
    });
    // 升级面板（动态元素）委托处理
    const upBox = document.getElementById("talUpgradeBox");
    if (upBox) {
      upBox.addEventListener("change", e => {
        const t = e.target;
        if (t.id === "tal-quality" || t.id === "tal-maxlevel") handleField(e); // 复用 handleField 的升级分支
      });
      upBox.addEventListener("input", e => {
        const t = e.target;
        if (t.classList.contains("tal-upcost")) handleField(e);
      });
      upBox.addEventListener("click", e => {
        if (e.target.id === "talUpcostAuto" && state.form.upgrade) {
          state.form.upgrade.upCost = (C.QUALITY_UPCOST[state.form.upgrade.quality] || [6, 10]).slice(0, state.form.upgrade.maxLevel - 1);
          renderUpcost();
        }
      });
    }

    document.getElementById("tallist").addEventListener("click", e => {
      const t = e.target;
      if (t.dataset.preview != null) return previewTalent(state.talents[Number(t.dataset.preview)]);
      if (t.dataset.edit != null) return openEditor(Number(t.dataset.edit));
      if (t.dataset.dup != null) return duplicate(Number(t.dataset.dup));
      if (t.dataset.del != null) return remove(Number(t.dataset.del));
    });

    document.getElementById("talStClose").addEventListener("click", () => C.closeOverlay("talStOverlay"));
    document.getElementById("talPreviewClose").addEventListener("click", () => C.closeOverlay("talPreviewOverlay"));
    // 预览里的「来源奇遇」点击 → 跳转到对应奇遇编辑
    document.getElementById("talPreviewBody").addEventListener("click", e => {
      const j = e.target.closest("[data-jump-ev]");
      if (j) {
        C.closeOverlay("talPreviewOverlay");
        const idx = global.ADV.get().findIndex(x => x.id === j.dataset.jumpEv);
        if (idx >= 0) global.ADV.openEditor(idx);
        else C.toast("未找到对应奇遇：" + j.dataset.jumpEv);
        return;
      }
      // 关联操作只在“编辑文心”弹窗提供；预览保留来源奇遇跳转即可。
    });
    ["talFSearch", "talFKind", "talFSchool"].forEach(id => {
      document.getElementById(id).addEventListener("input", renderList);
      document.getElementById(id).addEventListener("change", renderList);
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    loadData();
    bind();
    renderList();
    // 同步文心下拉提示（含用户新增的文心），供奇遇效果中引用
    const dl = document.getElementById("talentList");
    if (dl) dl.innerHTML = state.talents.map(t => `<option value="${t.id}">${C.esc(t.name)}</option>`).join("");
    global.TALENT._ready = true;
  }

  global.TALENT = {
    init, get: () => state.talents,
    exportRaw, exportMainRaw, exportSidequestRaw,
    exportUpgradeRaw, exportMainUpgradeRaw, exportSidequestUpgradeRaw, exportUpgrade,
    validateAll, importData, importUpgrade, syncOfficialTalents, renderList,
    effectText: talentEffectText, _ready: false
  };
})(window);
