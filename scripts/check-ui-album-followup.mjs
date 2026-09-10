import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createLocalServer} from './serve-playable.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const server=createLocalServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true}); const results=[];
try {for (const [width,height] of [[1440,900],[1280,720],[768,1024],[390,844],[844,390],[720,450]]) {
 const p=await browser.newPage({viewport:{width,height}}); const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('https://raw.githubusercontent.com/**/feihua-content.json',r=>r.fulfill({contentType:'application/json',body:fs.readFileSync('feihua-content.json','utf8')}));
 await p.goto(`http://127.0.0.1:${server.address().port}/`);
 await p.locator('[data-main-start]').click(); await p.locator('.school-card[data-id="bowen"]').click(); await p.getByRole('button',{name:'开始游戏',exact:true}).click(); await p.getByRole('button',{name:'就此开局',exact:true}).click(); await p.waitForFunction(()=>document.querySelector('#hud')?.textContent.includes('36'));
 await p.evaluate(async()=>{
 const {loadConfig}=await import('/js/engine/config.js'); const {Game}=await import('/js/engine/game.js'); const {Hud}=await import('/js/ui/hud.js'); const {Modals}=await import('/js/ui/modals.js');
 const cfg=await loadConfig(); const g=new Game(cfg,new Proxy({},{get:()=>()=>{}}),()=>.5);g.applyLoadout=()=>{};g.start('bowen',{tutorial:true});
 Object.assign(g.s.attrs,{shi:12,ci:9,lian:8,bi:16,xue:11,si:14});const a=g.ensureAbilityState();a.insight=6;a.strategy.chargeRemainder=4;a.manuscript.pages=3;a.manuscript.fragments=13;
 document.querySelectorAll('.screen').forEach(e=>e.remove());document.querySelector('#modalLayer').innerHTML='';
 const root=document.querySelector('#hud');root.style.display=''; const h=new Hud(root);h.render(g.s,g);h.setRollEnabled(true);document.querySelector('#attrPanel').classList.remove('collapsed');window.auditGame=g;window.auditModals=new Modals(document.querySelector('#modalLayer'),cfg);window.auditModals.game=g;
 });
 await p.waitForTimeout(400); await p.screenshot({path:`docs/ui-followup-20260910/hud-${width}.png`});
 const hud=await p.locator('#schoolProgress').evaluate(e=>({text:e.innerText,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize,children:[...e.children].map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height}))}));
 await p.locator('#abilityBtn').focus(); await p.evaluate(()=>auditModals.showAbilityPanel(auditGame));
 await p.waitForTimeout(400); await p.screenshot({path:`docs/ui-followup-20260910/ability-${width}.png`});
 assert.match(await p.locator('.strategy-progress').innerText(),/构思进度.*4\/10/s);
 const modal=await p.locator('.ability-panel').evaluate(e=>({height:e.clientHeight,scrollHeight:e.scrollHeight,closeVisible:e.querySelector('[data-close]').getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom}));
 assert.ok(modal.closeVisible);assert.ok(hud.children[0].width>60);
 await p.locator('[data-focus="ci"]').click();
 assert.equal(await p.evaluate(()=>document.activeElement.dataset.focus),'ci');
 assert.equal(await p.evaluate(()=>auditGame.s.abilityState.study.focus.includes('ci')),false);
 assert.equal(await p.evaluate(()=>auditGame.s.abilityState.study.nextFocus.includes('ci')),true);
 await p.locator('[data-section="manuscript"]').click();
 await p.screenshot({path:`docs/ui-followup-20260910/manuscript-${width}.png`});
 assert.match(await p.locator('[data-manuscript="publish"]').innerText(),/3 稿页/);
 await p.locator('[data-manuscript="publish"]').click();
 assert.match(await p.locator('.ability-notice').innerText(),/恢复 4 灵感/);
 await p.keyboard.press('Escape');await p.waitForTimeout(250);assert.equal(await p.locator('.ability-panel').count(),0);assert.equal(await p.evaluate(()=>document.activeElement.id),'abilityBtn');
 await p.evaluate(async()=>{
 const {Game}=await import('/js/engine/game.js');const g=new Game(auditGame.cfg,new Proxy({},{get:()=>()=>{}}),()=>.5);g.applyLoadout=()=>{};g.start('qishi',{tutorial:true});
 const id=[...g.cfg.talentUpgradeById].find(([id,u])=>u.upCost[0]>=5 && g.cfg.talentById.get(id)?.effect.type==='attr_flat')[0];
 const t=g.leveledTalent(g.cfg.talentById.get(id),1);g.s.passive=[t];g.s.active=[];g.s.talentLevels[id]=1;g.s.inspiration=g.talentUpgradeQuote(id).cost;
 window.upgradeGame=g;window.upgradeId=id;auditModals.game=g;auditModals.showTalentDetail(t);
 });
 assert.equal(await p.locator('[data-up]').isDisabled(),false);
 await p.waitForTimeout(500); await p.screenshot({path:`docs/ui-followup-20260910/talent-${width}.png`});
 await p.locator('[data-up]').click();assert.equal(await p.evaluate(()=>upgradeGame.s.talentLevels[upgradeId]),2);assert.equal(await p.evaluate(()=>upgradeGame.s.inspiration),0);
 await p.keyboard.press('Escape');await p.waitForTimeout(250);assert.equal(await p.locator('.talent-detail').count(),0);assert.deepEqual(errors,[]);
 if(width===390 || width===1440) {
 await p.evaluate(async()=>{
 const {BattleStage}=await import('/js/ui/battle.js');const el=document.querySelector('#battleStage');el.classList.add('on');el.innerHTML='<div class="bt-panel"></div>';
 const stage=new BattleStage(el,auditGame.cfg);stage.startTimer=()=>()=>{};
 const session=auditGame.createSession({npc:{id:'ui-test',name:'验算者',attrs:{shi:8,ci:8,lian:8,bi:8,xue:8,si:8}},label:'UI验收',theme:'yongwu'});
 window.diceSession=session;window.diceDone=false;stage.rollDice(el.querySelector('.bt-panel'),session,'shi').then(()=>window.diceDone=true);
 });
 await p.locator('#btRoll').click();await p.waitForSelector('#btConfirm');
 const before=await p.evaluate(()=>diceSession.inspiration);const fee=await p.locator('#btExtra').innerText();assert.match(fee,/消耗/);
 await p.screenshot({path:`docs/ui-followup-20260910/dice-${width}.png`});
 await p.locator('#btExtra').click();assert.ok(await p.evaluate(()=>diceSession.inspiration)<before);
 await p.locator('#btConfirm').click();assert.equal(await p.evaluate(()=>diceDone),true);assert.deepEqual(errors,[]);
 }
 if(width===390 || width===1440) {
 await p.evaluate(async()=>{
 document.querySelector('#battleStage').classList.remove('on');
 const {AlbumUI}=await import('/js/ui/album.js');const Album=await import('/js/engine/album.js');
 const store=Album.emptyStore();store.unlocked=auditGame.cfg.album.map(c=>c.id);store.progress.A001={...Album.emptyAlbumProgress(),xp:3};Album.saveStore(store);
 window.auditAlbum=new AlbumUI({loadoutEl:document.querySelector('#loadout-screen'),albumEl:document.querySelector('#album-screen'),layerEl:document.querySelector('#modalLayer'),cards:auditGame.cfg.album.slice(0,2)});
 auditAlbum.openLoadout({schoolName:'博闻'});
 });
 const card=p.locator('#loadout-screen .album-card[data-id="A001"]');
 assert.match(await card.innerText(),/作品加成 \+3%/);assert.match(await card.innerText(),/需 Lv3/);
 await card.locator('.ac-growth-help summary').click();assert.equal(await p.evaluate(()=>auditAlbum.selected.length),0);
 await p.screenshot({path:`docs/ui-followup-20260910/album-${width}.png`});
 await card.locator('.ac-effects').first().scrollIntoViewIfNeeded();await p.screenshot({path:`docs/ui-followup-20260910/branches-${width}.png`});
 assert.ok(await card.evaluate(e=>e.getBoundingClientRect().width)>280);
 p.once('dialog',d=>d.dismiss());await card.locator('[data-branch="bold"]').click();assert.equal(await p.evaluate(async()=>{const a=await import('/js/engine/album.js');return a.loadStore().progress.A001.branchLocked;}),false);
 p.once('dialog',d=>d.accept());await card.locator('[data-branch="bold"]').click();assert.equal(await card.locator('[data-branch="swift"]').isDisabled(),true);assert.match(await card.innerText(),/未选路线，不生效/);
 await p.evaluate(()=>{auditAlbum.closeLoadout();auditAlbum.openAlbum({});});assert.equal(await p.locator('#album-screen [data-branch]:not(:disabled)').count(),0);assert.deepEqual(errors,[]);
 }
 results.push({width,height,hud,modal});await p.close();
}fs.writeFileSync('docs/ui-followup-20260910/measurements.json',JSON.stringify({baseline:'Follow-up to e18230e: strategy progress and album explanations',mode:'Local production components with simulated midgame state; cloud JSON served from checkout',results},null,2));console.log(JSON.stringify(results));}
finally {await browser.close();await new Promise(r=>server.close(r));}
