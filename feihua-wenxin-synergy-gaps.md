# 文心羁绊 · 三段留白补全记录

> 对应《文心联动（羁绊）方案》§五 列出的三处诚实留白。三项均已实现，并经回归仿真确认无平衡回归。

## 留白①　集成编辑器无法编辑 `synergies.json` → 已补「羁绊编辑器」标签页

**改动文件（`feihua-editors/`）**
- `assets/js/synergy.js`（新）：IIFE + `window.SYNERGY`，仿文心编辑器的列表 / 增删 / 复制 / 预览 / 导入导出 / 校验；成员多选（chip）+ 联动效果动态行（`syn_pct` / `on_win_bonus` / `dice_plus` / `crit`）。
- `assets/js/seed-synergies.js`（新）：9 条种子，对齐游戏 `feihuaqi-playable/config/synergies.json`。
- `index.html`：导航增「羁绊编辑器」、`syn-section`、`synOverlay` / `synPreviewOverlay` / `synStOverlay`、`talentList` datalist 补 T017–019、脚本接入。
- `assets/js/common.js`：`TALENTS` 补 T017–019；`switchTab` / `showManagement` / `exportProject` / `importProject` / `classify` / `classifyObject` 全增 `syn` 路由；工程导出含 `synergies`。
- `assets/css/styles.css`：补 `.syn-members-row` / `.syn-chip` / `.syn-eff-row` 等样式。
- `feihuaqi-playable/js/engine/config.js`：`applyProjectOverride` 键列表加 `synergies` → 编辑器导出的工程文件可经云端同步 / 手动载入覆盖线上羁绊。

**用法**：编辑器内「＋ 新增羁绊」填入成员文心与联动效果；「数据管理 → 合并导出工程文件」即含 `synergies`；发布云端后游戏启动自动生效。

## 留白②　图鉴不持久化羁绊 → 已跨局累计收集进度

**改动文件（`feihuaqi-playable/`）**
- `js/engine/codex.js`：`CODEX_VERSION` → 2；`emptyCodex` / `normalizeCodex` 加 `synergies:[]`；新增 `recordSynergy(id)` / `hasSynergy(id)`（容错兼容旧档）。
- `js/engine/game.js` `grantTalent`：新达成羁绊时 `Codex.recordSynergy(sy.id)`。
- `js/ui/codex.js`：图鉴阁新增第 4 分页「羁绊」——已达成显真容（成员 + 效果 + 描述），未达成留剪影与达成条件。

**语义**：集齐成员即激活、替换任一成员自然解除；图鉴只记录「曾达成」，跨局累计。

## 留白③　联动频率不可调（只能数值膨胀）→ 已抽成掉落率旋钮

**改动文件**
- `feihuaqi-playable/config/attrs.json`：新增 `talentDropRate: 0.15`（获胜后文心掉落概率）。
- `feihuaqi-playable/js/engine/game.js` `settleBattle`：`if (this.rand() < 0.15)` 改为读 `this.cfg.attrs.talentDropRate`（缺省回退 0.15）。

**调参方式**：想让羁绊更常见 → 调高 `talentDropRate` 或增加联动文心的掉落权重；**无需**抬高 `syn_pct` 数值，避免雪球膨胀。

## 回归验证（sim_synergy.mjs · 6000 局）

| 指标 | 羁绊关闭 | 羁绊开启 |
|---|---|---|
| 均分 | 2691 | 2697（+6，≈0.2%） |
| 胜率 | 79.1% | 79.7% |
| 封笔率 | 0.3% | 0.3% |
| 文宗占比 | 7% | 7% |

9 条羁绊激活率：S01 7% / S02 5% / S03 4% / S04 4% / S05 4% / S06 2% / S07 3% / S08 2% / S09 2%；约 28% 的局至少激活 1 条。低熟练（0.55）下封笔率 0.8%、分布仍健康。结论：**纯风味增益，无雪球、无数值断层**。

## 部署
- 游戏 `feihuaqi-playable/` 已重新部署至 CloudStudio，链接不变：`https://b7448dae814340d882052e04260fa5cb.gz3.agentos-app.net`
- 羁绊编辑器属于十合一在线内容编辑器的一部分，正式入口为 `https://luoluozi110.github.io/luoluo/feihua-editors/`；其导出的 `synergies.json` 经统一云端同步 / 手动载入生效。CloudStudio 仅保留为游戏预览分享页。
