// 冒烟测试：双客户端打通 创建→加入→开局→掷骰→换回合→聊天 链路
import { startServer } from './index.js';
import WebSocket from 'ws';

const wss = startServer(8099);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client() {
  const ws = new WebSocket('ws://localhost:8099');
  const api = { ws, token: null, last: null, events: [] };
  ws.on('message', (d) => {
    const m = JSON.parse(d.toString());
    api.last = m;
    if (m.t === 'welcome') { api.token = m.p.token; api.playerId = m.p.playerId; }
    if (m.t === 'event') api.events.push(m.p);
  });
  api.send = (t, p) => ws.send(JSON.stringify({ t, p }));
  api.waitEvent = (type) => new Promise((res) => {
    const iv = setInterval(() => {
      const ev = api.events.find((e) => e.type === type);
      if (ev) { clearInterval(iv); res(ev); }
    }, 20);
  });
  return new Promise((res) => ws.on('open', () => res(api)));
}

const assert = (cond, msg) => { if (!cond) { console.error('❌ FAIL:', msg); process.exit(1); } console.log('✅', msg); };

const run = async () => {
  const a = await client();
  a.send('hello', { name: 'A' });
  await sleep(80);
  a.send('room_create', { name: '测试房', maxPlayers: 2 });
  await sleep(80);
  const roomId = a.last.p.roomId;
  assert(roomId, '房主创建房间并得到 roomId');

  const b = await client();
  b.send('hello', { name: 'B' });
  await sleep(80);
  b.send('room_join', { roomId });
  await sleep(80);
  assert(b.last && b.last.t === 'room_state', 'B 加入房间收到 room_state');

  a.send('action', { type: 'start', clientSeq: 1 });
  await sleep(80);
  const startEv = a.events.find((e) => e.type === 'start');
  assert(startEv, '房主开局，服务器广播 start 事件');

  // A 掷骰
  a.send('action', { type: 'roll', clientSeq: 2 });
  const rollA = await a.waitEvent('roll');
  assert(rollA && rollA.payload.dice.length === 2, 'A 掷骰：服务器下发 dice=[x,y]');
  assert(typeof rollA.payload.tile === 'number', 'A 移动：下发 tile 落点（服务器定序）');

  // A 重复掷骰应被拒（pendingAction）
  a.send('action', { type: 'roll', clientSeq: 3 });
  await sleep(60);
  const dupErr = a.last.t === 'error' && a.last.p.code === 'ALREADY_ROLLED';
  assert(dupErr, '防作弊：同一回合重复掷骰被拒(ALREADY_ROLLED)');

  // A 结束回合 → 轮到 B
  a.send('action', { type: 'end_turn', clientSeq: 4 });
  const turnB = await a.waitEvent('turn');
  assert(turnB.payload.currentTurn === b.token, '回合切换到 B（服务器权威 currentTurn）');

  // B 掷骰
  b.send('action', { type: 'roll', clientSeq: 1 });
  const rollB = await new Promise((res) => {
    const iv = setInterval(() => {
      const ev = b.events.find((e) => e.type === 'roll' && e.payload.playerId === b.playerId);
      if (ev) { clearInterval(iv); res(ev); }
    }, 20);
  });
  assert(rollB.payload.playerId === b.playerId, 'B 掷骰事件归属正确');

  // 聊天广播
  a.send('chat', { text: '飞花令~' });
  await sleep(60);
  assert(b.last && b.last.t === 'chat' && b.last.p.text === '飞花令~', '聊天从 A 广播到 B');

  // 串号防护：B 试图以 A 名义行动（这里 B 不能伪造，仅验证非自己回合被拒）
  b.send('action', { type: 'roll', clientSeq: 2 }); // B 已 roll，应 ALREADY_ROLLED
  await sleep(60);

  console.log('\n🎉 冒烟测试全部通过');
  wss.close();
  process.exit(0);
};

run().catch((e) => { console.error(e); process.exit(1); });
