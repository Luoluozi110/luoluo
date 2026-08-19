# 飞花棋「随时存档 / 读档」功能完善实施计划

> 范围：网页版 `feihuaqi-playable/` 的运行时存档（`js/engine/save.js` 与 `js/ui/app.js` 中的 `saveRun/loadGame`），不包含图鉴/累计进度存档码（`engine/album.js` 已相对成熟）。

## 一、现状与问题清单

通过阅读 `save.js`、`app.js`、`game.js`、`config.js`、`album.js`、`codex.js`，当前存档流程为：

```
开局/每回合结束/菜单手动保存
  → serializeRun(game) 把 game.s 全量 JSON 化（Set 转 {__set} 哨兵）
  → localStorage.setItem('feihua_run_save', JSON.stringify(obj))
读取
  → loadRun() 取 JSON
  → new Game(cfg, makeUi(), Math.random)
  → game.s = deserializeRun(obj, cfg)
```

### P0 — 导致读档后局内状态异常或崩溃

| # | 问题 | 影响 | 根因 |
|---|---|---|---|
| P0-1 | 天赋对象与配置不同步 | 读档后 `s.passive/s.active` 里存的是旧运行时天赋对象；若配置更新（编辑器新增/修改文心），对象结构与 `cfg.talentById` 不一致，效果结算可能错算或读取 `effect.type` 时崩溃。 | `serializeRun` 全量克隆对象引用，未按 ID 重新关联当前 `cfg.talents`。 |
| P0-2 | 装配的图鉴卡可能失效 | `s.loadout` 只存 ID，但加载后没有校验这些 ID 是否仍存在于当前 `cfg.album`；若图鉴配置被删改，后续展示/结算引用 `card.name` 可能 `undefined`。 | `deserializeRun` 未重新关联 `cfg.album` 中的图鉴卡对象。 |
| P0-3 | 缺少 schema 白名单与版本迁移 | `game.s` 新增字段（如最近删除的 `tendencies`，或未来新机制）后，旧存档加载时缺失字段；旧存档里的多余字段也可能污染状态。当前 `v:1` 没有迁移逻辑。 | `serializeRun` 遍历所有 key，没有固定 schema；`deserializeRun` 不补默认值。 |
| P0-4 | 加载时直接覆盖 `game.s`，Game 内部缓存未重建 | `new Game()` 后立刻 `game.s = st`，但 Game 在构造时可能生成/缓存的派生数据（如 `cfg.talentById`、`lianUnlocked` 缓存、天象生效状态）未按存档重新计算，可能导致后续回合行为不一致。 | 缺少 `rehydrate()` 或类似 hook。 |

### P1 — 保存不可靠、易丢进度

| # | 问题 | 影响 | 根因 |
|---|---|---|---|
| P1-1 | 回合中异步状态未稳定就存档 | 玩家在动画、答题、奇遇弹窗进行中刷新页面，可能存到不完整中间态。 | `onRoll` 在 `await game.playTurn()` 后立即 `saveRun`，未等待所有 UI 回调/派生状态更新完成。 |
| P1-2 | 写 localStorage 失败无降级 | 隐私模式、存储已满、iOS Safari 间歇性写失败时，存档直接丢失且仅提示 toast。 | `saveRun` 返回 `false` 即结束，没有内存备份或压缩。 |
| P1-3 | 无存档校验与损坏恢复 | 存档 JSON 被手动改坏、浏览器清理工具部分截断时，`loadRun/deserializeRun` 直接返回 `null` 或生成缺字段状态，导致「继续上局」按钮消失或加载后崩溃。 | 缺少结构化校验（字段、类型、范围）和损坏时的降级/提示。 |
| P1-4 | 自动存档与手动存档共用单槽 | 用户点菜单「保存当前进度」实际只是再写一次 `feihua_run_save`，无法保留关键节点；误操作后无法回滚。 | 只有单槽 `RUN_SAVE_KEY`。 |

### P2 — 性能、兼容性与可维护性

| # | 问题 | 影响 | 根因 |
|---|---|---|---|
| P2-1 | 存档体积无上限 | 长局日志 `s.log`、已造访事件 `seenEvents`、题目 `usedQuestions` 持续增长；localStorage 5MB 限制下可能撑爆。 | 未对日志做截断/压缩，也未估算体积。 |
| P2-2 | 包装层字段与 state 重复 | `serializeRun` 结果里 `schoolId`、`loadout` 与 `state.school`/`state.loadout` 重复，易不一致。 | 历史遗留冗余。 |
| P2-3 | 不可序列化类型处理不完整 | 除 `Set` 外，若 `game.s` 未来出现 `Map`、Date、函数等，`JSON.parse(JSON.stringify(v))` 会静默丢失或报错。 | 序列化策略未统一封装。 |

