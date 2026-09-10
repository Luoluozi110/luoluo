import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Game} from '../js/engine/game.js';
import {normalizeConfig} from '../js/engine/config.js';
import {Reincarnate} from '../js/engine/reincarnate.js';
function game(school='bowen') { Reincarnate.reset(); const cfg=normalizeConfig(JSON.parse(fs.readFileSync('feihua-content.json','utf8')));const g=new Game(cfg,new Proxy({},{get:()=>()=>{}}),()=>.5);g.applyLoadout=()=>{};g.start(school,{tutorial:true});g.s.attrs.bi=32;return g; }
test('discounted upgrade quote and execution agree at exact and insufficient balances',()=>{
 const g=game('qishi');const t=g.leveledTalent(g.cfg.talentById.get([...g.cfg.talentUpgradeById].find(([id,u])=>u.upCost[0]>=5 && g.cfg.talentById.get(id)?.effect.type==='attr_flat')[0]),1);g.s.passive=[t];g.s.active=[];g.s.talentLevels[t.id]=1;
 const q=g.talentUpgradeQuote(t.id);assert.ok(q.cost<q.baseCost);g.s.inspiration=q.cost-1;assert.equal(g.upgradeTalent(t.id).ok,false);assert.equal(g.s.talentLevels[t.id],1);
 g.s.inspiration=q.cost;const r=g.upgradeTalent(t.id);assert.equal(r.ok,true);assert.equal(r.cost,q.cost);assert.equal(g.s.inspiration,0);
});
test('manuscript validates exact costs, first polish discount, repeat cost and invalid action',()=>{
 const g=game('cizong_bi'),a=g.ensureAbilityState();a.manuscript.pages=6;
 const q=g.manuscriptQuote('polish');assert.equal(q.cost,1);assert.equal(g.spendManuscript('polish').cost,1);assert.equal(g.manuscriptQuote('polish').cost,2);
 a.manuscript.pages=1;assert.equal(g.spendManuscript('polish').ok,false);assert.equal(a.manuscript.pages,1);
 assert.equal(g.spendManuscript('invalid').ok,false);assert.equal(a.manuscript.pages,1);
});
test('publishing refuses zero benefit and reports actual capped recovery',()=>{
 const g=game(),a=g.ensureAbilityState();a.manuscript.pages=3;g.s.inspiration=g.s.inspirationMax;
 assert.equal(g.spendManuscript('publish').ok,false);assert.equal(a.manuscript.pages,3);
 g.s.inspiration-=2;assert.equal(g.manuscriptQuote('publish').recovery,2);const r=g.spendManuscript('publish');assert.equal(r.recovered,2);assert.equal(a.manuscript.pages,0);
});
test('volume returns receipt and honors cap; manuscript threshold follows attrs',()=>{
 const g=game(),a=g.ensureAbilityState();g.s.attrs.bi=32;a.manuscript.pages=5;
 const r=g.spendManuscript('volume');assert.equal(r.cost,5);assert.equal(r.refunded,1);assert.equal(a.manuscript.pages,1);
 a.manuscript.volumes=2;a.manuscript.pages=5;assert.equal(g.spendManuscript('volume').ok,false);assert.equal(a.manuscript.pages,5);
 assert.equal(g.manuscriptProgressNeed({bi:15}),40);assert.equal(g.manuscriptProgressNeed({bi:16}),20);
});

test('publishing preview includes qishi carry without consuming it',()=>{
 const g=game('qishi'),a=g.ensureAbilityState();a.manuscript.pages=3;g.s.inspiration=20;g.s.schoolState.inspirationAccumulator=9000;
 const quote=g.manuscriptQuote('publish');assert.equal(quote.recovery,5);assert.equal(g.s.schoolState.inspirationAccumulator,9000);
 const result=g.spendManuscript('publish');assert.equal(result.recovered,quote.recovery);assert.equal(g.s.inspiration,25);
});
