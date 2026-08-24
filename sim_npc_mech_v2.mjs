/** NPC 三机制 v2：逐潮 / 封心 / 审律 / 公开战策的纯规则回归。 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as R from './feihuaqi-playable/js/engine/rules.js';
import { intentHint, weaknessHint } from './feihuaqi-playable/js/ui/mechHints.js';

const load = path => JSON.parse(readFileSync(path, 'utf8'));
const npcs = load('./feihuaqi-playable/config/npcs.json');
const mech = load('./feihuaqi-playable/config/npc-mechanics.json');
const templates = {
  signatureTemplates: mech.signatureTemplates,
  weaknessTemplates: mech.weaknessTemplates,
  intentTemplates: mech.intentTemplates
};
const af = {
  manners: ['wanyue', 'haofang', 'zheli', 'qingya', 'chenyu', 'qili'],
  matrix: { 'haofang.yongwu': 0.1, 'zheli.yongwu': 0.04, 'qingya.yongwu': -0.03 }
};
const find = id => {
  for (const tier of npcs) {
    const npc = (tier.npcs || []).find(n => n.id === id);
    if (npc) return npc;
  }
  throw new Error(`missing NPC: ${id}`);
};
const tri = (npc, extra = {}) => R.signatureTriggered({ mech: npc.mech, templates, ...extra });
const wea = (npc, extra = {}) => R.weaknessResolution({ mech: npc.mech, templates, ...extra });

// 逐潮：公开跟随风潮，仍应允许玩家以相得的逆潮文风反制。
const shen = find('shen_sui_feng');
const zeitgeist = { manner: 'haofang' };
const shenIntent = R.rollIntention({ mech: shen.mech, npcAttrs: shen.attrs, af, theme: 'yongwu', zeitgeist, templates });
assert.equal(shenIntent.manner, 'haofang');
assert.equal(shenIntent.template, 'int_zeitgeist');
const shenTri = tri(shen, { npcManner: 'haofang', zeitgeist, playerMove: { manner: 'zheli' } });
assert.equal(shenTri.level, 'main');
const shenWea = wea(shen, { zeitgeist, playerMove: { manner: 'zheli', playerAffinity: 0.04 } });
assert.equal(shenWea.hit, true);
assert.equal(shenWea.retention, 0.2);
assert.ok(R.signatureScoreMods(shenTri, shenWea, shen.mech.signature).pct.some(m => m.value === 0.016));
assert.ok(intentHint(shen, shenIntent, { styleNames: R.STYLE_NAMES, mannerNames: { haofang: '豪放' } })
  .some(h => h.body.includes('豪放')));

// 封心：主动文心会触发对手追击；藏锋不用则不让该招牌得分。
const cui = find('cui_wu_jiu');
assert.equal(tri(cui, { playerMove: { activeTalentUsed: true } }).level, 'main');
assert.equal(wea(cui, { playerMove: { activeTalentUsed: false } }).retention, 0.25);
assert.equal(wea(cui, { playerMove: { activeTalentUsed: true } }).hit, false);

// 审律：重复骰面被抓住；最多一枚追加骰是可读、可执行的规避路线。
const xie = find('xie_lian_cheng');
assert.equal(tri(xie, { playerMove: { dicePips: [4, 4] } }).level, 'main');
assert.equal(tri(xie, { playerMove: { dicePips: [2, 5] } }).level, null);
assert.equal(wea(xie, { playerMove: { extraDice: 1 } }).retention, 0.25);
assert.equal(wea(xie, { playerMove: { extraDice: 2 } }).hit, false);

// 公开战策：战策在定策前可见，且配置的精确应对会削弱其招牌。
const gu = find('gu_qing_shang');
const guIntent = R.rollIntention({ mech: gu.mech, npcAttrs: gu.attrs, af, theme: 'yongwu', templates });
assert.equal(guIntent.stance, 'steady');
assert.equal(tri(gu, { intentStance: guIntent.stance, playerMove: { extraDice: 1 } }).level, 'main');
const guWea = wea(gu, { intentStance: guIntent.stance, playerMove: { extraDice: 1 }, playerHistory: {} });
assert.equal(guWea.hit, true);
assert.equal(guWea.retention, 0.2);
assert.equal(guWea.playerBonus, 0.04);
assert.match(weaknessHint(gu.mech, { styleNames: R.STYLE_NAMES, mannerNames: {} }) || '', /一枚灵感骰/);

console.log('NPC 三机制 v2：逐潮 / 封心 / 审律 / 公开战策 ✓');
