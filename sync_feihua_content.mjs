// 飞花棋·内容同步脚本（E3 强度档落地后统一刷新）
// 1) 从 feihuaqi-playable/config/ 重新生成 feihua-content.json（_version 递增，防云端覆盖回旧值）
// 2) 从游戏配置重新生成编辑器 NPC / 文心 / 升级 / 羁绊种子
import { readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';
const root=dirname(fileURLToPath(import.meta.url)).replace(/\\/g, '/');
const cfg=root+'/feihuaqi-playable/config/';
const read=n=>JSON.parse(readFileSync(cfg+n+'.json','utf8'));
const talentOnly=process.argv.includes('--talents');

// ---- 1) feihua-content.json ----
const contentPath=root+'/feihua-content.json';
let prevVersion=1;
let previous={};
try { previous=JSON.parse(readFileSync(contentPath,'utf8')); prevVersion=Number(previous._version)||1; } catch {}
const talentData={ talents:read('talents'), 'talent-upgrade':read('talent-upgrade'), synergies:read('synergies') };
const data=talentOnly ? { ...previous, _type:'feihua-content', _version:prevVersion+1, ...talentData } : {
  _type:'feihua-content', _version:prevVersion+1,
  questions:read('questions'), events:read('events'), ...talentData,
  npcs:read('npcs'), affinity:read('affinity'), board:read('board')
};
writeFileSync(contentPath,JSON.stringify(data,null,2)+'\n','utf8');

// ---- 2) seed-npcs.js ----
const npcSeedHeader='/* 飞花棋游戏原始 NPC（config/npcs.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n';
const seedNpcs=`${npcSeedHeader}window.GAME_NPCS = ${JSON.stringify(data.npcs,null,2)};\n`;
const seedPath=root+'/feihua-editors/assets/js/seed-npcs.js';
if (!talentOnly) writeFileSync(seedPath,seedNpcs,'utf8');

const talentSeedHeader='/* 文心棋游戏原始文心（config/talents.json）。作为编辑器默认种子数据。由游戏配置同步生成，请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n';
writeFileSync(root+'/feihua-editors/assets/js/seed-talents.js', `${talentSeedHeader}window.GAME_TALENTS = ${JSON.stringify(data.talents,null,2)};\n`, 'utf8');
writeFileSync(root+'/feihua-editors/assets/js/seed-talent-upgrade.js', `/* 游戏 config/talent-upgrade.json 的编辑器种子，由配置同步生成。 */\nwindow.GAME_TALENT_UPGRADE = ${JSON.stringify(data['talent-upgrade'],null,2)};\n`, 'utf8');
writeFileSync(root+'/feihua-editors/assets/js/seed-synergies.js', `/* 游戏原始羁绊数据（作为编辑器默认种子；与 config/synergies.json 保持一致）。 */\nwindow.GAME_SYNERGIES = ${JSON.stringify(data.synergies,null,2)};\n`, 'utf8');

// ---- 报告 ----
function budget(t){ return t.npcs&&t.npcs.length ? (t.npcs.reduce((s,n)=>s+Object.values(n.attrs||{}).reduce((a,b)=>a+Number(b||0),0),0)/t.npcs.length) : 0; }
console.log(JSON.stringify({
  contentVersion:data._version,
  mode:talentOnly?'talents':'all',
  contentTiers:(data.npcs||[]).map(t=>`${t.id}:${budget(t)}`),
  gradesVersion:(read('grades')).version,
  seedNpcsLines:seedNpcs.split('\n').length,
  talentCount:data.talents.length,
  talentUpgradeCount:Object.keys(data['talent-upgrade']).length,
  synergyCount:data.synergies.length
},null,2));
