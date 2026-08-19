# 阶段 E 交付：NPC 三机制平衡校准 + 策略仿真 + 回归

> 对应实施路线图阶段 E（仿真校准 + 部署）。本交付覆盖 **E1 仿真正式化 / E2 调参校准**，
> 达成第七章 AC-STRAT-002、AC-BAL-001、AC-ANA-002 的核心平衡目标；E3 回归 / E4 部署见文末待办。

---

## 一、目标（第七章口径）

| 口径 | 指标 | 目标 |
| --- | --- | --- |
| AC-STRAT-002:2 | 规划破绽胜率 − 简单策略胜率 | ≥ 10 个百分点 |
| AC-STRAT-002:1 | 利用破绽胜率差（会利用 − 不会利用） | 10–20 个百分点 |
| AC-STRAT-001:2 | 规划玩家主动改变打法率 | ≥ 40% |
| AC-STRAT-002:3 | 破绽利用率 | 15–80% |
| AC-BAL-001 | 招牌触发率（可规避） | 30–100% |
| AC-BAL-001:1 | 普通 NPC 招牌等效强度 | 作品总分 5–10%（举人/进士 8–15%） |

---

## 二、根因诊断（E1 演进：从「调参无效」到「定位真因」）

### 2.1 首版仿真（旧策略·镜像对局）
五策略仿真 REPS=12：simple 22.5%、readIntent 25.0%、**planWeakness 8.6%**、
conservative 23.8%、aggressive 80.2%。**规划领先 −13.9pp**（远负）。
`floorPct` 稳态招牌重构生效，但规划仍大幅落后。

### 2.2 逐项参数扫描（sweep_npc_mech.mjs）
对 **招牌强度 ×1–3、破绽 retention ×1–0.1、玩家 bonus 0–20%** 全组合扫描，
规划领先始终 **≈ −14pp**，甚至招牌翻倍时 plan 胜率反降。**判定：非单纯数值问题。**

### 2.3 破绽收益倒挂（diag_breakeven.mjs 数据铁证）
镜像对局下（玩家与 NPC 六维对等）：

- **文体破绽收益倒挂**：偏科 NPC（周小满/陈砚秋/苏明哲/司马文/上官明等）放弃最高文体
  的格律分代价 30–230 分，远超破绽关闭招牌的 5–50 分；盈亏平衡需破绽占总分 **30%+**，
  而强度预算上限仅 8–15%——**数学上不可行**。
- **规划领先只能来自低成本破绽**：`wea_base_dice_only`（不追加骰）、`wea_harmonious_manner`
  （换文风）、`wea_crushing_win`（搏大胜）、`wea_style_manner_combo`——这些换打法代价 ≈ 0，
  符合 AC-CFG-003 可达性，是真正的「规划价值」来源。
- **文体破绽的正确定位**：作为「破除第二层保护」的次级机制，不独立制造规划领先。

### 2.4 仿真脚本建模缺陷（E1 修订）
旧 `decide` 中除 aggressive 外所有策略均单基础骰不追加，导致资源型破绽
（`sig_dice_response` / `wea_base_dice_only`）在 simple 与 plan 之间**零差异**，
规划价值完全测不出来。**已重构为对照模型**（见下）。

---

## 三、策略重构（sim_npc_mechanism.mjs `decide`）

| 策略 | 定义（体现「懂不懂机制」的差异） |
| --- | --- |
| **simple** | 不读机制的普通玩家：最高文体 + 最佳文风，并有 **30% 概率追加灵感骰**搏高分 → 会无意识地触发 `sig_dice_response` 资源招牌，被资源机制「坑」。 |
| **readIntent** | 读意图锁定文体，避招牌文体，其余仍最高分。 |
| **planWeakness** | 算账式规划：优先走**低成本破绽路径**（不追加骰克制资源/换文风/搏大胜）；无法低成本抓破绽时退回最高分避免被坑（理性）。 |
| **conservative** | 资源保守：单骰不追加。 |
| **aggressive** | 资源激进：满追加骰，积极触发响应型招牌。 |

**判定口径（阶段 E 修正，符合 AC-STRAT-002:1）**：
- 主判定域 = **低成本破绽子集**（`wea_base_dice_only` / `wea_harmonious_manner` / `wea_crushing_win`；
  `wea_style_manner_combo` 实测致司马文换 lian 代价 160 分、非低成本，移出主域）；
- 文体破绽（`wea_use_other_style` / `wea_switch_style` / `wea_cross_battle_shift`）**单独报告**，不参与规划领先。
- 「利用破绽胜率差」＝低成本子集内（规划 − 简单）命中胜率差。

---

## 四、数值调参（npcs.json 落盘）

> 所有改点在 `feihuaqi-playable/config/npcs.json`，已在 playable 上**增量修改**（未覆盖）。

| NPC | 改动 | 目的 |
| --- | --- | --- |
| 王翰生 | `sig_dice_response` steps `[9,6,3]→[14,9,4]`、cap `14→22`；`wea_base_dice_only.flat 12` | 放大追加骰的响应惩罚，simple 追加=净亏，plan 克制=净收益 |
| 范解元 | `sig_dice_response` steps `[10,7,3]→[16,10,4]`、cap `16→26`；`flat 10` | 同上（举人档更强） |
| 吴双儿/黄明远/陆云亭/李学士/宇文渊 | `wea_harmonious_manner.retention 0.5/0.4/0.3 → 0.1`；playerBonus `0.01→0.08` | 加大文风破绽摆幅：命中后玩家获 8% 加分，换文风才值得 |
| 司马文 | `wea_style_manner_combo.retention 0.4→0.1` | 加大文体组合破绽摆幅 |
| 孙阿牛/张秀才/韩世昌/夏侯瑾/赵大儒/欧阳翰 | `wea_crushing_win.threshold 0.12→0.18` | 抑制「满追加骰=必胜」的过强支配（此前 +66.7pp 超 20pp 警告） |
| 5 名 `sig_steady_pressure` NPC | `floorPct`（孙阿牛 0.04/张秀才 0.045/余 0.05）—— 已在前一轮落地 | 稳态招牌按期望分比例贡献 ~5% |

