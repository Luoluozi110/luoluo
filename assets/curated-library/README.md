# 《文心棋》图标与音效候选库

本目录收录一组可本地预览、可追溯来源、已按授权分级的候选素材。它不会自动替换游戏现有的程序化音频，也不会改变任何界面代码。

## 收录结果

- 22 枚图标：8 枚 Kenney CC0 PNG，14 枚 Game-icons.net CC BY 3.0 SVG。
- 12 条生产候选音效：6 条 Kenney UI CC0、4 条 OpenGameArt 纸张 CC0、2 条 OpenGameArt 木骰 CC0。
- 1 条选型试听：Freesound CC0 低码率公开预览，仅供比较；发布前应登录原站取得 WAV 母带。
- Craftpix、即时设计资源社区、Sketchfab 已完成页面级筛选，但没有把授权或用途不匹配的原文件复制进仓库。

打开 `preview.html` 即可浏览图标并试听音效。完整来源、授权边界与未入库候选见 `SOURCES.md`，发行时可直接使用的署名文字见 `ATTRIBUTION.md`。

## 推荐语义映射

| 游戏语义 | 首选素材 | 备选素材 |
|---|---|---|
| 文心 / 创作 | `icons/game-icons/quill-ink.svg` | `ink-swirl.svg` |
| 图鉴 / 题库 | `icons/game-icons/open-book.svg` | `icons/kenney-board-game-icons/book_open.png` |
| 奇遇 / 文书 | `icons/game-icons/scroll-unfurled.svg` | `icons/kenney-board-game-icons/cards_stack.png` |
| 灵感 / 创意 | `icons/game-icons/brainstorm.svg` | `lotus.svg` |
| 名望 / 胜利 | `icons/game-icons/laurels.svg` | `trophy.svg`、`award.png` |
| 天象 | `icons/game-icons/sunrise.svg`、`raining.svg` | — |
| 计时 | `icons/game-icons/hourglass.svg` | `icons/kenney-board-game-icons/hourglass.png` |
| 掷骰 / 棋子 | `dice-six-faces-six.svg`、`pawn.png` | `dice.png` |
| 音效 / 音乐 | `speaker.svg`、`musical-notes.svg` | — |
| 普通按键 | `audio/kenney-ui/click1.ogg` | `click2.ogg` |
| 按下 / 松开 | `mouseclick1.ogg` / `mouserelease1.ogg` | — |
| 展卷 / 卡片切换 | `audio/opengameart-paper/paper-sound-1.mp3` | `paper-sound-2.mp3`～`4.mp3` |
| 木骰落桌 | `audio/opengameart-dice/wooden-dice-1.flac` | `wooden-dice-3.flac` |

## 使用约束

1. Game-icons.net 图标已经去除黑色底板，并将前景改为项目墨色 `#432C24`；这属于允许的改色衍生，署名仍然必须保留。
2. Kenney PNG 是白色透明底，适合深色按钮或徽章；浅色背景应在组件层加深色底板。
3. Freesound 文件位于 `audio/review-only/`，禁止把它当作最终母带发布。
4. 纸声和骰声尚未接入运行时代码；先在不同设备上试听，再决定裁切、响度与淡入淡出。
5. 若最终不使用 Game-icons.net 的任何文件，可同时移除其署名段落；只要保留任意一枚，就必须保留 CC BY 3.0 署名。
