# 飞花棋 NPC 三机制 · 阶段 C 交付（配置全量 + 编辑器支持）

> 阶段：C —— 其余 NPC 正式机制配置文案 + 编辑器 `npc.js`/`seed-npcs.js` 支持 `mech` 字段 + 云端同步验证。
> 状态：已完成并通过全量回归（单元/引擎/健康/文案/UI/闭环采样 + 编辑器冒烟），等待阶段 C 大节点确认。
> 覆盖章节：第五章「配置示例」→ 落地全部 27 名具名 NPC 的正式 `mech` 配置；编辑器可视化编辑。

---

## 一、本阶段做了什么

| 子任务 | 内容 | 落地文件 |
|---|---|---|
| C1 覆盖边界 | 勘察编辑器 NPC 模块与 npcs.json 剩余 NPC | `feihua-editors/assets/js/npc.js`、`seed-npcs.js` |
| C2 全量配置 | **20 名无机制 NPC 全部补齐正式 `id + mech`**（现有 7 名机制 NPC 保留），27/27 全覆盖 | `feihuaqi-playable/config/npcs.json` |
| C3 编辑器支持 | `normalizeNpc/saveNpcEditor` 保留 `id+mech`；新增稳定 ID 输入框 + 三机制 JSON 编辑域 + 实时校验；修复 `previewNpcLive` 引用未定义 `style` 的既有 bug；`seed-npcs.js` 同步为最新 27 名 | `feihua-editors/assets/js/npc.js`、`index.html`、`assets/css/styles.css`、`assets/js/seed-npcs.js` |
| C4 占位 + 同步 | 修复 `weaknessHint` 中 `wea_style_manner_combo` 的 `{{retention}}` 字面占位 → 按 `w.retention` 计算百分比；端到端同步验证（编辑器种子 == 游戏配置） | `feihuaqi-playable/js/ui/mechHints.js`、`sim_npc_mech_c_validation.mjs`（新） |

---

## 二、C2：27 名 NPC 全量机制配置

### 2.1 新增 20 名（设计遵循原则）

按第五章第十六节「机制分配建议」+ 引擎**已真实落地**的模板（避免未接线模板），结合强度预算（童生 pct 5–7%、秀才 6–9%、举人 8–11%、进士 9–12%、主考官单场 8–12%）逐名配置：

| 档 | NPC | 偏科 | 招牌 | 破绽 | 意图 |
|---|---|---|---|---|---|
| 童生 | 陈砚秋 | 词 | 婉约稳进(style_mastery 6%) | 辞藻局促(use_other_style) | 偏好文体·词 |
| 童生 | 吴双儿 | 联 | 对仗追随(style_mastery 6%) | 泥于绳墨(harmonious_manner·婉约/清雅) | 偏好文体·联 |
| 童生 | 孙阿牛 | 笔 | 字稳卷平(steady_pressure floor4) | 怕大场面(crushing_win) | 稳守 |
| 童生 | 钱小乙 | 学 | 熟题先机(repeat_read 6%) | 死记旧章(switch_style) | 偏好文体·学 |
| 童生 | 李墨童 | 思 | 临题学样(copycat 6%) | 不善变化(base_dice_only flat6) | 仿作 |
| 秀才 | 张秀才 | 诗 | 工稳守卷(steady_pressure floor5) | 怯于变化(crushing_win) | 稳守 |
| 秀才 | 黄明远 | 词 | 声律相持(style_mastery 8%) | 词丽辞平(harmonious_manner·哲理/清雅) | 偏好文体·词 |
| 秀才 | 赵文彬 | 笔 | 观你旧辙(repeat_read 7%) | 依样画瓢(switch_style) | 偏好文体·笔 |
| 秀才 | 郑书玉 | 学 | 引经据典(copycat 8%) | 囿于经注(use_other_style) | 仿作 |
| 秀才 | 王翰生 | 思 | 观风择势(dice_response [5,3,1] cap8) | 心浮气躁(base_dice_only flat8) | 追骰响应 |
| 举人 | 陆云亭 | 联 | 对答如流(style_mastery 9%) | 意止于对(harmonious_manner·豪放/哲理) | 偏好文体·联 |
| 举人 | 韩世昌 | 笔 | 章法成城(steady_pressure floor7) | 惧高压(crushing_win) | 稳守 |
| 举人 | 唐季卿 | 学 | 博闻压题(repeat_read 9%) | 泥于所闻(switch_style) | 偏好文体·学 |
| 举人 | 白文渊 | 思 | 察势转锋(copycat 9%) | 恃察轻守(use_other_style) | 仿作 |
| 进士 | 司马文 | 词 | 曲折藏锋(style_mastery 10%) | 文绉其表(style_manner_combo 联+绮丽/哲理, 留40%) | 偏好文体·词 |
| 进士 | 上官明 | 联 | 双关设伏(copycat 10%) | 机巧易察(use_other_style) | 仿作 |
| 进士 | 夏侯瑾 | 笔 | 翰林稳卷(steady_pressure floor8) | 忌被压卷(crushing_win, refund1) | 稳守 |
| 进士 | 慕容玉 | 学 | 科场博洽(repeat_read 10%) | 倦于变通(switch_style) | 偏好文体·学 |
| 主考官 | 李学士 | 词 | 殿试声律(style_mastery 10% 主)+衡文稳卷(steady floor4 副) | 重典轻境(harmonious_manner·豪放/哲理, 留40%) | 偏好文体·词 |
| 主考官 | 赵大儒 | 笔 | 经义稳卷(steady_pressure floor9) | 忌被压卷(crushing_win, refund1) | 稳守 |