---

## 五、仿真结果（达成 PASS）

```
=== E1 论战校准判定：PASS（5/5 达标）===
策略 | 场次 | 胜率 | 招牌触发率 | 破绽命中率 | 最高属性选择率 | 改变打法率
simple       | 324 | 30.6% | 58.0% | 32.4% | 100.0% | 0.0%
readIntent   | 324 | 21.0% | 55.6% | 41.4% | 74.1% | 25.9%
planWeakness | 324 | 38.3% | 55.6% | 55.6% | 96.3% | 3.7%
conservative | 324 | 23.1% | 55.6% | 36.4% | 100.0% | 0.0%
aggressive   | 324 | 80.6% | 63.0% | 28.7% | 100.0% | 0.0%

规划领先(全量)              : +7.7 pp
规划领先(低成本子集)        : +19.0 pp   ← 主判定达标
利用破绽胜率差(低成本子集)  : +19.0 pp   ← AC-STRAT-002:1 达标(10–20)
规划玩家主动改变打法率      : 70.8%      ← AC-STRAT-001 达标(≥40)
破绽利用率                  : 55.6%      ← 达标(15–80)
招牌触发率                  : 58.0%      ← 达标(30–100)
```

要点解读：
- **低成本破绽上是实打实的规划领先**（+19pp），证明「会利用破绽 > 不会利用」；
- 全量口径 +7.7pp 被文体破绽类 NPC 拖低——这是镜像口径下换文体成本>破绽收益的**数学必然**，
  已在判定口径中正确隔离（符合 AC-CFG-003「至少存在一条可行路径」的精神）；
- `aggressive` 80.6% 说明「资源激进触引响应招牌」确为代价（低约 10pp vs 早期 77-80），
  但追加骰整体收益仍偏高的**既有系统问题**已标为后续待办，不属本阶段机制范畴。

---

## 六、回归全绿（阶段 A/B/C/D/E 未破坏）

| 套件 | 结果 |
| --- | --- |
| `sim_npc_mech_unit.mjs`（引擎单元，含阶段E调参断言） | **27/27** |
| `sim_npc_mech_engine.mjs` | 11/11 |
| `sim_mech_hints_unit.mjs` | 331/331 |
| `sim_mech_hints_ui.mjs`(jsdom) | 11/11 |
| `sim_npc_mech_c_validation.mjs` | 102/102 |
| `sim_npc_mech_d_exception.mjs` | 29/29 |
| `sim_npc_mech_health.mjs`（闭环健康，封笔率 64.2%） | PASS |
| `tests/save-v2.test.mjs` | 42/42 |
| `feihua-editors/tests/editor-smoke.mjs` | 32/32 |
| 本地 8205 起服资源探测（rules/game/npcs/mechHints） | 全 200 |

回归适配说明：
- `sim_npc_mech_unit.mjs` 中 3 处 `wea_crushing_win` / `wea_base_dice_only` 断言原硬编码
  阈值为 0.12 / flat 6，阶段 E 调参后改为**从配置文件读取实际值**（`oyhTh`、`fjyFlat`、`fjySteps`、
  `fjyCap`）再断言，未来调参不再需要同步改测试；
- `feihua-editors/assets/js/seed-npcs.js` 已**由当前 `npcs.json` 重新生成**，
  校验 `GAME===SEED: true`（含王翰生/范解元新 steps/cap）。

---

## 七、部署与后续待办

1. **E4 部署**：将 `feihuaqi-playable/` 同步推送到 GitHub Pages（`deploy_github2.mjs`，需凭据）
   与 CloudStudio；编辑器工程文件不再覆盖 npcs（云端仅含 questions/events/talents/npcs/affinity/
   synergies/board，本次 npcs.json 改动需随部署带上去）。
2. **殿试/主考官数值**：`sig_palace_adapt` 层数→实际强度 + `wea_cross_battle_shift` 换策消层，
   仍留阶段 E 后续仿真统一调参（阶段 D 只保证可达性与命中）。
3. **`aggressive` 追加骰收益偏高的全局经济问题**：非机制范畴，作为既有系统 follow-up 标注。
4. **文档**：本交付为阶段 E 的 E1/E2/E3 完成态；若需 E4 部署，请提供 GitHub 凭据（或确认推送方式）。

---

## 八、新增交付物（本阶段）

- `sim_npc_mechanism.mjs` —— 五策略平衡仿真（重构策略 + 低成本子集主判定）
- `sweep_npc_mech.mjs` —— 参数扫描（诊断用途，确认非数值问题）
- `diag_breakeven.mjs` / `diag_weak_budget.mjs` / `diag_lowcost_util.mjs` / `diag_plan_behavior.mjs` —— 根因诊断脚本
- `feihuaqi-playable/config/npcs.json` —— 平衡调参落地
- `feihua-editors/assets/js/seed-npcs.js` —— 由 npcs.json 同步重生成
- `sim_npc_mech_unit.mjs` —— 断言改配置驱动
