/* =========================================================================
 * copy.js — 叙事文案编辑器（流派文案 + 段位/评语文案 + 评分文案 + 开局/阶段弹窗文案）
 * 只编辑「玩家可见的叙事/展示文案」字段，绝不改动数值、公式、门槛等机制。
 * 数据来源：config/schools.json、config/grades.json 与 config/narrative.json（经 seed-copy.js 镜像）。
 * 与现有 9 个编辑器（题库/奇遇/文心/NPC/相性/羁绊/地图/天象/名篇）互不重叠：
 *   · 选择回声文案属于奇遇抉择选项文本（events.json），由奇遇编辑器负责，本编辑器不碰。
 *   · 本编辑器只覆盖 schools / grades / narrative 三份配置里的纯文案字段。
 * 导出即 schools.json / grades.json / narrative.json；合并工程文件（feihua-content.json）亦带三者。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;

  const state = { schools: [], grades: {}, narrative: {}, _ready: false };

  /* ---------------- 工具 ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function setByPath(root, path, value) {
    const parts = String(path).split(".");
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      cur = Array.isArray(cur) ? cur[Number(k)] : cur[k];
    }
    const last = parts[parts.length - 1];
    if (Array.isArray(cur)) cur[Number(last)] = value; else cur[last] = value;
  }

  function normalizeSchool(s) {
    s = s || {};
    return {
      id: String(s.id || "").trim(),
      name: String(s.name || "").trim(),
      attr: s.attr,
      homeManner: s.homeManner != null ? s.homeManner : null,
      talent: s.talent,
      aliases: Array.isArray(s.aliases) ? s.aliases : [],
      schoolMechanics: s.schoolMechanics && typeof s.schoolMechanics === "object" ? clone(s.schoolMechanics) : {},
      motto: String(s.motto || "").trim(),
      flavor: String(s.flavor || "").trim(),
      desc: String(s.desc || "").trim()
    };
  }

  function normalizeGrades(g) {
    g = g && typeof g === "object" ? clone(g) : {};
    if (!Array.isArray(g.dimensions)) g.dimensions = [];
    if (!Array.isArray(g.grades)) g.grades = [];
    if (!g.comments || typeof g.comments !== "object") g.comments = {};
    return g;
  }

  function normalizeNarrative(n) {
    n = n && typeof n === "object" ? clone(n) : {};
    const officialHidden = ((window.GAME_NARRATIVE || {}).hiddenFinal) || {};
    const d = {
      prologue: { title: "", text: "", button: "" },
      zeitgeist: { kind: "", title: "", lead: "", note: "", button: "" },
      stageChange: { kind: "", names: { xiucai: "", juren: "", jinshi: "" }, titleTpl: "", buttonTpl: "", default: "", middle: "", inner: "" },
      lap2Intro: { title: "", text: "", button: "" },
      hiddenFinal: {
        invite: { kind: "", title: "", text: "", enterButton: "", declineButton: "" },
        victory: { kind: "", title: "", text: "", button: "" },
        defeat: { kind: "", title: "", text: "", button: "" }
      }
    };
    for (const k of ["prologue", "zeitgeist", "stageChange", "lap2Intro"]) d[k] = Object.assign({}, d[k], n[k] || {});
    d.stageChange.names = Object.assign({ xiucai: "", juren: "", jinshi: "" }, (n.stageChange || {}).names || {});
    for (const k of ["invite", "victory", "defeat"])
      d.hiddenFinal[k] = Object.assign({}, d.hiddenFinal[k], officialHidden[k] || {}, ((n.hiddenFinal || {})[k]) || {});
    return d;
  }

  /* 深合并：仅用于「按 ID 合并」导入时把外部 grades 的文案字段叠加到当前。
     覆盖对象与数组（数组按引用整体替换，不按索引拼接），容忍缺字段。 */
  function deepMerge(base, over) {
    if (Array.isArray(over)) return clone(over);
    if (over && typeof over === "object") {
      const out = base && typeof base === "object" && !Array.isArray(base) ? clone(base) : {};
      for (const k of Object.keys(over)) out[k] = deepMerge(out[k], over[k]);
      return out;
    }
    return over === undefined ? base : over;
  }

  /* ---------------- 存取 ---------------- */
  function save() {
    const ok1 = C.store("copy_schools", state.schools);
    const ok2 = C.store("copy_grades", state.grades);
    const ok3 = C.store("copy_narrative", state.narrative);
    C.setStatus("copy", "已自动保存 " + new Date().toLocaleTimeString("zh-CN", { hour12: false }));
    return ok1 && ok2 && ok3;
  }

  function loadData() {
    const rawS = C.load("copy_schools", null);
    const rawG = C.load("copy_grades", null);
    const rawN = C.load("copy_narrative", null);
    state.schools = (Array.isArray(rawS) ? rawS : (window.GAME_SCHOOLS || [])).map(normalizeSchool);
    state.grades = normalizeGrades(rawG != null ? rawG : (window.GAME_GRADES || {}));
    state.narrative = normalizeNarrative(rawN != null ? rawN : (window.GAME_NARRATIVE || {}));
    if (!C.load("copy_schools", null)) C.store("copy_schools", state.schools);
    if (!C.load("copy_grades", null)) C.store("copy_grades", state.grades);
    // normalizeNarrative 会为旧数据补齐隐藏终圈，始终写回以完成一次性迁移。
    C.store("copy_narrative", state.narrative);
  }

  /* ---------------- 校验（仅文案完整性，不动机制） ---------------- */
  function validateAll() {
    const e = [];
    state.schools.forEach((s, i) => {
      const w = "流派 " + (s.id || "(无ID)");
      if (!s.id) e.push({ g: "流派文案", msg: "流派 ID 缺失" });
      if (!s.name) e.push({ g: "流派文案", msg: w + " 名称不能为空" });
      if (!s.motto) e.push({ g: "流派文案", msg: w + " 口号(motto)为空" });
      if (!s.flavor) e.push({ g: "流派文案", msg: w + " 沉浸叙事(flavor)为空" });
      if (!s.desc) e.push({ g: "流派文案", msg: w + " 玩法说明(desc)为空" });
    });
    const cm = state.grades.comments || {};
    Object.keys(cm).forEach(k => { if (!String(cm[k] || "").trim()) e.push({ g: "段位评语", msg: "维度评语「" + k + "」为空" }); });
    (state.grades.grades || []).forEach(g => {
      if (g.reward != null && String(g.reward).trim() === "") e.push({ g: "段位奖励", msg: "段位「" + (g.name || g.id) + "」奖励说明为空" });
    });
    const n = state.narrative || {};
    if (!String((n.prologue || {}).text || "").trim()) e.push({ g: "叙事弹窗", msg: "开局序章文本为空" });
    if (!String((n.zeitgeist || {}).lead || "").trim()) e.push({ g: "叙事弹窗", msg: "当朝文风引导语为空" });
    if (!String((n.stageChange || {}).middle || "").trim()) e.push({ g: "叙事弹窗", msg: "阶段晋阶·中圈文案为空" });
    if (!String((n.stageChange || {}).inner || "").trim()) e.push({ g: "叙事弹窗", msg: "阶段晋阶·内圈文案为空" });
    if (!String((n.lap2Intro || {}).text || "").trim()) e.push({ g: "叙事弹窗", msg: "会试圈文案为空" });
    if (!String((((n.hiddenFinal || {}).invite || {}).text) || "").trim()) e.push({ g: "叙事弹窗", msg: "隐藏终圈·邀请文案为空" });
    if (!String((((n.hiddenFinal || {}).victory || {}).text) || "").trim()) e.push({ g: "叙事弹窗", msg: "隐藏终圈·胜利文案为空" });
    if (!String((((n.hiddenFinal || {}).defeat || {}).text) || "").trim()) e.push({ g: "叙事弹窗", msg: "隐藏终圈·失败文案为空" });
    return e;
  }

  /* ---------------- 渲染 ---------------- */
  function field(path, value, rows, placeholder) {
    const v = value == null ? "" : String(value);
    return `<textarea class="copy-field" data-path="${C.esc(path)}" rows="${rows || 2}" placeholder="${C.esc(placeholder || "")}">${C.esc(v)}</textarea>`;
  }
  function sideQuestNpcCopyField(npcId, fieldName, value, rows, placeholder) {
    const v = value == null ? "" : String(value);
    return `<textarea class="copy-field sidequest-npc-copy-field" data-sidequest-npc-id="${C.esc(npcId)}" data-sidequest-field="${C.esc(fieldName)}" rows="${rows || 1}" placeholder="${C.esc(placeholder || "")}">${C.esc(v)}</textarea>`;
  }
  function sideQuestNpcCopyEntries() {
    if (!global.NPC || typeof global.NPC.getSideQuestNpcCopy !== "function") return [];
    return global.NPC.getSideQuestNpcCopy();
  }

  function renderStats() {
    const el = document.getElementById("copyStatStrip");
    if (!el) return;
    const issues = validateAll().length;
    const sideQuestNpcs = sideQuestNpcCopyEntries();
    el.innerHTML =
      `<div class="stat"><b>${state.schools.length}</b><span>流派文案</span></div>` +
      `<div class="stat"><b>${(state.grades.grades || []).length}</b><span>段位档</span></div>` +
      `<div class="stat"><b>${Object.keys(state.grades.comments || {}).length}</b><span>维度评语</span></div>` +
      `<div class="stat"><b>5</b><span>叙事弹窗组</span></div>` +
      `<div class="stat"><b>${sideQuestNpcs.length}</b><span>支线 NPC 文案</span></div>` +
      `<div class="stat"><b>${issues}</b><span>校验问题</span></div>`;
  }

  function renderList() {
    renderStats();
    const list = document.getElementById("copylist");
    if (!list) return;
    const q = (document.getElementById("copyFSearch") ? document.getElementById("copyFSearch").value : "").trim().toLowerCase();

    const html = [];

    /* —— 流派文案 —— */
    const schoolCards = state.schools.map((s, i) => {
      const txt = [s.name, s.motto, s.flavor, s.desc].join(" ");
      return `
      <div class="q-card">
        <div class="meta"><span class="q-id">${C.esc(s.id)}</span><span class="badge r-common">${C.esc(s.name)}</span></div>
        <div class="q-main">
          <label class="copy-lbl">流派名（显示）</label>${field("schools." + i + ".name", s.name, 1, "流派名")}
          <label class="copy-lbl">口号 motto</label>${field("schools." + i + ".motto", s.motto, 1, "一句口号")}
          <label class="copy-lbl">沉浸叙事 flavor（第二人称为「你」，游戏内替换名号）</label>${field("schools." + i + ".flavor", s.flavor, 3, "第二人称沉浸式叙事")}
          <label class="copy-lbl">玩法说明 desc</label>${field("schools." + i + ".desc", s.desc, 2, "玩法与数据说明")}
        </div>
      </div>`;
    }).filter(card => !q || true);
    if (!q || "流派文案".includes(q) || state.schools.some(s => [s.name, s.motto, s.flavor, s.desc].join(" ").toLowerCase().includes(q)))
      html.push(`<h4 class="copy-group">流派文案（schools.json）</h4>` + (schoolCards.join("") || `<div class="empty">无流派</div>`));

    /* —— 段位评语（comments） —— */
    const comments = state.grades.comments || {};
    const dimNames = {
      wencai: "文采分", gongli: "功力分", zhanji: "战绩分", qiyu: "奇遇分", liupai: "流派分", yuanman: "圆满分"
    };
    const commentCards = Object.keys(comments).map(k =>
      `<div class="q-card"><div class="meta"><span class="q-id">${C.esc(k)}</span><span class="badge r-common">${C.esc(dimNames[k] || k)}最高评语</span></div>` +
      `<div class="q-main"><label class="copy-lbl">评语（结算时该维度最高显示）</label>${field("grades.comments." + k, comments[k], 2, "如：锦心绣口，落笔成章")}</div></div>`
    );
    if (!q || "段位评语".includes(q) || Object.keys(comments).some(k => (dimNames[k] || k).toLowerCase().includes(q) || String(comments[k]).toLowerCase().includes(q)))
      html.push(`<h4 class="copy-group">段位评语（grades.comments · 六维度最高评语）</h4>` + (commentCards.join("") || `<div class="empty">无评语</div>`));

    /* —— 段位档（grades[].name/reward） —— */
    const gradeCards = (state.grades.grades || []).map((g, i) =>
      `<div class="q-card"><div class="meta"><span class="q-id">${C.esc(g.id)}</span><span class="badge r-common">${C.esc(g.name)}</span><span class="t">${g.min}~${g.max == null ? "∞" : g.max}</span></div>` +
      `<div class="q-main"><label class="copy-lbl">段位名（显示）</label>${field("grades.grades." + i + ".name", g.name, 1, "如：童生")}` +
      `<label class="copy-lbl">奖励说明 reward</label>${field("grades.grades." + i + ".reward", g.reward, 1, "如：「书生」头像框")}</div></div>`
    );
    if (!q || "段位奖励".includes(q) || (state.grades.grades || []).some(g => [g.name, g.reward].join(" ").toLowerCase().includes(q)))
      html.push(`<h4 class="copy-group">段位档（grades.grades · 显示名与奖励说明）</h4>` + (gradeCards.join("") || `<div class="empty">无段位</div>`));

    /* —— 评分文案（维度名 / 加成名+说明 / 流派分档 / 特殊规则） —— */
    const dimHtml = (state.grades.dimensions || []).map((d, di) => {
      const head = `<div class="q-card"><div class="meta"><span class="q-id">${C.esc(d.key)}</span><span class="badge r-common">维度</span></div>` +
        `<div class="q-main"><label class="copy-lbl">维度名（显示）</label>${field("grades.dimensions." + di + ".name", d.name, 1, "如：文采分")}`;
      const bon = (d.bonuses || []).map((b, bi) =>
        `<label class="copy-lbl">加成「${C.esc(b.id)}」名称</label>${field("grades.dimensions." + di + ".bonuses." + bi + ".name", b.name, 1, "如：三绝均衡")}` +
        `<label class="copy-lbl">加成「${C.esc(b.id)}」说明</label>${field("grades.dimensions." + di + ".bonuses." + bi + ".desc", b.desc, 2, "玩家可见的加成描述")}`
      ).join("");
      let extra = "";
      if (d.key === "liupai") {
        extra = (d.tiers || []).map((t, ti) =>
          `<label class="copy-lbl">流派分档「${C.esc(t.id)}」名称</label>${field("grades.dimensions." + di + ".tiers." + ti + ".name", t.name, 1, "如：诗仙")}` +
          `<label class="copy-lbl">流派分档「${C.esc(t.id)}」说明</label>${field("grades.dimensions." + di + ".tiers." + ti + ".desc", t.desc, 2, "玩家可见的档位描述")}`
        ).join("");
      }
      if (d.key === "yuanman") {
        extra += (d.specialRules || []).map((r, ri) =>
          `<label class="copy-lbl">特殊规则「${C.esc(r.id)}」说明</label>${field("grades.dimensions." + di + ".specialRules." + ri + ".desc", r.desc, 2, "玩家可见的规则描述")}`
        ).join("");
      }
      return head + bon + extra + `</div></div>`;
    });
    if (!q || "评分文案".includes(q) || (state.grades.dimensions || []).some(d =>
      [d.name].concat((d.bonuses || []).map(b => b.name + " " + b.desc)).join(" ").toLowerCase().includes(q)))
      html.push(`<h4 class="copy-group">评分文案（grades.dimensions · 维度名 / 加成名+说明 / 流派分档 / 特殊规则）</h4>` + (dimHtml.join("") || `<div class="empty">无评分维度</div>`));

    /* —— 叙事弹窗文案（narrative.json · 开局/阶段切换） —— */
    const N = state.narrative || {};
    const nv = (s) => s && typeof s === "object"
      ? Object.values(s).map(v => v && typeof v === "object" ? nv(v) : String(v || "")).join(" ")
      : String(s || "");
    const nvNames = (N.stageChange && N.stageChange.names) || {};
    const narrativeMatch = !q || "叙事弹窗".includes(q) || "开局".includes(q) || "阶段切换".includes(q) || "序章".includes(q) || "文风".includes(q) || "晋阶".includes(q) || "会试圈".includes(q) || "隐藏终圈".includes(q) || "桃源".includes(q)
      || [N.prologue, N.zeitgeist, N.stageChange, N.lap2Intro, N.hiddenFinal].some(s => s && nv(s).toLowerCase().includes(q))
      || Object.values(nvNames).join(" ").toLowerCase().includes(q);
    if (narrativeMatch) {
      const prologueCard = `
        <div class="q-card"><div class="meta"><span class="q-id">prologue</span><span class="badge r-common">开局序章</span></div><div class="q-main">
          <label class="copy-lbl">标题</label>${field("narrative.prologue.title", N.prologue && N.prologue.title, 1, "初入科场")}
          <label class="copy-lbl">正文（第二人称为「你」，游戏内替换名号）</label>${field("narrative.prologue.text", N.prologue && N.prologue.text, 6, "序章叙事全文")}
          <label class="copy-lbl">确认按钮文案</label>${field("narrative.prologue.button", N.prologue && N.prologue.button, 1, "踏上征途")}
        </div></div>`;
      const zeitgeistCard = `
        <div class="q-card"><div class="meta"><span class="q-id">zeitgeist</span><span class="badge r-common">当朝文风（开局前）</span></div><div class="q-main">
          <label class="copy-lbl">角标 kind</label>${field("narrative.zeitgeist.kind", N.zeitgeist && N.zeitgeist.kind, 1, "当 朝 文 风")}
          <label class="copy-lbl">标题</label>${field("narrative.zeitgeist.title", N.zeitgeist && N.zeitgeist.title, 1, "风 潮 既 起")}
          <label class="copy-lbl">引导语 lead</label>${field("narrative.zeitgeist.lead", N.zeitgeist && N.zeitgeist.lead, 2, "本局科场，文运所钟于二事…")}
          <label class="copy-lbl">备注 note</label>${field("narrative.zeitgeist.note", N.zeitgeist && N.zeitgeist.note, 2, "若某场题目恰为热点题材…")}
          <label class="copy-lbl">确认按钮文案</label>${field("narrative.zeitgeist.button", N.zeitgeist && N.zeitgeist.button, 1, "谨记于心")}
        </div></div>`;
      const scNames = (N.stageChange && N.stageChange.names) || {};
      const stageCard = `
        <div class="q-card"><div class="meta"><span class="q-id">stageChange</span><span class="badge r-common">阶段晋阶（阶段切换）</span></div><div class="q-main">
          <label class="copy-lbl">角标 kind</label>${field("narrative.stageChange.kind", N.stageChange && N.stageChange.kind, 1, "科 场 叙 事")}
          <label class="copy-lbl">阶段名·秀才</label>${field("narrative.stageChange.names.xiucai", scNames.xiucai, 1, "秀才")}
          <label class="copy-lbl">阶段名·举人</label>${field("narrative.stageChange.names.juren", scNames.juren, 1, "举人")}
          <label class="copy-lbl">阶段名·进士</label>${field("narrative.stageChange.names.jinshi", scNames.jinshi, 1, "进士")}
          <label class="copy-lbl">标题模板（{name} 自动替换为阶段名）</label>${field("narrative.stageChange.titleTpl", N.stageChange && N.stageChange.titleTpl, 1, "{name}阶段 · 晋阶试")}
          <label class="copy-lbl">按钮模板（{name} 自动替换）</label>${field("narrative.stageChange.buttonTpl", N.stageChange && N.stageChange.buttonTpl, 1, "进入{name}阶段")}
          <label class="copy-lbl">基础功名已立（默认文案）</label>${field("narrative.stageChange.default", N.stageChange && N.stageChange.default, 2, "基础功名已立…")}
          <label class="copy-lbl">外圈→中圈文案（middle）</label>${field("narrative.stageChange.middle", N.stageChange && N.stageChange.middle, 2, "外圈的试炼已尽…")}
          <label class="copy-lbl">中圈→内圈文案（inner）</label>${field("narrative.stageChange.inner", N.stageChange && N.stageChange.inner, 2, "中圈的取舍已经定稿…")}
        </div></div>`;
      const lap2Card = `
        <div class="q-card"><div class="meta"><span class="q-id">lap2Intro</span><span class="badge r-common">会试圈（阶段切换）</span></div><div class="q-main">
          <label class="copy-lbl">标题</label>${field("narrative.lap2Intro.title", N.lap2Intro && N.lap2Intro.title, 1, "会试圈 · 再入科场")}
          <label class="copy-lbl">正文</label>${field("narrative.lap2Intro.text", N.lap2Intro && N.lap2Intro.text, 5, "童生圈的试炼渐远…")}
          <label class="copy-lbl">确认按钮文案</label>${field("narrative.lap2Intro.button", N.lap2Intro && N.lap2Intro.button, 1, "进入会试圈")}
        </div></div>`;
      const H = N.hiddenFinal || {};
      const I = H.invite || {}, V = H.victory || {}, D = H.defeat || {};
      const hiddenCard = `
        <div class="q-card"><div class="meta"><span class="q-id">hiddenFinal</span><span class="badge r-common">隐藏终圈（邀请 / 胜负结局）</span></div><div class="q-main">
          <label class="copy-lbl">邀请·角标 kind</label>${field("narrative.hiddenFinal.invite.kind", I.kind, 1, "桃 源 终 卷")}
          <label class="copy-lbl">邀请·标题</label>${field("narrative.hiddenFinal.invite.title", I.title, 1, "金榜之外，尚有一问")}
          <label class="copy-lbl">邀请·正文</label>${field("narrative.hiddenFinal.invite.text", I.text, 6, "隐藏终圈邀请文案")}
          <label class="copy-lbl">邀请·进入按钮</label>${field("narrative.hiddenFinal.invite.enterButton", I.enterButton, 1, "循花入终圈")}
          <label class="copy-lbl">邀请·拒绝按钮</label>${field("narrative.hiddenFinal.invite.declineButton", I.declineButton, 1, "止步金榜")}
          <label class="copy-lbl">胜利·角标 kind</label>${field("narrative.hiddenFinal.victory.kind", V.kind, 1, "桃 花 仙 人")}
          <label class="copy-lbl">胜利·标题</label>${field("narrative.hiddenFinal.victory.title", V.title, 1, "此心已过万重山")}
          <label class="copy-lbl">胜利·正文</label>${field("narrative.hiddenFinal.victory.text", V.text, 7, "战胜陈之微后的终章")}
          <label class="copy-lbl">胜利·按钮</label>${field("narrative.hiddenFinal.victory.button", V.button, 1, "携一枝桃花归去")}
          <label class="copy-lbl">失败·角标 kind</label>${field("narrative.hiddenFinal.defeat.kind", D.kind, 1, "桃 源 留 问")}
          <label class="copy-lbl">失败·标题</label>${field("narrative.hiddenFinal.defeat.title", D.title, 1, "终卷未竟")}
          <label class="copy-lbl">失败·正文</label>${field("narrative.hiddenFinal.defeat.text", D.text, 6, "终圈失败但保留金榜的文案")}
          <label class="copy-lbl">失败·按钮</label>${field("narrative.hiddenFinal.defeat.button", D.button, 1, "记下此问")}
        </div></div>`;
      html.push(`<h4 class="copy-group">叙事弹窗文案（narrative.json · 开局 / 阶段 / 隐藏终圈）</h4>`
        + prologueCard + zeitgeistCard + stageCard + lap2Card + hiddenCard);
    }

    /* —— 支线 NPC 文案（与 NPC 编辑器共享 sidequest-npcs 数据源） —— */
    const sideQuestNpcs = sideQuestNpcCopyEntries();
    const sideQuestMatch = !q || "支线NPC角色文案姓名称号介绍".includes(q)
      || sideQuestNpcs.some(npc => [npc.id, npc.name, npc.title, npc.text].join(" ").toLowerCase().includes(q));
    if (sideQuestMatch) {
      const cards = sideQuestNpcs.map(npc => `
        <div class="q-card"><div class="meta"><span class="q-id">${C.esc(npc.id)}</span><span class="badge r-common">支线 NPC</span></div><div class="q-main">
          <label class="copy-lbl">姓名</label>${sideQuestNpcCopyField(npc.id, "name", npc.name, 1, "角色姓名")}
          <label class="copy-lbl">身份／称号</label>${sideQuestNpcCopyField(npc.id, "title", npc.title, 1, "如：江湖名士")}
          <label class="copy-lbl">角色介绍（同步至 NPC 编辑器与支线配置）</label>${sideQuestNpcCopyField(npc.id, "text", npc.text, 3, "玩家可见的角色介绍")}
        </div></div>`).join("");
      html.push(`<h4 class="copy-group">支线 NPC 文案（sidequest-npcs.json · 与 NPC 编辑器实时同步）</h4>` + (cards || `<div class="empty">支线 NPC 配置尚未载入</div>`));
    }

    list.innerHTML = html.join("");
  }

  /* ---------------- 导出 / 导入 ---------------- */
  function download(filename, data) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function exportSchoolsRaw() { return clone(state.schools); }
  function exportGradesRaw() { return clone(state.grades); }
  function exportNarrativeRaw() { return clone(state.narrative); }

  function exportSchools() {
    const bad = validateAll().filter(x => x.g === "流派文案");
    if (bad.length && !confirm("流派文案存在 " + bad.length + " 处空值，仍要导出 schools.json 吗？")) return;
    download("schools.json", exportSchoolsRaw());
    C.toast("已导出 schools.json");
  }
  function exportGrades() {
    download("grades.json", exportGradesRaw());
    C.toast("已导出 grades.json");
  }
  function exportNarrative() {
    download("narrative.json", exportNarrativeRaw());
    C.toast("已导出 narrative.json");
  }

  function importData(data, mode) {
    if (!data || typeof data !== "object") return;
    const schools = data.schools, grades = data.grades, narrative = data.narrative;
    if (Array.isArray(schools)) {
      const incoming = schools.map(normalizeSchool);
      if (mode) state.schools = incoming;
      else {
        const map = new Map(state.schools.map((s, i) => [s.id, i]));
        incoming.forEach(s => { if (map.has(s.id)) state.schools[map.get(s.id)] = s; else state.schools.push(s); });
      }
    }
    if (grades && typeof grades === "object") {
      state.grades = mode ? normalizeGrades(grades) : deepMerge(clone(state.grades), normalizeGrades(grades));
    }
    if (narrative && typeof narrative === "object") {
      state.narrative = mode ? normalizeNarrative(narrative) : deepMerge(clone(state.narrative), normalizeNarrative(narrative));
    }
    save();
    renderList();
  }

  function importFile(kind) {
    const input = document.getElementById(
      kind === "schools" ? "copySchoolsFile" : kind === "grades" ? "copyGradesFile" : "copyNarrativeFile");
    if (!input) return;
    input.click();
  }

  function handleFile(kind, file) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        let data, label;
        if (kind === "schools") { data = { schools: Array.isArray(d) ? d : (d.schools || []) }; label = "流派"; }
        else if (kind === "grades") { data = { grades: Array.isArray(d) ? (d.grades ? d : {}) : d }; label = "段位/评分"; }
        else { data = { narrative: (d && typeof d === "object" && !Array.isArray(d)) ? d : (d.narrative || {}) }; label = "叙事弹窗"; }
        const mode = confirm("确定=替换当前" + label + "文案；取消=按 ID/键合并");
        importData(data, mode);
        C.toast(label + "文案已导入");
      } catch (x) { alert("JSON 解析失败：" + x.message); }
    };
    r.readAsText(file);
  }

  function resetDefault() {
    if (!confirm("重置为默认种子（清空本机编辑，重新载入 schools/grades/narrative 默认文案）？")) return;
    state.schools = (window.GAME_SCHOOLS || []).map(normalizeSchool);
    state.grades = normalizeGrades(window.GAME_GRADES || {});
    state.narrative = normalizeNarrative(window.GAME_NARRATIVE || {});
    C.store("copy_schools", state.schools);
    C.store("copy_grades", state.grades);
    C.store("copy_narrative", state.narrative);
    renderList();
    C.toast("已重置为默认文案");
  }

  /* ---------------- 初始化 ---------------- */
  let saveTimer;
  function bind() {
    const list = document.getElementById("copylist");
    if (list) list.addEventListener("input", e => {
      const t = e.target;
      if (t && t.dataset && t.dataset.sidequestNpcId) {
        if (global.NPC && typeof global.NPC.updateSideQuestNpcCopy === "function") {
          global.NPC.updateSideQuestNpcCopy(t.dataset.sidequestNpcId, t.dataset.sidequestField, t.value, true);
        }
        return;
      }
      if (t && t.dataset && t.dataset.path) {
        setByPath(state, t.dataset.path, t.value);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(save, 400);
      }
    });
    const search = document.getElementById("copyFSearch");
    if (search) search.addEventListener("input", renderList);
    const bS = document.getElementById("copyBtnExportSchools"); if (bS) bS.addEventListener("click", exportSchools);
    const bG = document.getElementById("copyBtnExportGrades"); if (bG) bG.addEventListener("click", exportGrades);
    const bN = document.getElementById("copyBtnExportNarrative"); if (bN) bN.addEventListener("click", exportNarrative);
    const bStats = document.getElementById("copyBtnStats"); if (bStats) bStats.addEventListener("click", () => {
      const n = validateAll().length; C.toast("校验问题：" + n); renderStats();
    });
    const bReset = document.getElementById("copyBtnReset"); if (bReset) bReset.addEventListener("click", resetDefault);
    const bIS = document.getElementById("copyBtnImportSchools"); if (bIS) bIS.addEventListener("click", () => importFile("schools"));
    const bIG = document.getElementById("copyBtnImportGrades"); if (bIG) bIG.addEventListener("click", () => importFile("grades"));
    const bIN = document.getElementById("copyBtnImportNarrative"); if (bIN) bIN.addEventListener("click", () => importFile("narrative"));
    const fS = document.getElementById("copySchoolsFile"); if (fS) fS.addEventListener("change", e => { if (e.target.files[0]) { handleFile("schools", e.target.files[0]); e.target.value = ""; } });
    const fG = document.getElementById("copyGradesFile"); if (fG) fG.addEventListener("change", e => { if (e.target.files[0]) { handleFile("grades", e.target.files[0]); e.target.value = ""; } });
    const fN = document.getElementById("copyNarrativeFile"); if (fN) fN.addEventListener("change", e => { if (e.target.files[0]) { handleFile("narrative", e.target.files[0]); e.target.value = ""; } });
  }

  function init() {
    loadData();
    bind();
    renderList();
    state._ready = true;
    global.COPY._ready = true;
  }

  global.COPY = {
    init, get: () => ({ schools: state.schools, grades: state.grades, narrative: state.narrative }),
    exportSchoolsRaw, exportGradesRaw, exportNarrativeRaw, validateAll, importData, renderList, _ready: false
  };
})(window);
