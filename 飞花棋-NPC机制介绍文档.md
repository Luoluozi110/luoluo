# 飞花棋 · 各类 NPC 机制介绍文档

> 适用版本：`feihuaqi-playable`（v2 机制库）
> 数据来源：`config/npcs.json`（对手与机制数据）、`config/npc-mechanics.json`（模板库）
> 逻辑来源：`js/engine/rules.js`（算分）、`js/engine/codex.js`（图鉴认知）
> 文案来源：`js/ui/mechHints.js`（机制文案翻译）、`js/ui/codex.js`（图鉴阁）

本文梳理飞花棋中 **NPC 三机制系统** 的全貌：招牌、破绽、意图，并延伸到结算流程、图鉴认知与典型对手实例。所有机制均由「模板库 + 数据引用」驱动，新增对手只需在 `npcs.json` 里引用 `npc-mechanics.json` 中的模板并填参，无需改动算分代码。

---

## 一、机制总览：三机制系统

每个具名 NPC 都携带一个 `mech` 对象，由三段组成：

| 机制 | 字段 | 玩家视角 | 引擎作用 |
|------|------|----------|----------|
| **招牌** Signature | `mech.signature` | 对手的「拿手好戏」 | 满足条件时，其作品得分加成（pct/flat） |
| **破绽** Weakness | `mech.weakness`（可多段） | 对手的「可乘之隙」 | 玩家按条件出招可压制其招牌，甚至返还灵感、获得己方加成 |
| **意图** Intent | `mech.intent` | 对手本场「打算怎么打」 | 战前锁定文体/文风/战策/骰组章法，部分可公开反制 |

设计上遵循一条铁律：**破绽先于招牌结算**。先判玩家是否命中破绽，得到招牌保留比例 `retention`（1=全额保留，0=完全关闭，中间值=削弱），再据此摊薄招牌加成。因此「针对破绽」永远是第一优先级——哪怕对手招牌再强，只要破绽命中，它便无从施展。

---

## 二、NPC 分类（按档位 / 身份）

| 档位 / 身份 | 对手数 | 具机制数 | 备注 |
|-------------|:------:|:--------:|------|
| 童生级 | 7 | 7 | 入门对手，机制最简单 |
| 秀才级 | 8 | 8 | 引入行为型与文风型机制 |
| 举人级 | 7 | 7 | 出现审律、定策等高级互动 |
| 进士级 | 6 | 6 | 跨场适应、逐潮等复合机制 |
| 主考官 | 4 | 4 | 殿试关卡，含康尔玉（联力>35 必遇） |
| 桃源终卷 | 1 | 0 | 隐藏终圈 Boss「桃花仙人」，六维均衡，不留机制数据，纯靠数值压制 |

> 机制覆盖率 100%：除隐藏终卷 Boss 外，每一名具名对手都有独立的三机制配置。

---

## 三、招牌机制（Signature）

招牌是 NPC 的「所长」——它最擅长、也最想让你撞上的打法。引擎在 `signatureTriggered()` 中判定是否发动，命中后通过 `signatureScoreMods()` 把加成作用于其得分。

### 3.1 招牌模板库（共 12 类）

| 模板 | 名称 | 触发条件 | 玩家应对策略 |
|------|------|----------|--------------|
| `sig_style_mastery` | 文体专精 | NPC 使用其惯用文体 | 改用他体可破（见对应破绽） |
| `sig_steady_pressure` | 稳稿压迫 | 始终生效 | 降低对手爆发上限，稳扎稳打亦可 |
| `sig_repeat_read` | 识破重复 | 你本场文体＝上一场文体 | 主动换体（对应破绽 `wea_switch_style`） |
| `sig_zeitgeist_surf` | 借风成势 | NPC 文风顺应「当朝风潮」 | 逆潮立骨（对应破绽 `wea_go_against_zeitgeist`） |
| `sig_copycat` | 仿作惯用 | 你近两场惯用某体且本场继续 | 临场换路数打其措手不及 |
| `sig_active_talent_tax` | 截脉问锋 | 你发动主动文心后 | 藏锋不用主动文心（对应破绽 `wea_hold_active_talent`） |
| `sig_dice_pattern_hunt` | 审律摘瑕 | 你骰组落入某「章法」（重章/连章/高章） | 收束骰组、控制追加骰（对应破绽 `wea_limited_extra_dice`） |
| `sig_declared_stance` | 先声定策 | NPC 公开本场战策且未被针对 | 按战策选相反章法（对应破绽 `wea_stance_counter`） |
| `sig_dice_response` | 追加骰响应 | 你每追加一枚灵感骰 | 控制追加骰数量 |
| `sig_debt_drain` | 文债耗神 | 战后你以微弱分差获胜 | 尽量拉开分差 |
| `sig_manner_theme` | 文风立意 | NPC 使用某类立意文风且切题 | 换相得文风（对应破绽 `wea_harmonious_manner`） |
| `sig_palace_adapt` | 跨场适应 | 殿试中、上一场你曾破其招 | 下一场再换策（对应破绽 `wea_cross_battle_shift`） |

