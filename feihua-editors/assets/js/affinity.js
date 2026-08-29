/* =========================================================================
 * affinity.js — 相性编辑器模块（题材 × 文风 矩阵 + 四层叠加旋钮）
 * 数据结构与游戏 config/affinity.json 完全兼容：
 *   { themes:[], manners:[], themeNames:{}, mannerNames:{},
 *     matrix:{ "manner.theme": value },
 *     homeMannerBonus, homeAdaptiveBonus, zeitgeistThemeBonus,
 *     zeitgeistMannerBonus, momentumPer, momentumMax }
 * 编辑器允许：逐格调整档位（契合/相得/中平/相左）、编辑四层旋钮、
 * 编辑文风/题材显示名、随机生成平衡矩阵、校验设计约束、预览有效相性、
 * 导入/导出 affinity.json。依赖 common.js（Common.*）。
 * ========================================================================= */
(function (global) {
  "use strict";
  const C = global.Common;

  /* 四档：与游戏 rules.js 的 affinityTierLabel 对齐 */
  const TIERS = [
    { key: "hit",  v: 0.12, label: "契合", cls: "tier-hit" },
    { key: "good", v: 0.06, label: "相得", cls: "tier-good" },
    { key: "flat", v: 0,    label: "中平", cls: "tier-flat" },
    { key: "bad",  v: -0.08, label: "相左", cls: "tier-bad" }
  ];
  const TIER_BY_KEY = Object.fromEntries(TIERS.map(t => [t.key, t]));
  function tierOfVal(v) {
    const n = Number(v) || 0;
    for (const t of TIERS) if (Math.abs(t.v - n) < 1e-9) return t;
    return n > 0 ? TIERS[1] : (n < 0 ? TIERS[3] : TIERS[2]);
  }

  /* 门派文风（仅用于预览有效相性；与 schools.json 的 homeManner 对齐） */
  const SCHOOLS = [
    { name: "诗仙流", homeManner: "haofang" },
    { name: "词宗流", homeManner: "wanyue" },
    { name: "联圣流", homeManner: "zheli" },
    { name: "通儒流", homeManner: "adaptive" },
    { name: "奇士流", homeManner: "qili" }
  ];

  const KNOB_KEYS = ["homeMannerBonus", "homeAdaptiveBonus", "zeitgeistThemeBonus", "zeitgeistMannerBonus", "momentumPer", "momentumMax"];

  const state = { af: null, _ready: false };

  /* ---------------- 持久化 ---------------- */
  function save() {
    C.store("affinity", state.af);
    const t = new Date();
    C.setStatus("affinity", "已自动保存 " + t.toLocaleTimeString("zh-CN", { hour12: false }));
  }
  function loadData() {
    const raw = C.load("affinity", null);
    if (raw && raw.matrix) state.af = normalize(raw);
    else {
      state.af = normalize(window.GAME_AFFINITY || {});
      C.store("affinity", state.af);
    }
  }

  /* ---------------- 规范化 ---------------- */
  function num(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
  function normalize(a) {
    a = a || {};
    const themes = Array.isArray(a.themes) && a.themes.length ? a.themes.slice() : ["yongwu", "songbie", "shanshui", "biansai", "huaigu", "jieling"];
    const manners = Array.isArray(a.manners) && a.manners.length ? a.manners.slice() : ["wanyue", "haofang", "zheli", "qingya", "chenyu", "qili"];
    const themeNames = Object.assign({}, a.themeNames || {});
    const mannerNames = Object.assign({}, a.mannerNames || {});
    themes.forEach((t, i) => { if (!themeNames[t]) themeNames[t] = a.themeNames && a.themeNames[t] ? a.themeNames[t] : (["咏物", "送别", "山水", "边塞", "怀古", "节令"][i] || t); });
    manners.forEach((m, i) => { if (!mannerNames[m]) mannerNames[m] = a.mannerNames && a.mannerNames[m] ? a.mannerNames[m] : (["婉约", "豪放", "哲理", "清雅", "沉郁", "绮丽"][i] || m); });
    const matrix = {};
    for (const m of manners) for (const t of themes) {
      const k = m + "." + t;
      matrix[k] = num(a.matrix && a.matrix[k], 0);
    }
    const out = { themes, manners, themeNames, mannerNames, matrix };
    KNOB_KEYS.forEach(k => { out[k] = num(a[k], k === "momentumMax" ? 5 : 0.04); });
    if (a.momentumMax == null) out.momentumMax = 5;
    return out;
  }

  /* ---------------- 取值工具 ---------------- */
  function val(m, t) { return Number(state.af.matrix[m + "." + t]) || 0; }
  function bestManner(theme) {
    let best = state.af.manners[0], bv = -Infinity;
    for (const m of state.af.manners) { const v = val(m, theme); if (v > bv) { bv = v; best = m; } }
    return best;
  }
  function tName(t) { return state.af.themeNames[t] || t; }
  function mName(m) { return state.af.mannerNames[m] || m; }

  /* 有效相性（含 ①②④；③ 风潮可选）— 镜像 rules.js effectiveAffinity */
  function effective(manner, theme, homeManner, zeitgeist) {
    let v = val(manner, theme);
    if (homeManner) {
      if (homeManner === "adaptive") { if (manner === bestManner(theme)) v += state.af.homeAdaptiveBonus; }
      else if (manner === homeManner) v += state.af.homeMannerBonus;
    }
    if (zeitgeist) {
      if (theme === zeitgeist.theme) v += state.af.zeitgeistThemeBonus;
      if (manner === zeitgeist.manner) v += state.af.zeitgeistMannerBonus;
    }
    return v;
  }
  function effTierLabel(v) {
    if (v >= 0.12) return "契合"; if (v > 0) return "相得"; if (v === 0) return "中平"; return "相左";
  }

  /* ---------------- 校验 ---------------- */
  function validateAll() {
    if (!state.af) return [];
    const out = [], T = state.af.themes, M = state.af.manners;
    const hitByTheme = {}, hitByManner = {};
    T.forEach(t => hitByTheme[t] = 0); M.forEach(m => hitByManner[m] = 0);
    M.forEach(m => T.forEach(t => { const v = val(m, t); if (v >= 0.12) { hitByTheme[t]++; hitByManner[m]++; } }));
    T.forEach(t => { if (hitByTheme[t] !== 1) out.push({ level: "warn", msg: `题材「${tName(t)}」的契合文风数 = ${hitByTheme[t]}（应为 1）` }); });
    M.forEach(m => { if (hitByManner[m] < 1) out.push({ level: "err", msg: `文风「${mName(m)}」无任何契合题材（应 ≥1）` }); });
    KNOB_KEYS.forEach(k => { const v = state.af[k]; if (!Number.isFinite(v) || v < 0) out.push({ level: "err", msg: `旋钮 ${k} 非法：${v}` }); });
    if (state.af.momentumMax != null && state.af.momentumMax < 1) out.push({ level: "err", msg: "momentumMax 应 ≥ 1" });
    return out;
  }

  /* ---------------- 统计 ---------------- */
  function renderStats() {
    const T = state.af.themes, M = state.af.manners;
    let filled = 0, hit = 0, bad = 0;
    M.forEach(m => T.forEach(t => { const v = val(m, t); if (v !== 0) filled++; if (v >= 0.12) hit++; if (v < 0) bad++; }));
    const total = M.length * T.length;
    document.getElementById("affStatStrip").innerHTML = `
      <div class="stat"><b>${total}</b><span>矩阵格数</span></div>
      <div class="stat"><b>${filled}</b><span>已填格（非中平）</span></div>
      <div class="stat"><b>${hit}</b><span>契合格</span></div>
      <div class="stat"><b>${bad}</b><span>相左格</span></div>`;
  }

  /* ---------------- 列表（矩阵 + 旋钮 + 名称） ---------------- */
  function cellSelect(m, t) {
    const tr = tierOfVal(val(m, t));
    const opts = TIERS.map(x => `<option value="${x.key}" ${x.key === tr.key ? "selected" : ""}>${x.label}（${x.v >= 0 ? "+" : ""}${Math.round(x.v * 100)}%）</option>`).join("");
    return `<td class="${tr.cls}"><select class="aff-cell" data-m="${m}" data-t="${t}">${opts}</select></td>`;
  }
  function renderList() {
    renderStats();
    const T = state.af.themes, M = state.af.manners;
    const head = `<th>文风＼题材</th>` + T.map(t => `<th>${tName(t)}</th>`).join("");
    const body = M.map(m => `<tr><th>${mName(m)}</th>` + T.map(t => cellSelect(m, t)).join("") + `</tr>`).join("");
    // 每题材当前最优
    const bestRow = `<tr class="aff-best"><th>当前最优</th>` + T.map(t => {
      const bm = bestManner(t); const tr = tierOfVal(val(bm, t));
      return `<td class="${tr.cls}">${mName(bm)}<br><small>${tr.label}</small></td>`;
    }).join("") + `</tr>`;
    // 旋钮
    const knobRows = KNOB_KEYS.map(k => {
      const desc = {
        homeMannerBonus: "本门文风出战额外加成（门派 identity 层）",
        homeAdaptiveBonus: "通儒临题自选最优文风的额外加成",
        zeitgeistThemeBonus: "当朝风潮·热点题材：全风格对该题材 +此值",
        zeitgeistMannerBonus: "当朝风潮·得势文体：该文风全题材 +此值",
        momentumPer: "气势连捷每层叠加（同文风连胜）",
        momentumMax: "气势连捷封顶层数（封顶 = per × max）"
      }[k];
      return `<div class="row2" style="margin:0">
        <div class="field" style="margin:0"><label>${k}</label><input type="number" step="0.01" class="aff-knob" data-k="${k}" value="${state.af[k]}"/></div>
        <div class="field" style="margin:0"><label style="color:var(--ink2)">${desc}</label></div>
      </div>`;
    }).join("");
    // 名称编辑
    const themeNameRows = T.map(t => `<div class="field" style="margin:0;flex:1"><label>${t} 显示名</label><input type="text" class="aff-tname" data-k="${t}" value="${C.esc(tName(t))}"/></div>`).join("");
    const mannerNameRows = M.map(m => `<div class="field" style="margin:0;flex:1"><label>${m} 显示名</label><input type="text" class="aff-mname" data-k="${m}" value="${C.esc(mName(m))}"/></div>`).join("");

    document.getElementById("afflist").innerHTML = `
      <h4 style="margin:6px 0 4px">① 稠密非对称矩阵（逐格调整档位）</h4>
      <div class="aff-grid-wrap"><table class="aff-grid"><tr>${head}</tr>${body}${bestRow}</table></div>
      <div class="aff-cols">
        <div class="aff-block">
          <h4 style="margin:10px 0 4px">② 四层叠加旋钮</h4>
          ${knobRows}
        </div>
        <div class="aff-block">
          <h4 style="margin:10px 0 4px">文风 / 题材显示名</h4>
          <div class="aff-names">${mannerNameRows}</div>
          <div class="aff-names" style="margin-top:8px">${themeNameRows}</div>
        </div>
      </div>`;
  }

  /* ---------------- 随机生成平衡矩阵 ---------------- */
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randomMatrix() {
    const T = state.af.themes, M = state.af.manners;
    const matrix = {};
    M.forEach(m => T.forEach(t => { matrix[m + "." + t] = 0; }));
    const usedManner = {}; M.forEach(m => usedManner[m] = 0);
    // 1) 每题材随机指一契合文风
    T.forEach(t => { const m = pick(M); matrix[m + "." + t] = 0.12; usedManner[m]++; });
    // 2) 保证每文风至少 1 契合：把缺的文风硬塞进一个随机题材
    M.forEach(m => {
      if (usedManner[m] === 0) {
        const t = pick(T);
        matrix[m + "." + t] = 0.12; usedManner[m]++;
      }
    });
    // 3) 部分题材再随机加一个相得（不同文风）
    T.forEach(t => {
      if (Math.random() < 0.6) {
        const cands = M.filter(m => matrix[m + "." + t] === 0);
        if (cands.length) { const m = pick(cands); matrix[m + "." + t] = 0.06; }
      }
    });
    // 4) 少量相左（制造下注风险）
    M.forEach(m => T.forEach(t => {
      if (matrix[m + "." + t] === 0 && Math.random() < 0.18) matrix[m + "." + t] = -0.08;
    }));
    state.af.matrix = matrix;
    save(); renderList();
    C.toast("已随机生成平衡矩阵（每题材 1 契合、每文风 ≥1 契合）");
  }

  /* ---------------- 预览有效相性 ---------------- */
  function openPreview() {
    const schoolsOpts = SCHOOLS.map((s, i) => `<option value="${i}">${s.name}（${s.homeManner === "adaptive" ? "通儒·自适应" : mName(s.homeManner)}）</option>`).join("");
    document.getElementById("affPreviewBody").innerHTML = `
      <div style="width:100%">
        <div class="row2" style="margin-bottom:10px">
          <div class="field" style="margin:0"><label>选择流派（门派文风层 ②）</label>
            <select id="affPrevSchool">${schoolsOpts}</select></div>
          <div class="field" style="margin:0;display:flex;align-items:center;gap:8px">
            <input type="checkbox" id="affPrevZg" checked /><label style="margin:0">叠加当朝风潮（随机抽一组，演示变化层 ③）</label></div>
        </div>
        <div id="affPrevGrid"></div>
      </div>`;
    const draw = () => {
      const s = SCHOOLS[Number(document.getElementById("affPrevSchool").value)];
      const zgOn = document.getElementById("affPrevZg").checked;
      const zt = zgOn ? pick(state.af.themes) : null;
      const zm = zgOn ? pick(state.af.manners) : null;
      const zeitgeist = (zt && zm) ? { theme: zt, manner: zm } : null;
      const T = state.af.themes, M = state.af.manners;
      const head = `<th>文风＼题材</th>` + T.map(t => `<th>${tName(t)}${zeitgeist && zeitgeist.theme === t ? " ◆" : ""}</th>`).join("");
      const rows = M.map(m => {
        const cells = T.map(t => {
          const v = effective(m, t, s.homeManner, zeitgeist);
          const tr = tierOfVal(v); const cls = v >= 0.12 ? "tier-hit" : v > 0 ? "tier-good" : v === 0 ? "tier-flat" : "tier-bad";
          return `<td class="${cls}">${effTierLabel(v)}<br><small>${v >= 0 ? "+" : ""}${Math.round(v * 100)}%</small></td>`;
        }).join("");
        return `<tr><th>${mName(m)}${s.homeManner === m ? " ★" : ""}</th>${cells}</tr>`;
      }).join("");
      const zgTxt = zeitgeist ? `　当朝风潮：热点题材 <b>${tName(zt)}</b> +${Math.round(state.af.zeitgeistThemeBonus*100)}%、得势文体 <b>${mName(zm)}</b> +${Math.round(state.af.zeitgeistMannerBonus*100)}%` : "";
      document.getElementById("affPrevGrid").innerHTML = `
        <p style="font-size:13px;color:var(--ink2);margin:2px 0 6px">流派 <b>${s.name}</b>：本门文风 <b>${s.homeManner === "adaptive" ? "临题自选最优" : mName(s.homeManner)}</b> +${Math.round((s.homeManner === "adaptive" ? state.af.homeAdaptiveBonus : state.af.homeMannerBonus)*100)}%${zgTxt}</p>
        <table class="aff-grid"><tr>${head}</tr>${rows}</table>
        <p style="font-size:12px;color:var(--ink2);margin:6px 0 0">★ = 本门文风；◆ = 本局热点题材。综合相性 = 基矩阵 ① + 门派文风 ② + 风潮 ③（气势连捷 ④ 为连胜实时叠加，不在此表）。</p>`;
    };
    document.getElementById("affPrevSchool").addEventListener("change", draw);
    document.getElementById("affPrevZg").addEventListener("change", draw);
    draw();
    C.openOverlay("affPreviewOverlay");
  }

  /* ---------------- 校验弹窗 ---------------- */
  function showStats() {
    const issues = validateAll();
    const T = state.af.themes, M = state.af.manners;
    let hitByTheme = {}, hitByManner = {};
    T.forEach(t => hitByTheme[t] = 0); M.forEach(m => hitByManner[m] = 0);
    M.forEach(m => T.forEach(t => { if (val(m, t) >= 0.12) { hitByTheme[t]++; hitByManner[m]++; } }));
    const themeRows = T.map(t => `<tr><td>${tName(t)}</td><td class="num">${hitByTheme[t]}</td><td>${hitByTheme[t] === 1 ? '<span class="ok">✅</span>' : '<span class="warn">需恰好 1</span>'}</td></tr>`).join("");
    const mannerRows = M.map(m => `<tr><td>${mName(m)}</td><td class="num">${hitByManner[m]}</td><td>${hitByManner[m] >= 1 ? '<span class="ok">✅</span>' : '<span class="warn">需 ≥1</span>'}</td></tr>`).join("");
    const allOk = T.every(t => hitByTheme[t] === 1) && M.every(m => hitByManner[m] >= 1) && !issues.some(i => i.level === "err");
    const issueHtml = issues.length
      ? `<div class="msg err" style="margin-top:10px">${issues.map(i => "• " + i.msg).join("<br>")}</div>`
      : `<div class="msg" style="margin-top:10px">✅ 旋钮与矩阵数值均合法。</div>`;
    document.getElementById("affStBody").innerHTML = `
      <p><b>设计约束：</b>每个题材恰 1 个契合文风、每个文风 ≥1 个契合题材。</p>
      <div class="aff-cols">
        <div><table class="stat-table"><tr><th>题材</th><th>契合数</th><th>校验</th></tr>${themeRows}</table></div>
        <div><table class="stat-table"><tr><th>文风</th><th>契合数</th><th>校验</th></tr>${mannerRows}</table></div>
      </div>
      ${issueHtml}
      <p style="font-size:12px;color:var(--ink2);margin-top:8px">总评：<b>${allOk ? "✅ 满足全部约束，可直接导出" : "⚠️ 存在约束缺口，建议调整后导出"}</b></p>`;
    C.openOverlay("affStOverlay");
  }

  /* ---------------- 导入 / 导出 ---------------- */
  function importData(obj, replace) {
    const norm = normalize(obj);
    if (replace) { state.af = norm; C.toast("已替换为导入的相性配置"); }
    else {
      // 合并：以导入为准覆盖同名字段与矩阵格，其余保留
      state.af.themes = norm.themes; state.af.manners = norm.manners;
      state.af.themeNames = Object.assign({}, state.af.themeNames, norm.themeNames);
      state.af.mannerNames = Object.assign({}, state.af.mannerNames, norm.mannerNames);
      state.af.matrix = Object.assign({}, state.af.matrix, norm.matrix);
      KNOB_KEYS.forEach(k => { if (norm[k] != null) state.af[k] = norm[k]; });
      C.toast("已合并导入的相性配置");
    }
    save(); renderList();
  }
  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      let data;
      try { data = JSON.parse(reader.result); } catch (e) { alert("JSON 解析失败：" + e.message); return; }
      let obj = null;
      if (data && typeof data === "object" && !Array.isArray(data)) {
        if (data.matrix && (data.manners || data.themes)) obj = data;
        else if (Array.isArray(data.npcs)) { alert("这是对手档文件，请在「NPC 编辑器」中导入。"); return; }
        else if (Array.isArray(data.talents)) { alert("这是文心文件，请在「文心编辑器」中导入。"); return; }
        else if (Array.isArray(data.events)) { alert("这是奇遇文件，请在「奇遇编辑器」中导入。"); return; }
        else if (Array.isArray(data.questions)) { alert("这是题库文件，请在「题库编辑器」中导入。"); return; }
        else { alert("未识别的 JSON（应为含 matrix + manners/themes 的相性配置对象）。"); return; }
      }
      if (!obj) { alert("未识别的 JSON 结构。"); return; }
      const mode = confirm("点击「确定」= 整份替换当前相性配置；\n点击「取消」= 合并（导入覆盖同名项，其余保留）。");
      importData(obj, mode);
    };
    reader.readAsText(file, "utf-8");
  }
  function exportRaw() {
    const out = {
      themes: state.af.themes.slice(),
      manners: state.af.manners.slice(),
      themeNames: Object.assign({}, state.af.themeNames),
      mannerNames: Object.assign({}, state.af.mannerNames),
      matrix: Object.assign({}, state.af.matrix)
    };
    KNOB_KEYS.forEach(k => { out[k] = state.af[k]; });
    return out;
  }
  function exportData() {
    const bad = validateAll().filter(i => i.level === "err");
    if (bad.length) {
      if (!confirm(`有 ${bad.length} 处硬性校验问题。\n仍要导出吗？建议先「校验」修正再导出。`)) return;
    }
    const data = JSON.stringify(exportRaw(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "affinity.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    C.toast("已导出 affinity.json");
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    document.getElementById("affBtnExport").addEventListener("click", exportData);
    document.getElementById("affBtnStats").addEventListener("click", showStats);
    document.getElementById("affBtnRandom").addEventListener("click", randomMatrix);
    document.getElementById("affBtnReset").addEventListener("click", () => {
      if (!confirm("重置为游戏默认相性配置（当前编辑将丢失）？")) return;
      state.af = normalize(window.GAME_AFFINITY || {}); save(); renderList(); C.toast("已重置为默认");
    });
    document.getElementById("affBtnImport").addEventListener("click", () => document.getElementById("affFileInput").click());
    document.getElementById("affFileInput").addEventListener("change", e => { if (e.target.files[0]) importFile(e.target.files[0]); e.target.value = ""; });
    document.getElementById("affBtnPreview").addEventListener("click", openPreview);
    document.getElementById("affPreviewClose").addEventListener("click", () => C.closeOverlay("affPreviewOverlay"));
    document.getElementById("affStClose").addEventListener("click", () => C.closeOverlay("affStOverlay"));

    // 矩阵单元格：下拉改档位
    document.getElementById("afflist").addEventListener("change", e => {
      const sel = e.target;
      if (sel.classList.contains("aff-cell")) {
        const tr = TIER_BY_KEY[sel.value];
        const m = sel.dataset.m, t = sel.dataset.t;
        state.af.matrix[m + "." + t] = tr.v;
        // 重绘该格配色 + 最优行（不整表重绘以保留焦点）
        const td = sel.closest("td");
        td.className = tr.cls;
        save();
        renderStats(); refreshBestRow();
      } else if (sel.classList.contains("aff-knob")) {
        const k = sel.dataset.k; state.af[k] = num(sel.value, state.af[k]); save();
        C.setStatus("affinity", "旋钮 " + k + " = " + state.af[k]);
      }
    });
    // 名称编辑
    document.getElementById("afflist").addEventListener("input", e => {
      const inp = e.target;
      if (inp.classList.contains("aff-tname")) { state.af.themeNames[inp.dataset.k] = inp.value.trim() || inp.dataset.k; save(); refreshHeaders(); }
      else if (inp.classList.contains("aff-mname")) { state.af.mannerNames[inp.dataset.k] = inp.value.trim() || inp.dataset.k; save(); refreshHeaders(); }
    });
  }
  function refreshBestRow() {
    const T = state.af.themes;
    const row = document.querySelector("#afflist .aff-grid .aff-best");
    if (!row) return;
    row.innerHTML = `<th>当前最优</th>` + T.map(t => {
      const bm = bestManner(t); const tr = tierOfVal(val(bm, t));
      return `<td class="${tr.cls}">${mName(bm)}<br><small>${tr.label}</small></td>`;
    }).join("");
  }
  function refreshHeaders() {
    const T = state.af.themes, M = state.af.manners;
    const head = document.querySelector("#afflist .aff-grid tr:first-child");
    if (head) head.innerHTML = `<th>文风＼题材</th>` + T.map(t => `<th>${tName(t)}</th>`).join("");
    const body = document.querySelectorAll("#afflist .aff-grid tr");
    body.forEach((tr, i) => {
      if (i === 0 || tr.classList.contains("aff-best")) return;
      const th = tr.querySelector("th"); if (th) th.textContent = mName(M[i - 1]);
    });
    refreshBestRow();
  }

  /* ---------------- 启动 ---------------- */
  function init() {
    loadData();
    bind();
    renderList();
    global.AFFINITY._ready = true;
  }

  global.AFFINITY = { init, get: () => state.af, exportRaw, validateAll, importData, renderList, _ready: false };
})(window);
