# 文心棋（飞花棋）微信小程序 · 架构设计

> 目标：以最短路径上线，并具备可持续拉新的能力。
> 技术选型：**原生小程序 + 微信云开发**。
> 依据：现有 H5 工程 `feihuaqi-playable` 的实测结构与体积，非估算。

---

## 一、一句话结论

这是一次**「引擎复用、UI 重写、资源外迁」**的移植，不是从零开发。
玩法逻辑一行不改，工程量集中在把 484KB 的 DOM 界面重写成 WXML/WXSS，以及把 22MB 素材挤出包体。
最大的技术风险不是开发量，而是**包体与资质**：前者已有明确解法，后者需要提前确认，否则会卡在提审。

---

## 二、现状盘点（实测数据）

| 项目 | 实测 | 对小程序的影响 |
|---|---|---|
| `js/engine` | 496KB | 纯逻辑、无 DOM，**可直接复用** |
| `js/ui` | 484KB | DOM + SVG 拼装，**全部作废，需重写** |
| `config/*.json` | 575KB（22 个文件） | `fetch` 加载不可用，改为 `require` 静态引入 |
| `assets` | 14MB（音乐 9.8MB WAV、美术 3.4MB） | 超出包体两个数量级，必须走云存储 |
| `fonts` | 4.1MB（Noto Serif SC woff2） | 必须子集化或异步加载 |
| `localStorage` 调用 | 66 处 | 用同步适配器全局注入，引擎零改动 |
| `fetch` 调用 | 6 处 | 改为配置注册表 |

**关键结构性事实**：H5 是「单页多屏」——所有屏幕（选流派、装配、图鉴、结算）都塞在 `index.html` 里靠显隐切换。
小程序天然是多页面路由，**这次移植应该顺势把多屏拆成多页面**，而不是照搬单页模式。

---

## 三、分层架构

### 3.1 引擎层：原样复用

`js/engine` 无 DOM 依赖，是移植的最大利好。只需两处适配：

1. **模块语法**：ESM `import` 改为小程序 `require`。
2. **配置读取**：`fetch('config/*.json')` 改为配置注册表 `configLoader.get(name)`。

建议裁剪：`config-contract.js`（36KB）是给内容作者做校验用的，客户端不需要，**不打包**。

### 3.2 UI 层：全量重写

`js/ui` 全部作废。重写时遵循小程序范式：

- 每个 H5 屏幕对应一个 Page；H5 里的弹层（战斗台、模态框）改为**自定义组件**，避免页面跳转丢失引擎状态。
- 棋盘原为 DOM 节点拼装，小程序里改为 WXML 网格 + `wxss` 定位。**不建议改用 Canvas**——60 格 DOM 节点的点击、动画、无障碍都更简单，且 Canvas 在中低端安卓机上重绘成本更高。

### 3.3 存储层：同步适配器

引擎里 66 处 `localStorage` 调用不必改动。在 `app.js` 启动时把适配器挂到全局：

```js
if (typeof globalThis.localStorage === 'undefined') {
  globalThis.localStorage = require('./utils/storage');
}
```

`wx.getStorageSync/setStorageSync` 是同步 API，语义与 Web Storage 一致，可一一对应。
注意单 key 上限 1MB、总配额 10MB，存档写入失败要有降级提示。

### 3.4 资源层：全部外迁

| 资源 | 现状 | 处理 |
|---|---|---|
| 背景音乐 | 9.8MB WAV | 转 MP3 128kbps（约 1MB），云存储托管，首次进入静默下载并 `saveFile` 缓存 |
| 字体 | 4.1MB woff2 | 子集化到 500KB 内，`wx.loadFontFace` 异步加载；失败降级系统字体，首屏不阻塞 |
| 美术 | 3.4MB（含 2.7MB PNG） | 转 WebP，按 1080 宽切图，云存储 CDN |

