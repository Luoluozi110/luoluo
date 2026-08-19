# 删除支线 · 名胜格 · 增设天象格

## 一、棋盘结构改动（`config/board.json`）
- **删除全部支线路线**：移除 `branches` / `branchCells` / `branchGates` / `branchReturnAdvance` 四个字段，支线 40 格（id 120–159）及 4 处名胜终点一并清除。
- **主环路格子总数不变**：`mainRing` 仍为 **80 格**（扩图后的 21×21 环），路径连续无岔路。
- **原支线路口 → 名胜格（mingjing）**：4 个 `branch_gate`（12/27/42/70）改为新格型 `mingjing`，沿用原名胜名：**桃花源 / 白鹿洞 / 御花园 / 玉门关**，分列四边。
- **增设天象格**：在原 3 个 `sky` 基础上，将 5 个普通平韵格转为 `sky`（星矅崖/云津渡/月华津/风露台/霄汉亭），**天象格 3 → 8**。

最终类型分布：起点1 / 平韵18 / 仄韵16 / 考题14 / 奇遇10 / **天象8** / 论战9 / **名胜4**。

## 二、名胜格玩法（引擎 + UI）
- 落于名胜格时弹出「访胜抽签」：**消耗 8 点灵感，随机抽取一枚尚未拥有的文心**；灵感不足（<8）时抽签按钮禁用，也可「径直离开」。
- 实现：`game.js` 新增 `doScenic`（消耗 `inspiration.scenicCost=8`，调 `randomTalent()`）；`svss.js` 新增名胜楼阁字形；`modals.js` 新增 `askScenic`；`app.js`、`inspiration.json`(`scenicCost:8`)、`board.css`(`.t-mingjing`) 同步。
- 已删除原 `doGate`/`doLandmark`、支线渲染（`board.js` 的 `BRANCH_DIR` 与两段支线绘制）、`askBranch`/`showLandmark`。

## 三、平衡重校（删支线后必须）
支线原提供 4×免费文心 + 4×主题属性 +5，删除后玩家明显变弱：仿真胜率从 80.6% 跌到 67%、文宗从 7% 跌到 1%。据此下调强度：
- **NPC 实力**：`npcs.json` 相对当前配置 ×**0.92**（最终 ≈ 原始基线 ×1.142）。主属性峰值 童生11 / 秀才15 / 举人26 / 进士30 / 主考官40。
- **分数线**：`grades.json` 九档 ×**0.94**（最终 ≈ 原始基线 ×1.094），文宗门槛回到稀有区间。
- 编辑器 `seed-npcs.js` 已同步。

## 四、仿真结论（2000 局/档，适度抽签：灵感≥20 才抽）
| 水平 | 胜率 | 文宗 | 封笔 |
|---|---|---|---|
| 标准(0.75) | 79.0% | 6% | 0.8% |
| 新手(0.55) | 76.6% | 4% | 1.4% |

九档分布平滑（童生3%→举人25%→进士21%→…→文宗6%），已恢复扩图前的手感。

> ⚠️ 设计提示：名胜抽签是「消耗灵感换文心」的可选机制。若玩家**贪婪连抽**（每格都抽），仿真显示封笔率会升到 ~8%；只有「灵感宽裕时才抽」才安全（0.8%）。这与「多掷灵感骰」一致——功能本身安全，滥用有风险。

## 五、改动文件
- 数据：`config/board.json`、`config/npcs.json`、`config/grades.json`、`config/inspiration.json`、`feihua-editors/assets/js/seed-npcs.js`
- 引擎/UI：`js/engine/game.js`、`js/ui/board.js`、`js/ui/svg.js`、`js/ui/modals.js`、`js/ui/app.js`、`css/board.css`
- 仿真工具：`sim_feihuaqi.mjs` / `sim_board_balance.mjs`（mock 改为 `askScenic`）

## 六、部署
已推送至 `Luoluozi110/luoluo` main（41 文件，保留云端同步文件 `feihua-content.json`），GitHub Pages 重建中：
**https://luoluozi110.github.io/luoluo/**

建议实测：名胜格抽签弹窗、天象格数量观感、整体难度。天象格加了 5 个（共 8），若想更多/更少告诉我即可微调。
