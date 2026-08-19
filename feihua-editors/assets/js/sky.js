/* =========================================================================
 * sky.js — 天象编辑器模块
 * 编辑天象卡的名称 / 图标 / 叙事 / 持续回合 / 作用范围 / 效果。
 * 数据结构与游戏 config/sky.json 兼容；效果为「带类型」结构，按类型动态渲染编辑器。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;
  const ATTR = C.ATTR, ATTR_KEYS = C.ATTR_KEYS;

  const EFFECT_TYPES = [
    { id: "attr_pct", name: "属性百分比加成（全员某属性临时 +X%）" },
    { id: "basic_gain_plus", name: "基本功获得量 +N（指定若干属性）" },
    { id: "battle_reward_mult", name: "论战胜负奖惩 ×N" },
    { id: "quiz_bonus", name: "考题答对额外 +N" },
    { id: "no_ping_recover", name: "平韵格不再恢复灵感（无参数）" },
    { id: "next_battle_pct", name: "下一场论战得分 +X%" }
  ];
  const EFFECT_IDS = EFFECT_TYPES.map(t => t.id);
  const SCOPES = [{ id: "all", name: "全员" }, { id: "self", name: "仅自己" }];

  const state = { cards: [], editIndex: -1, form: null, _ready: false };

  /* ---------------- 数据归一化 ---------------- */
  function emptyCard() {
    return { id: "", name: "", icon: "", text: "", duration: 6, turns: 6, scope: "all", effect: { type: "attr_pct", attr: "shi", value: 0.2 } };
  }
  function normalizeCard(c) {
    c = c || {};
    const out = {
      id: String(c.id || "").trim(),
      name: String(c.name || "").trim(),
      text: String(c.text || "").trim(),
      duration: Math.max(1, Number(c.duration) || 6),
      turns: Math.max(1, Number(c.turns) || 6),
      scope: SCOPES.some(s => s.id === c.scope) ? c.scope : "all"
    };
    if (c.icon) out.icon = String(c.icon).trim();
    out.effect = normalizeEffect(c.effect);
    return out;
  }
  function normalizeEffect(e) {
    e = e || {};
    const type = EFFECT_IDS.includes(e.type) ? e.type : "attr_pct";
    const o = { type };
    if (type === "attr_pct") {
      o.attr = ATTR_KEYS.includes(e.attr) ? e.attr : "shi";
      o.value = Number(e.value) || 0;
    } else if (type === "basic_gain_plus") {
      o.value = Number(e.value) || 0;
      const attrs = Array.isArray(e.attrs) ? e.attrs.filter(a => ATTR_KEYS.includes(a)) : [];
      if (attrs.length) o.attrs = attrs;
    } else if (type === "no_ping_recover") {
      o.value = 0;
    } else {
      o.value = Number(e.value) || 0;
    }
    return o;
  }

  /* ---------------- 持久化 ---------------- */
  function save() {
    C.store("sky", state.cards);
    const t = new Date();
    C.setStatus("sky", "已自动保存 " + t.toLocaleTimeString("zh-CN", { hour12: false }));
  }
  function loadData() {
    const raw = C.load("sky", null);
    if (!raw) {
      const base = Array.isArray(window.GAME_SKY) ? window.GAME_SKY : [];
      state.cards = base.map(normalizeCard);
      C.store("sky", state.cards);
    } else {
      state.cards = (Array.isArray(raw) ? raw : []).map(normalizeCard);
    }
  }

  /* ---------------- 效果预览文案（仿游戏 skyEffectText） ---------------- */
  function skyEffectDesc(e) {
    e = e || {};
    switch (e.type) {
      case "attr_pct": return `全员 ${C.ATTR[e.attr] || e.attr} 临时 +${Math.round((e.value || 0) * 100)}%`;
      case "basic_gain_plus": return `基本功获得量 +${e.value || 0}` + (e.attrs && e.attrs.length ? `（${e.attrs.map(a => C.ATTR[a] || a).join("、")}）` : "");
      case "battle_reward_mult": return `论战胜负奖惩 ×${e.value || 0}`;
      case "quiz_bonus": return `考题答对额外 +${e.value || 0}`;
      case "no_ping_recover": return "平韵格不再恢复灵感";
      case "next_battle_pct": return `下一场论战得分 +${Math.round((e.value || 0) * 100)}%`;
      default: return "全局效果";
    }
  }

  /* ---------------- 校验 ---------------- */
  function validateCard(card, all, selfIndex) {
    const errors = [], w = "天象 " + (card.id || "(无ID)");
    if (!card.id || !/^SK\d+$/i.test(card.id)) errors.push(w + " ID 非法（应形如 SK01）");
    else {
      const dup = all.findIndex((x, i) => x.id === card.id && i !== selfIndex);
      if (dup >= 0) errors.push("ID " + card.id + " 与第 " + (dup + 1) + " 条重复");
    }
    if (!card.name) errors.push(w + " 名称不能为空");
    if (!card.text) errors.push(w + " 叙事文本不能为空");
    const e = card.effect || {};
    if (!EFFECT_IDS.includes(e.type)) errors.push(w + " 效果类型非法：" + (e.type || "空"));
    else if (e.type === "attr_pct") {
      if (!C.ATTR_KEYS.includes(e.attr)) errors.push(w + " 属性非法：" + (e.attr || "空"));
      if (!(Number(e.value) > 0)) errors.push(w + " 属性百分比需 > 0");
    } else if (e.type === "basic_gain_plus") {
      if (!Array.isArray(e.attrs) || !e.attrs.length) errors.push(w + " 至少选择 1 个属性");
      else if (e.attrs.some(a => !C.ATTR_KEYS.includes(a))) errors.push(w + " 含非法属性键");
      if (!(Number(e.value) > 0)) errors.push(w + " 基本功获得量需 > 0");
    } else if (e.type !== "no_ping_recover" && !(Number(e.value) > 0)) errors.push(w + " 数值需 > 0");
    if (!(Number(card.turns) >= 1)) errors.push(w + " 持续回合 turns 需 ≥ 1");
    if (!(Number(card.duration) >= 1)) errors.push(w + " 持续回合 duration 需 ≥ 1");
    return { ok: errors.length === 0, errors };
  }
  function validateAll() {
    if (!Array.isArray(state.cards)) return [];
    return state.cards.map((c, i) => ({ i, ...validateCard(c, state.cards, i) })).filter(r => !r.ok);
  }

  /* ---------------- 渲染列表 ---------------- */
  function getFilters() {
    return {
      q: document.getElementById("skyFSearch").value.trim().toLowerCase(),
      type: document.getElementById("skyFType").value
    };
  }
  function filtered() {
    const f = getFilters();
    return state.cards.filter(c => {
      if (f.type !== "all" && (c.effect || {}).type !== f.type) return false;
      if (f.q) {
        const hay = [c.id, c.name, c.icon || "", c.text, skyEffectDesc(c.effect)].join(" ").toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });
  }
  function renderStats() {
    const byType = {};
    state.cards.forEach(c => { const t = (c.effect || {}).type; byType[t] = (byType[t] || 0) + 1; });
    document.getElementById("skyStatStrip").innerHTML = `
      <div class="stat"><b>${state.cards.length}</b><span>天象总数</span></div>
      <div class="stat"><b>${byType.attr_pct || 0}</b><span>属性加成</span></div>
      <div class="stat"><b>${byType.basic_gain_plus || 0}</b><span>基本功</span></div>
      <div class="stat"><b>${byType.battle_reward_mult || 0}</b><span>论战倍率</span></div>
      <div class="stat"><b>${byType.quiz_bonus || 0}</b><span>考题加成</span></div>
      <div class="stat"><b>${byType.no_ping_recover || 0}</b><span>平韵封锁</span></div>
      <div class="stat"><b>${byType.next_battle_pct || 0}</b><span>下场加成</span></div>`;
  }
  function renderList() {
    renderStats();
    const list = document.getElementById("skylist");
    const items = filtered();
    if (!items.length) {
      list.innerHTML = `<div class="empty"><b>${state.cards.length ? "没有符合筛选条件的天象" : "天象列表为空"}</b>
        ${state.cards.length ? "试着调整筛选条件。" : "请导入 sky.json 或重置默认天象。"}</div>`;
      return;
    }
    list.innerHTML = items.map(c => {
      const idx = state.cards.indexOf(c);
      const eff = skyEffectDesc(c.effect);
      return `<div class="q-card sky-card" data-idx="${idx}">
        <div class="meta" style="min-width:96px">
          <span class="q-id">${C.esc(c.id)}</span>
          ${c.icon ? `<span class="sky-ico-sm" title="图标">${C.esc(c.icon)}</span>` : ""}
          <span class="badge r-common">${c.turns}回合</span>
        </div>
        <div class="q-main">
          <p class="q-name">${C.esc(c.name)}</p>
          <div class="q-tags">
            ${c.icon ? `<span class="t">图标 ${C.esc(c.icon)}</span>` : ""}
            <span class="t">效果 ${C.esc(eff)}</span>
          </div>
        </div>
        <div class="q-actions">
          <button class="btn sm" data-edit="${idx}">编辑</button>
          <button class="btn sm" data-preview="${idx}">预览</button>
        </div>
      </div>`;
    }).join("");
  }

  /* ---------------- 效果编辑器（带类型） ---------------- */
  function effectEditorInner(eff) {
    eff = eff || {};
    const typeOpts = EFFECT_TYPES.map(t => `<option value="${t.id}" ${t.id === eff.type ? "selected" : ""}>${C.esc(t.name)}</option>`).join("");
    let body = "";
    if (eff.type === "attr_pct") {
      const attrOpts = ATTR_KEYS.map(k => `<option value="${k}" ${k === eff.attr ? "selected" : ""}>${ATTR[k]}</option>`).join("");
      body = `<div class="row2">
        <div class="field" style="margin:0"><label>属性</label><select class="sky-eff-attr">${attrOpts}</select></div>
        <div class="field" style="margin:0"><label>加成百分比（%）</label><input type="number" class="sky-eff-value" value="${Math.round((eff.value || 0) * 100)}" step="1" min="1"/></div>
      </div>`;
    } else if (eff.type === "basic_gain_plus") {
      const checked = new Set(eff.attrs || []);
      const boxes = ATTR_KEYS.map(k => `<label class="chk"><input type="checkbox" value="${k}" ${checked.has(k) ? "checked" : ""}/> ${ATTR[k]}</label>`).join("");
      body = `<div class="field" style="margin:0"><label>获得量 +N</label><input type="number" class="sky-eff-value" value="${eff.value || 1}" step="1" min="1"/></div>
        <div class="field"><label>作用属性（可多选）</label><div class="chk-row">${boxes}</div></div>`;
    } else if (eff.type === "no_ping_recover") {
      body = `<div class="hint">该效果无参数：平韵格触发时不再恢复灵感。</div>`;
    } else {
      const isPct = eff.type === "next_battle_pct";
      body = `<div class="field" style="margin:0"><label>${isPct ? "加成百分比（%）" : "数值"}</label>
        <input type="number" class="sky-eff-value" value="${isPct ? Math.round((eff.value || 0) * 100) : (eff.value || 1)}" step="1" min="1"/></div>`;
    }
    return `<div class="sky-eff">
      <div class="field" style="margin:0"><label>效果类型</label><select class="sky-eff-type">${typeOpts}</select></div>
      <div class="sky-eff-params">${body}</div>
      <div class="sky-eff-preview">效果预览：${C.esc(skyEffectDesc(eff))}</div>
    </div>`;
  }
  /* 仅用于编辑器预览渲染时的即时文案：依据当前 DOM 计算 */
  function readEffectFromDom(fallback) {
    const box = document.querySelector("#skyOverlay .sky-eff");
    if (!box) return fallback || {};
    const type = box.querySelector(".sky-eff-type").value;
    const e = { type };
    if (type === "attr_pct") {
      e.attr = box.querySelector(".sky-eff-attr").value;
      e.value = Number(box.querySelector(".sky-eff-value").value || 0) / 100;
    } else if (type === "basic_gain_plus") {
      e.value = Number(box.querySelector(".sky-eff-value").value || 0);
      const attrs = [];
      box.querySelectorAll(".sky-eff-attrs input:checked, .chk-row input:checked").forEach(c => attrs.push(c.value));
      e.attrs = attrs;
    } else if (type === "no_ping_recover") {
      e.value = 0;
    } else {
      e.value = Number(box.querySelector(".sky-eff-value").value || 0);
    }
    return e;
  }
  function rerenderEffectEditor() {
    const box = document.querySelector("#skyOverlay .sky-eff");
    if (box) { box.outerHTML = effectEditorInner(state.form.effect); }
  }

  /* ---------------- 编辑弹窗 ---------------- */
  function openEditor(index) {
    state.editIndex = index;
    const src = index >= 0 ? state.cards[index] : null;
    state.form = src ? JSON.parse(JSON.stringify(src)) : (() => {
      const nextId = C.nextSeqId("SK", state.cards.map(c => c.id), 2);
      const c = emptyCard(); c.id = nextId; return c;
    })();
    document.getElementById("skyTitle").textContent = src ? "编辑天象 · " + src.id : "新增天象";
    document.getElementById("sky-id").value = state.form.id;
    document.getElementById("sky-name").value = state.form.name;
    document.getElementById("sky-icon").value = state.form.icon || "";
    document.getElementById("sky-text").value = state.form.text;
    document.getElementById("sky-turns").value = state.form.turns;
    document.getElementById("sky-duration").value = state.form.duration;
    document.getElementById("sky-scope").value = state.form.scope;
    document.getElementById("skyEffectBox").innerHTML = effectEditorInner(state.form.effect);
    const msg = document.getElementById("skyMsg"); msg.className = "msg"; msg.textContent = "";
    C.openOverlay("skyOverlay");
  }
  function closeEditor() { C.closeOverlay("skyOverlay"); state.editIndex = -1; state.form = null; }

  function toCard(form) {
    const eff = readEffectFromDom(form.effect);
    const out = {
      id: String(form.id || "").trim().toUpperCase(),
      name: String(form.name || "").trim(),
      text: String(form.text || "").trim(),
      duration: Math.max(1, Number(form.duration) || 6),
      turns: Math.max(1, Number(form.turns) || 6),
      scope: SCOPES.some(s => s.id === form.scope) ? form.scope : "all",
      effect: normalizeEffect(eff)
    };
    if (form.icon && form.icon.trim()) out.icon = form.icon.trim();
    return out;
  }
  function saveEditor() {
    const card = toCard(state.form);
    const { ok, errors } = validateCard(card, state.cards, state.editIndex);
    const msg = document.getElementById("skyMsg");
    if (!ok) {
      msg.className = "msg err";
      msg.innerHTML = "✗ 无法保存：<br>• " + errors.join("<br>• ");
      return;
    }
    if (state.editIndex >= 0) {
      state.cards[state.editIndex] = card;
      C.toast("已更新天象 " + card.id);
    } else {
      state.cards.push(card);
      state.cards.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      C.toast("已新增天象 " + card.id);
    }
    save(); closeEditor(); renderList();
  }

  /* ---------------- 预览 ---------------- */
  function previewCard(card) {
    document.getElementById("skyPreviewBody").innerHTML = `
      <div class="sky-preview-card">
        ${card.icon ? `<div class="sky-ico-big">${C.esc(card.icon)}</div>` : `<div class="sky-ico-big">✦</div>`}
        <h3>${C.esc(card.name)} <span class="dim">#${C.esc(card.id)}</span></h3>
        <p class="sky-kind">${card.effect && card.effect.type === "next_battle_pct" ? "下一场论战 · 一次性" : `持续 ${card.turns} 回合 · ${SCOPES.find(s => s.id === card.scope).name}`}</p>
        <div class="dianggu">${C.esc(card.text)}</div>
        <div class="sky-eff-out">${C.esc(skyEffectDesc(card.effect))}</div>
      </div>`;
    C.openOverlay("skyPreviewOverlay");
  }

  /* ---------------- 导入 / 导出 ---------------- */
  function importData(data, mode) {
    if (!Array.isArray(data)) { C.toast("天象数据格式错误"); return; }
    const incoming = data.map(normalizeCard);
    if (mode) {
      state.cards = incoming;
      C.toast("已替换为新的天象配置");
    } else {
      const map = new Map(state.cards.map((c, i) => [c.id, i]));
      let added = 0, updated = 0;
      incoming.forEach(c => {
        if (map.has(c.id)) { state.cards[map.get(c.id)] = c; updated++; }
        else { state.cards.push(c); added++; }
      });
      state.cards.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      C.toast(`合并完成：新增 ${added} 条，更新 ${updated} 条`);
    }
    save(); renderList();
  }
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (e) { alert("JSON 解析失败：" + e.message); return; }
      if (!Array.isArray(data)) { alert("不是天象配置文件（应为天象卡数组）"); return; }
      const mode = confirm(
        `成功读取天象配置（${data.length} 张）。\n\n点击「确定」= 替换当前天象；\n点击「取消」= 按 ID 合并（已存在则覆盖，不存在则追加）。`);
      importData(data, mode);
    };
    reader.readAsText(file, "utf-8");
  }
  function exportRaw() {
    return state.cards.map(c => {
      const out = { id: c.id, name: c.name, text: c.text, duration: c.duration, turns: c.turns, scope: c.scope, effect: c.effect };
      if (c.icon) out.icon = c.icon;
      return out;
    });
  }
  function exportData() {
    const bad = validateAll();
    if (bad.length) {
      const ids = bad.slice(0, 8).map(r => state.cards[r.i].id).join("、");
      if (!confirm(`有 ${bad.length} 张天象存在校验问题（如：${ids}…）。\n仍要导出吗？建议先修正再导出。`)) return;
    }
    const data = JSON.stringify(exportRaw(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sky.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    C.toast("已导出 sky.json");
  }

  /* ---------------- 统计弹窗 ---------------- */
  function showStats() {
    const byType = {};
    state.cards.forEach(c => { const t = (c.effect || {}).type; byType[t] = (byType[t] || 0) + 1; });
    const rows = EFFECT_TYPES.map(t => `<tr><td>${C.esc(t.name)}</td><td class="num">${byType[t.id] || 0}</td></tr>`).join("");
    const issues = validateAll().length;
    document.getElementById("skyStBody").innerHTML = `
      <p><b>天象总数：</b>${state.cards.length}　<b>校验问题：</b>${issues ? `<span style="color:var(--bad)">${issues}</span>` : "0"}</p>
      <h4 style="margin:14px 0 6px">按效果类型</h4>
      <table class="stat-table"><tr><th>效果类型</th><th>数量</th></tr>${rows}</table>`;
    C.openOverlay("skyStOverlay");
  }

  /* ---------------- 字段输入处理 ---------------- */
  function handleField(e) {
    const t = e.target;
    if (t.classList.contains("sky-eff-type")) {
      // 切换类型：重置为该类型默认参数
      const type = t.value;
      state.form.effect = { type };
      if (type === "attr_pct") state.form.effect = { type, attr: "shi", value: 0.2 };
      else if (type === "basic_gain_plus") state.form.effect = { type, value: 1, attrs: ["bi"] };
      else if (type === "no_ping_recover") state.form.effect = { type, value: 0 };
      else if (type === "next_battle_pct") state.form.effect = { type, value: 0.1 };
      else state.form.effect = { type, value: 2 };
      rerenderEffectEditor();
      return;
    }
    if (!state.form) return;
    // 效果参数（数值/属性/多选）实时刷新预览文案
    if (t.closest && t.closest(".sky-eff")) {
      const prev = document.querySelector("#skyOverlay .sky-eff-preview");
      if (prev) prev.textContent = "效果预览：" + C.esc(skyEffectDesc(readEffectFromDom()));
      return;
    }
    if (t.id === "sky-name") state.form.name = t.value;
    else if (t.id === "sky-icon") state.form.icon = t.value;
    else if (t.id === "sky-text") state.form.text = t.value;
    else if (t.id === "sky-turns") state.form.turns = Number(t.value) || 1;
    else if (t.id === "sky-duration") state.form.duration = Number(t.value) || 1;
    else if (t.id === "sky-scope") state.form.scope = t.value;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById("skyBtnAdd").addEventListener("click", () => openEditor(-1));
    document.getElementById("skyBtnExport").addEventListener("click", exportData);
    document.getElementById("skyBtnImport").addEventListener("click", () => document.getElementById("skyFileInput").click());
    document.getElementById("skyFileInput").addEventListener("change", e => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = "";
    });
    document.getElementById("skyBtnStats").addEventListener("click", showStats);
    document.getElementById("skyBtnReset").addEventListener("click", () => {
      if (!confirm("确定重置为游戏默认天象？当前本地修改将丢失。")) return;
      state.cards = (Array.isArray(window.GAME_SKY) ? window.GAME_SKY : []).map(normalizeCard);
      save(); renderList(); C.toast("已重置为默认天象");
    });

    document.getElementById("skyCancel").addEventListener("click", closeEditor);
    document.getElementById("skySave").addEventListener("click", saveEditor);
    document.getElementById("skyPreviewBtn").addEventListener("click", () => { if (state.form) previewCard(toCard(state.form)); });
    document.getElementById("skyPreviewClose").addEventListener("click", () => C.closeOverlay("skyPreviewOverlay"));
    document.getElementById("skyStClose").addEventListener("click", () => C.closeOverlay("skyStOverlay"));

    const ov = document.getElementById("skyOverlay");
    ["input", "change"].forEach(ev => ov.addEventListener(ev, handleField));

    document.getElementById("skylist").addEventListener("click", e => {
      const t = e.target;
      if (t.dataset.edit != null) return openEditor(Number(t.dataset.edit));
      if (t.dataset.preview != null) return previewCard(state.cards[Number(t.dataset.preview)]);
    });
    ["skyFSearch", "skyFType"].forEach(id => {
      document.getElementById(id).addEventListener("input", renderList);
      document.getElementById(id).addEventListener("change", renderList);
    });
  }

  function init() {
    loadData();
    bind();
    renderList();
    global.SKY._ready = true;
  }

  global.SKY = {
    init, get: () => state.cards, exportRaw, validateAll, importData, renderList, openEditor, _ready: false
  };
})(window);