**域名备案是硬约束**：小程序 `request` / `downloadFile` 域名必须完成 ICP 备案。
因此资源只能放在**微信云存储**或已备案 CDN，不能用未备案的外部图床。

---

## 四、包体规划

### 4.1 实测划分结果

配置同步脚本 `scripts/sync-config.mjs` 已按「启动链路是否读得到」自动拆分，实测：

| 归属 | 内容 | 体积 |
|---|---|---|
| **主包** | schools / talents / talent-upgrade / synergies / npcs / npc-mechanics / board / questions / grades / attrs / numeric / inspiration / affinity / sky / leaderboard | **378.8KB** |
| pkg-codex | album | 32.9KB |
| pkg-meta | events / narrative | 63.0KB |
| pkg-side | sidequests / sidequest-npcs / sidequest-talents | 49.4KB |
| 排除 | cloud（编辑器同步配置） | — |

主包页面：主菜单、选流派、装配、对局、排行榜。
主包预算：配置 378.8KB + 引擎核心约 400KB + 页面代码约 150KB ≈ **930KB，距 2MB 红线有充分余量**。

### 4.2 分包与预下载

已在 `app.json` 配置：进入主菜单时预下载 `pkg-codex`（wifi 环境），进入对局时预下载 `pkg-side`。
同时开启 `lazyCodeLoading: "requiredComponents"`，按需注入页面代码，降低启动耗时。

### 4.3 一条硬规则

**主包不能 `require` 分包内的文件。** 分包必须在自己的入口页 `onLoad` 里注册它携带的配置：

```js
configLoader.register('album', require('../../config/album.json'));
```

---

## 五、状态管理：三条铁律

这是整个架构最容易出问题的地方。

1. **引擎实例不进 `data`。** 挂在 `this.engine`，它不参与渲染，进 `data` 只会被无谓序列化。
2. **只有视图模型进 `data`。** 由 `engine-host.js` 的 `project()` 把引擎状态投影成渲染所需的最小字段集。
3. **一次操作一次 `setData`。** 动作类交互尽量用路径增量更新（`patch()`），不要整体重传棋盘。

红线：单次 `setData` 不超过 256KB，每秒不超过 20 次。
对局页 `game.js` 已按此实现，可直接作为其余页面的模板。

---

## 六、数据层（微信云开发）

### 6.1 集合设计

| 集合 | 用途 |
|---|---|
| `users` | openid、昵称、名号、流派、渠道、最佳分数 |
| `runs` | 每一局明细，用于防刷对账 |
| `leaderboard` | 每人一条最好成绩 |
| `topCache` | 预热好的前 100 名，降低榜单读取开销 |
| `channelDaily` | 渠道来源日粒度统计 |

### 6.2 云函数

| 函数 | 职责 |
|---|---|
| `authLogin` | 静默换 openid + 建档，**不弹任何授权窗** |
| `submitScore` | 分数提交，四道校验：数值合法性 / 对局时长 / 提交频控 / runId 幂等 |
| `getRank` | 分页榜单，命中缓存走 `topCache` |
| `trackChannel` | 渠道归因累加 |

### 6.3 与现有 Supabase 榜单的衔接（关键结论）

H5 版榜单跑在 Supabase 上。要保持双端统一，**小程序前端不能直连 Supabase**——
`supabase.co` 没有 ICP 备案，无法加入小程序 request 合法域名。

可行路径只有一条：**云函数出网中转**。云函数不受域名白名单限制，在 `submitScore` 里双写云开发 + Supabase。
代码中已实现该分支，由环境变量 `SUPABASE_SYNC` 控制，同步失败不影响小程序侧写入。

### 6.4 离线优先

云调用一律走静默通道。云环境不可用、登录失败、网络异常时，
**单机玩法必须照常可玩**，只是在界面上提示「离线模式，榜单暂不可用」。

---

## 七、增长设计

### 7.1 主链路

