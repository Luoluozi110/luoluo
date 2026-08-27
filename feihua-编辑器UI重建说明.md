# 内容编辑器 UI 重建 · 交付说明

## 目标
原内容编辑器（10 标签 IIFE 应用）功能完整，但所有文本域都是纯 `<textarea>`，**缺富文本工具栏、缺游戏素材插入面板、缺实时预览区**，窄屏也有隐患。本次按「原地现代化升级」重建编辑体验，保留 10 标签、导出契约与全部无头测试。

## 关键设计约束
游戏端 `personalize()` 仅做「你」→名号的**纯文本**替换，**不渲染 Markdown/HTML**。因此富文本采用**编辑器内闭环**：
- 工具栏插入受控 Markdown 子集（`**粗**` `*斜*` `# 标题` `> 引用` `- 列表` `--- 分隔`）；
- 素材面板插入游戏语义令牌（第二人称「你」、章节标题、引用、诗签落款、流派徽记 `{{emblem:墨}}`、稀有度 `{{rarity:legend}}`、点缀符号）；
- 预览区按游戏墨纸风格**实时渲染**以上标记，并解析 `{emblem}`/`{rarity}` 为视觉片。

> 写入数据文件的仍是可读纯文本，「你」替换机制与现有导出契约**完全不受影响**；游戏端渲染层是否消费 Markdown/令牌为后续可选增强（本次未改游戏代码）。

## 改动文件
| 文件 | 作用 |
|---|---|
| `assets/js/richedit.js`（新增） | 富文本编辑器模块，挂 `Common.richText`。`enhanceAll(root)` 扫描 `textarea[data-rich]` 包裹工具栏+素材面板+预览；`MutationObserver` + `openOverlay`/`refreshWorkspaceUI` 显式钩子双保险，覆盖初始渲染/重渲染/弹窗。原 textarea 的 `id`/`data-path`/`class` 全部保留，模块读写契约零侵入。 |
| `index.html` | 接入 `richedit.js` 脚本；给静态叙事域 `ev-text`/`tal-text`/`sky-text` 打 `data-rich`。 |
| `assets/js/common.js` | `openOverlay` 与 `refreshWorkspaceUI` 内显式调用 `enhanceAll`（与 observer 双保险）。 |
| `assets/js/copy.js` | `field()` 生成的叙事文案 textarea 全量打 `data-rich`。 |
| `assets/js/adventure.js` | 奇遇抉择「选项文案」「结算回声」打 `data-rich`。 |
| `assets/css/styles.css` | 新增 `.rich-editor` 全套样式（墨纸风、朱砂主色、桌面双栏正文∥预览、移动端单列堆叠、按钮≥44px、输入框≥16px、安全区适配），并保留既有响应式。 |

## 验证
- `tests/editor-smoke.mjs`：**189/189 通过**（10 模块初始化、隐藏终圈补齐、增删改→保存→localStorage 链路、配置契约全绿）——富文本增强零回归。
- `tests/_verify-richedit.mjs`（新增）：**21/21 通过**——`data-rich` 文本域被正确包裹、含工具栏与预览区、Markdown 渲染（标题/加粗/引用/列表/分隔）、第二人称保留、素材按钮插入不丢文本、叙事文案标签已增强。

## 使用方式
打开 `feihua-editors/index.html`：叙事型文本域（奇遇正文/抉择、文心正文、天象正文、叙事文案标签）上方出现工具栏，点「素材」展开游戏素材面板，右侧实时显示游戏风格预览。窄屏自动单列堆叠。

## 后续可选
- 游戏端加一个轻量 Markdown/令牌渲染层（HTML 先转义再套规则），让编辑器产出的富文本在游戏内真正呈现。
- 如需把编辑器本身部署为在线可访问页面，可走项目既有云端发布/资料库通道（本次未做，因编辑器已有 localStorage+JSON 导出+云端发布自有链路）。
