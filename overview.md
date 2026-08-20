# 传世名篇成长系统交付概览

## 已完成
- 将 12 张传世名篇升级为跨局 XP、Lv1-Lv4、双路线成长配置；保留旧 reward 字段兼容。
- 引擎接入名篇路线选择与效果执行：start、battle、quiz、event、phase、score；支持灵感、心得、稿本、筹策、研修位、技法经验、属性和百分比作品修正。
- 路线选择跨局保存并锁定；旧存档自动补齐并清洗 albumState，避免坏数据影响对局。
- 游戏端图鉴 / 装配界面展示名篇等级、XP、路线状态，并支持选择路线。
- 十合一编辑器支持 growth / branches JSON 编辑；编辑器种子已与正式 12 张名篇、24 条分支、96 条效果同步。
- 云端内容包已重新生成，包含 12 张名篇、24 条分支、96 条效果。
- 新增名篇成长专项回归测试，并完成缓存版本统一更新。

## 验证
- 名篇专项：成长阈值、路线锁定、旧档迁移全部通过。
- 配置契约、存档码、三功系统、流派熟练度、阶段门、文体成长等相关测试通过。
- 全量 `feihuaqi-playable/tests/*.test.mjs` 回归通过。
- JavaScript 语法检查与 `git diff --check` 通过；仅有 Windows 换行提示。

## 评分机制收紧更新（2026-08-20）
### 改动
- 因部分评分条件过于容易达成，收紧 6 处中低门槛加成（grades.json v2.3），bonus 分值不变：
  - 流派三绝：诗/词/联均 ≥14 → ≥18
  - 三体皆胜：三体各胜 ≥2 → ≥3 场
  - 捷才：≤54 → ≤48 回合抵达
  - 从容：≤56 回合且灵感≥5 → ≤50 回合且灵感≥6
  - 根基深厚：笔/学/思三项极差 ≤3 → ≤2
  - 偏锋：任一项 ≥16 → ≥20
- 顶部精英档（诗仙/词宗/联圣，需单项≥30 且胜≥3）与文宗（≥4300）门槛不动。
- 新增专项回归 `tests/grade-tighten.test.mjs`；统一 bump 缓存版本 `20260820gradetighten1`。

### 验证
- 评分收紧专项测试（含“旧阈值可拿/新阈值拿不到”与“达到新阈值仍能拿”双向断言）通过。
- config-contract、ability-system 与全量 40 个测试通过。

## 双平台部署（2026-08-20）
- **GitHub Pages**：已恢复并同步完整可玩版，commit `bfd6002` 已更新 main；96 个静态文件 + 根 `feihua-content.json` 同步，`leaderboard.json` 已保留。
  - 站点：`https://luoluozi110.github.io/luoluo/`
  - 验证：页面可访问，`index.html` 引用版本号已为 `20260820albumdesc1`，名篇分支说明已上线。
- **CloudStudio**：经独立沙箱通道部署成功（verified: true），复用旧沙箱 `b7448dae814340d882052e04260fa5cb`。
  - 分享链接：`https://b7448dae814340d882052e04260fa5cb.gz3.agentos-app.net`
- **关键修正**：修复一次文档部署误删 Pages 游戏树的问题；`bfd6002` 从现有 main 快进恢复完整静态文件，之后部署脚本统一以当前 main 为父提交，避免再生成孤儿提交。

## 版本记录
- 名篇成长系统（本地提交）：`dede665`；评分收紧（本地提交）：`a7e27ac`。
- 两提交均经完整测试，本地由无斜杠分支 `album-grade-backup` 引用（HEAD 指向它，工作树干净）。
- GitHub 侧：名篇系统 + 评分收紧 + 分支说明随 GitHub Pages 部署进入 main（`bfd6002`），内容与本地 `dede665`/`a7e27ac`/`cfd92a8` 等价。
- 历史备份标签（经 REST API 创建于此前的 main `2baf1c7`）：
  - `backup/20260820-1835-album-growth` → tag object `f6f4b60a`
  - `backup/20260820-1840-grade-tighten` → tag object `9db96371`
- 本轮备份：`backup/20260820-2206-album-editor-sync`（源 `cfd92a8`）、`backup/20260820-2210-album-editor-online`（线上 `bfd6002`）、`backup/20260820-2214-deploy-parent-fix`（脚本 `701bf31`）。
- 无关未跟踪文件 `飞花棋-更新公告.md` 已明确排除，未混入部署或提交。

## 灵感骰收益调整（2026-08-20）
### 改动
- 追加灵感骰成本由每枚 8 点降为 5 点，最多追加 2 枚保持不变。
- 新增 `config/inspiration.json` 的 `extraDicePct: 0.06`：每追加一枚骰，额外获得 +6% 作品乘区；追加两枚累计 +12%。
- 追加骰原有随机骰面分仍保留，百分比修正与相性、风潮、文心等现有 `pctMods` 同区叠加，作用于整件作品基础分。
- 战斗界面在追加阶段实时显示当前乘区收益和下一枚追加收益；缓存版本统一更新为 `20260820inspdicepct1`。
- 新增 `feihuaqi-playable/tests/extra-dice-pct.test.mjs`，覆盖配置、成本、百分比叠加、整件作品乘区、骰面分保留和结算明细。

### 验证
- 追加骰专项测试通过。
- `game.js`、`battle.js` 与专项测试 JavaScript 语法检查通过。
