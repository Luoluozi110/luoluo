/* =========================================================================
 * album.js - 传世名篇编辑器
 * 兼容旧 album.json：保留旧字段，并为 growth / branches 提供可视化编辑、
 * 主线-分支关系预览、排序、复制、校验、撤销/重做及安全导入。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;
  const ATTR_KEYS = C.ATTR_KEYS;
  const STYLES = ["shi", "ci", "lian"];
  const UNLOCK_TYPES = [
    ["wins", "累计论战获胜"], ["styleWins", "指定文体获胜"], ["quizzes", "累计答对题目"],
    ["events", "累计触发奇遇"], ["fengbi", "触发封笔"], ["palaceSweep", "殿试三连胜"],
    ["games", "完成对局"], ["multiplayer", "多人局获胜"], ["maxTotal", "单局最高总评"]
  ];
  const REWARD_TYPES = [["attr", "属性"], ["inspiration", "灵感"], ["inspirationMax", "灵感上限"], ["talent", "文心"], ["title", "称号"]];
  const TRIGGERS = [["start", "开局"], ["battle", "论战"], ["quiz", "答题"], ["event", "奇遇"], ["phase", "阶段"], ["score", "评分"]];
  const EFFECT_TYPES = [["attr", "属性"], ["inspiration", "灵感"], ["inspirationMax", "灵感上限"], ["insight", "心得"], ["manuscript", "稿页"], ["strategy", "筹策"], ["studySlot", "研修位"], ["techniqueXp", "技法经验"], ["pct", "百分比"]];
  const RESULTS = [["", "不限"], ["win", "胜"], ["draw", "平"], ["lose", "负"]];
  const state = { cards: [], editIndex: -1, form: null, _ready: false, undo: [], redo: [], historyLimit: 30 };

  const copy = value => JSON.parse(JSON.stringify(value));
  const safeJson = (text, fallback) => { try { return JSON.parse(text); } catch (_) { return fallback; } };
  const opts = (items, selected) => items.map(([value, label]) => `<option value="${C.esc(value)}" ${String(value) === String(selected == null ? "" : selected) ? "selected" : ""}>${C.esc(label)}</option>`).join("");
  const valueOf = id => { const el = document.getElementById(id); return el ? el.value : ""; };
  const numberValue = (id, fallback = 0) => { const n = Number(valueOf(id)); return Number.isFinite(n) ? n : fallback; };

  function normalizeUnlock(u) {
    u = u || {};
    const type = UNLOCK_TYPES.some(x => x[0] === u.type) ? u.type : "wins";
    const out = { ...u, type, min: Math.max(1, Number(u.min) || 1) };
    if (type === "styleWins") out.style = STYLES.includes(u.style) ? u.style : "shi";
    return out;
  }
  function normalizeReward(r) {
    r = r || {};
    const type = REWARD_TYPES.some(x => x[0] === r.type) ? r.type : "attr";
    const out = { ...r, type };
    if (type === "attr") { out.attr = ATTR_KEYS.includes(r.attr) ? r.attr : "shi"; out.value = Number(r.value) || 0; }
    else if (type === "inspiration" || type === "inspirationMax") out.value = Number(r.value) || 0;
    else if (type === "talent") { out.talent = String(r.talent || "").trim(); if (r.name) out.name = String(r.name).trim(); if (r.desc) out.desc = String(r.desc).trim(); }
    else out.title = String(r.title || "").trim();
    return out;
  }
  function normalizeGrowth(g) {
    g = g && typeof g === "object" && !Array.isArray(g) ? g : {};
    const out = { ...g };
    for (const k of ["baseXp", "winXp", "drawXp", "loseXp", "styleXp"]) if (g[k] != null) out[k] = Math.max(0, Number(g[k]) || 0);
    if (g.style && STYLES.includes(g.style)) out.style = g.style;
    return out;
  }
  function normalizeEffect(e) {
    e = e && typeof e === "object" ? e : {};
    const out = { ...e };
    out.trigger = TRIGGERS.some(x => x[0] === e.trigger) ? e.trigger : "start";
    out.type = EFFECT_TYPES.some(x => x[0] === e.type) ? e.type : "inspiration";
    out.value = Number.isFinite(Number(e.value)) ? Number(e.value) : 0;
    if (e.minLevel != null) out.minLevel = Math.max(1, Number(e.minLevel) || 1);
    if (e.style && STYLES.includes(e.style)) out.style = e.style; else delete out.style;
    if (e.result && RESULTS.some(x => x[0] === e.result)) out.result = e.result; else delete out.result;
    if (e.phase != null && String(e.phase).trim()) out.phase = String(e.phase).trim(); else delete out.phase;
    if (e.attr && ATTR_KEYS.includes(e.attr)) out.attr = e.attr; else if (out.type !== "attr") delete out.attr;
    if (e.name != null) out.name = String(e.name).trim();
    if (e.desc != null) out.desc = String(e.desc).trim();
    return out;
  }
  function normalizeBranches(branches) {
    if (!Array.isArray(branches)) return [];
    return branches.filter(b => b && (b.id || b.name)).map((b, i) => ({
      ...b,
      id: String(b.id || `route_${i + 1}`).trim(), name: String(b.name || b.id || `路线${i + 1}`).trim(),
      minLevel: Math.max(1, Number(b.minLevel) || 1), desc: b.desc != null ? String(b.desc).trim() : "",
      effects: Array.isArray(b.effects) ? b.effects.filter(Boolean).map(normalizeEffect) : []
    }));
  }
  function normalizeCard(c) {
    c = c && typeof c === "object" ? c : {};
    return { ...c, id: String(c.id || "").trim(), name: String(c.name || "").trim(), unlock: normalizeUnlock(c.unlock), reward: normalizeReward(c.reward), rewardDesc: String(c.rewardDesc || "").trim(), text: String(c.text || "").trim(), growth: normalizeGrowth(c.growth), branches: normalizeBranches(c.branches) };
  }
  function snapshot() { return copy(state.cards); }
  function pushHistory(before) { state.undo.push(before); if (state.undo.length > state.historyLimit) state.undo.shift(); state.redo = []; updateHistoryButtons(); }
  function commit(next, message) { const before = snapshot(); state.cards = next.map(normalizeCard); pushHistory(before); save(); renderList(); if (message) C.toast(message); }
  function updateHistoryButtons() {
    const u = document.getElementById("albumBtnUndo"), r = document.getElementById("albumBtnRedo");
    if (u) u.disabled = !state.undo.length; if (r) r.disabled = !state.redo.length;
  }
  function undo() { if (!state.undo.length) return; state.redo.push(snapshot()); state.cards = state.undo.pop().map(normalizeCard); save(); renderList(); updateHistoryButtons(); C.toast("已撤销名篇数据变更"); }
  function redo() { if (!state.redo.length) return; state.undo.push(snapshot()); state.cards = state.redo.pop().map(normalizeCard); save(); renderList(); updateHistoryButtons(); C.toast("已恢复名篇数据变更"); }
  function save() { const ok = C.store("album", state.cards); C.setStatus("album", "已自动保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false })); updateHistoryButtons(); return ok; }
  function loadData() { const raw = C.load("album", null); state.cards = (Array.isArray(raw) ? raw : (window.GAME_ALBUM || [])).map(normalizeCard); if (!raw) C.store("album", state.cards); updateHistoryButtons(); }

  function unlockText(u) { const labels = Object.fromEntries(UNLOCK_TYPES), styles = { shi: "诗", ci: "词", lian: "联" }; return (labels[u.type] || u.type) + (u.type === "styleWins" ? "以" + (styles[u.style] || u.style) + "出战 " : " ") + u.min + " 次"; }
  function rewardText(r) { const a = C.ATTR; if (!r) return "（无奖励）"; if (r.type === "attr") return (a[r.attr] || r.attr) + " +" + r.value; if (r.type === "inspiration") return "灵感 +" + r.value; if (r.type === "inspirationMax") return "灵感上限 +" + r.value; if (r.type === "talent") return "文心「" + (r.name || r.talent || "未指定") + "」"; return "称号「" + (r.title || "未指定") + "」"; }
  function effectText(e) { const t = Object.fromEntries(TRIGGERS)[e.trigger] || e.trigger; const ty = Object.fromEntries(EFFECT_TYPES)[e.type] || e.type; const v = e.type === "pct" ? `${Number(e.value || 0) * 100}%` : e.value; return `${t}·${ty} ${v}${e.result ? `（${e.result}）` : ""}${e.style ? `·${e.style}` : ""}`; }

  function validate(card, all, selfIndex) {
    const e = [], w = "名篇 " + (card.id || "(无ID)");
    if (!/^A\d+$/i.test(card.id)) e.push(w + " ID 非法（应形如 A001）"); else if (all.findIndex((x, i) => x.id === card.id && i !== selfIndex) >= 0) e.push("ID " + card.id + " 重复");
    if (!card.name) e.push(w + " 名称不能为空"); if (!card.text) e.push(w + " 典故文本不能为空");
    if (!card.unlock || !UNLOCK_TYPES.some(x => x[0] === card.unlock.type) || Number(card.unlock.min) < 1) e.push(w + " 解锁条件非法");
    const r = card.reward || {};
    if (!REWARD_TYPES.some(x => x[0] === r.type)) e.push(w + " 奖励类型非法");
    if (r.type === "attr" && (!ATTR_KEYS.includes(r.attr) || !Number.isFinite(Number(r.value)))) e.push(w + " 属性奖励非法");
    if ((r.type === "inspiration" || r.type === "inspirationMax") && !Number.isInteger(Number(r.value))) e.push(w + " 灵感奖励须为整数");
    if (r.type === "talent" && (!r.talent || !C.talentById(r.talent))) e.push(w + " 引用文心不存在：" + (r.talent || "（空）"));
    const seen = new Set();
    for (const b of card.branches || []) {
      if (!b.id || !b.name || seen.has(b.id)) e.push(w + " 分支 ID / 名称非法或重复"); seen.add(b.id);
      if (Number(b.minLevel) < 1) e.push(w + " 分支「" + b.id + "」最低等级非法"); if (!Array.isArray(b.effects)) e.push(w + " 分支「" + b.id + "」效果必须是数组");
      for (const ef of b.effects || []) {
        if (!TRIGGERS.some(x => x[0] === ef.trigger)) e.push(w + " 分支「" + b.id + "」触发点非法：" + ef.trigger);
        if (!EFFECT_TYPES.some(x => x[0] === ef.type)) e.push(w + " 分支「" + b.id + "」效果类型非法：" + ef.type);
        if (ef.type === "attr" && !ATTR_KEYS.includes(ef.attr)) e.push(w + " 分支「" + b.id + "」属性效果缺少合法 attr");
        if (!Number.isFinite(Number(ef.value))) e.push(w + " 分支「" + b.id + "」效果数值非法");
        if (ef.style && !STYLES.includes(ef.style)) e.push(w + " 分支「" + b.id + "」文体条件非法");
        if (ef.result && !RESULTS.some(x => x[0] === ef.result)) e.push(w + " 分支「" + b.id + "」结果条件非法");
        if (ef.minLevel != null && (!Number.isInteger(Number(ef.minLevel)) || Number(ef.minLevel) < Number(b.minLevel))) e.push(w + " 分支「" + b.id + "」效果等级不能低于分支等级");
      }
    }
    return e;
  }
  function validateAll() { return state.cards.flatMap((c, i) => validate(c, state.cards, i).map(msg => ({ i, msg }))); }

  function renderStats() { const el = document.getElementById("albumStatStrip"); if (el) el.innerHTML = `<div class="stat"><b>${state.cards.length}</b><span>名篇总数</span></div><div class="stat"><b>${state.cards.filter(c => c.branches.length).length}</b><span>成长型</span></div><div class="stat"><b>${state.cards.reduce((n, c) => n + c.branches.reduce((m, b) => m + b.effects.length, 0), 0)}</b><span>分支效果</span></div><div class="stat"><b>${validateAll().length}</b><span>校验问题</span></div>`; }
  function renderList() {
    renderStats(); const list = document.getElementById("albumlist"); if (!list) return;
    const q = (valueOf("albumFSearch") || "").trim().toLowerCase();
    const arr = state.cards.filter(c => !q || [c.id, c.name, c.text, rewardText(c.reward), JSON.stringify(c.branches)].join(" ").toLowerCase().includes(q));
    list.innerHTML = arr.length ? arr.map(c => { const i = state.cards.indexOf(c); const bad = validate(c, state.cards, i).length; return `<div class="q-card"><div class="meta"><span class="q-id">${C.esc(c.id)}</span><span class="badge r-common">${C.esc(c.unlock.type)}</span><span class="badge r-common">${c.branches.length ? "成长×" + c.branches.length : "旧式"}</span>${bad ? `<span class="badge orphan">${bad} 个问题</span>` : ""}</div><div class="q-main"><p class="q-name">${C.esc(c.name)}</p><div class="q-tags"><span class="t">主线解锁：${C.esc(unlockText(c.unlock))}</span><span class="t">主线奖励：${C.esc(c.rewardDesc || rewardText(c.reward))}</span></div><div class="q-opts">${C.esc(c.text.slice(0, 120))}</div>${c.branches.length ? `<div class="q-opts" style="color:var(--mo-3);font-size:11px">分支路线：${c.branches.map((b, bi) => `${bi + 1}. ${C.esc(b.name)}（Lv${b.minLevel}，${b.effects.length} 条效果）`).join("；")}</div>` : ""}</div><div class="q-actions"><button class="btn sm" data-album-preview="${i}">预览</button><button class="btn sm" data-album-edit="${i}">编辑</button><button class="btn sm danger" data-album-del="${i}">删除</button></div></div>`; }).join("") : `<div class="empty">没有符合条件的传世名篇</div>`;
  }

  function rewardEditor(r) { const attrs = ATTR_KEYS.map(k => `<option value="${k}" ${r.attr === k ? "selected" : ""}>${C.ATTR[k]}</option>`).join(""); const o = opts(REWARD_TYPES, r.type); let extra = ""; if (r.type === "attr") extra = `<select id="album-reward-attr">${attrs}</select><input type="number" id="album-reward-value" value="${r.value || 0}"/>`; else if (r.type === "talent") extra = `<input id="album-reward-talent" list="talentList" value="${C.esc(r.talent || "")}" placeholder="文心 ID"/><input id="album-reward-name" value="${C.esc(r.name || "")}" placeholder="文心名称（可选）"/>`; else if (r.type === "title") extra = `<input id="album-reward-title" value="${C.esc(r.title || "")}" placeholder="称号"/>`; else extra = `<input id="album-reward-value" type="number" value="${r.value || 0}"/>`; return `<div class="row2"><select id="album-reward-type">${o}</select><div id="album-reward-extra" style="display:flex;gap:6px">${extra}</div></div>`; }
  function unlockEditor(u) { const styles = { shi: "诗", ci: "词", lian: "联" }; return `<div class="row2"><select id="album-unlock-type">${opts(UNLOCK_TYPES, u.type)}</select><select id="album-unlock-style" style="display:${u.type === "styleWins" ? "" : "none"}">${opts(Object.entries(styles), u.style)}</select><input type="number" id="album-unlock-min" value="${u.min || 1}" min="1"/></div>`; }
  function branchEffectEditor(ef, bi, ei) { const attrs = opts([["", "属性不限"], ...ATTR_KEYS.map(k => [k, C.ATTR[k]])], ef.attr); const styles = opts([["", "文体不限"], ...STYLES.map(k => [k, { shi: "诗", ci: "词", lian: "联" }[k]])], ef.style); return `<div class="album-effect-row" data-effect-row="${bi}:${ei}"><select data-ef="trigger">${opts(TRIGGERS, ef.trigger)}</select><select data-ef="type">${opts(EFFECT_TYPES, ef.type)}</select><input type="number" step="any" data-ef="value" value="${Number(ef.value) || 0}" title="效果数值"/><input type="number" min="1" step="1" data-ef="minLevel" value="${ef.minLevel || 1}" title="生效等级"/><select data-ef="result">${opts(RESULTS, ef.result)}</select><input type="text" data-ef="name" value="${C.esc(ef.name || "")}" placeholder="效果名称 / 备注"/><button type="button" class="opt-del" data-effect-del="${bi}:${ei}" title="删除效果">×</button><details class="effect-advanced"><summary>条件：文体 / 属性 / 阶段</summary><div class="row2"><select data-ef="style">${styles}</select><select data-ef="attr">${attrs}</select><input type="text" data-ef="phase" value="${C.esc(ef.phase || "")}" placeholder="阶段条件，如 palace"/><input type="text" data-ef="desc" value="${C.esc(ef.desc || "")}" placeholder="玩家可见效果说明"/></div></details></div>`; }
  function renderGrowthEditor() {
    const box = document.getElementById("album-growth-editor"); if (!box || !state.form) return;
    const g = state.form.growth || {};
    box.innerHTML = [["baseXp", "基础 XP"], ["winXp", "胜利 XP"], ["drawXp", "平局 XP"], ["loseXp", "失败 XP"], ["styleXp", "文体 XP"]].map(([key, label]) => `<label class="style-ctrl">${label}<input type="number" min="0" step="1" data-growth-field="${key}" value="${Number(g[key]) || 0}"/></label>`).join("") + `<label class="style-ctrl">文体<select data-growth-field="style"><option value="">不限</option>${opts([["shi", "诗"], ["ci", "词"], ["lian", "联"]], g.style)}</select></label>`;
    const ta = document.getElementById("album-growth-json"); if (ta) ta.value = JSON.stringify(g, null, 2);
  }
  function syncGrowthFromDom() {
    if (!state.form) return; const g = state.form.growth || {};
    document.querySelectorAll("#album-growth-editor [data-growth-field]").forEach(el => { const k = el.dataset.growthField; if (k === "style") { if (el.value) g[k] = el.value; else delete g[k]; } else g[k] = Math.max(0, Number(el.value) || 0); });
    state.form.growth = g;
  }
  function renderBranchesEditor() {
    const box = document.getElementById("album-branches-editor"); if (!box || !state.form) return;
    const branches = state.form.branches || [];
    box.innerHTML = branches.length ? branches.map((b, bi) => `<div class="album-branch-card" data-branch="${bi}"><div class="album-branch-head"><strong>路线 ${bi + 1}</strong><span class="dim">${b.effects.length} 条效果</span><span class="spacer"></span><button type="button" class="btn sm" data-branch-up="${bi}" ${bi === 0 ? "disabled" : ""}>上移</button><button type="button" class="btn sm" data-branch-down="${bi}" ${bi === branches.length - 1 ? "disabled" : ""}>下移</button><button type="button" class="btn sm danger" data-branch-del="${bi}">删除</button></div><div class="branch-fields"><input data-branch-field="id" value="${C.esc(b.id)}" placeholder="分支 ID"/><input data-branch-field="name" value="${C.esc(b.name)}" placeholder="分支名称"/><input type="number" min="1" step="1" data-branch-field="minLevel" value="${b.minLevel}" title="最低等级"/></div><textarea data-branch-field="desc" rows="2" placeholder="路线说明">${C.esc(b.desc || "")}</textarea><div class="hint">${b.effects.length ? "逐条效果：" : "暂无效果，请添加。"}</div>${b.effects.map((ef, ei) => branchEffectEditor(ef, bi, ei)).join("")}<button type="button" class="btn sm" data-effect-add="${bi}">＋ 添加效果</button></div>`).join("") : `<div class="empty" style="padding:18px">当前名篇暂无分支。主线奖励仍会保留；添加分支后，分支只承载路线差异。</div>`;
    const ta = document.getElementById("album-branches-json"); if (ta) ta.value = JSON.stringify(branches, null, 2);
  }
  function openEditor(index) {
    state.editIndex = index; const c = index >= 0 ? state.cards[index] : { id: C.nextSeqId("A", state.cards.map(x => x.id), 3), name: "", unlock: { type: "wins", min: 1 }, reward: { type: "attr", attr: "shi", value: 2 }, rewardDesc: "", text: "", growth: { baseXp: 1, winXp: 1 }, branches: [] };
    state.form = copy(normalizeCard(c)); document.getElementById("albumTitle").textContent = index >= 0 ? "编辑名篇 · " + c.id : "新增传世名篇";
    document.getElementById("albumMsg").className = "msg"; document.getElementById("albumMsg").textContent = "";
    document.getElementById("album-id").value = c.id; document.getElementById("album-name").value = c.name; document.getElementById("album-text").value = c.text; document.getElementById("album-reward-desc").value = c.rewardDesc || "";
    document.getElementById("albumUnlockBox").innerHTML = unlockEditor(c.unlock); document.getElementById("albumRewardBox").innerHTML = rewardEditor(c.reward); renderGrowthEditor(); renderBranchesEditor(); C.openOverlay("albumOverlay");
  }
  function readForm() {
    const f = state.form; syncGrowthFromDom(); f.id = valueOf("album-id").trim(); f.name = valueOf("album-name").trim(); f.text = valueOf("album-text").trim(); f.rewardDesc = valueOf("album-reward-desc").trim();
    const ut = valueOf("album-unlock-type"); f.unlock = { type: ut, min: Math.max(1, numberValue("album-unlock-min", 1)) }; if (ut === "styleWins") f.unlock.style = valueOf("album-unlock-style");
    const rt = valueOf("album-reward-type"); f.reward = { type: rt }; if (rt === "attr") { f.reward.attr = valueOf("album-reward-attr"); f.reward.value = numberValue("album-reward-value", 0); } else if (rt === "inspiration" || rt === "inspirationMax") f.reward.value = numberValue("album-reward-value", 0); else if (rt === "talent") { f.reward.talent = valueOf("album-reward-talent").trim(); f.reward.name = valueOf("album-reward-name").trim(); } else f.reward.title = valueOf("album-reward-title").trim();
    const growth = safeJson(valueOf("album-growth-json"), null); if (!growth || typeof growth !== "object" || Array.isArray(growth)) throw new Error("growth 必须是 JSON 对象");
    const branches = state.form.branches || []; f.growth = normalizeGrowth(growth); f.branches = normalizeBranches(branches); return normalizeCard(f);
  }
  function syncFormFromBranchDom() {
    if (!state.form) return; state.form.branches = state.form.branches || [];
    document.querySelectorAll("#album-branches-editor [data-branch]").forEach(card => { const bi = Number(card.dataset.branch); const b = state.form.branches[bi]; if (!b) return; card.querySelectorAll("[data-branch-field]").forEach(el => { const k = el.dataset.branchField; b[k] = k === "minLevel" ? Math.max(1, Number(el.value) || 1) : el.value; }); card.querySelectorAll("[data-effect-row]").forEach(row => { const [bi2, ei] = row.dataset.effectRow.split(":").map(Number); const ef = b.effects[ei]; if (!ef) return; row.querySelectorAll("[data-ef]").forEach(el => { const k = el.dataset.ef; if (k === "value") ef[k] = Number(el.value) || 0; else if (k === "minLevel") ef[k] = Math.max(1, Number(el.value) || 1); else if (el.value) ef[k] = el.value; else delete ef[k]; }); }); });
  }
  function saveEditor() {
    const msg = document.getElementById("albumMsg"); let c; try { syncFormFromBranchDom(); c = readForm(); } catch (err) { msg.textContent = err.message; msg.className = "msg err"; return; }
    const errors = validate(c, state.cards, state.editIndex); if (errors.length) { msg.textContent = errors.join("；"); msg.className = "msg err"; return; }
    const next = snapshot(); if (state.editIndex >= 0) next[state.editIndex] = c; else next.push(c); commit(next, "名篇已保存"); closeEditor();
  }
  function closeEditor() { C.closeOverlay("albumOverlay"); state.form = null; state.editIndex = -1; }
  function importData(arr, mode) { if (!Array.isArray(arr)) throw new Error("名篇导入必须是数组"); const incoming = arr.map(normalizeCard); const next = mode ? incoming : snapshot(); if (!mode) { const map = new Map(next.map((c, i) => [c.id, i])); incoming.forEach(c => map.has(c.id) ? next[map.get(c.id)] = { ...next[map.get(c.id)], ...c } : next.push(c)); } const errors = next.flatMap((c, i) => validate(c, next, i)); if (errors.length && mode) throw new Error("替换导入存在校验问题：" + errors.slice(0, 3).join("；")); commit(next, mode ? "已替换导入名篇" : "已合并导入名篇"); }
  function exportRaw() { return state.cards.map(c => copy(c)); }
  function exportData() { const bad = validateAll(); if (bad.length && !confirm("存在 " + bad.length + " 个校验问题，仍要导出吗？")) return; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(exportRaw(), null, 2)], { type: "application/json" })); a.download = "album.json"; document.body.appendChild(a); a.click(); a.remove(); C.toast("已导出 album.json"); }
  function resetDefault() { if (!confirm("重置传世名篇为默认种子？本机未导出的编辑将被撤销。")) return; commit((window.GAME_ALBUM || []).map(normalizeCard), "已重置为默认名篇"); }
  function relationHtml(c) { return `<div class="album-mainline"><span class="mainline-dot"></span><div><b>${C.esc(c.name || c.id)}</b><div class="hint">主线：解锁 ${C.esc(unlockText(c.unlock))} · 奖励 ${C.esc(c.rewardDesc || rewardText(c.reward))}</div></div></div><div class="album-relation">${(c.branches || []).map(b => `<div class="album-relation-main"><b>主线基础</b><div class="hint">${C.esc(rewardText(c.reward))}</div></div><div class="album-relation-arrow">→</div><div class="album-relation-branch"><b>${C.esc(b.name)} · Lv${b.minLevel}</b><div class="hint">${C.esc(b.desc || "路线差异未填写")}</div><div class="hint">${b.effects.map(effectText).map(C.esc).join("；") || "无分支效果"}</div></div>`).join("") || `<div class="empty" style="grid-column:1/-1;padding:18px">暂无分支，当前仅使用主线奖励。</div>`}</div>`; }
  function showRelation(c) { document.getElementById("albumRelationBody").innerHTML = relationHtml(c); C.openOverlay("albumRelationOverlay"); }
  function addBranch() { syncFormFromBranchDom(); const used = (state.form.branches || []).map(b => b.id); state.form.branches.push({ id: C.nextSeqId("route_", used, 1), name: "新路线", minLevel: 1, desc: "", effects: [] }); renderBranchesEditor(); }
  function moveBranch(index, delta) { syncFormFromBranchDom(); const a = state.form.branches, j = index + delta; if (j < 0 || j >= a.length) return; [a[index], a[j]] = [a[j], a[index]]; renderBranchesEditor(); }
  function addEffect(index) { syncFormFromBranchDom(); state.form.branches[index].effects.push(normalizeEffect({ trigger: "start", type: "inspiration", value: 1, minLevel: state.form.branches[index].minLevel, name: "新效果", desc: "" })); renderBranchesEditor(); }
  function copyEffect() { syncFormFromBranchDom(); const bs = state.form.branches || []; if (bs.length < 2) { C.toast("至少需要两条分支才能复制效果"); return; } const src = bs[bs.length - 2].effects[0] || { trigger: "start", type: "inspiration", value: 1, minLevel: 1, name: "复制效果" }; bs[bs.length - 1].effects.push(copy(src)); renderBranchesEditor(); C.toast("已复制一条分支效果"); }
  function init() { loadData(); bind(); renderList(); state._ready = true; global.ALBUM._ready = true; }
  function bind() {
    document.getElementById("albumBtnAdd").addEventListener("click", () => openEditor(-1)); document.getElementById("albumBtnExport").addEventListener("click", exportData); document.getElementById("albumBtnUndo").addEventListener("click", undo); document.getElementById("albumBtnRedo").addEventListener("click", redo); document.getElementById("albumBtnReset").addEventListener("click", resetDefault); document.getElementById("albumBtnImport").addEventListener("click", () => document.getElementById("albumFileInput").click());
    document.getElementById("albumFileInput").addEventListener("change", e => { if (e.target.files[0]) { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); importData(Array.isArray(d) ? d : d.album || [], confirm("确定=替换；取消=按 ID 合并")); } catch (x) { alert("JSON 导入失败：" + x.message); } e.target.value = ""; }; r.readAsText(e.target.files[0]); } });
    document.getElementById("albumBtnStats").addEventListener("click", () => { const bad = validateAll(); if (bad.length) alert("传世名篇校验问题：\n" + bad.map(x => x.msg).join("\n")); else C.toast("传世名篇数据通过校验"); renderStats(); });
    document.getElementById("albumCancel").addEventListener("click", closeEditor); document.getElementById("albumSave").addEventListener("click", saveEditor); document.getElementById("albumClose").addEventListener("click", () => C.closeOverlay("albumPreviewOverlay")); document.getElementById("albumRelationClose").addEventListener("click", () => C.closeOverlay("albumRelationOverlay")); document.getElementById("albumRelationBtn").addEventListener("click", () => { syncFormFromBranchDom(); showRelation(state.form); });
    document.getElementById("albumBranchAdd").addEventListener("click", addBranch); document.getElementById("albumBranchSort").addEventListener("click", () => { syncFormFromBranchDom(); state.form.branches.sort((a, b) => Number(a.minLevel) - Number(b.minLevel)); renderBranchesEditor(); }); document.getElementById("albumBranchLink").addEventListener("click", copyEffect);
    document.getElementById("albumlist").addEventListener("click", e => { const t = e.target; if (t.dataset.albumEdit != null) openEditor(Number(t.dataset.albumEdit)); else if (t.dataset.albumDel != null) { if (confirm("确定删除这张传世名篇？")) { const next = snapshot(); next.splice(Number(t.dataset.albumDel), 1); commit(next, "已删除名篇"); } } else if (t.dataset.albumPreview != null) { const c = state.cards[Number(t.dataset.albumPreview)]; const branchHtml = (c.branches || []).length ? `<h4>成长路线</h4><ul>${c.branches.map(b => `<li><b>${C.esc(b.name || b.id)}</b>（Lv${b.minLevel}）：${C.esc(b.desc || "未填写说明")}<div class="hint">${b.effects.map(effectText).map(C.esc).join("；") || "无效果"}</div></li>`).join("")}</ul>` : ""; document.getElementById("albumPreviewBody").innerHTML = `<h3>${C.esc(c.name)}</h3><p>${C.esc(c.text)}</p><p>主线解锁：${C.esc(unlockText(c.unlock))} · 主线奖励：${C.esc(c.rewardDesc || rewardText(c.reward))}</p><p>成长参数：${C.esc(JSON.stringify(c.growth || {}))}</p>${branchHtml}<details><summary>查看底层 album JSON</summary><pre style="white-space:pre-wrap">${C.esc(JSON.stringify(c, null, 2))}</pre></details>`; C.openOverlay("albumPreviewOverlay"); } });
    document.getElementById("albumFSearch").addEventListener("input", renderList);
    document.getElementById("albumOverlay").addEventListener("change", e => { if (e.target.id === "album-unlock-type") document.getElementById("albumUnlockBox").innerHTML = unlockEditor({ type: e.target.value, min: 1, style: "shi" }); if (e.target.id === "album-reward-type") document.getElementById("albumRewardBox").innerHTML = rewardEditor({ type: e.target.value }); if (e.target.dataset.ef) { syncFormFromBranchDom(); renderBranchesEditor(); } });
    document.getElementById("albumBranchesEditor");
    document.getElementById("album-branches-editor").addEventListener("input", () => syncFormFromBranchDom());
    document.getElementById("album-growth-editor").addEventListener("input", () => syncGrowthFromDom());
    document.getElementById("album-growth-editor").addEventListener("change", () => syncGrowthFromDom());
    document.getElementById("album-growth-json").addEventListener("change", () => { const parsed = safeJson(valueOf("album-growth-json"), null); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) { C.toast("growth 必须是 JSON 对象"); renderGrowthEditor(); return; } state.form.growth = normalizeGrowth(parsed); renderGrowthEditor(); C.toast("已载入成长 JSON，可继续校验后保存"); });
    document.getElementById("album-branches-json").addEventListener("change", () => { const parsed = safeJson(valueOf("album-branches-json"), null); if (!Array.isArray(parsed)) { C.toast("branches 必须是 JSON 数组"); renderBranchesEditor(); return; } state.form.branches = normalizeBranches(parsed); renderBranchesEditor(); C.toast("已载入分支 JSON，可继续校验后保存"); });
    document.getElementById("album-branches-editor").addEventListener("click", e => { const t = e.target; if (t.dataset.branchDel != null) { syncFormFromBranchDom(); state.form.branches.splice(Number(t.dataset.branchDel), 1); renderBranchesEditor(); } else if (t.dataset.branchUp != null) moveBranch(Number(t.dataset.branchUp), -1); else if (t.dataset.branchDown != null) moveBranch(Number(t.dataset.branchDown), 1); else if (t.dataset.effectAdd != null) addEffect(Number(t.dataset.effectAdd)); else if (t.dataset.effectDel != null) { syncFormFromBranchDom(); const [bi, ei] = t.dataset.effectDel.split(":").map(Number); state.form.branches[bi].effects.splice(ei, 1); renderBranchesEditor(); } });
  }
  global.ALBUM = { init, get: () => state.cards, exportRaw, validateAll, importData, renderList, openEditor, undo, redo, _ready: false };
})(window);
