# 桃花岛·飞花棋 —— 游戏音频系统设计文档

> 由「游戏音频工程师」基于现有 `feihuaqi-playable/`（纯浏览器 ES 模块、零外部资源）的现状设计。
> 设计基准继承工程既有规范：第 6 章「水墨 / 宋代美学」，五声音阶（宫商角徵羽 = C D E G A）为音高骨架。

---

## 1. 声音身份（Sonic Identity）

用三个形容词定义「这游戏应当听起来怎样」：

| 形容词 | 含义 | 落到声音上的体现 |
|---|---|---|
| **清雅** | 文人气息、留白、不喧哗 | 五声乐器音色（古琴、编钟、埙），避免电子味合成；混响克制 |
| **灵动** | 有回应、有呼吸、随局而变 | 掷骰/落子/答题都有即时反馈；配乐随场景与战况自适应 |
| **沉静而有张力** | 待机如展卷，论战暗流涌动 | 待机长音垫无疲劳；论战叠低音 drone 与加密节拍 |

---

## 2. 音频架构（总线结构）

全案共用**一个 `AudioContext`** 与**一条 Master 总线**，下分两条子总线，符合中间件「总线 / VCA」思想：

```
                         AudioContext.destination
                                  ▲
                              Master (gain)
                          ┌───────┴────────┐
                          │                │
                    SFX 总线            Music 总线 (musicBus, 基准 0.7)
              (audio.js 直连)      ┌───────┬───────┬───────┬───────┐
                          pad      arp     pulse    bell     drone
                       长音垫    古琴琶音  木节拍   编钟     低音
```

- **SFX 总线**：既有 9 类音效（`audio.js`），直连 Master，含全局点击音与骰子声。
- **Music 总线**：本方案新增 `music.js`，挂 5 个分层增益节点，所有配乐经此输出。
- **静音开关**：只动 Master 增益 → SFX 与 Music 同时静默，状态记忆于 `localStorage`。
- **闪避（Ducking）**：强 SFX（骰子/胜负/天象/解锁）播放时，Music 总线瞬时压到 35%，0.4s 内恢复，确保音效不被掩盖。

### 模块分工（不破坏既有结构）
| 文件 | 职责 |
|---|---|
| `js/ui/audio.js` | SFX 合成 + 全局点击音 + 静音 + **新增**：音乐总线、解锁钩子、共享接口（`getAudioContext`/`getMusicBus`/`onFirstUnlock`/`setDuckCallback`/`isMuted`/`MUSIC_GAIN`） |
| `js/ui/music.js`（**新增**） | 自适应配乐引擎：前瞻调度器、5 套场景床、6 种动画短旋律、场景淡变、闪避 |
| `js/ui/app.js` 等 | 仅调用 `setScene/setTension/sting`，不触碰合成细节（事件驱动，符合「逻辑在音频层、不在业务脚本」） |

---

## 3. 自适应音乐参数集

| 参数 | 取值 | 驱动源 | 作用 |
|---|---|---|---|
| **scene** | `idle` / `menu` / `board` / `battle` / `result` | 界面切换（`openSchoolScreen`/`openLoadout`/`startGame`/论战/结算） | 选择配乐床与各层目标增益 |
| **tension** | 0.0 – 1.0 | 论战开始置 0.7，结束回 0 | 提高琶音密度、开启低音 drone、轻微加速（最多 +12% BPM） |
| **stage** | 0 – 4（童生→秀才→举人→进士→主考官） | 游戏进度 `game.progress()` 分档（阈值对齐 `npcs.json` 的 tier.range） | **五声调式内移调**：每升一阶主音上移一个五度音级（宫→商→角→徵→羽），变调始终在调内、绝不跑调 |

- **切换规则**：所有场景在 **1.2s 内线性淡入淡出**，绝不硬切（玩家只「感到」过渡，不会「听到」切点）。
- **待机层（idle）**：一首**原创古风旋律**——笛主旋律（宫调式，四小节无缝循环）+ 古琴低音陪衬 + 长音垫 + 稀疏编钟；按当前科考阶段移调，可无限循环不疲劳。

---

## 4. 事件命名规范（适配 Web Audio）

沿用中间件 `event:/[Category]/[Sub]/[Name]` 思想，映射到本作的调用约定：

```
SFX（audio.js: play('name')）
  click   按键反馈（全局委托，覆盖所有 .btn/.school-card/.opt/.pick 等）
  dice    掷骰（木骰翻滚三下 + 落桌）
  move    棋子落格（拨弦如落墨）
  right   答对 / wrong 答错
  win / lose  论战胜负
  sky     天象切换    unlock  图鉴解锁

Music（music.js）
  setScene('idle'|'menu'|'board'|'battle'|'result')   场景配乐床
  setTension(0..1)                                    战况张力
  setStage(0..4)                                       科考阶段 → 五声调式内移调（待机主题随之变调）
  sting('dice'|'reveal'|'win'|'lose'|'unlock'|'sky') 动画短旋律
```

---

## 5. 四项需求落地映射

