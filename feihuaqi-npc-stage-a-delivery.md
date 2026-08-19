# 飞花棋 NPC 三机制 · 阶段 A 交付（数据 + 引擎内核闭环）

> 阶段：A —— 配置扩展 → 规则纯函数 → 引擎接线 → 图鉴认知 → 验证。
> 状态：已完成并自测通过，等待在阶段 A 大节点确认后进入阶段 B（交互反馈）。
> 覆盖章节：第一章「目标」~ 第五章「配置示例」的引擎侧落地（不含 UI、平衡校准、编辑器、异常 E0~E4 完整化——分属 B/C/D/E）。

---

## 一、本阶段做了什么

| 子任务 | 内容 | 落地文件 |
|---|---|---|
| A1 配置扩展 | 7 名机制 NPC 补稳定 id + `mech` 引用；新建招牌/破绽/意图模板库 + 预算旋钮；加载接入 normalize | `config/npcs.json`、`config/npc-mechanics.json`、`js/engine/config.js` |
| A2 规则纯函数 | 意图锁定、招牌触发、破绽判定、结算顺序、得分修正 5 类纯函数（无 DOM，可被仿真复用） | `js/engine/rules.js` |
| A3/A4 引擎接线 + 图鉴认知 | createSession 锁定意图、resolveBattle 破绽先于招牌结算、settleBattle 跨场状态 + 文债耗神 + 认知推进 | `js/engine/game.js`、`js/engine/save.js`、`js/engine/codex.js` |
| A5 验证 | 单元 26 项 + 引擎闭环 11 项 + 健康回归 120 局 0 崩溃 100% 通过 | `sim_npc_mech_unit.mjs`、`sim_npc_mech_engine.mjs`、`sim_npc_mech_health.mjs` |

---

## 二、核心机制实现要点

### 1. 意图锁定（E0）
`createSession` 调用 `R.rollIntention` 一次性生成并冻结 `session.intentLocked`。结算阶段 `resolveBattle` 只用锁定值，**不重新采样**——满足"意图锁定后不得暗改"。联力未解锁时若锁到联体，回退期望分最优。

### 2. 破绽先于招牌结算（F0）
`resolveBattle` 内顺序：`weaknessResolution`（先）→ `signatureTriggered`（后）→ `signatureScoreMods` 按 `retention` 摊薄招牌。结果型破绽（高分差压卷）依赖双方分，在算出 `selfCalc/oppCalc` 后二次判定并重算 NPC 修正与胜负。

### 3. 得分接入
`battleScore` 已支持 `pctMods/flatMods`，招牌/破绽均折算为：
- pct 修正（文体专精/识破重复/仿作/文风立意）
- flat 修正（追加骰响应 steps 累加/稳稿下限/基础骰失稳）
- 战后消耗（文债耗神扣灵感、压卷返还）
- 玩家侧破绽加分（`playerBonusPct`）

### 4. 图鉴四级认知
`codex.js` 新增 `foeCognition[npcId] = { level, meets, weaknessHits }`：相遇=相识、交锋≥3=察意、命中破绽=破招（最高 3）。`recordFoeCognition` 跨局持久化，`FOE_LEVEL_NAMES` 提供等级名。

### 5. 跨场状态
`save.js` 白名单新增 `npcMech`，持久化：
- `lastPlayerStyle/lastPlayerManner`（识破重复/换体破绽）
- `history[npcId].styles`（最近 2 场，仿作惯用）
- `palace[npcId].layers`（殿试跨场适应）

`_mechHistoryForNpc` 把引擎状态映射为 rules 期望的 `{ lastStyle, lastManner, habitualStyle }`。

### 6. NPC 稳定 id
`_npcFromPick` 优先用 `pick.id`（稳定 id，如 `zhou_xiaoman`）作为 `npc.id`，并新增 `tierId` 保留档位。图鉴键策略：机制 NPC 用稳定 id，普通 NPC 沿用 `档位|姓名` 兼容旧档。

---

## 三、验证结果

### 单元验证（sim_npc_mech_unit.mjs）— 26/26 通过
- 无机制 NPC：招牌不触发、破绽不命中、无修正（旧行为完全兼容）。
- 周小满（童生教学）：意图锁诗；词体全关招牌、联体削弱 50%、诗体承受 +6%。
- 范解元（追加骰）：基础骰关闭响应 + 失稳 -6；追加 2 枚触发响应。
- 林清斋（识破重复）：重复 +8%、换体规避、首场不触发。
- 欧阳翰（文债耗神）：小胜未破解、大胜命中 + 返还灵感。

### 引擎闭环（sim_npc_mech_engine.mjs）— 11/11 通过
完整 `createSession → resolve → settle` 链路验证意图锁定、招牌/破绽实际影响、E0 恒定、认知推进、无机制兼容。

### 健康回归（sim_npc_mech_health.mjs）— PASS
120 局 0 崩溃；全部 7 名机制 NPC 被正常遇到（206 场机制对战）；招牌触发 125 次、破绽命中 99 次分布均衡；全局分档/封笔分布未因接入而异常。

---

## 四、首期 7 名机制 NPC 配置一览（阶段 A 已锁定）

| NPC | 档位 | 招牌 | 破绽 | 意图 |
|---|---|---|---|---|
| 周小满 | 童生 | 文体专精·诗兴初发(+6%) | 词体全关/联体削弱 | 锁定诗体 |
| 林清斋 | 秀才 | 识破重复·熟读成诵(+8%) | 换体关闭 | 偏好联体+历史 |
| 范解元 | 举人 | 追加骰响应·鹿鸣争先 | 只用基础骰(失稳-6) | 追加骰→强攻 |
| 苏明哲 | 举人 | 仿作惯用·依样裁词(+8%) | 非惯用关闭 | 仿作意图 |
| 欧阳翰 | 进士 | 文债耗神(战后-2)+稳稿副招牌 | 高分差压卷(返还1) | 稳守 |
| 宇文渊 | 进士 | 文风立意·立意先行(≤10%) | 相得文风破立意(削弱70%) | 哲理/沉郁 |
| 王侍郎 | 主考官 | 跨场适应·衡文察变 | 跨场换策 | 殿试适应 |

---

## 五、本阶段边界（未包含 vs 后续阶段）

- **阶段 B（交互反馈）**：研判卡、定策提示、结算明细 UI、图鉴四级认知展示、殿试场间评语——本阶段仅引擎侧产出 `out.mech` 数据供 UI 消费，未实现视觉层。
- **阶段 C（配置+编辑器）**：王者/其余 NPC 正式配置文案、编辑器 npc.js/seed-npcs.js 支持 `mech` 字段、云端同步。
- **阶段 D（异常兼容）**：E0~E4 完整化（意图锁定保护、幂等、破绽不可达回退、副招牌上限校验、存档降级）。
- **阶段 E（仿真校准+部署）**：`sim_npc_mechanism.mjs` 全量、封笔率/胜率/招牌摆幅调参、回归冒烟、GitHub Pages + CloudStudio 部署。

---

## 六、待确认 / 遗留

1. 请确认**阶段 A 通过**，放行进入阶段 B（交互反馈）。
2. 稳稿压迫（欧阳翰副招牌）当前实现为**简化版**（仅提高下限 flat +4，未实现"降低爆发上限"的骰子方差压缩），阶段 E 可扩展。
3. 文债耗神的"返还灵感"当前与玩家本场是否主动投入解耦（命中即返还 1），阶段 D 可细化。
4. 殿试跨场适应的"意图权重调整/重复破绽收益衰减"本阶段仅存储 `layers`，其数值生效在阶段 B（意图组合）+E（校准）。
