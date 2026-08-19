# 回退「行路耗神」→ 事件灵感消耗

## 变更总览
用户要求：回退上一轮的「行路耗神」（每步 5% 扣灵感）逐格耗损设计，改为**增加部分事件的灵感消耗**，并维持封笔率约 15%。

## 一、回退（已撤销的机制）
- `game.js moveSteps`：删除逐格「行路耗神」耗损块。
- `inspiration.json`：删除 `stepDrainChance` / `stepDrainAmount`。
- `grades.json`：先 ÷0.94，撤销上一轮为耗损做的分数线补偿。

## 二、事件灵感消耗（新机制，两段式）
事件每局仅约 6 次落地（远少于逐格 ~150 步），单靠个别事件成本无法达到 15% 封笔，故采用两层：

1. **加深「劳神/苦思/应酬」类事件的灵感扣减**（`events.json`）：
   - choice 事件「劳神」选项成本 4~6：江郎才尽 -5/-7、焚膏继晷 -6、推敲之苦 -5、病中得句 -6、驿路逢雨 -4、落第榜下 -4、老农问字 -3/-2、舟中夜话 -3、雪夜访戴 -3、一字之师 -3。
   - direct 事件固定 -3~-6：凿壁偷光 -5、借书一观 -5、石上题联 -4、灯下抄书 -6、桑下劝学 -4、古寺残碑 -5、秋声入耳 -4、试笔新砚 -5。
   - 「养神」类事件（宴游、知音、山寺听钟、采菊、荷锄归来等）保留 +1~+3 增益。
2. **「奇遇耗神」入场消耗**：`inspiration.json` 新增 `eventCellCost:-1`，`game.js doEvent` 落事件格先扣 1 点（可控杠杆：-1→约13%、-2→约27%）。

## 三、分数线重校
事件成本使整体分数下移约 250 分，故 `grades.json` 九档分数线再 ×0.94 固化，恢复品级分布（文宗重新稀有化）。

## 四、最终平衡（2000 局/档，读盘配置）
| 水平 | 封笔率 | 胜率 | 文宗 | 超时 |
|---|---|---|---|---|
| 标准 (0.75) | **16.1%** | 79.3% | 8% | 0% |
| 新手 (0.55) | 19.8% | 76.1% | 5% | 0% |
| 高玩 (0.92) | 12.4% | 81.5% | 10% | 0% |

九档平滑（童生9/秀才10/举人24/进士16/探花7/榜眼11/状元8/翰林8/文宗8 %）。

## 五、改动文件
| 文件 | 改动 |
|---|---|
| `feihuaqi-playable/js/engine/game.js` | 删逐格耗损；`doEvent` 新增 `eventCellCost` 入场消耗 |
| `feihuaqi-playable/config/inspiration.json` | 删 `stepDrain*`；新增 `eventCellCost:-1` |
| `feihuaqi-playable/config/events.json` | 加深 18 个劳神事件的灵感扣减 |
| `feihuaqi-playable/config/grades.json` | 分数线 ×0.94 固化 |
| `apply_event_costs.mjs`（新）、`apply_grade_revert.mjs`（新） | 事件成本 / 分数线回退脚本 |

## 六、部署
已推送 `Luoluozi110/luoluo` main（41 文件，保留云端同步 `feihua-content.json`），commit `e40f9b42`。GitHub Pages 重建中：**https://luoluozi110.github.io/luoluo/**

## 备注
- `eventCellCost` 是调封笔率的主旋钮（整数档：-1≈13%、-2≈27%）；`events.json` 劳神事件成本是「部分事件」的细分调优。
- 若想更贴近严格 15% 或更柔和，改 `eventCellCost` 或事件成本即可，我可按新目标复扫。
