# 桃花书院岛资源说明

`peach-academy-island-v1.png` 是可继续拆层的 1254×1254 RGBA 母版；页面优先加载 960px 与
640px 的透明 WebP 派生图。版本号使用不可覆盖的 `v1`，后续迭代请新增 `v2`，不要覆写母版。

## 生成方式

使用 Codex 内置 ImageGen，以用户提供的桃源山水参考图作为构图与气质参考，生成原创游戏资产。

生成提示词：

> Create an original premium game-board centerpiece asset inspired by the attached reference's luminous Chinese fantasy atmosphere, turquoise water, misty karst mountains, peach blossoms, elegant classical architecture, and warm sunrise color harmony. Deliver one isolated square transparent-background island asset, seen from a high three-quarter oblique/isometric viewpoint suitable for the empty center of a board game. The island is a refined “Peach Blossom Academy”: layered turquoise water and rocky islets, dense pink and white peach trees, a coherent academy compound of dark-blue tiled pavilions, one slender pagoda, garden paths and stairways, and a graceful stone bridge entering from the bottom center. Keep the whole silhouette compact and circular/diamond-like with generous transparent padding, strongest detail in the middle, readable at small size, painterly yet crisp premium Chinese mobile-game illustration, unified warm light from upper right, delicate atmospheric mist within the island only. No sky rectangle, no background landscape outside the island, no board tiles, no UI, no text, no logos, no characters, no frame, no cropped elements, no photorealism, no copied composition.

## 分层约定

- 当前整图属于 `.world-ground`，服务平面视图与实验性 2.5D 预览。
- `.world-billboards` 已预留，正式 2.5D 时把亭塔、树冠拆入其中，湖面、山石与桥面保留在 ground。
- 图片只承担叙事美术，必须保持 `pointer-events: none`，不得覆盖或替代格子命中区。