进入 → 静默登录 → 对局 → 结算评级 → 生成战绩卡 → 好友点开 → 成为新用户。

战绩卡用 `canvas` 本地出图（不依赖服务端），分享 `path` 携带渠道参数，云侧按 `scene` 归因到 `channelDaily`。

### 7.2 有效的拉新手段

- **结局分享卡**：金榜题名 / 名落孙山两种结局都要有传播欲，失败结局做成自嘲卡片反而更容易转发。
- **排行榜常驻入口**：名次是长期留存抓手，主菜单一级入口。
- **订阅消息**：结算后请求「榜单名次变动」订阅，但模板需审核，首版可能来不及，作为二期。
- **搜一搜收录**：已配置 `sitemap.json`，主菜单与榜单页允许收录，对局页排除。

### 7.3 合规红线（务必遵守）

- **不得诱导分享**。「分享给 3 个好友解锁」属于违规，只能做额外奖励，不能做成流程卡点。
- **不得强制授权**。静默登录只拿 openid，昵称头像等用户主动填写时再取。
- **iOS 端虚拟支付受限**。当前无内购不受影响；若后续做内容解锁付费，iOS 端需另设计。

---

## 八、提审前必须确认的资质问题

这是唯一可能让项目卡死的外因，建议**在动工第一周就确认**，不要等到提审。

1. **主体资质**：小程序「游戏」类目需要提供软件著作权等资质，且**个人主体不可选游戏类目**。
   本项目若要走游戏类目，需要具备企业主体。
2. **类目替代方案**：飞花棋本质是「诗词格律 + 棋类玩法」，
   以**教育 / 文化**类目（国学、诗词素养）定位上线是常见可行路径，
   可在描述与界面上突出文学学习属性、弱化"游戏"字样。
   **最终口径建议在提审前与微信服务商或类目审核口径确认。**
3. **内容合规**：音乐与美术素材需确认版权归属（`assets/curated-library/licenses` 已有授权目录，沿用其规范）。
4. **隐私协议**：小程序后台需配置《用户隐私保护指引》，云开发获取 openid 属于必要范围，但仍需如实申报。

---

## 九、里程碑

| 周期 | 目标 | 验收标准 |
|---|---|---|
| 第 1 周 | 工程骨架 + 引擎接入 + 单一对局闭环 | **已达成**：选流派 → 对局 → 结算跑通，命令行自检 5/5 局走到结算 |
| 第 2 周 | UI 全量重写 + 云开发接入 | 真实掷骰与答题交互、战斗台、榜单可用，openid 建档成功 |
| 第 3 周 | 资源优化 + 分享裂变 + 性能调优 | 主包 < 2MB，首屏 < 1.5s，战绩卡可分享 |
| 第 4 周 | 提审 + 灰度 | 类目与资质确认完毕，体验版无阻断问题 |

---

## 十、第一周闭环（已实装）

### 10.1 引擎是怎么搬过来的

引擎保留了 ES Module 语法，只做两件事：

1. **剥离 import 路径上的 `?v=xxx` 缓存戳** —— 那是浏览器破缓存用的约定，小程序解析不了。
   全工程仅 5 处，由 `scripts/build-engine.mjs` 自动处理。
2. **配置改为编译期注入** —— 小程序没有 `fetch`，更不能运行时读包内文件。
   脚本把 `config/*.json` 编译成 `engine/embed-config.js`（纯 ES Module），
   取代了原设计里逐条 `require(JSON)` 的做法，避免 require 与 import 混用。
   原 JSON 已在 `project.config.json` 里排除出包体，不重复占用配额。

`config-loader.js` 仍保留，用于分包未来注册自己携带的配置。

### 10.2 驱动模型

引擎的循环只有两步，UI 完全被动：

```
game.start(schoolId, { loadout, name })  →  while (!over) await game.playTurn()  →  ui.showResult(summary)
```