> 实际分布：文体专精 8 名、稳稿压迫 4、识破重复 4、仿作惯用 4、借风成势 2、截脉问锋 2、审律摘瑕 2、先声定策 2，其余各 1。

### 3.2 主 / 副招牌分离

部分高阶 NPC（如欧阳翰式设计）采用 `signature: { main: {...}, weak: {...} }` 结构，主招牌与副招牌独立判定。UI 层 `signatureBlocks()` 会兼容扁平写法（仅主招牌）与主副分离写法。

---

## 四、破绽机制（Weakness）

破绽是 NPC 的「所短」——你针对它，就能压制其招牌。引擎在 `weaknessResolution()` 中判定命中，产出 `retention`（招牌保留比例）与玩家收益。NPC 可配置多个破绽（数组），合并时取**最强压制**（最小 retention）。

压制强度对照：
- `retention ≤ 0.3` → `full` 尽数关闭
- `0.3 < retention < 1` → `partial` 部分削弱
- `retention = 1` → 未命中

### 4.1 破绽模板库（共 11 类）

| 模板 | 名称 | 命中条件（玩家怎么做） | 主要收益 |
|------|------|------------------------|----------|
| `wea_use_other_style` | 改用他体 | 使用非其惯用文体 | 完全关闭招牌（指定文体）/ 削弱至某比例 |
| `wea_switch_style` | 主动换体 | 本场文体≠上一场 | 关闭招牌 + 提升意图信息精度 |
| `wea_base_dice_only` | 只用基础骰 | 不追加灵感骰 | 对手失稳定分、资源型招牌不触发 |
| `wea_style_manner_combo` | 文体＋文风组合 | 指定文体 + 指定文风方向 | 削弱至某比例（满足一项即削 30%） |
| `wea_crushing_win` | 高分差压卷 | 以某分差以上获胜 | 关闭招牌 + 返还灵感 |
| `wea_harmonious_manner` | 相得文风破立意 | 用与题材相得且为某方向的文风 | 削弱至某比例（词体额外 -10%） |
| `wea_counter_intent` | 识别主要意图 | 针对当前主要意图公开反制 | 取消对手备选行动 + 削弱招牌 |
| `wea_cross_battle_shift` | 跨场换策 | 殿试下一场改变打法 | 移除一层跨场适应收益 |
| `wea_go_against_zeitgeist` | 逆潮立骨 | 不随风潮、仍以相得文风切题 | 削弱招牌 + 创见加成 |
| `wea_hold_active_talent` | 藏锋守拙 | 本场不用主动文心 | 削弱招牌 + 加成 |
| `wea_limited_extra_dice` | 收束成篇 | 追加骰控制在 N 枚以内 | 避开审律审视、削弱招牌 |
| `wea_stance_counter` | 对策破锋 | 按对手公开战策选对应章法 | 削弱招牌 + 己方加成 |

> 实际分布：改用他体 7、相得文风破立意 5、高分差压卷 5、主动换体 4、逆潮立骨 2、藏锋守拙 2、收束成篇 2、文体＋文风组合 2、对策破锋 2，其余各 1。

### 4.2 跨场收益递减

