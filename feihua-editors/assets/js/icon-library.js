/*
 * 飞花棋 · 内容图标库
 * 图标值保持为短文本/emoji，和 board.json、sky.json 的现有 icon 字段兼容。
 */
(function (global) {
  "use strict";

  const GROUPS = [
    {
      id: "sky", label: "天象格", hint: "晴雨、月相、星宿与特殊天象",
      items: [
        { id: "sun", value: "☀️", label: "晴日", note: "晴空" },
        { id: "sunrise", value: "🌅", label: "霞光", note: "日出" },
        { id: "sunset", value: "🌇", label: "晚霞", note: "日落" },
        { id: "moon-full", value: "🌕", label: "月圆", note: "满月" },
        { id: "moon-crescent", value: "🌙", label: "新月", note: "月牙" },
        { id: "eclipse", value: "🌑", label: "月蚀", note: "暗月" },
        { id: "stars", value: "✨", label: "星辉", note: "群星" },
        { id: "star", value: "⭐", label: "文曲", note: "星宿" },
        { id: "meteor", value: "☄️", label: "流星", note: "陨星" },
        { id: "galaxy", value: "🌌", label: "天河", note: "银河" },
        { id: "rainbow", value: "🌈", label: "虹霓", note: "彩虹" },
        { id: "cloud", value: "☁️", label: "云气", note: "云层" },
        { id: "rain", value: "🌧️", label: "梅雨", note: "细雨" },
        { id: "storm", value: "⛈️", label: "雷雨", note: "风雨" },
        { id: "thunder", value: "⚡", label: "雷鸣", note: "电光" },
        { id: "snow", value: "❄️", label: "飞雪", note: "寒雪" },
        { id: "wind", value: "🌪️", label: "风起", note: "旋风" },
        { id: "fog", value: "🌫️", label: "烟霭", note: "雾气" },
        { id: "halo", value: "🌤️", label: "日晕", note: "薄云" }
      ]
    },
    {
      id: "board", label: "棋盘格", hint: "起点、路径、事件与论战",
      items: [
        { id: "start", value: "🏁", label: "起点", note: "启程" },
        { id: "ping", value: "🟢", label: "平韵", note: "平" },
        { id: "ze", value: "⚫", label: "仄韵", note: "仄" },
        { id: "quiz", value: "❓", label: "考题", note: "问答" },
        { id: "event", value: "🎭", label: "奇遇", note: "抉择" },
        { id: "battle", value: "⚔️", label: "论战", note: "对决" },
        { id: "branch", value: "🔀", label: "岔路", note: "分支" },
        { id: "landmark", value: "📍", label: "名胜", note: "地标" },
        { id: "mountain", value: "⛰️", label: "山门", note: "山岳" },
        { id: "river", value: "🌊", label: "江流", note: "水路" },
        { id: "temple", value: "⛩️", label: "古祠", note: "庙宇" },
        { id: "lantern", value: "🏮", label: "灯市", note: "灯火" }
      ]
    },
    {
      id: "content", label: "内容扩展", hint: "名篇、文心与叙事素材",
      items: [
        { id: "flower", value: "🌸", label: "落花", note: "花信" },
        { id: "bamboo", value: "🎋", label: "修竹", note: "竹影" },
        { id: "leaf", value: "🍃", label: "清风", note: "叶影" },
        { id: "book", value: "📜", label: "书卷", note: "典籍" },
        { id: "brush", value: "🖌️", label: "笔墨", note: "创作" },
        { id: "ink", value: "🖋️", label: "砚台", note: "文房" },
        { id: "wine", value: "🍶", label: "清酒", note: "雅集" },
        { id: "tea", value: "🍵", label: "香茗", note: "品茗" },
        { id: "music", value: "🎵", label: "弦歌", note: "声律" },
        { id: "seal", value: "🔖", label: "书签", note: "收藏" },
        { id: "crown", value: "🏆", label: "金榜", note: "成就" },
        { id: "spark", value: "✦", label: "星纹", note: "默认" }
      ]
    }
  ];

  const all = GROUPS.flatMap(group => group.items.map(item => ({ ...item, group: group.id, groupLabel: group.label })));
  const esc = value => String(value == null ? "" : value)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  function groups(ids) {
    if (!Array.isArray(ids) || !ids.length) return GROUPS;
    const wanted = new Set(ids);
    return GROUPS.filter(group => wanted.has(group.id));
  }
  function pickerMarkup(groupIds) {
    return groups(groupIds).map(group => `
      <section class="icon-picker-group" data-icon-group="${esc(group.id)}">
        <div class="icon-picker-group-head"><b>${esc(group.label)}</b><span>${esc(group.hint)}</span></div>
        <div class="icon-picker-grid">
          ${group.items.map(item => `<button type="button" class="icon-picker-btn" data-icon-value="${esc(item.value)}" title="${esc(item.label)}：${esc(item.note)}" aria-label="${esc(item.label)} ${esc(item.value)}"><span class="icon-picker-glyph">${esc(item.value)}</span><span class="icon-picker-label">${esc(item.label)}</span></button>`).join("")}
        </div>
      </section>`).join("");
  }
  function sync(container, value) {
    const current = String(value || "");
    container.querySelectorAll(".icon-picker-btn").forEach(button => {
      button.classList.toggle("selected", button.dataset.iconValue === current);
    });
  }
  function mount(container, input, groupIds) {
    if (!container || !input) return;
    container.innerHTML = `<div class="icon-picker-head"><span>图标库</span><button type="button" class="icon-picker-clear">清除</button></div>${pickerMarkup(groupIds)}`;
    if (container.dataset.iconPickerBound !== "1") {
      container.addEventListener("click", event => {
        const button = event.target.closest(".icon-picker-btn");
        if (button) {
          input.value = button.dataset.iconValue || "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          sync(container, input.value);
          return;
        }
        if (event.target.closest(".icon-picker-clear")) {
          input.value = "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          sync(container, "");
        }
      });
      input.addEventListener("input", () => sync(container, input.value));
      input.addEventListener("change", () => sync(container, input.value));
      container.dataset.iconPickerBound = "1";
    }
    sync(container, input.value);
  }
  function mountFor(inputId, groupIds) {
    const input = document.getElementById(inputId);
    if (!input) return null;
    if (inputId === "sky-icon" && input.parentNode && input.parentNode.style) input.parentNode.style.maxWidth = "360px";
    const pickerId = inputId.replace(/[^a-z0-9_-]/gi, "") + "Picker";
    let container = document.getElementById(pickerId);
    if (!container) {
      container = document.createElement("div");
      container.id = pickerId;
      container.className = "icon-picker";
      container.setAttribute("aria-label", "内容图标库");
      input.parentNode.appendChild(container);
    }
    mount(container, input, groupIds);
    return container;
  }
  global.IconLibrary = { groups: GROUPS, all, find: id => all.find(item => item.id === id) || null, findByValue: value => all.find(item => item.value === value) || null, pickerMarkup, mount, mountFor };
})(window);
