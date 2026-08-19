# 桃花岛·飞花棋 —— 程序化美术资产规范

> 角色：TechnicalArtist。适用范围：本作**全部程序化美术资产**——内联 SVG 图标、名胜建筑、流派徽记、棋子、全局氛围层。
> 目标：让美术与开发有一份**共同遵守的生产标准**，新增题型图标 / 名胜 / 流派时照此生产，不返工、不破坏性能预算、不引入重复 id。

---

## 一、设计语言与调色板令牌

所有资产取色**优先使用 `base.css` 的令牌变量**；仅在一次性渐变 `stop` 内允许内联色值（仍须在本规范登记）。

| 令牌 | 含义 | 典型用途 |
|------|------|----------|
| `--taohua` | 桃花粉（主色） | 花瓣、提示光圈、landmark 描边 |
| `--taohua-deep` | 桃花深粉 | landmark 边框强调 |
| `--zhu` | 朱砂红 | 战斗格、骰子点、印章 |
| `--jin` | 金 | 描金角饰、暖光、品级字投影 |
| `--qing` | 青 | 天象格、水色 |
| `--xuanzhi` | 宣纸底 | 棋子脸、卷轴、卡片纸面 |
| `--mo-1..3` | 墨色层级（由深到浅） | 文字、说明、暗部 |

**规则**
- 资产主体描边/填充优先用令牌；渐变 `stop` 内联色值须落在既有色系内（粉/朱/金/青/墨/宣纸），不得引入突兀新色。
- 四季边（春绿 / 夏青 / 秋橙 / 冬蓝 / 支线粉）沿用 `board.css` 既有线性渐变，新增季节向沿用同饱和度。

---

## 二、体积感与渐变规范

国风扁平资产也要"立得住"，体积感来自三要素，**不是靠模糊阴影堆出来**：

1. **上亮下暗**：主体用 `linearGradient`（y 方向，顶亮底暗）或 `radialGradient`（左上高光、边缘暗化）。
2. **顶高光**：受光面加一个白色低透明度椭圆（如 `fill="#fff" opacity=".14"`）。
3. **底暗部 / 接触影**：背光面加暗部椭圆；落地资产加一个 `rgba(0,0,0,.28)` 接触影椭圆（**脱离柔影滤镜组单独绘制**，见 §三）。

**共享体积资源（禁止每资产自带同名 def）**
所有可复用渐变/柔影集中在 `svg.js` 的 `ensureDefs()` 一次性注入的隐藏 `<defs id="ta-defs">`：
- `ta-vol`：径向体积（左上高光 + 边缘暗化），用于圆形徽记盘面。
- `ta-vol-lin`：线性体积，备用。
- `ta-soft`：轻柔影 `feDropShadow`（dy1.4 / std1.3 / op.3），用于格子图标。
- `ta-soft-lg`：较重柔影（dy3 / std3 / op.36），用于名胜 / 徽记等"对象"资产。

**英雄资产（棋子）**：用烘焙软影椭圆（`rx13 ry3.4 rgba(0,0,0,.3)`）替代 live `filter:drop-shadow`，避免模糊 pass 破坏整盘合成层。

---

## 三、SVG 工程红线（必读，违反即打回）

1. **id 全局唯一**：内联 SVG 的 `gradient`/`filter` id 在文档作用域内必须唯一。60+ 格子若各自内联同名 `def`，会使 `url(#id)` 全部解析到第一个且产生非法重复 id。**一律引用共享的 `ta-*` 资源，不在循环/格子内联 def。**
2. **柔影必须走助手**：所有对象资产用 `glyphCell()`（格子图标）或 `objGroup()`（名胜/徽记）包裹柔影，**禁止手写 `filter="url(#ta-soft...)"` 字面量**。助手保证：
   - 引用共享 `ta-*`，无重复 id；
   - 柔影写在内部 `<g filter>` **呈现属性**上，供降级档 CSS 覆盖（见 §四）。
3. **矢量坐标落在 viewBox 内**；统一 `stroke-linecap="round" stroke-linejoin="round"`（默认由 `S()` 提供）。
4. **接触影脱离滤镜组**：名胜落地影、棋子软影等"接触/烘焙"阴影画在 `<g filter>` 之外，不随柔影一起被降级关闭。

---

## 四、降级档（性能）红线

- 任何 SVG 柔影**必须写在元素内部的 `<g filter="url(#ta-soft...)">` 呈现属性上**，**不得**用 CSS `filter` 直接写在 `.glyph`/`.emblem` 等元素上——否则 `html[data-quality="low"]` 无法用一条 CSS 规则关闭它。
- 原理：SVG 的 `filter` 是**呈现属性**，优先级低于 CSS 的 `filter` 属性，故 `html[data-quality="low"] .cell .glyph g { filter: none !important }` 可实时关掉 60+ 格子的柔影，**零重建**。
- 新增一个题型图标 = 自动多一格子，自动继承省电档的柔影关闭；无需额外适配。
- 氛围层（纸纹 `#scene::before` / 暖光 bloom `#scene::after` / 远山 `.far-hills`）只在 `#scene` 层级，统一由 `data-quality` 控制，新增资产不另起全屏混合。

