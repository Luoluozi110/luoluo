# 阶段 D 交付：异常兼容（E0–E4）与新增接线落地

> 状态：待确认  
> 前置：阶段 A（6 名机制 NPC + 引擎骨架）、阶段 B（UI 交互反馈）、阶段 C（27 名 NPC 全量机制化 + 编辑器）均已通过。
> 本阶段只落实「异常兼容」与两条此前未接线的模板：`wea_counter_intent`、`wea_cross_battle_shift`，并落地 `sig_manner_theme` 的实际得分效果。
> **铁律**：所有改动均为 `feihuaqi-playable/` 上增量修改，未覆盖 `extracted/`。

---

## 一、本阶段目标与范围

依据第六章《异常处理》的 E0–E4 分级，在引擎侧补齐运行时异常防护，并消除阶段 C 遗留的三处技术债：

1. **E1 降级**：机制档案不完整（模板缺失 / 有招牌无破绽 / 有破绽无招牌）→ 整套机制降级为旧行为，不展示研判区、不写跨场状态、不扣文债、不加殿试适应层。
2. **E2 修正**：非法数值（非数值百分比、非法文体）→ 兜底为 0 / 旧行为，不使结算崩溃。
3. **E0 公平性与幂等**：意图锁定后同场多次结算不重抽；重复调用结算不重复扣费/发奖；损坏存档 `npcMech` 兜底默认空状态。
4. **技术债接线**：
   - `wea_counter_intent` → `pm.matchesIntent`（此前 game.js 未传，永不触发）；
   - `wea_cross_battle_shift` → `ctx.strategyChanged`（此前硬编码 `false`，永不触发）；
   - `sig_manner_theme` → 思力贡献折算为实际得分修正（此前仅 UI 文案、无分数）。

---

## 二、改动明细

### 2.1 `feihuaqi-playable/js/engine/game.js`（增量）

**createSession**
- 新增 `mechOk` 运行时守卫，判定一次该 NPC 本场是否以完整机制运行：
  - `mech.signature` 与 `mech.weakness` 必须**成对存在**，缺一 → 整套降级（第六章 6.2「有招牌无破绽不得满强上线」）；
  - 主招牌模板 / 主破绽模板在 `config/npc-mechanics.json` 模板库中引用不到 → 整套降级（第六章 6.3）；
  - 副招牌模板缺失仅停用副招牌，主机制继续。
- `npcMech` 改为 `mechOk ? npc.mech : null`；`session` 新增 `_mechValid = !!mechOk`，供 resolve/settle 复用同一判定。

**resolveBattle**
- 机制读取改以 `session._mechValid` 为准（与 createSession 同源判定）。
- `pm` 增加 `matchesIntent`（＝玩家出战是否与锁定意图 `intentLocked.{style,manner}` 完全一致），供 `wea_counter_intent`。
- 新增 `strategyChanged` 计算（`_strategyChangedSinceLast`），供 `wea_cross_battle_shift`。
- `matchesIntent / strategyChanged` 提升到 `if(npcMech)` 块外，使 `wea_crushing_win` 二次判定复用这两个值（修复此前可能的「未定义」作用域隐患）。
- `_mechHistoryForNpc(stableFoeId(session.npc))` 取代 `_mechHistoryForNpc(session.npc.id)`，避免无稳定 id 的 NPC 历史串桶。
- 两处 `signatureScoreMods` 调用传 `npcSi`（供 D4 manner 折算）。

**新增 `_strategyChangedSinceLast(npc, style, manner)`**
- 读取该 NPC（稳定 id 分桶）历史中最近一场所用文体/文风，与本场比较；不同 → 视为「换策」返回 true。
- 首场无历史 / 存档异常 → false（E1 安全降级）。
- 专供王侍郎「跨场换策」第二场及以后判定。

**settleBattle**
- 机制跨场状态维护改以 `session._mechValid` 判定：模板缺失整场降级时，**不写入** `npcMech.history`、**不触发** `sig_debt_drain` 文债扣费、**不叠加**殿试 palace 适应层，避免半成品污染跨场状态。

### 2.2 `feihuaqi-playable/js/engine/rules.js`（增量）

