# 文心替换 + 灵感经济耗损（封笔≈15%）

## 一、文心满上限替换（已存在，确认连通）
- 引擎 `game.js grantTalent`：被动/主动达上限（`PASSIVE_MAX=8` / `ACTIVE_MAX=4`）时，调用 `ui.askReplaceTalent(talent, list)` 弹出选择。
- UI `modals.js askReplaceTalent`：展示新文心效果与全部已持文心，玩家选择替换哪一枚，或放弃新文心。
- 替换时 `revokeTalentFlat(removed)` 回滚旧文心属性、`applyTalentFlat` 应用新文心，羁绊/图鉴实时重算。HUD 显示 `n/8 · n/4` 上限。
- 本次未改动该机制，仅核实其完整连通。

## 二、灵感经济：新增「行路耗神」耗损
- **机制**：每前进一步（每格）有 5% 概率触发「行路耗神」，扣 2 点灵感 —— 即用户早前提过的「每格 5% 扣 2 点」方案。
- **配置**：`config/inspiration.json` 新增 `stepDrainChance: 0.05`、`stepDrainAmount: 2`（可调）。
- **实现**：`game.js moveSteps` 逐格前进时按概率扣灵感（`addInspiration` 统一走 HUD 飘字）。

## 三、封笔率实测（2000 局/档，读盘配置）
| 水平 | 封笔率 | 胜率 | 文宗 | 超时 |
|---|---|---|---|---|
| 标准 (0.75) | **16.9%** | 78.8% | 6% | 0% |
| 新手 (0.55) | 20.9% | 76.5% | 5% | 0% |
| 高玩 (0.92) | 13.3% | 81.5% | 9% | 0% |

> 目标 15%：标准局 16.9% 达标；新手更高（不熟题库+灵感紧张）、高玩更低（控灵感更强），符合「技术影响生存」的设计。

## 四、分数线补偿（因耗损使分数整体下移 ~15%）
- 副作用：分数线下移使文宗从 7% 塌到 ~1%。
- 补偿：`grades.json` 九档分数线整体 ×0.94（仅 min/max，速度奖励 bonuses 不动）。
  - 童生 1~2005 / 秀才 2006~2262 / 举人 2263~2673 / 进士 2674~2828 / 探花 2828~2879 / 榜眼 2880~2982 / 状元 2983~3085 / 翰林 3086~3188 / 文宗 3188~∞
- 恢复后九档平滑：童生 11 / 秀才 10 / 举人 23 / 进士 18 / 探花 6 / 榜眼 11 / 状元 8 / 翰林 6 / 文宗 6（%）。
- 封笔压力（能否走完）与分数线（走完后的品级）解耦：耗损的 15% 封笔完全保留，品级分布还原到用户此前批准的形态。

## 五、改动文件
| 文件 | 改动 |
|---|---|
| `feihuaqi-playable/js/engine/game.js` | `moveSteps` 新增逐格灵感耗损（`stepDrainChance/Amount` 配置驱动） |
| `feihuaqi-playable/config/inspiration.json` | 新增 `stepDrainChance:0.05`、`stepDrainAmount:2` |
| `feihuaqi-playable/config/grades.json` | 九档分数线 ×0.94 固化 |
| `sim_insp_drain.mjs`（新） | 耗损参数扫描仿真 |
| `apply_grade_drain.mjs`（新） | 分数线固化脚本 |

## 六、部署
- 已推送至 `Luoluozi110/luoluo` main（41 文件，保留云端同步文件 `feihua-content.json`）。
- GitHub Pages 重建中：**https://luoluozi110.github.io/luoluo/**

## 备注
- 数值调参均经仿真验证，无超时回归；`game.js --check` 与 JSON 校验通过。
- 若想调整封笔率：改 `stepDrainChance`（每格触发概率）或 `stepDrainAmount`（扣量）即可，`sim_insp_drain.mjs <chance> <amount>` 可直接复扫。
