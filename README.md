# 文心棋工作区

当前主产品位于 `feihuaqi-playable/`，内容编辑器位于 `feihua-editors/`，多人模式位于
`feihuaqi-multiplayer/`。根目录下的数值模拟和迁移脚本属于开发工具，不是线上运行入口。

## 统一入口

| 用途 | 唯一正式地址 / 来源 | 说明 |
|---|---|---|
| 在线内容编辑器 | https://luoluozi110.github.io/luoluo/feihua-editors/ | 当前唯一权威编辑器网页；与 GitHub `main` 的 `feihua-editors/` 子树同步 |
| 在线游戏 | https://luoluozi110.github.io/luoluo/ | GitHub Pages 游戏入口 |
| 游戏运行时内容源 | https://raw.githubusercontent.com/Luoluozi110/luoluo/main/feihua-content.json | `config/cloud.json` 唯一配置；不是编辑器网页 |
| 本地编辑器 | `http://127.0.0.1:<端口>/feihua-editors/` | 仅运行 `npm run editor:bridge` / `npm run editor:open` 时使用，不是线上权威地址 |
| CloudStudio | https://b7448dae814340d882052e04260fa5cb.gz3.agentos-app.net/ | 当前验证通过的游戏分享页；不提供在线编辑器 |

编辑器正式入口只保留上表第一项。旧 CloudStudio 编辑器分享页已废弃，不能作为编辑器或数据源使用。

```bash
npm run dev                 # 启动可玩版：http://localhost:8080/
npm run validate:config     # 使用统一契约校验全部正式配置
npm test                    # 运行全部正式测试
npm run test:playable       # 仅可玩版
npm run test:editors        # 仅内容编辑器
npm run test:workspace      # 跨模块/历史兼容测试
npm run test:multiplayer    # 仅多人参考实现
```

可通过 `PORT=端口号`（PowerShell 使用 `$env:PORT=端口号`）覆盖开发服务器默认端口 8080。