玩家答题、选文心、走支线这类交互，全部通过 `ui` 回调实现。
第一周把这些回调收敛进 `utils/ui-adapter.js`：一律转成事件交给 sink，只对真正需要返回值的回调做「自动应答」。

其中最关键的是 **战斗**：不必先实现六步对决 UI，
引擎的 `session` 自带 `resolve(style, manner, dice)`，适配器直接调用它就完成了一场论战。

### 10.3 三条 setData 纪律（本次已落到实处）

引擎每回合会触发几十次 UI 回调（提示、状态同步、飘字）。若逐条 `setData`，渲染线程会被打爆。
现在页面只做两件事：

- `result` 事件 → 提交结算
- 其余事件 → 回合结束后随视图模型一次性提交

`Game` 实例挂在 `this.game`，从不进入 `data`。

### 10.4 验收方式

不依赖真机，命令行即可验证闭环：

```bash
node scripts/sync-config.mjs      # 拆分配置
node scripts/build-engine.mjs     # 搬运引擎 + 编译配置
node test/check-syntax.mjs        # 全量语法核验（ESM 走 .mjs 镜像）
node test/smoke-run.mjs 5         # 引擎自检：直接拼装 Game 跑 5 局
node test/smoke-runtime.mjs       # 装配层自检：走页面实际调用的那一层
```

自检会真实加载即将进包的文件（生成 `.mjs` 镜像而非另写实现），因此验证结果与上线表现一致。
实测结果：5 局全部走到结算，覆盖 `palace`（殿试已毕）与 `fengbi`（灵感封笔）两种结局。

### 10.5 当前限制（第二周要补的）

- **战斗是自动应答**：固定选最强文体 + 随机单骰，AI 偏弱，因此自动推演常以封笔收场。真实交互接入后会显著不同。
- **读档未实装**：存档要还原引擎完整运行时状态，工作量独立，主菜单「继续游戏」暂提示即将开放。
- **桌面级 UI 尚未重写**：当前是信息密度优先的简化版 HUD，六步对决、装配屏仍是后续工作。

---

## 十一、工程目录

```
feihuaqi-miniprogram/
├── app.js                 全局状态 + localStorage 适配注入 + 静默登录
├── app.json               路由、分包、预下载规则
├── app.wxss               全局设计变量
├── project.config.json    工程配置（记得改 appid；config/ scripts/ test/ 已排除出包）
├── engine/                从 H5 搬来的纯逻辑引擎（13 个文件，已剥离缓存戳）
│   └── embed-config.js    由 config/*.json 编译而来
├── config/                构建中间产物，不进包
├── pages/
│   ├── index/             主菜单
│   ├── school/            选流派（闭环起点）
│   ├── game/              对局与结算（闭环终点）
│   └── loadout, rank/     占位，待实装
├── pkg-codex|pkg-meta|pkg-side/
├── utils/
│   ├── engine-runtime.js  引擎装配层：startGame / playTurn / project
│   ├── ui-adapter.js      UI 回调 → 事件流的适配器
│   ├── storage.js         localStorage 同步适配器
│   ├── config-loader.js   分包配置注册表
│   └── cloud.js           云调用封装（含离线降级）
├── cloudfunctions/        authLogin / submitScore / getRank / trackChannel
├── scripts/               sync-config.mjs / build-engine.mjs
└── test/                  check-syntax / smoke-run / smoke-runtime / inspect-state
```

### 使用步骤

1. 开发者工具导入该目录，把 `project.config.json` 里的 `appid` 换成真实 AppID。
2. 开启云开发，创建第六节中的集合，上传四个云函数并配置环境变量。
3. 内容配置有更新时：`node scripts/sync-config.mjs && node scripts/build-engine.mjs`。
4. 改动后跑一遍 `test/` 下的自检。

### 体积现状

主包约 0.9MB（引擎 788KB + 页面与工具约 100KB），距 2MB 红线充裕。
`config/` 与 `scripts/`、`test/` 已在打包时排除。