---

## 二、修复策略

### 2.1 数据模型：schema 白名单 + 版本迁移（解决 P0-3, P2-2, P2-3）

**改动文件**：`js/engine/save.js`

- 定义 `RUN_SAVE_VERSION = 2`。
- 新增 `STATE_KEYS` 白名单，明确哪些字段需要序列化：
  ```js
  const STATE_KEYS = [
    'school', 'playerName', 'attrs', 'inspiration', 'inspirationMax',
    'passive', 'active', 'track', 'pos', 'branchId', 'branchIndex',
    'lap', 'turn', 'phase', 'sky', 'nextBattlePct', 'battle', 'events',
    'quiz', 'seenEvents', 'usedQuestions', 'palaceWins', 'palaceDone',
    'zeitgeist', 'affStreak', 'synergies', 'loadout', 'titles',
    'over', 'reachedEnd', 'endReason', 'log'
  ];
  ```
- 序列化时只导出白名单字段；每个字段按类型处理（Set → `{__set:[]}`，其它按结构化克隆）。
- 去掉包装层冗余的 `schoolId`、`loadout`，统一从 `state` 读取；`savedAt` 保留用于 UI 展示。
- 新增 `migrateRun(obj)`：
  - `v === 1` 时补齐缺失字段（如已删除的 `tendencies` 不再保留，且按空值/默认值处理），清理未知字段。
  - `v >= 2` 时执行字段补齐（防御未来新增字段）。

### 2.2 加载时重新关联配置对象（解决 P0-1, P0-2）

**改动文件**：`js/engine/save.js` 的 `deserializeRun`

- `school` 按 `cfg.schools` 重新关联（当前已实现，保留并加强校验）。
- `passive/active`：只保存天赋 ID 列表；加载时通过 `cfg.talentById.get(id)` 重新取当前配置对象。若找不到则丢弃并记录日志。
  - 若需要保留「本局内临时叠加状态」，可扩展为 `{ id, overrides? }` 结构，当前无此需求，故简化。
- `loadout`：保存 ID 列表；加载时校验 ID 是否存在于 `cfg.album`；不存在则过滤掉，并 toast 提示「部分图鉴卡已失效」。
- `titles`：字符串数组，保持不变。

### 2.3 Game 加载后重建内部状态（解决 P0-4）

**改动文件**：`js/engine/game.js`、`js/ui/app.js`

- 在 `Game` 类新增 `rehydrate()` 方法：
  - 重新计算 `synergies`（基于当前 `passive/active` 与 `cfg.synergies`）。
  - 重新校验 `lianUnlocked`（依赖 `school.attr`/`attrs.lian`/天赋效果，属于 getter，无需持久缓存）。
  - 重建 `sky` 中需要运行时的对象引用（如有）。
- `app.js` 的 `loadGame` 在 `game.s = st` 后调用 `game.rehydrate()`，再刷新 UI。

### 2.4 异步保存安全与防抖动（解决 P1-1, P1-2）

**改动文件**：`js/engine/save.js`、`js/ui/app.js`

- 引入「安全保存点」机制：
  - `Game` 在 `playTurn()` 结尾、所有状态更新完成后触发 `this.onSavePoint?.()`。
  - `app.js` 中把 `saveRun(game)` 放到 `onSavePoint` 回调，而不是紧跟 `await playTurn()`。
- 增加防抖：连续快速掷骰/菜单操作时，300ms 内只写一次 localStorage。
- 写失败时 fallback：
  - 首次失败尝试压缩 JSON（可选，先以 gzip 字符串估算）；
  - 仍失败则保存到 `sessionStorage` 或内存变量，并提示「本机存储已满，请导出备份」。

### 2.5 校验、损坏恢复与多槽位（解决 P1-3, P1-4）

**改动文件**：`js/engine/save.js`、`js/ui/app.js`

- 新增 `validateRun(obj, cfg)`：检查 `version`、`state` 必填字段、`school.id`、`passive/active` 是否为 ID 数组、`over` 布尔等。
- `loadRun` 捕获损坏：返回 `{ ok: false, error }`，UI 根据错误提示「存档已损坏，是否开始新局？」。
- 多槽位：
  - 保留 `feihua_run_save` 作为自动存档槽。
  - 新增 `feihua_run_save_manual` 作为手动存档槽；菜单「保存当前进度」写入该槽，「读取存档」优先读取手动槽，其次自动槽。
  - 两个槽都支持，并在菜单中显示时间戳。

