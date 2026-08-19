# Workbook Design — 飞花棋·文心升级系统完整数值表

> 由 excel-generation skill 在主代理侧产出，供 sheet-agent 子代理按图施工。

## User Intent
为现有全部文心设计品质分级、等级上限、逐级灵感升级成本、属性/概率/倍率/主动使用消耗成长，并输出完整、可实现的逐级数值表。

## Scenario Archetype
- 计算模型型 + 统计型：品质成本是假设输入，37 枚文心的 155 行逐级参数是计算/配置明细，需可筛选和审阅。
- 实施规格型：除了数值，还必须明确 effect 字段映射、接线缺口、存档迁移与验收边界。

## Sheets
- 设计总览（角色：核心假设、设计支柱、失败信号、品质摘要）
- 品质成本曲线（角色：四档品质的等级上限、逐级/累计灵感成本）
- 文心总表（角色：37 枚文心的品质、旧版映射、Lv1/满级效果总览）
- 逐级数值（角色：155 行完整逐级配置明细）
- 效果字段映射（角色：21 类 effect 的字段、单位、边界与接线说明）
- 实装验收（角色：P0/P1/P2 实现任务和验收标准）

## Sheet: 设计总览

### Columns
| 列 | 字段名 | 类型 | 来源 | 备注 |
|---|---|---|---|---|
| A | 模块 | 枚举 | reference/model/data.json meta | Fun Hypothesis / 核心假设 / 设计支柱 / 失败信号 / 品质摘要 |
| B | 项目 | 文本 | reference/model/data.json meta | 项目名称或品质名 |
| C | 内容 | 文本 | reference/model/data.json meta | 详细说明，自动换行 |
| D | 数值 | 数字 | reference/model/data.json qualityCosts | 品质摘要可填最大等级/满级成本等；非数值项留空 |
| E | 单位 | 文本 | 推断 | 级 / 灵感 / % 等 |

### Sample Data Scale
按 reference/model/data.json 的 meta 全量写入；品质摘要 4 行。

### Notes for sheet-agent
- 第 1 行标题“飞花棋·文心升级系统完整数值表”，合并 A1:E1；第 2 行写生成时间与“所有数值为首轮仿真起点 [PLACEHOLDER]”。第 4 行表头，第 5 行起数据。
- 表头商务蓝 `#4472C4` 底 + 白字 + 加粗 + 居中 + 下边框 thin；正文浅灰/白交替。
- C 列宽 360px，自动换行；冻结第 4 行以上，开启筛选。
- 品质摘要需展示：普通 3级/16灵感、稀有 4级/34、史诗 5级/60、传说 6级/95；抽取目标 45%/32%/18%/5%。
- 失败信号使用浅红底 `#FCE4D6`；Fun Hypothesis 使用浅蓝底 `#D9E2F3`。

## Sheet: 品质成本曲线

### Columns
| 列 | 字段名 | 类型 | 来源 | 备注 |
|---|---|---|---|---|
| A | 品质 | 枚举 | reference/model/data.json qualityCosts | 普通/稀有/史诗/传说 |
| B | 最大等级 | 数字 | 同上 | 品质上限 |
| C | 目标抽取概率 | 百分比 | 同上 | targetDrawOdds |
| D | 当前等级 | 数字 | 同上 | 1~最大等级 |
| E | 升至本级成本 | 数字 | 同上 | Lv1 为0 |
| F | 升下一级成本 | 数字 | 同上 | 满级留空 |
| G | 累计升级成本 | 数字 | 同上 | 从Lv1升到当前等级的累计灵感 |
| H | 满级总成本 | 数字 | 同上 | fullUpgradeCost |
| I | 设计依据 | 文本 | 同上 | rationale，自动换行 |

### Sample Data Scale
18 行（3+4+5+6）。

### Notes for sheet-agent
- 第 1 行表头，数据第 2~19 行；开启筛选并冻结首行。
- 表头 `#4472C4` + 白字；I 列宽 300px 自动换行。
- 条件格式按品质：普通浅灰 `#E7E6E6`、稀有浅蓝 `#D9EAF7`、史诗浅紫 `#E4DFEC`、传说浅橙 `#FCE4D6`。
- G/H 列使用千位分隔；C 列百分比 `0%`。
- 图表：在 K2 放折线图“品质累计升级成本”，横轴当前等级D，系列按品质拆分，数值G；表达成本斜率随品质和等级上升。

## Sheet: 文心总表

### Columns
| 列 | 字段名 | 类型 | 来源 | 备注 |
|---|---|---|---|---|
| A | ID | 文本 | reference/model/data.json talentSummary | 文心稳定ID |
| B | 名称 | 文本 | 同上 | 37枚全量 |
| C | 类型 | 枚举 | 同上 | 被动/主动 |
| D | 流派 | 文本 | 同上 | 无则留空 |
| E | 品质 | 枚举 | 同上 | 普通/稀有/史诗/传说 |
| F | 等级上限 | 数字 | 同上 | maxLevel |
| G | 旧版等效等级 | 数字 | 同上 | 旧配置最接近新曲线哪一级，仅迁移/对照，不代表新局初始等级 |
| H | 现有效果类型 | 文本 | 同上 | effect type |
| I | Lv1效果 | 文本 | 同上 | level1Effect |
| J | 满级效果 | 文本 | 同上 | maxEffect |
| K | 满级升级成本 | 数字 | 同上 | fullUpgradeCost |
| L | 主参数 | 文本 | 同上 | primaryParam |
| M | 次参数 | 文本 | 同上 | secondaryParam |
| N | 当前配置JSON | 文本 | 同上 | legacyConfig，自动换行 |
| O | 实装备注 | 文本 | 同上 | implementationNote，自动换行 |

