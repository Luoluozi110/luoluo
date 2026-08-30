/* =========================================================================
 * common.js — 题库编辑器 & 奇遇编辑器 共享基础
 * 职责：存储命名空间、转义、提示、弹窗开关、导航切换、奇遇需要的枚举与
 *       文心映射、以及「数据管理」统一面板（总览 + 合并导入/导出）。
 * 两个编辑器模块都依赖本文件，须在 qbank.js / adventure.js 之前加载。
 * ========================================================================= */
(function (global) {
  "use strict";

  const PREFIX = "feihua_editors_v1_";
  // 由 index.html 注入并随 config -> seed -> 云端基准同步递增；旧编辑器页面会因此被桥接层识别为过期。
  const CONTENT_VERSION = Math.max(1, Number(global.GAME_CONTENT_VERSION) || 1);
  const DATA_STORAGE_KEYS = ["qbank", "events", "talents", "npcs", "sidequest_npcs", "affinity", "synergies", "board", "sky", "album", "copy_schools", "copy_grades", "copy_narrative"];
  const DATA_VERSION_KEY = "contentVersion";
  let legacyStorageDetected = false;
  const MODULES = [
    { tab: "qbank", label: "题库", api: "QB" },
    { tab: "adv", label: "奇遇", api: "ADV" },
    { tab: "tal", label: "文心", api: "TALENT" },
    { tab: "npc", label: "NPC", api: "NPC" },
    { tab: "sidequest-npc", label: "支线 NPC", api: "SIDEQUEST_NPC" },
    { tab: "aff", label: "相性", api: "AFFINITY" },
    { tab: "syn", label: "羁绊", api: "SYNERGY" },
    { tab: "board", label: "地图", api: "BOARD" },
    { tab: "sky", label: "天象", api: "SKY" },
    { tab: "album", label: "传世名篇", api: "ALBUM" },
    { tab: "copy", label: "叙事文案", api: "COPY" }
  ];
  const TAB_TOOLS = {
    qbank: { add: "btnAdd", search: "fSearch", noun: "题目" },
    adv: { add: "evBtnAdd", search: "evFSearch", noun: "奇遇" },
    tal: { add: "talBtnAdd", search: "talFSearch", noun: "文心" },
    npc: { add: "npcBtnAddTier", search: "npcFSearch", noun: "对手档" },
    "sidequest-npc": { search: "sideNpcFSearch", noun: "支线 NPC" },
    aff: { search: "affBtnPreview", noun: "相性矩阵" },
    syn: { add: "synBtnAdd", search: "synFSearch", noun: "羁绊" },
    board: { add: "boardBtnAdd", search: "boardFSearch", noun: "格子" },
    sky: { add: "skyBtnAdd", search: "skyFSearch", noun: "天象" },
    album: { add: "albumBtnAdd", search: "albumFSearch", noun: "名篇" },
    copy: { search: "copyFSearch", noun: "叙事文案" }
  };
  const commandState = { items: [], index: 0 };

  /* ---------------- 存储 ---------------- */
  function store(key, val) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(val));
      // 旧缓存迁移期间不抬高来源版本；必须先从云端拉取或显式确认后才解除发布护栏。
      if (DATA_STORAGE_KEYS.includes(key) && !legacyStorageDetected && !localStorage.getItem(PREFIX + DATA_VERSION_KEY)) {
        localStorage.setItem(PREFIX + DATA_VERSION_KEY, String(CONTENT_VERSION));
      }
      return true;
    }
    catch (e) { return false; }
  }
  function load(key, fallback) {
    try {
      const r = localStorage.getItem(PREFIX + key);
      return r ? JSON.parse(r) : fallback;
    } catch (e) { return fallback; }
  }
  function detectLegacyStorage() {
    let version = 0;
    try { version = Number(localStorage.getItem(PREFIX + DATA_VERSION_KEY)) || 0; } catch (_) {}
    let hasData = false;
    try { hasData = DATA_STORAGE_KEYS.some(key => !!localStorage.getItem(PREFIX + key)); } catch (_) {}
    legacyStorageDetected = hasData && version < CONTENT_VERSION;
    return legacyStorageDetected;
  }
  function localDataVersion() {
    try { return Number(localStorage.getItem(PREFIX + DATA_VERSION_KEY)) || 0; } catch (_) { return 0; }
  }
  function markCurrentDataVersion(version = CONTENT_VERSION) {
    try { localStorage.setItem(PREFIX + DATA_VERSION_KEY, String(Math.max(CONTENT_VERSION, Number(version) || CONTENT_VERSION))); } catch (_) {}
    legacyStorageDetected = false;
  }
  function currentProjectVersion() {
    return Math.max(CONTENT_VERSION, localDataVersion());
  }
  function effectiveProjectVersion(version) {
    return Math.max(CONTENT_VERSION, localDataVersion(), Number(version) || 0);
  }
  function hasStaleStorage() { return legacyStorageDetected || localDataVersion() < CONTENT_VERSION; }
  /* 旧版题库单机文件迁移：若新版 key 为空且旧 key 存在，则搬过来 */
  function migrateQbankIfNeeded() {
    const NEWK = PREFIX + "qbank";
    if (localStorage.getItem(NEWK)) return;
    const old = localStorage.getItem("feihuaqi_qbank_v1");
    if (old) { try { localStorage.setItem(NEWK, old); } catch (e) {} }
  }

  /* ---------------- 基础工具 ---------------- */
  const isObj = value => !!value && typeof value === "object" && !Array.isArray(value);
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, m =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  function getFocusable(root) {
    return [...root.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .filter(el => el.offsetParent !== null);
  }
  function getTopOverlay() {
    const shown = [...document.querySelectorAll(".overlay.show")];
    return shown.length ? shown[shown.length - 1] : null;
  }
  function openOverlay(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el._returnFocus = document.activeElement;
    el.classList.add("show");
    document.body.classList.add("modal-open");
    setTimeout(() => {
      const auto = el.querySelector("[autofocus]");
      const target = auto || getFocusable(el)[0];
      if (target && typeof target.focus === "function") target.focus();
    }, 0);
  }
  function closeOverlay(id) {
    const el = document.getElementById(id);
    if (!el || !el.classList.contains("show")) return;
    el.classList.remove("show");
    if (!document.querySelector(".overlay.show")) document.body.classList.remove("modal-open");
    const returnFocus = el._returnFocus;
    if (returnFocus && returnFocus.isConnected && typeof returnFocus.focus === "function") returnFocus.focus();
  }

  /* ---------------- 枚举（与游戏 rules.js / config 对齐） ---------------- */
  const ATTR = { shi: "诗力", ci: "词力", lian: "联力", bi: "笔力", xue: "学力", si: "思力" };
  const ATTR_KEYS = ["shi", "ci", "lian", "bi", "xue", "si"];
  const CATEGORY = { shi: "诗", ci: "词", lian: "联", mix: "综合", xue: "学力" };
  /* 珍稀度 / 品质 统一为 4 档（普通/稀有/史诗/传说），文心升级系统 quality 与奇遇 rarity 共用此词汇。
     注意：升级系统的品质档决定 maxLevel 与 upCost 基准（见 QUALITY_MAX / QUALITY_UPCOST）。 */
  const RARITY = { common: "普通", rare: "稀有", epic: "史诗", legend: "传说" };
  const QUALITY = RARITY;
  const QUALITY_MAX = { common: 3, rare: 4, epic: 5, legend: 6 };
  const QUALITY_UPCOST = { common: [6, 10], rare: [7, 11, 16], epic: [8, 12, 17, 23], legend: [9, 13, 18, 24, 31] };
  const KIND = { direct: "直接生效", choice: "抉择", challenge: "挑战" };

  /* 文心清单（id -> 名称），用于奇遇效果中引用文心的下拉提示与名称显示 */
  const TALENTS = {
    "T001": "斗酒诗百篇", "T002": "倚声填词", "T003": "对对如流", "T004": "博览",
    "T005": "急智", "T006": "入木三分", "T007": "梦笔生花", "T008": "推敲",
    "T009": "囊萤映雪", "T010": "天马行空", "T011": "知人论世", "T012": "李杜文章",
    "T013": "凡有井水处", "T014": "铁板铜琶", "T015": "不平则鸣", "T016": "文思泉涌",
    "T017": "春风得意", "T018": "曲水流觞", "T019": "洛阳纸贵",
    "T020": "诗骨嶙峋", "T021": "咏物通灵", "T022": "一鼓作气", "T023": "退笔成冢",
    "T024": "六六大顺", "T025": "破釜沉舟", "T026": "学富五车", "T027": "转益多师",
    "T028": "金殿对策", "T029": "胸有成竹", "T030": "活水源头", "T031": "枯木逢春",
    "T032": "蓄水成渊", "T033": "海纳百川", "T034": "照我传灯", "T035": "删繁就简",
    "T036": "字字珠玑", "T037": "触类旁通", "T038": "落笔成章", "T039": "同声相应", "T040": "妙手偶得",
    "T099": "三元及第", "TA01": "七步成诗", "TA02": "夺胎换骨", "TA03": "语不惊人",
    "TA04": "笔落惊风雨", "TA05": "一气呵成", "TA06": "倚马可待", "TA07": "点铁成金", "TA08": "布局谋篇"
  };
  const TALENT_IDS = Object.keys(TALENTS);

  /* ---------------- 导航切换 ---------------- */
  function switchTab(tab) {
    store("tab", tab);
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    const sec = document.getElementById(tab + "-section");
    if (sec) sec.classList.add("active");
    document.querySelectorAll(".nav button").forEach(b => {
      b.classList.toggle("active", b.dataset.tab === tab);
      if (b.dataset.tab === tab) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    const sb = document.getElementById("saveStatus");
    if (sb) {
      const status = load(tab + "_status", "");
      sb.textContent = status || "";
    }
    // 切到对应编辑器时刷新其列表（题目/奇遇/文心数可能变动）；仅在编辑器已初始化后
    if (tab === "qbank" && global.QB && global.QB._ready) global.QB.renderList();
    if (tab === "adv" && global.ADV && global.ADV._ready) global.ADV.renderList();
    if (tab === "tal" && global.TALENT && global.TALENT._ready) global.TALENT.renderList();
    if (tab === "npc" && global.NPC && global.NPC._ready) global.NPC.renderList();
    if (tab === "sidequest-npc" && global.SIDEQUEST_NPC && global.SIDEQUEST_NPC._ready) global.SIDEQUEST_NPC.renderList();
    if (tab === "aff" && global.AFFINITY && global.AFFINITY._ready) global.AFFINITY.renderList();
    if (tab === "syn" && global.SYNERGY && global.SYNERGY._ready) global.SYNERGY.renderList();
    if (tab === "board" && global.BOARD && global.BOARD._ready) global.BOARD.renderList();
    if (tab === "sky" && global.SKY && global.SKY._ready) global.SKY.renderList();
    if (tab === "album" && global.ALBUM && global.ALBUM._ready) global.ALBUM.renderList();
    if (tab === "copy" && global.COPY && global.COPY._ready) global.COPY.renderList();
    updateWorkspaceSummary();
  }

  /* 记录某编辑器最近保存时间，写进共享状态条 */
  function setStatus(tab, text) {
    store(tab + "_status", text);
    if (document.querySelector(".section.active") &&
        document.querySelector(".section.active").id === tab + "-section") {
      const sb = document.getElementById("saveStatus");
      if (sb) sb.textContent = text;
    }
    updateWorkspaceSummary();
  }

  function activeTab() {
    const active = document.querySelector(".nav button.active");
    return active ? active.dataset.tab : "qbank";
  }

  function moduleCount(module) {
    const api = global[module.api];
    if (!api || !api._ready || typeof api.get !== "function") return 0;
    try {
      const data = api.get();
      if (module.tab === "npc") return Array.isArray(data) ? data.reduce((sum, tier) => sum + ((tier.npcs || []).length), 0) : 0;
      if (module.tab === "sidequest-npc") return typeof api.count === "function" ? api.count() : 0;
      if (module.tab === "aff") return data && Array.isArray(data.manners) && Array.isArray(data.themes) ? data.manners.length * data.themes.length : 0;
      if (module.tab === "board") return data && Array.isArray(data.mainRing) ? data.mainRing.length : 0;
      if (module.tab === "copy") {
        const grades = data && data.grades ? data.grades : {};
        const narrative = data && data.narrative ? data.narrative : {};
        return ((data && data.schools) || []).length + (grades.grades || []).length + Object.keys(grades.comments || {}).length + Object.keys(narrative).length;
      }
      return Array.isArray(data) ? data.length : 0;
    } catch (error) { return 0; }
  }

  function getWorkspaceHealth() {
    const modules = MODULES.map(module => {
      const api = global[module.api];
      let issues = [];
      if (api && api._ready && typeof api.validateAll === "function") {
        try { issues = api.validateAll() || []; } catch (error) { issues = [error]; }
      }
      return { ...module, ready: !!(api && api._ready), count: moduleCount(module), issues: issues.length };
    });
    return {
      modules,
      ready: modules.filter(module => module.ready).length,
      total: modules.reduce((sum, module) => sum + module.count, 0),
      issues: modules.reduce((sum, module) => sum + module.issues, 0)
    };
  }

  function reviewWorkspace() {
    const health = getWorkspaceHealth();
    let contractError = "";
    try { buildProject(); } catch (error) { contractError = error && error.message ? error.message : String(error); }
    return { ...health, contractError, valid: health.issues === 0 && !contractError };
  }

  function updateWorkspaceSummary() {
    const el = document.getElementById("workspaceSummary");
    if (!el) return;
    const health = getWorkspaceHealth();
    if (health.ready < MODULES.length) {
      el.textContent = `正在载入 ${health.ready}/${MODULES.length} 个模块…`;
      return;
    }
    const issueText = health.issues ? `${health.issues} 项待处理` : "全部规则通过";
    el.classList.toggle("has-issues", health.issues > 0);
    el.innerHTML = `<strong>${health.total}</strong><span>条内容 · ${issueText}</span>`;
  }

  function refreshWorkspaceUI() { updateWorkspaceSummary(); }

  /* ---------------- 效果文本（与游戏事件卡一致，完整展示已配置收益） ---------------- */
  function effectBrief(ef) {
    if (!ef || !Object.keys(ef).length) return "";
    const p = [];
    const attrs = ef.attrs || {};
    for (const k of ATTR_KEYS) if (attrs[k]) p.push(`${ATTR[k]} ${attrs[k] > 0 ? "+" : ""}${attrs[k]}`);
    if (ef.inspiration) p.push(`灵感 ${ef.inspiration > 0 ? "+" : ""}${ef.inspiration}`);
    if (ef.inspirationMax) p.push(`灵感上限 +${ef.inspirationMax}`);
    if (ef.talent) p.push("获得文心");
    if (ef.item) p.push(`道具「${ef.item}」`);
    return p.join("　");
  }
  /* 完整效果明细（含属性），供编辑器预览/校验使用 */
  function effectDetail(ef) {
    if (!ef || !Object.keys(ef).length) return "（无效果）";
    const p = [];
    const attrs = ef.attrs || {};
    for (const k of ATTR_KEYS) if (attrs[k]) p.push(`${ATTR[k]} ${attrs[k] > 0 ? "+" : ""}${attrs[k]}`);
    if (ef.inspiration) p.push(`灵感 ${ef.inspiration > 0 ? "+" : ""}${ef.inspiration}`);
    if (ef.inspirationMax) p.push(`灵感上限 +${ef.inspirationMax}`);
    if (ef.talent) p.push(`文心：${TALENTS[ef.talent] || ef.talent}`);
    if (ef.item) p.push(`道具：${ef.item}`);
    return p.length ? p.join("　") : "（无效果）";
  }

  /* ---------------- 数据管理（统一面板） ---------------- */
  function showManagement() {
    const workspaceReview = reviewWorkspace();
    const Q = global.QB ? global.QB.get() : [];
    const E = global.ADV ? global.ADV.get() : [];
    const T = global.TALENT ? global.TALENT.get() : [];
    const N = global.NPC ? global.NPC.get() : [];
    const SN = global.SIDEQUEST_NPC ? global.SIDEQUEST_NPC.get() : null;
    const A = global.AFFINITY ? global.AFFINITY.get() : null;
    const S = global.SYNERGY ? global.SYNERGY.get() : [];
    const B = global.BOARD ? global.BOARD.get() : null;
    const qIssues = global.QB ? global.QB.validateAll() : [];
    const eIssues = global.ADV ? global.ADV.validateAll() : [];
    const tIssues = global.TALENT ? global.TALENT.validateAll() : [];
    const nIssues = global.NPC ? global.NPC.validateAll() : [];
    const snIssues = global.SIDEQUEST_NPC ? global.SIDEQUEST_NPC.validateAll() : [];
    const aIssues = global.AFFINITY ? global.AFFINITY.validateAll() : [];
    const sIssues = global.SYNERGY ? global.SYNERGY.validateAll() : [];
    const bIssues = global.BOARD ? global.BOARD.validateAll() : [];
    const K = global.SKY ? global.SKY.get() : [];
    const kIssues = global.SKY ? global.SKY.validateAll() : [];
    const L = global.ALBUM ? global.ALBUM.get() : [];
    const lIssues = global.ALBUM ? global.ALBUM.validateAll() : [];
    const CO = global.COPY ? global.COPY.get() : null;
    const cSchools = CO ? (CO.schools || []) : [];
    const cGrades = CO ? (CO.grades || {}) : {};
    const cIssues = global.COPY ? global.COPY.validateAll() : [];
    const cNarr = CO ? (CO.narrative || {}) : {};

    const qOn = Q.filter(q => q.enabled).length;
    const eByR = { common: 0, rare: 0, epic: 0, legend: 0 };
    const eByK = { direct: 0, choice: 0, challenge: 0 };
    let drafts = 0;
    E.forEach(e => {
      if (e.rarity && eByR[e.rarity] != null) eByR[e.rarity]++;
      if (e.kind && eByK[e.kind] != null) eByK[e.kind]++;
      if (e.draft) drafts++;
    });
    const eActive = E.length - drafts;
    const tPassive = T.filter(t => t.kind === "passive").length;

    const body = document.getElementById("mgmtBody");
    body.innerHTML = `
      <div class="workspace-health ${workspaceReview.valid ? "is-valid" : "has-issues"}">
        <div>
          <span class="brand-kicker">WORKSPACE HEALTH</span>
          <h4>${workspaceReview.valid ? "工程配置可交付" : "工程配置需要检查"}</h4>
          <p id="mgmtHealthResult">已载入 ${workspaceReview.ready}/${MODULES.length} 个模块，覆盖 ${workspaceReview.total} 条内容${workspaceReview.issues ? `；发现 ${workspaceReview.issues} 项模块校验问题` : "；模块校验通过"}${workspaceReview.contractError ? `；工程契约：${esc(workspaceReview.contractError)}` : ""}。</p>
        </div>
        <button class="btn ${workspaceReview.valid ? "" : "danger"}" id="mgmtValidate" type="button">运行全局校验</button>
      </div>
      <div class="mgmt-section">
        <h4>题库（知识题 / 创作抉择题）</h4>
        <table class="stat-table">
          <tr><th>题目总数</th><th>已启用</th><th>已禁用</th><th>校验问题</th></tr>
          <tr><td class="num">${Q.length}</td><td class="num">${qOn}</td><td class="num">${Q.length - qOn}</td>
              <td class="num">${qIssues.length ? `<span style="color:var(--bad)">${qIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>奇遇（按稀有度 / 类型）</h4>
        <table class="stat-table">
          <tr><th>奇遇总数</th><th>活跃</th><th>草稿</th><th>校验问题</th></tr>
          <tr><td class="num">${E.length}</td><td class="num">${eActive}</td><td class="num">${drafts}</td>
              <td class="num">${eIssues.length ? `<span style="color:var(--bad)">${eIssues.length}</span>` : "0"}</td></tr>
        </table>
        <table class="stat-table" style="margin-top:8px">
          <tr><th>稀有度</th><td>普通 ${eByR.common}</td><td>稀有 ${eByR.rare}</td><td>史诗 ${eByR.epic}</td><td>传说 ${eByR.legend}</td></tr>
          <tr><th>类型</th><td>直接 ${eByK.direct}</td><td>抉择 ${eByK.choice}</td><td>挑战 ${eByK.challenge}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>文心（被动 / 主动）</h4>
        <table class="stat-table">
          <tr><th>文心总数</th><th>被动</th><th>主动</th><th>校验问题</th></tr>
          <tr><td class="num">${T.length}</td><td class="num">${tPassive}</td><td class="num">${T.length - tPassive}</td>
              <td class="num">${tIssues.length ? `<span style="color:var(--bad)">${tIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>NPC（对手档 / 具名对手）</h4>
        <table class="stat-table">
          <tr><th>对手档</th><th>具名对手</th><th>殿试档</th><th>校验问题</th></tr>
          <tr><td class="num">${N.length}</td><td class="num">${N.reduce((s, t) => s + t.npcs.length, 0)}</td>
              <td class="num">${N.filter(t => t.isFinal).length}</td>
              <td class="num">${nIssues.length ? `<span style="color:var(--bad)">${nIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>支线 NPC（路线角色 / 高潮与终局）</h4>
        <table class="stat-table">
          <tr><th>支线路线</th><th>可编辑条目</th><th>稳定 ID</th><th>校验问题</th></tr>
          <tr><td class="num">${SN && SN.routes ? Object.keys(SN.routes).length : 0}</td>
              <td class="num">${global.SIDEQUEST_NPC && global.SIDEQUEST_NPC.count ? global.SIDEQUEST_NPC.count() : 0}</td>
              <td class="num">${global.SIDEQUEST_NPC && global.SIDEQUEST_NPC.count ? new Set(Object.values(SN.routes || {}).flatMap(route => [
                ...(route.guides || []), route.climax, ...Object.values((route.final && route.final.secondary) || {})
              ].map(npc => npc && npc.id).filter(Boolean))).size : 0}</td>
              <td class="num">${snIssues.length ? `<span style="color:var(--bad)">${snIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>相性（题材 × 文风 矩阵）</h4>
        <table class="stat-table">
          <tr><th>文风数</th><th>题材数</th><th>矩阵格数</th><th>校验问题</th></tr>
          <tr><td class="num">${A ? A.manners.length : 0}</td><td class="num">${A ? A.themes.length : 0}</td>
              <td class="num">${A ? A.manners.length * A.themes.length : 0}</td>
              <td class="num">${aIssues.length ? `<span style="color:var(--bad)">${aIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>文心羁绊（成员联动）</h4>
        <table class="stat-table">
          <tr><th>羁绊总数</th><th>成员关联总次数</th><th>含全局加成</th><th>校验问题</th></tr>
          <tr><td class="num">${S.length}</td><td class="num">${S.reduce((a, s) => a + (s.members || []).length, 0)}</td>
              <td class="num">${S.filter(s => (s.effects || []).some(e => e.type === "syn_pct")).length}</td>
              <td class="num">${sIssues.length ? `<span style="color:var(--bad)">${sIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>地图（主环 / 区段）</h4>
        <table class="stat-table">
          <tr><th>主环格数</th><th>圈数</th><th>区段数</th><th>校验问题</th></tr>
          <tr><td class="num">${B ? B.mainRing.length : 0}</td><td class="num">${B ? B.laps : 0}</td>
              <td class="num">${B ? B.sides.length : 0}</td>
              <td class="num">${bIssues.length ? `<span style="color:var(--bad)">${bIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>天象（名称 / 图标 / 效果）</h4>
        <table class="stat-table">
          <tr><th>天象总数</th><th>含图标</th><th>一次性（下场加成）</th><th>校验问题</th></tr>
          <tr><td class="num">${K.length}</td><td class="num">${K.filter(c => c.icon).length}</td>
              <td class="num">${K.filter(c => (c.effect || {}).type === "next_battle_pct").length}</td>
              <td class="num">${kIssues.length ? `<span style="color:var(--bad)">${kIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>传世名篇（解锁条件 / 奖励）</h4>
        <table class="stat-table">
          <tr><th>名篇总数</th><th>属性奖励</th><th>文心奖励</th><th>校验问题</th></tr>
          <tr><td class="num">${L.length}</td><td class="num">${L.filter(c => (c.reward || {}).type === "attr").length}</td>
              <td class="num">${L.filter(c => (c.reward || {}).type === "talent").length}</td>
              <td class="num">${lIssues.length ? `<span style="color:var(--bad)">${lIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>叙事文案（流派文案 / 段位评语 / 评分文案 / 开局·阶段弹窗）</h4>
        <table class="stat-table">
          <tr><th>流派文案</th><th>段位档</th><th>维度评语</th><th>叙事弹窗</th><th>校验问题</th></tr>
          <tr><td class="num">${cSchools.length}</td><td class="num">${(Array.isArray(cGrades.grades) ? cGrades.grades.length : 0)}</td>
              <td class="num">${Object.keys(cGrades.comments || {}).length}</td>
              <td class="num">${[cNarr.prologue, cNarr.zeitgeist, cNarr.stageChange, cNarr.lap2Intro, cNarr.hiddenFinal].filter(Boolean).length}</td>
              <td class="num">${cIssues.length ? `<span style="color:var(--bad)">${cIssues.length}</span>` : "0"}</td></tr>
        </table>
      </div>
      <div class="mgmt-section">
        <h4>统一操作</h4>
        <p style="font-size:12.5px;color:${hasStaleStorage() ? "var(--bad)" : "var(--mo-3)"};line-height:1.7;margin:4px 0 10px">
          ${hasStaleStorage() ? `检测到本机数据版本 ${localDataVersion() || "未知"} 低于当前种子版本 ${CONTENT_VERSION}。发布前请先从云端拉取，或在各模块使用“重置默认”后再编辑；系统会阻止旧版本覆盖新云端。` : `当前编辑器数据版本：${currentProjectVersion()}（页面种子 ${CONTENT_VERSION}）。`}
        </p>
        <p style="font-size:13px;color:var(--ink2);margin:4px 0 10px">
          合并导出会把题库、奇遇、文心、传世名篇、叙事文案（流派 / 段位 / 评分）等内容打包成一个工程文件（<code>feihua-content.json</code>），便于整体备份与迁移；
          合并导入会自动识别题库 / 奇遇 / 文心 / 传世名篇 / 叙事文案 / 工程文件并分别路由。
        </p>
        <p style="font-size:12.5px;color:var(--mo-3);line-height:1.7;margin-top:6px">
          ⤴ 想让线上游戏用上这里的改动？点「合并导出工程文件」下载 <code>feihua-content.json</code>，
          再到游戏菜单的 <b>「载入自定义配置（高级）」</b> 粘贴/上传该文件，<b>当前浏览器立即生效，无需重新部署</b>。
        </p>
        <div class="modal-actions" style="justify-content:flex-start">
          <button class="btn" id="mgmtMarkCurrent" title="仅在你已确认当前数据就是要发布的版本时使用">确认本机版本</button>
          <button class="btn primary" id="mgmtExport">合并导出工程文件</button>
          <button class="btn" id="mgmtImport">合并导入…</button>
          <input type="file" id="mgmtFile" accept=".json,application/json" style="display:none" />
        </div>
      </div>
      <div class="mgmt-section">
        <h4>云端同步（所有玩家自动同步）</h4>
        <p style="font-size:12.5px;color:var(--mo-3);line-height:1.7;margin:4px 0 10px">
          填好下方并点「发布到云端」，配置会被推送到你的 GitHub 仓库 / Gist；<br/>
          游戏端读取该地址后，<b>所有玩家启动时自动同步，无需手动载入</b>。不同网页入口会自动读取部署级云端地址；
          手动拉取始终以云端完整替换本地，任一模块不一致都会自动回滚。发布使用本机 <code>gh</code> 登录；请用 <code>npm run editor:bridge</code> 启动编辑器。
        </p>
        <div class="cloud-form">
          <label>方式
            <select id="cloudMode">
              <option value="repo">GitHub 仓库文件</option>
              <option value="gist">GitHub Gist（单文件）</option>
            </select>
          </label>
          <div id="cloudRepoFields">
            <label>仓库 <span class="hint">owner/repo 或完整链接</span>
              <input id="cloudRepo" placeholder="如 Luoluozi110/feihuaqi-content 或 https://github.com/..." /></label>
            <label>分支 <input id="cloudBranch" placeholder="main" value="main" /></label>
            <label>路径 <input id="cloudPath" placeholder="feihua-content.json" value="feihua-content.json" /></label>
          </div>
          <div id="cloudGistFields" style="display:none">
            <label>Gist ID <span class="hint">留空则新建</span>
              <input id="cloudGist" placeholder="（可选）已有 Gist 的 ID" /></label>
          </div>
          <div id="cloudBridgeStatus" style="font-size:12px;line-height:1.6;color:var(--mo-3)">
            正在检查本机 gh 发布桥接…
          </div>
          <div class="modal-actions" style="justify-content:flex-start;margin-top:8px">
            <button class="btn primary" id="cloudPublish">发布到云端</button>
            <button class="btn" id="cloudPull">从云端拉取</button>
            <button class="btn" id="cloudCopy" style="display:none">复制云端地址</button>
          </div>
          <div id="cloudMsg" style="font-size:12px;margin-top:8px;min-height:16px"></div>
          <div id="cloudUrlBox" style="font-size:12px;margin-top:6px;word-break:break-all;display:none">
            云端地址（填到游戏菜单「载入自定义配置 → 云端同步地址」，或写进游戏 config/cloud.json）：<br/>
            <code id="cloudUrl" style="color:var(--accent)"></code>
          </div>
        </div>
      </div>`;

    document.getElementById("mgmtMarkCurrent").addEventListener("click", () => {
      if (!confirm(`确认当前编辑器内容就是要发布的版本 ${CONTENT_VERSION}？\n\n确认后才允许覆盖同版本或更旧的云端工程。`)) return;
      markCurrentDataVersion();
      showManagement();
      toast(`已确认本机版本 ${CONTENT_VERSION}`);
    });
    document.getElementById("mgmtExport").addEventListener("click", exportProject);
    document.getElementById("mgmtImport").addEventListener("click", () =>
      document.getElementById("mgmtFile").click());
    document.getElementById("mgmtFile").addEventListener("change", e => {
      if (e.target.files[0]) importProject(e.target.files[0]);
      e.target.value = "";
    });
    document.getElementById("mgmtValidate").addEventListener("click", () => {
      const review = reviewWorkspace();
      const result = document.getElementById("mgmtHealthResult");
      const card = document.querySelector(".workspace-health");
      if (result) result.textContent = review.valid
        ? `全局校验通过：${review.total} 条内容与工程配置均符合当前规则。`
        : `校验发现 ${review.issues} 项模块问题${review.contractError ? `；工程契约：${review.contractError}` : ""}。请查看下方各模块的“校验问题”列。`;
      if (card) {
        card.classList.toggle("is-valid", review.valid);
        card.classList.toggle("has-issues", !review.valid);
      }
      updateWorkspaceSummary();
      toast(review.valid ? "全局校验通过" : "发现需要处理的配置问题");
    });
    wireCloudSync();

    openOverlay("mgmtOverlay");
  }

  /** 解析仓库输入框：支持 owner/repo、完整 GitHub 链接、带 .git 后缀 */
  function parseRepo(raw) {
    let v = (raw || "").trim().replace(/\.git$/, "");
    const m = v.match(/github\.com\/([^\/\s?#]+)\/([^\/\s?#]+)/i) || v.match(/raw\.githubusercontent\.com\/([^\/\s?#]+)\/([^\/\s?#]+)/i);
    if (m) return { owner: m[1].trim(), repo: m[2].trim() };
    const parts = v.split("/").map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    return { owner: "", repo: "" };
  }

  const PROJECT_FIELDS = [
    "_type", "_version", "questions", "events", "talents", "talent-upgrade", "npcs",
    "affinity", "synergies", "board", "sky", "album", "schools", "grades", "narrative",
    "sidequests", "sidequest-npcs", "sidequest-talents"
  ];
  const PROJECT_FIELD_LABELS = {
    questions: "题库", events: "奇遇", talents: "文心", "talent-upgrade": "文心升级",
    npcs: "NPC", affinity: "相性", synergies: "羁绊", board: "地图", sky: "天象",
    album: "传世名篇", schools: "流派文案", grades: "段位文案", narrative: "叙事文案",
    sidequests: "支线路线", "sidequest-npcs": "支线 NPC", "sidequest-talents": "支线文心"
  };

  function sortedJsonValue(value) {
    if (Array.isArray(value)) return value.map(sortedJsonValue);
    if (value && typeof value === "object") {
      return Object.keys(value).sort().reduce((out, key) => {
        if (value[key] !== undefined) out[key] = sortedJsonValue(value[key]);
        return out;
      }, {});
    }
    return value;
  }
  function stableJson(value) { return JSON.stringify(sortedJsonValue(value)); }
  function projectDiffKeys(expected, actual) {
    return PROJECT_FIELDS.filter(key => stableJson(expected && expected[key]) !== stableJson(actual && actual[key]));
  }
  /** 非安全用途的短指纹：帮助用户在不同网页入口肉眼确认是否为同一份工程。 */
  function projectFingerprint(project) {
    const text = stableJson(project);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
  }
  function cacheBust(url) {
    const target = new URL(url, global.location.href);
    target.searchParams.set("_wb", String(Date.now()));
    return target.href;
  }

  /* 云端同步：填充已存设置、检查本机 gh 桥接、发布、复制地址 */
  function wireCloudSync() {
    const $ = id => document.getElementById(id);
    let saved = global.CloudSync ? global.CloudSync.loadSettings("cloud", {}) : {};
    // 旧版会将 Token 写入 localStorage；升级后立即移除，仅保留非敏感发布目标。
    if (Object.prototype.hasOwnProperty.call(saved, "token")) {
      delete saved.token;
      if (global.CloudSync) global.CloudSync.saveSettings("cloud", saved);
    }
    const mode = $("cloudMode");
    const repoFields = $("cloudRepoFields");
    const gistFields = $("cloudGistFields");
    const setMode = m => {
      mode.value = m;
      repoFields.style.display = (m === "repo") ? "" : "none";
      gistFields.style.display = (m === "gist") ? "" : "none";
    };
    if (mode) {
      setMode(saved.mode || "repo");
      mode.addEventListener("change", () => setMode(mode.value));
    }
    const fillSettings = settings => {
      setMode(settings.mode || "repo");
      if ($("cloudRepo")) $("cloudRepo").value = settings.repoRaw || (settings.owner && settings.repo ? (settings.owner + "/" + settings.repo) : "") || "";
      if ($("cloudBranch")) $("cloudBranch").value = settings.branch || "main";
      if ($("cloudPath")) $("cloudPath").value = settings.path || "feihua-content.json";
      if ($("cloudGist")) $("cloudGist").value = settings.gistId || "";
    };
    fillSettings(saved);

    const setMsg = (t, bad) => { const m = $("cloudMsg"); if (m) { m.textContent = t; m.style.color = bad ? "var(--bad)" : "var(--mo-2)"; } };
    const bridgeStatus = $("cloudBridgeStatus");
    const hasSavedTarget = () => saved.mode === "gist" ? !!saved.gistId : !!(saved.owner && saved.repo);
    if (!hasSavedTarget() && global.CloudSync && typeof global.CloudSync.discoverSettings === "function") {
      global.CloudSync.discoverSettings().then(discovered => {
        if (!discovered) return;
        saved = discovered;
        fillSettings(saved);
        global.CloudSync.saveSettings("cloud", saved);
        setMsg("已从当前部署自动识别共同云端地址。", false);
      });
    }
    const checkBridge = async () => {
      if (!global.CloudSync || typeof global.CloudSync.status !== "function") {
        if (bridgeStatus) bridgeStatus.textContent = "本机 gh 发布桥接未加载；请刷新页面。";
        return false;
      }
      try {
        const result = await global.CloudSync.status();
        if (bridgeStatus) bridgeStatus.textContent = `本机 gh 已登录：${result.login}。正式编辑器已连接发布桥接，发布不会使用浏览器 Token。`;
        return true;
      } catch (error) {
        if (bridgeStatus) bridgeStatus.textContent = `本机 gh 发布桥接不可用：${error.message || error}`;
        return false;
      }
    };
    checkBridge();

    if ($("cloudPublish")) $("cloudPublish").addEventListener("click", async () => {
      const publishButton = $("cloudPublish");
      const repoRaw = $("cloudRepo").value.trim();
      const parsed = parseRepo(repoRaw);
      const s = {
        mode: mode ? mode.value : "repo",
        owner: parsed.owner,
        repo: parsed.repo,
        repoRaw: repoRaw,
        branch: $("cloudBranch").value.trim() || "main",
        path: $("cloudPath").value.trim() || "feihua-content.json",
        gistId: $("cloudGist").value.trim()
      };
      if (s.mode === "repo" && (!s.owner || !s.repo)) { setMsg("请填写 仓库（owner/repo）。", true); return; }
      if (!(await checkBridge())) {
        setMsg("发布失败：本机 gh 发布桥接不可用。请使用 npm run editor:bridge。", true);
        return;
      }
      // 先记住非敏感发布目标；Gist 新建成功后会再补回 GitHub 返回的稳定 ID。
      if (global.CloudSync) global.CloudSync.saveSettings("cloud", s);
      setMsg("发布中…");
      publishButton.disabled = true;
      publishButton.setAttribute("aria-busy", "true");
      try {
        // 发布前固定完整工程快照；发布后从不可变 revision 回读并逐模块核对。
        const expectedProject = global.CloudSync.buildProject();
        if (hasStaleStorage()) {
          throw new Error(`本机数据版本 ${localDataVersion() || "未知"} 尚未确认，已阻止发布旧缓存；请先“从云端拉取”、重置默认，或点击“确认本机版本”。`);
        }
        const remoteBefore = global.CloudSync.fetchProject ? await global.CloudSync.fetchProject(s) : null;
        if (remoteBefore && Number(remoteBefore._version) > Number(expectedProject._version)) {
          throw new Error(`当前编辑器工程版本 ${expectedProject._version} 低于云端版本 ${remoteBefore._version}，已阻止旧缓存覆盖；请先“从云端拉取”或硬刷新编辑器。`);
        }
        if (remoteBefore && Number(remoteBefore._version) >= Number(expectedProject._version)) {
          expectedProject._version = Number(remoteBefore._version) + 1;
        }
        const published = await global.CloudSync.publish(s, expectedProject);
        const url = published.url;
        const verifyUrl = cacheBust(published.verifyUrl || url);
        const verifyRes = await fetch(verifyUrl, { cache: "no-store" });
        if (!verifyRes.ok) throw new Error("发布成功但回读失败 HTTP " + verifyRes.status);
        const remoteProject = await verifyRes.json();
        if (!remoteProject || remoteProject._type !== "feihua-content") throw new Error("发布成功但回读内容不是有效工程文件");
        const diff = projectDiffKeys(expectedProject, remoteProject);
        if (diff.length) {
          throw new Error("发布成功但回读有模块不一致：" + diff.map(key => PROJECT_FIELD_LABELS[key] || key).join("、"));
        }
        if (published.gistId) {
          s.gistId = published.gistId;
          s.gistOwner = published.gistOwner || "";
          if ($("cloudGist")) $("cloudGist").value = published.gistId;
        }
        s.url = url;
        s.revision = published.revision || "";
        s.fingerprint = projectFingerprint(remoteProject);
        markCurrentDataVersion(remoteProject._version);
        global.CloudSync.saveSettings("cloud", s);
        const box = $("cloudUrlBox"), u = $("cloudUrl"), copy = $("cloudCopy");
        if (box) box.style.display = "";
        if (u) u.textContent = url;
        if (copy) { copy.style.display = ""; copy.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(url); toast("已复制云端地址"); }; }
        setMsg(`发布成功并已完整回读校验；工程指纹 ${s.fingerprint}${s.revision ? `，版本 ${s.revision.slice(0, 8)}` : ""}。`, false);
        toast("已发布到云端");
      } catch (err) {
        setMsg("发布失败：" + err.message, true);
      } finally {
        publishButton.disabled = false;
        publishButton.removeAttribute("aria-busy");
      }
    });

    if ($("cloudPull")) $("cloudPull").addEventListener("click", async () => {
      const pullButton = $("cloudPull");
      const p = parseRepo($("cloudRepo").value.trim());
      const s = {
        mode: mode ? mode.value : "repo",
        owner: p.owner, repo: p.repo,
        branch: $("cloudBranch").value.trim() || "main",
        path: $("cloudPath").value.trim() || "feihua-content.json",
        gistId: $("cloudGist").value.trim(),
        gistOwner: saved.gistOwner || ""
      };
      // 容错：用户可能把完整 URL 直接粘进「路径」或「仓库」框，自动解析回各字段
      if (/^https?:\/\//i.test(s.repo)) {
        try {
          const u = new URL(s.repo);
          const mm = u.pathname.match(/^\/([^\/]+)\/([^\/]+)\/(?:raw\/)?([^\/]+)\/(.+)$/);
          if (mm) { s.owner = decodeURIComponent(mm[1]); s.repo = decodeURIComponent(mm[2]); s.branch = decodeURIComponent(mm[3]); s.path = decodeURIComponent(mm[4]); }
          else { const pp = u.pathname.split("/").filter(Boolean); if (pp.length >= 2) { s.owner = pp[0]; s.repo = pp[1]; } }
        } catch (_) { /* 非合法 URL，交由后续校验 */ }
      }
      if (/^https?:\/\//i.test(s.path)) {
        try {
          const u = new URL(s.path);
          const mm = u.pathname.match(/^\/([^\/]+)\/([^\/]+)\/(?:raw\/)?([^\/]+)\/(.+)$/);
          if (mm) { s.owner = decodeURIComponent(mm[1]); s.repo = decodeURIComponent(mm[2]); s.branch = decodeURIComponent(mm[3]); s.path = decodeURIComponent(mm[4]); setMsg("已自动解析完整 URL → 仓库 " + s.owner + "/" + s.repo + " · 分支 " + s.branch + " · 路径 " + s.path, false); }
          else { s.path = u.pathname.split("/").pop() || "feihua-content.json"; }
        } catch (_) { /* 非合法 URL，交由后续校验 */ }
      }

      if (s.mode === "repo" && (!s.owner || !s.repo)) { setMsg("请先填写仓库（owner/repo）。", true); return; }
      if (s.mode === "gist" && !s.gistId) { setMsg("请先填写 Gist ID（或先用『发布到云端』创建）。", true); return; }
      setMsg("从云端拉取中…");
      pullButton.disabled = true;
      pullButton.setAttribute("aria-busy", "true");
      try {
        const rawUrl = global.CloudSync.rawUrl(s);
        // GitHub Raw / Gist CDN 可能继续返回旧版本；cache: no-store 只约束浏览器，
        // 因此追加时间戳主动绕过上游缓存，确保跨浏览器拉到刚发布的内容。
        const url = cacheBust(rawUrl);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error("拉取失败 HTTP " + res.status + (res.status === 404 ? "（云端还没有该文件，请先『发布到云端』）" : ""));
        const text = await res.text();
        let data; try { data = JSON.parse(text); } catch (e) { throw new Error("云端文件不是合法 JSON：" + e.message); }
        if (!data || data._type !== "feihua-content") throw new Error("云端文件不是 feihua-content 工程文件（_type 不符）");
        const result = applyCloudProject(data);
        s.url = rawUrl;
        s.fingerprint = result.fingerprint;
        global.CloudSync.saveSettings("cloud", s);
        const active = document.querySelector(".nav button.active");
        if (active && global.Common && global.Common.switchTab) global.Common.switchTab(active.dataset.tab);
        setMsg(`已用云端完整替换本地并逐模块核对；工程指纹 ${result.fingerprint}。`, false);
        toast("云端 → 本地 同步完成");
      } catch (err) {
        setMsg("拉取失败：" + err.message, true);
      } finally {
        pullButton.disabled = false;
        pullButton.removeAttribute("aria-busy");
      }
    });
  }

  /**
   * 构造游戏可直接消费的完整工程对象。
   * 手动导出与云端发布必须共用此函数，避免两条交付路径的字段契约漂移。
   */
  function buildProject(version, options) {
    const exactVersion = !!(options && options.exactVersion);
    const missing = MODULES.filter(module => !(global[module.api] && global[module.api]._ready));
    if (missing.length) {
      throw new Error("以下编辑模块尚未完成载入，已阻止导出/发布残缺工程：" + missing.map(module => module.label).join("、"));
    }
    const project = {
      _type: "feihua-content",
      // 拉取以云端为唯一来源；不得让浏览器里更高的旧版本游标篡改云端版本。
      _version: exactVersion ? Math.max(CONTENT_VERSION, Number(version) || CONTENT_VERSION) : effectiveProjectVersion(version),
      questions: global.QB ? global.QB.exportObj() : [],
      events: global.ADV ? global.ADV.exportRaw() : [],
      talents: global.TALENT ? global.TALENT.exportMainRaw() : [],
      "talent-upgrade": global.TALENT && global.TALENT.exportMainUpgradeRaw ? global.TALENT.exportMainUpgradeRaw() : {},
      npcs: global.NPC ? global.NPC.exportRaw() : [],
      affinity: global.AFFINITY ? global.AFFINITY.exportRaw() : {},
      synergies: global.SYNERGY ? global.SYNERGY.exportRaw() : [],
      board: global.BOARD ? global.BOARD.exportRaw() : {},
      sky: global.SKY ? global.SKY.exportRaw() : [],
      album: global.ALBUM ? global.ALBUM.exportRaw() : [],
      schools: global.COPY ? global.COPY.exportSchoolsRaw() : [],
      grades: global.COPY ? global.COPY.exportGradesRaw() : {},
      narrative: global.COPY ? global.COPY.exportNarrativeRaw() : {}
    };
    if (global.GAME_SIDEQUESTS) project.sidequests = global.GAME_SIDEQUESTS;
    if (global.SIDEQUEST_NPC && global.SIDEQUEST_NPC._ready && typeof global.SIDEQUEST_NPC.exportRaw === "function") {
      project['sidequest-npcs'] = global.SIDEQUEST_NPC.exportRaw();
    } else if (global.GAME_SIDEQUEST_NPCS) project['sidequest-npcs'] = global.GAME_SIDEQUEST_NPCS;
    if (global.GAME_SIDEQUEST_TALENTS || global.GAME_SIDEQUEST_TALENT_UPGRADE || global.GAME_SIDEQUEST_TALENT_OFFERS) {
      project['sidequest-talents'] = {
        version: 1,
        talents: global.TALENT && global.TALENT.exportSidequestRaw ? global.TALENT.exportSidequestRaw() : (global.GAME_SIDEQUEST_TALENTS || []),
        upgrades: global.TALENT && global.TALENT.exportSidequestUpgradeRaw ? global.TALENT.exportSidequestUpgradeRaw() : (global.GAME_SIDEQUEST_TALENT_UPGRADE || {}),
        offers: global.GAME_SIDEQUEST_TALENT_OFFERS || {}
      };
    }
    if (!global.FeihuaConfigContract) throw new Error("配置契约校验器未加载");
    global.FeihuaConfigContract.assertProject(project);
    // 返回快照而不是模块内部 state 的引用，防止异步发布期间后续编辑改写本次内容。
    return JSON.parse(JSON.stringify(project));
  }

  function exportProject() {
    let data;
    try { data = buildProject(); }
    catch (error) { toast(error.message || String(error)); return; }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "feihua-content.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("已导出工程文件 feihua-content.json");
  }

  /* 智能识别导入的数据类型并路由到对应编辑器 */
  function classify(arr) {
    if (!Array.isArray(arr) || !arr.length) return "unknown";
    const s = arr[0];
    if (s && typeof s === "object") {
      if (Array.isArray(s.npcs) && ("tier" in s || "range" in s)) return "npcs";
      if (Array.isArray(s.members) && Array.isArray(s.effects)) return "synergies";
      if (s.id && /^SK\d/i.test(String(s.id)) && s.effect && typeof s.effect.type === "string" && "turns" in s && "name" in s) return "sky";
      if (s.id && /^A\d/i.test(String(s.id)) && s.unlock && s.reward && "rewardDesc" in s) return "album";
      if (s.kind === "passive" || s.kind === "active") return "talents";
      if (s.kind === "direct" || s.kind === "choice" || s.kind === "challenge") return "events";
      if ("stem" in s || "answer" in s) return "questions";
    }
    return "unknown";
  }

  /* 识别单个对象是否为相性 / 羁绊配置（非数组） */
  function classifyObject(o) {
    if (o && typeof o === "object" && !Array.isArray(o)) {
      if (Array.isArray(o.mainRing)) return "board";
      if (o.matrix && (o.manners || o.themes)) return "affinity";
      if (Array.isArray(o.synergies)) return "synergies";
      if (isObj(o.routes) && Object.values(o.routes).some(route => route && (route.guides || route.climax || (route.final && route.final.secondary)))) return "sidequest-npcs";
      if (Array.isArray(o.npcs)) return "npcs";
      if (Array.isArray(o.talents)) return "talents";
      if (Array.isArray(o.sky)) return "sky";
      if (Array.isArray(o.album)) return "album";
      if (Array.isArray(o.events)) return "events";
      if (Array.isArray(o.questions)) return "questions";
    }
    return "unknown";
  }

  /* 当前生效的文心 ID 集合（优先取文心编辑器实时数据，保证引用校验与下拉提示同步） */
  function talentIds() {
    return (global.TALENT && global.TALENT._ready)
      ? global.TALENT.get().map(t => t.id)
      : Object.keys(TALENTS);
  }
  /* 按 ID 取文心对象（优先文心编辑器实时数据，供奇遇侧关联显示） */
  function talentById(id) {
    if (!id) return null;
    if (global.TALENT && global.TALENT._ready) {
      const f = global.TALENT.get().find(t => t.id === id);
      if (f) return f;
    }
    const raw = window.GAME_TALENTS ||
      (typeof TALENTS !== "undefined" && TALENTS && !Array.isArray(TALENTS) ? Object.values(TALENTS) : TALENTS) || [];
    const arr = Array.isArray(raw) ? raw : [];
    return arr.find(t => t.id === id) || null;
  }

  /** 按前缀生成下一个不重复的 ID：前缀 + 自增数字（pad 位补零）。used 为已有 ID 数组 */
  function nextSeqId(prefix, used, pad) {
    pad = pad || 2;
    const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp("^" + esc + "(\\d+)$");
    let max = 0;
    for (const id of (used || [])) {
      const m = String(id).match(re);
      if (m) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    }
    return prefix + String(max + 1).padStart(pad, "0");
  }

  /** 把工程对象路由导入到各编辑器（题库/奇遇/文心/NPC/相性/羁绊）。mode:true=替换,false=合并 */
  function routeImport(data, mode) {
    let routed = 0;
    if (Array.isArray(data)) {
      const type = classify(data);
      if (type === "questions" && global.QB) { global.QB.importData(data, mode); routed++; }
      else if (type === "album" && global.ALBUM) { global.ALBUM.importData(data, mode); routed++; }
      else if (type === "events" && global.ADV) { global.ADV.importData(data, mode); routed++; }
      else if (type === "talents" && global.TALENT) { global.TALENT.importData(data, mode); routed++; }
      else         if (type === "npcs" && global.NPC) { global.NPC.importData(data, mode); routed++; }
      else if (type === "synergies" && global.SYNERGY) { global.SYNERGY.importData(data, mode); routed++; }
      else if (type === "sky" && global.SKY) { global.SKY.importData(data, mode); routed++; }
      else { alert("未能识别该数组是题库 / 奇遇 / 文心 / NPC / 羁绊 / 天象 / 传世名篇（需要含 stem、kind、passive/active、tier+npcs、members+effects、SK01 天象字段或 A001 名篇字段）。"); return; }
    } else if (data && typeof data === "object") {
      if (Array.isArray(data.questions) && global.QB) { global.QB.importData(data.questions, mode); routed++; }
      if (Array.isArray(data.events) && global.ADV) { global.ADV.importData(data.events, mode); routed++; }
      if (data["sidequest-npcs"] && global.SIDEQUEST_NPC) { global.SIDEQUEST_NPC.importData(data["sidequest-npcs"], mode); routed++; }
      const sidequestTalents = data["sidequest-talents"] && Array.isArray(data["sidequest-talents"].talents)
        ? data["sidequest-talents"].talents : [];
      if ((Array.isArray(data.talents) || sidequestTalents.length) && global.TALENT) {
        global.TALENT.importData([...(Array.isArray(data.talents) ? data.talents : []), ...sidequestTalents], mode);
        routed++;
      }
      const sidequestUpgrades = data["sidequest-talents"] && data["sidequest-talents"].upgrades && typeof data["sidequest-talents"].upgrades === "object"
        ? data["sidequest-talents"].upgrades : {};
      if ((data["talent-upgrade"] || Object.keys(sidequestUpgrades).length) && global.TALENT && global.TALENT.importUpgrade) {
        global.TALENT.importUpgrade({ ...(data["talent-upgrade"] || {}), ...sidequestUpgrades }, mode);
        routed++;
      }
      if (Array.isArray(data.npcs) && global.NPC) { global.NPC.importData(data.npcs, mode); routed++; }
      if (Array.isArray(data.synergies) && global.SYNERGY) { global.SYNERGY.importData(data.synergies, mode); routed++; }
      if (Array.isArray(data.sky) && global.SKY) { global.SKY.importData(data.sky, mode); routed++; }
      if (Array.isArray(data.album) && global.ALBUM) { global.ALBUM.importData(data.album, mode); routed++; }
      if ((data.schools || data.grades || data.narrative) && global.COPY) { global.COPY.importData(data, mode); routed++; }
      if ((data.matrix && (data.manners || data.themes)) && global.AFFINITY) { global.AFFINITY.importData(data, mode); routed++; }
      if (data.affinity && global.AFFINITY) { global.AFFINITY.importData(data.affinity, mode); routed++; }
      if ((data.mainRing || data.laps || data.sides) && global.BOARD) { global.BOARD.importData(data, mode); routed++; }
      if (data.board && data.board.mainRing && global.BOARD) { global.BOARD.importData(data.board, mode); routed++; }
      if (data.routes && isObj(data.routes) && global.SIDEQUEST_NPC && classifyObject(data) === "sidequest-npcs") {
        global.SIDEQUEST_NPC.importData(data, mode); routed++;
      }
      if (!routed) { alert("文件不含 questions / events / talents / talent-upgrade / npcs / affinity / synergies / board / sky / album / schools / grades / narrative 字段。"); return; }
    } else { alert("未识别的 JSON 结构。"); return; }
    if (routed > 0) toast(mode ? "替换导入完成：已载入 " + routed + " 个模块" : "合并导入完成：已载入 " + routed + " 个模块");
    return routed;
  }

  /**
   * 云端同步是单一来源替换，不提供合并语义。
   * 先校验、再快照、应用后逐模块回读；任何异常都恢复同步前的完整工程。
   */
  /**
   * 旧版工程曾允许 talent-upgrade 的 Lv1 效果独立于 talents 基础效果演进。
   * 当前运行时以 talents 为唯一基础效果来源；拉取时先把旧 Lv1 对齐到同一工程内的文心，
   * 再进入严格契约与逐模块回读，避免无效旧数据永久阻断同步。
   */
  function migrateCloudProject(project) {
    const migrations = [];
    if (!project || !Array.isArray(project.talents) || !isObj(project["talent-upgrade"])) return migrations;
    const talentById = new Map();
    for (const talent of project.talents) {
      if (talent && talent.id && !talentById.has(talent.id)) talentById.set(talent.id, talent);
    }
    for (const [id, upgrade] of Object.entries(project["talent-upgrade"])) {
      const talent = talentById.get(id);
      const level1 = upgrade && Array.isArray(upgrade.levels) ? upgrade.levels[0] : null;
      if (!talent || !isObj(talent.effect) || !level1 || !isObj(level1.effect)) continue;
      const changed = stableJson(level1.effect) !== stableJson(talent.effect);
      // 同时统一对象键序，避免旧契约的 JSON 顺序比较把等价效果判成漂移。
      level1.effect = JSON.parse(JSON.stringify(talent.effect));
      if (changed) migrations.push({ type: "talent-upgrade-level1", id });
    }
    return migrations;
  }

  function applyCloudProject(data) {
    if (!data || data._type !== "feihua-content") throw new Error("云端文件不是 feihua-content 工程文件");
    const incoming = JSON.parse(JSON.stringify(data));
    if (!global.FeihuaConfigContract) throw new Error("配置契约校验器未加载");
    const migrations = migrateCloudProject(incoming);
    global.FeihuaConfigContract.assertProject(incoming);
    const before = buildProject();
    let mutationStarted = false;
    try {
      mutationStarted = true;
      const routed = routeImport(incoming, true);
      if (!routed) throw new Error("云端数据未被任何已初始化的编辑器接收");
      const applied = buildProject(incoming._version, { exactVersion: true });
      const diff = projectDiffKeys(incoming, applied);
      if (diff.length) {
        throw new Error("当前编辑器版本会改写这些云端模块：" + diff.map(key => PROJECT_FIELD_LABELS[key] || key).join("、"));
      }
      // 云端工程已完整应用后再推进本地版本游标；失败时不会污染版本状态。
      markCurrentDataVersion(applied._version);
      return { project: applied, fingerprint: projectFingerprint(applied), routed };
    } catch (error) {
      if (mutationStarted) {
        try {
          routeImport(before, true);
          const restored = buildProject(before._version, { exactVersion: true });
          const restoreDiff = projectDiffKeys(before, restored);
          if (restoreDiff.length) throw new Error("回滚后仍不一致：" + restoreDiff.join("、"));
        } catch (rollbackError) {
          throw new Error((error.message || String(error)) + "；自动回滚失败：" + (rollbackError.message || String(rollbackError)));
        }
      }
      throw error;
    }
  }

  function importProject(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); }
      catch (e) { alert("JSON 解析失败：" + e.message); return; }
      const mode = confirm(
        "导入模式：\n\n点击「确定」= 替换当前数据；\n点击「取消」= 按 ID 合并（已存在则覆盖，不存在则追加）。");
      routeImport(data, mode);
      closeOverlay("mgmtOverlay");
    };
    reader.readAsText(file, "utf-8");
  }

  /* ---------------- 快捷操作面板 ---------------- */
  function commandItems() {
    const tab = activeTab();
    const tool = TAB_TOOLS[tab] || TAB_TOOLS.qbank;
    const current = MODULES.find(module => module.tab === tab) || MODULES[0];
    const items = [
      { id: "current-add", kind: "current-add", label: `新增${tool.noun}`, detail: `当前模块 · ${current.label}` },
      { id: "current-search", kind: "current-search", label: `搜索${tool.noun}`, detail: "聚焦当前模块搜索框 · /" },
      { id: "workspace-health", kind: "workspace-health", label: "运行全局校验", detail: "检查全部模块与工程配置" },
      { id: "workspace-export", kind: "workspace-export", label: "合并导出工程文件", detail: "下载 feihua-content.json" },
      { id: "workspace-manage", kind: "workspace-manage", label: "打开数据管理", detail: "总览、导入、云端同步" }
    ];
    MODULES.forEach(module => {
      const count = moduleCount(module);
      items.push({ id: `tab:${module.tab}`, kind: "tab", tab: module.tab, label: `前往${module.label}`, detail: `${count} 条内容` });
    });
    return items;
  }

  function renderCommandList(query, resetSelection) {
    const box = document.getElementById("commandList");
    if (!box) return;
    const q = String(query || "").trim().toLocaleLowerCase();
    commandState.items = commandItems().filter(item => !q || `${item.label} ${item.detail}`.toLocaleLowerCase().includes(q));
    if (resetSelection || commandState.index >= commandState.items.length) commandState.index = 0;
    if (!commandState.items.length) {
      box.innerHTML = '<div class="command-empty">没有匹配的操作。试试“新增”“导出”或模块名称。</div>';
      return;
    }
    box.innerHTML = commandState.items.map((item, index) => `
      <button class="command-item ${index === commandState.index ? "selected" : ""}" type="button" role="option" aria-selected="${index === commandState.index}" data-command="${item.id}">
        <span class="command-item-main">${esc(item.label)}</span>
        <span class="command-item-detail">${esc(item.detail)}</span>
      </button>`).join("");
  }

  function openCommandPalette() {
    const search = document.getElementById("commandSearch");
    if (search) search.value = "";
    commandState.index = 0;
    renderCommandList("", true);
    openOverlay("commandOverlay");
    setTimeout(() => { if (search) search.focus(); }, 0);
  }

  function runCommand(id) {
    const item = commandState.items.find(command => command.id === id);
    if (!item) return;
    closeOverlay("commandOverlay");
    if (item.kind === "tab") { switchTab(item.tab); return; }
    if (item.kind === "workspace-health" || item.kind === "workspace-manage") { showManagement(); return; }
    if (item.kind === "workspace-export") { exportProject(); return; }
    const tab = activeTab();
    const tool = TAB_TOOLS[tab] || TAB_TOOLS.qbank;
    if (item.kind === "current-add") {
      if (!tool.add) { toast(`“${tool.noun}”通过当前页面直接编辑，无需新增记录`); return; }
      setTimeout(() => document.getElementById(tool.add)?.click(), 0);
      return;
    }
    if (item.kind === "current-search") {
      setTimeout(() => {
        const target = document.getElementById(tool.search);
        if (target && typeof target.focus === "function") target.focus();
      }, 0);
    }
  }

  function isTextInput(target) {
    if (!target) return false;
    return /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName) || target.isContentEditable;
  }

  function trapFocus(event, overlay) {
    const items = getFocusable(overlay);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  /* ---------------- 初始化（导航 + 数据管理按钮 + 全局快捷键） ---------------- */
  function init() {
    // 必须在各模块首次写回规范化数据前探测旧缓存，否则迁移写回会掩盖“来源版本过旧”。
    detectLegacyStorage();
    migrateQbankIfNeeded();
    // 导航
    document.querySelectorAll(".nav button").forEach(b =>
      b.addEventListener("click", () => switchTab(b.dataset.tab)));
    const mgmtBtn = document.getElementById("btnMgmt");
    if (mgmtBtn) mgmtBtn.addEventListener("click", showManagement);
    const summary = document.getElementById("workspaceSummary");
    if (summary) summary.addEventListener("click", showManagement);
    const commandBtn = document.getElementById("btnCommand");
    if (commandBtn) commandBtn.addEventListener("click", openCommandPalette);
    const commandClose = document.getElementById("commandClose");
    if (commandClose) commandClose.addEventListener("click", () => closeOverlay("commandOverlay"));
    const commandSearch = document.getElementById("commandSearch");
    if (commandSearch) {
      commandSearch.addEventListener("input", () => renderCommandList(commandSearch.value, true));
      commandSearch.addEventListener("keydown", event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          if (!commandState.items.length) return;
          event.preventDefault();
          const direction = event.key === "ArrowDown" ? 1 : -1;
          commandState.index = (commandState.index + direction + commandState.items.length) % commandState.items.length;
          renderCommandList(commandSearch.value, false);
        } else if (event.key === "Enter") {
          const item = commandState.items[commandState.index];
          if (item) { event.preventDefault(); runCommand(item.id); }
        }
      });
    }
    const commandList = document.getElementById("commandList");
    if (commandList) commandList.addEventListener("click", event => {
      const button = event.target.closest("[data-command]");
      if (button) runCommand(button.dataset.command);
    });
    document.getElementById("mgmtClose").addEventListener("click", () => closeOverlay("mgmtOverlay"));
    // 点击遮罩关闭（所有 overlay）
    document.querySelectorAll(".overlay").forEach(ov =>
      ov.addEventListener("click", e => { if (e.target === ov) closeOverlay(ov.id); }));
    // 全局快捷键：Esc 关闭弹窗，Ctrl / ⌘ + K 打开快捷操作，/ 聚焦当前搜索。
    document.addEventListener("keydown", e => {
      const overlay = getTopOverlay();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (!overlay || overlay.id !== "commandOverlay") openCommandPalette();
        return;
      }
      if (e.key === "Escape" && overlay) { e.preventDefault(); closeOverlay(overlay.id); return; }
      if (e.key === "Tab" && overlay) { trapFocus(e, overlay); return; }
      if (e.key === "/" && !overlay && !isTextInput(e.target)) {
        const tool = TAB_TOOLS[activeTab()] || TAB_TOOLS.qbank;
        const target = document.getElementById(tool.search);
        if (target && typeof target.focus === "function") { e.preventDefault(); target.focus(); }
      }
    });
    // 默认 Tab（优先上次选择）
    const tab = load("tab", "qbank");
    switchTab(tab);
    updateWorkspaceSummary();
  }

  global.Common = {
    store, load, esc, toast, openOverlay, closeOverlay,
    init, switchTab, setStatus, showManagement, buildProject, applyCloudProject, projectDiffKeys, projectFingerprint,
    classify, talentIds, talentById, nextSeqId,
    getWorkspaceHealth, reviewWorkspace, refreshWorkspaceUI, openCommandPalette,
    contentVersion: CONTENT_VERSION, localDataVersion, hasStaleStorage, markCurrentDataVersion,
    ATTR, ATTR_KEYS, CATEGORY, RARITY, QUALITY, QUALITY_MAX, QUALITY_UPCOST, KIND, TALENTS, TALENT_IDS,
    effectBrief, effectDetail
  };
})(window);
