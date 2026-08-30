/* 支线 NPC 编辑器：支线路线的引路人、高潮对手与终局副考独立编辑。 */
(function (global) {
  "use strict";

  const C = global.Common;
  const ATTR_KEYS = (C && C.ATTR_KEYS) || ["shi", "ci", "lian", "bi", "xue", "si"];
  const ATTR = (C && C.ATTR) || { shi: "诗力", ci: "词力", lian: "联力", bi: "笔力", xue: "学力", si: "思力" };
  const STYLES = ATTR_KEYS.slice();
  const state = { data: null, editKey: null, form: null, _ready: false };

  const isObj = value => !!value && typeof value === "object" && !Array.isArray(value);
  const clone = value => JSON.parse(JSON.stringify(value));
  const nonEmpty = value => typeof value === "string" && value.trim().length > 0;
  const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const $ = id => document.getElementById(id);

  function seedData() {
    return clone(global.GAME_SIDEQUEST_NPCS || { version: 1, routes: {} });
  }

  function normalize(value) {
    const out = isObj(value) ? clone(value) : {};
    out.version = Math.max(1, Number(out.version) || 1);
    out.routes = isObj(out.routes) ? out.routes : {};
    Object.keys(out.routes).forEach(routeId => {
      const route = out.routes[routeId];
      if (!isObj(route)) {
        out.routes[routeId] = { guides: [], final: { secondary: {} } };
        return;
      }
      route.guides = Array.isArray(route.guides) ? route.guides : [];
      route.final = isObj(route.final) ? route.final : {};
      route.final.secondary = isObj(route.final.secondary) ? route.final.secondary : {};
    });
    return out;
  }

  function loadData() {
    const raw = C.load("sidequest_npcs", null);
    if (raw && isObj(raw.routes)) state.data = normalize(raw);
    else {
      state.data = normalize(seedData());
      C.store("sidequest_npcs", state.data);
    }
  }

  function routeName(routeId) {
    const routes = global.GAME_SIDEQUESTS && Array.isArray(global.GAME_SIDEQUESTS.routes)
      ? global.GAME_SIDEQUESTS.routes : [];
    const route = routes.find(item => item && item.id === routeId);
    return route && route.name ? route.name : routeId;
  }

  function variantName(variant) {
    return ({
      same_first: "同轴·前位",
      same_second: "同轴·后位",
      mixed: "混合"
    })[variant] || variant;
  }

  function roleName(entry) {
    if (entry.kind === "guide") return entry.npc.role || "引路人";
    if (entry.kind === "climax") return "高潮对手";
    return "终局副考·" + variantName(entry.variant);
  }

  function entries() {
    const out = [];
    if (!state.data || !isObj(state.data.routes)) return out;
    Object.entries(state.data.routes).forEach(([routeId, route]) => {
      if (!isObj(route)) return;
      (route.guides || []).forEach((npc, index) => {
        if (isObj(npc)) out.push({ routeId, kind: "guide", index, npc });
      });
      if (isObj(route.climax)) out.push({ routeId, kind: "climax", npc: route.climax });
      const secondary = route.final && isObj(route.final.secondary) ? route.final.secondary : {};
      Object.entries(secondary).forEach(([variant, npc]) => {
        if (isObj(npc)) out.push({ routeId, kind: "secondary", variant, npc });
      });
    });
    return out;
  }

  function getEntry(key) {
    const route = state.data && state.data.routes && state.data.routes[key.routeId];
    if (!route) return null;
    if (key.kind === "guide") return route.guides && route.guides[key.index];
    if (key.kind === "climax") return route.climax;
    return route.final && route.final.secondary && route.final.secondary[key.variant];
  }

  function entryPath(key) {
    if (key.kind === "guide") return `routes.${key.routeId}.guides[${key.index}]`;
    if (key.kind === "climax") return `routes.${key.routeId}.climax`;
    return `routes.${key.routeId}.final.secondary.${key.variant}`;
  }

  function combatEntry(key) { return key.kind !== "guide"; }

  function attrSummary(attrs) {
    return ATTR_KEYS.map(key => `${ATTR[key] || key} ${Number(attrs && attrs[key]) || 0}`).join("　");
  }

  function attrTotal(attrs) {
    return ATTR_KEYS.reduce((sum, key) => sum + (Number(attrs && attrs[key]) || 0), 0);
  }

  function renderStats() {
    const all = entries();
    const uniqueIds = new Set(all.map(entry => entry.npc.id).filter(Boolean));
    const issues = validateAll();
    const strip = $("sideNpcStatStrip");
    if (strip) strip.innerHTML = `
      <div class="stat"><b>${state.data ? Object.keys(state.data.routes || {}).length : 0}</b><span>支线路线</span></div>
      <div class="stat"><b>${all.length}</b><span>可编辑条目</span></div>
      <div class="stat"><b>${uniqueIds.size}</b><span>稳定 NPC ID</span></div>
      <div class="stat"><b>${issues.length}</b><span>校验问题</span></div>`;
  }

  function entryCard(entry) {
    const n = entry.npc;
    const combat = combatEntry(entry);
    const mech = combat && n.mech ? '<span class="badge sq-mech">三机制</span>' : "";
    const attrs = combat ? `<div class="side-npc-attrs">${attrSummary(n.attrs)} <span class="side-npc-sum">Σ${attrTotal(n.attrs)}</span></div>` : "";
    const text = !combat && n.text ? `<p class="side-npc-text">${C.esc(n.text)}</p>` : "";
    const title = n.title ? `<span class="side-npc-title">${C.esc(n.title)}</span>` : "";
    const focus = n.focusAttr ? `<span class="badge sq-focus">主属性·${C.esc(ATTR[n.focusAttr] || n.focusAttr)}</span>` : "";
    const index = entry.index == null ? "" : `data-sq-index="${entry.index}"`;
    const variant = entry.variant == null ? "" : `data-sq-variant="${C.esc(entry.variant)}"`;
    return `<article class="side-npc-role-card">
      <div class="side-npc-card-head">
        <span class="badge sq-role">${C.esc(roleName(entry))}</span>
        <code>${C.esc(n.id || "（无 ID）")}</code>
      </div>
      <h3>${C.esc(n.name || "（未命名）")}</h3>
      <div class="side-npc-card-meta">${title}${n.style ? `<span class="npc-style">偏${C.esc(ATTR[n.style] || n.style)}</span>` : ""}${focus}${mech}</div>
      ${text}${attrs}
      <div class="side-npc-card-actions">
        <button class="btn sm primary" type="button" data-sq-edit="1" data-sq-route="${C.esc(entry.routeId)}" data-sq-kind="${entry.kind}" ${index} ${variant}>编辑</button>
      </div>
    </article>`;
  }

  function renderList() {
    renderStats();
    const list = $("sideNpclist");
    if (!list) return;
    const query = String($("sideNpcFSearch") ? $("sideNpcFSearch").value : "").trim().toLocaleLowerCase();
    const grouped = [];
    Object.keys((state.data && state.data.routes) || {}).forEach(routeId => {
      const routeEntries = entries().filter(entry => entry.routeId === routeId &&
        (!query || `${entry.routeId} ${routeName(entry.routeId)} ${roleName(entry)} ${JSON.stringify(entry.npc)}`.toLocaleLowerCase().includes(query)));
      if (routeEntries.length) grouped.push(`<section class="side-npc-route-card">
        <div class="side-npc-route-head"><div><span class="brand-kicker">SIDE QUEST</span><h3>${C.esc(routeName(routeId))}</h3></div><code>${C.esc(routeId)}</code></div>
        <div class="side-npc-role-grid">${routeEntries.map(entryCard).join("")}</div>
      </section>`);
    });
    list.innerHTML = grouped.join("") || `<div class="empty"><b>没有匹配的支线 NPC</b><span>可搜索路线、角色、姓名或稳定 ID。</span></div>`;
  }

  function showMessage(text, bad) {
    const msg = $("sideNpcMsg");
    if (!msg) return;
    msg.textContent = text || "";
    msg.classList.toggle("err", !!bad);
    msg.classList.toggle("ok", !bad && !!text);
  }

  function populateEditor(key, npc) {
    const guide = key.kind === "guide";
    $("sideNpcTitle").textContent = `编辑支线 NPC · ${roleName({ ...key, npc })}`;
    $("sideNpcRoute").textContent = `${routeName(key.routeId)}（${key.routeId}）`;
    $("sideNpcRole").textContent = roleName({ ...key, npc });
    $("sideNpc-id").value = npc.id || "";
    $("sideNpc-name").value = npc.name || "";
    $("sideNpc-title").value = npc.title || "";
    $("sideNpcGuideFields").hidden = !guide;
    $("sideNpcCombatFields").hidden = guide;
    if (guide) {
      $("sideNpc-role").value = npc.role || "";
      $("sideNpc-text").value = npc.text || "";
    } else {
      $("sideNpc-style").value = npc.style || "";
      $("sideNpc-focusAttr").value = npc.focusAttr || "";
      ATTR_KEYS.forEach(keyName => {
        const input = document.querySelector(`#sideNpcAttrsBox [data-attr="${keyName}"]`);
        if (input) input.value = Number(npc.attrs && npc.attrs[keyName]) || 0;
      });
      $("sideNpc-mech").value = npc.mech ? JSON.stringify(npc.mech, null, 2) : "";
      $("sideNpcVariantHint").textContent = key.kind === "secondary"
        ? "终局副考的不同变体可以共用稳定 ID；它们会按立场组合分别出场。" : "高潮对手的稳定 ID 会同步为该路线的终局主考引用。";
    }
  }

  function openEditor(key) {
    const npc = getEntry(key);
    if (!npc) return;
    state.editKey = { ...key };
    state.form = clone(npc);
    populateEditor(key, state.form);
    showMessage("");
    C.openOverlay("sideNpcOverlay");
  }

  function readForm() {
    if (!state.form || !state.editKey) return null;
    const form = state.form;
    form.id = $("sideNpc-id").value.trim();
    form.name = $("sideNpc-name").value.trim();
    const title = $("sideNpc-title").value.trim();
    if (title) form.title = title; else delete form.title;
    if (state.editKey.kind === "guide") {
      const role = $("sideNpc-role").value.trim();
      const text = $("sideNpc-text").value.trim();
      if (role) form.role = role; else delete form.role;
      if (text) form.text = text; else delete form.text;
      return form;
    }
    form.style = $("sideNpc-style").value;
    const focusAttr = $("sideNpc-focusAttr").value;
    if (focusAttr) form.focusAttr = focusAttr; else delete form.focusAttr;
    form.attrs = {};
    ATTR_KEYS.forEach(key => {
      const input = document.querySelector(`#sideNpcAttrsBox [data-attr="${key}"]`);
      form.attrs[key] = Math.max(0, Math.floor(Number(input && input.value) || 0));
    });
    const mechText = $("sideNpc-mech").value.trim();
    if (!mechText) delete form.mech;
    else {
      try { form.mech = JSON.parse(mechText); }
      catch (error) { throw new Error("机制 JSON 解析失败：" + error.message); }
    }
    return form;
  }

  function validateEntry(npc, key, out) {
    const path = entryPath(key);
    if (!isObj(npc)) { out.push({ level: "err", path, msg: "必须是对象" }); return; }
    if (!nonEmpty(npc.id) || !/^[a-z][a-z0-9_-]*$/.test(npc.id.trim())) out.push({ level: "err", path: `${path}.id`, msg: "必须是小写稳定 ID（字母开头）" });
    if (!nonEmpty(npc.name)) out.push({ level: "err", path: `${path}.name`, msg: "名称不能为空" });
    if (key.kind === "guide") return;
    if (!STYLES.includes(npc.style)) out.push({ level: "err", path: `${path}.style`, msg: "文体必须是六维属性键之一" });
    if (!isObj(npc.attrs)) out.push({ level: "err", path: `${path}.attrs`, msg: "必须包含六维属性" });
    else ATTR_KEYS.forEach(attr => {
      if (!Number.isFinite(Number(npc.attrs[attr])) || Number(npc.attrs[attr]) < 0) out.push({ level: "err", path: `${path}.attrs.${attr}`, msg: "必须是非负数字" });
    });
    if (npc.mech != null && !isObj(npc.mech)) out.push({ level: "err", path: `${path}.mech`, msg: "机制配置必须是对象" });
  }

  function validateAll() {
    const out = [];
    if (!state.data || !isObj(state.data.routes)) return [{ level: "err", path: "routes", msg: "必须是对象" }];
    Object.entries(state.data.routes).forEach(([routeId, route]) => {
      const prefix = `routes.${routeId}`;
      if (!isObj(route)) { out.push({ level: "err", path: prefix, msg: "路线必须是对象" }); return; }
      if (!Array.isArray(route.guides)) out.push({ level: "err", path: `${prefix}.guides`, msg: "引路人必须是数组" });
      else route.guides.forEach((npc, index) => validateEntry(npc, { routeId, kind: "guide", index }, out));
      if (!isObj(route.climax)) out.push({ level: "err", path: `${prefix}.climax`, msg: "必须配置高潮对手" });
      else validateEntry(route.climax, { routeId, kind: "climax" }, out);
      const final = route.final;
      if (!isObj(final) || !isObj(final.secondary)) out.push({ level: "err", path: `${prefix}.final.secondary`, msg: "必须配置终局副考变体" });
      else Object.entries(final.secondary).forEach(([variant, npc]) => validateEntry(npc, { routeId, kind: "secondary", variant }, out));
      if (route.climax && final && final.primaryId !== route.climax.id) out.push({ level: "err", path: `${prefix}.final.primaryId`, msg: "必须引用当前高潮对手 ID" });
    });
    return out;
  }

  function save() {
    C.store("sidequest_npcs", state.data);
    C.setStatus("sidequest-npc", "已自动保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false }));
  }

  function saveEditor() {
    let form;
    try { form = readForm(); }
    catch (error) { showMessage(error.message, true); return; }
    const errors = [];
    validateEntry(form, state.editKey, errors);
    if (errors.length) { showMessage(errors.map(item => item.msg).join("；"), true); return; }
    const route = state.data.routes[state.editKey.routeId];
    if (state.editKey.kind === "guide") route.guides[state.editKey.index] = clone(form);
    else if (state.editKey.kind === "climax") {
      route.climax = clone(form);
      route.final = isObj(route.final) ? route.final : {};
      route.final.primaryId = form.id;
    } else {
      route.final = isObj(route.final) ? route.final : {};
      route.final.secondary = isObj(route.final.secondary) ? route.final.secondary : {};
      route.final.secondary[state.editKey.variant] = clone(form);
    }
    save();
    renderList();
    C.closeOverlay("sideNpcOverlay");
    C.toast(`已保存${form.name}`);
    state.form = null;
    state.editKey = null;
  }

  function closeEditor() {
    state.form = null;
    state.editKey = null;
    C.closeOverlay("sideNpcOverlay");
  }

  function mergeData(base, incoming) {
    const out = normalize(base);
    const src = normalize(incoming);
    Object.entries(src.routes).forEach(([routeId, sourceRoute]) => {
      if (!out.routes[routeId]) { out.routes[routeId] = clone(sourceRoute); return; }
      const targetRoute = out.routes[routeId];
      if (Array.isArray(sourceRoute.guides)) targetRoute.guides = sourceRoute.guides.map((npc, index) => clone(npc || (targetRoute.guides || [])[index])).filter(Boolean);
      if (hasOwn(sourceRoute, "climax")) targetRoute.climax = clone(sourceRoute.climax);
      if (hasOwn(sourceRoute, "final")) {
        targetRoute.final = Object.assign({}, targetRoute.final || {}, sourceRoute.final || {});
        targetRoute.final.secondary = Object.assign({}, (targetRoute.final && targetRoute.final.secondary) || {}, (sourceRoute.final && sourceRoute.final.secondary) || {});
      }
      Object.keys(sourceRoute).filter(key => !["guides", "climax", "final"].includes(key)).forEach(key => { targetRoute[key] = clone(sourceRoute[key]); });
    });
    return normalize(out);
  }

  function importData(data, mode) {
    const incoming = data && data["sidequest-npcs"] && !data.routes ? data["sidequest-npcs"] : data;
    if (!incoming || !isObj(incoming) || !isObj(incoming.routes)) throw new Error("支线 NPC 文件必须包含 routes 对象");
    state.data = mode ? normalize(incoming) : mergeData(state.data, incoming);
    save();
    renderList();
    C.toast(mode ? "已替换支线 NPC 配置" : "已合并支线 NPC 配置");
    return exportRaw();
  }

  function exportRaw() { return clone(state.data || normalize(seedData())); }

  function exportData() {
    const issues = validateAll();
    if (issues.length && !confirm(`有 ${issues.length} 处支线 NPC 校验问题，仍要导出吗？`)) return;
    const blob = new Blob([JSON.stringify(exportRaw(), null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "sidequest-npcs.json";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    C.toast("已导出 sidequest-npcs.json");
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (error) { alert("JSON 解析失败：" + error.message); return; }
      const incoming = data && data["sidequest-npcs"] ? data["sidequest-npcs"] : data;
      if (!incoming || !isObj(incoming.routes)) { alert("未识别的支线 NPC JSON（需要 version + routes）。"); return; }
      const replace = confirm("导入模式：\n\n点击「确定」= 替换全部支线 NPC；\n点击「取消」= 按路线合并（同路线同角色覆盖）。");
      try { importData(incoming, replace); }
      catch (error) { alert(error.message || String(error)); }
    };
    reader.readAsText(file, "utf-8");
  }

  function showStats() {
    const all = entries();
    const issues = validateAll();
    const body = $("sideNpcStBody");
    if (!body) return;
    const rows = Object.keys(state.data.routes || {}).map(routeId => {
      const count = all.filter(entry => entry.routeId === routeId).length;
      return `<tr><td>${C.esc(routeName(routeId))}</td><td><code>${C.esc(routeId)}</code></td><td class="num">${count}</td></tr>`;
    }).join("");
    body.innerHTML = `<p><b>支线路线：</b>${Object.keys(state.data.routes || {}).length}　<b>可编辑条目：</b>${all.length}　<b>稳定 ID：</b>${new Set(all.map(item => item.npc.id).filter(Boolean)).size}　<b>校验问题：</b>${issues.length}</p>
      <table class="stat-table"><tr><th>路线</th><th>ID</th><th>条目数</th></tr>${rows}</table>`;
    C.openOverlay("sideNpcStOverlay");
  }

  function resetData() {
    if (!confirm("确定将支线 NPC 恢复为默认种子吗？当前本地编辑会被覆盖。")) return;
    state.data = normalize(seedData());
    save();
    renderList();
    C.toast("支线 NPC 已恢复默认");
  }

  function bind() {
    $("sideNpcBtnImport").addEventListener("click", () => $("sideNpcFileInput").click());
    $("sideNpcFileInput").addEventListener("change", event => { if (event.target.files[0]) importFile(event.target.files[0]); event.target.value = ""; });
    $("sideNpcBtnExport").addEventListener("click", exportData);
    $("sideNpcBtnStats").addEventListener("click", showStats);
    $("sideNpcBtnReset").addEventListener("click", resetData);
    $("sideNpcCancel").addEventListener("click", closeEditor);
    $("sideNpcSave").addEventListener("click", saveEditor);
    $("sideNpcStClose").addEventListener("click", () => C.closeOverlay("sideNpcStOverlay"));
    $("sideNpcFSearch").addEventListener("input", renderList);
    $("sideNpclist").addEventListener("click", event => {
      const button = event.target.closest("[data-sq-edit]");
      if (!button) return;
      openEditor({
        routeId: button.dataset.sqRoute,
        kind: button.dataset.sqKind,
        index: button.dataset.sqIndex == null ? undefined : Number(button.dataset.sqIndex),
        variant: button.dataset.sqVariant
      });
    });
    $("sideNpcOverlay").addEventListener("input", event => {
      if (!state.form) return;
      const target = event.target;
      if (target.id === "sideNpc-mech") return;
      try { readForm(); } catch (_) { /* 保存时给出 JSON 错误 */ }
    });
    $("sideNpcOverlay").addEventListener("change", event => {
      if (!state.form) return;
      try { readForm(); } catch (_) { /* 保存时给出 JSON 错误 */ }
    });
  }

  function init() {
    loadData();
    bind();
    renderList();
    global.SIDEQUEST_NPC._ready = true;
  }

  global.SIDEQUEST_NPC = {
    init, get: () => state.data, exportRaw, validateAll, importData, renderList,
    count: () => entries().length, _ready: false
  };
})(window);