---

## 五、每资产性能预算（移动端硬指标）

实时棋盘为 **DOM + 内联 SVG（整盘一个缩放合成层）**，"draw call" 近似为**合成层数量 + 滤镜/大模糊填充面积**。省电档目标见下表（完整推导见 `feihuaqi-ta-optimization.md` §六）：

| 指标 | 高画质 | 省电档(目标) |
|------|------|------|
| 桃花瓣数 | 22 | 6 |
| 带 `feDropShadow` 的 SVG 数 | ~78 | 0 |
| 全屏滤镜/混合 pass | 2 | 0 |
| 大模糊 `box-shadow` 格子数 | 60+ | 0 |
| 单帧动画元素 | ~22+ | ≤6+ |

新增资产若引入新的全屏混合 / 逐帧模糊 / 大量重复柔影，必须先在 `quality.js` 的 `BUDGETS` 评估并补预算。

---

## 六、新增一个题型图标 —— 标准流程（Recipe）

> 以"新增一种格子类型 `foo`"为例，照抄即可，不改引擎即可上特效。

**Step 1 — 在 `svg.js` 的 `CELL_GLYPH` 注册矢量**
```js
import { glyphCell } from './svg.js'; // 实际在 svg.js 内部使用，无需重复 import

// 用 glyphCell 包裹：自动加 ta-soft 柔影 + 符合 §三/§四 红线
foo: glyphCell(`
  <circle cx="12" cy="12" r="8" fill="#cfe3d8" stroke="#5b8a6f" stroke-width="1.4"/>
  <path d="M9 12l2 2 4-4" stroke="#3f6f53" stroke-width="1.6" fill="none"/>
`),
```
- viewBox 默认 `0 0 24 24`；非标准尺寸传第二参：`glyphCell(inner, '0 0 32 32')`。
- 颜色优先令牌；此处内联色值须落在 §一 色系。

**Step 2 — 让类型可被识别（若引擎/棋盘有新 type 枚举）**
在 `rules.js` / `board.json` 的格子 `type` 映射加 `foo`，`addCell` 已按 `cell.type` 取 `glyph(type)`，无需改渲染代码。

**Step 3 — 专属配色（如需）**
优先复用 §一 令牌；若必须新色，仅在渐变 `stop` 内联，并在本规范 §一 表格登记，避免 stray 色值扩散。

**Step 4 — 自检**
```bash
node --check js/ui/svg.js
```
- 预览高画质：`?quality=high` → 图标有柔影、体积感。
- 预览省电档：`?quality=low` → 图标柔影被关、无纸纹/bloom、花瓣减少。
- 确认无新增 `id`（用了助手即自动满足）；`grep -n 'filter="url(#ta-soft' js/ui/svg.js` 应只出现在助手定义里。

**名胜 / 流派徽记**同理用 `objGroup(inner)`（包裹 `ta-soft-lg`）：
```js
foo: S(`<ellipse cx="32" cy="56" rx="26" ry="5" fill="rgba(0,0,0,.28)"/>`   // 接触影在滤镜组外
      + objGroup(`<path .../>`)                                              // 主体柔影
      + `<ellipse cx="32" cy="18" rx="11" ry="7" fill="#fff" opacity=".14"/>`, '0 0 64 62'),
```

---

## 七、提交前验收清单

- [ ] 柔影用 `glyphCell()` / `objGroup()` 包裹，**无手写 `filter="url(#ta-soft...)"` 字面量**
- [ ] 未引入新的 `gradient`/`filter` id（共用 `ta-*`；接触影等用 `rgba()` 而非新 filter）
- [ ] 颜色取自令牌，或新色值仅在渐变 `stop` 内联并在 §一 登记
- [ ] 体积感三要素齐备（上亮下暗 / 顶高光 / 底暗部或接触影）——如资产适用
- [ ] 通过 `node --check`
- [ ] `?quality=high` 与 `?quality=low` 下观感与性能符合 §五 预算
- [ ] 未新增全屏混合 / 逐帧模糊 / 大量重复柔影（如有，已在 `quality.js` 评估并补预算）

---

## 八、助手 API（实现于 `svg.js`）

```js
// 格子图标：包 ta-soft 柔影，viewBox 默认 0 0 24 24
export function glyphCell(inner, vb = '0 0 24 24') {
  return S(`<g filter="url(#ta-soft)">${inner}</g>`, vb);
}

// 对象资产（名胜/徽记）：包 ta-soft-lg 柔影，调用方自行 S(接触影 + objGroup(主体) + 高光, vb)
function objGroup(inner) {
  return `<g filter="url(#ta-soft-lg)">${inner}</g>`;
}
```
- `S(inner, vb)` 为本文件基础封装，产出 `<svg viewBox fill=none round ...>`。
- `ensureDefs()` 在 `board.build()` 与 `app.boot()` 各调用一次（幂等），注入共享 `ta-*` 资源；任何资产渲染前已就绪。