殿试（主考官）对手携 `sig_palace_adapt` 时，重复破绽收益按层数递减（`weaknessDampen: 0.25`，至少保留 50% 压制）。这要求玩家在连续殿试中**不断换策**，而非一套打法打到底。

---

## 五、意图机制（Intent）

意图是 NPC 战前锁定的「本场打算怎么打」，由 `rollIntention()` 根据 `mech.intent` 与模板库生成 `intentLocked`，写入战斗会话。它决定了 NPC 实际选用的文体、文风、战策或骰组关注点。

### 5.1 披露层级（Disclosure）

意图并非总是全透明，分三档披露，对应研判卡能看到的信息量：

| 层级 | 含义 | 研判卡呈现 |
|------|------|------------|
| `full` | 明牌意图 | 挑明「拟用某体 / 某战策 / 专审某章法」 |
| `category` | 只给方向 | 仅提示「重立意」「已适应上场」等类别，不点具体 |
| `action` | 行动级 | 仅在落笔前公开「战策 / 封心」等行动 |

### 5.2 意图模板库（共 10 类）

| 模板 | 名称 | 类型 | 披露 | 玩家可读信息 |
|------|------|------|------|--------------|
| `int_preferred_style` | 偏好文体意图 | style | 通常 full | 倾向于使用某文体 |
| `int_manner_theme` | 文风立意意图 | manner | category | 重立意，某方向文风 |
| `int_steady` | 稳守意图 | strategy | action | 准备稳守、降低波动 |
| `int_dice_response` | 追加骰响应意图 | reactive | full | 你追加骰则转强攻 |
| `int_copycat` | 仿作意图 | history | category | 模仿你近日常用路数 |
| `int_palace_adapt` | 殿试适应意图 | cross_battle | category | 已据上一场调整 |
| `int_zeitgeist` | 逐潮意图 | zeitgeist | full | 顺应当朝风潮 |
| `int_active_watch` | 封心意图 | active_watch | action | 紧盯主动文心起落 |
| `int_pattern_hunt` | 审律意图 | pattern | full | 专审某骰组章法 |
| `int_declared_stance` | 定策意图 | stance | full | 已公开战策，邀你拆解 |

### 5.3 intentLocked 字段

`intentLocked` 包含：`style`（意图文体）、`manner`（文风）、`stance`（战策：attack/steady/turn）、`pattern`（骰组章法：pair/sequence/high）、`watchesActive`（是否封心盯文心），以及披露标记 `styleDisclosed` / `mannerDisclosed`。这些都由 `mechHints.intentHint()` 翻译成「行藏 / 立意 / 战策 / 审律 / 封心」五类研判断言。

---

## 六、结算与评分流程

一局战斗结算（`revealScores` 后）按以下顺序产出机制明细（`settleLines()` 负责翻译）：

1. **破绽先结算**：`weaknessResolution()` 判定玩家是否命中破绽 → 得到 `retention` 与 `shutdownLevel`。
2. **招牌按保留比例生效**：`signatureScoreMods()` 用 `retention` 摊薄招牌加成（`ret=wea.hit ? wea.retention : 1`）。
3. **多破绽合并**：取最强压制；跨场递减在此统一施加。
4. **玩家收益落地**：命中破绽可触发 `playerBonus`（己方作品加成）、`refundInsp`（返还灵感）、`infoBonus`（意图精度提升）。
5. **修正明细展示**：把 `mods.pct / mods.flat` 翻译成「修正生效」行，供玩家复盘。

结算文案三段式：`「招牌名」被尽数压制 / 至多发挥 X% / 未遭针对，全力施展` → `破绽名：正中破绽…（含返还/加成）` → 修正合计。

---

## 七、图鉴认知系统（跨局累计）

`codex.js` 把「遇到过的对手、命中过的破绽」持久化到 `localStorage`（键 `feihua_codex`），跨局累计。每名机制 NPC 都有**四级认知**（`foeCognition[npcId]`）：

| 等级 | 名称 | 解锁条件 | 图鉴呈现 |
|:----:|------|----------|----------|
| 0 | 未识 | 从未相遇 | 仅剪影 / 基础身份 |
| 1 | 相识 | 首次相遇 | 招牌名称与概述 |
| 2 | 察意 | 击败该对手，或交锋 ≥ 3 次 | 常见意图与行为倾向 |
| 3 | 破招 | 本场命中其破绽（最高等级） | 精确破绽条件、收益类型、成功次数 |

