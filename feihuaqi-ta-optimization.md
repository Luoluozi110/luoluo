# 桃花岛·飞花棋 —— 技术美术优化概览

> 角色：TechnicalArtist（美术 × 引擎 桥梁）。目标：在硬性能预算内提升美术效果。

## 一、现状诊断

- **渲染技术**：实时棋盘是 **DOM + CSS transform + 内联 SVG**（整盘一个缩放合成层）；只有「成绩图」用真 Canvas 2D。README 写的 "Canvas 2D" 与实际（DOM/SVG）有出入，但性能结论一致。
- **美术现状**：调色板令牌完整（桃花粉/宣纸/朱砂/金/青）、四季渐变、激活格辉光、胜局金光、纸纹 `.paper` 均已具备，完成度不低。
- **核心结论**：代码质量本身不差，优化集中在 **1 处真实性能隐患 + 2 处高确定性的美术提升**。

### 性能画像（移动/PC 双目标）
| 项目 | 现状 | 风险 |
|------|------|------|
| 棋子/影子移动 | `transition: left/top` + `setPiecePos` 写 `style.left/top` | **整盘是缩放合成层，每帧移动触发整盘 60+ 格子重排（layout thrash）** |
| 桃花瓣飘落 | `transform: translate3d` 动画 | OK，已是 compositor-only |
| `filter: drop-shadow` | 棋子与名胜 SVG 上用 live filter | 模糊 pass 会破坏合成层隔离（中危） |
| 成绩图 | 平涂 + 基础雷达 | 导出资产偏平，提升空间大 |

## 二、本次改动（3 项，行为保持、可回退）

### 1. 棋子移动消除 layout thrash（性能）★核心
- `js/ui/board.js` `setPiecePos`：`style.left/top` → `style.transform = translate(x,y)`
- `css/board.css` `#piece` / `#pieceShadow`：`transition: left/top` → `transition: transform` + `will-change: transform`
- 去掉 `#piece .piece-body` 的 `filter: drop-shadow`（PIECE_SVG 已自带阴影椭圆），避免模糊 pass 破坏合成层
- **收益**：整盘不再每帧重排，棋子移动零 layout，走 GPU 合成器。

### 2. 场景全局氛围调色层（美术，最高性价比）
- `#scene::before`：纸纹噪点（SVG `feTurbulence` data-URI，`mix-blend-mode: overlay`，opacity .38）
- `#scene::after`：暗角 vignette + 顶部暖光 bloom（纯径向渐变）
- 纯静态、`pointer-events: none`、一次性合成；花瓣 `z-index` 提到 4，置于氛围层之上不被压暗。
- 用已有 `--taohua/--zhu/--jin` 令牌，保证风格统一。

### 3. 成绩图 Canvas 质感升级（美术 / 玩家导出资产）
- 平涂底 → 宣纸渐变 + 左上暖光高光 + 极淡纸纤维
- 四角描金角饰
- 品级大字加柔光投影；雷达多边形下方加描金柔光（`shadowBlur`）
- 画面暗角收束
- 布局坐标完全保持，不影响预览与导出。

## 三、验证
- `node --check` 通过：`js/ui/album.js`、`js/ui/board.js`
- 本地预览服务器已启动：`http://127.0.0.1:8080/`（需 HTTP 访问，不能 `file://`）

## 四、T4 SVG 资产体积感（已做）
> 工程要点：内联 SVG 的 gradient/filter 在文档内 id 必须唯一。60+ 格子若各自内联同名 def 会全部错解析且产生非法重复 id。**改为一次性注入一份共享 `<defs>`（`ensureDefs()`），所有资产引用同一份** `ta-vol` / `ta-vol-lin` 渐变与 `ta-soft` / `ta-soft-lg` 柔影滤镜。
- **格子图标 `CELL_GLYPH`**：整组套 `filter="url(#ta-soft)"` 柔和投影，从格子里"浮"起来（原已两色调，叠加投影后体积感更明显）。
- **名胜建筑 `LANDMARK_ART`**：接触影脱离滤镜组单独绘制；建筑主体套 `ta-soft-lg`；顶部加白色高光椭圆、底部加暗部椭圆 → 上亮下暗的立体感。
- **流派徽记 `SCHOOL_EMBLEM`**：圆盘叠一层 `url(#ta-vol)` 径向体积（左上高光 + 边缘暗化）；整组 `ta-soft-lg` 投影。
- **棋子 `PIECE_SVG`（英雄资产）**：袍身/内袍/脸/帽改线性+径向渐变（上亮下暗）；左侧加白色缘光椭圆；脸颊高光；保留并加重烘焙软影。常驻可见，提升最明显。
- **性能边界**：柔影滤镜仅落在 ~10 个"对象"资产（4 名胜 + ≤5 徽记 + 1 棋子）+ 60 格子投影上；格子投影被整盘合成层缓存，仅在交互时局部重绘，非逐帧。移动端降级档可一键去除 `.cell .glyph` 投影（见下一步）。

