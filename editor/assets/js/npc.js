/* =========================================================================
 * npc.js — NPC 编辑器模块（对手档 · 具名对手池）
 * 数据结构与游戏 config/npcs.json 完全兼容：
 *   档（tier）：{ id, tier, range:[min,max], desc, npcs:[{name,title,attrs}], isFinal?, battles?, themes? }
 *   具名对手：{ name, title, attrs:{shi,ci,lian,bi,xue,si} }
 * 战斗时引擎按进度选档、再从该档随机抽一名，显示为「档名·具名」（如「童生级·周小满」）。
 * 依赖 common.js（Common.*）。视觉与题库 / 奇遇 / 文心编辑器保持同一套墨纸主题。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;
  const ATTR = C.ATTR, ATTR_KEYS = C.ATTR_KEYS;
  const THEME_LABELS = { yongwu: "咏物", songbie: "送别", shanshui: "山水", biansai: "边塞", huaigu: "怀古", jieling: "节令" };

  const state = { tiers: [], editTier: -1, tierForm: null, npcForm: null, _ready: false };

  /* ---------------- 持久化 ---------------- */
  function save() {
    C.store("npcs", state.tiers);
    const t = new Date();
    C.setStatus("npc", "已自动保存 " + t.toLocaleTimeString("zh-CN", { hour12: false }));
  }
  function loadData() {
    const raw = C.load("npcs", null);
    if (raw && raw.length) {
      state.tiers = ensureHiddenFinalTier(raw.map(normalizeTier));
      C.store("npcs", state.tiers); // 旧档迁移后立即持久化
    }
    else {
      state.tiers = ensureHiddenFinalTier((window.GAME_NPCS || []).map(normalizeTier));
      C.store("npcs", state.tiers);
    }
  }

  /* ---------------- 规范化 ---------------- */
  function cleanAttrs(a) {
    const out = {}; a = a || {};
    for (const k of ATTR_KEYS) { const v = Math.max(0, Math.floor(Number(a[k]) || 0)); if (v) out[k] = v; }
    return out;
  }
  function normalizeNpc(n) {
    n = n || {};
    const style = ATTR_KEYS.includes(n.style) ? n.style : "";
    const w = Number(n.weight);
    return {
      id: String(n.id || "").trim(),
      name: String(n.name || "").trim(),
      title: String(n.title || "").trim(),
      style,
      // 出战权重：正整数；空/非法回退 undefined（引擎默认 100）；显式 0 保留为 0（本阶段不出战）
      weight: (Number.isFinite(w) && w >= 0) ? Math.floor(w) : undefined,
      attrs: cleanAttrs(n.attrs),
      mech: (n.mech && typeof n.mech === 'object' && !Array.isArray(n.mech) && Object.keys(n.mech).length)
        ? n.mech : undefined
    };
  }
  function normalizeTier(t) {
    t = t || {};
    const out = {
      id: String(t.id || "").trim(),
      tier: String(t.tier || t.name || "").trim(),
      range: Array.isArray(t.range) && t.range.length === 2
        ? [Number(t.range[0]) || 0, Number(t.range[1]) || 0]
        : [0, 1],
      desc: String(t.desc || "").trim(),
      npcs: Array.isArray(t.npcs) ? t.npcs.map(normalizeNpc) : []
    };
    if (t.isFinal) {
      out.isFinal = true;
      out.battles = Math.max(1, Number(t.battles) || 3);
      out.themes = Array.isArray(t.themes) && t.themes.length
        ? t.themes.map(s => String(s).trim()).filter(Boolean)
        : ["yongwu", "songbie", "huaigu"];
    }
    if (t.isHiddenFinal) {
      out.isHiddenFinal = true;
      out.themes = Array.isArray(t.themes) && t.themes.length
        ? t.themes.map(s => String(s).trim()).filter(Boolean)
        : ["huaigu"];
    }
    return out;
  }

  /** 隐藏终圈属于系统必需档：旧 localStorage / 旧工程缺失时从官方种子回填。 */
  function ensureHiddenFinalTier(tiers) {
    const out = Array.isArray(tiers) ? tiers : [];
    const seed = (window.GAME_NPCS || []).find(t => t && t.isHiddenFinal);
    if (!seed) return out;
    const i = out.findIndex(t => t && (t.isHiddenFinal || t.id === seed.id));
    if (i < 0) out.push(normalizeTier(seed));
    else if (!out[i].isHiddenFinal) out[i] = normalizeTier(seed);
    return out;
  }

  /* ---------------- 校验 ---------------- */
  function validateNpc(n, allNames, selfKey) {
    const errors = [];
    if (!n.name) errors.push("对手名称不能为空");
    else if (allNames && allNames[n.name] && allNames[n.name] !== selfKey) errors.push("对手名称「" + n.name + "」在本档内重复");
    const a = n.attrs || {};
    for (const k of ATTR_KEYS) if (a[k] != null && (Number(a[k]) < 0)) errors.push(ATTR[k] + "不能为负");
    if (n.weight != null && (!Number.isInteger(n.weight) || n.weight < 0)) errors.push("出战权重须为非负整数（0=本阶段不出战）");
    return { ok: errors.length === 0, errors };
  }
  function validateTier(t, all, selfIndex) {
    const errors = [], w = "档" + (t.id ? " " + t.id : "");
    if (!t.id) errors.push("档 ID 不能为空");
    else if (!/^[A-Za-z0-9_\-]+$/.test(t.id)) errors.push("档 ID 只能含字母、数字、下划线和连字符");
    else { const dup = all.findIndex((x, i) => x.id === t.id && i !== selfIndex); if (dup >= 0) errors.push("档 ID 与第 " + (dup + 1) + " 档重复"); }
    if (!t.tier) errors.push("档名（如 童生级）不能为空");
    if (!Array.isArray(t.range) || t.range.length !== 2) errors.push("进度区间 range 必须是 [min,max]");
    else {
      const [mn, mx] = t.range;
      if (isNaN(mn) || isNaN(mx)) errors.push("进度区间必须是数字");
      else if (mn < 0 || mx > 1) errors.push("进度区间需在 0~1 之间");
      else if (mn >= mx) errors.push("区间起点须小于终点");
    }
    if (!Array.isArray(t.npcs) || !t.npcs.length) errors.push("该档至少要有一名具名对手");
    if (t.isFinal) {
      if (!(t.battles >= 1)) errors.push("殿试档 battles 须 ≥ 1");
      if (!Array.isArray(t.themes) || !t.themes.length) errors.push("殿试档 themes 不能为空");
    }
    return { ok: errors.length === 0, errors };
  }
  function validateAll() {
    const out = [];
    state.tiers.forEach((t, ti) => {
      const tv = validateTier(t, state.tiers, ti);
      if (!tv.ok) out.push({ kind: "tier", ti, i: ti, errors: tv.errors });
      t.npcs.forEach((n, ni) => {
        const names = {}; t.npcs.forEach((x, k) => { if (x.name) names[x.name] = ti + ":" + k; });
        const nv = validateNpc(n, names, ti + ":" + ni);
        if (!nv.ok) out.push({ kind: "npc", ti, ni, i: ti, errors: nv.errors });
      });
    });
    return out;
  }

  /* ---------------- 工具 ---------------- */
  function attrsSummary(attrs) {
    attrs = attrs || {};
    return ATTR_KEYS.map(k => `<span class="t">${ATTR[k][0]}${attrs[k] || 0}</span>`).join("");
  }
  function attrSum(attrs) {
    attrs = attrs || {};
    return ATTR_KEYS.reduce((s, k) => s + (Number(attrs[k]) || 0), 0);
  }
  function tierLabel(t) { return t.tier || t.id || "（未命名档）"; }

  /* 由属性自动推断风格（无明显主导则返回 ""=均衡） */
  function autoStyle(attrs) {
    attrs = attrs || {};
    let best = "", bestV = -1, second = -1;
    for (const k of ATTR_KEYS) {
      const v = Number(attrs[k]) || 0;
      if (v > bestV) { second = bestV; bestV = v; best = k; }
      else if (v > second) { second = v; }
    }
    if (bestV <= 0) return "";
    if (second >= 0 && bestV < second * 1.3) return ""; // 差距不够明显 → 视为均衡
    return best;
  }
  function styleChip(style) {
    if (!style || !ATTR[style]) return "";
    return `<span class="npc-style">偏${ATTR[style]}</span>`;
  }

  /* ---------------- 随机命名 / 属性 ---------------- */
  const SURNAMES = ["周", "陈", "吴", "孙", "钱", "李", "张", "黄", "林", "赵", "郑", "王", "范", "苏", "陆", "韩", "唐", "白", "秦", "谢", "沈", "江", "顾", "裴", "柳", "崔", "司马", "上官", "夏侯", "慕容", "宇文", "欧阳"];
  const GIVEN = ["昭", "岚", "砚", "墨", "清", "远", "澜", "瑾", "徽", "彦", "卿", "景", "言", "书", "归", "舟", "川", "逸", "尘", "霁", "瞻", "亭", "玉", "渊", "明", "哲", "云", "翊", "珩", "澈", "笙", "屿", "棠", "野", "杳", "奚", "梵", "恪", "珉"];
  const TITLE_BY_STYLE = {
    shi: ["诗客", "咏怀诗人", "苦吟客", "诗匠"],
    ci: ["词客", "倚声名家", "长短句手", "词苑耆英"],
    lian: ["联句生", "对句奇才", "楹联妙手", "属对神童"],
    bi: ["笔客", "文章快手", "骈俪能手", "挥毫客"],
    xue: ["学究", "饱学之士", "通经儒生", "博学鸿儒"],
    si: ["思玄子", "玄览先生", "穷理之士", "静观学者"]
  };
  const TITLE_BALANCED = ["文苑宿儒", "翰墨中人", "科场老手", "读书种子", "白衣秀士"];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randName() {
    const sur = pick(SURNAMES);
    const len = Math.random() < 0.6 ? 2 : 1;
    let g = "";
    for (let i = 0; i < len; i++) { g += pick(GIVEN); if (i === 0 && len === 2 && Math.random() < 0.25) break; }
    return sur + g;
  }
  function randTitle(style) {
    if (style && TITLE_BY_STYLE[style]) return pick(TITLE_BY_STYLE[style]);
    return pick(TITLE_BALANCED);
  }
  /* 在总预算 B 内分配六维，style 一项明显偏高（保证其为最大项） */
  function randAttrs(B, style) {
    B = Math.max(6, Math.floor(Number(B) || 30));
    const weights = ATTR_KEYS.map(k => (k === style ? 3.2 : 1));
    const total = weights.reduce((a, b) => a + b, 0);
    const raw = weights.map(w => Math.max(0, Math.round(B * w / total)));
    let sum = raw.reduce((a, b) => a + b, 0);
    raw[ATTR_KEYS.indexOf(style)] += (B - sum); // 余量全压到风格项，确保 Σ=B
    const out = {};
    ATTR_KEYS.forEach((k, i) => { out[k] = Math.max(0, raw[i]); });
    return out;
  }
  /* 取某档的平均属性总和作为随机生成的预算（保持与该档其它对手同量级） */
  function tierBudget(tier) {
    if (tier && tier.npcs && tier.npcs.length) {
      const s = tier.npcs.reduce((a, n) => a + attrSum(n.attrs), 0);
      return Math.round(s / tier.npcs.length);
    }
    return 30;
  }

  /* ---------------- 筛选 / 列表 ---------------- */
  function getFilter() {
    return document.getElementById("npcFSearch").value.trim().toLowerCase();
  }
  function renderStats() {
    const totalNpc = state.tiers.reduce((s, t) => s + t.npcs.length, 0);
    const finals = state.tiers.filter(t => t.isFinal).length;
    document.getElementById("npcStatStrip").innerHTML = `
      <div class="stat"><b>${state.tiers.length}</b><span>对手档</span></div>
      <div class="stat"><b>${totalNpc}</b><span>具名对手</span></div>
      <div class="stat"><b>${state.tiers.filter(t => t.npcs.length >= 1).length}</b><span>已配对手的档</span></div>
      <div class="stat"><b>${finals}</b><span>殿试档</span></div>`;
  }
  function renderList() {
    renderStats();
    const list = document.getElementById("npclist");
    const q = getFilter();
    const tiers = state.tiers.filter(t => {
      if (!q) return true;
      const hay = [t.id, tierLabel(t), t.desc, ...t.npcs.map(n => n.name + " " + (n.title || ""))].join(" ").toLowerCase();
      return hay.includes(q);
    });
    if (!state.tiers.length) {
      list.innerHTML = `<div class="empty"><b>对手库还是空的</b>点击「＋ 新增对手档」开始，或「导入 JSON」载入现有的 npcs.json。</div>`;
      return;
    }
    if (!tiers.length) {
      list.innerHTML = `<div class="empty"><b>没有符合筛选条件的对手档</b>试着调整上方搜索词。</div>`;
      return;
    }
    list.innerHTML = tiers.map((t, dispTi) => {
      const ti = state.tiers.indexOf(t);
      const finalTag = t.isHiddenFinal
        ? `<span class="badge src">隐藏终圈</span>`
        : t.isFinal ? `<span class="badge src">殿试档 · ${t.battles} 场</span>` : "";
      const npcRows = t.npcs.length ? t.npcs.map((n, ni) => `
        <div class="npc-row" data-key="${ti}:${ni}">
          <div class="npc-id"><b>${C.esc(n.name || "（未命名）")}</b>${n.mech ? '<span class="badge src mech-badge" title="三机制对手">三机制</span>' : ""}${n.weight != null ? `<span class="badge ${n.weight === 0 ? "danger" : ""}" title="本阶段出战权重（越大越常出现；0=不出战）">权重${n.weight}</span>` : ""}${n.id ? `<span class="npc-title" style="opacity:.6">${C.esc(n.id)}</span>` : ""}${styleChip(n.style)}${n.title ? ` <span class="npc-title">${C.esc(n.title)}</span>` : ""}</div>
          <div class="npc-attrs">${attrsSummary(n.attrs)}<span class="npc-sum">Σ${attrSum(n.attrs)}</span></div>
          <div class="npc-actions">
            <button class="btn sm" data-preview-npc="${ti}:${ni}">预览</button>
            <button class="btn sm" data-edit-npc="${ti}:${ni}">编辑</button>
            <button class="btn sm" data-dup-npc="${ti}:${ni}">复制</button>
            <button class="btn sm danger" data-del-npc="${ti}:${ni}">删除</button>
          </div>
        </div>`).join("") : `<div class="npc-empty">该档尚无具名对手 —— 点「＋ 对手」添加。</div>`;
      return `<div class="tier-card" data-tier="${ti}">
        <div class="tier-head">
          <div class="meta">
            <span class="q-id">${C.esc(t.id)}</span>
            <span class="badge k-active">${C.esc(tierLabel(t))}</span>
            <span class="badge">进度 ${Number(t.range[0]).toFixed(2)}–${Number(t.range[1]).toFixed(2)}</span>
            ${finalTag}
            <span class="npc-count">${t.npcs.length} 名对手</span>
          </div>
          <div class="tier-actions">
            <button class="btn sm" data-edit-tier="${ti}">编辑档</button>
            <button class="btn sm" data-add-npc="${ti}">＋ 对手</button>
            <button class="btn sm" data-dup-tier="${ti}">复制档</button>
            <button class="btn sm danger" data-del-tier="${ti}">删除档</button>
          </div>
        </div>
        <div class="tier-desc">${C.esc(t.desc || "（无描述）")}</div>
        <div class="npc-list">${npcRows}</div>
      </div>`;
    }).join("");
  }

  /* ---------------- 档编辑弹窗 ---------------- */
  function toggleFinalFields() {
    const on = !!state.tierForm.isFinal;
    const f = document.getElementById("npcTierFinal");
    if (f) f.style.display = on ? "" : "none";
  }
  function openTierEditor(index) {
    state.editTier = index;
    const src = index >= 0 ? state.tiers[index] : null;
    if (src) {
      state.tierForm = {
        id: src.id, tier: tierLabel(src), rangeMin: Number(src.range[0]), rangeMax: Number(src.range[1]),
        desc: src.desc, isFinal: !!src.isFinal, isHiddenFinal: !!src.isHiddenFinal, battles: src.battles || 3,
        themes: (src.themes || []).join(",")
      };
    } else {
      state.tierForm = { id: "", tier: "", rangeMin: 0, rangeMax: 1, desc: "", isFinal: false, battles: 3, themes: "yongwu,songbie,huaigu" };
      state.tierForm.id = C.nextSeqId("N", state.tiers.map(t => t.id), 2);
    }
    document.getElementById("npcTierTitle").textContent = src ? "编辑对手档 · " + src.id : "新增对手档";
    document.getElementById("npcTier-id").value = state.tierForm.id;
    document.getElementById("npcTier-name").value = state.tierForm.tier;
    document.getElementById("npcTier-min").value = state.tierForm.rangeMin;
    document.getElementById("npcTier-max").value = state.tierForm.rangeMax;
    document.getElementById("npcTier-desc").value = state.tierForm.desc;
    document.getElementById("npcTier-final").checked = state.tierForm.isFinal;
    document.getElementById("npcTier-battles").value = state.tierForm.battles;
    document.getElementById("npcTier-themes").value = state.tierForm.themes;
    const msg = document.getElementById("npcTierMsg"); msg.className = "msg"; msg.textContent = "";
    toggleFinalFields();
    C.openOverlay("npcTierOverlay");
  }
  function closeTierEditor() { C.closeOverlay("npcTierOverlay"); state.editTier = -1; state.tierForm = null; }

  function toTier(form) {
    const t = {
      id: form.id.trim(), tier: form.tier.trim(),
      range: [Number(form.rangeMin) || 0, Number(form.rangeMax) || 0],
      desc: form.desc.trim(),
      npcs: state.editTier >= 0 ? state.tiers[state.editTier].npcs.slice() : []
    };
    if (form.isFinal) {
      t.isFinal = true;
      t.battles = Math.max(1, Number(form.battles) || 3);
      t.themes = String(form.themes || "").split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
    }
    if (form.isHiddenFinal) {
      t.isHiddenFinal = true;
      t.themes = String(form.themes || "huaigu").split(/[,，\s]+/).map(s => s.trim()).filter(Boolean);
    }
    return t;
  }
  function saveTierEditor() {
    const t = toTier(state.tierForm);
    const { ok, errors } = validateTier(t, state.tiers, state.editTier);
    const msg = document.getElementById("npcTierMsg");
    if (!ok) { msg.className = "msg err"; msg.innerHTML = "✗ 无法保存：<br>• " + errors.join("<br>• "); return; }
    if (state.editTier >= 0) { state.tiers[state.editTier] = t; C.toast("已更新 " + t.id); }
    else { state.tiers.push(t); C.toast("已新增 " + t.id); }
    save(); closeTierEditor(); renderList();
  }

  /* ---------------- 具名对手编辑弹窗 ---------------- */
  function openNpcEditor(ti, ni, prefill) {
    const tier = state.tiers[ti];
    const src = (ni >= 0 ? tier.npcs[ni] : null) || (prefill || null);
    state.npcForm = {
      ti, ni,
      id: src ? (src.id || "") : "",
      name: src ? src.name : "",
      title: src ? src.title : "",
      style: src ? (src.style || autoStyle(src.attrs)) : "",
      weight: src ? (src.weight != null ? src.weight : "") : "",
      attrs: src ? JSON.parse(JSON.stringify(src.attrs)) : {},
      mech: src && src.mech ? JSON.parse(JSON.stringify(src.mech)) : null
    };
    document.getElementById("npcTitle").textContent = (ni >= 0 && src)
      ? `编辑对手 · ${tierLabel(tier)}·${src.name}`
      : `新增对手 · ${tierLabel(tier)}`;
    document.getElementById("npc-id").value = state.npcForm.id || "";
    document.getElementById("npc-name").value = state.npcForm.name;
    document.getElementById("npc-title").value = state.npcForm.title;
    const sel = document.getElementById("npc-style");
    if (sel) {
      sel.innerHTML = `<option value="">均衡（无明显偏科）</option>`
        + ATTR_KEYS.map(k => `<option value="${k}">偏${ATTR[k]}（${k}）</option>`).join("");
      sel.value = state.npcForm.style || "";
    }
    const wIn = document.getElementById("npc-weight");
    if (wIn) wIn.value = state.npcForm.weight === "" ? "" : state.npcForm.weight;
    const mechTa = document.getElementById("npc-mech");
    if (mechTa) {
      mechTa.value = state.npcForm.mech ? JSON.stringify(state.npcForm.mech, null, 2) : "";
      _mechLiveCheck();
    }
    renderMechOptions();
    const box = document.getElementById("npcAttrsBox");
    box.innerHTML = ATTR_KEYS.map(k => `<div class="field" style="margin:0">
      <label>${ATTR[k]}（${k}）</label>
      <input type="number" class="npc-attr" data-k="${k}" value="${state.npcForm.attrs[k] || 0}" min="0" step="1"/></div>`).join("");
    const msg = document.getElementById("npcMsg"); msg.className = "msg"; msg.textContent = "";
    C.openOverlay("npcOverlay");
  }
  function closeNpcEditor() { C.closeOverlay("npcOverlay"); state.npcForm = null; }

  const MECH_TEMPLATE_OPTIONS = {
    signature: [
      ["", "不配置招牌"], ["sig_style_mastery", "文体专精"], ["sig_repeat_read", "识破重复"], ["sig_dice_response", "追加骰响应"],
      ["sig_copycat", "仿作惯用"], ["sig_debt_drain", "文债耗神"], ["sig_steady_pressure", "稳稿压迫"], ["sig_manner_theme", "文风立意"], ["sig_palace_adapt", "跨场适应"]
    ],
    weakness: [
      ["", "不配置破绽"], ["wea_use_other_style", "改用他体"], ["wea_switch_style", "主动换体"], ["wea_base_dice_only", "只用基础骰"],
      ["wea_style_manner_combo", "文体＋文风组合"], ["wea_crushing_win", "高分差压卷"], ["wea_harmonious_manner", "相得文风破立意"], ["wea_counter_intent", "识别主要意图"], ["wea_cross_battle_shift", "跨场换策"]
    ],
    intent: [
      ["", "不配置意图"], ["int_preferred_style", "偏好文体意图"], ["int_manner_theme", "文风立意意图"], ["int_steady", "稳守意图"],
      ["int_dice_response", "追加骰响应意图"], ["int_copycat", "仿作意图"], ["int_palace_adapt", "殿试适应意图"]
    ]
  };
  const MECH_STYLE_OPTIONS = [["shi", "诗"], ["ci", "词"], ["lian", "联"], ["bi", "笔"], ["xue", "学"], ["si", "思"]];
  const MECH_MANNER_OPTIONS = [["wanyue", "婉约"], ["haofang", "豪放"], ["zheli", "哲理"], ["qingya", "清雅"], ["qili", "绮丽"], ["chenyu", "沉郁"]];
  function escNpc(v) { return C.esc(String(v == null ? "" : v)); }
  function mechField(label, field, value, type = "number", hint = "") {
    const attrs = type === "number" ? `type="number" step="0.01"` : `type="text"`;
    return `<div class="field"><label>${label}${hint ? ` <span class="dim">${hint}</span>` : ""}</label><input class="mech-param" data-mech-field="${field}" ${attrs} value="${escNpc(value)}" /></div>`;
  }
  function mechSelect(label, field, value, options) {
    return `<div class="field"><label>${label}</label><select class="mech-param" data-mech-field="${field}">${options.map(([v,n]) => `<option value="${v}" ${v === value ? "selected" : ""}>${n}</option>`).join("")}</select></div>`;
  }
  function mechFields(kind, obj) {
    const t = obj.template || ""; let h = "";
    if (t === "sig_style_mastery" || t === "sig_copycat" || t === "int_preferred_style" || t === "int_copycat") h += mechSelect("核心文体", "style", obj.style || state.npcForm.style || "shi", MECH_STYLE_OPTIONS);
    if (["sig_style_mastery", "sig_repeat_read", "sig_copycat", "sig_manner_theme"].includes(t)) h += mechField("强度（百分比）", "pct", obj.pct != null ? Math.round(obj.pct * 100) : 6, "number", "填 6 表示 6%");
    if (["sig_style_mastery", "sig_copycat", "sig_dice_response", "sig_debt_drain", "sig_steady_pressure", "sig_manner_theme", "int_preferred_style", "int_manner_theme", "int_copycat", "int_steady", "int_dice_response", "int_palace_adapt"].includes(t)) h += mechField("意图偏置", "bias", obj.bias == null ? 1.3 : obj.bias);
    if (["sig_dice_response"].includes(t)) h += mechField("追加骰递减分（逗号分隔）", "steps", Array.isArray(obj.steps) ? obj.steps.join(",") : (obj.steps || "14,9,4"), "text");
    if (t === "sig_dice_response") h += mechField("递减分封顶", "cap", obj.cap == null ? 22 : obj.cap);
    if (["sig_debt_drain"].includes(t)) { h += mechField("触发分差阈值", "threshold", obj.threshold == null ? 0.12 : Math.round(obj.threshold * 100), "number", "填百分比"); h += mechField("灵感消耗", "cost", obj.cost == null ? 3 : obj.cost); }
    if (t === "sig_steady_pressure") { h += mechField("发挥下限提升", "floor", obj.floor == null ? 5 : obj.floor); h += mechField("爆发上限降低", "ceiling", obj.ceiling == null ? 5 : obj.ceiling); }
    if (["wea_use_other_style", "wea_style_manner_combo", "wea_harmonious_manner"].includes(t)) h += mechSelect("关联文体", "npcStyle", obj.npcStyle || obj.style || state.npcForm.style || "shi", MECH_STYLE_OPTIONS);
    if (["wea_use_other_style", "wea_style_manner_combo", "wea_harmonious_manner"].includes(t)) h += mechField("破绽保留比例", "retention", obj.retention == null ? 0.5 : Math.round(obj.retention * 100), "number", "填百分比");
    if (["wea_crushing_win"].includes(t)) { h += mechField("压卷分差阈值", "threshold", obj.threshold == null ? 0.18 : Math.round(obj.threshold * 100), "number", "填百分比"); h += mechField("返还灵感", "refund", obj.refund == null ? 0 : obj.refund); }
    if (["wea_base_dice_only"].includes(t)) h += mechField("取消的稳定分", "flat", obj.flat == null ? 6 : obj.flat);
    if (["wea_style_manner_combo", "wea_harmonious_manner", "sig_manner_theme", "int_manner_theme"].includes(t)) h += mechField("文风方向（逗号分隔）", "manners", Array.isArray(obj.manners) ? obj.manners.join(",") : (obj.manners || "zheli"), "text");
    if (["wea_counter_intent"].includes(t)) h += mechField("招牌削弱比例", "retention", obj.retention == null ? 0.5 : Math.round(obj.retention * 100), "number", "填百分比");
    if (["wea_cross_battle_shift"].includes(t)) h += mechField("移除适应层数", "layerReduce", obj.layerReduce == null ? 1 : obj.layerReduce);
    if (t === "sig_palace_adapt") h += mechField("最多适应层数", "maxLayers", obj.maxLayers == null ? 2 : obj.maxLayers);
    return h || `<div class="dim">该机制无需额外参数。</div>`;
  }
  function renderMechOptions() {
    const box = document.getElementById("npcMechOptions"); if (!box || !state.npcForm) return;
    const mech = state.npcForm.mech || {};
    box.innerHTML = ["signature", "weakness", "intent"].map(kind => {
      const obj = Array.isArray(mech[kind]) ? (mech[kind][0] || {}) : (mech[kind] || {});
      const opts = MECH_TEMPLATE_OPTIONS[kind];
      return `<div class="npc-mech-card" data-mech-kind="${kind}"><h4>${kind === "signature" ? "招牌机制" : kind === "weakness" ? "破绽机制" : "意图机制"}</h4>${mechSelect("机制类型", "template", obj.template || "", opts)}<div class="mech-fields">${obj.template ? mechFields(kind, obj) : `<div class="dim">选择机制类型后配置参数。</div>`}</div><button type="button" class="btn ghost sm mech-clear" data-mech-clear="${kind}">清空此机制</button></div>`;
    }).join("");
  }
  function syncMechFromOptions() {
    if (!state.npcForm) return;
    const mech = state.npcForm.mech && typeof state.npcForm.mech === "object" ? state.npcForm.mech : {};
    document.querySelectorAll("#npcMechOptions .npc-mech-card").forEach(card => {
      const kind = card.dataset.mechKind; if (!kind) return;
      const sel = card.querySelector('[data-mech-field="template"]'); const template = sel && sel.value;
      if (!template) { delete mech[kind]; return; }
      const old = Array.isArray(mech[kind]) ? (mech[kind][0] || {}) : (mech[kind] || {});
      const obj = { ...old, template };
      card.querySelectorAll("[data-mech-field]").forEach(el => {
        const f = el.dataset.mechField; if (f === "template") return;
        let v = el.value;
        if (["pct", "threshold", "retention"].includes(f)) v = Number(v || 0) / 100;
        else if (["bias", "cost", "floor", "ceiling", "cap", "flat", "refund", "layerReduce", "maxLayers"].includes(f)) v = Number(v || 0);
        else if (f === "steps") v = String(v).split(",").map(Number).filter(Number.isFinite);
        else if (f === "manners") v = String(v).split(",").map(s => s.trim()).filter(Boolean);
        obj[f] = v;
      });
      if (!obj.name) obj.name = (optsName(kind, template));
      mech[kind] = obj;
    });
    state.npcForm.mech = Object.keys(mech).length ? mech : null;
    const ta = document.getElementById("npc-mech"); if (ta) ta.value = state.npcForm.mech ? JSON.stringify(state.npcForm.mech, null, 2) : "";
    _mechLiveCheck();
  }
  function optsName(kind, template) { const x = (MECH_TEMPLATE_OPTIONS[kind] || []).find(a => a[0] === template); return x ? x[1] : template; }
  function renderMechOptionsFromJson() { renderMechOptions(); }

  /** 实时解析 mech 文本域：合法 JSON 同步到 state.npcForm.mech，非法则标红并提示 */
  function _mechLiveCheck(forceErr) {
    const ta = document.getElementById("npc-mech"); const msg = document.getElementById("npcMechMsg");
    if (!ta || !state.npcForm) return;
    const raw = ta.value.trim(); const f = state.npcForm;
    if (!raw) { f.mech = null; if (msg) { msg.className = "msg"; msg.textContent = "留空＝普通对手（不配置三机制）。"; } ta.classList.remove("npc-mech-json"); return; }
    try {
      const obj = JSON.parse(raw);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) { f.mech = obj; }
      else { f.mech = null; }
      if (msg) { msg.className = "msg ok"; msg.textContent = "✓ 合法，保存后生效。"; }
      ta.classList.remove("npc-mech-json");
    } catch (e) {
      f.mech = null;
      if (msg) { msg.className = "msg err"; msg.textContent = "✗ 非法 JSON：" + e.message; }
      ta.classList.add("npc-mech-json");
      if (forceErr) throw new Error("invalid mech json");
    }
  }

  function saveNpcEditor() {
    if (!state.npcForm) return;
    const f = state.npcForm;
    const attrs = {};
    document.querySelectorAll("#npcAttrsBox .npc-attr").forEach(inp => {
      const k = inp.dataset.k; const v = Math.max(0, Math.floor(Number(inp.value) || 0));
      if (v) attrs[k] = v;
    });
    const sel = document.getElementById("npc-style");
    const styleVal = sel ? (sel.value || "") : "";
    const idVal = String((document.getElementById("npc-id") || {}).value || "").trim();
    // mech：解析 textarea；空字符串 → null（普通对手）；非法 JSON → 拦截
    let mech = f.mech;
    const mechTa = document.getElementById("npc-mech");
    if (mechTa) {
      const raw = mechTa.value.trim();
      if (raw) {
        try { mech = JSON.parse(raw); }
        catch (e) {
          const msg = document.getElementById("npcMsg");
          msg.className = "msg err";
          msg.innerHTML = "✗ 无法保存：三机制配置不是合法 JSON（" + e.message.replace(/</g,'&lt;') + "）。请修正后再保存。";
          const mta = document.getElementById("npc-mech"); if (mta) mta.classList.add("npc-mech-json");
          return;
        }
      } else { mech = null; }
    }
    const wRaw = (document.getElementById("npc-weight") || {}).value;
    const wNum = Number(wRaw);
    const weight = (wRaw !== "" && Number.isFinite(wNum) && wNum >= 0) ? Math.floor(wNum) : undefined;
    const npc = { id: idVal, name: f.name.trim(), title: f.title.trim(), style: ATTR_KEYS.includes(styleVal) ? styleVal : "", weight, attrs, mech: mech || undefined };
    const names = {}; state.tiers[f.ti].npcs.forEach((x, k) => { if (x.name) names[x.name] = f.ti + ":" + k; });
    const { ok, errors } = validateNpc(npc, names, f.ti + ":" + f.ni);
    const msg = document.getElementById("npcMsg");
    if (!ok) { msg.className = "msg err"; msg.innerHTML = "✗ 无法保存：<br>• " + errors.join("<br>• "); return; }
    if (f.ni >= 0) { state.tiers[f.ti].npcs[f.ni] = npc; C.toast("已更新 " + npc.name); }
    else { state.tiers[f.ti].npcs.push(npc); C.toast("已新增 " + npc.name); }
    save(); closeNpcEditor(); renderList();
  }

  /* ---------------- 操作 ---------------- */
  function duplicateTier(ti) {
    const copy = JSON.parse(JSON.stringify(state.tiers[ti]));
    let base = copy.id, n = 1, newId;
    do { newId = base + "_" + n; n++; } while (state.tiers.some(t => t.id === newId));
    copy.id = newId;
    state.tiers.splice(ti + 1, 0, copy);
    save(); renderList(); C.toast("已复制为 " + newId);
  }
  function removeTier(ti) {
    const t = state.tiers[ti];
    if (!confirm(`确定删除对手档「${t.id} · ${tierLabel(t)}」（含其 ${t.npcs.length} 名对手）？此操作不可撤销。`)) return;
    state.tiers.splice(ti, 1);
    save(); renderList(); C.toast("已删除 " + t.id);
  }
  function duplicateNpc(ti, ni) {
    const tier = state.tiers[ti];
    const copy = JSON.parse(JSON.stringify(tier.npcs[ni]));
    const base = copy.name || "对手", n = 1, newName = base + "_副本";
    let newName2 = copy.name || "对手", m = 1;
    while (tier.npcs.some(x => x.name === newName2)) { newName2 = (copy.name || "对手") + "_" + m; m++; }
    copy.name = newName2;
    if (copy.id) {
      let baseId = copy.id, k = 1, newId;
      do { newId = baseId + "_" + k; k++; } while (tier.npcs.some(x => x.id === newId));
      copy.id = newId;
    }
    tier.npcs.splice(ni + 1, 0, copy);
    save(); renderList(); C.toast("已复制为 " + copy.name);
  }
  function removeNpc(ti, ni) {
    const n = state.tiers[ti].npcs[ni];
    if (!confirm(`确定删除对手「${tierLabel(state.tiers[ti])}·${n.name}」？此操作不可撤销。`)) return;
    state.tiers[ti].npcs.splice(ni, 1);
    save(); renderList(); C.toast("已删除 " + n.name);
  }

  /* ---------------- 预览（仿战斗对手卡） ---------------- */
  function previewNpc(ti, ni) {
    const t = state.tiers[ti], n = t.npcs[ni];
    const full = `${tierLabel(t)}·${n.name || "（未命名）"}`;
    document.getElementById("npcPreviewBody").innerHTML = `
      <div class="talent-card k-active" style="min-width:260px">
        <span class="rarity-tag k-active">对手 · ${C.esc(tierLabel(t))}</span>
        <h3>${C.esc(full)}</h3>
        <div style="margin:2px 0 4px">${styleChip(n.style)}</div>
        ${n.title ? `<div class="etext" style="color:#8a5a12;margin-bottom:6px">${C.esc(n.title)}</div>` : ""}
        <div class="ev-accept" style="margin-top:8px">${attrsSummary(n.attrs)}　<span class="npc-sum">Σ${attrSum(n.attrs)}</span></div>
        ${n.title ? "" : ""}
      </div>`;
    C.openOverlay("npcPreviewOverlay");
  }

  /* ---------------- 统计弹窗 ---------------- */
  function showStats() {
    const totalNpc = state.tiers.reduce((s, t) => s + t.npcs.length, 0);
    const rows = state.tiers.map(t => `<tr><td>${C.esc(t.id)}</td><td>${C.esc(tierLabel(t))}</td>
      <td class="num">${t.npcs.length}</td><td>${t.isFinal ? "殿试" : Number(t.range[0]).toFixed(2) + "–" + Number(t.range[1]).toFixed(2)}</td></tr>`).join("");
    document.getElementById("npcStBody").innerHTML = `
      <p><b>对手档：</b>${state.tiers.length}　<b>具名对手：</b>${totalNpc}</p>
      <table class="stat-table" style="margin-top:8px">
        <tr><th>档 ID</th><th>档名</th><th>对手数</th><th>进度/性质</th></tr>
        ${rows}</table>`;
    C.openOverlay("npcStOverlay");
  }

  /* ---------------- 导入 / 导出 ---------------- */
  function importData(arr, mode) {
    const norm = arr.map(normalizeTier).filter(t => t.id || t.tier);
    if (mode) { state.tiers = ensureHiddenFinalTier(norm); C.toast("已替换为 " + state.tiers.length + " 档"); }
    else {
      const map = new Map(state.tiers.map((t, i) => [t.id, i]));
      let added = 0, updated = 0;
      norm.forEach(t => { if (map.has(t.id)) { state.tiers[map.get(t.id)] = t; updated++; } else { state.tiers.push(t); added++; } });
      C.toast(`合并完成：新增 ${added}，更新 ${updated}`);
    }
    state.tiers = ensureHiddenFinalTier(state.tiers);
    save(); renderList();
  }
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { alert("JSON 解析失败：" + e.message); return; }
      let arr;
      if (Array.isArray(data)) arr = data;
      else if (Array.isArray(data.npcs)) arr = data.npcs;
      else if (Array.isArray(data.talents)) { alert("这是文心文件，请在「文心编辑器」中导入。"); return; }
      else if (Array.isArray(data.events)) { alert("这是奇遇文件，请在「奇遇编辑器」中导入。"); return; }
      else if (Array.isArray(data.questions)) { alert("这是题库文件，请在「题库编辑器」中导入。"); return; }
      else { alert("未识别的 JSON 结构（应为档数组，或含 npcs 字段的对象）。"); return; }
      const type = C.classify(arr);
      if (type !== "npcs") { alert("未能识别为对手档数据（每档需含 tier 与 npcs 字段）。"); return; }
      const norm = arr.map(normalizeTier);
      const mode = confirm(`成功读取 ${norm.length} 档对手。\n\n点击「确定」= 替换当前对手；\n点击「取消」= 按 ID 合并（已存在则覆盖，不存在则追加）。`);
      importData(norm, mode);
    };
    reader.readAsText(file, "utf-8");
  }
  function exportRaw() { return state.tiers.map(t => JSON.parse(JSON.stringify(t))); }
  function exportData() {
    const bad = validateAll();
    if (bad.length) {
      const names = bad.slice(0, 8).map(r => state.tiers[r.ti] ? (state.tiers[r.ti].id || r.ti) : r.ti).join("、");
      if (!confirm(`有 ${bad.length} 处校验问题（如：档 ${names}…）。\n仍要导出吗？建议先修正再导出。`)) return;
    }
    if (!state.tiers.length) { alert("对手库是空的，无可导出内容。"); return; }
    const data = JSON.stringify(exportRaw(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "npcs.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    C.toast("已导出 npcs.json（" + state.tiers.length + " 档）");
  }

  /* ---------------- 随机生成 ---------------- */
  function randomGenerate() {
    const idxs = state.tiers.map((t, i) => i).filter(i => !state.tiers[i].isFinal);
    const ti = idxs.length ? pick(idxs) : (state.tiers.length ? 0 : -1);
    if (ti < 0) { alert("请先创建一个对手档，再随机生成对手。"); return; }
    const tier = state.tiers[ti];
    const style = pick(ATTR_KEYS);
    const attrs = randAttrs(tierBudget(tier), style);
    const name = randName();
    openNpcEditor(ti, -1, { name, title: randTitle(style), style, attrs });
  }
  function randomizeAttrs() {
    if (!state.npcForm) return;
    const tier = state.tiers[state.npcForm.ti];
    let style = (document.getElementById("npc-style") || {}).value || "";
    if (!style) style = pick(ATTR_KEYS);
    const attrs = randAttrs(tierBudget(tier), style);
    document.querySelectorAll("#npcAttrsBox .npc-attr").forEach(inp => { inp.value = attrs[inp.dataset.k] || 0; });
    document.getElementById("npc-style").value = style;
    C.toast("已随机属性（偏" + (ATTR[style] || "均衡") + "）");
  }
  function randomizeName() {
    if (!state.npcForm) return;
    const style = (document.getElementById("npc-style") || {}).value || "";
    const name = randName();
    document.getElementById("npc-name").value = name;
    document.getElementById("npc-title").value = randTitle(style);
    state.npcForm.name = name;
    C.toast("已随机名号：" + name);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById("npcBtnAddTier").addEventListener("click", () => openTierEditor(-1));
    document.getElementById("npcBtnRandom").addEventListener("click", randomGenerate);
    document.getElementById("npcBtnExport").addEventListener("click", exportData);
    document.getElementById("npcBtnStats").addEventListener("click", showStats);
    document.getElementById("npcBtnImport").addEventListener("click", () => document.getElementById("npcFileInput").click());
    document.getElementById("npcFileInput").addEventListener("change", e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });

    document.getElementById("npcTierCancel").addEventListener("click", closeTierEditor);
    document.getElementById("npcTierSave").addEventListener("click", saveTierEditor);
    document.getElementById("npcTier-final").addEventListener("change", e => { state.tierForm.isFinal = e.target.checked; toggleFinalFields(); });

    document.getElementById("npcCancel").addEventListener("click", closeNpcEditor);
    document.getElementById("npcSave").addEventListener("click", saveNpcEditor);
    document.getElementById("npcBtnRandAttr").addEventListener("click", randomizeAttrs);
    document.getElementById("npcBtnRandName").addEventListener("click", randomizeName);
    document.getElementById("npcPreviewBtn").addEventListener("click", () => {
      const f = state.npcForm; if (!f) return;
      if (document.getElementById("npc-mech")) _mechLiveCheck();
      const attrs = {}; document.querySelectorAll("#npcAttrsBox .npc-attr").forEach(inp => { const k = inp.dataset.k; const v = Math.max(0, Math.floor(Number(inp.value) || 0)); if (v) attrs[k] = v; });
      previewNpcLive(f.name.trim(), f.title.trim(), attrs);
    });

    document.getElementById("npcTierOverlay").addEventListener("input", e => {
      const t = e.target; const f = state.tierForm; if (!f) return;
      if (t.id === "npcTier-id") f.id = t.value;
      else if (t.id === "npcTier-name") f.tier = t.value;
      else if (t.id === "npcTier-min") f.rangeMin = Number(t.value);
      else if (t.id === "npcTier-max") f.rangeMax = Number(t.value);
      else if (t.id === "npcTier-desc") f.desc = t.value;
      else if (t.id === "npcTier-battles") f.battles = Number(t.value);
      else if (t.id === "npcTier-themes") f.themes = t.value;
    });
    document.getElementById("npcOverlay").addEventListener("input", e => {
      const t = e.target; const f = state.npcForm; if (!f) return;
      if (t.id === "npc-id") f.id = t.value;
      else if (t.id === "npc-name") f.name = t.value;
      else if (t.id === "npc-title") f.title = t.value;
      else if (t.id === "npc-mech") { _mechLiveCheck(); renderMechOptions(); }
      else if (t.classList.contains("mech-param")) syncMechFromOptions();
    });
    document.getElementById("npcOverlay").addEventListener("click", e => {
      const t = e.target.closest("[data-mech-clear]");
      if (!t || !state.npcForm) return;
      if (state.npcForm.mech) delete state.npcForm.mech[t.dataset.mechClear];
      renderMechOptions(); syncMechFromOptions();
    });
    document.getElementById("npcOverlay").addEventListener("change", e => {
      const t = e.target; const f = state.npcForm; if (!f) return;
      if (t.classList.contains("mech-param")) { syncMechFromOptions(); if (t.dataset.mechField === "template") renderMechOptions(); return; }
      if (t.dataset.mechClear) { if (f.mech) delete f.mech[t.dataset.mechClear]; renderMechOptions(); syncMechFromOptions(); return; }
      if (t.id === "npc-style") {
        f.style = ATTR_KEYS.includes(t.value) ? t.value : "";
        if (document.getElementById("npc-mech") && !document.getElementById("npc-mech").value.trim() && f.style) {
          // 空 mech + 有偏科：给一个可参照的初值骨架
          document.getElementById("npc-mech").value = JSON.stringify({
            signature: { name: "偏" + (ATTR[f.style] || f.style) + "专精", template: "sig_style_mastery", style: f.style, pct: 0.06 },
            weakness: { name: "改用他体", template: "wea_use_other_style", npcStyle: f.style, fullClose: [] },
            intent: { template: "int_preferred_style", style: f.style, bias: 1.4, bottom: 0.85, description: "本场准备使用" + (ATTR[f.style]||'') + "体" }
          }, null, 2);
          _mechLiveCheck();
        }
      }
    });

    document.getElementById("npclist").addEventListener("click", e => {
      const t = e.target;
      const parse = s => { const [ti, ni] = String(s).split(":").map(Number); return { ti, ni }; };
      if (t.dataset.editTier != null) return openTierEditor(Number(t.dataset.editTier));
      if (t.dataset.addNpc != null) return openNpcEditor(Number(t.dataset.addNpc), -1);
      if (t.dataset.dupTier != null) return duplicateTier(Number(t.dataset.dupTier));
      if (t.dataset.delTier != null) return removeTier(Number(t.dataset.delTier));
      if (t.dataset.previewNpc != null) { const { ti, ni } = parse(t.dataset.previewNpc); return previewNpc(ti, ni); }
      if (t.dataset.editNpc != null) { const { ti, ni } = parse(t.dataset.editNpc); return openNpcEditor(ti, ni); }
      if (t.dataset.dupNpc != null) { const { ti, ni } = parse(t.dataset.dupNpc); return duplicateNpc(ti, ni); }
      if (t.dataset.delNpc != null) { const { ti, ni } = parse(t.dataset.delNpc); return removeNpc(ti, ni); }
    });

    document.getElementById("npcStClose").addEventListener("click", () => C.closeOverlay("npcStOverlay"));
    document.getElementById("npcPreviewClose").addEventListener("click", () => C.closeOverlay("npcPreviewOverlay"));
    ["npcFSearch"].forEach(id => {
      document.getElementById(id).addEventListener("input", renderList);
    });
  }

  function previewNpcLive(name, title, attrs) {
    const tierName = (state.tiers[state.npcForm ? state.npcForm.ti : 0] && tierLabel(state.tiers[state.npcForm.ti])) || "档";
    const full = `${tierName}·${name || "（未命名）"}`;
    const style = (state.npcForm && state.npcForm.style) || "";
    const hasMech = !!(state.npcForm && state.npcForm.mech);
    document.getElementById("npcPreviewBody").innerHTML = `
      <div class="talent-card k-active" style="min-width:260px">
        <span class="rarity-tag k-active">对手 · ${C.esc(tierName)}</span>
        <h3>${C.esc(full)}</h3>
        <div style="margin:2px 0 4px">${styleChip(style)}${hasMech ? `<span class="npc-title" style="margin-left:6px">带三机制</span>` : ""}</div>
        ${title ? `<div class="etext" style="color:#8a5a12;margin-bottom:6px">${C.esc(title)}</div>` : ""}
        <div class="ev-accept" style="margin-top:8px">${attrsSummary(attrs)}　<span class="npc-sum">Σ${attrSum(attrs)}</span></div>
      </div>`;
    C.openOverlay("npcPreviewOverlay");
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    loadData();
    bind();
    renderList();
    global.NPC._ready = true;
  }

  global.NPC = { init, get: () => state.tiers, exportRaw, validateAll, importData, renderList, _ready: false };
})(window);