> 另：李学士用「主/副招牌分离」结构（仿欧阳翰），副招牌为弱稳卷，体现主考官"单场牌面更大但不无脑强压"的位阶。

### 2.2 设计纪律

1. **引擎可落地优先**：只用 `rules.js`/`game.js` 已接入的招牌（style_mastery/repeat_read/dice_response/copycat/steady_pressure/debt_drain）与破绽（use_other_style/switch_style/base_dice_only/style_manner_combo/crushing_win/harmonious_manner）；**避免**未接线的 `sig_manner_theme`、`wea_counter_intent`、`wea_cross_battle_shift`（除宇文渊已有配置与王侍郎殿试跨场）。
2. **第五章 17.2 禁用清单遵守**：不引入佯动、多备选行动、直接禁文体、单场多次灵感扣除、永久改破绽。
3. **强度合规**：pct 按档落在预算区间；`steady_pressure` floor 粗略按档递增（4→5→7→8→9）；`dice_response` 举人以下不配封顶过高。
4. **偏科自洽**：每名机制与自身偏科文体/身份贴合，同名不堆叠同一模板的语义冲突。

---

## 三、C3：编辑器机制可视化编辑

### 3.1 `npc.js` 改动

- **`normalizeNpc`**：新增保留 `id`、`mech`（非空对象才保留，空则 `undefined`）——修复「编辑器重存会剥离机制字段」的历史缺陷。
- **`openNpcEditor`**：预填稳定 ID 输入框 + 三机制 JSON 文本域（已有 mech 的美化为缩进 JSON）。
- **`saveNpcEditor`**：读稳定 ID + 解析 mech 文本域；非法 JSON 弹窗提示并**拦截保存**；合法空串 → `null（普通对手）`。
- **`previewNpcLive`**：修复引用未定义变量 `style` 的线程 bug → 改读 `state.npcForm.style`，并在卡面标注「带三机制」。
- **`duplicateNpc`**：复制时若含 `id` 自动追加 `_n` 后缀，避免稳定 ID 冲突。
- **`renderList`**：名称行加「三机制」徽标 + 稳定 ID 灰字，便于识别。
- **bind()**：`npcOverlay` 增加 `npc-id`/`npc-mech` 输入同步与实时 JSON 校验；select 选偏科时若机制为空，自动给一个可参照的初值骨架。

### 3.2 `index.html` / `styles.css`
- `npcOverlay` 新增「稳定ID」输入框 + 三机制 textarea（含 ⓘ 说明与 JSON 示例 placeholder）。
- 新增 `.npc-mech-hint`/`.npc-mech-json`(错误描红)/`#npcMechMsg` 校验提示 /`.mech-badge` 徽标样式。

### 3.3 `seed-npcs.js`
- 由 `config/npcs.json` 全量重写（27 名含 id+mech），编辑器首载即带机制。