## 五、下一步可选（按优先级）
- **VFX 强化**：灵感获取、落名胜、胜负的粒子爆发与拖尾（现有 `goldBurst` 可扩展为对象粒子）。
- **移动端性能预算**：低配档自动降级氛围层 + 花瓣数 + 格子投影；建立「每资产/每帧 draw 预算」文档。
- **资产预算规范**：把本次确定的渐变/柔影/调色板用法固化为《程序化美术资产规范》，新增资产（如未来题型图标）照此生产。

## 五、技术美术交付物清单
| 文件 | 改动 |
|------|------|
| `css/board.css` | 棋子 transform 化 + 全局氛围层 + 花瓣层级 |
| `js/ui/board.js` | `setPiecePos` 改 transform 定位 |
| `js/ui/album.js` | `drawScoreCard` 质感升级 |
| `js/ui/quality.js` | **新增** 设备分级 + 预算对象 + 探测/切换 |
| `js/ui/board.js` | `spawnPetals` 读预算 + `applyQuality()` 实时重生成 |
| `js/ui/app.js` | `boot` 启动分级；菜单「切换省电档/高画质」 |
| `css/board.css` | 新增 `html[data-quality="low"]` 降级覆盖 + reduced-motion |
| `js/ui/svg.js` | **新增** `glyphCell()`/`objGroup()` 助手；18 处手写柔影迁移到助手（输出一致） |
| `feihuaqi-art-spec.md` | **新增** 程序化美术资产规范（调色板/体积/工程红线/降级档/预算/新增图标 Recipe/验收清单） |

## 六、移动端性能预算 + 降级档（已做）

### 目标
把「移动端会不会掉帧」这个未知数用**自动降级档**锁死，并固化一份每资产/每帧的硬预算文档。改动保持行为一致、可一键实时切换、可回退。

### 设计原则
- **预算对象化**：每档的旋钮集中在 `quality.js` 的 `BUDGETS`，不散落各处。
- **CSS 驱动为主，实时生效**：柔影/氛围层/格子投影通过 `<html data-quality="low">` + CSS 覆盖关掉，运行时切换零重建。关键技巧——SVG 内部的 `filter` 是**呈现属性**，CSS 的 `filter` 属性优先级更高，故 `.cell .glyph g { filter: none }` 即可覆盖 T4 加的柔影，无需改 `svg.js` 字符串。
- **JS 驱动为辅**：花瓣数量这种生成期旋钮读 `getBudget().petals`，切换时 `board.applyQuality()` 移除旧花瓣并重生成。

### 档位对照（预算）
| 旋钮 | 高画质(high) | 省电档(low) | 关掉的意义 |
|------|------|------|------|
| 桃花瓣数 | 22 | 6 | 减少 compositor 层与动画数 |
| 格子图标柔影 `ta-soft` | 开 | **关** | 60+ 个 SVG `feDropShadow` 是移动端最贵的渲染项之一 |
| 名胜/徽记柔影 `ta-soft-lg` | 开 | **关** | 同上（数量少，次要） |
| 纸纹噪点 `#scene::before` | 开 | **关** | 全屏 `feTurbulence` + `mix-blend-mode:overlay` 每帧混合，移动端最贵 |
| 顶部暖光 bloom `#scene::after` | 开 | **关** | 仅留暗角，省一层径向混合 |
| 远山 `.far-hills` | 开 | **关** | 少一层大 SVG 填充 |
| 格子大模糊投影 `box-shadow 12px` | 开 | **关** | 60+ 格子各自大模糊填充，省电档降为无模糊厚度 |
| `will-change`（棋子） | 开 | **关** | 释放常驻合成层内存 |

### 每资产 / 每帧 draw 预算（移动端硬指标）
> 实时棋盘为 DOM + 内联 SVG（整盘一个缩放合成层），故「draw call」近似为**合成层数量 + 滤镜/大模糊填充面积**。