**signatureScoreMods**
- 落地 `sig_manner_theme`：原「思力贡献折算是仅文案、无分数」→ 现按
  `额外 flat = round( NPC思力 npcSi × BATTLE_COEF.siMult(5) × pct × retention )` 注入 `oppFlat`（source `npcSign`）。
  - `applyTo !== 'si_contribution'` 时忽略（内容告警 E3）；
  - 破绽保留比例 `retention` 会按原逻辑摊薄该加成（宇文渊被 `wea_harmonious_manner` 针对时减分）。

### 2.3 验证脚本（新增/更新）

- 新增 `sim_npc_mech_d_exception.mjs`：D1–E1（模板缺失/不成对降级）、E2 非法数值、D2 matchesIntent、D3 strategyChanged、D4 manner 折算、E0 幂等、坏档兜底。
- 更新 `sim_npc_mech_c_validation.mjs`：`wea_cross_battle_shift` 注释与提示改为「跨场场景由阶段 D 验证脚本覆盖」，不再误标「未接线待办」。

---

## 三、验证结果（全绿）

| 验证脚本 | 结果 |
|---|---|
| `sim_npc_mech_unit.mjs`（阶段 A 单元） | 26 / 26 |
| `sim_npc_mech_engine.mjs`（阶段 A 引擎承接） | 11 / 11 |
| `sim_npc_mech_health.mjs`（阶段 A 健康度 N=120） | PASS |
| `sim_mech_hints_unit.mjs`（阶段 B 文案单测，覆盖 27 名） | 331 / 331 |
| `sim_mech_hints_ui.mjs`（阶段 B UI jsdom） | 11 / 11 |
| `sim_npc_mech_c_validation.mjs`（阶段 C 闭环采样） | 102 / 102 |
| `sim_npc_mech_d_exception.mjs`（**阶段 D 新增**） | 29 / 29 |
| `feihua-editors/tests/editor-smoke.mjs`（编辑器冒烟 jsdom） | 32 / 32 |

`game.js`、`rules.js` 可被 Node 直接 import 加载（无语法/引用错误）。

### 阶段 D 新增断言覆盖点

- 主招牌模板缺失 → `_mechValid=false`、`intentLocked=null`、resolve/settle 不抛错、不写跨场历史。
- 主破绽模板缺失 / 有招牌无破绽 → 整套降级。
- 非法 `pct` / 非法文体 → resolve 不抛错，NPC 得分有限值。
- **counter 破绽**：按锁定意图出战 → `wea.hit`、`shutdownLevel=partial`；不按意图 → 不命中。
- **跨场换策**：殿试第一场 shi 结算后，第二场换 ci → `wea.hit` 且 `layerReduce≥1`；仍用 shi → 不命中。
- **manner 折算**：宇文渊 `30ci`(此处为思力 30) × 5 × 0.10 → 招牌 flat `+15`；`signatureScoreMods` 纯函数单测确认 `flat=15`。
- E0 幂等：同会话两次 resolve 意图不变；重复 settle 不抛错。
- 存档：v2 旧档无 `npcMech` / `npcMech` 损坏 → `deserializeRun` 兜底 `{history:{},palace:{}}`。

---

## 四、本阶段边界与后续待办

1. **palace 数值强度未落地**（阶段 E）：`sig_palace_adapt` 目前只叠加 `palaceLayers` 供 UI「场间评语」，`_strategyChangedSinceLast` 已能判定换策、`wea_cross_battle_shift` 能命中并返回 `layerReduce`，但**「层数 → 实际强度」与「换策消层」的数值联动留待阶段 E 仿真调参**统一实现，避免半吊子引入平衡风险。
2. **`wea_crushing_win` 阈值**（孙阿牛/张秀才/韩世昌/欧阳翰等）：阶段 C 已标注非阻塞，属阶段 E 调优项。
3. **第六章待确认事项**（19 项）中的多项（分差边界、自动代选历史、王侍郎第二场优先级、图鉴迁移等）属规则确认项，不在本阶段代码落地范围，建议随阶段 E 验收一并对齐。

---

## 五、结论栏

- [x] 阶段 D 代码与验证已就绪，未破坏阶段 A/B/C 任何既有回归。
- [ ] 待用户确认「阶段 D 通过」后，放行进入阶段 E（仿真校准 + 部署）。

**关键提醒**：所有改动均在 `feihuaqi-playable/` 增量完成，`extracted/flyhua/feihuaqi/` 仍为旧抽取基线，未被覆盖。
