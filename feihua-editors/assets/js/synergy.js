/* =========================================================================
 * synergy.js — 文心羁绊编辑器模块
 * 数据结构与游戏 config/synergies.json 完全兼容：
 *   {id, name, desc, members:[talentId...], effects:[{type, ...}]}
 * effect.type 覆盖得分、成长、资源与阶段条件；与游戏引擎的羁绊效果完全兼容。
 * 依赖 common.js（Common.*）。视觉与文心 / 奇遇编辑器保持同一套墨纸主题。
 *
 * 羁绊的语义：玩家同时持有 members 中全部文心时，effects 自动激活；
 * 替换掉任一成员会自然解除该羁绊（引擎每场实时重算，无堆叠态）。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;
  const STYLE_NAME = { shi: "诗", ci: "词", lian: "联", any: "任意体" };

  const SYN_EFFECT_TYPES = ["syn_pct", "style_pct", "theme_pct", "palace_pct", "on_win_bonus", "dice_plus", "dice_pattern", "extra_dice_pct", "crit", "comeback", "battle_history_pct", "armory_pct", "study_bonus", "insp_on_win", "insp_turn_regen", "insp_battle_recover", "style_switch_pct", "manuscript_pct", "streak_pct", "palace_insp", "insp_on_quiz"];
  const SYN_EFFECT_LABELS = {
    syn_pct: "全局得分加成（整局论战得分 +X%）",
    style_pct: "指定文体得分加成",
    theme_pct: "指定题材得分加成",
    palace_pct: "殿试得分加成",
    on_win_bonus: "以某体获胜时额外 +属性（呼应羁绊导向）",
    dice_plus: "灵感骰 +N（创作波动更稳健）",
    dice_pattern: "骰组形态触发（六点/对子/递增/总点）",
    extra_dice_pct: "每枚追加骰得分加成",
    crit: "暴击（概率触发得分倍率）",
    comeback: "逆境得分（灵感低于阈值时 +X%）",
    battle_history_pct: "依据上一场结果得分",
    armory_pct: "按持有文心数成长",
    study_bonus: "败/平研习补偿",
    insp_on_win: "胜利回复灵感",
    insp_turn_regen: "低灵感回合回复",
    insp_battle_recover: "战后回灵感（低于阈值，限次数）",
    style_switch_pct: "换体得分（与上一场不同文体时 +X%）",
    manuscript_pct: "稿本成长（每若干稿页 +X%，有上限）",
    streak_pct: "连捷得分（同文风连胜达到次数时 +X%）",
    palace_insp: "殿试蓄能（每场开场回复灵感）",
    insp_on_quiz: "答题回灵感（每局限次数）"
  };

  const state = { list: [], editIndex: -1, form: null, _ready: false };

  /* ---------------- 效果（默认 / 归一化） ---------------- */
  function defaultEffect(type) {
    if (type === "syn_pct") return { type, value: 0.05 };
    if (type === "style_pct") return { type, style: "shi", value: 0.08 };
    if (type === "theme_pct") return { type, theme: "shanshui", value: 0.08 };
    if (type === "palace_pct") return { type, value: 0.08 };
    if (type === "on_win_bonus") return { type, style: "any", value: 1 };
    if (type === "dice_plus") return { type, value: 1 };
    if (type === "dice_pattern") return { type, pattern: "six", value: 0.08 };
    if (type === "extra_dice_pct") return { type, value: 0.03, firstCostDiscount: 0 };
    if (type === "crit") return { type, chance: 0.12, mult: 1.4 };
    if (type === "comeback") return { type, threshold: 14, value: 0.05 };
    if (type === "battle_history_pct") return { type, result: "nonwin", value: 0.08 };
    if (type === "armory_pct") return { type, step: 4, value: 0.03, cap: 0.15 };
    if (type === "study_bonus") return { type, value: 2, nextBattlePct: 0.08 };
    if (type === "insp_on_win") return { type, value: 2 };
    if (type === "insp_turn_regen") return { type, value: 2, thresholdRatio: 0.6 };
    if (type === "insp_battle_recover") return { type, threshold: 14, value: 2, maxTriggers: 2 };
    if (type === "style_switch_pct") return { type, value: 0.06, insight: 1 };
    if (type === "manuscript_pct") return { type, step: 2, value: 0.01, cap: 0.06 };
    if (type === "streak_pct") return { type, minStreak: 2, value: 0.05 };
    if (type === "palace_insp") return { type, value: 2 };
    if (type === "insp_on_quiz") return { type, value: 1, maxTriggers: 3 };
    return { type, value: 0.05 };
  }
  function normalizeEffect(eff) {
    eff = eff || {};
    const type = SYN_EFFECT_TYPES.includes(eff.type) ? eff.type : "syn_pct";
    const out = { ...eff, type };
    if (type === "syn_pct") out.value = Number(eff.value) || 0;
    else if (["style_pct", "on_win_bonus"].includes(type)) {
      out.style = ["shi", "ci", "lian", "any"].includes(eff.style) ? eff.style : "any";
      out.value = Number(eff.value) || 0;
    }
    else if (["theme_pct", "palace_pct", "extra_dice_pct", "battle_history_pct", "study_bonus", "insp_on_win", "insp_turn_regen", "dice_pattern", "armory_pct"].includes(type)) {
      if (eff.value != null) out.value = Number(eff.value) || 0;
      else delete out.value;
    }
    else if (type === "dice_plus") out.value = Number(eff.value) || 0;
    else if (type === "crit") { out.chance = Number(eff.chance) || 0; out.mult = Number(eff.mult) || 0; }
    else if (type === "comeback") { out.threshold = Number(eff.threshold) || 0; out.value = Number(eff.value) || 0; }
    else if (type === "insp_battle_recover") { out.threshold = Number(eff.threshold) || 0; out.value = Number(eff.value) || 0; out.maxTriggers = Number(eff.maxTriggers) || 0; }
    else if (type === "style_switch_pct") { out.value = Number(eff.value) || 0; out.insight = Number(eff.insight) || 0; }
    else if (type === "manuscript_pct") { out.step = Number(eff.step) || 0; out.value = Number(eff.value) || 0; out.cap = Number(eff.cap) || 0; }
    else if (type === "streak_pct") { out.minStreak = Number(eff.minStreak) || 0; out.value = Number(eff.value) || 0; }
    else if (type === "palace_insp") out.value = Number(eff.value) || 0;
    else if (type === "insp_on_quiz") { out.value = Number(eff.value) || 0; out.maxTriggers = Number(eff.maxTriggers) || 0; }
    out.effectId = String(eff.effectId || '').trim();
    out.stackGroup = String(eff.stackGroup || '').trim();
    out.stackMode = ['add', 'max', 'replace'].includes(eff.stackMode) ? eff.stackMode : 'add';
    if (!out.effectId) delete out.effectId;
    if (!out.stackGroup) delete out.stackGroup;
    return out;
  }
  const talentName = id => (C.TALENTS && C.TALENTS[id]) ? C.TALENTS[id] : id;
  const allTalentIds = () => C.talentIds();

  /* ---------------- 持久化 ---------------- */
  function save() {
    C.store("synergies", state.list);
    const t = new Date();
    C.setStatus("syn", "已自动保存 " + t.toLocaleTimeString("zh-CN", { hour12: false }));
  }
  function loadData() {
    const raw = C.load("synergies", null);
    if (raw && raw.length) {
      state.list = raw.map(normalize);
      const existing = new Set(state.list.map(s => s.id));
      const additions = (window.GAME_SYNERGIES || []).map(normalize).filter(s => s.id && !existing.has(s.id));
      if (additions.length) {
        state.list.push(...additions);
        C.store("synergies", state.list);
      }
    }
    else {
      state.list = (window.GAME_SYNERGIES || []).map(normalize);
      C.store("synergies", state.list);
    }
  }

  /* ---------------- 规范化 ---------------- */
  function normalize(s) {
    s = s || {};
    return {
      id: String(s.id || "").trim(),
      name: String(s.name || "").trim(),
      desc: String(s.desc || "").trim(),
      members: Array.isArray(s.members) ? s.members.map(m => String(m).trim()).filter(Boolean) : [],
      effects: Array.isArray(s.effects) && s.effects.length
        ? s.effects.map(normalizeEffect)
        : [defaultEffect("syn_pct")]
    };
  }

  /* ---------------- 校验（对齐游戏 synergySet：members 全持有才激活） ---------------- */
  function validate(s, all, selfIndex) {
    const errors = [];
    if (!s.id) errors.push("羁绊 ID 不能为空");
    else if (!/^[A-Za-z0-9_\-]+$/.test(s.id)) errors.push("ID 只能含字母、数字、下划线和连字符");
    else {
      const dup = all.findIndex((x, i) => x.id === s.id && i !== selfIndex);
      if (dup >= 0) errors.push("ID 与第 " + (dup + 1) + " 条重复");
    }
    if (!s.name) errors.push("羁绊名称不能为空");
    if (!s.desc) errors.push("羁绊描述不能为空");
    if (s.members.length < 2) errors.push("成员需至少 2 枚文心（才能构成「羁绊」）");
    else {
      const ids = allTalentIds();
      const unknown = s.members.filter(m => !ids.includes(m));
      if (unknown.length) errors.push("未知文心 ID：" + unknown.join("、"));
    }
    if (!s.effects.length) errors.push("至少需 1 条效果");
    else s.effects.forEach((ef, i) => {
      if (!SYN_EFFECT_TYPES.includes(ef.type)) errors.push("第 " + (i + 1) + " 条效果类型非法：" + ef.type);
      else if (ef.type === "syn_pct" && !(Number(ef.value) > 0)) errors.push("第 " + (i + 1) + " 条 syn_pct 的 value 须 > 0");
      else if (ef.type === "on_win_bonus" && !(Number(ef.value) > 0)) errors.push("第 " + (i + 1) + " 条 on_win_bonus 的 value 须 > 0");
      else if (ef.type === "dice_plus" && !(Number(ef.value) > 0)) errors.push("第 " + (i + 1) + " 条 dice_plus 的 value 须 > 0");
      else if (ef.type === "crit" && !(Number(ef.chance) > 0)) errors.push("第 " + (i + 1) + " 条 crit 的 chance 须 > 0");
      else if (["comeback", "style_switch_pct", "manuscript_pct", "streak_pct"].includes(ef.type) && !(Number(ef.value) > 0)) errors.push("第 " + (i + 1) + " 条效果加成须 > 0");
      else if (["insp_battle_recover", "palace_insp", "insp_on_quiz"].includes(ef.type) && !(Number(ef.value) > 0)) errors.push("第 " + (i + 1) + " 条灵感回复须 > 0");
    });
    const effectIds = s.effects.map(e => e.effectId).filter(Boolean);
    if (new Set(effectIds).size !== effectIds.length) errors.push("同一羁绊内 effectId 不可重复");
    return { ok: errors.length === 0, errors };
  }
  function validateAll() {
    return state.list.map((s, i) => ({ i, ...validate(s, state.list, i) })).filter(r => !r.ok);
  }

  /* ---------------- 效果文本 ---------------- */
  function effectText(ef) {
    if (!ef || !ef.type) return "（无效果）";
    switch (ef.type) {
      case "syn_pct": return "论战得分 +" + Math.round((ef.value || 0) * 100) + "%";
      case "style_pct": return (STYLE_NAME[ef.style] || ef.style) + "体得分 +" + Math.round((ef.value || 0) * 100) + "%";
      case "theme_pct": return "指定题材得分 +" + Math.round((ef.value || 0) * 100) + "%";
      case "palace_pct": return "殿试得分 +" + Math.round((ef.value || 0) * 100) + "%";
      case "on_win_bonus": return "以" + (STYLE_NAME[ef.style] || ef.style) + "出战获胜 +" + (ef.value || 0);
      case "dice_plus": return "灵感骰 +" + (ef.value || 0);
      case "dice_pattern": return "骰组「" + (ef.pattern || 'six') + "」触发 +" + Math.round((ef.value || 0) * 100) + "%";
      case "extra_dice_pct": return "每枚追加骰 +" + Math.round((ef.value || 0) * 100) + "%";
      case "crit": return Math.round((ef.chance || 0) * 100) + "% 概率得分 ×" + (ef.mult || 0);
      case "comeback": return "灵感≤" + (ef.threshold || 0) + "时得分 +" + Math.round((ef.value || 0) * 100) + "%";
      case "battle_history_pct": return "上一场未胜时得分 +" + Math.round((ef.value || 0) * 100) + "%";
      case "armory_pct": return "每 " + (ef.step || 4) + " 枚文心 +" + Math.round((ef.value || 0) * 100) + "%（上限 " + Math.round((ef.cap || 0) * 100) + "%）";
      case "study_bonus": return "败/平研习 +" + (ef.value || 0);
      case "insp_on_win": return "获胜回复 " + (ef.value || 0) + " 灵感";
      case "insp_turn_regen": return "低灵感时每回合回复 " + (ef.value || 0);
      case "insp_battle_recover": return "战后灵感≤" + (ef.threshold || 0) + "回复 " + (ef.value || 0) + "（限 " + (ef.maxTriggers || 0) + " 次）";
      case "style_switch_pct": return "换体时得分 +" + Math.round((ef.value || 0) * 100) + "%、心得 +" + (ef.insight || 0);
      case "manuscript_pct": return "每 " + (ef.step || 0) + " 稿页得分 +" + Math.round((ef.value || 0) * 100) + "%（最多 " + Math.round((ef.cap || 0) * 100) + "%）";
      case "streak_pct": return "连捷 " + (ef.minStreak || 0) + " 场后得分 +" + Math.round((ef.value || 0) * 100) + "%";
      case "palace_insp": return "殿试每场灵感 +" + (ef.value || 0);
      case "insp_on_quiz": return "有效答题灵感 +" + (ef.value || 0) + "（限 " + (ef.maxTriggers || 0) + " 次）";
      default: return ef.type;
    }
  }

  /* ---------------- 筛选 / 列表 ---------------- */
  function getFilters() { return { q: (document.getElementById("synFSearch").value || "").trim().toLowerCase() }; }
  function filtered() {
    const f = getFilters();
    return state.list.filter(s => {
      if (!f.q) return true;
      const hay = [s.id, s.name, s.desc, s.members.map(talentName).join(" "), s.effects.map(effectText).join(" ")].join(" ").toLowerCase();
      return hay.includes(f.q);
    });
  }
  function renderStats() {
    const total = state.list.length;
    document.getElementById("synStatStrip").innerHTML = `
      <div class="stat"><b>${total}</b><span>羁绊总数</span></div>
      <div class="stat"><b>${state.list.reduce((a, s) => a + s.members.length, 0)}</b><span>成员关联总次数</span></div>
      <div class="stat"><b>${state.list.filter(s => s.effects.some(e => e.type === "syn_pct")).length}</b><span>含全局加成</span></div>
      <div class="stat"><b>${validateAll().length}</b><span>校验问题</span></div>`;
  }
  function renderList() {
    renderStats();
    const list = document.getElementById("synlist");
    const items = filtered();
    if (!items.length) {
      list.innerHTML = `<div class="empty"><b>${state.list.length ? "没有符合筛选条件的羁绊" : "羁绊库还是空的"}</b>
        ${state.list.length ? "试着调整上方筛选条件。" : "点击「＋ 新增羁绊」开始，或「导入 JSON」载入现有的 synergies.json。"}</div>`;
      return;
    }
    list.innerHTML = items.map(s => {
      const idx = state.list.indexOf(s);
      const mem = s.members.map(m => `<span class="t">${C.esc(talentName(m))}</span>`).join("");
      const eff = s.effects.map(effectText).join("　");
      return `<div class="q-card" data-idx="${idx}">
        <div class="meta"><span class="q-id">${C.esc(s.id)}</span></div>
        <div class="q-main">
          <p class="q-name">${C.esc(s.name)}</p>
          <div class="q-tags">${mem}</div>
          <div class="q-opts">${C.esc(eff)}</div>
          <div class="q-text">${C.esc(s.desc)}</div>
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

  /* ---------------- 成员 / 效果编辑器（模态内动态渲染） ---------------- */
  function renderMembers() {
    const ids = allTalentIds();
    document.getElementById("synMembers").innerHTML = `
      <div class="syn-members-row">
        <select id="synMemberPick">${ids.map(id => `<option value="${id}">${id} · ${C.esc(talentName(id))}</option>`).join("")}</select>
        <button class="btn sm" id="synMemberAdd">＋ 添加成员</button>
      </div>
      <div class="syn-chips" id="synMemberChips">${state.form.members.map(m =>
        `<span class="syn-chip">${C.esc(talentName(m))}<button class="x" data-mx="${m}" title="移除">×</button></span>`).join("")}</div>`;
  }
  function effParamsHtml(ef) {
    if (ef.type === "syn_pct")
      return `<label>比例（0.05 = 5%）<input type="number" class="syn-val" value="${ef.value || 0}" step="0.01" min="0"/></label>`;
    if (ef.type === "style_pct")
      return `<label>文体<select class="syn-style">${["shi", "ci", "lian", "any"].map(s => `<option value="${s}" ${s === ef.style ? "selected" : ""}>${STYLE_NAME[s]}</option>`).join("")}</select></label><label>得分比例<input type="number" class="syn-val" value="${ef.value || 0}" step="0.01" min="0"/></label>`;
    if (["theme_pct", "palace_pct", "extra_dice_pct", "battle_history_pct", "study_bonus", "insp_on_win", "insp_turn_regen", "armory_pct"].includes(ef.type)) {
      const extra = ef.type === 'armory_pct' ? `<label>每几枚<input type="number" class="syn-step" value="${ef.step || 4}" step="1" min="1"/></label><label>上限<input type="number" class="syn-cap" value="${ef.cap || 0.15}" step="0.01" min="0"/></label>`
        : ef.type === 'insp_turn_regen' ? `<label>触发比例<input type="number" class="syn-threshold-ratio" value="${ef.thresholdRatio || 0.6}" step="0.05" min="0" max="1"/></label>`
        : ef.type === 'study_bonus' ? `<label>下场得分<input type="number" class="syn-next-pct" value="${ef.nextBattlePct || 0}" step="0.01" min="0"/></label>` : '';
      return `<label>${['study_bonus','insp_on_win','insp_turn_regen'].includes(ef.type) ? '数值' : '比例'}<input type="number" class="syn-val" value="${ef.value || 0}" step="0.01" min="0"/></label>${extra}`;
    }
    if (ef.type === "dice_pattern")
      return `<label>骰组模式<select class="syn-pattern">${['six','pair','all_distinct','low_then_high','ascending','total_multiple','total_tiers'].map(p => `<option value="${p}" ${p === ef.pattern ? 'selected' : ''}>${p}</option>`).join('')}</select></label><label>得分比例<input type="number" class="syn-val" value="${ef.value || 0}" step="0.01" min="0"/></label>`;
    if (ef.type === "on_win_bonus")
      return `<label>出战体<select class="syn-style">${["shi", "ci", "lian", "any"].map(s => `<option value="${s}" ${s === ef.style ? "selected" : ""}>${STYLE_NAME[s]}</option>`).join("")}</select></label>
              <label>额外 +值<input type="number" class="syn-val" value="${ef.value || 0}" step="1" min="0"/></label>`;
    if (ef.type === "dice_plus")
      return `<label>灵感骰 +<input type="number" class="syn-val" value="${ef.value || 0}" step="1" min="0"/></label>`;
    if (ef.type === "crit")
      return `<label>触发概率<input type="number" class="syn-chance" value="${ef.chance || 0}" step="0.01" min="0" max="1"/></label>
              <label>倍率<input type="number" class="syn-mult" value="${ef.mult || 0}" step="0.1" min="1"/></label>`;
    if (ef.type === "comeback")
      return `<label>灵感阈值<input type="number" class="syn-threshold" value="${ef.threshold || 0}" step="1" min="0"/></label>
              <label>得分比例<input type="number" class="syn-val" value="${ef.value || 0}" step="0.01" min="0"/></label>`;
    if (ef.type === "insp_battle_recover")
      return `<label>灵感阈值<input type="number" class="syn-threshold" value="${ef.threshold || 0}" step="1" min="0"/></label>
              <label>回复<input type="number" class="syn-val" value="${ef.value || 0}" step="1" min="0"/></label>
              <label>每局次数<input type="number" class="syn-max-triggers" value="${ef.maxTriggers || 0}" step="1" min="1"/></label>`;
    if (ef.type === "style_switch_pct")
      return `<label>得分比例<input type="number" class="syn-val" value="${ef.value || 0}" step="0.01" min="0"/></label>
              <label>心得<input type="number" class="syn-insight" value="${ef.insight || 0}" step="1" min="0"/></label>`;
    if (ef.type === "manuscript_pct")
      return `<label>每几稿页<input type="number" class="syn-step" value="${ef.step || 0}" step="1" min="1"/></label>
              <label>每层比例<input type="number" class="syn-val" value="${ef.value || 0}" step="0.01" min="0"/></label>
              <label>上限比例<input type="number" class="syn-cap" value="${ef.cap || 0}" step="0.01" min="0"/></label>`;
    if (ef.type === "streak_pct")
      return `<label>连捷场数<input type="number" class="syn-min-streak" value="${ef.minStreak || 0}" step="1" min="1"/></label>
              <label>得分比例<input type="number" class="syn-val" value="${ef.value || 0}" step="0.01" min="0"/></label>`;
    if (ef.type === "palace_insp")
      return `<label>每场回复<input type="number" class="syn-val" value="${ef.value || 0}" step="1" min="0"/></label>`;
    if (ef.type === "insp_on_quiz")
      return `<label>每次回复<input type="number" class="syn-val" value="${ef.value || 0}" step="1" min="0"/></label>
              <label>每局次数<input type="number" class="syn-max-triggers" value="${ef.maxTriggers || 0}" step="1" min="1"/></label>`;
    return "";
  }
  function renderEffects() {
    document.getElementById("synEffectBox").innerHTML = state.form.effects.map((ef, i) => `
      <div class="syn-eff-row" data-i="${i}">
        <select class="syn-eff-type">${SYN_EFFECT_TYPES.map(t => `<option value="${t}" ${t === ef.type ? "selected" : ""}>${SYN_EFFECT_LABELS[t]}</option>`).join("")}</select>
        ${effParamsHtml(ef)}
        <label>效果 ID<input class="syn-effect-id" value="${C.esc(ef.effectId || '')}" placeholder="如 S01-E1"/></label>
        <label>叠加组<input class="syn-stack-group" value="${C.esc(ef.stackGroup || '')}" placeholder="如 synergy-score"/></label>
        <label>叠加<select class="syn-stack-mode">${['add','max','replace'].map(x => `<option value="${x}" ${x === (ef.stackMode || 'add') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
        <label style="grid-column:1/-1">高级条件 when（JSON）<textarea class="syn-when-json" rows="2" placeholder='{"themes":["yongwu"],"inspirationRatioMin":0.6}'>${C.esc(ef.when ? JSON.stringify(ef.when) : '')}</textarea></label>
        <label style="grid-column:1/-1">触发奖励 reward（JSON）<textarea class="syn-reward-json" rows="2" placeholder='{"type":"inspiration","value":2,"perMatch":false}'>${C.esc(ef.reward ? JSON.stringify(ef.reward) : '')}</textarea></label>
        <button class="opt-del syn-eff-del" title="删除效果">×</button>
      </div>`).join("") + `<button class="btn sm opt-add syn-eff-add">＋ 添加效果</button>`;
  }

  /* ---------------- 编辑弹窗 ---------------- */
  function openEditor(index) {
    state.editIndex = index;
    const src = index >= 0 ? state.list[index] : null;
    if (src) {
      state.form = {
        id: src.id, name: src.name, desc: src.desc,
        members: src.members.slice(),
        effects: src.effects.map(e => JSON.parse(JSON.stringify(e)))
      };
    } else {
      state.form = { id: "", name: "", desc: "", members: [], effects: [defaultEffect("syn_pct")] };
      state.form.id = C.nextSeqId("S", state.list.map(s => s.id), 2);
    }
    document.getElementById("synTitle").textContent = src ? "编辑羁绊 · " + src.id : "新增羁绊";
    document.getElementById("syn-id").value = state.form.id;
    document.getElementById("syn-name").value = state.form.name;
    document.getElementById("syn-desc").value = state.form.desc;
    const msg = document.getElementById("synMsg"); msg.className = "msg"; msg.textContent = "";
    renderMembers();
    renderEffects();
    C.openOverlay("synOverlay");
  }
  function closeEditor() { C.closeOverlay("synOverlay"); state.editIndex = -1; state.form = null; }

  function toSynergy(form) {
    return {
      id: form.id.trim(), name: form.name.trim(), desc: form.desc.trim(),
      members: form.members.slice(),
      effects: form.effects.map((effect, i) => {
        const out = normalizeEffect(effect);
        if (!out.effectId) out.effectId = `${form.id.trim() || 'SXX'}-E${i + 1}`;
        return out;
      })
    };
  }
  function saveEditor() {
    // 同步表单输入框（id/name/desc 可能未触发事件）
    state.form.id = document.getElementById("syn-id").value;
    state.form.name = document.getElementById("syn-name").value;
    state.form.desc = document.getElementById("syn-desc").value;
    const invalid = document.querySelector("#synOverlay :invalid");
    if (invalid) { invalid.reportValidity(); return; }
    const s = toSynergy(state.form);
    const { ok, errors } = validate(s, state.list, state.editIndex);
    const msg = document.getElementById("synMsg");
    if (!ok) { msg.className = "msg err"; msg.innerHTML = "✗ 无法保存：<br>• " + errors.join("<br>• "); return; }
    if (state.editIndex >= 0) { state.list[state.editIndex] = s; C.toast("已更新 " + s.id); }
    else { state.list.push(s); C.toast("已新增 " + s.id); }
    save(); closeEditor(); renderList();
  }

  /* ---------------- 操作 ---------------- */
  function duplicate(idx) {
    const copy = JSON.parse(JSON.stringify(state.list[idx]));
    let base = copy.id, n = 1, newId;
    do { newId = base + "_" + n; n++; } while (state.list.some(s => s.id === newId));
    copy.id = newId;
    state.list.splice(idx + 1, 0, copy);
    save(); renderList(); C.toast("已复制为 " + newId);
  }
  function remove(idx) {
    const s = state.list[idx];
    if (!confirm(`确定删除羁绊「${s.id} · ${s.name}」？此操作不可撤销。`)) return;
    state.list.splice(idx, 1);
    save(); renderList(); C.toast("已删除 " + s.id);
  }

  /* ---------------- 预览 ---------------- */
  function previewSynergy(s) {
    const mem = s.members.map(m => `<span class="t">${C.esc(talentName(m))}</span>`).join("");
    const eff = s.effects.map(effectText).join("　");
    document.getElementById("synPreviewBody").innerHTML = `
      <div class="talent-card">
        <span class="rarity-tag">文心羁绊</span>
        <h3>${C.esc(s.name)} <small style="font-size:12px;color:var(--ink2)">${C.esc(s.id)}</small></h3>
        <div class="etext">${C.esc(s.desc)}</div>
        <div class="q-tags" style="margin-top:10px">${mem}</div>
        <div class="ev-accept" style="margin-top:10px">${eff}</div>
        <div class="q-text" style="margin-top:8px;color:var(--ink2)">同时持有上述文心即激活；替换掉任一成员会自然解除。</div>
      </div>`;
    C.openOverlay("synPreviewOverlay");
  }

  /* ---------------- 导入 / 导出 ---------------- */
  function importData(arr, mode) {
    const norm = arr.map(normalize).filter(s => s.id);
    if (mode) { state.list = norm; C.toast("已替换为 " + norm.length + " 条"); }
    else {
      const map = new Map(state.list.map((s, i) => [s.id, i]));
      let added = 0, updated = 0;
      norm.forEach(s => { if (map.has(s.id)) { state.list[map.get(s.id)] = s; updated++; } else { state.list.push(s); added++; } });
      C.toast(`合并完成：新增 ${added}，更新 ${updated}`);
    }
    save(); renderList();
  }
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { alert("JSON 解析失败：" + e.message); return; }
      let arr;
      if (Array.isArray(data)) arr = data;
      else if (Array.isArray(data.synergies)) arr = data.synergies;
      else if (Array.isArray(data.talents)) { alert("这是文心文件，请在「文心编辑器」中导入。"); return; }
      else if (Array.isArray(data.questions)) { alert("这是题库文件，请在「题库编辑器」中导入。"); return; }
      else { alert("未识别的 JSON 结构（应为羁绊数组，或含 synergies 字段的对象）。"); return; }
      const mode = confirm(`成功读取 ${arr.length} 条羁绊。\n\n点击「确定」= 替换当前；\n点击「取消」= 按 ID 合并（已存在覆盖，不存在追加）。`);
      importData(arr, mode);
    };
    reader.readAsText(file, "utf-8");
  }
  function exportRaw() { return state.list.map(s => JSON.parse(JSON.stringify(s))); }
  function exportData() {
    const bad = validateAll();
    if (bad.length) {
      const names = bad.slice(0, 8).map(r => state.list[r.i].id || "(无ID)").join("、");
      if (!confirm(`有 ${bad.length} 条羁绊存在校验问题（如：${names}…）。\n仍要导出吗？建议先修正。`)) return;
    }
    if (!state.list.length) { alert("羁绊库是空的，无可导出内容。"); return; }
    const data = JSON.stringify(exportRaw(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "synergies.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    C.toast("已导出 synergies.json（" + state.list.length + " 条）");
  }

  /* ---------------- 统计弹窗 ---------------- */
  function showStats() {
    const byType = {};
    state.list.forEach(s => s.effects.forEach(ef => { byType[ef.type] = (byType[ef.type] || 0) + 1; }));
    const row = (k, v) => `<tr><td>${SYN_EFFECT_LABELS[k] || k}</td><td class="num">${v}</td></tr>`;
    document.getElementById("synStBody").innerHTML = `
      <p><b>羁绊总数：</b>${state.list.length}（校验问题 ${validateAll().length} 条）</p>
      <h4 style="margin:14px 0 6px">效果类型分布</h4>
      <table class="stat-table"><tr><th>效果类型</th><th>出现次数</th></tr>
        ${Object.keys(byType).map(k => row(k, byType[k])).join("") || '<tr><td colspan="2">暂无</td></tr>'}</table>`;
    C.openOverlay("synStOverlay");
  }

  /* ---------------- 字段输入处理（事件委托） ---------------- */
  function handleField(e) {
    const t = e.target;
    if (!state.form) return;
    if (t.id === "syn-id") state.form.id = t.value;
    else if (t.id === "syn-name") state.form.name = t.value;
    else if (t.id === "syn-desc") state.form.desc = t.value;
    else if (t.classList.contains("syn-eff-type")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i] = defaultEffect(t.value);
      renderEffects();
    } else if (t.classList.contains("syn-style")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].style = t.value;
    } else if (t.classList.contains("syn-val")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].value = Number(t.value) || 0;
    } else if (t.classList.contains("syn-chance")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].chance = Number(t.value) || 0;
    } else if (t.classList.contains("syn-mult")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].mult = Number(t.value) || 0;
    } else if (t.classList.contains("syn-threshold")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].threshold = Number(t.value) || 0;
    } else if (t.classList.contains("syn-max-triggers")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].maxTriggers = Number(t.value) || 0;
    } else if (t.classList.contains("syn-insight")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].insight = Number(t.value) || 0;
    } else if (t.classList.contains("syn-step")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].step = Number(t.value) || 0;
    } else if (t.classList.contains("syn-cap")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].cap = Number(t.value) || 0;
    } else if (t.classList.contains("syn-min-streak")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      state.form.effects[i].minStreak = Number(t.value) || 0;
    } else if (t.classList.contains("syn-pattern")) {
      state.form.effects[Number(t.closest(".syn-eff-row").dataset.i)].pattern = t.value;
    } else if (t.classList.contains("syn-effect-id")) {
      state.form.effects[Number(t.closest(".syn-eff-row").dataset.i)].effectId = t.value.trim();
    } else if (t.classList.contains("syn-stack-group")) {
      state.form.effects[Number(t.closest(".syn-eff-row").dataset.i)].stackGroup = t.value.trim();
    } else if (t.classList.contains("syn-stack-mode")) {
      state.form.effects[Number(t.closest(".syn-eff-row").dataset.i)].stackMode = t.value;
    } else if (t.classList.contains("syn-threshold-ratio")) {
      state.form.effects[Number(t.closest(".syn-eff-row").dataset.i)].thresholdRatio = Number(t.value) || 0;
    } else if (t.classList.contains("syn-next-pct")) {
      state.form.effects[Number(t.closest(".syn-eff-row").dataset.i)].nextBattlePct = Number(t.value) || 0;
    } else if (t.classList.contains("syn-when-json") || t.classList.contains("syn-reward-json")) {
      const i = Number(t.closest(".syn-eff-row").dataset.i);
      const key = t.classList.contains("syn-when-json") ? 'when' : 'reward';
      try { if (t.value.trim()) state.form.effects[i][key] = JSON.parse(t.value); else delete state.form.effects[i][key]; t.setCustomValidity(''); }
      catch (_) { t.setCustomValidity('请输入有效 JSON'); }
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById("synBtnAdd").addEventListener("click", () => openEditor(-1));
    document.getElementById("synBtnExport").addEventListener("click", exportData);
    document.getElementById("synBtnStats").addEventListener("click", showStats);
    document.getElementById("synBtnImport").addEventListener("click", () => document.getElementById("synFileInput").click());
    document.getElementById("synFileInput").addEventListener("change", e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });

    document.getElementById("synCancel").addEventListener("click", closeEditor);
    document.getElementById("synSave").addEventListener("click", saveEditor);

    const ov = document.getElementById("synOverlay");
    ["input", "change"].forEach(ev => ov.addEventListener(ev, handleField));
    ov.addEventListener("click", e => {
      const t = e.target;
      if (t.id === "synMemberAdd" && state.form) {
        const pick = document.getElementById("synMemberPick");
        const id = pick.value;
        if (id && !state.form.members.includes(id)) { state.form.members.push(id); renderMembers(); }
        return;
      }
      if (t.classList.contains("x") && state.form) {
        const m = t.dataset.mx;
        state.form.members = state.form.members.filter(x => x !== m);
        renderMembers();
        return;
      }
      if (t.classList.contains("syn-eff-add") && state.form) {
        state.form.effects.push(defaultEffect("syn_pct"));
        renderEffects();
        return;
      }
      if (t.classList.contains("syn-eff-del") && state.form) {
        const i = Number(t.closest(".syn-eff-row").dataset.i);
        state.form.effects.splice(i, 1);
        if (!state.form.effects.length) state.form.effects.push(defaultEffect("syn_pct"));
        renderEffects();
      }
    });

    document.getElementById("synPreviewBtn") && document.getElementById("synPreviewBtn").addEventListener("click", () => {
      state.form.id = document.getElementById("syn-id").value;
      state.form.name = document.getElementById("syn-name").value;
      state.form.desc = document.getElementById("syn-desc").value;
      previewSynergy(toSynergy(state.form));
    });

    document.getElementById("synlist").addEventListener("click", e => {
      const t = e.target;
      if (t.dataset.preview != null) return previewSynergy(state.list[Number(t.dataset.preview)]);
      if (t.dataset.edit != null) return openEditor(Number(t.dataset.edit));
      if (t.dataset.dup != null) return duplicate(Number(t.dataset.dup));
      if (t.dataset.del != null) return remove(Number(t.dataset.del));
    });

    document.getElementById("synStClose").addEventListener("click", () => C.closeOverlay("synStOverlay"));
    document.getElementById("synPreviewClose").addEventListener("click", () => C.closeOverlay("synPreviewOverlay"));
    document.getElementById("synFSearch").addEventListener("input", renderList);
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    loadData();
    bind();
    renderList();
    global.SYNERGY._ready = true;
  }

  global.SYNERGY = { init, get: () => state.list, exportRaw, validateAll, importData, renderList, _ready: false };
})(window);
