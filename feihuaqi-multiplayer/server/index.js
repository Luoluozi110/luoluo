// 飞花棋多人交互 —— 服务器权威参考实现
// 传输：WebSocket；架构：客户端-服务器（服务器持有唯一 GameState）
// 关键纪律：客户端只发"意图"，服务器校验后写入状态并广播（防作弊 + 一致性）

import { WebSocketServer } from 'ws';
import { randomUUID } from 'node:crypto';
import { C2S, S2C, ACTION, makeMsg, parseMsg } from '../shared/protocol.js';

const RECONNECT_GRACE = 45000; // 断线宽限（ms）：超时则自动跳过其回合

export function startServer(port = process.env.PORT || 8080) {
  const wss = new WebSocketServer({ port });
  const sessions = new Map(); // token -> { playerId, name, roomId }
  const rooms = new Map();    // roomId -> Room

  const send = (sock, type, payload) => {
    if (sock && sock.readyState === sock.OPEN) sock.send(makeMsg(type, payload));
  };
  const err = (sock, code, msg = '') => send(sock, S2C.ERROR, { code, msg });

  // ---------- Room：权威游戏房间 ----------
  class Room {
    constructor(opts, hostToken) {
      this.id = randomUUID().slice(0, 8);
      this.name = opts.name || '房间';
      this.maxPlayers = opts.maxPlayers || 4;
      this.password = opts.password || '';
      this.boardSize = opts.boardSize || 24;
      this.phase = 'waiting'; // waiting | playing | finished
      this.host = hostToken;
      this.players = [];      // { playerId, name, token, socket, connected, tile, cash, pendingAction, lastSeq }
      this.turnOrder = [];    // [token, ...]
      this.turnIdx = 0;
      this.serverSeq = 0;     // 单调序列号：保证所有客户端收敛
      this.log = [];          // 追加式事件日志（重连补发/反作弊取证）
      this.pendingTrades = new Map();
      this.disconnectTimers = new Map();
    }
    get currentPlayer() {
      if (this.turnOrder.length === 0) return null;
      return this.players.find((p) => p.token === this.turnOrder[this.turnIdx]);
    }
    broadcast(type, payload, exceptToken = null) {
      for (const p of this.players) {
        if (p.token === exceptToken) continue;
        send(p.socket, type, payload);
      }
    }
    snapshot() {
      return {
        roomId: this.id,
        name: this.name,
        phase: this.phase,
        maxPlayers: this.maxPlayers,
        boardSize: this.boardSize,
        players: this.players.map((p) => ({
          playerId: p.playerId, name: p.name, connected: p.connected, tile: p.tile, cash: p.cash,
        })),
        turnOrder: this.turnOrder,
        currentTurn: this.turnOrder[this.turnIdx] || null,
        serverSeq: this.serverSeq,
      };
    }
    commit(eventType, by, payload) {
      this.serverSeq += 1;
      const ev = { serverSeq: this.serverSeq, type: eventType, by, payload, t: Date.now() };
      this.log.push(ev);
      this.broadcast(S2C.EVENT, ev);
    }
  }

  function startGame(room) {
    room.phase = 'playing';
    room.turnOrder = room.players.map((p) => p.token);
    room.turnIdx = 0;
    room.players.forEach((p) => { p.tile = 0; p.cash = 1500; p.pendingAction = false; });
    room.broadcast(S2C.ROOM_STATE, room.snapshot()); // 开局下发完整快照
    room.commit('start', room.host, { currentTurn: room.turnOrder[0] });
  }

  // ---------- 连接处理 ----------
  wss.on('connection', (sock) => {
    sock.token = null;
    sock.on('message', (raw) => {
      const m = parseMsg(raw);
      if (m) handle(sock, m);
    });
    sock.on('close', () => onClose(sock));
    sock.on('error', () => {});
  });

  function handle(sock, m) {
    switch (m.type) {
      case C2S.HELLO: return onHello(sock, m.payload);
      case C2S.ROOM_CREATE: return onRoomCreate(sock, m.payload);
      case C2S.ROOM_JOIN: return onRoomJoin(sock, m.payload);
      case C2S.ROOM_QUICKMATCH: return onQuickMatch(sock);
      case C2S.ROOM_LEAVE: return onRoomLeave(sock);
      case C2S.ACTION: return onAction(sock, m.payload);
      case C2S.CHAT: return onChat(sock, m.payload);
      case C2S.PING: return send(sock, S2C.PONG, { t: m.payload.t });
      default: err(sock, 'UNKNOWN_MSG');
    }
  }

  function onHello(sock, p) {
    // 重连：带有效 token 即找回身份与房间
    if (p.token && sessions.has(p.token)) {
      const s = sessions.get(p.token);
      sock.token = p.token;
      s.name = p.name || s.name;
      const room = rooms.get(s.roomId);
      if (room) {
        const player = room.players.find((pl) => pl.token === p.token);
        if (player) {
          player.socket = sock; player.connected = true; player.name = s.name;
          if (room.disconnectTimers.has(p.token)) {
            clearTimeout(room.disconnectTimers.get(p.token));
            room.disconnectTimers.delete(p.token);
          }
          send(sock, S2C.WELCOME, { token: p.token, playerId: s.playerId, name: s.name, reconnected: true });
          send(sock, S2C.ROOM_STATE, room.snapshot());
          room.broadcast(S2C.PLAYER_JOINED, { playerId: s.playerId, name: s.name, connected: true }, p.token);
          return;
        }
      }
      // token 有效但房间已不在：当新用户处理
    }
    const token = randomUUID();
    const playerId = 'P' + randomUUID().slice(0, 4);
    sessions.set(token, { playerId, name: p.name || '玩家', roomId: null });
    sock.token = token;
    send(sock, S2C.WELCOME, { token, playerId, name: p.name || '玩家' });
  }

  function addPlayerToRoom(room, sock, token) {
    const s = sessions.get(token);
    const player = {
      playerId: s.playerId, name: s.name, token, socket: sock,
      connected: true, tile: 0, cash: 1500, pendingAction: false, lastSeq: 0,
    };
    room.players.push(player);
    return player;
  }

  function onRoomCreate(sock, p) {
    const token = sock.token;
    if (!token || !sessions.has(token)) return err(sock, 'NO_AUTH');
    if (sessions.get(token).roomId) return err(sock, 'ALREADY_IN_ROOM');
    const room = new Room(p, token);
    addPlayerToRoom(room, sock, token);
    rooms.set(room.id, room);
    sessions.get(token).roomId = room.id;
    send(sock, S2C.ROOM_STATE, room.snapshot());
  }

  function onRoomJoin(sock, p) {
    const token = sock.token;
    if (!token || !sessions.has(token)) return err(sock, 'NO_AUTH');
    const room = rooms.get(p.roomId);
    if (!room) return err(sock, 'ROOM_NOT_FOUND');
    if (room.phase !== 'waiting') return err(sock, 'ROOM_STARTED');
    if (room.players.length >= room.maxPlayers) return err(sock, 'ROOM_FULL');
    if (room.password && room.password !== p.password) return err(sock, 'WRONG_PASSWORD');
    if (sessions.get(token).roomId) return err(sock, 'ALREADY_IN_ROOM');
    addPlayerToRoom(room, sock, token);
    sessions.get(token).roomId = room.id;
    send(sock, S2C.ROOM_STATE, room.snapshot());
    room.broadcast(S2C.PLAYER_JOINED, { playerId: sessions.get(token).playerId, name: sessions.get(token).name, connected: true }, token);
  }

  function onQuickMatch(sock) {
    const token = sock.token;
    if (!token) return err(sock, 'NO_AUTH');
    for (const room of rooms.values()) {
      if (room.phase === 'waiting' && room.players.length < room.maxPlayers && !room.password) {
        return onRoomJoin(sock, { roomId: room.id });
      }
    }
    return onRoomCreate(sock, { name: '快速房', maxPlayers: 4 });
  }

  function onRoomLeave(sock) {
    const token = sock.token;
    if (!token) return;
    const s = sessions.get(token);
    if (!s || !s.roomId) return;
    const room = rooms.get(s.roomId);
    if (room) removePlayer(room, token);
    s.roomId = null;
  }

  function removePlayer(room, token) {
    const idx = room.players.findIndex((p) => p.token === token);
    if (idx < 0) return;
    const [player] = room.players.splice(idx, 1);
    room.broadcast(S2C.PLAYER_LEFT, { playerId: player.playerId }, token);
    room.pendingTrades.forEach((_, id) => room.pendingTrades.delete(id));
    if (room.players.length === 0) { rooms.delete(room.id); return; }
    room.turnOrder = room.turnOrder.filter((t) => t !== token);
    if (room.phase === 'playing' && room.turnOrder.length > 0) {
      room.turnIdx = room.turnIdx % room.turnOrder.length;
    } else if (room.phase === 'playing') {
      room.phase = 'finished';
    }
  }

  // ---------- 动作处理（核心：校验 + 权威写入）----------
  function onAction(sock, p) {
    const token = sock.token;
    if (!token) return err(sock, 'NO_AUTH');
    const s = sessions.get(token);
    if (!s || !s.roomId) return err(sock, 'NO_ROOM');
    const room = rooms.get(s.roomId);
    if (!room) return err(sock, 'ROOM_GONE');
    const player = room.players.find((pl) => pl.token === token);
    processAction(room, player, p);
  }

  function processAction(room, player, p) {
    if (!player) return;

    // START 是唯一的"waiting→playing"转换，必须在 playing 守卫之前处理
    if (p.type === ACTION.START) {
      if (room.phase !== 'waiting') return err(player.socket, 'ALREADY_STARTED');
      if (room.host !== player.token) return err(player.socket, 'NOT_HOST');
      if (room.players.length < 2) return err(player.socket, 'TOO_FEW_PLAYERS');
      startGame(room);
      return;
    }

    if (room.phase !== 'playing') return err(player.socket, 'NOT_PLAYING');
    const cur = room.currentPlayer;
    if (!cur || cur.token !== player.token) return err(player.socket, 'NOT_YOUR_TURN');
    if (!player.connected) return err(player.socket, 'DISCONNECTED');

    const seq = p.clientSeq | 0;
    if (player.lastSeq >= seq) return; // 幂等：丢弃重复/乱序
    player.lastSeq = seq;

    switch (p.type) {
      case ACTION.ROLL: {
        if (player.pendingAction) return err(player.socket, 'ALREADY_ROLLED');
        const d1 = 1 + Math.floor(Math.random() * 6);
        const d2 = 1 + Math.floor(Math.random() * 6);
        player.tile = (player.tile + d1 + d2) % room.boardSize; // 服务器唯一定序随机
        player.pendingAction = true;
        room.commit('roll', player.token, { playerId: player.playerId, dice: [d1, d2], tile: player.tile });
        break;
      }
      case ACTION.BUY: {
        if (!player.pendingAction) return err(player.socket, 'NO_PENDING_ACTION');
        if (player.cash < 100) return err(player.socket, 'NO_CASH');
        player.cash -= 100;
        player.pendingAction = false;
        room.commit('buy', player.token, { playerId: player.playerId, tile: player.tile, cash: player.cash });
        break;
      }
      case ACTION.END_TURN: {
        player.pendingAction = false;
        if (room.turnOrder.length === 0) break;
        room.turnIdx = (room.turnIdx + 1) % room.turnOrder.length;
        const next = room.turnOrder[room.turnIdx];
        room.commit('turn', next, { currentTurn: next });
        break;
      }
      case ACTION.TRADE_PROPOSE: {
        const to = room.players.find((pl) => pl.playerId === p.payload.to);
        if (!to) return err(player.socket, 'BAD_TARGET');
        const id = randomUUID().slice(0, 8);
        room.pendingTrades.set(id, { from: player.token, to: to.token, offer: p.payload.offer, ask: p.payload.ask });
        send(to.socket, S2C.EVENT, {
          serverSeq: room.serverSeq, type: 'trade_propose', by: player.token,
          payload: { id, from: player.playerId, offer: p.payload.offer, ask: p.payload.ask },
        });
        break;
      }
      case ACTION.TRADE_RESPOND: {
        const td = room.pendingTrades.get(p.payload.id);
        if (!td || td.to !== player.token) return err(player.socket, 'BAD_TRADE');
        if (p.payload.accept) {
          const from = room.players.find((pl) => pl.token === td.from);
          const offerCash = (td.offer && td.offer.cash) || 0;
          const askCash = (td.ask && td.ask.cash) || 0;
          if (from && from.cash >= offerCash && player.cash >= askCash) {
            from.cash -= offerCash; player.cash -= askCash;
            from.cash += askCash; player.cash += offerCash;
            room.commit('trade', player.token, { from: from.playerId, to: player.playerId, offer: td.offer, ask: td.ask });
          } else {
            err(player.socket, 'TRADE_INSUFFICIENT');
          }
        }
        room.pendingTrades.delete(p.payload.id);
        break;
      }
      default:
        err(player.socket, 'UNKNOWN_ACTION');
    }
  }

  function onChat(sock, p) {
    const token = sock.token;
    if (!token) return;
    const s = sessions.get(token);
    if (!s || !s.roomId) return;
    const room = rooms.get(s.roomId);
    if (!room) return;
    const text = String(p.text || '').slice(0, 200); // 限长 + 净化入口
    room.broadcast(S2C.CHAT, { from: s.playerId, name: s.name, text, t: Date.now() });
  }

  // ---------- 断线：宽限 + 自动跳过 ----------
  function onClose(sock) {
    const token = sock.token;
    if (!token || !sessions.has(token)) return;
    const s = sessions.get(token);
    if (!s.roomId) return;
    const room = rooms.get(s.roomId);
    if (!room) return;
    const player = room.players.find((pl) => pl.token === token);
    if (!player) return;
    player.connected = false;
    room.broadcast(S2C.PLAYER_LEFT, { playerId: player.playerId, connected: false }, token);

    const timer = setTimeout(() => {
      if (!room.players.find((pl) => pl.token === token)) return;
      // 房主掉线：转移给下一位在线玩家
      if (room.host === token) {
        const next = room.players.find((pl) => pl.connected);
        if (next) room.host = next.token;
      }
      if (room.phase === 'playing' && room.currentPlayer && room.currentPlayer.token === token) {
        room.turnIdx = (room.turnIdx + 1) % room.turnOrder.length;
        const next = room.turnOrder[room.turnIdx];
        room.commit('turn', next, { currentTurn: next, reason: 'timeout_skip' });
      }
    }, RECONNECT_GRACE);
    room.disconnectTimers.set(token, timer);
  }

  console.log(`[feihuaqi-mp] server listening on :${port}`);
  return wss;
}

// 直接运行则启动服务
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  startServer();
}