| 指标 | 高画质 | 省电档(目标) | 说明 |
|------|------|------|------|
| 常驻合成层（含花瓣） | ~28 | ~12 | 花瓣 22→6，其余为 UI 层 |
| 全屏滤镜/混合 pass | 2（噪点+暗角/bloom） | 0 | 省电档全屏仅暗角，无 blend |
| 带 `feDropShadow` 的 SVG 数 | ~78（60 格 + 4 名胜 + 5 徽记 + 9 图标引用） | ~0 | 柔影全关 |
| 大模糊 `box-shadow` 格子数 | 60+ | 0 | 改为无模糊厚度 |
| 单帧动画元素 | ~22 花瓣 + 提示光圈 | ≤6 花瓣 + 提示光圈 | 花瓣数受控 |

### 探测与覆盖优先级（启动）
1. **URL 覆盖**：`?quality=high` / `?quality=low`（调试/验收强制指定，最优先）
2. **记忆**：localStorage `feihuaqi_quality`（玩家上次手动选择）
3. **自动探测** `detectTier()`：
   - `prefers-reduced-motion: reduce` → 省电档（无障碍）
   - `pointer: coarse`（触摸）且（屏幕短边 < 760 或 `hardwareConcurrency ≤ 4`）→ 省电档
   - `hardwareConcurrency ≤ 4` 且 `deviceMemory ≤ 4` → 省电档
   - 否则 → 高画质
- 结果写入 `<html data-quality>`，CSS 即时生效；偏好同时写回 localStorage。

### 实时切换
- 菜单新增「切换省电档 / 高画质」按钮 → `setTier(other)` 改属性 + 记忆 → `board.applyQuality()` 按新预算重生成花瓣 → 重开菜单刷新标签。
- CSS 部分（柔影/氛围/投影）随 `data-quality` 属性**同一帧**生效，无需刷新页面。

### 验证
- 强制省电档预览：`http://127.0.0.1:8088/?quality=low`
- 强制高画质预览：`http://127.0.0.1:8088/?quality=high`
- 真机/DevTools 设备模拟（如 iPhone）默认走自动探测 → 省电档；PC 默认高画质。
- 预期：省电档下格子图标无投影、无纸纹噪点、无顶部暖光、花瓣明显减少、格子投影变扁。

## 七、下一步可选（剩余）
- **VFX 强化**：灵感获取 / 落名胜 / 胜负的粒子爆发与拖尾（`goldBurst` 扩为对象粒子，带 overdraw 预算约束）。
- **低端机型 further**：若省电档在 ultra-low 设备仍吃力，可加第三档 `min`（纯色格、去所有 SVG 渐变体积、去花瓣）。

## 八、已完成资产规范（已做）
- 详见 **`feihuaqi-art-spec.md`**：把本次 TA pass 确定的调色板令牌、体积感渐变、共享 `ta-*` defs、SVG 工程红线（id 唯一 / 助手包裹柔影）、降级档性能红线（SVG 内部 `filter` 呈现属性以便 CSS 覆盖）、每资产预算、新增题型图标标准流程（Recipe）、提交前验收清单，全部固化为可复用生产标准。
- 代码侧配套：`svg.js` 新增 `glyphCell()`（格子图标）/`objGroup()`（名胜/徽记）助手，原 18 处手写 `filter="url(#ta-soft...)"` 字面量迁移到助手，输出字节一致、降级档钩子不变。后续新增资产照助手生产即自动合规。

## 九、字体与 UI 清晰度优化（已做）
目标：让字体**更清晰**，并引入古色古香的**明朝体**（用户点名「汇文明朝体」）。

### 1. 字体栈（base.css `:root`）
- `--font-song`（主字体 / 正文 / 交互）：
  `"汇文明朝体", "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, SimSun, "宋体", serif`
  - 优先级：用户正版「汇文明朝体」> 网页思源宋体（SIL 开源、CJK hinting 极佳）> 系统宋体回退。
- `--font-kai`（书法点缀 / 标题）：在 Kaiti 之后接 `Noto Serif SC`，使无楷体环境也回落清晰明朝体而非位图宋体。

### 2. 网页明朝体（index.html）
- 引入 **Noto Serif SC**，经 `unicode-range` 智能分片，**仅下载页面实际用到的字形**（不是整包 15MB），离线时自动回退系统宋体。
- 双镜像 `preconnect` + `stylesheet`（`fonts.googleapis.com` / `fonts.googleapis.cn`），兼顾国内可达性与全球回退；`display=swap` 不阻塞首屏。
- **关于「汇文明朝体」**：属商业字体，未随包分发；置于字体栈最前——若用户本地已装正版即优先启用，否则无缝落到思源宋体。如需离线必用，可后续把该字体 woff2 自托管进 `fonts/`（见下方备注）。

