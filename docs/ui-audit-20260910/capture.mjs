import fs from 'node:fs';
import {createLocalServer} from '../../scripts/serve-playable.mjs';
import {chromium} from 'file:///C:/Users/77522/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const server=createLocalServer(); await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({channel:'msedge',headless:true}); const results=[];
try {for (const [width,height] of [[1440,900],[1280,720],[768,1024],[390,844]]) {
 const p=await browser.newPage({viewport:{width,height}});
 await p.route('https://raw.githubusercontent.com/**/feihua-content.json',r=>r.fulfill({contentType:'application/json',body:fs.readFileSync('feihua-content.json','utf8')}));
 await p.goto(`http://127.0.0.1:${server.address().port}/`);
 await p.locator('[data-main-start]').click(); await p.locator('.school-card[data-id="bowen"]').click(); await p.getByRole('button',{name:'开始游戏',exact:true}).click(); await p.getByRole('button',{name:'就此开局',exact:true}).click(); await p.waitForFunction(()=>document.querySelector('#hud')?.textContent.includes('36'));
 await p.evaluate(async()=>{
 const {loadConfig}=await import('/js/engine/config.js'); const {Game}=await import('/js/engine/game.js'); const {Hud}=await import('/js/ui/hud.js'); const {Modals}=await import('/js/ui/modals.js');
 const cfg=await loadConfig(); const g=new Game(cfg,new Proxy({},{get:()=>()=>{}}),()=>.5);g.applyLoadout=()=>{};g.start('bowen',{tutorial:true});
 Object.assign(g.s.attrs,{shi:12,ci:9,lian:8,bi:16,xue:11,si:14});const a=g.ensureAbilityState();a.insight=6;a.manuscript.pages=3;a.manuscript.fragments=13;
 document.querySelectorAll('.screen').forEach(e=>e.remove());document.querySelector('#modalLayer').innerHTML='';
 const root=document.querySelector('#hud');root.style.display=''; const h=new Hud(root);h.render(g.s,g);document.querySelector('#attrPanel').classList.remove('collapsed');window.auditGame=g;window.auditModals=new Modals(document.querySelector('#modalLayer'),cfg);window.auditModals.game=g;
 });
 await p.waitForTimeout(400); await p.screenshot({path:`docs/ui-audit-20260910/hud-${width}.png`});
 const hud=await p.locator('#schoolProgress').evaluate(e=>({text:e.innerText,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize,children:[...e.children].map(x=>({width:x.getBoundingClientRect().width,height:x.getBoundingClientRect().height}))}));
 await p.evaluate(()=>auditModals.showAbilityPanel(auditGame));
 await p.waitForTimeout(400); await p.screenshot({path:`docs/ui-audit-20260910/ability-${width}.png`});
 const modal=await p.locator('.ability-panel').evaluate(e=>({height:e.clientHeight,scrollHeight:e.scrollHeight,closeVisible:e.querySelector('[data-close]').getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom}));
 results.push({width,height,hud,modal});await p.close();
}fs.writeFileSync('docs/ui-audit-20260910/measurements.json',JSON.stringify({baseline:'309547e1b3fc88561656087d7a0d0c82062b0089',mode:'Local production components with simulated midgame state; cloud JSON served from checkout',results},null,2));console.log(JSON.stringify(results));}
finally {await browser.close();await new Promise(r=>server.close(r));}


