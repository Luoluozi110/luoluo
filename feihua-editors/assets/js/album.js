/* =========================================================================
 * album.js - 传世名篇编辑器
 * 旧字段表单 + growth / branches JSON 面板；导入旧格式时自动补成长字段。
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
  const TRIGGERS = ["start", "battle", "quiz", "event", "phase", "score"];
  const EFFECT_TYPES = ["attr", "inspiration", "inspirationMax", "insight", "manuscript", "strategy", "studySlot", "techniqueXp", "pct"];
  const state = { cards: [], editIndex: -1, form: null, _ready: false };

  const copy = value => JSON.parse(JSON.stringify(value));
  const safeJson = (text, fallback) => { try { return JSON.parse(text); } catch (_) { return fallback; } };
  function normalizeUnlock(u) {
    u = u || {};
    const type = UNLOCK_TYPES.some(x => x[0] === u.type) ? u.type : "wins";
    const out = { type, min: Math.max(1, Number(u.min) || 1) };
    if (type === "styleWins") out.style = STYLES.includes(u.style) ? u.style : "shi";
    return out;
  }
  function normalizeReward(r) {
    r = r || {};
    const type = REWARD_TYPES.some(x => x[0] === r.type) ? r.type : "attr";
    const out = { type };
    if (type === "attr") { out.attr = ATTR_KEYS.includes(r.attr) ? r.attr : "shi"; out.value = Number(r.value) || 0; }
    else if (type === "inspiration" || type === "inspirationMax") out.value = Number(r.value) || 0;
    else if (type === "talent") { out.talent = String(r.talent || "").trim(); if (r.name) out.name = String(r.name).trim(); if (r.desc) out.desc = String(r.desc).trim(); }
    else out.title = String(r.title || "").trim();
    return out;
  }
  function normalizeGrowth(g) {
    g = g || {};
    const out = {};
    for (const k of ["baseXp", "winXp", "drawXp", "loseXp", "styleXp"]) if (g[k] != null) out[k] = Math.max(0, Number(g[k]) || 0);
    if (g.style && STYLES.includes(g.style)) out.style = g.style;
    return out;
  }
  function normalizeBranches(branches) {
    if (!Array.isArray(branches)) return [];
    return branches.filter(b => b && b.id).map(b => ({
      id: String(b.id).trim(), name: String(b.name || b.id).trim(), minLevel: Math.max(1, Number(b.minLevel) || 1),
      desc: b.desc != null ? String(b.desc).trim() : '',
      effects: Array.isArray(b.effects) ? b.effects.filter(e => e && e.trigger && e.type).map(e => ({ ...e })) : []
    }));
  }
  function normalizeCard(c) {
    c = c || {};
    return { id: String(c.id || "").trim(), name: String(c.name || "").trim(), unlock: normalizeUnlock(c.unlock), reward: normalizeReward(c.reward), rewardDesc: String(c.rewardDesc || "").trim(), text: String(c.text || "").trim(), growth: normalizeGrowth(c.growth), branches: normalizeBranches(c.branches) };
  }
  function save() { const ok = C.store("album", state.cards); C.setStatus("album", "已自动保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false })); return ok; }
  function loadData() {
    const raw = C.load("album", null);
    state.cards = (Array.isArray(raw) ? raw : (window.GAME_ALBUM || [])).map(normalizeCard);
    if (!raw) C.store("album", state.cards);
  }
  function unlockText(u) {
    const labels = Object.fromEntries(UNLOCK_TYPES), styles = { shi: "诗", ci: "词", lian: "联" };
    return (labels[u.type] || u.type) + (u.type === "styleWins" ? "以" + (styles[u.style] || u.style) + "出战 " : " ") + u.min + " 次";
  }
  function rewardText(r) {
    const a = C.ATTR;
    if (!r) return "（无奖励）";
    if (r.type === "attr") return (a[r.attr] || r.attr) + " +" + r.value;
    if (r.type === "inspiration") return "灵感 +" + r.value;
    if (r.type === "inspirationMax") return "灵感上限 +" + r.value;
    if (r.type === "talent") return "文心「" + (r.name || r.talent || "未指定") + "」";
    return "称号「" + (r.title || "未指定") + "」";
  }
  function validate(card, all, selfIndex) {
    const e = [], w = "名篇 " + (card.id || "(无ID)");
    if (!/^A\d+$/i.test(card.id)) e.push(w + " ID 非法（应形如 A001）");
    else if (all.findIndex((x, i) => x.id === card.id && i !== selfIndex) >= 0) e.push("ID " + card.id + " 重复");
    if (!card.name) e.push(w + " 名称不能为空");
    if (!card.text) e.push(w + " 典故文本不能为空");
    if (!card.unlock || !card.unlock.type || Number(card.unlock.min) < 1) e.push(w + " 解锁条件非法");
    const r = card.reward || {};
    if (!REWARD_TYPES.some(x => x[0] === r.type)) e.push(w + " 奖励类型非法");
    if (r.type === "attr" && (!ATTR_KEYS.includes(r.attr) || !Number.isFinite(Number(r.value)))) e.push(w + " 属性奖励非法");
    if ((r.type === "inspiration" || r.type === "inspirationMax") && !Number.isInteger(Number(r.value))) e.push(w + " 灵感奖励须为整数");
    if (r.type === "talent" && (!r.talent || !C.talentById(r.talent))) e.push(w + " 引用文心不存在：" + (r.talent || "（空）"));
    const seen = new Set();
    for (const b of card.branches || []) {
      if (!b.id || !b.name || seen.has(b.id)) e.push(w + " 分支 ID / 名称非法或重复");
      seen.add(b.id);
      if (Number(b.minLevel) < 1) e.push(w + " 分支「" + b.id + "」最低等级非法");
      for (const ef of b.effects || []) {
        if (!TRIGGERS.includes(ef.trigger)) e.push(w + " 分支「" + b.id + "」触发点非法：" + ef.trigger);
        if (!EFFECT_TYPES.includes(ef.type)) e.push(w + " 分支「" + b.id + "」效果类型非法：" + ef.type);
        if (ef.style && !STYLES.includes(ef.style)) e.push(w + " 分支「" + b.id + "」文体条件非法");
        if (ef.result && !["win", "draw", "lose"].includes(ef.result)) e.push(w + " 分支「" + b.id + "」结果条件非法");
      }
    }
    return e;
  }
  function validateAll() { return state.cards.flatMap((c, i) => validate(c, state.cards, i).map(msg => ({ i, msg }))); }
  function renderStats() { const el = document.getElementById("albumStatStrip"); if (el) el.innerHTML = `<div class="stat"><b>${state.cards.length}</b><span>名篇总数</span></div><div class="stat"><b>${state.cards.filter(c => c.branches.length).length}</b><span>成长型</span></div><div class="stat"><b>${validateAll().length}</b><span>校验问题</span></div>`; }
  function renderList() {
    renderStats(); const list = document.getElementById("albumlist"); if (!list) return;
    const q = (document.getElementById("albumFSearch").value || "").trim().toLowerCase();
    const arr = state.cards.filter(c => !q || [c.id, c.name, c.text, rewardText(c.reward), JSON.stringify(c.branches)].join(" ").toLowerCase().includes(q));
    list.innerHTML = arr.length ? arr.map(c => { const i = state.cards.indexOf(c); return `<div class="q-card"><div class="meta"><span class="q-id">${C.esc(c.id)}</span><span class="badge r-common">${C.esc(c.unlock.type)}</span><span class="badge r-common">${c.branches.length ? "成长×" + c.branches.length : "旧式"}</span></div><div class="q-main"><p class="q-name">${C.esc(c.name)}</p><div class="q-tags"><span class="t">解锁：${C.esc(unlockText(c.unlock))}</span><span class="t">奖励：${C.esc(c.rewardDesc || rewardText(c.reward))}</span></div><div class="q-opts">${C.esc(c.text.slice(0, 120))}</div>${ (c.branches || []).length ? `<div class="q-opts" style="color:var(--mo-3);font-size:11px">路线：${(c.branches || []).map(b => C.esc((b.name || b.id) + '：' + (b.desc || '（无说明）'))).join('；')}</div>` : '' }</div><div class="q-actions"><button class="btn sm" data-album-preview="${i}">预览</button><button class="btn sm" data-album-edit="${i}">编辑</button><button class="btn sm danger" data-album-del="${i}">删除</button></div></div>`; }).join("") : `<div class="empty">没有符合条件的传世名篇</div>`;
  }
  function rewardEditor(r) {
    const attrs = ATTR_KEYS.map(k => `<option value="${k}" ${r.attr === k ? "selected" : ""}>${C.ATTR[k]}</option>`).join("");
    const opts = REWARD_TYPES.map(x => `<option value="${x[0]}" ${r.type === x[0] ? "selected" : ""}>${x[1]}</option>`).join("");
    let extra = "";
    if (r.type === "attr") extra = `<select id="album-reward-attr">${attrs}</select><input type="number" id="album-reward-value" value="${r.value || 0}"/>`;
    else if (r.type === "talent") extra = `<input id="album-reward-talent" list="talentList" value="${C.esc(r.talent || "")}" placeholder="文心 ID"/><input id="album-reward-name" value="${C.esc(r.name || "")}" placeholder="文心名称（可选）"/>`;
    else if (r.type === "title") extra = `<input id="album-reward-title" value="${C.esc(r.title || "")}" placeholder="称号"/>`;
    else extra = `<input id="album-reward-value" type="number" value="${r.value || 0}"/>`;
    return `<div class="row2"><select id="album-reward-type">${opts}</select><div id="album-reward-extra" style="display:flex;gap:6px">${extra}</div></div>`;
  }
  function unlockEditor(u) { const styles = { shi: "诗", ci: "词", lian: "联" }; return `<div class="row2"><select id="album-unlock-type">${UNLOCK_TYPES.map(x => `<option value="${x[0]}" ${u.type === x[0] ? "selected" : ""}>${x[1]}</option>`).join("")}</select><select id="album-unlock-style" style="display:${u.type === "styleWins" ? "" : "none"}">${Object.entries(styles).map(([k, v]) => `<option value="${k}" ${u.style === k ? "selected" : ""}>${v}</option>`).join("")}</select><input type="number" id="album-unlock-min" value="${u.min || 1}" min="1"/></div>`; }
  function openEditor(index) {
    state.editIndex = index;
    const c = index >= 0 ? state.cards[index] : { id: C.nextSeqId("A", state.cards.map(x => x.id), 3), name: "", unlock: { type: "wins", min: 1 }, reward: { type: "attr", attr: "shi", value: 2 }, rewardDesc: "", text: "", growth: { baseXp: 1, winXp: 1 }, branches: [] };
    state.form = copy(normalizeCard(c));
    document.getElementById("albumTitle").textContent = index >= 0 ? "编辑名篇 · " + c.id : "新增传世名篇";
    document.getElementById("album-id").value = c.id; document.getElementById("album-name").value = c.name; document.getElementById("album-text").value = c.text; document.getElementById("album-reward-desc").value = c.rewardDesc || "";
    document.getElementById("albumUnlockBox").innerHTML = unlockEditor(c.unlock); document.getElementById("albumRewardBox").innerHTML = rewardEditor(c.reward);
    document.getElementById("album-growth-json").value = JSON.stringify(c.growth || {}, null, 2); document.getElementById("album-branches-json").value = JSON.stringify(c.branches || [], null, 2);
    C.openOverlay("albumOverlay");
  }
  function readForm() {
    const f = state.form;
    f.id = document.getElementById("album-id").value.trim(); f.name = document.getElementById("album-name").value.trim(); f.text = document.getElementById("album-text").value.trim(); f.rewardDesc = document.getElementById("album-reward-desc").value.trim();
    const ut = document.getElementById("album-unlock-type").value; f.unlock = { type: ut, min: Math.max(1, Number(document.getElementById("album-unlock-min").value) || 1) }; if (ut === "styleWins") f.unlock.style = document.getElementById("album-unlock-style").value;
    const rt = document.getElementById("album-reward-type").value; f.reward = { type: rt }; if (rt === "attr") { f.reward.attr = document.getElementById("album-reward-attr").value; f.reward.value = Number(document.getElementById("album-reward-value").value) || 0; } else if (rt === "inspiration" || rt === "inspirationMax") f.reward.value = Number(document.getElementById("album-reward-value").value) || 0; else if (rt === "talent") { f.reward.talent = document.getElementById("album-reward-talent").value.trim(); f.reward.name = document.getElementById("album-reward-name").value.trim(); } else f.reward.title = document.getElementById("album-reward-title").value.trim();
    const growth = safeJson(document.getElementById("album-growth-json").value, null), branches = safeJson(document.getElementById("album-branches-json").value, null);
    if (!growth || typeof growth !== "object" || Array.isArray(growth)) throw new Error("growth 必须是 JSON 对象");
    if (!Array.isArray(branches)) throw new Error("branches 必须是 JSON 数组");
    f.growth = normalizeGrowth(growth); f.branches = normalizeBranches(branches);
    return normalizeCard(f);
  }
  function saveEditor() {
    const msg = document.getElementById("albumMsg"); let c;
    try { c = readForm(); } catch (err) { msg.textContent = err.message; msg.className = "msg err"; return; }
    const errors = validate(c, state.cards, state.editIndex); if (errors.length) { msg.textContent = errors.join("；"); msg.className = "msg err"; return; }
    if (state.editIndex >= 0) state.cards[state.editIndex] = c; else state.cards.push(c); save(); closeEditor(); renderList(); C.toast("名篇已保存");
  }
  function closeEditor() { C.closeOverlay("albumOverlay"); state.form = null; state.editIndex = -1; }
  function importData(arr, mode) { const incoming = arr.map(normalizeCard); if (mode) state.cards = incoming; else { const map = new Map(state.cards.map((c, i) => [c.id, i])); incoming.forEach(c => map.has(c.id) ? state.cards[map.get(c.id)] = c : state.cards.push(c)); } save(); renderList(); }
  function exportRaw() { return state.cards.map(c => copy(c)); }
  function exportData() { const bad = validateAll(); if (bad.length && !confirm("存在校验问题，仍要导出吗？")) return; const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(exportRaw(), null, 2)], { type: "application/json" })); a.download = "album.json"; document.body.appendChild(a); a.click(); a.remove(); C.toast("已导出 album.json"); }
  function init() { loadData(); bind(); renderList(); state._ready = true; global.ALBUM._ready = true; }
  function bind() {
    document.getElementById("albumBtnAdd").addEventListener("click", () => openEditor(-1)); document.getElementById("albumBtnExport").addEventListener("click", exportData); document.getElementById("albumBtnImport").addEventListener("click", () => document.getElementById("albumFileInput").click());
    document.getElementById("albumFileInput").addEventListener("change", e => { if (e.target.files[0]) { const r = new FileReader(); r.onload = () => { try { const d = JSON.parse(r.result); importData(Array.isArray(d) ? d : d.album || [], confirm("确定=替换；取消=按 ID 合并")); } catch (x) { alert("JSON 解析失败：" + x.message); } }; r.readAsText(e.target.files[0]); } });
    document.getElementById("albumBtnStats").addEventListener("click", () => { document.getElementById("albumMsg").textContent = "校验问题：" + validateAll().length; C.openOverlay("albumOverlay"); }); document.getElementById("albumCancel").addEventListener("click", closeEditor); document.getElementById("albumSave").addEventListener("click", saveEditor); document.getElementById("albumClose").addEventListener("click", () => C.closeOverlay("albumPreviewOverlay"));
    document.getElementById("albumlist").addEventListener("click", e => { const t = e.target; if (t.dataset.albumEdit != null) openEditor(Number(t.dataset.albumEdit)); else if (t.dataset.albumDel != null) { if (confirm("确定删除这张传世名篇？")) { state.cards.splice(Number(t.dataset.albumDel), 1); save(); renderList(); } } else if (t.dataset.albumPreview != null) { const c = state.cards[Number(t.dataset.albumPreview)]; const branchHtml = (c.branches || []).length ? `<h4>成长路线效果</h4><ul>${c.branches.map(b => `<li><b>${C.esc(b.name || b.id)}</b>${b.minLevel > 1 ? `（Lv${b.minLevel}）` : ''}：${C.esc(b.desc || '（未填写效果说明）')}</li>`).join('')}</ul>` : ''; document.getElementById("albumPreviewBody").innerHTML = `<h3>${C.esc(c.name)}</h3><p>${C.esc(c.text)}</p><p>解锁：${C.esc(unlockText(c.unlock))} · 奖励：${C.esc(c.rewardDesc || rewardText(c.reward))}</p><p>成长：${C.esc(JSON.stringify(c.growth || {}))}</p>${branchHtml}<details><summary>查看底层效果 JSON</summary><pre style="white-space:pre-wrap">${C.esc(JSON.stringify(c.branches || [], null, 2))}</pre></details>`; C.openOverlay("albumPreviewOverlay"); } });
    document.getElementById("albumFSearch").addEventListener("input", renderList);
    document.getElementById("albumOverlay").addEventListener("change", e => { if (e.target.id === "album-unlock-type") { document.getElementById("albumUnlockBox").innerHTML = unlockEditor({ type: e.target.value, min: 1, style: "shi" }); } if (e.target.id === "album-reward-type") document.getElementById("albumRewardBox").innerHTML = rewardEditor({ type: e.target.value }); });
  }
  global.ALBUM = { init, get: () => state.cards, exportRaw, validateAll, importData, renderList, openEditor, _ready: false };
})(window);