### 3. 全局渲染优化（零网络依赖，对所有字体生效）
- `-webkit-font-smoothing: antialiased` + `-moz-osx-font-smoothing: grayscale`：macOS 下去除亚像素粗边、立刻更锐利；Windows/DirectWrite 下无副作用。
- `text-rendering: optimizeLegibility`：启用字距微调。
- `font-synthesis: weight style`：缺字重时合成而非缺显。
- `button, input, textarea, select { font-family: inherit }`：修复浏览器默认用系统字体覆盖按钮文字导致发虚的隐患。

### 4. 字体层级（清晰正文 + 书法标题）
- **明朝体（song）**：`html/body` 默认、`.btn`、`.opt`、`.pick`、`.at-btn`、`.cx-tab`、`.replace-item`、`.album-card`、数值类（`.timer-num`/`.cd-num`/`.score-total b` 等）、canvas 成绩图。
- **楷体（kai）点缀**：`.title-ink`、`.grade-scroll .gname`（等第大字）、`.school-card h3`（流派名）、`.event-card h3`、`.modal .mtitle h2`、`.cx-tier-h`（分卷标题）。
- 成绩图 canvas：`album.js` 的 `CANVAS_FONT` 常量同步改为明朝体栈，保证图像内中文同款清晰。

### 5. 验证
- `node --check` 通过；字体令牌 / 平滑 / form-inherit 全部就位。
- 预览：`http://127.0.0.1:8088/`（思源宋体已随包自托管，**断网亦用**；DevTools → Elements → Computed → `font-family` 可见最终解析栈）。
- 想强制核对：DevTools 看 Computed `font-family`；Network 面板可见 `NotoSerifSC-400/700.woff2` 被加载（HTTP 200，约 4 MB/档，字节与源文件一致）。

### 6. 字体自托管（已做，断网可用）
- **来源**：本机 `C:/Windows/Fonts/NotoSerifSC-VF.ttf`（思源宋体可变字体）。用 `fontTools` 实例化出 **400 / 700** 两档静态字重，再子集化到「**GBK 全字符集（约 2.1 万汉字）+ 游戏静态文本 + 标点/全角**」（共 ~22046 字形），压成 woff2。
- **产物**：`feihuaqi-playable/fonts/noto-serif-sc/NotoSerifSC-400.woff2`（≈4.09 MB）、`NotoSerifSC-700.woff2`（≈4.23 MB）。已用 `fontTools` 校验：woff2 magic 有效、样例汉字（花诗棋桃花岛·周小满饕餮龘）全覆盖；仅极生僻 CJK Ext-B 字（如 𠮷）回落系统字体，玩家名常用字不漏。
- **接线**：`base.css` 顶部加两条 `@font-face`（family `"Noto Serif SC"`，`src: url("../fonts/noto-serif-sc/...woff2")`，`font-display: swap`）；`index.html` 移除 Google Fonts CDN 链接，不再有外部网络依赖。
- **汇文明朝体**：**不建** `@font-face`——字体栈最前的 `"汇文明朝体"` 会优先匹配你**本机已安装**的正版；未装则自动落到自托管思源宋体（避免缺失 woff2 反而截断回退）。若要把汇文明朝体也随包离线分发，把正版 woff2 放入 `feihuaqi-playable/fonts/` 并补一条 `@font-face`（family 名取 `"汇文明朝体"`）即可，字体栈无需改。
- **复现**：`build_subset_fonts.py`（workspace 根目录）收集游戏文本 + GBK；再用 `fontTools varLib.instancer` + `fontTools.subset --flavor=woff2` 生成字体。
- **体积提示**：两档合计 ~8.3 MB，首次加载后由浏览器缓存；属一次性静态资源，不影响运行时帧率（与「移动端降级档」管的是渲染开销互不冲突）。

> 备注：自托管字体已落地（见 §6），`index.html` 不再引用任何 CDN。

## 十、响应式适配 + 描边统一 + 降级档资源/渲染适配（已做）

> 对应需求三条：① 不同显示尺寸的响应式布局与元素缩放适配；② 统一规范所有图形/图标描边粗细、颜色、样式；③ 低端/降级档资源与渲染适配（简化图形、降低精度、替换轻量素材），各档位视觉一致且功能完整。

