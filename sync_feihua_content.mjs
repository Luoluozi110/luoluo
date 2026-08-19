// 飞花棋·内容同步脚本（E3 强度档落地后统一刷新）
// 1) 从 feihuaqi-playable/config/ 重新生成 feihua-content.json（_version 递增，防云端覆盖回旧值）
// 2) 从 config/npcs.json 重新生成 feihua-editors/assets/js/seed-npcs.js（编辑器默认种子）
import { readFileSync, writeFileSync } from 'fs';
const root='C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';
const cfg=root+'/feihuaqi-playable/config/';
const read=n=>JSON.parse(readFileSync(cfg+n+'.json','utf8'));

// ---- 1) feihua-content.json ----
const contentPath=root+'/feihua-content.json';
let prevVersion=1;
try { const p=JSON.parse(readFileSync(contentPath,'utf8')); prevVersion=Number(p._version)||1; } catch {}
const data={
  _type:'feihua-content', _version:prevVersion+1,
  questions:read('questions'), events:read('events'), talents:read('talents'),
  'talent-upgrade':read('talent-upgrade'),
  npcs:read('npcs'), affinity:read('affinity'), synergies:read('synergies'), board:read('board')
};
writeFileSync(contentPath,JSON.stringify(data,null,2)+'\n','utf8');

// ---- 2) seed-npcs.js ----
const npcSeedHeader='/* 飞花棋游戏原始 NPC（config/npcs.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n';
const seedNpcs=`${npcSeedHeader}window.GAME_NPCS = ${JSON.stringify(data.npcs,null,2)};\n`;
const seedPath=root+'/feihua-editors/assets/js/seed-npcs.js';
writeFileSync(seedPath,seedNpcs,'utf8');

// ---- 报告 ----
function budget(t){ return t.npcs&&t.npcs.length ? (t.npcs.reduce((s,n)=>s+Object.values(n.attrs||{}).reduce((a,b)=>a+Number(b||0),0),0)/t.npcs.length) : 0; }
console.log(JSON.stringify({
  contentVersion:data._version,
  contentTiers:data.npcs.map(t=>`${t.id}:${budget(t)}`),
  gradesVersion:(read('grades')).version,
  seedNpcsLines:seedNpcs.split('\n').length
},null,2));
