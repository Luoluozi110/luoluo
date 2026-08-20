import { readFileSync, writeFileSync } from 'fs';
const root='C:/Users/77522/WorkBuddy/2026-08-01-00-57-25';
const cfg=root+'/feihuaqi-playable/config/';
const read=n=>JSON.parse(readFileSync(cfg+n+'.json','utf8'));
const data={
  _type:'feihua-content', _version:1,
  questions:read('questions'), events:read('events'), talents:read('talents'),
  'talent-upgrade':read('talent-upgrade'),
  npcs:read('npcs'), affinity:read('affinity'), synergies:read('synergies'), board:read('board'), album:read('album')
};
const out=root+'/feihua-content.json';
writeFileSync(out,JSON.stringify(data,null,2)+'\n','utf8');
console.log(JSON.stringify({out,questions:data.questions.length,events:data.events.length,talents:data.talents.length,npcTiers:data.npcs.length,synergies:data.synergies.length,boardCells:data.board.mainRing.length},null,2));
