import * as R from './feihuaqi-playable/js/engine/rules.js';
import fs from 'node:fs';

const D = 'feihuaqi-playable/config/';
const base = {};
for (const n of ['npcs','npc-mechanics']) base[n] = JSON.parse(fs.readFileSync(D + n + '.json', 'utf8'));
const lib = base['npc-mechanics'];
const weaLib = lib.weaknessTemplates || {};

console.log('NPC 硬实力对等镜象下，「抓破绽」机会成本 vs 招牌收益:');
console.log('tier     npc       最高文体    次高文体    放弃代价   招牌等效   retention  破绽收益   能赚?');
for (const t of base.npcs) for (const n of (t.npcs || [])) if (n.mech) {
  const a = n.attrs || { shi: 10, ci: 10, lian: 10, bi: 10, xue: 10, si: 10 };
  const scores = ['shi', 'ci', 'lian'].map(s => ({ s, v: R.expectedScore(a, s) }));
  scores.sort((x, y) => y.v - x.v);
  const best = scores[0], second = scores[1];
  const giveUpCost = best.v - second.v;
  const sig = n.mech.signature && (n.mech.signature.main || n.mech.signature);
  let est = 0;
  if (sig) {
    if (['sig_style_mastery', 'sig_repeat_read', 'sig_copycat'].includes(sig.template)) est = best.v * (Number(sig.pct) || 0);
    else if (sig.template === 'sig_steady_pressure') est = sig.floorPct != null ? best.v * (Number(sig.floorPct) || 0) : (Number(sig.floor) || 0);
  }
  const wea = n.mech.weakness;
  let ret = 1;
  if (wea) { ret = Number(wea.retention); if (isNaN(ret)) ret = 1; ret = Math.max(0, Math.min(1, ret)); }
  const wbenefit = est * (1 - ret);
  const profit = wbenefit - giveUpCost;
  const tier = (t.tier || '').padEnd(9);
  const name = (n.name || '').padEnd(9);
  console.log(`${tier} ${name} ${best.v.toFixed(0).padStart(6)}   ${second.v.toFixed(0).padStart(6)}   ${giveUpCost.toFixed(0).padStart(7)}   ${est.toFixed(0).padStart(6)}   ${ret.toFixed(2).padStart(5)}   ${wbenefit.toFixed(0).padStart(7)}  ${profit >= 0 ? 'V' : 'X'}`);
}
