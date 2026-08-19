# 飞花棋多人交互参考实现

回合制大富翁（飞花棋）的**服务器权威**多人方案：客户端-服务器架构 + 离散回合状态同步。覆盖网络连接、状态同步、房间/匹配、会话与重连、并发一致性、防作弊六大模块。设计文档见 [`multiplayer-design.md`](./multiplayer-design.md)。

## 目录
```
feihuaqi-multiplayer/
├── multiplayer-design.md   # 结构化设计文档（六大模块 + 扩展性/低延迟 + Godot 适配）
├── shared/protocol.js      # 客户端/服务器共用的消息协议
├── server/index.js         # 权威 WebSocket 服务器（房间/状态机/校验/重连/防作弊）
├── server/test-smoke.mjs   # 双客户端冒烟测试
├── client/multiplayer-client.js  # 浏览器端 ES 模块客户端
├── client/demo.html        # 最小可玩 Demo（开两个标签即可对局）
└── package.json
```

## 快速开始
```bash
# 1. 安装依赖（隔离环境）
cd feihuaqi-multiplayer
npm install

# 2. 启动服务器（默认 :8080）
npm start

# 3. 冒烟测试（另开终端）
npm test

# 4. 打开两个浏览器标签体验
#    http://localhost:8080/client/demo.html
#    标签A：连接 → 创建房间 → 开始
#    标签B：连接 → 快速匹配（或填入 A 的 roomId 加入）
#    轮流：掷骰 → 买地/结束回合 → 聊天
```

## 核心纪律
- **客户端只发意图**：`client.sendAction(type, payload)`，所有结果由服务器下发。
- **服务器唯一裁判**：骰子/资金/交易只在服务器计算与写入，杜绝作弊。
- **幂等 + 收敛**：每条动作带 `clientSeq`（防重），服务器广播带 `serverSeq`（客户端按序应用，保证一致）。
- **断线零丢失**：状态全在服务器；重连带 token 即恢复并下发完整快照。

## 接入现有 feihuaqi-playable/
把当前游戏逻辑拆出"纯状态层"`GameState` + `applyAction(state, action)`（无 DOM 依赖），放入 `Room`，UI 改为订阅服务器事件驱动重绘。详见设计文档第 9 节。