### 1. 描边统一（CSS 令牌化，覆盖全部 SVG 资产）
- **令牌**（`css/base.css` `:root`）：描边色板 `--s-jin/--s-zhu/--s-qing/--s-taohua/--s-mo/--s-green/--s-blue/--s-gold/--s-brown/--s-white/--s-purple/--ln` + 三档粗细 `--sw-1/2/3`（细 1.1 / 常规 1.6 / 强调 2.6）。
- **工具类**（`css/board.css`）：`.ta-{色}` 定 `stroke`、`.ta-1/2/3` 定 `stroke-width`；`[class*="ta-"]` 基础粗细落到 `--sw-2`。**CSS 优先级 > SVG 呈现属性**，故降级档可用一条规则改全资产粗细，无需改 `svg.js` 字符串。
- **资产迁移**（`js/ui/svg.js`）：原 18 处手写 `stroke="#hex" stroke-width="N"`（散布 13 档数值）全部改 `class="ta-色 ta-粗细"`，吸附到三档粗细 + 主调色板。新增资产走 `glyphCell()`/`objGroup()` 助手即自动合规。
- **补齐英雄资产**：棋子嘴部（`board.js` PIECE_SVG）、六维雷达顶点白描边（`hud.js` radarSVG）的残留 `stroke="#"` 字面量一并迁移到 `ta-brown ta-1` / `ta-white ta-1`，做到"所有图形与图标"零硬编码描边。
- **fill 不动**：颜色填充仍是字面量（仅描边走令牌，符合需求范围）。

### 2. 响应式布局与元素缩放适配
- **棋盘缩放已有**：`board.js` `fit()` 按视口算 `bscale` 铺满（留 5% 边距）；UI 媒体查询（1180 / 780 短屏 / 600 / 380px）重排 HUD、战斗台、结算页、弹窗内边距早已就位。
- **动态视口补齐**（`board.js` `build()` 新增 `_buildResponsive()`）：
  - `window.resize` → `rescale()`（仅重算 `bscale`，**保留用户平移/缩放手势状态**，不强行复位）；
  - `orientationchange` → 下一帧 `rescale()`（旋转后尺寸滞后一帧）；
  - `visualViewport.resize` → rAF 节流 `rescale()`（**覆盖移动端地址栏显隐**——它改变视觉视口高度却不总触发 `window.resize`）。
  - `rescale()` 与 `fit()` 共用缩放公式，差异仅在是否复位手势态。

### 3. 降级档资源/渲染适配（各档视觉一致、功能完整）
- **预算契约**（`js/ui/quality.js` `BUDGETS`）：新增 `flatGraphics` / `blur` / `precision` 三档位标志，与既有 `petals/glyphShadow/...` 并列。
  - `high`：`flatGraphics:false, blur:true, precision:'high'`；
  - `low`：`flatGraphics:true, blur:false, precision:'low'`。
  - 新增 `precisionScale()`：high→`min(devicePixelRatio,2)`、low→锁 `1`，供画布读取。
- **CSS 驱动（实时生效）**（`css/board.css` `html[data-quality="low"]`）：
  - 描边统一到最细 `--sw-1`；
  - 拍平体积渐变→实色（格子按四季/类型实色背景、浮岛实色、`emblem svg [fill="url(#ta-vol)"]` 改半透明白）；
  - 关闭最贵的 `backdrop-filter` 模糊（overlay / veil / 各全屏界面）；
  - 关闭柔影/噪点/远山/大模糊投影（原有项保留）。
  - **所有元素仍保留、仅降本**，功能与可读性不丢。
- **JS 驱动（精度）**：`album.js` 成绩图 `drawScoreCard` 读 `precisionScale()`——高分档按 DPR 提 backing-store 更锐利，省电档锁 1x 降显存与 `toDataURL` 体积；逻辑坐标仍按 800×450 绘制，CSS 已按宽高比自适应显示，无变形。

### 4. 验证
- `node --check`：svg / board / quality / album / hud 五个模块语法全过。
- 运行时校验（`validate.mjs` 导入 `svg.js`）：CELL_GLYPH(9) / LANDMARK_ART(4) / SCHOOL_EMBLEM(5) 全部含 `ta-` 类、无 `stroke="#"` 字面量 → `SVG_TOKENS_OK`。
- 全仓复扫：仅剩 `base.css` 注释提及"禁止手写 stroke 字面量"（无实际硬编码描边残留）。
- 切档路径：`?quality=low` / `localStorage` 记忆 / 菜单按钮 `setTier()` → `board.applyQuality()` 实时换瓣数 + CSS 覆盖；元素无需重建。