| 用户需求 | 实现 | 触发位置 |
|---|---|---|
| **① 按键反馈声音** | SFX `click`（纸墨轻叩），全局捕获委托，无需逐按钮挂钩 | `audio.js: bindGlobalClicks()` + `initAudio()`（**已有，沿用**） |
| **② 动画有相应配乐** | 场景配乐床随界面/动画切换（淡变）；关键动画叠加 `sting` 短旋律 | `setScene()`（各界面）+ `sting('dice'/'reveal'/'sky'/'unlock')` |
| **③ 骰子有声音** | SFX `dice`（木骰翻滚 + 落桌）+ `sting('dice')` 上行三音点缀 | `board.showDice()`、`battle.rollDice()`（**dice 已有，新增 sting 点缀**） |
| **④ 待机界面有配乐** | `setScene('idle')`：一首**原创古风旋律**（笛主旋律 + 古琴低音陪衬 + 长音垫 + 稀疏编钟）作待机/标题 BGM；按当前科考阶段 `setStage` 五声调式内移调；首次交互后起播 | `app.js boot()`、`openSchoolScreen()`（待机）、`startGame()`/`runBattle` 返回（按进度移调） |

---

## 6. 语音 / CPU / 内存预算（Web 端）

| 维度 | 预算 | 措施 |
|---|---|---|
| **音乐同时发声节点** | ≤ 16 | 静默层不调度节点；各层增益为 0 时跳过合成 |
| **调度抖动** | 0 爆音 | 前瞻调度器（lookahead 0.12s，25ms 轮询）逐拍合成，非 `setInterval` 直发声 |
| **CPU** | 远低于帧预算 | 纯振荡器/噪声合成，无解码；静音时调度器跳过发声 |
| **内存** | ≈ 0 额外 | 全部程序化合成，零音频文件，完全离线可用 |
| **解锁策略** | 符合浏览器 autoplay | `AudioContext` 仅在首次用户交互后 `resume()`；未解锁时丢弃排队音，避免齐鸣 |

> 注：本作为 2D 棋盘游戏，未启用 3D 空间音频（ occlusion / reverb zones）。若未来加入过场 3D 演出，可按专家规范补「衰减 + 射线遮挡 + 混响分区」。

---

## 7. 程序化合成配方（零外部文件）

| 音色 | 配方 |
|---|---|
| **长音垫 pad** | 正弦基音 + 微失谐三角泛音，缓入 0.25s 缓出，纯五度叠置和弦（宫-徵-商-羽进行） |
| **古琴拨弦 pluck** | 三角波基频 + 正弦二次泛音，短促指数衰减 |
| **编钟 bell** | 正弦基频 + 非整数倍泛音（×2.76、×5.4），长尾 |
| **木质节拍 woodTick** | 带通（~820Hz）短噪声簇 |
| **低音 drone** | 低八度正弦长音，由 tension 控制出现 |
| **笛/箫主旋律 flute** | 正弦基频 + 轻微颤音 LFO（~5.2Hz）+ 二次泛音（三角），柔和起音长尾，待机主题主奏 |

---

## 8. 集成位置清单（已落地）

| 文件 | 改动 |
|---|---|
| `audio.js` | 新增音乐总线 `musicBus`、解锁回调 `onFirstUnlock`、共享接口导出、`DUCK_SET` 与 duck 触发、`MUSIC_GAIN=0.7` |
| `music.js`（新） | 完整自适应配乐引擎 |
| `app.js` | `boot`/`openSchoolScreen`→`setScene('idle')` + `setStage(进度)`；`openLoadout`→`menu`；`startGame`/`runBattle` 返回→`board` + `setStage`；`runBattle`→`battle` + `setTension(0.7)`；`showResult`→`result`。新增 `stageFromProgress(p)` 将进度分 5 档对齐 `npcs.json` |
| `board.js` | `showDice`→`sting('dice')` |
| `battle.js` | `rollDice`→`sting('dice')` |
| `modals.js` | 答题揭晓→`sting('reveal')`；天象→`sting('sky')` |
| `album.js` | 图鉴解锁→`sting('unlock')` |

---

## 9. 验收 / 试听方法

ES 模块 + `fetch` 配置需经 HTTP 提供（不能直接 `file://` 打开）：

```bash
cd feihuaqi-playable && python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

验收清单：
1. **待机**：进入即见「選擇流派」标题，首次点击任意处后响起**古风旋律**（笛主旋律 + 古琴低音陪衬 + 长音垫 + 稀疏编钟）；进度推进后返回主菜单，待机主题**整体移调**（宫→商→角→徵→羽）仍可辨识。
2. **按键**：所有按钮/卡片点击有纸墨轻叩反馈（含 HUD 掷骰按钮）。
3. **骰子**：对局掷骰与论战掷骰均有木骰声 + 上行三音点缀。
4. **动画配乐**：选流派→装配→对局→论战→结算，配乐床随场景 1.2s 淡变切换；答题揭晓、天象、解锁各有短旋律。
5. **论战张力**：进入论战叠低音 drone、节拍加密；结束恢复对局床。
6. **静音**：右上角开关同时静默音效与配乐，刷新后记忆。

---

## 10. 后续可扩展（非本次范围）

- **专门标题/ splash 屏**：若有独立开场页，挂 `setScene('idle')` 即可复用待机配乐。
- **语音（VO）**：NPC 对白若引入语音，按 `event:/VO/[角色]/[台词]` 接入，置最高优先级、永不抢占。
- **更多场景层**：奇遇/天象专属床可加 `event:/Music/Event/...` 分支。
- **诊断 HUD**：开发期叠加「当前场景 / tension / 音乐总线增益」浮层，便于调参。