### Sample Data Scale
37 行全量文心。

### Notes for sheet-agent
- 第 1 行表头，数据第 2~38 行；冻结首行和 A:B 两列，开启筛选。
- 表头 `#4472C4` + 白字；I/J/N/O 列宽分别 260/260/320/300px，自动换行。
- 品质条件格式同“品质成本曲线”；O 列非空时浅黄底 `#FFF2CC`。
- 主动文心行 C=主动时，在 C 列使用浅蓝底 `#DDEBF7`。

## Sheet: 逐级数值

### Columns
| 列 | 字段名 | 类型 | 来源 | 备注 |
|---|---|---|---|---|
| A | ID | 文本 | reference/model/data.json levelDetails | 文心稳定ID |
| B | 名称 | 文本 | 同上 | 文心名 |
| C | 类型 | 枚举 | 同上 | 被动/主动 |
| D | 品质 | 枚举 | 同上 | 普通/稀有/史诗/传说 |
| E | 等级 | 数字 | 同上 | 当前等级 |
| F | 等级上限 | 数字 | 同上 | maxLevel |
| G | 升至本级成本 | 数字 | 同上 | costToThis |
| H | 升下一级成本 | 数字 | 同上 | costToNext，满级留空 |
| I | 累计升级成本 | 数字 | 同上 | cumulativeCost |
| J | 主参数名 | 文本 | 同上 | primaryParam |
| K | 主参数原值 | 数字（3位小数） | 同上 | primaryRaw；百分比仍保留0~1原值，便于程序读取 |
| L | 主参数展示 | 文本 | 同上 | primaryDisplay |
| M | 次参数名 | 文本 | 同上 | secondaryParam |
| N | 次参数原值 | 数字（3位小数） | 同上 | secondaryRaw；无则留空 |
| O | 次参数展示 | 文本 | 同上 | secondaryDisplay |
| P | 使用消耗 | 数字 | 同上 | 仅主动文心；被动留空；最低1 |
| Q | 完整效果文案 | 文本 | 同上 | effectText，自动换行 |
| R | 旧版等效级 | 布尔 | 同上 | 是/空 |
| S | 实装备注 | 文本 | 同上 | note，自动换行 |

### Sample Data Scale
155 行（37枚按品质上限展开）。

### Notes for sheet-agent
- 第 1 行表头，数据第 2~156 行；冻结首行和 A:B 两列，开启筛选。
- 表头 `#4472C4` + 白字；Q/S 列宽 320px，自动换行。
- 品质条件格式同前；R=是时整行使用浅绿底 `#E2F0D9`，用于快速定位旧配置的等效档。
- G/H/I/P 为灵感整数；K/N 保留3位小数以避免百分比精度丢失。
- 每枚文心按 ID、等级升序排列。

## Sheet: 效果字段映射

### Columns
| 列 | 字段名 | 类型 | 来源 | 备注 |
|---|---|---|---|---|
| A | effect.type | 文本 | reference/model/data.json effectMapping | 21类效果 |
| B | 设计作用 | 文本 | 同上 | purpose |
| C | 升级字段 | 文本 | 同上 | fields |
| D | 单位 | 文本 | 同上 | unit |
| E | 建议范围 | 文本 | 同上 | range |
| F | 引擎边界/备注 | 文本 | 同上 | boundary，自动换行 |

### Sample Data Scale
21 行。

### Notes for sheet-agent
- 第 1 行表头，数据第 2~22 行；冻结首行，开启筛选。
- F 列宽 360px 自动换行；含“P0”或“未接线”字样标红底 `#FFC7CE` + 红字 `#9C0006`。
- 表头 `#4472C4` + 白字。

## Sheet: 实装验收

### Columns
| 列 | 字段名 | 类型 | 来源 | 备注 |
|---|---|---|---|---|
| A | 优先级 | 枚举 | reference/model/data.json implementationChecklist | P0/P1/P2 |
| B | 模块 | 文本 | 同上 | 状态/配置/引擎/UI/仿真等 |
| C | 实装事项 | 文本 | 同上 | item，自动换行 |
| D | 验收标准 | 文本 | 同上 | acceptance，自动换行 |

### Sample Data Scale
11 行。

### Notes for sheet-agent
- 第 1 行表头，数据第 2~12 行；冻结首行，开启筛选。
- C/D 列宽 360px，自动换行。
- P0 红底 `#FFC7CE`、P1 黄底 `#FFEB9C`、P2 蓝底 `#D9EAF7`；表头 `#4472C4` + 白字。

## Charts / Pivots
- 品质成本曲线：折线图“品质累计升级成本”，数据源 A/D/G，按品质分系列。
- 其他 sheet 不加图表，避免配置明细被视觉元素干扰。

## 约束与不做的事
- 本次只产出设计与完整数值表，不直接修改游戏代码、talents.json、存档版本或UI。
- 所有数值明确为首轮仿真起点 [PLACEHOLDER]，不声称已经过实机平衡验证。
- 不设计跨局付费/养成经济；默认单局内升级、随本局存档。
- 不改动现有文心名称、故事文本、羁绊成员或文心槽位上限。
