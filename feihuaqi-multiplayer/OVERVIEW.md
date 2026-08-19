# 飞花棋多人交互方案 · 总览

为回合制大富翁（飞花棋）网页端、低并发场景，设计并实现了一套**服务器权威**的多人交互方案，已落地可运行参考实现并通过冒烟测试。

## 交付物
- `multiplayer-design.md` — 结构化设计文档（六大模块 + 可扩展性/低延迟 + Godot Web 适配 + 接入步骤）
- `server/index.js` — 权威 WebSocket 服务器：房间/状态机、回合校验、断线宽限与自动跳过、重连快照、交易原子、基础防作弊
- `shared/protocol.js` — 客户端/服务器共用消息协议
- `client/multiplayer-client.js` — 浏览器端 ES 模块：鉴权、token 持久化、退避重连、动作/聊天
- `client/demo.html` — 最小可玩 Demo（开两个标签即对局）
- `server/test-smoke.mjs` — 双客户端冒烟测试（创建→加入→开局→掷骰→换回合→聊天，全过）

## 六大模块要点
1. **网络连接**：客户端-服务器（服务器权威）+ WebSocket；无状态连接层 + 房间分片 + 粘性路由。
2. **状态同步**：权威快照 + 事件增量（ON_CHANGE 等效），仅状态变化时广播；位置/动作/聊天分类同步。
3. **房间/匹配**：生命周期 waiting→playing→finished；大厅列表；quick_match 取空房或建新房；支持观战。
4. **会话/重连**：签名 token + localStorage；断线 45s 宽限后自动跳过其回合；重连带 token 即下发完整快照（零丢失）；房主转移。
5. **并发一致性**：单线程命令串行；serverSeq 收敛 + clientSeq 幂等；随机仅服务器；交易原子；追加式日志。
6. **防作弊**：服务器唯一裁判（骰子/资金/交易）；每条动作校验回合/参数/目标；不信任客户端状态；聊天净化。

## 运行
```bash
cd feihuaqi-multiplayer && npm install && npm start   # 另开: npm test
# 浏览器开 http://localhost:8080/client/demo.html （两标签）
```

## 接入现有 feihuaqi-playable/
把游戏逻辑拆出"纯状态层" `GameState` + `applyAction(state, action)`（无 DOM 依赖），放入 `Room`；UI 改为订阅服务器事件驱动重绘。详见设计文档第 9 节。
