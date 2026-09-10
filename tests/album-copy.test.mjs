import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {albumEffectSummary,albumBaseReward,AlbumUI} from '../js/ui/album.js';
import {normalizeConfig} from '../js/engine/config.js';
import * as Album from '../js/engine/album.js';
const cfg=normalizeConfig(JSON.parse(fs.readFileSync('feihua-content.json','utf8')));
test('all album effects describe normalized amounts and timing',()=>{
 for(const c of cfg.album) {assert.ok(albumBaseReward(c));for(const b of c.branches)for(const e of b.effects){const text=albumEffectSummary(e);assert.doesNotMatch(text,/undefined|NaN/);assert.match(text,/：/);}}
 const e=cfg.album[0].branches[0].effects.find(e=>e.type==='pct');assert.match(albumEffectSummary(e),/\+3%/);
 assert.match(albumEffectSummary({trigger:'battle',result:'draw',type:'strategy',value:1}),/平局：构思 \+1/);
});
test('card explains permanent choice, level gates and inactive locked alternative',()=>{
 const ui=new AlbumUI({cards:cfg.album,topEl:{}});const store=Album.emptyStore();const c=cfg.album[0];store.unlocked=[c.id];store.progress[c.id]={...Album.emptyAlbumProgress(),branch:c.branches[0].id,branchLocked:true};
 const html=ui._cardHtml(c,store,{pick:false});assert.match(html,/跨局锁定/);assert.match(html,/需 Lv2/);assert.match(html,/未选路线，不生效/);assert.match(html,/升级效果在下局携带时生效/);
});
