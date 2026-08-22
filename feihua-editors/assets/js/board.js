/* =========================================================================
 * board.js — 地图编辑器模块
 * 编辑主环格子的类型 / 名称 / 图标 / 效果，以及地图全局属性（圈数 / 四边区段）。
 * 数据结构与游戏 config/board.json 兼容。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;
  const ATTR = C.ATTR, ATTR_KEYS = C.ATTR_KEYS;
  const MAX_ATTR_GAIN = 5;

  const CELL_TYPES = [
    { id: "start", name: "起点" },
    { id: "ping", name: "平韵格" },
    { id: "ze", name: "仄韵格" },
    { id: "quiz", name: "考题格" },
    { id: "event", name: "奇遇格" },
    { id: "battle", name: "论战格" },
    { id: "gate", name: "阶段门" },
    { id: "sky", name: "天象格" },
    { id: "mingjing", name: "名胜格" },
    { id: "landmark", name: " Landmark" },
    { id: "branch_gate", name: "岔路格" }
  ];
  const CELL_TYPE_IDS = CELL_TYPES.map(t => t.id);
  const GLYPH_KEYS = ["start", "ping", "ze", "quiz", "event", "battle", "gate", "sky", "mingjing", "landmark", "branch_gate"];
  const RING_ORDER = ["outer", "middle", "inner"];
  const RING_DEFAULTS = {
    outer: { name: "起势", label: "外圈", tone: "outer" },
    middle: { name: "验收", label: "中圈", tone: "middle" },
    inner: { name: "定稿", label: "内圈", tone: "inner" }
  };

  const state = { board: null, editIndex: -1, form: null, _ready: false };

  function emptyBoard() {
    return { version: 2, layout: "single_ring", laps: 2, sides: [], mainRing: [] };
  }

  function normalizeBoard(b) {
    b = b || {};
    const out = {
      version: Number(b.version) || 1,
      layout: b.layout === "concentric_spiral" ? "concentric_spiral" : "single_ring",
      laps: Math.max(1, Number(b.laps) || 2),
      sides: Array.isArray(b.sides) ? b.sides.map(normalizeSide) : [],
      mainRing: Array.isArray(b.mainRing) ? b.mainRing.map(normalizeCell) : []
    };
    // 保留编辑器不直接维护的额外字段（如 branches / branchCells），导出时原样写回
    for (const k of Object.keys(b)) {
      if (!out.hasOwnProperty(k)) out[k] = JSON.parse(JSON.stringify(b[k]));
    }
    // 系统必需内容迁移：旧版 localStorage / 旧工程没有 hiddenFinalRing。
    // 只在字段缺失时从当前官方种子补齐，不覆盖用户已经编辑过的终圈配置。
    if (!out.hiddenFinalRing && window.GAME_BOARD && window.GAME_BOARD.hiddenFinalRing) {
      out.hiddenFinalRing = JSON.parse(JSON.stringify(window.GAME_BOARD.hiddenFinalRing));
    }
    return out;
  }
  function normalizeSide(s) {
    s = s || {};
    return {
      id: String(s.id || "").trim(),
      name: String(s.name || "").trim(),
      range: [Number((s.range || [])[0]) || 0, Number((s.range || [])[1]) || 0],
      season: String(s.season || "").trim()
    };
  }
  function normalizeCell(c) {
    c = c || {};
    const out = {
      id: Number(c.id),
      type: CELL_TYPE_IDS.includes(c.type) ? c.type : "ping",
      name: String(c.name || "").trim()
    };
    if (c.icon) out.icon = String(c.icon).trim();
    if (c.desc) out.desc = String(c.desc).trim();
    for (const k of ["ring", "ringIndex", "routeIndex", "phaseGate"]) {
      if (c[k] !== undefined) out[k] = JSON.parse(JSON.stringify(c[k]));
    }
    const eff = cleanEffect(c.effect);
    if (Object.keys(eff).length) out.effect = eff;
    return out;
  }

  /* ---------------- 效果对象 ---------------- */
  function emptyEffect() { return { attrs: [], inspiration: 0, talent: "", item: "" }; }
  function cleanEffect(eff) {
    eff = eff || {};
    const out = {};
    const a = eff.attrs;
    if (a) {
      for (const k of ATTR_KEYS) {
        const v = Number(a[k]);
        if (v) { out.attrs = out.attrs || {}; out.attrs[k] = v; }
      }
    }
    if (eff.inspiration) out.inspiration = Number(eff.inspiration);
    if (eff.talent) out.talent = String(eff.talent).trim();
    if (eff.item) out.item = String(eff.item).trim();
    if (out.attrs && !Object.keys(out.attrs).length) delete out.attrs;
    return out;
  }
  function effToForm(eff) {
    eff = eff || {};
    const attrs = [];
    const a = eff.attrs || {};
    for (const k of ATTR_KEYS) if (a[k]) attrs.push({ k, v: Number(a[k]) });
    return { attrs, inspiration: Number(eff.inspiration) || 0, talent: eff.talent || "", item: eff.item || "" };
  }
  function formEffectToCanonical(fe) {
    fe = fe || {};
    const obj = {};
    const a = fe.attrs;
    if (Array.isArray(a)) a.forEach(x => { const v = Number(x.v); if (v) obj[x.k] = v; });
    else if (a) for (const k of ATTR_KEYS) { const v = Number(a[k]); if (v) obj[k] = v; }
    return cleanEffect({ attrs: obj, inspiration: fe.inspiration, talent: fe.talent, item: fe.item });
  }

  /* ---------------- 持久化 ---------------- */
  function save() {
    C.store("board", state.board);
    const t = new Date();
    C.setStatus("board", "已自动保存 " + t.toLocaleTimeString("zh-CN", { hour12: false }));
  }
  function loadData() {
    const raw = C.load("board", null);
    if (!raw) {
      const base = (window.GAME_BOARD && window.GAME_BOARD.mainRing) ? window.GAME_BOARD : emptyBoard();
      state.board = normalizeBoard(base);
      C.store("board", state.board);
    } else {
      state.board = normalizeBoard(raw);
      C.store("board", state.board); // 把自动补齐的系统字段立即写回，刷新后仍可发布
    }
  }

  /* ---------------- 校验 ---------------- */
  function validateEffect(eff, where, errors) {
    eff = eff || {};
    const a = eff.attrs || {};
    for (const k of Object.keys(a)) {
      if (!ATTR_KEYS.includes(k)) errors.push(where + "属性名非法：" + k);
      else if (Number(a[k]) > MAX_ATTR_GAIN) errors.push(where + "属性 " + ATTR[k] + " +" + a[k] + " 超过红线 +" + MAX_ATTR_GAIN);
    }
    if (eff.talent && !C.talentIds().includes(eff.talent)) errors.push(where + "文心引用不存在：" + eff.talent);
  }
  function validateCell(cell, all, selfIndex) {
    const errors = [], w = "格子" + (Number.isFinite(cell.id) ? " " + cell.id : "");
    if (!Number.isFinite(cell.id)) errors.push(w + " ID 缺失");
    else {
      const dup = all.findIndex((x, i) => x.id === cell.id && i !== selfIndex);
      if (dup >= 0) errors.push("ID " + cell.id + " 与第 " + (dup + 1) + " 格重复");
    }
    if (!CELL_TYPE_IDS.includes(cell.type)) errors.push(w + " 类型非法：" + cell.type);
    if (!cell.name) errors.push(w + " 名称不能为空");
    if (cell.effect) validateEffect(cell.effect, w + "·效果 ", errors);
    return { ok: errors.length === 0, errors };
  }
  function validateAll() {
    if (!state.board || !Array.isArray(state.board.mainRing)) return [];
    return state.board.mainRing.map((c, i) => ({ i, ...validateCell(c, state.board.mainRing, i) })).filter(r => !r.ok);
  }

  /* ---------------- 渲染列表 ---------------- */
  function sideOf(id) {
    const s = (state.board.sides || []).find(s => id >= s.range[0] && id <= s.range[1]);
    return s ? s.name : "";
  }
  function typeName(type) { return (CELL_TYPES.find(t => t.id === type) || {}).name || type; }
  function ringId(cell) { return RING_ORDER.includes(cell && cell.ring) ? cell.ring : ""; }
  function ringMeta(id) {
    const fallback = RING_DEFAULTS[id] || { name: "未归属", label: "未归属", tone: "unassigned" };
    const configured = ((state.board && state.board.rings) || []).find(r => r && r.id === id);
    return { id: id || "unassigned", name: (configured && configured.name) || fallback.name, label: fallback.label, tone: fallback.tone };
  }
  function ringSummary() {
    return RING_ORDER.map(id => {
      const meta = ringMeta(id);
      return { ...meta, count: state.board.mainRing.filter(cell => ringId(cell) === id).length };
    });
  }
  function isThreeRingBoard() { return ringSummary().some(ring => ring.count > 0); }
  function selectedRing() {
    const select = document.getElementById("boardFRing");
    return select && RING_ORDER.includes(select.value) ? select.value : "";
  }
  function nextRingIndex(ring) {
    return state.board.mainRing.filter(cell => ringId(cell) === ring)
      .reduce((max, cell) => Math.max(max, Number.isFinite(Number(cell.ringIndex)) ? Number(cell.ringIndex) : -1), -1) + 1;
  }
  function getFilters() {
    return {
      q: document.getElementById("boardFSearch").value.trim().toLowerCase(),
      ring: document.getElementById("boardFRing").value,
      type: document.getElementById("boardFType").value
    };
  }
  function filtered() {
    const f = getFilters();
    return state.board.mainRing.filter(c => {
      if (f.ring !== "all" && ringId(c) !== f.ring) return false;
      if (f.type !== "all" && c.type !== f.type) return false;
      if (f.q) {
        const hay = [String(c.id), c.name, c.icon || "", c.desc || "", C.effectDetail(c.effect)].join(" ").toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });
  }
  function renderStats() {
    const total = state.board.mainRing.length;
    const byType = {};
    const rings = ringSummary();
    state.board.mainRing.forEach(c => { byType[c.type] = (byType[c.type] || 0) + 1; });
    document.getElementById("boardStatStrip").innerHTML = `
      <div class="stat"><b>${total}</b><span>主环格数</span></div>
      ${rings.map(ring => `<div class="stat board-ring-stat ring-${ring.tone}"><b>${ring.count}</b><span>${ring.label} · ${C.esc(ring.name)}</span></div>`).join("")}
      <div class="stat"><b>${byType.ping || 0}</b><span>平韵</span></div>
      <div class="stat"><b>${byType.ze || 0}</b><span>仄韵</span></div>
      <div class="stat"><b>${byType.quiz || 0}</b><span>考题</span></div>
      <div class="stat"><b>${byType.battle || 0}</b><span>论战</span></div>
      <div class="stat"><b>${byType.event || 0}</b><span>奇遇</span></div>
      <div class="stat"><b>${byType.sky || 0}</b><span>天象</span></div>
      <div class="stat"><b>${byType.mingjing || 0}</b><span>名胜</span></div>`;
  }
  function renderRingTabs() {
    const box = document.getElementById("boardRingTabs");
    if (!box) return;
    const active = (document.getElementById("boardFRing") || {}).value || "all";
    const rings = ringSummary();
    box.innerHTML = `<div class="board-ring-tabs-head"><span class="brand-kicker">RING LAYERS</span><span>按圈层检视路线与格子</span></div>` + rings.map(ring => `
      <button class="board-ring-tab ring-${ring.tone} ${active === ring.id ? "active" : ""}" type="button" data-ring-filter="${ring.id}" aria-pressed="${active === ring.id}">
        <span class="board-ring-tab-label">${ring.label}</span>
        <strong>${C.esc(ring.name)}</strong>
        <span>${ring.count} 格</span>
      </button>`).join("");
  }
  function cellCard(c) {
    const idx = state.board.mainRing.indexOf(c);
    const side = sideOf(c.id);
    const ring = ringMeta(ringId(c));
    const eff = C.effectDetail(c.effect);
    const ringPosition = Number.isFinite(Number(c.ringIndex)) ? `第 ${Number(c.ringIndex) + 1} 格` : "未设圈内序号";
    return `<div class="q-card board-card ring-${ring.tone}" data-idx="${idx}">
      <div class="meta" style="min-width:92px">
        <span class="q-id">${c.id}</span>
        <span class="badge board-ring-badge ring-${ring.tone}">${C.esc(ring.label)} · ${C.esc(ring.name)}</span>
        <span class="badge board-type t-${c.type}">${C.esc(typeName(c.type))}</span>
        ${side ? `<span class="badge r-common">${C.esc(side)}</span>` : ""}
      </div>
      <div class="q-main">
        <p class="q-name">${C.esc(c.name)}${c.icon && c.icon !== c.type ? ` <span class="dim">(图标:${C.esc(c.icon)})</span>` : ""}</p>
        <div class="q-tags">
          <span class="t">${C.esc(ring.label)} · ${ringPosition}</span>
          <span class="t">ID ${c.id}</span>
          ${c.icon ? `<span class="t">图标 ${C.esc(c.icon)}</span>` : ""}
          ${c.effect ? `<span class="t">效果 ${C.esc(eff)}</span>` : ""}
        </div>
      </div>
      <div class="q-actions">
        <button class="btn sm" data-edit="${idx}">编辑</button>
        <button class="btn sm" data-preview="${idx}">预览</button>
      </div>
    </div>`;
  }
  function ringGroup(ring, cells) {
    if (!cells.length) return "";
    return `<section class="board-ring-group ring-${ring.tone}">
      <div class="board-ring-group-head"><div><span class="board-ring-badge ring-${ring.tone}">${C.esc(ring.label)}</span><b>${C.esc(ring.name)}</b></div><span>${cells.length} 格</span></div>
      <div class="board-ring-list">${cells.map(cellCard).join("")}</div>
    </section>`;
  }
  function renderList() {
    renderStats();
    renderRingTabs();
    const list = document.getElementById("boardlist");
    const items = filtered();
    if (!items.length) {
      list.innerHTML = `<div class="empty"><b>${state.board.mainRing.length ? "没有符合筛选条件的格子" : "主环为空"}</b>
        ${state.board.mainRing.length ? "试着调整筛选条件。" : "请导入 board.json 或重置默认地图。"}</div>`;
      return;
    }
    const f = getFilters();
    if (f.ring !== "all" || !isThreeRingBoard()) { list.innerHTML = items.map(cellCard).join(""); return; }
    const groups = ringSummary().map(ring => ringGroup(ring, items.filter(cell => ringId(cell) === ring.id)));
    const unassigned = items.filter(cell => !ringId(cell));
    if (unassigned.length) groups.push(ringGroup(ringMeta(""), unassigned));
    list.innerHTML = groups.join("");
  }

  /* ---------------- 效果编辑器（单格效果） ---------------- */
  function attrOptions(k) {
    return `<option value="">（无）</option>` +
      ATTR_KEYS.map(k2 => `<option value="${k2}" ${k2 === k ? "selected" : ""}>${ATTR[k2]}</option>`).join("");
  }
  function effectInner(eff) {
    const attrRows = (eff.attrs || []).map((a, i) => `
      <div class="opt-row eff-attr" data-i="${i}">
        <span class="ord">${i + 1}</span>
        <select class="eff-attr-k">${attrOptions(a.k)}</select>
        <input type="number" class="eff-attr-v" value="${a.v}" step="1"/>
        <button class="opt-del eff-attr-del" title="删除属性">×</button>
      </div>`).join("");
    return `<div class="eff-box" data-target="cell">
      <div class="eff-attrs">${attrRows || '<div style="font-size:12px;color:var(--ink2)">暂无属性加成</div>'}</div>
      <button class="btn sm opt-add eff-attr-add">＋ 添加属性</button>
      <div class="row2" style="margin-top:8px">
        <div class="field" style="margin:0"><label>灵感变化</label>
          <input type="number" class="eff-insp" value="${eff.inspiration || 0}" step="1"/></div>
        <div class="field" style="margin:0"><label>文心（可选）</label>
          <input type="text" class="eff-talent" list="talentList" value="${C.esc(eff.talent || "")}" placeholder="如 T007"/></div>
      </div>
      <div class="eff-talent-info" data-target="cell"></div>
      <div class="field" style="margin:8px 0 0"><label>道具（可选）</label>
        <input type="text" class="eff-item" value="${C.esc(eff.item || "")}" placeholder="留空=无"/></div>
    </div>`;
  }
  function updateTalentInfo() {
    const box = document.querySelector('#boardOverlay .eff-box[data-target="cell"]');
    if (!box) return;
    const info = box.querySelector(".eff-talent-info");
    if (!info) return;
    const id = (state.form.effect.talent || "").trim();
    if (!id) { info.className = "eff-talent-info"; info.textContent = ""; return; }
    const t = C.talentById(id);
    if (!t) {
      info.className = "eff-talent-info bad";
      info.textContent = "⚠ 未找到文心 " + id;
      return;
    }
    const txt = (global.TALENT && global.TALENT.effectText) ? global.TALENT.effectText(t.effect) : "";
    info.className = "eff-talent-info ok";
    info.innerHTML = `↔ 关联文心：<b>${C.esc(t.name)}</b> <span class="dim">(${C.esc(t.id)} · ${t.kind === "active" ? "主动" : "被动"})</span>${txt ? " — " + C.esc(txt) : ""}`;
  }
  function rerenderEffBox() {
    const box = document.querySelector('#boardOverlay .eff-box[data-target="cell"]');
    if (box) { box.outerHTML = effectInner(state.form.effect); updateTalentInfo(); }
  }

  /* ---------------- 编辑弹窗 ---------------- */
  function openEditor(index) {
    state.editIndex = index;
    const src = index >= 0 ? state.board.mainRing[index] : null;
    if (src) {
      state.form = {
        id: src.id, type: src.type, name: src.name,
        icon: src.icon || "", desc: src.desc || "",
        ring: src.ring, ringIndex: src.ringIndex, routeIndex: src.routeIndex,
        phaseGate: src.phaseGate ? JSON.parse(JSON.stringify(src.phaseGate)) : undefined,
        effect: effToForm(src.effect)
      };
    } else {
      const nextId = (state.board.mainRing.length ? Math.max(...state.board.mainRing.map(c => c.id)) + 1 : 0);
      const ring = selectedRing() || (isThreeRingBoard() ? "outer" : "");
      state.form = {
        id: nextId, type: "ping", name: "", icon: "", desc: "", effect: emptyEffect(),
        ...(ring ? { ring, ringIndex: nextRingIndex(ring), routeIndex: nextId } : {})
      };
    }
    document.getElementById("boardTitle").textContent = src ? "编辑格子 · " + src.id : "新增格子";
    document.getElementById("board-cell-id").value = state.form.id;
    const ring = ringMeta(ringId(state.form));
    const ringReadout = document.getElementById("board-cell-ring");
    if (ringReadout) {
      ringReadout.className = "board-ring-readout ring-" + ring.tone;
      ringReadout.textContent = ringId(state.form)
        ? `${ring.label} · ${ring.name}${Number.isFinite(Number(state.form.ringIndex)) ? ` · 第 ${Number(state.form.ringIndex) + 1} 格` : ""}`
        : "未归属（旧单环数据）";
    }
    document.getElementById("board-cell-type").value = state.form.type;
    document.getElementById("board-cell-name").value = state.form.name;
    document.getElementById("board-cell-icon").value = state.form.icon;
    document.getElementById("board-cell-desc").value = state.form.desc;
    document.getElementById("boardEffectBox").innerHTML = effectInner(state.form.effect);
    updateTalentInfo();
    const msg = document.getElementById("boardMsg"); msg.className = "msg"; msg.textContent = "";
    C.openOverlay("boardOverlay");
  }
  function closeEditor() { C.closeOverlay("boardOverlay"); state.editIndex = -1; state.form = null; }

  function toCell(form) {
    const out = {
      id: Number(form.id),
      type: CELL_TYPE_IDS.includes(form.type) ? form.type : "ping",
      name: String(form.name || "").trim()
    };
    if (form.icon && form.icon !== out.type) out.icon = String(form.icon).trim();
    if (form.desc) out.desc = String(form.desc).trim();
    for (const k of ["ring", "ringIndex", "routeIndex", "phaseGate"]) {
      if (form[k] !== undefined) out[k] = JSON.parse(JSON.stringify(form[k]));
    }
    const eff = formEffectToCanonical(form.effect);
    if (Object.keys(eff).length) out.effect = eff;
    return out;
  }
  function saveEditor() {
    const cell = toCell(state.form);
    const { ok, errors } = validateCell(cell, state.board.mainRing, state.editIndex);
    const msg = document.getElementById("boardMsg");
    if (!ok) {
      msg.className = "msg err";
      msg.innerHTML = "✗ 无法保存：<br>• " + errors.join("<br>• ");
      return;
    }
    if (state.editIndex >= 0) {
      state.board.mainRing[state.editIndex] = cell;
      C.toast("已更新格子 " + cell.id);
    } else {
      state.board.mainRing.push(cell);
      state.board.mainRing.sort((a, b) => a.id - b.id);
      C.toast("已新增格子 " + cell.id);
    }
    save(); closeEditor(); renderList();
  }

  /* ---------------- 地图属性弹窗 ---------------- */
  function openMapProps() {
    document.getElementById("boardLaps").value = state.board.laps;
    const tbody = document.getElementById("boardSidesBody");
    tbody.innerHTML = (state.board.sides || []).map((s, i) => `
      <tr data-si="${i}">
        <td><input type="text" class="side-id" value="${C.esc(s.id)}"/></td>
        <td><input type="text" class="side-name" value="${C.esc(s.name)}"/></td>
        <td><input type="number" class="side-min" value="${s.range[0]}" min="0"/></td>
        <td><input type="number" class="side-max" value="${s.range[1]}" min="0"/></td>
        <td><input type="text" class="side-season" value="${C.esc(s.season)}"/></td>
      </tr>`).join("");
    C.openOverlay("boardPropsOverlay");
  }
  function closeMapProps() { C.closeOverlay("boardPropsOverlay"); }
  function saveMapProps() {
    const laps = Math.max(1, Number(document.getElementById("boardLaps").value) || 2);
    state.board.laps = laps;
    const rows = document.querySelectorAll("#boardSidesBody tr");
    const sides = [];
    rows.forEach(row => {
      const id = row.querySelector(".side-id").value.trim();
      const name = row.querySelector(".side-name").value.trim();
      const min = Number(row.querySelector(".side-min").value) || 0;
      const max = Number(row.querySelector(".side-max").value) || 0;
      const season = row.querySelector(".side-season").value.trim();
      if (id) sides.push({ id, name, range: [min, max], season });
    });
    state.board.sides = sides;
    save(); closeMapProps(); renderList();
  }

  /* ---------------- 预览 ---------------- */
  function previewCell(cell) {
    const side = sideOf(cell.id);
    const ring = ringMeta(ringId(cell));
    document.getElementById("boardPreviewBody").innerHTML = `
      <div class="board-preview-card ring-${ring.tone}">
        <span class="board-ring-badge ring-${ring.tone}">${C.esc(ring.label)} · ${C.esc(ring.name)}</span>
        <span class="badge board-type t-${cell.type}">${C.esc(typeName(cell.type))}</span>
        <h3>${C.esc(cell.name)} <span class="dim">#${cell.id}</span></h3>
        ${ringId(cell) ? `<p>圈内位置：第 ${Number(cell.ringIndex || 0) + 1} 格</p>` : ""}
        ${side ? `<p>所属区段：${C.esc(side)}</p>` : ""}
        ${cell.icon ? `<p>图标覆盖：<code>${C.esc(cell.icon)}</code>${cell.icon === cell.type ? " <span class='dim'>（与类型相同）</span>" : ""}</p>` : ""}
        ${cell.effect ? `<div class="ev-detail"><b>落地效果</b><br>${C.effectDetail(cell.effect)}</div>` : ""}
      </div>`;
    C.openOverlay("boardPreviewOverlay");
  }

  /* ---------------- 导入 / 导出 ---------------- */
  function importData(data, mode) {
    if (!data || typeof data !== "object") { C.toast("地图数据格式错误"); return; }
    const incoming = normalizeBoard(data);
    if (mode) {
      state.board = incoming;
      C.toast("已替换为新的地图配置");
    } else {
      const map = new Map(state.board.mainRing.map((c, i) => [c.id, i]));
      let added = 0, updated = 0;
      incoming.mainRing.forEach(c => {
        if (map.has(c.id)) { state.board.mainRing[map.get(c.id)] = c; updated++; }
        else { state.board.mainRing.push(c); added++; }
      });
      // 合并额外字段
      for (const k of Object.keys(incoming)) {
        if (k !== "mainRing") state.board[k] = incoming[k];
      }
      state.board.mainRing.sort((a, b) => a.id - b.id);
      C.toast(`合并完成：新增 ${added} 格，更新 ${updated} 格`);
    }
    save(); renderList();
  }
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (e) { alert("JSON 解析失败：" + e.message); return; }
      if (!data || typeof data !== "object") { alert("未识别的 JSON 结构"); return; }
      if (!Array.isArray(data.mainRing)) { alert("不是地图配置文件（缺少 mainRing 数组）"); return; }
      const mode = confirm(
        `成功读取地图配置（${data.mainRing.length} 格）。\n\n点击「确定」= 替换当前地图；\n点击「取消」= 按格子 ID 合并（已存在则覆盖，不存在则追加）。`);
      importData(data, mode);
    };
    reader.readAsText(file, "utf-8");
  }
  function exportRaw() {
    const board = JSON.parse(JSON.stringify(state.board));
    board.mainRing = board.mainRing.map(c => {
      const out = { id: c.id, type: c.type, name: c.name };
      if (c.icon) out.icon = c.icon;
      if (c.desc) out.desc = c.desc;
      for (const k of ["ring", "ringIndex", "routeIndex", "phaseGate"]) {
        if (c[k] !== undefined) out[k] = JSON.parse(JSON.stringify(c[k]));
      }
      if (c.effect) out.effect = c.effect;
      return out;
    });
    return board;
  }
  function exportData() {
    const bad = validateAll();
    if (bad.length) {
      const ids = bad.slice(0, 8).map(r => state.board.mainRing[r.i].id).join("、");
      if (!confirm(`有 ${bad.length} 格存在校验问题（如：${ids}…）。\n仍要导出吗？建议先修正再导出。`)) return;
    }
    const data = JSON.stringify(exportRaw(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "board.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    C.toast("已导出 board.json");
  }

  /* ---------------- 统计弹窗 ---------------- */
  function showStats() {
    const byType = {};
    const rings = ringSummary();
    state.board.mainRing.forEach(c => { byType[c.type] = (byType[c.type] || 0) + 1; });
    const rows = CELL_TYPES.map(t => `<tr><td>${C.esc(t.name)}</td><td class="num">${byType[t.id] || 0}</td></tr>`).join("");
    document.getElementById("boardStBody").innerHTML = `
      <p><b>主环格数：</b>${state.board.mainRing.length}　<b>圈数：</b>${state.board.laps}</p>
      <h4 style="margin:14px 0 6px">三圈路线</h4>
      <table class="stat-table"><tr><th>圈层</th><th>路线名称</th><th>格数</th></tr>
        ${rings.map(ring => `<tr><td><span class="board-ring-badge ring-${ring.tone}">${C.esc(ring.label)}</span></td><td>${C.esc(ring.name)}</td><td class="num">${ring.count}</td></tr>`).join("")}</table>
      <h4 style="margin:14px 0 6px">按类型</h4>
      <table class="stat-table"><tr><th>类型</th><th>数量</th></tr>${rows}</table>
      <h4 style="margin:14px 0 6px">区段</h4>
      <table class="stat-table"><tr><th>ID</th><th>名称</th><th>范围</th><th>季节</th></tr>
      ${(state.board.sides || []).map(s => `<tr><td>${C.esc(s.id)}</td><td>${C.esc(s.name)}</td><td>${s.range[0]}–${s.range[1]}</td><td>${C.esc(s.season)}</td></tr>`).join("")}</table>`;
    C.openOverlay("boardStOverlay");
  }

  /* ---------------- 字段输入处理 ---------------- */
  function handleField(e) {
    const t = e.target;
    const box = t.closest && t.closest(".eff-box");
    if (box && state.form) {
      const eff = state.form.effect;
      if (t.classList.contains("eff-attr-k")) { const row = t.closest(".eff-attr"); eff.attrs[Number(row.dataset.i)].k = t.value; }
      else if (t.classList.contains("eff-attr-v")) { const row = t.closest(".eff-attr"); eff.attrs[Number(row.dataset.i)].v = Number(t.value) || 0; }
      else if (t.classList.contains("eff-insp")) eff.inspiration = Number(t.value) || 0;
      else if (t.classList.contains("eff-talent")) { eff.talent = t.value.trim(); updateTalentInfo(); }
      else if (t.classList.contains("eff-item")) eff.item = t.value.trim();
      return;
    }
    if (!state.form) return;
    if (t.id === "board-cell-type") state.form.type = t.value;
    else if (t.id === "board-cell-name") state.form.name = t.value;
    else if (t.id === "board-cell-icon") state.form.icon = t.value;
    else if (t.id === "board-cell-desc") state.form.desc = t.value;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById("boardBtnAdd").addEventListener("click", () => openEditor(-1));
    document.getElementById("boardBtnExport").addEventListener("click", exportData);
    document.getElementById("boardBtnImport").addEventListener("click", () => document.getElementById("boardFileInput").click());
    document.getElementById("boardFileInput").addEventListener("change", e => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = "";
    });
    document.getElementById("boardBtnStats").addEventListener("click", showStats);
    document.getElementById("boardBtnProps").addEventListener("click", openMapProps);
    document.getElementById("boardBtnReset").addEventListener("click", () => {
      if (!confirm("确定重置为游戏默认地图？当前本地修改将丢失。")) return;
      state.board = normalizeBoard(window.GAME_BOARD || emptyBoard());
      save(); renderList(); C.toast("已重置为默认地图");
    });

    document.getElementById("boardCancel").addEventListener("click", closeEditor);
    document.getElementById("boardSave").addEventListener("click", saveEditor);
    document.getElementById("boardPreviewClose").addEventListener("click", () => C.closeOverlay("boardPreviewOverlay"));
    document.getElementById("boardStClose").addEventListener("click", () => C.closeOverlay("boardStOverlay"));
    document.getElementById("boardPropsCancel").addEventListener("click", closeMapProps);
    document.getElementById("boardPropsSave").addEventListener("click", saveMapProps);

    const ov = document.getElementById("boardOverlay");
    ["input", "change"].forEach(ev => ov.addEventListener(ev, handleField));
    ov.addEventListener("click", e => {
      const t = e.target;
      const box = t.closest && t.closest(".eff-box");
      if (t.classList.contains("eff-attr-add") && box) {
        state.form.effect.attrs.push({ k: "shi", v: 0 });
        rerenderEffBox(); return;
      }
      if (t.classList.contains("eff-attr-del") && box) {
        const row = t.closest(".eff-attr");
        state.form.effect.attrs.splice(Number(row.dataset.i), 1);
        rerenderEffBox(); return;
      }
    });

    document.getElementById("boardlist").addEventListener("click", e => {
      const t = e.target;
      if (t.dataset.edit != null) return openEditor(Number(t.dataset.edit));
      if (t.dataset.preview != null) return previewCell(state.board.mainRing[Number(t.dataset.preview)]);
    });
    document.getElementById("boardRingTabs").addEventListener("click", e => {
      const tab = e.target.closest("[data-ring-filter]");
      if (!tab) return;
      const select = document.getElementById("boardFRing");
      select.value = select.value === tab.dataset.ringFilter ? "all" : tab.dataset.ringFilter;
      renderList();
    });
    ["boardFSearch", "boardFRing", "boardFType"].forEach(id => {
      document.getElementById(id).addEventListener("input", renderList);
      document.getElementById(id).addEventListener("change", renderList);
    });
  }

  function init() {
    loadData();
    bind();
    renderList();
    global.BOARD._ready = true;
  }

  global.BOARD = {
    init, get: () => state.board, exportRaw, validateAll, importData, renderList, openEditor, _ready: false
  };
})(window);
