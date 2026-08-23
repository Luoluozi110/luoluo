/* =========================================================================
 * qbank.js — 题库编辑器模块
 * 数据结构与游戏 config/questions.json 完全兼容：
 *   knowledge: {id,type,stem,options:[str...],answer,scenario?,optionActs?,difficulty,category,analysis,enabled}
 *   choice:    {id,type,stem,options:[{text,studyTarget,inkTags,resultText}...],difficulty,category,analysis,enabled}
 * 本模块依赖 common.js（Common.*），自身不重复定义存储/提示/转义。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;

  const ATTR = C.ATTR, CATEGORY = C.CATEGORY, TYPE_NAME = { knowledge: "知识题", choice: "创作抉择题" };
  const INK_TAGS = ["逐名", "求真", "守法", "出新", "与人", "独行", "惜身", "燃笔"];
  const defaultInkTags = target => ({ shi: ["守法", "独行"], ci: ["出新", "独行"], lian: ["与人", "守法"], bi: ["求真", "惜身"], xue: ["守法", "与人"], si: ["求真", "出新"] }[target] || ["求真"]);
  const normalizeChoiceOption = raw => {
    const source = (raw && typeof raw === "object") ? raw : { text: raw };
    const studyTarget = ATTR[source.studyTarget] ? source.studyTarget : (ATTR[source.attr] ? source.attr : "bi");
    const text = String(source.text || "").trim();
    const inkTags = (Array.isArray(source.inkTags) ? source.inkTags : defaultInkTags(studyTarget))
      .map(x => String(x || "").trim()).filter(x => INK_TAGS.includes(x)).slice(0, 2);
    return {
      text,
      studyTarget,
      inkTags: inkTags.length ? inkTags : defaultInkTags(studyTarget),
      resultText: String(source.resultText || `你把「${text || "这一笔"}」记入行卷，留待日后再看。`).trim()
    };
  };

  const state = { questions: [], editIndex: -1, form: null, _ready: false };

  const SEED = [
    {
      id: "Q0001", type: "knowledge",
      stem: "「夜半钟声到客船」的作者是？",
      options: ["张继", "杜牧", "李白", "王维"], answer: 0,
      difficulty: 2, category: "shi",
      analysis: "答案是张继。此句出自《枫桥夜泊》，写旅人夜泊苏州的孤寂。",
      enabled: true
    },
    {
      id: "Q0101", type: "choice",
      stem: "塞外八月飞雪，同行者叫苦，你却提起了笔——",
      options: [
        { text: "把苦寒写成惊喜：「千树万树梨花开」", attr: "shi" },
        { text: "把苦寒写成实录：「瀚海阑干百丈冰」", attr: "bi" },
        { text: "缩回帐中烤火，明日再说", attr: null }
      ],
      difficulty: 2, category: "shi",
      analysis: "无标准答案。两句其实出自同一首诗——岑参《白雪歌送武判官归京》。",
      enabled: true
    }
  ];

  /* ---------------- 持久化 ---------------- */
  function save() {
    C.store("qbank", state.questions);
    const t = new Date();
    C.setStatus("qbank", "已自动保存 " + t.toLocaleTimeString("zh-CN", { hour12: false }));
  }
  // 旧版「示例种子」的 ID 集合：仅含这两条时视为未正式导入，自动升级为游戏原数据。
  const OLD_QBANK_SEED_IDS = new Set(["Q0001", "Q0101"]);
  function loadData() {
    const raw = C.load("qbank", null);
    const isOldSeed = raw && raw.length === OLD_QBANK_SEED_IDS.size &&
      raw.every(q => OLD_QBANK_SEED_IDS.has(q.id));
    if (!raw || isOldSeed) {
      // 首次打开或仍停留在示例种子：载入游戏真实题库（66 题），并持久化。
      const base = (window.GAME_QUESTIONS && window.GAME_QUESTIONS.length) ? window.GAME_QUESTIONS : SEED;
      state.questions = normalizeAll(base);
      C.store("qbank", state.questions);
    } else {
      state.questions = normalizeAll(raw);
    }
  }

  /* ---------------- 规范化 / 校验 ---------------- */
  function normalizeOne(q) {
    q = q || {};
    const type = q.type === "choice" ? "choice" : "knowledge";
    const out = {
      id: String(q.id || "").trim(),
      type,
      stem: String(q.stem || "").trim(),
      difficulty: [1, 2, 3].includes(Number(q.difficulty)) ? Number(q.difficulty) : 2,
      category: CATEGORY[q.category] ? q.category : (q.category || "shi"),
      analysis: String(q.analysis || "").trim(),
      enabled: q.enabled === false ? false : true
    };
    if (type === "knowledge") {
      const opts = Array.isArray(q.options) ? q.options.map(o => String(o || "").trim()) : [];
      out.options = opts;
      const a = Number(q.answer);
      out.answer = (Number.isInteger(a) && a >= 0 && a < opts.length) ? a : 0;
      const scenario = String(q.scenario || "").trim();
      const acts = Array.isArray(q.optionActs) ? q.optionActs.map(x => String(x || "").trim()) : [];
      if (scenario || acts.some(Boolean)) {
        out.scenario = scenario;
        out.optionActs = acts;
      }
    } else {
      const opts = Array.isArray(q.options) ? q.options.map(normalizeChoiceOption) : [];
      out.options = opts;
    }
    return out;
  }
  function normalizeAll(arr) { return (Array.isArray(arr) ? arr : []).map(normalizeOne); }

  /* ---------------- 游戏内柔性文案 ----------------
   * 游戏端 showQuiz() 的显示优先级必须在编辑器里一眼可见：
   * knowledge 题有 scenario / optionActs 时显示它们，否则回退到 stem / options。
   * 同步只触碰这两个字段，不会覆盖题干、答案、解析或题库属性。
   */
  function hasSituationalCopy(q) {
    return q && q.type === "knowledge" &&
      (!!String(q.scenario || "").trim() || (Array.isArray(q.optionActs) && q.optionActs.some(x => String(x || "").trim())));
  }
  function runtimeOptionText(q, index) {
    if (!q || !Array.isArray(q.options)) return "";
    const option = q.options[index];
    if (q.type === "knowledge") {
      const act = Array.isArray(q.optionActs) ? String(q.optionActs[index] || "").trim() : "";
      return act || String(option || "").trim();
    }
    return String(option && typeof option === "object" ? option.text || "" : option || "").trim();
  }
  function runtimeCopyFields(q) {
    if (!q || q.type !== "knowledge") return { scenario: "", optionActs: [] };
    return {
      scenario: String(q.scenario || "").trim(),
      optionActs: Array.isArray(q.optionActs) ? q.optionActs.map(x => String(x || "").trim()) : []
    };
  }
  function syncRuntimeCopy() {
    const runtime = Array.isArray(window.GAME_QUESTIONS) ? window.GAME_QUESTIONS : [];
    const byId = new Map(runtime.map(q => [q.id, q]));
    let updated = 0, matched = 0;
    state.questions.forEach(q => {
      const source = byId.get(q.id);
      if (!source || q.type !== "knowledge" || source.type !== "knowledge") return;
      matched++;
      const prev = runtimeCopyFields(q);
      const next = runtimeCopyFields(source);
      if (JSON.stringify(prev) !== JSON.stringify(next)) {
        if (next.scenario || next.optionActs.some(Boolean)) {
          q.scenario = next.scenario;
          q.optionActs = next.optionActs;
        } else {
          delete q.scenario;
          delete q.optionActs;
        }
        updated++;
      }
    });
    if (updated) { save(); renderList(); }
    return { updated, matched, sourceCount: runtime.length };
  }
  function runtimeSyncSummary() {
    const runtime = Array.isArray(window.GAME_QUESTIONS) ? window.GAME_QUESTIONS : [];
    const byId = new Map(runtime.map(q => [q.id, q]));
    let stale = 0;
    state.questions.forEach(q => {
      const source = byId.get(q.id);
      if (source && q.type === "knowledge" && source.type === "knowledge" &&
          JSON.stringify(runtimeCopyFields(q)) !== JSON.stringify(runtimeCopyFields(source))) stale++;
    });
    return { stale, sourceCount: runtime.length };
  }

  function validate(q, allQuestions, selfIndex) {
    const errors = [];
    if (!q.id) errors.push("题目 ID 不能为空");
    else if (!/^[A-Za-z0-9_\-]+$/.test(q.id)) errors.push("ID 只能含字母、数字、下划线和连字符");
    else {
      const dup = allQuestions.findIndex((x, i) => x.id === q.id && i !== selfIndex);
      if (dup >= 0) errors.push("ID 与第 " + (dup + 1) + " 题重复");
    }
    if (!q.stem) errors.push("题干不能为空");
    if (!Array.isArray(q.options) || q.options.length < 2) errors.push("至少需要 2 个选项");
    if (q.type === "knowledge") {
      q.options.forEach((o, i) => { if (!o) errors.push("选项 " + (i + 1) + " 内容为空"); });
      if (q.answer < 0 || q.answer >= q.options.length) errors.push("请指定正确答案");
      const scenario = String(q.scenario || "").trim();
      const acts = Array.isArray(q.optionActs) ? q.optionActs : [];
      const hasSituational = !!scenario || acts.some(x => String(x || "").trim());
      if (hasSituational) {
        if (scenario.length < 20 || scenario.length > 160) errors.push("游戏内情境须为 20–160 字");
        if (scenario.includes("{name}")) errors.push("游戏内情境不能使用 {name} 占位符");
        if (acts.length !== q.options.length) errors.push("行动文案数量必须与选项数量一致");
        q.options.forEach((_, i) => {
          const act = String(acts[i] || "").trim();
          if (act.length < 5) errors.push("选项 " + (i + 1) + " 的游戏内行动文案至少需要 5 字");
          else if (act.length > 60) errors.push("选项 " + (i + 1) + " 的游戏内行动文案不能超过 60 字");
          if (act.includes("{name}")) errors.push("选项 " + (i + 1) + " 的游戏内行动文案不能使用 {name} 占位符");
        });
      }
    } else {
      q.options.forEach((o, i) => {
        if (!o.text) errors.push("选项 " + (i + 1) + " 内容为空");
        if (!ATTR[o.studyTarget]) errors.push("选项 " + (i + 1) + " 必须选择修习方向");
        if (!String(o.resultText || "").trim()) errors.push("选项 " + (i + 1) + " 必须填写即时回声");
        if (!Array.isArray(o.inkTags) || !o.inkTags.length || o.inkTags.length > 2 || o.inkTags.some(x => !INK_TAGS.includes(x)))
          errors.push("选项 " + (i + 1) + " 须填写 1–2 个有效墨痕（用顿号分隔）");
      });
    }
    if (![1, 2, 3].includes(q.difficulty)) errors.push("难度必须是 1–3");
    return { ok: errors.length === 0, errors };
  }
  function validateAll() {
    return state.questions.map((q, i) => ({ i, ...validate(q, state.questions, i) })).filter(r => !r.ok);
  }

  /* ---------------- 渲染列表 ---------------- */
  function getFilters() {
    return {
      q: document.getElementById("fSearch").value.trim().toLowerCase(),
      type: document.getElementById("fType").value,
      category: document.getElementById("fCategory").value,
      difficulty: document.getElementById("fDifficulty").value,
      status: document.getElementById("fStatus").value
    };
  }
  function filtered() {
    const f = getFilters();
    return state.questions.filter(q => {
      if (f.type !== "all" && q.type !== f.type) return false;
      if (f.category !== "all" && q.category !== f.category) return false;
      if (f.difficulty !== "all" && String(q.difficulty) !== f.difficulty) return false;
      if (f.status === "on" && q.enabled !== true) return false;
      if (f.status === "off" && q.enabled === true) return false;
      if (f.q) {
        const hay = [q.id, q.stem, q.scenario, q.analysis, ...(q.optionActs || []),
          ...(q.options || []).map(o => typeof o === "string" ? o : (o && o.text) || "")].join(" ").toLowerCase();
        if (!hay.includes(f.q)) return false;
      }
      return true;
    });
  }

  function renderStats() {
    const total = state.questions.length;
    const on = state.questions.filter(q => q.enabled).length;
    const k = state.questions.filter(q => q.type === "knowledge").length;
    const c = state.questions.filter(q => q.type === "choice").length;
    const flexible = state.questions.filter(hasSituationalCopy).length;
    const sync = runtimeSyncSummary();
    document.getElementById("statStrip").innerHTML = `
      <div class="stat"><b>${total}</b><span>题目总数</span></div>
      <div class="stat"><b>${on}</b><span>已启用</span></div>
      <div class="stat"><b>${total - on}</b><span>已禁用</span></div>
      <div class="stat"><b>${k}</b><span>知识题</span></div>
      <div class="stat"><b>${c}</b><span>抉择题</span></div>
      <div class="stat runtime-stat"><b>${flexible}</b><span>柔性题面</span></div>`;
    const syncBtn = document.getElementById("btnSyncRuntime");
    if (syncBtn) {
      syncBtn.textContent = sync.stale ? `同步游戏文案（${sync.stale}）` : "同步游戏文案";
      syncBtn.title = sync.stale
        ? `发现 ${sync.stale} 道题与游戏内柔性文案不一致，点击仅同步情境与行动文案`
        : "仅同步游戏内情境与行动文案，保留题干、答案、解析等题库字段";
    }
  }

  function renderList() {
    renderStats();
    const list = document.getElementById("qlist");
    const items = filtered();
    if (!items.length) {
      list.innerHTML = `<div class="empty"><b>${state.questions.length ? "没有符合筛选条件的题目" : "题库还是空的"}</b>
        ${state.questions.length ? "试着调整上方筛选条件。" : "点击「＋ 新增题目」开始，或「导入 JSON」载入现有的 questions.json。"}</div>`;
      return;
    }
    list.innerHTML = items.map(q => {
      const idx = state.questions.indexOf(q);
      const diff = "●".repeat(q.difficulty) + "○".repeat(3 - q.difficulty);
      const optText = q.options.map((o, i) => {
        const t = typeof o === "string" ? o : (o && o.text) || "";
        const mark = (q.type === "knowledge" && i === q.answer) ? " ✓" : "";
        return C.esc(t) + mark;
      }).join("　|　");
      const runtimeStem = q.scenario || q.stem || "（未填写）";
      const runtimeActions = q.options.map((_, i) => runtimeOptionText(q, i));
      return `<div class="q-card" data-idx="${idx}">
        <div class="meta">
          <span class="q-id">${C.esc(q.id)}</span>
          <span class="badge ${q.type === "knowledge" ? "k" : "c"}">${TYPE_NAME[q.type]}</span>
          <span class="diff">${diff}</span>
          <span class="pill ${q.enabled ? "on" : "off"}" data-toggle="${idx}" title="点击切换启用/禁用">${q.enabled ? "启用" : "禁用"}</span>
        </div>
        <div class="q-main">
          <p class="q-stem"><span class="q-copy-label">题库题干</span>${C.esc(q.stem)}</p>
          <div class="q-tags">
            <span class="t">${CATEGORY[q.category] || q.category}</span>
            ${hasSituationalCopy(q) ? `<span class="t">柔性题面</span>` : ""}
            <span class="t">${q.options.length} 选项</span>
          </div>
          <div class="q-opts"><span class="q-copy-label">题库选项</span>${C.esc(optText)}</div>
          <div class="q-runtime-copy">
            <span class="runtime-copy-label">游戏内显示 · ${hasSituationalCopy(q) ? "柔性答题" : "回退文案"}</span>
            <p class="runtime-copy-stem">${C.esc(runtimeStem)}</p>
            <div class="q-runtime-actions">${runtimeActions.map((text, i) => `<span>${"ABCD"[i] || (i + 1)}．${C.esc(text || "（未填写）")}</span>`).join("")}</div>
          </div>
        </div>
        <div class="q-actions">
          <button class="btn sm" data-edit="${idx}">编辑</button>
          <button class="btn sm" data-dup="${idx}">复制</button>
          <button class="btn sm danger" data-del="${idx}">删除</button>
        </div>
      </div>`;
    }).join("");
  }

  /* ---------------- 编辑弹窗 ---------------- */
  function fillCategorySelect(sel, includeAll) {
    const head = includeAll ? `<option value="all">全部分类</option>` : ``;
    sel.innerHTML = head + Object.entries(CATEGORY)
      .map(([k, v]) => `<option value="${k}">${v}（${k}）</option>`).join("");
  }
  function openEditor(index) {
    state.editIndex = index;
    state._suggestedId = null;
    const src = index >= 0 ? state.questions[index] : null;
    state.form = src
      ? JSON.parse(JSON.stringify(src))
      : { id: "", type: "knowledge", stem: "", scenario: "", options: ["", ""], optionActs: ["", ""], answer: 0, difficulty: 2, category: "shi", analysis: "", enabled: true };
    if (!src && state.form.type === "choice")
      state.form.options = [normalizeChoiceOption({ text: "" }), normalizeChoiceOption({ text: "" })];
    if (!src) {
      const pfx = state.form.type === "choice" ? "Q1" : "Q0";
      state.form.id = C.nextSeqId(pfx, state.questions.map(q => q.id), 3);
      state._suggestedId = state.form.id;
    }

    document.getElementById("edTitle").textContent = src ? "编辑题目 · " + src.id : "新增题目";
    document.getElementById("ed-id").value = state.form.id;
    document.querySelector(`input[name=ed-type][value=${state.form.type}]`).checked = true;
    document.getElementById("ed-difficulty").value = String(state.form.difficulty);
    document.getElementById("ed-category").value = state.form.category;
    document.getElementById("ed-stem").value = state.form.stem;
    document.getElementById("ed-scenario").value = state.form.scenario || "";
    document.getElementById("ed-analysis").value = state.form.analysis || "";
    document.getElementById("ed-enabled").checked = state.form.enabled !== false;
    const msg = document.getElementById("edMsg"); msg.className = "msg"; msg.textContent = "";
    syncTypeUI();
    renderOptions();
    C.openOverlay("edOverlay");
  }
  function closeEditor() { C.closeOverlay("edOverlay"); state.editIndex = -1; state.form = null; }

  function syncTypeUI() {
    const type = document.querySelector('input[name=ed-type]:checked').value;
    state.form.type = type;
    if (state._suggestedId && (state.form.id === state._suggestedId || state.form.id === "")) {
      const pfx = type === "choice" ? "Q1" : "Q0";
      state.form.id = C.nextSeqId(pfx, state.questions.map(q => q.id), 3);
      state._suggestedId = state.form.id;
      const el = document.getElementById("ed-id"); if (el) el.value = state.form.id;
    }
    const isK = type === "knowledge";
    document.getElementById("knowledgeSituationalField").style.display = isK ? "" : "none";
    document.getElementById("optLabel").textContent = isK ? "选项（勾选圆圈标记正确答案）" : "选项（每项设置修习方向与倾向回声）";
    document.getElementById("optHint").textContent = isK
      ? "单选知识题：勾选正确答案，游戏答错会扣灵感。"
      : "创作抉择题：无标准答案；当前研修方向推进进度，旁通方向沉淀为心得。倾向请从固定标签中选择 1–2 项。";
    if (isK) {
      if (!state.form.options.length || typeof state.form.options[0] !== "string") state.form.options = ["", ""];
      if (!Array.isArray(state.form.optionActs)) state.form.optionActs = [];
      while (state.form.optionActs.length < state.form.options.length) state.form.optionActs.push("");
      if (state.form.optionActs.length > state.form.options.length) state.form.optionActs.length = state.form.options.length;
      if (state.form.answer >= state.form.options.length) state.form.answer = 0;
    } else {
      state.form.options = state.form.options.map(normalizeChoiceOption);
      if (!state.form.options.length) state.form.options = [normalizeChoiceOption({ text: "" }), normalizeChoiceOption({ text: "" })];
    }
  }

  function renderOptions() {
    const type = state.form.type;
    const box = document.getElementById("ed-options");
    box.innerHTML = state.form.options.map((o, i) => {
      if (type === "knowledge") {
        const checked = (state.form.answer === i) ? "checked" : "";
        const act = (state.form.optionActs && state.form.optionActs[i]) || "";
        return `<div class="opt-row knowledge-opt-row" data-i="${i}">
          <span class="ord">${i + 1}</span>
          <input type="radio" name="ed-answer" value="${i}" ${checked} title="设为正确答案"/>
          <input type="text" class="opt-text" value="${C.esc(o)}" placeholder="标准答案文本"/>
          <span class="opt-act-wrap"><small>游戏内行动</small><input type="text" class="opt-act" maxlength="60" value="${C.esc(act)}" placeholder="柔性题填写，5–60 字"/></span>
          <button class="opt-del" data-delopt="${i}" title="删除此选项">×</button>
        </div>`;
      } else {
        const targetOpts = Object.entries(ATTR)
          .map(([k, v]) => `<option value="${k}" ${o.studyTarget === k ? "selected" : ""}>${v}</option>`).join("");
        const selectedTags = new Set(o.inkTags || []);
        const inkButtons = INK_TAGS.map(tag => {
          const selected = selectedTags.has(tag);
          return `<button type="button" class="ink-tag-toggle${selected ? " is-selected" : ""}" data-ink-tag="${C.esc(tag)}" aria-pressed="${selected ? "true" : "false"}">${C.esc(tag)}</button>`;
        }).join("");
        return `<div class="opt-row choice-opt-row" data-i="${i}">
          <span class="ord">${i + 1}</span>
          <input type="text" class="opt-text" value="${C.esc(o.text)}" placeholder="选项内容"/>
          <select class="opt-study-target" title="修习方向">${targetOpts}</select>
          <div class="choice-ink-picker" role="group" aria-label="倾向标签">
            <span class="choice-field-label">倾向</span>
            <div class="choice-ink-tags">${inkButtons}</div>
            <small>已选 ${selectedTags.size}/2，点击标签切换</small>
          </div>
          <input type="text" class="opt-result" value="${C.esc(o.resultText || "")}" placeholder="选择后的即时回声"/>
          <button class="opt-del" data-delopt="${i}" title="删除此选项">×</button>
        </div>`;
      }
    }).join("");
    updateRuntimePreview();
  }

  function refreshInkPicker(row, tags) {
    const selected = new Set(tags || []);
    row.querySelectorAll('[data-ink-tag]').forEach(button => {
      const on = selected.has(String(button.dataset.inkTag || ''));
      button.classList.toggle('is-selected', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const hint = row.querySelector('.choice-ink-picker small');
    if (hint) hint.textContent = `已选 ${selected.size}/2，点击标签切换`;
    updateRuntimePreview();
  }

  function updateRuntimePreview() {
    const panel = document.getElementById("edRuntimeCopyPanel");
    if (!panel || !state.form) return;
    const isKnowledge = state.form.type === "knowledge";
    const scenario = isKnowledge ? String(state.form.scenario || "").trim() : "";
    const stem = scenario || String(state.form.stem || "").trim() || "（未填写题面）";
    const stemEl = document.getElementById("edRuntimeStem");
    const optionsEl = document.getElementById("edRuntimeOptions");
    const resultEl = document.getElementById("edRuntimeResult");
    stemEl.textContent = stem;
    optionsEl.innerHTML = (state.form.options || []).map((option, i) => {
      const text = isKnowledge ? runtimeOptionText(state.form, i) : runtimeOptionText(state.form, i);
      return `<li>${C.esc(text || "（未填写）")}</li>`;
    }).join("");
    if (isKnowledge) {
      const answer = Number.isInteger(Number(state.form.answer)) ? Number(state.form.answer) : -1;
      const answerText = answer >= 0 && answer < state.form.options.length ? runtimeOptionText(state.form, answer) : "（尚未指定正确答案）";
      const answerMark = answer >= 0 && answer < state.form.options.length ? ("ABCD"[answer] || String(answer + 1)) + "．" : "";
      const lead = scenario ? "当如是" : "正确答案";
      const analysis = String(state.form.analysis || "").trim() || "（本题暂无解析）";
      resultEl.innerHTML = `答错 / 超时时显示：<b>${lead}：${answerMark}${C.esc(answerText)}</b><br/>解析：${C.esc(analysis)}`;
    } else {
      const picked = state.form.options[0] || {};
      const target = ATTR[picked.studyTarget] || "笔力";
      resultEl.innerHTML = `选中后显示：<b>${C.esc(picked.resultText || "（请填写即时回声）")}</b><br/>修习所得：${C.esc(target)}研修进度 +1（当前在修时）／心得 +1（旁通时）。`;
    }
  }

  function collectForm() {
    const type = document.querySelector('input[name=ed-type]:checked').value;
    const rows = [...document.querySelectorAll("#ed-options .opt-row")];
    const options = rows.map(r => {
      const text = r.querySelector(".opt-text").value.trim();
      if (type === "choice") {
        const studyTarget = r.querySelector(".opt-study-target").value || "bi";
        const inkTags = [...r.querySelectorAll("[data-ink-tag].is-selected")]
          .map(x => String(x.dataset.inkTag || "").trim()).filter(x => INK_TAGS.includes(x)).slice(0, 2);
        const resultText = r.querySelector(".opt-result").value.trim();
        return { text, studyTarget, inkTags, resultText };
      }
      return text;
    });
    const optionActs = type === "knowledge" ? rows.map(r => r.querySelector(".opt-act").value.trim()) : undefined;
    let answer = -1;
    if (type === "knowledge") {
      const ck = document.querySelector('input[name=ed-answer]:checked');
      answer = ck ? Number(ck.value) : -1;
    }
    const out = {
      id: document.getElementById("ed-id").value.trim(),
      type, stem: document.getElementById("ed-stem").value.trim(),
      options, answer,
      difficulty: Number(document.getElementById("ed-difficulty").value),
      category: document.getElementById("ed-category").value,
      analysis: document.getElementById("ed-analysis").value.trim(),
      enabled: document.getElementById("ed-enabled").checked
    };
    if (type === "knowledge") {
      out.scenario = document.getElementById("ed-scenario").value.trim();
      out.optionActs = optionActs;
    }
    return out;
  }

  function saveEditor() {
    const q = collectForm();
    if (q.type === "knowledge") {
      const ck = document.querySelector('input[name=ed-answer]:checked');
      q.answer = ck ? Number(ck.value) : -1;
    }
    const { ok, errors } = validate(q, state.questions, state.editIndex);
    const msg = document.getElementById("edMsg");
    if (!ok) {
      msg.className = "msg err";
      msg.innerHTML = "✗ 无法保存：<br>• " + errors.join("<br>• ");
      return;
    }
    if (state.editIndex >= 0) { state.questions[state.editIndex] = normalizeOne(q); C.toast("已更新 " + q.id); }
    else { state.questions.push(normalizeOne(q)); C.toast("已新增 " + q.id); }
    save(); closeEditor(); renderList();
  }

  /* ---------------- 题目操作 ---------------- */
  function toggleEnabled(idx) {
    state.questions[idx].enabled = !state.questions[idx].enabled;
    save(); renderList(); C.toast(state.questions[idx].enabled ? "已启用" : "已禁用");
  }
  function duplicate(idx) {
    const copy = JSON.parse(JSON.stringify(state.questions[idx]));
    let base = copy.id, n = 1, newId;
    do { newId = base + "_" + n; n++; } while (state.questions.some(q => q.id === newId));
    copy.id = newId;
    state.questions.splice(idx + 1, 0, copy);
    save(); renderList(); C.toast("已复制为 " + newId);
  }
  function remove(idx) {
    const q = state.questions[idx];
    if (!confirm(`确定删除题目「${q.id}」？此操作不可撤销。`)) return;
    state.questions.splice(idx, 1);
    save(); renderList(); C.toast("已删除 " + q.id);
  }

  /* ---------------- 导入 / 导出 ---------------- */
  function importData(arr, mode) {
    const norm = normalizeAll(arr);
    if (mode) {
      state.questions = norm;
      C.toast("已替换为 " + norm.length + " 题");
    } else {
      const map = new Map(state.questions.map((q, i) => [q.id, i]));
      let added = 0, updated = 0;
      norm.forEach(q => {
        if (map.has(q.id)) { state.questions[map.get(q.id)] = q; updated++; }
        else { state.questions.push(q); added++; }
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
      else if (Array.isArray(data.questions)) arr = data.questions;
      else if (Array.isArray(data.bank)) arr = data.bank;
      else if (Array.isArray(data.events)) { alert("这是奇遇文件，请在「奇遇编辑器」中导入。"); return; }
      else { alert("未识别的 JSON 结构（应为题目数组，或含 questions/bank 字段的对象）。"); return; }
      const norm = normalizeAll(arr);
      const mode = confirm(
        `成功读取 ${norm.length} 道题。\n\n点击「确定」= 替换当前题库；\n点击「取消」= 按 ID 合并（已存在则覆盖，不存在则追加）。`);
      importData(norm, mode);
    };
    reader.readAsText(file, "utf-8");
  }
  function exportData() {
    const bad = validateAll();
    if (bad.length) {
      const names = bad.slice(0, 8).map(r => state.questions[r.i].id || "(无ID)").join("、");
      if (!confirm(`有 ${bad.length} 道题存在校验问题（如：${names}…）。\n仍要导出吗？建议先修正再导出。`)) return;
    }
    const data = JSON.stringify(state.questions, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "questions.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    C.toast("已导出 questions.json");
  }

  /* ---------------- 统计弹窗 ---------------- */
  function showStats() {
    const byType = {}, byCat = {}, byDiff = { 1: 0, 2: 0, 3: 0 };
    state.questions.forEach(q => {
      byType[q.type] = (byType[q.type] || 0) + 1;
      byCat[q.category] = (byCat[q.category] || 0) + 1;
      byDiff[q.difficulty] = (byDiff[q.difficulty] || 0) + 1;
    });
    const row = (k, v) => `<tr><td>${k}</td><td class="num">${v}</td></tr>`;
    document.getElementById("stBody").innerHTML = `
      <p><b>总题数：</b>${state.questions.length}（已启用 ${state.questions.filter(q => q.enabled).length}）</p>
      <h4 style="margin:14px 0 6px">按题型</h4>
      <table class="stat-table"><tr><th>题型</th><th>数量</th></tr>
        ${row(TYPE_NAME.knowledge || "知识题", byType.knowledge || 0)}
        ${row(TYPE_NAME.choice || "创作抉择题", byType.choice || 0)}</table>
      <h4 style="margin:14px 0 6px">按分类</h4>
      <table class="stat-table"><tr><th>分类</th><th>数量</th></tr>
        ${Object.entries(byCat).map(([k, v]) => row((CATEGORY[k] || k) + " (" + k + ")", v)).join("")}</table>
      <h4 style="margin:14px 0 6px">按难度</h4>
      <table class="stat-table"><tr><th>难度</th><th>数量</th></tr>
        ${row("1 · 易", byDiff[1])}${row("2 · 中", byDiff[2])}${row("3 · 难", byDiff[3])}</table>`;
    C.openOverlay("stOverlay");
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById("btnAdd").addEventListener("click", () => openEditor(-1));
    document.getElementById("btnExport").addEventListener("click", exportData);
    document.getElementById("btnStats").addEventListener("click", showStats);
    document.getElementById("btnSyncRuntime").addEventListener("click", () => {
      const summary = runtimeSyncSummary();
      if (!summary.sourceCount) { C.toast("没有找到游戏题库原始数据"); return; }
      if (!summary.stale) { C.toast("游戏内柔性文案已是最新"); return; }
      if (!confirm(`将同步 ${summary.stale} 道题的游戏内情境与行动文案。\n\n题干、选项原文、答案、解析和题库属性不会被覆盖。继续吗？`)) return;
      const result = syncRuntimeCopy();
      C.toast(`游戏文案同步完成：更新 ${result.updated} 道题`);
    });
    document.getElementById("btnImport").addEventListener("click", () => document.getElementById("fileInput").click());
    document.getElementById("fileInput").addEventListener("change", e => {
      if (e.target.files[0]) importFile(e.target.files[0]);
      e.target.value = "";
    });

    document.getElementById("edCancel").addEventListener("click", closeEditor);
    document.getElementById("edSave").addEventListener("click", saveEditor);
    document.querySelectorAll('input[name=ed-type]').forEach(r => r.addEventListener("change", () => { syncTypeUI(); renderOptions(); }));
    document.getElementById("ed-addopt").addEventListener("click", () => {
      if (state.form.type === "knowledge") { state.form.options.push(""); state.form.optionActs.push(""); }
      else state.form.options.push(normalizeChoiceOption({ text: "" }));
      renderOptions();
    });
    document.getElementById("ed-options").addEventListener("click", e => {
      const ink = e.target.closest("[data-ink-tag]");
      if (ink && state.form && state.form.type === "choice") {
        const row = ink.closest(".opt-row");
        const i = Number(row && row.dataset.i);
        const option = state.form.options[i];
        const tag = String(ink.dataset.inkTag || "");
        if (option && INK_TAGS.includes(tag)) {
          const tags = Array.isArray(option.inkTags) ? option.inkTags.slice() : [];
          const at = tags.indexOf(tag);
          if (at >= 0) tags.splice(at, 1);
          else if (tags.length < 2) tags.push(tag);
          else { C.toast("每项最多选择 2 个倾向标签"); return; }
          option.inkTags = tags;
          refreshInkPicker(row, tags);
        }
        return;
      }
      const del = e.target.closest("[data-delopt]");
      if (del) {
        const i = Number(del.dataset.delopt);
        state.form.options.splice(i, 1);
        if (state.form.type === "knowledge") state.form.optionActs.splice(i, 1);
        if (state.form.type === "knowledge" && state.form.answer >= state.form.options.length)
          state.form.answer = Math.max(0, state.form.options.length - 1);
        renderOptions();
      }
    });
    document.getElementById("ed-options").addEventListener("change", e => {
      if (e.target.name === "ed-answer") state.form.answer = Number(e.target.value);
      const row = e.target.closest(".opt-row");
      if (row && state.form.type === "choice") {
        const i = Number(row.dataset.i);
        const studyTarget = row.querySelector(".opt-study-target").value || "bi";
        if (state.form.options[i]) { state.form.options[i].studyTarget = studyTarget; }
      }
      updateRuntimePreview();
    });
    document.getElementById("ed-options").addEventListener("input", e => {
      const row = e.target.closest(".opt-row");
      if (!row || !state.form) return;
      const i = Number(row.dataset.i);
      if (state.form.type === "knowledge") {
        state.form.options[i] = row.querySelector(".opt-text").value;
        state.form.optionActs[i] = row.querySelector(".opt-act").value;
      } else if (state.form.options[i]) {
        state.form.options[i].text = row.querySelector(".opt-text").value;
        state.form.options[i].resultText = row.querySelector(".opt-result").value;
      }
      updateRuntimePreview();
    });
    ["ed-id", "ed-stem", "ed-scenario", "ed-analysis"].forEach(id => {
      document.getElementById(id).addEventListener("input", e => {
        if (!state.form) return;
        const key = id.replace("ed-", "");
        state.form[key] = e.target.value;
        updateRuntimePreview();
      });
    });
    document.getElementById("ed-difficulty").addEventListener("change", e => { if (state.form) state.form.difficulty = Number(e.target.value); });
    document.getElementById("ed-category").addEventListener("change", e => { if (state.form) state.form.category = e.target.value; });
    document.getElementById("ed-enabled").addEventListener("change", e => { if (state.form) state.form.enabled = e.target.checked; });

    document.getElementById("qlist").addEventListener("click", e => {
      const t = e.target;
      if (t.dataset.edit != null) return openEditor(Number(t.dataset.edit));
      if (t.dataset.dup != null) return duplicate(Number(t.dataset.dup));
      if (t.dataset.del != null) return remove(Number(t.dataset.del));
      if (t.dataset.toggle != null) return toggleEnabled(Number(t.dataset.toggle));
    });

    document.getElementById("stClose").addEventListener("click", () => C.closeOverlay("stOverlay"));
    ["fSearch", "fType", "fCategory", "fDifficulty", "fStatus"].forEach(id => {
      document.getElementById(id).addEventListener("input", renderList);
      document.getElementById(id).addEventListener("change", renderList);
    });
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    fillCategorySelect(document.getElementById("ed-category"), false);
    fillCategorySelect(document.getElementById("fCategory"), true);
    loadData();
    bind();
    renderList();
    global.QB._ready = true;
  }

  global.QB = {
    init, get: () => state.questions, add: q => { state.questions.push(normalizeOne(q)); save(); renderList(); },
    exportObj: () => state.questions, validateAll, importData, renderList,
    syncRuntimeCopy, runtimeSyncSummary
  };
})(window);
