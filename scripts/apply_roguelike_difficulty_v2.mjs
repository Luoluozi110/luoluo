#!/usr/bin/env node
// Roguelike 难度第二版：分档提高全部 NPC 六维，并对思力追加增强。
// 带版本标记，重复执行不会叠加数值。
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('feihuaqi-playable/config/npcs.json');
const tiers = JSON.parse(fs.readFileSync(file, 'utf8'));
const buffs = {
  '童生级': { all: 1, siExtra: 1 },
  '秀才级': { all: 2, siExtra: 1 },
  '举人级': { all: 3, siExtra: 2 },
  '进士级': { all: 4, siExtra: 2 },
  '主考官': { all: 5, siExtra: 3 }
};
const attrs = ['shi', 'ci', 'lian', 'bi', 'xue', 'si'];

let changed = 0;
for (const tier of tiers) {
  const buff = buffs[tier.tier];
  if (!buff) throw new Error(`未配置难度增幅：${tier.tier}`);
  if (Number(tier.balanceVersion) >= 2) continue;
  for (const npc of tier.npcs || []) {
    for (const key of attrs) npc.attrs[key] = (Number(npc.attrs[key]) || 0) + buff.all;
    npc.attrs.si += buff.siExtra;
    changed++;
  }
  tier.balanceVersion = 2;
  tier.difficultyBoost = { allAttrs: buff.all, wisdomExtra: buff.siExtra };
}

fs.writeFileSync(file, `${JSON.stringify(tiers, null, 2)}\n`, 'utf8');
console.log(`Roguelike 难度 v2：更新 ${changed} 名 NPC；${changed ? '已写入' : '已是最新版本'}`);