认知推进规则（`recordFoeCognition`）：相遇即相识；胜场或交锋满 3 次升「察意」；命中破绽升「破招」（封顶）。图鉴阁（`js/ui/codex.js`）按档位分组列出具名对手，邂逅者显真容，未遇者留剪影。

> 稳定标识：机制 NPC 用其具名 `id`（如 `kang_er_yu`）作认知键；无机制 NPC 用档位 `id`。这保证同一对手跨局累计、不会因名称变化而分散。

---

## 八、典型 NPC 实例

### 周小满（童生级 · 诗兴初发）
- 招牌：`sig_style_mastery`（诗体专精，+6%）
- 破绽：`wea_use_other_style`（改用他体，弃诗体可废其招牌）
- 意图：`int_preferred_style`（偏诗体）
- 教学意义：最朴素的「换体制敌」范式。

### 谢连城（举人级 · 审律摘瑕）
- 招牌：`sig_dice_pattern_hunt`（你骰组落「重章」时 +9%）
- 破绽：`wea_limited_extra_dice`（追加骰≤1 枚，招牌削至 25%）
- 意图：`int_pattern_hunt`（专审重复骰面）
- 对策：别把骰组搞出重复面，控制灵感骰数量。

### 顾清商（举人级 · 先声定策）
- 招牌：`sig_declared_stance`（公开稳守，未被针对则 +9%）
- 破绽：`wea_stance_counter`（按战策选章法：稳守→恰追加 1 枚骰破势，+4%）
- 意图：`int_declared_stance`（已明牌「稳守」，邀你正面拆解）
- 对策：对手已亮底牌，按 `counter` 表选对应章法即可破锋。

### 康尔玉（主考官 · 殿试必遇）
- 触发：玩家联力严格 > 35 时，殿试单场锁定出场（`palaceForcedWhen`）。
- 招牌：`sig_style_mastery`（联体专精，+6%）
- 破绽：`wea_use_other_style`（改用他体）
- 意图：`int_preferred_style`（偏联体，bias 1.4）
- 注：此为确定性兜底，不依赖云端配置字段是否完整（代码侧按 `id` 与显示名双重识别）。

### 桃花仙人（桃源终卷 · 隐藏 Boss）
- 身份：仅在隐藏终圈登场，不进入常规对手池（`isHiddenFinal`）。
- 机制：无 `mech` 数据，六维均衡、总和严格为 300，纯靠数值与终局规则压制。
- 进入条件：满足隐藏终圈资格（见 `board.hiddenFinalRing.requirements`）后由终圈邀请触发。

---

## 九、设计与扩展纪律

1. **数据与逻辑分离**：机制行为全在 `npc-mechanics.json` 模板库；`npcs.json` 只引用模板 + 填参。新增机制优先加模板，而非改 `rules.js`。
2. **文案不碰算分**：`mechHints.js` 是纯翻译层，只把 `mech` / `intentLocked` / `out.mech` 翻成古风文案，绝不参与判定。文案主体优先取自配置里人工写好的字段（如 `mech.signature.name`、`intent.description`），避免 UI 二次硬编码漂移。
3. **破绽永远优先**：任何新招牌模板都应配套至少一个破绽模板，确保「有强招必有可乘之隙」，维持攻防对称。
4. **跨局累计只增不降**：图鉴认知、文心等级、羁绊收集均单调递增，旧档缺字段时由 `normalizeCodex()` 容错回落，不会让游戏起不来。
5. **新增意图模板**需声明 `disclosure` 层级（full/category/action），并在 `mechHints.js` 的 `INTENT_TEMPLATE_DISPLAY` 补显示名，否则研判卡会回落为「打法」兜底名。

---

*本文档基于当前仓库 `feihuaqi-playable` 的 `config/npcs.json`、`config/npc-mechanics.json` 与 `js/engine`、`js/ui` 相关模块生成，可作为策划配置 NPC 与玩家理解对手机制的对照手册。*
