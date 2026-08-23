# 文心棋工作区

当前主产品位于 `feihuaqi-playable/`，内容编辑器位于 `feihua-editors/`，多人模式位于
`feihuaqi-multiplayer/`。根目录下的数值模拟和迁移脚本属于开发工具，不是线上运行入口。

## 统一入口

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
