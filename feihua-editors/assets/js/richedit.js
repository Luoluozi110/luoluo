/* =========================================================================
 * richedit.js — 叙事文案富文本编辑器（编辑器内闭环）
 * ---------------------------------------------------------------------------
 * 设计约束（与游戏端保持一致，避免污染数据）：
 *  · 游戏端 personalize() 仅做「你」→名号的纯文本替换，不渲染 Markdown/HTML。
 *  · 因此本编辑器仅在「编辑器内」提供富文本体验：
 *      - 工具栏插入受控 Markdown 子集（**粗** *斜* # 标题 > 引用 - 列表 --- 分隔）；
 *      - 素材面板插入游戏语义令牌（第二人称「你」、章节标题、引用、落款、徽记/稀有度令牌）；
 *      - 预览区按游戏墨纸风格实时渲染以上标记，并解析 {emblem}/{rarity} 令牌为视觉片。
 *  · 写入数据文件的仍是可读纯文本（「你」替换机制不受影响）；
 *    游戏端渲染层是否消费 Markdown/令牌为后续可选增强，本文件不改游戏代码。
 *
 * 接入方式（零侵入现有读写契约）：
 *  · 任意 <textarea data-rich> 会被自动包裹为 .rich-editor（工具栏+素材面板+预览），
 *    原 textarea 的 id / name / data-path / class 全部保留，模块 readForm/save 照常工作。
 *  · 通过 MutationObserver + 显式 enhanceAll 双保险覆盖：初始渲染、列表重渲染、弹窗打开。
 * ========================================================================= */
