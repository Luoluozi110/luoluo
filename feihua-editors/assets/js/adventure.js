/* =========================================================================
 * adventure.js — 奇遇编辑器模块
 * 数据结构与游戏 config/events.json 完全兼容：
 *   direct:    {id,name,rarity,kind,text, effect:{attrs,inspiration,talent,item}}
 *   challenge: {id,name,rarity,kind,text, challenge:{battles, winAll:{...effect}}}
 *   choice:    {id,name,rarity,kind,text, choices:[{text, effect:{...}}, ...]}
 * 依赖 common.js（Common.*）。效果编辑器（effect）三种形态共用，保证一致性。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;
  const ATTR = C.ATTR, ATTR_KEYS = C.ATTR_KEYS, RARITY = C.RARITY, KIND = C.KIND;
  const EVENT_KINDS = ["direct", "choice", "challenge"];
  const MAX_ATTR_GAIN = 5;

  const state = { events: [], editIndex: -1, form: null, _ready: false };

  const SEED = [
    {
      id: "E001", name: "梦笔生花", rarity: "legend", kind: "direct",
      text: "夜宿江畔驿馆，梦中所执之笔头上忽然生出花来。醒后握管，字字如有神助。",
      effect: { attrs: { bi: 5 }, inspiration: 0, talent: "T007" },
      resultText: "晨光透进驿窗时，梦中花影已经散去，笔尖却仍像含着一瓣春色。你试写数行，字句竟自行舒展开来。"
    },
    {
      id: "E006", name: "江郎才尽", rarity: "rare", kind: "choice",
      text: "夜梦一人自称郭璞，向你索还那支寄放多年的五色笔。笔在你手，还是不还？",
      choices: [
        { text: "还他五色笔，从此老实读书", effect: { attrs: { si: 3 }, inspiration: -2 }, resultText: "五色光从指间一点点退去。你重新铺纸，第一笔落得很慢，却终于不再借谁的声名。" },
        { text: "强留彩笔，搜尽枯肠再赋一篇", effect: { attrs: { bi: 4 }, inspiration: -4 }, resultText: "你攥住彩笔，连夜搜尽枯肠。天亮时文章成了，墨色却像从骨头里榨出来的。" }
      ]
    }
  ];

  /* ---------------- 效果对象 <-> 表单形态 ---------------- */
  function emptyEffect() { return { attrs: [], inspiration: 0, inspirationMax: 0, talent: "", item: "" }; }
  function emptyChoice() { return { text: "", resultText: "", effect: emptyEffect() }; }

  // 规范效果（属性对象 -> 仅保留非零项；空则不写 attrs）
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
    if (eff.inspirationMax) out.inspirationMax = Number(eff.inspirationMax);
    if (eff.talent) out.talent = eff.talent;
    if (eff.item) out.item = eff.item;
    if (out.attrs && !Object.keys(out.attrs).length) delete out.attrs;
    return out;
  }
  // 表单效果（数组形态）-> 规范对象
  function effToForm(eff) {
    eff = eff || {};
    const attrs = [];
    const a = eff.attrs || {};
    for (const k of ATTR_KEYS) if (Number(a[k])) attrs.push({ k, v: Number(a[k]) });
    return { attrs, inspiration: Number(eff.inspiration) || 0, inspirationMax: Number(eff.inspirationMax) || 0, talent: eff.talent || "", item: eff.item || "" };
  }
  // 任意来源（规范对象 attrs / 表单数组 attrs）-> 规范对象
  function formEffectToCanonical(fe) {
    fe = fe || {};
    const obj = {};
    const a = fe.attrs;
    if (Array.isArray(a)) a.forEach(x => { const v = Number(x.v); if (v) obj[x.k] = v; });
    else if (a) for (const k of ATTR_KEYS) { const v = Number(a[k]); if (v) obj[k] = v; }
    return cleanEffect({ attrs: obj, inspiration: fe.inspiration, inspirationMax: fe.inspirationMax, talent: fe.talent, item: fe.item });
  }

  /* ---------------- 持久化 ---------------- */
  function save() {
    const ok = C.store("events", state.events);
    const t = new Date();
    C.setStatus("adv", "已自动保存 " + t.toLocaleTimeString("zh-CN", { hour12: false }));
    return ok;
  }
  // 旧版「示例种子」的 ID 集合：仅含这两条时视为未正式导入，自动升级为游戏原数据。
  const OLD_EVENT_SEED_IDS = new Set(["E001", "E006"]);
  function loadData() {
    const raw = C.load("events", null);
    const isOldSeed = raw && raw.length === OLD_EVENT_SEED_IDS.size &&
      raw.every(e => OLD_EVENT_SEED_IDS.has(e.id));
    if (!raw || isOldSeed) {
      // 首次打开或仍停留在示例种子：载入游戏真实奇遇（41 条），并持久化。
      const base = (window.GAME_EVENTS && window.GAME_EVENTS.length) ? window.GAME_EVENTS : SEED;
      state.events = base.map(normalizeEvent);
      C.store("events", state.events);
    } else {
      state.events = raw.map(normalizeEvent);
      // 旧版 localStorage 非破坏式补齐新发布的官方奇遇与缺失回声，避免种子更新被永久遮蔽。
      // 只填空字段：不覆盖同 ID 的本地文案修改，不触碰用户自建奇遇。
      if (backfillOfficialEvents()) C.store("events", state.events);
    }
  }

  // 官方新增奇遇 ID 列表（发布新奇遇时补充；同步桌面 seed-events.js 后也会自动带入）。
  const BACKFILL_EVENT_IDS = ["E042"];
  function backfillOfficialEvents() {
    const seed = (window.GAME_EVENTS || []);
    const byId = new Map(state.events.map(e => [e.id, e]));
    let changed = 0;
    for (const id of BACKFILL_EVENT_IDS) {
      if (byId.has(id)) continue;
      const src = seed.find(e => e && e.id === id);
      if (src) {
        const normalized = normalizeEvent(src);
        state.events.push(normalized);
        byId.set(id, normalized);
        changed++;
      }
    }
    for (const official of seed) {
      const current = byId.get(official && official.id);
      if (!current || current.kind !== official.kind) continue;
      if (current.kind === "direct" && !current.resultText && official.resultText) {
        current.resultText = String(official.resultText).trim(); changed++;
      } else if (current.kind === "choice") {
        (current.choices || []).forEach((choice, i) => {
          const sourceChoice = (official.choices || [])[i];
          if (!choice.resultText && sourceChoice && sourceChoice.resultText) {
            choice.resultText = String(sourceChoice.resultText).trim(); changed++;
          }
        });
      } else if (current.kind === "challenge") {
        if (!current.challenge.winText && official.challenge && official.challenge.winText) {
          current.challenge.winText = String(official.challenge.winText).trim(); changed++;
        }
        if (!current.challenge.failText && official.challenge && official.challenge.failText) {
          current.challenge.failText = String(official.challenge.failText).trim(); changed++;
        }
      }
    }
    return changed;
  }

  /* ---------------- 规范化 ---------------- */
  function normalizeEvent(ev) {
    ev = ev || {};
    const out = {
      id: String(ev.id || "").trim(),
      name: String(ev.name || "").trim(),
      rarity: RARITY[ev.rarity] ? ev.rarity : "common",
      kind: EVENT_KINDS.includes(ev.kind) ? ev.kind : "direct",
      text: String(ev.text || "").trim()
    };
    if (ev.draft) out.draft = true;
    if (out.kind === "direct") {
      out.effect = formEffectToCanonical(ev.effect);
      out.resultText = String(ev.resultText || "").trim();
    } else if (out.kind === "challenge") {
      const challenge = ev.challenge || {};
      out.challenge = {
        battles: Math.max(1, Number(challenge.battles) || 1),
        winAll: formEffectToCanonical(challenge.winAll),
        winText: String(challenge.winText || "").trim(),
        failText: String(challenge.failText || "").trim()
      };
    } else out.choices = (ev.choices || []).map(c => ({
      text: String(c.text || "").trim(),
      resultText: String(c.resultText || "").trim(),
      effect: formEffectToCanonical(c.effect)
    }));
    return out;
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
    if (eff.inspirationMax && !Number.isFinite(Number(eff.inspirationMax))) errors.push(where + "灵感上限数值非法");
  }
  function validateEvent(e, all, selfIndex) {
    const errors = [], w = "奇遇" + (e.id ? " " + e.id : "");
    if (!e.id) errors.push("奇遇 ID 不能为空");
    else if (!/^[A-Za-z0-9_\-]+$/.test(e.id)) errors.push("ID 只能含字母、数字、下划线和连字符");
    else {
      const dup = all.findIndex((x, i) => x.id === e.id && i !== selfIndex);
      if (dup >= 0) errors.push("ID 与第 " + (dup + 1) + " 条重复");
    }
    if (!e.name) errors.push("奇遇名称不能为空");
    if (!RARITY[e.rarity]) errors.push("稀有度非法：" + e.rarity);
    if (!EVENT_KINDS.includes(e.kind)) errors.push("类型非法：" + e.kind);
    if (!e.text) errors.push("奇遇文本不能为空");
    if (e.kind === "direct") {
      if (!e.resultText) errors.push("直接生效奇遇必须填写结算回声");
      if (!e.effect || (!Object.keys(e.effect.attrs || {}).length && !e.effect.inspiration && !e.effect.inspirationMax && !e.effect.talent && !e.effect.item))
        errors.push("直接生效奇遇需设置至少一项效果");
      else validateEffect(e.effect, w + "·效果 ", errors);
    } else if (e.kind === "choice") {
      if (!e.choices || e.choices.length < 2) errors.push("抉择奇遇至少需要 2 个选项");
      else e.choices.forEach((c, i) => {
        if (!c.text) errors.push("选项 " + (i + 1) + " 文案不能为空");
        if (!c.resultText) errors.push("选项 " + (i + 1) + " 必须填写结算回声");
        validateEffect(c.effect, w + "·选项" + (i + 1) + " ", errors);
      });
    } else if (e.kind === "challenge") {
      if (!e.challenge || Number(e.challenge.battles) < 1) errors.push("挑战奇遇需设置 battle 场数（≥1）");
      else {
        if (!e.challenge.winText) errors.push("挑战奇遇必须填写全胜回声");
        if (!e.challenge.failText) errors.push("挑战奇遇必须填写未胜回声");
        validateEffect(e.challenge.winAll, w + "·全胜奖励 ", errors);
      }
    }
    return { ok: errors.length === 0, errors };
  }
  function validateAll() {
    return state.events.map((e, i) => ({ i, ...validateEvent(e, state.events, i) })).filter(r => !r.ok);
  }

  /* ---------------- 渲染列表 ---------------- */
  function getFilters() {
    return {
      q: document.getElementById("evFSearch").value.trim().toLowerCase(),
      kind: document.getElementById("evFKind").value,
      rarity: document.getElementById("evFRarity").value
    };
  }
  function filtered() {
    const f = getFilters();
    return state.events.filter(e => {
      if (f.kind !== "all" && e.kind !== f.kind) return false;
      if (f.rarity !== "all" && e.rarity !== f.rarity) return false;
      if (f.q) {
        const hay = [e.id, e.name, e.text, e.resultText,
          e.challenge && e.challenge.winText, e.challenge && e.challenge.failText,
          ...(e.choices || []).map(c => c.text + " " + c.resultText + " " + C.effectDetail(c.effect))].join(" ").toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });
  }
  function renderStats() {
    const total = state.events.length;
    const drafts = state.events.filter(e => e.draft).length;
    const byK = { direct: 0, choice: 0, challenge: 0 }, byR = { common: 0, rare: 0, legend: 0 };
    state.events.forEach(e => { if (byK[e.kind] != null) byK[e.kind]++; if (byR[e.rarity] != null) byR[e.rarity]++; });
    document.getElementById("evStatStrip").innerHTML = `
      <div class="stat"><b>${total}</b><span>奇遇总数</span></div>
      <div class="stat"><b>${total - drafts}</b><span>活跃</span></div>
      <div class="stat"><b>${drafts}</b><span>草稿</span></div>
      <div class="stat"><b>${byK.choice}</b><span>抉择</span></div>
      <div class="stat"><b>${byK.challenge}</b><span>挑战</span></div>`;
  }
  function renderList() {
    renderStats();
    const list = document.getElementById("evlist");
    const items = filtered();
    if (!items.length) {
      list.innerHTML = `<div class="empty"><b>${state.events.length ? "没有符合筛选条件的奇遇" : "奇遇库还是空的"}</b>
        ${state.events.length ? "试着调整上方筛选条件。" : "点击「＋ 新增奇遇」开始，或「导入 JSON」载入现有的 events.json。"}</div>`;
      return;
    }
    list.innerHTML = items.map(e => {
      const idx = state.events.indexOf(e);
      const optInfo = e.kind === "choice" ? `${e.choices.length} 选项` : (e.kind === "challenge" ? `连战 ${e.challenge.battles} 场` : "直接生效");
      const snippet = (e.text || "").slice(0, 60) + ((e.text || "").length > 60 ? "…" : "");
      return `<div class="q-card" data-idx="${idx}">
        <div class="meta">
          <span class="q-id">${C.esc(e.id)}</span>
          <span class="badge r-${e.rarity}">${RARITY[e.rarity]}奇遇</span>
          <span class="badge c">${KIND[e.kind]}</span>
          <span class="pill ${e.draft ? "off" : "on"}" data-toggle="${idx}" title="点击切换草稿/活跃">${e.draft ? "草稿" : "活跃"}</span>
        </div>
        <div class="q-main">
          <p class="q-name">${C.esc(e.name)}</p>
          <div class="q-tags"><span class="t">${optInfo}</span>${e.draft ? `<span class="t">草稿（导出时排除）</span>` : ""}</div>
          <div class="q-opts">${C.esc(snippet)}</div>
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

  /* ---------------- 效果编辑器（共用组件） ---------------- */
  function attrOptions(k) {
    return `<option value="">（无）</option>` +
      ATTR_KEYS.map(k2 => `<option value="${k2}" ${k2 === k ? "selected" : ""}>${ATTR[k2]}</option>`).join("");
  }
  function effectInner(eff, target) {
    const attrRows = (eff.attrs || []).map((a, i) => `
      <div class="opt-row eff-attr" data-i="${i}">
        <span class="ord">${i + 1}</span>
        <select class="eff-attr-k">${attrOptions(a.k)}</select>
        <input type="number" class="eff-attr-v" value="${a.v}" step="1"/>
        <button class="opt-del eff-attr-del" title="删除属性">×</button>
      </div>`).join("");
    return `<div class="eff-box" data-target="${target}">
      <div style="font-size:12px;color:var(--ink2);margin-bottom:5px">属性变化（可添加多项；正数增加，负数减少）</div>
      <div class="eff-attrs">${attrRows || '<div style="font-size:12px;color:var(--ink2)">暂无属性加成</div>'}</div>
      <button class="btn sm opt-add eff-attr-add">＋ 添加属性</button>
      <div class="row2" style="margin-top:8px">
        <div class="field" style="margin:0"><label>灵感变化（当前）</label>
          <input type="number" class="eff-insp" value="${eff.inspiration || 0}" step="1"/></div>
        <div class="field" style="margin:0"><label>灵感上限 +N（永久）</label>
          <input type="number" class="eff-insp-max" value="${eff.inspirationMax || 0}" step="1" min="0"/></div>
      </div>
      <div class="row2" style="margin-top:8px">
        <div class="field" style="margin:0"><label>文心（可选，输入 ID 或下拉选择）</label>
          <input type="text" class="eff-talent" list="talentList" value="${C.esc(eff.talent || "")}" placeholder="如 T007，留空=无"/></div>
        <div class="field" style="margin:0"><label>道具（可选）</label>
          <input type="text" class="eff-item" value="${C.esc(eff.item || "")}" placeholder="留空=无"/></div>
      </div>
      <div class="eff-talent-info" data-target="${target}"></div>
    </div>`;
  }
  function rerenderEffBox(target) {
    const box = document.querySelector(`.eff-box[data-target="${target}"]`);
    if (box) { const eff = getEffectByTarget(target); box.outerHTML = effectInner(eff, target); updateTalentInfo(target); }
  }
  /* 在效果框内实时显示「关联文心」的名称与摘要；填错 ID 立即红字提示 */
  function updateTalentInfo(target) {
    const box = document.querySelector(`.eff-box[data-target="${target}"]`);
    if (!box) return;
    const info = box.querySelector(".eff-talent-info");
    if (!info) return;
    const eff = getEffectByTarget(target);
    const id = (eff && eff.talent || "").trim();
    if (!id) { info.className = "eff-talent-info"; info.textContent = ""; return; }
    const t = C.talentById(id);
    if (!t) {
      info.className = "eff-talent-info bad";
      info.textContent = "⚠ 未找到文心 " + id + "（请确认 ID，或先在文心编辑器创建）";
      return;
    }
    const txt = (global.TALENT && global.TALENT.effectText) ? global.TALENT.effectText(t.effect) : "";
    info.className = "eff-talent-info ok";
    info.innerHTML = `↔ 关联文心：<b>${C.esc(t.name)}</b> <span class="dim">(${C.esc(t.id)} · ${t.kind === "active" ? "主动" : "被动"})</span> — ${C.esc(txt)}`;
  }
  function getEffectByTarget(t) {
    if (t === "direct") return state.form.effect;
    if (t === "win") return state.form.challenge.winAll;
    if (t && t[0] === "c") return state.form.choices[Number(t.slice(1))].effect;
    return null;
  }

  /* ---------------- 编辑弹窗 ---------------- */
  function openEditor(index) {
    state.editIndex = index;
    const src = index >= 0 ? state.events[index] : null;
    if (src) {
      state.form = {
        id: src.id, name: src.name, rarity: src.rarity, kind: src.kind, text: src.text, draft: !!src.draft,
        effect: effToForm(src.effect), resultText: src.resultText || "",
        challenge: src.challenge ? {
          battles: Number(src.challenge.battles) || 1,
          winAll: effToForm(src.challenge.winAll),
          winText: src.challenge.winText || "",
          failText: src.challenge.failText || ""
        } : { battles: 1, winAll: emptyEffect(), winText: "", failText: "" },
        choices: (src.choices || []).map(c => ({ text: c.text, resultText: c.resultText || "", effect: effToForm(c.effect) }))
      };
    } else {
      state.form = { id: "", name: "", rarity: "common", kind: "direct", text: "", draft: false,
        effect: emptyEffect(), resultText: "", challenge: { battles: 1, winAll: emptyEffect(), winText: "", failText: "" }, choices: [emptyChoice(), emptyChoice()] };
      state.form.id = C.nextSeqId("E", state.events.map(e => e.id), 3);
    }
    document.getElementById("evTitle").textContent = src ? "编辑奇遇 · " + src.id : "新增奇遇";
    document.getElementById("ev-id").value = state.form.id;
    document.getElementById("ev-name").value = state.form.name;
    document.querySelector(`input[name=ev-kind][value=${state.form.kind}]`).checked = true;
    document.getElementById("ev-rarity").value = state.form.rarity;
    document.getElementById("ev-text").value = state.form.text;
    document.getElementById("ev-draft").checked = state.form.draft;
    const msg = document.getElementById("evMsg"); msg.className = "msg"; msg.textContent = "";
    syncKindUI();
    C.openOverlay("evOverlay");
  }
  function closeEditor() { C.closeOverlay("evOverlay"); state.editIndex = -1; state.form = null; }

  function syncKindUI() {
    const kind = document.querySelector('input[name=ev-kind]:checked').value;
    state.form.kind = kind;
    document.getElementById("evDirectPanel").style.display = kind === "direct" ? "" : "none";
    document.getElementById("evChallengePanel").style.display = kind === "challenge" ? "" : "none";
    document.getElementById("evChoicesPanel").style.display = kind === "choice" ? "" : "none";
    if (kind === "direct") {
      document.getElementById("evEffectBox").innerHTML = effectInner(state.form.effect, "direct");
      document.getElementById("ev-result").value = state.form.resultText || "";
      updateTalentInfo("direct");
    }
    else if (kind === "challenge") {
      document.getElementById("evBattles").value = state.form.challenge.battles;
      document.getElementById("evWinText").value = state.form.challenge.winText || "";
      document.getElementById("evFailText").value = state.form.challenge.failText || "";
      document.getElementById("evWinBox").innerHTML = effectInner(state.form.challenge.winAll, "win");
      updateTalentInfo("win");
    } else renderChoices();
  }
  function renderChoices() {
    document.getElementById("evChoices").innerHTML = state.form.choices.map((c, i) => `
      <div class="choice-block" data-ci="${i}">
        <div class="choice-head"><span class="ord">抉择 ${i + 1}</span>
          <button class="opt-del ev-choice-del" data-ci="${i}">× 删除选项</button></div>
        <div class="field" style="margin:4px 0"><label>选项文案</label>
          <textarea class="ev-choice-text" data-ci="${i}" placeholder="玩家的选择描述…">${C.esc(c.text)}</textarea></div>
        <div class="field" style="margin:4px 0"><label>结算回声</label>
          <textarea class="ev-choice-result" data-ci="${i}" placeholder="选择后发生了什么…">${C.esc(c.resultText || "")}</textarea></div>
        <div class="field" style="margin:4px 0"><label>此选项的效果</label>
          ${effectInner(c.effect, "c" + i)}</div>
      </div>`).join("");
    state.form.choices.forEach((c, i) => updateTalentInfo("c" + i));
  }

  function toEvent(form) {
    const out = { id: form.id.trim(), name: form.name.trim(), rarity: form.rarity, kind: form.kind, text: form.text.trim() };
    if (form.draft) out.draft = true;
    if (form.kind === "direct") {
      out.effect = formEffectToCanonical(form.effect);
      out.resultText = String(form.resultText || "").trim();
    } else if (form.kind === "challenge") out.challenge = {
      battles: Math.max(1, Number(form.challenge.battles) || 1),
      winAll: formEffectToCanonical(form.challenge.winAll),
      winText: String(form.challenge.winText || "").trim(),
      failText: String(form.challenge.failText || "").trim()
    };
    else out.choices = form.choices.map(c => ({
      text: c.text.trim(), resultText: String(c.resultText || "").trim(), effect: formEffectToCanonical(c.effect)
    }));
    return out;
  }

  function saveEditor() {
    const ev = toEvent(state.form);
    const { ok, errors } = validateEvent(ev, state.events, state.editIndex);
    const msg = document.getElementById("evMsg");
    if (!ok) {
      msg.className = "msg err";
      msg.innerHTML = "✗ 无法保存：<br>• " + errors.join("<br>• ");
      return;
    }
    if (state.editIndex >= 0) { state.events[state.editIndex] = ev; C.toast("已更新 " + ev.id); }
    else { state.events.push(ev); C.toast("已新增 " + ev.id); }
    save(); closeEditor(); renderList();
  }

  /* ---------------- 奇遇操作 ---------------- */
  function toggleDraft(idx) {
    state.events[idx].draft = !state.events[idx].draft;
    save(); renderList(); C.toast(state.events[idx].draft ? "已转为草稿（导出时排除）" : "已转为活跃");
  }
  function duplicate(idx) {
    const copy = JSON.parse(JSON.stringify(state.events[idx]));
    let base = copy.id, n = 1, newId;
    do { newId = base + "_" + n; n++; } while (state.events.some(e => e.id === newId));
    copy.id = newId; copy.draft = true;
    state.events.splice(idx + 1, 0, copy);
    save(); renderList(); C.toast("已复制为 " + newId + "（草稿）");
  }
  function remove(idx) {
    const e = state.events[idx];
    if (!confirm(`确定删除奇遇「${e.id} · ${e.name}」？此操作不可撤销。`)) return;
    state.events.splice(idx, 1);
    save(); renderList(); C.toast("已删除 " + e.id);
  }

  /* ---------------- 预览（仿游戏内样式） ---------------- */
  function previewEvent(ev) {
    const brief = C.effectBrief(ev.effect);
    let body = "", detail = "";
    if (ev.kind === "choice") {
      body = `<div class="ev-choices">` + (ev.choices || []).map((c, i) => {
        const sub = C.effectBrief(c.effect);
        return `<div class="ev-choice-btn"><span>${i + 1}. ${C.esc(c.text)}</span>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
      }).join("") + `</div>`;
      detail = `<div class="ev-detail"><b>回声与效果明细</b><br>` +
        (ev.choices || []).map((c, i) => `${i + 1}. ${C.esc(c.text)}<br>　回声：${C.esc(c.resultText || "（缺失）")}<br>　效果：${C.effectDetail(c.effect)}`).join("<br>") + `</div>`;
    } else if (ev.kind === "challenge") {
      const winBrief = C.effectBrief(ev.challenge.winAll);
      body = `<div class="ev-accept">接下挑战（连战 ${ev.challenge.battles} 场）</div>` +
        (winBrief ? `<div class="etext" style="margin-top:10px;color:#b23a2e">全胜可得：${winBrief}</div>` : "");
      detail = `<div class="ev-detail"><b>回声与效果明细</b><br>` +
        `全胜回声：${C.esc(ev.challenge.winText || "（缺失）")}<br>` +
        `未胜回声：${C.esc(ev.challenge.failText || "（缺失）")}<br>` +
        `全胜效果：${C.effectDetail(ev.challenge.winAll)}（胜利后生效）</div>`;
    } else {
      body = `<div class="ev-accept">欣然领受</div>` + (brief ? `<div class="etext" style="margin-top:10px;color:#8a5a12">${brief}</div>` : "");
      detail = `<div class="ev-detail"><b>结算回声</b><br>${C.esc(ev.resultText || "（缺失）")}<br><br><b>效果明细</b><br>${C.effectDetail(ev.effect)}</div>`;
    }
    document.getElementById("evPreviewBody").innerHTML = `
      <div class="ev-preview-card r-${ev.rarity}">
        <span class="rarity-tag r-${ev.rarity}">${RARITY[ev.rarity] || "普通"}奇遇</span>
        <h3>${C.esc(ev.name)}</h3>
        <div class="etext">${C.esc(ev.text)}</div>
        ${body}
        ${detail}
      </div>`;
    C.openOverlay("evPreviewOverlay");
  }

  /* ---------------- 文心双向关联 API ---------------- */
  function effectByTarget(ev, target) {
    if (!ev || !target) return null;
    if (target === "direct") return ev.kind === "direct" ? ev.effect : null;
    if (target === "win") return ev.kind === "challenge" ? (ev.challenge && ev.challenge.winAll) : null;
    if (/^c\\d+$/.test(target)) {
      const i = Number(target.slice(1));
      return ev.kind === "choice" && ev.choices && ev.choices[i] ? ev.choices[i].effect : null;
    }
    return null;
  }
  function targetLabel(ev, target) {
    if (target === "direct") return "直接奖励";
    if (target === "win") return "挑战全胜奖励";
    if (/^c\\d+$/.test(target)) return "选项" + (Number(target.slice(1)) + 1);
    return target;
  }
  function eventTargets(ev) {
    if (!ev) return [];
    if (ev.kind === "direct") return [{ target: "direct", label: "直接奖励" }];
    if (ev.kind === "challenge") return [{ target: "win", label: "挑战全胜奖励" }];
    if (ev.kind === "choice") return (ev.choices || []).map((c, i) => ({ target: "c" + i, label: "选项" + (i + 1) + (c.text ? " · " + c.text.slice(0, 24) : "") }));
    return [];
  }
  function listTalentLinks(talentId) {
    const out = [];
    for (const ev of state.events) for (const x of eventTargets(ev)) {
      const eff = effectByTarget(ev, x.target);
      if (eff && eff.talent === talentId) out.push({ eventId: ev.id, eventName: ev.name, target: x.target, targetLabel: targetLabel(ev, x.target), draft: !!ev.draft });
    }
    return out;
  }
  function linkTalent(talentId, eventId, target) {
    if (!state._ready || global.ADV._ready !== true) return { ok: false, code: "PERMISSION_DENIED", message: "奇遇编辑器尚未初始化，当前无编辑权限" };
    if (!talentId || !C.talentById(talentId)) return { ok: false, code: "INVALID_TALENT", message: "文心不存在：" + (talentId || "（空）") };
    const ev = state.events.find(e => e.id === eventId);
    const eff = effectByTarget(ev, target);
    if (!ev || !eff) return { ok: false, code: "INVALID_TARGET", message: "奇遇或关联位置不存在" };
    if (eff.talent === talentId) return { ok: false, code: "DUPLICATE", message: "该位置已经关联此文心" };
    if (eff.talent && eff.talent !== talentId) return { ok: false, code: "CONFLICT", message: "该位置已关联文心 " + eff.talent + "，请先取消原关联" };
    const old = eff.talent;
    eff.talent = talentId;
    if (!save()) { if (old) eff.talent = old; else delete eff.talent; return { ok: false, code: "SAVE_FAILED", message: "本地存储失败，关联未保存" }; }
    renderList();
    return { ok: true, code: "LINKED", message: "关联成功", links: listTalentLinks(talentId) };
  }
  function unlinkTalent(talentId, eventId, target) {
    if (!state._ready || global.ADV._ready !== true) return { ok: false, code: "PERMISSION_DENIED", message: "奇遇编辑器尚未初始化，当前无编辑权限" };
    const ev = state.events.find(e => e.id === eventId);
    const eff = effectByTarget(ev, target);
    if (!ev || !eff) return { ok: false, code: "INVALID_TARGET", message: "奇遇或关联位置不存在" };
    if (eff.talent !== talentId) return { ok: false, code: "NOT_LINKED", message: "该位置并未关联此文心" };
    delete eff.talent;
    if (!save()) { eff.talent = talentId; return { ok: false, code: "SAVE_FAILED", message: "本地存储失败，取消关联未保存" }; }
    renderList();
    return { ok: true, code: "UNLINKED", message: "已取消关联", links: listTalentLinks(talentId) };
  }

  /* ---------------- 导入 / 导出 ---------------- */
  function importData(arr, mode) {
    const norm = arr.map(normalizeEvent).filter(e => e.id);
    if (mode) {
      state.events = norm;
      C.toast("已替换为 " + norm.length + " 条");
    } else {
      const map = new Map(state.events.map((e, i) => [e.id, i]));
      let added = 0, updated = 0;
      norm.forEach(e => {
        if (map.has(e.id)) { state.events[map.get(e.id)] = e; updated++; }
        else { state.events.push(e); added++; }
      });
      C.toast(`合并完成：新增 ${added}，更新 ${updated}`);
    }
    save(); renderList();
  }
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (e) { alert("JSON 解析失败：" + e.message); return; }
      let arr;
      if (Array.isArray(data)) arr = data;
      else if (Array.isArray(data.events)) arr = data.events;
      else if (Array.isArray(data.questions)) { alert("这是题库文件，请在「题库编辑器」中导入。"); return; }
      else { alert("未识别的 JSON 结构（应为奇遇数组，或含 events 字段的对象）。"); return; }
      const type = C.classify(arr);
      if (type !== "events") { alert("未能识别为奇遇数据（需要含 kind 字段）。"); return; }
      const norm = arr.map(normalizeEvent);
      const mode = confirm(
        `成功读取 ${norm.length} 条奇遇。\n\n点击「确定」= 替换当前奇遇；\n点击「取消」= 按 ID 合并（已存在则覆盖，不存在则追加）。`);
      importData(norm, mode);
    };
    reader.readAsText(file, "utf-8");
  }
  function exportRaw() {
    return state.events.filter(e => !e.draft).map(e => { const c = Object.assign({}, e); delete c.draft; return c; });
  }
  function exportData() {
    const bad = validateAll();
    const active = exportRaw();
    if (bad.length) {
      const names = bad.slice(0, 8).map(r => state.events[r.i].id || "(无ID)").join("、");
      if (!confirm(`有 ${bad.length} 条奇遇存在校验问题（如：${names}…）。\n仍要导出吗？建议先修正再导出。`)) return;
    }
    if (!active.length) { alert("没有可导出的活跃奇遇（草稿不会导出）。"); return; }
    const data = JSON.stringify(active, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "events.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    C.toast("已导出 events.json（" + active.length + " 条，已排除草稿）");
  }

  /* ---------------- 统计弹窗 ---------------- */
  function showStats() {
    const byK = { direct: 0, choice: 0, challenge: 0 }, byR = { common: 0, rare: 0, legend: 0 };
    let drafts = 0;
    state.events.forEach(e => { if (byK[e.kind] != null) byK[e.kind]++; if (byR[e.rarity] != null) byR[e.rarity]++; if (e.draft) drafts++; });
    const row = (k, v) => `<tr><td>${k}</td><td class="num">${v}</td></tr>`;
    document.getElementById("evStBody").innerHTML = `
      <p><b>奇遇总数：</b>${state.events.length}（活跃 ${state.events.length - drafts}，草稿 ${drafts}）</p>
      <h4 style="margin:14px 0 6px">按类型</h4>
      <table class="stat-table"><tr><th>类型</th><th>数量</th></tr>
        ${row("直接生效", byK.direct)}${row("抉择", byK.choice)}${row("挑战", byK.challenge)}</table>
      <h4 style="margin:14px 0 6px">按稀有度</h4>
      <table class="stat-table"><tr><th>稀有度</th><th>数量</th></tr>
        ${row("普通", byR.common)}${row("稀有", byR.rare)}${row("传说", byR.legend)}</table>`;
    C.openOverlay("evStOverlay");
  }

  /* ---------------- 字段输入处理（事件委托） ---------------- */
  function handleField(e) {
    const t = e.target;
    const box = t.closest && t.closest(".eff-box");
    if (box) {
      const eff = getEffectByTarget(box.dataset.target); if (!eff) return;
      if (t.classList.contains("eff-attr-k")) { const row = t.closest(".eff-attr"); eff.attrs[Number(row.dataset.i)].k = t.value; }
      else if (t.classList.contains("eff-attr-v")) { const row = t.closest(".eff-attr"); eff.attrs[Number(row.dataset.i)].v = Number(t.value) || 0; }
      else if (t.classList.contains("eff-insp")) { eff.inspiration = Number(t.value) || 0; }
      else if (t.classList.contains("eff-insp-max")) { eff.inspirationMax = Math.max(0, Number(t.value) || 0); }
      else if (t.classList.contains("eff-talent")) { eff.talent = t.value.trim(); updateTalentInfo(box.dataset.target); }
      else if (t.classList.contains("eff-item")) { eff.item = t.value.trim(); }
      return;
    }
    if (!state.form) return;
    if (t.id === "ev-id") state.form.id = t.value;
    else if (t.id === "ev-name") state.form.name = t.value;
    else if (t.id === "ev-text") state.form.text = t.value;
    else if (t.id === "ev-result") state.form.resultText = t.value;
    else if (t.id === "ev-rarity") state.form.rarity = t.value;
    else if (t.id === "ev-draft") state.form.draft = t.checked;
    else if (t.id === "evBattles") state.form.challenge.battles = Math.max(1, Number(t.value) || 1);
    else if (t.id === "evWinText") state.form.challenge.winText = t.value;
    else if (t.id === "evFailText") state.form.challenge.failText = t.value;
    else if (t.classList.contains("ev-choice-text")) state.form.choices[Number(t.dataset.ci)].text = t.value;
    else if (t.classList.contains("ev-choice-result")) state.form.choices[Number(t.dataset.ci)].resultText = t.value;
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById("evBtnAdd").addEventListener("click", () => openEditor(-1));
    document.getElementById("evBtnExport").addEventListener("click", exportData);
    document.getElementById("evBtnStats").addEventListener("click", showStats);
    document.getElementById("evBtnImport").addEventListener("click", () => document.getElementById("evFileInput").click());
    document.getElementById("evFileInput").addEventListener("change", e => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = "";
    });

    document.getElementById("evCancel").addEventListener("click", closeEditor);
    document.getElementById("evSave").addEventListener("click", saveEditor);
    document.getElementById("evPreviewBtn").addEventListener("click", () => previewEvent(toEvent(state.form)));
    document.querySelectorAll('input[name=ev-kind]').forEach(r => r.addEventListener("change", () => { syncKindUI(); }));

    // 效果编辑 + 字段输入的委托（input & change 都满足）
    const ov = document.getElementById("evOverlay");
    ["input", "change"].forEach(ev => ov.addEventListener(ev, handleField));
    ov.addEventListener("click", e => {
      const t = e.target;
      const box = t.closest && t.closest(".eff-box");
      if (t.classList.contains("eff-attr-add") && box) {
        getEffectByTarget(box.dataset.target).attrs.push({ k: "shi", v: 0 });
        rerenderEffBox(box.dataset.target); return;
      }
      if (t.classList.contains("eff-attr-del") && box) {
        const row = t.closest(".eff-attr");
        getEffectByTarget(box.dataset.target).attrs.splice(Number(row.dataset.i), 1);
        rerenderEffBox(box.dataset.target); return;
      }
      if (t.classList.contains("ev-choice-add")) { state.form.choices.push(emptyChoice()); renderChoices(); return; }
      if (t.classList.contains("ev-choice-del")) { state.form.choices.splice(Number(t.dataset.ci), 1); renderChoices(); return; }
    });

    document.getElementById("evlist").addEventListener("click", e => {
      const t = e.target;
      if (t.dataset.preview != null) return previewEvent(state.events[Number(t.dataset.preview)]);
      if (t.dataset.edit != null) return openEditor(Number(t.dataset.edit));
      if (t.dataset.dup != null) return duplicate(Number(t.dataset.dup));
      if (t.dataset.del != null) return remove(Number(t.dataset.del));
      if (t.dataset.toggle != null) return toggleDraft(Number(t.dataset.toggle));
    });

    document.getElementById("evStClose").addEventListener("click", () => C.closeOverlay("evStOverlay"));
    document.getElementById("evPreviewClose").addEventListener("click", () => C.closeOverlay("evPreviewOverlay"));
    ["evFSearch", "evFKind", "evFRarity"].forEach(id => {
      document.getElementById(id).addEventListener("input", renderList);
      document.getElementById(id).addEventListener("change", renderList);
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    loadData();
    bind();
    renderList();
    state._ready = true;
    global.ADV._ready = true;
  }

  global.ADV = {
    init, get: () => state.events, exportRaw, validateAll, importData, renderList, openEditor, eventTargets, listTalentLinks, linkTalent, unlinkTalent, _ready: false
  };
})(window);
