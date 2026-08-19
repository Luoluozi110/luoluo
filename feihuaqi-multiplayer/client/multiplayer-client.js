// 飞花棋多人交互 —— 浏览器端客户端（ES 模块）
// 职责：连接、鉴权、token 持久化、断线指数退避重连、发送动作/聊天、事件订阅
// 纪律：点击只发"意图"(sendAction)，渲染完全由服务器事件驱动

import { C2S, S2C, ACTION, makeMsg, parseMsg } from '../shared/protocol.js';

export class MultiplayerClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.token = (typeof localStorage !== 'undefined' && localStorage.getItem('fhq_token')) || null;
    this.playerId = null;
    this.name = null;
    this.clientSeq = 0;
    this.handlers = {};
    this._reconnect = null;
  }

  on(type, cb) {
    (this.handlers[type] ||= []).push(cb);
    return this;
  }
  emit(type, data) {
    (this.handlers[type] || []).forEach((cb) => { try { cb(data); } catch (e) { console.error(e); } });
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => { this.emit('open'); this._hello(); };
    this.ws.onmessage = (e) => {
      const m = parseMsg(e.data);
      if (!m) return;
      if (m.type === S2C.WELCOME) {
        this.token = m.payload.token;
        this.playerId = m.payload.playerId;
        if (typeof localStorage !== 'undefined') localStorage.setItem('fhq_token', this.token);
        this.emit('welcome', m.payload);
      } else {
        this.emit(m.type, m.payload);
      }
    };
    this.ws.onclose = () => { this.emit('close'); this._scheduleReconnect(); };
    this.ws.onerror = () => this.emit('error');
  }

  _hello() { this.send(C2S.HELLO, { token: this.token, name: this.name }); }
  send(type, payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(makeMsg(type, payload));
  }

  createRoom(opts = {}) { this.send(C2S.ROOM_CREATE, opts); }
  joinRoom(roomId, password = '') { this.send(C2S.ROOM_JOIN, { roomId, password }); }
  quickMatch() { this.send(C2S.ROOM_QUICKMATCH, {}); }
  leaveRoom() { this.send(C2S.ROOM_LEAVE, {}); }
  sendChat(text) { this.send(C2S.CHAT, { text }); }

  // 所有游戏内动作统一入口：自动带递增 clientSeq（幂等/防重）
  sendAction(type, payload = {}) {
    this.clientSeq += 1;
    this.send(C2S.ACTION, { type, payload, clientSeq: this.clientSeq });
  }

  _scheduleReconnect() {
    if (this._reconnect) return;
    const backoff = 1500; // 简单固定退避（可改为指数退避）
    this._reconnect = setTimeout(() => { this._reconnect = null; this.connect(); }, backoff);
  }
}

export { ACTION };