(function (global) {
  "use strict";

  var C = global.Common;
  var doc = global.document;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------- 迷你 Markdown 渲染（先转义，再套规则） ---------------- */
  function renderMarkdown(src) {
    var lines = String(src == null ? "" : src).split(/\r?\n/);
    var html = "";
    var inList = false, listType = "";
    function closeList() { if (inList) { html += "</" + listType + ">"; inList = false; } }
    function inline(t) {
      t = esc(t);
      t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      t = t.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      t = t.replace(/\{\{emblem:([a-z0-9_一-龥]+)\}\}/gi,
        "<span class=\"re-chip re-emblem\" title=\"流派徽记（预览增强）\"><svg viewBox=\"0 0 16 16\" width=\"13\" height=\"13\" aria-hidden=\"true\"><path d=\"M8 1l2.1 1.6 2.6-.3 1 2.5 2.3 1.2-1 2.5 1 2.5-2.3 1.2-1 2.5-2.6-.3L8 15l-2.1-1.6-2.6.3-1-2.5L0 10.3l1-2.5-1-2.5 2.3-1.2 1-2.5 2.6.3z\" fill=\"currentColor\"/><circle cx=\"8\" cy=\"8\" r=\"3\" fill=\"#fff\"/></svg><span>$1</span></span>");
      t = t.replace(/\{\{rarity:([a-z]+)\}\}/gi,
        "<span class=\"re-chip re-rarity r-$1\">$1</span>");
      return t;
    }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/^\s*---\s*$/.test(line)) { closeList(); html += '<hr class="re-hr">'; continue; }
      var m;
      if ((m = line.match(/^(#{1,3})\s+(.*)$/))) {
        closeList(); var lvl = m[1].length;
        html += "<h" + (lvl + 2) + ' class="re-h">' + inline(m[2]) + "</h" + (lvl + 2) + ">"; continue;
      }
      if (/^\s*>\s?/.test(line)) {
        closeList();
        html += '<blockquote class="re-quote">' + inline(line.replace(/^\s*>\s?/, "")) + "</blockquote>"; continue;
      }
      if ((m = line.match(/^\s*[-*]\s+(.*)$/))) {
        if (!inList || listType !== "ul") { closeList(); html += '<ul class="re-ul">'; inList = true; listType = "ul"; }
        html += "<li>" + inline(m[1]) + "</li>"; continue;
      }
      if ((m = line.match(/^\s*\d+\.\s+(.*)$/))) {
        if (!inList || listType !== "ol") { closeList(); html += '<ol class="re-ol">'; inList = true; listType = "ol"; }
        html += "<li>" + inline(m[1]) + "</li>"; continue;
      }
      if (line.trim() === "") { closeList(); continue; }
      closeList();
      html += '<p class="re-p">' + inline(line) + "</p>";
    }
    closeList();
    return html;
  }

  /* ---------------- 选区/光标操作 ---------------- */
  function surround(ta, pre, post) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    var sel = v.slice(s, e) || "文本";
    ta.value = v.slice(0, s) + pre + sel + post + v.slice(e);
    ta.focus();
    ta.selectionStart = s + pre.length; ta.selectionEnd = s + pre.length + sel.length;
    ta.dispatchEvent(new global.Event("input", { bubbles: true }));
  }
  function linePrefix(ta, pre) {
    var s = ta.selectionStart, v = ta.value;
    var ls = v.lastIndexOf("\n", s - 1) + 1;
    ta.value = v.slice(0, ls) + pre + v.slice(ls);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = s + pre.length;
    ta.dispatchEvent(new global.Event("input", { bubbles: true }));
  }
  function insertAtCursor(ta, text) {
    var s = ta.selectionStart, e = ta.selectionEnd, v = ta.value;
    ta.value = v.slice(0, s) + text + v.slice(e);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.dispatchEvent(new global.Event("input", { bubbles: true }));
  }

  /* ---------------- 工具栏 / 素材定义 ---------------- */
  var FORMAT_BTNS = [
    { label: "粗体", title: "加粗选中文字（**）", fn: function (ta) { surround(ta, "**", "**"); } },
    { label: "斜体", title: "斜体选中文字（*）", fn: function (ta) { surround(ta, "*", "*"); } },
    { label: "标题", title: "本行设为章节小标题（#）", fn: function (ta) { linePrefix(ta, "# "); } },
    { label: "引用", title: "本行设为引用块（>）", fn: function (ta) { linePrefix(ta, "> "); } },
    { label: "列表", title: "本行前加无序列表项（-）", fn: function (ta) { linePrefix(ta, "- "); } },
    { label: "编号", title: "本行前加有序列表项（1.）", fn: function (ta) { linePrefix(ta, "1. "); } },
    { label: "分隔", title: "插入分隔线（---）", fn: function (ta) { insertAtCursor(ta, "\n---\n"); } },
    { label: "换行", title: "插入换行", fn: function (ta) { insertAtCursor(ta, "\n"); } }
  ];
  var ASSET_BTNS = [
    { label: "第二人称「你」", title: "游戏端会把「你」替换为玩家名号", fn: function (ta) { insertAtCursor(ta, "你"); } },
    { label: "章节小标题", title: "插入章节标题标记", fn: function (ta) { insertAtCursor(ta, "# "); } },
    { label: "引用块", title: "插入引用块标记", fn: function (ta) { insertAtCursor(ta, "> "); } },
    { label: "分隔线", title: "插入分隔线", fn: function (ta) { insertAtCursor(ta, "\n---\n"); } },
    { label: "诗签落款", title: "插入诗签式落款（——「你」）", fn: function (ta) { insertAtCursor(ta, "\n——「你」"); } },
    { label: "流派徽记", title: "插入流派徽记令牌（预览增强）", fn: function (ta) { insertAtCursor(ta, "{{emblem:墨}}"); } },
    { label: "稀有度", title: "插入稀有度令牌（预览增强）", fn: function (ta) { insertAtCursor(ta, "{{rarity:legend}}"); } },
    { label: "点缀 ✦", title: "插入装饰点缀符号", fn: function (ta) { insertAtCursor(ta, "✦"); } }
  ];

  function makeBtn(label, title, handler, ta) {
    var b = doc.createElement("button");
    b.type = "button";
    b.className = "re-btn";
    b.textContent = label;
    if (title) b.title = title;
    b.addEventListener("click", function (e) { e.preventDefault(); handler(ta); });
    return b;
  }

  /* ---------------- 单体增强 ---------------- */
  function enhance(ta) {
    if (!ta || ta.dataset.richEnhanced) return;
    ta.dataset.richEnhanced = "1";
    var kind = ta.dataset.rich || "narrative";

    var wrap = doc.createElement("div");
    wrap.className = "rich-editor";
    wrap.setAttribute("data-re-kind", kind);

    var bar = doc.createElement("div");
    bar.className = "re-toolbar";
    FORMAT_BTNS.forEach(function (def) { bar.appendChild(makeBtn(def.label, def.title, def.fn, ta)); });
    var assetToggle = makeBtn("素材", "展开/收起游戏素材插入面板", function () {
      assets.hidden = !assets.hidden;
      assetToggle.classList.toggle("active", !assets.hidden);
      assetToggle.setAttribute("aria-expanded", String(!assets.hidden));
    }, ta);
    assetToggle.setAttribute("aria-expanded", "false");
    bar.appendChild(assetToggle);

    var body = doc.createElement("div");
    body.className = "re-body";
    var fieldWrap = doc.createElement("div");
    fieldWrap.className = "re-field";
    ta.parentNode.insertBefore(wrap, ta);
    fieldWrap.appendChild(ta); // 原 textarea 节点保留，id/data-path/class 不变
    body.appendChild(fieldWrap);

    var prevCol = doc.createElement("div");
    prevCol.className = "re-preview-col";
    var prevHead = doc.createElement("div");
    prevHead.className = "re-preview-head";
    prevHead.innerHTML = "<span>预览 · 游戏风格</span><small>编辑器内效果；游戏端按纯文本+名号替换呈现</small>";
    var prev = doc.createElement("div");
    prev.className = "re-preview";
    prevCol.appendChild(prevHead);
    prevCol.appendChild(prev);
    body.appendChild(prevCol);

    var assets = doc.createElement("div");
    assets.className = "re-assets";
    assets.hidden = true;
    var assetsHint = doc.createElement("p");
    assetsHint.className = "re-assets-hint";
    assetsHint.textContent = "下列令牌以可读标记写入数据；「徽记 / 稀有度」为编辑器内预览增强，游戏端渲染层后续可消费。";
    assets.appendChild(assetsHint);
    var assetsGrid = doc.createElement("div");
    assetsGrid.className = "re-assets-grid";
    ASSET_BTNS.forEach(function (def) { assetsGrid.appendChild(makeBtn(def.label, def.title, def.fn, ta)); });
    assets.appendChild(assetsGrid);

    wrap.appendChild(bar);
    wrap.appendChild(body);
    wrap.appendChild(assets);

    function update() { prev.innerHTML = renderMarkdown(ta.value); }
    ta.addEventListener("input", update);
    update();
  }

  function enhanceAll(root) {
    if (!root || !root.querySelectorAll) return;
    var list = root.querySelectorAll("textarea[data-rich]:not([data-rich-enhanced])");
    for (var i = 0; i < list.length; i++) {
      try { enhance(list[i]); } catch (e) { /* 单域失败不影响其它 */ }
    }
  }

  /* ---------------- 自动覆盖（初始渲染 + 重渲染 + 弹窗） ---------------- */
  function initObserver() {
    if (typeof global.MutationObserver === "undefined") return;
    try {
      var obs = new global.MutationObserver(function () {
        try { enhanceAll(doc); } catch (e) {}
      });
      obs.observe(doc.body || doc.documentElement, { childList: true, subtree: true });
    } catch (e) { /* jsdom/旧环境降级：仅依赖显式 enhanceAll */ }
  }

  var api = {
    enhance: enhance,
    enhanceAll: enhanceAll,
    renderMarkdown: renderMarkdown,
    initObserver: initObserver
  };
  if (C && typeof C === "object") C.richText = api;
  else { global.Common = global.Common || {}; global.Common.richText = api; }

  // 自启动：脚本在 body 末尾求值，静态弹窗 textarea 已存在；其余由 observer 兜底
  if (doc) {
    if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { enhanceAll(doc); initObserver(); });
    else { enhanceAll(doc); initObserver(); }
  }
})(window);
