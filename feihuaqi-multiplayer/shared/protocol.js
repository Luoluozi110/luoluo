// 共享协议：消息类型常量 + 编解码辅助
// 客户端与服务器共用，保证字段一致。

export const C2S = {
  HELLO: 'hello',
  ROOM_CREATE: 'room_create',
  ROOM_JOIN: 'room_join',
  ROOM_QUICKMATCH: 'room_quickmatch',
  ROOM_LEAVE: 'room_leave',
  ACTION: 'action',
  CHAT: 'chat',
  PING: 'ping',
};

export const S2C = {
  WELCOME: 'welcome',
  ROOM_LIST: 'room_list',
  ROOM_STATE: 'room_state',
  EVENT: 'event',
  CHAT: 'chat',
  ERROR: 'error',
  PONG: 'pong',
  PLAYER_JOINED: 'player_joined',
  PLAYER_LEFT: 'player_left',
};

export const ACTION = {
  START: 'start',
  ROLL: 'roll',
  BUY: 'buy',
  BUILD: 'build',
  END_TURN: 'end_turn',
  TRADE_PROPOSE: 'trade_propose',
  TRADE_RESPOND: 'trade_respond',
  USE_CARD: 'use_card',
};

export function makeMsg(type, payload = {}) {
  return JSON.stringify({ t: type, p: payload });
}

export function parseMsg(raw) {
  try {
    const o = JSON.parse(raw);
    return { type: o.t, payload: o.p || {} };
  } catch {
    return null;
  }
}