---

## 四、C4：占位修复 + 同步验证

### 4.1 `wea_style_manner_combo` 文案占位修复
`mechHints.js` 该分支原输出带字面 `{{retention}}` 占位 → 现按 `w.retention`（保留比例）换算成「最多可剩 X% 之威」，与 `wea_use_other_style` 风格一致。司马文/任何 combo 破绽玩家的定策提示现在可读。

### 4.2 同步验证
- **编辑器种子 == 游戏 npcs.json**：`JSON.stringify` 全等 `true`（27 名、含 mech）。
- **normalize 链路**：编辑→导出保留 `id+mech`（jsdom 冒烟断言通过）。

---

## 五、验证结果

| 层 | 脚本 | 结果 |
|---|---|---|
| 单元·规则 | `sim_npc_mech_unit.mjs` | 26/26 通过 |
| 引擎闭环 | `sim_npc_mech_engine.mjs` | 11/11 通过 |
| 健康回归 | `sim_npc_mech_health.mjs` | PASS（N=120，闭环稳定）|
| 文案单元 | `sim_mech_hints_unit.mjs` | **331/331 通过**（覆盖 27 名机制 NPC）|
| UI DOM | `sim_mech_hints_ui.mjs` | 11/11 通过 |
| **C2 闭环采样** | `sim_npc_mech_c_validation.mjs`（新）| **102/102 通过**，27/27 NPC 意图锁定+招牌触发+破绽命中 |
| 编辑器冒烟 | `feihua-editors/tests/editor-smoke.mjs` | **32/32 通过**（含机制编辑/非法拦截）|
| 服务冒烟 | 本地 8199 | 全部模块/config 200 |

---

## 六、玩家可见变化一览

- 所有 27 名具名 NPC 进入「三机制」时代：**不再有完全无机制的中后段 NPC**，每名对手都可被研判、可被针对。
- 编辑器可在对手面板直接填写稳定 ID 与三机制 JSON，实时校验；普通玩家配置不再因字段丢失而回归旧行为。
- 组合类破绽（如司马文「文绉其表」）的定策提示文案已可读（不再出现 `{{retention}}` 字样）。

---

## 七、边界 / 后续阶段

- **`wea_crushing_win` 触发窗口较窄**：需玩家"相对分差 ≥ 阈值(0.12)"才命中；采样中张秀才/韩世昌/夏侯瑾/欧阳翰/赵大儒在常规对局强度下常不触发。**机制本身无误**（绝对优势下确认能 full 压制+返还灵感），阈值/玩家强度平衡属**阶段 E 调优**范畴。
- **`sig_manner_theme`（宇文渊「立意先行」）分数效果未真正落地**：`signatureScoreMods` 未对该模板产出得分修正（现有阶段 A 即存在，只影响触发/文案不影响算分）。建议**阶段 D** 补齐（思力贡献折算）或**阶段 E** 调参。
- **`wea_counter_intent` / `wea_cross_battle_shift` 需要 `matchesIntent` / `strategyChanged` 入参**，`game.js` 载入处尚未读写 → 这两个模板当前"配了但引擎判定永不触发"。属**阶段 D（异常兼容）**待办：给 `pm.matchesIntent` 与 `ctx.strategyChanged` 接线后，王侍郎的「跨场换策」才能真正解锁（殿试跨场）。
- 版本要求：全部改动为 `feihuaqi-playable/` / `feihua-editors/` **增量修改**，未用 `extracted/flyhua/feihuaqi/` 覆盖。

---

## 八、待确认 / 遗留

1. 请确认**阶段 C 通过**，放行进入阶段 D（异常兼容：E0–E4 完整化、幂等、存档降级、`strategyChanged`/`matchesIntent` 接线、`sig_manner_theme` 分数落地）。
2. 若需在本阶段**立即**让「跨场换策」/「压卷破绽」更大生效，可提前把 strategyChanged 判定与 crushing 阈值下探到阶段 C —— 但建议按计划留阶段 D/E 校准，避免未仿真即改强度。
3. 编辑器与游戏为两个独立静态站；用户可通过本机 file:// 打开编辑器，游戏经本地 8199 服务预览。