### 2.6 体积控制（解决 P2-1）

**改动文件**：`js/engine/save.js`、`js/engine/game.js`

- 对 `s.log` 做上限：超过 200 条时只保留最近 150 条（保留足够复盘，又避免无限增长）。
- `seenEvents`/`usedQuestions` 是 Set，自然去重，无需额外限制；若题目池扩大，可考虑在存档时仅保留最近 500 条（当前 66 题无需）。
- 序列化前估算 JSON 字符串长度，超过 3MB 时 toast 提示「存档较大，建议及时结束本局」。

---

## 三、验收标准

| 编号 | 验收项 | 通过标准 |
|---|---|---|
| A1 | 完整回合存档可读档 | 开局 → 任意回合 → 刷新页面 → 「继续上局」→ 属性、文心、位置、回合数、灵感和上一回合完全一致，可正常继续掷骰。 |
| A2 | 配置更新后读档不崩溃 | 用旧配置开一局并保存；更新 `talents.json`/`album.json` 后刷新；读档成功，失效天赋/图鉴卡被静默过滤，游戏可继续。 |
| A3 | 损坏存档可恢复 | 手动把 `feihua_run_save` 改成一个无效 JSON；刷新后「继续上局」不出现或提示损坏，点击后进入主菜单，不白屏/不崩溃。 |
| A4 | 存储写满有提示 | 在 localStorage 塞满数据后再存档，游戏提示「存储已满」并给出降级/清理建议，不静默丢失。 |
| A5 | 手动/自动存档分离 | 菜单「保存当前进度」后关闭页面再打开，读取的是手动存档；未手动保存时读取自动存档。 |
| A6 | 日志不会无限增长 | 模拟 300 回合，存档中 `log` 长度不超过 200。 |
| A7 | 异步中断不污染存档 | 在答题弹窗显示时刷新页面，再读档不应出现「卡在弹窗」「属性已扣但未进入下一回合」等中间态。 |

---

## 四、优先级排序与实施阶段

### 阶段一：核心正确性（必做，1–2 天）

1. **P0-3** schema 白名单 + 版本迁移
2. **P0-1** 天赋按 ID 重新关联 `cfg.talentById`
3. **P0-2** 图鉴装配按 ID 校验
4. **P0-4** Game 新增 `rehydrate()` 并在 `loadGame` 调用

### 阶段二：可靠性（高优，2–3 天）

5. **P1-3** 存档结构化校验与损坏恢复
6. **P1-1** 安全保存点 + 防抖
7. **P1-4** 手动/自动双槽位
8. **P1-2** 写失败降级（内存/sessionStorage + 提示）

### 阶段三：性能与清理（中优，1 天）

9. **P2-1** 日志截断与体积预警
10. **P2-2** 去掉包装层冗余字段
11. **P2-3** 统一序列化 helper（Set/Map/Date 处理）

---

## 五、回归验证步骤

1. **基础路径**
   - 新开局 → 手动保存 → 刷新 → 继续上局 → 完成一局 → 确认结算正常。
2. **跨版本路径**
   - 在修改前的 `v1` 存档 JSON 上运行 `migrateRun`，确认能正确升级到 `v2` 并补齐字段。
3. **配置变更路径**
   - 保存一局后，删除一个天赋、一个图鉴卡、修改一个学校 ID；刷新后读档，确认过滤/降级正常。
4. **损坏路径**
   - 把 `feihua_run_save` 分别改为：`{}`、`{v:2}`、乱码 JSON、`null`，确认均有 graceful 降级。
5. **压力路径**
   - 用无头脚本跑 50 局、每局 100 回合，每回合保存一次；统计存档失败率、读档后状态偏差率，要求 0 偏差。
6. **多槽路径**
   - 自动存档在第 5 回合；手动存档在第 10 回合；关闭再打开，确认读取的是第 10 回合。

---

## 六、建议新增的测试文件

- `tests/save-roundtrip.mjs`：回合级序列化/反序列化一致性断言。
- `tests/save-migration.mjs`：`v1` → `v2` 迁移断言。
- `tests/save-corruption.mjs`：损坏存档行为断言。
- `tests/save-quota.mjs`：模拟 localStorage 满时的降级行为。

这些测试可在 Node 环境中使用内存 localStorage mock 运行，纳入 CI（若有）或本地 `npm test`。
