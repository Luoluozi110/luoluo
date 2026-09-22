import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium } from 'file:///C:/Users/77522/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out = new URL('./', import.meta.url);
const browser = await chromium.launch({channel:'msedge', headless:true});
const results = [];
try {
  for (const [width,height] of [[1440,900],[768,1024],[390,844],[320,740],[844,390]]) {
    const page = await browser.newPage({viewport:{width,height}, hasTouch:width<=600});
    const errors = [];
    page.on('pageerror', e=>errors.push(e.message));
    await page.route('https://raw.githubusercontent.com/**/feihua-content.json', r=>r.fulfill({contentType:'application/json',body:fs.readFileSync('feihua-content.json','utf8')}));
    await page.addInitScript(()=>localStorage.setItem('feihua_panel_collapsed',JSON.stringify({attr:false,talent:false,insp:false})));
    await page.goto('http://127.0.0.1:8094/');
    await page.locator('[data-main-start]').waitFor();
    // Exercise the real components using local production config, without tutorial overlays.
    await page.evaluate(async()=>{
      const {loadConfig}=await import('/js/engine/config.js');
      const {Game}=await import('/js/engine/game.js');
      const {Hud}=await import('/js/ui/hud.js');
      const {BoardView}=await import('/js/ui/board.js');
      const cfg=await loadConfig();
      const g=new Game(cfg,new Proxy({},{get:()=>()=>{}}),()=>.5);
      g.applyLoadout=()=>{}; g.start('bowen',{tutorial:true});
      document.querySelectorAll('.screen').forEach(e=>e.remove());
      document.querySelector('#schoolScreen').style.display='none';
      document.querySelector('#modalLayer').innerHTML='';
      const root=document.querySelector('#hud'); root.style.display='';
      window.qaHud=new Hud(root);qaHud.render(g.s,g);
      window.qaBoard=new BoardView(cfg,document.querySelector('#scene'));
      window.qaGame=g;
    });
    await page.waitForTimeout(700);
    if(width===1440) {
      await page.evaluate(()=>{document.documentElement.dataset.quality='high';qaBoard.applyQuality();qaBoard.movePiece({routeIndex:1});});
      assert.equal(await page.locator('.board-ink-trace').count(),1);
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.board-ink-trace').count(),0);
      await page.evaluate(()=>qaBoard.highlight({routeIndex:1}));
      assert.equal(await page.locator('.board-landing-ripple').count(),1);
      await page.waitForTimeout(600);
      assert.equal(await page.locator('.board-landing-ripple').count(),0);
      await page.evaluate(()=>qaBoard.revealRouteState({routeIndex:72}));
      assert.ok(await page.evaluate(()=>qaBoard.motion.effects.size)>20);
      await page.waitForTimeout(900);
      assert.equal(await page.evaluate(()=>qaBoard.motion.effects.size),0);
      await page.evaluate(()=>qaBoard.revealRouteState({routeIndex:72}));
      assert.equal(await page.evaluate(()=>qaBoard.motion.effects.size),0,'同圈状态同步不重复播放晋阶');
      await page.evaluate(()=>{document.documentElement.dataset.quality='low';qaBoard.applyQuality();qaBoard.revealRouteState({routeIndex:136});qaBoard.highlight({routeIndex:136});});
      assert.equal(await page.evaluate(()=>qaBoard.motion.effects.size),0);
      assert.equal(await page.locator('.petal').count(),0);
      await page.evaluate(()=>{document.documentElement.dataset.quality='high';qaBoard.applyQuality();});
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.evaluate(()=>{qaBoard.revealRouteState({routeIndex:0});qaBoard.highlight({routeIndex:0});});
      assert.equal(await page.evaluate(()=>qaBoard.motion.effects.size),0);
      assert.equal(await page.locator('.garden-shore').evaluate(e=>getComputedStyle(e,'::before').animationName),'none');
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.evaluate(()=>qaBoard.highlight({routeIndex:0}));
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.waitForFunction(()=>qaBoard.motion.effects.size===0,{},{timeout:200});
      assert.equal(await page.evaluate(()=>qaBoard.motion.effects.size),0,'运行时减少动态应立即清理动效');
      await page.emulateMedia({reducedMotion:'no-preference'});
      await page.evaluate(()=>{qaBoard.setVisibleRing('outer');qaBoard.setPiecePos(qaBoard.routeCellId(0));qaBoard.applyQuality();
        Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
      assert.equal(await page.locator('#scene').getAttribute('data-motion-paused'),'true');
      assert.equal(await page.locator('.garden-shore').evaluate(e=>getComputedStyle(e,'::before').animationPlayState),'paused');
      await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
      assert.ok(await page.locator('.petal').count()<=8);
    }
    const before=await page.evaluate(()=>({
      collapsed:['attrPanel','talentBar','inspBar'].map(id=>document.getElementById(id).classList.contains('collapsed')),
      current:document.querySelectorAll('.cell.current').length,
      scroll:document.documentElement.scrollWidth, width:innerWidth,
      shadow:getComputedStyle(document.querySelector('.cell')).boxShadow,
      tile:getComputedStyle(document.querySelector('.cell')).backgroundImage,
      scene:getComputedStyle(document.querySelector('#scene')).backgroundImage
    }));
    assert.equal(before.current,1);assert.ok(before.scroll<=width);
    assert.equal(await page.locator('.garden-season').count(),4);
    assert.equal(await page.locator('.cell.current .waypoint-art').count(),1);
    assert.equal(await page.locator('.waypoint-art').first().evaluate(e=>getComputedStyle(e).pointerEvents),'none');
    const currentBox=await page.locator('.cell.current').boundingBox();
    assert.ok(currentBox.x>=0&&currentBox.x+currentBox.width<=width);
    assert.ok(currentBox.y>=0&&currentBox.y+currentBox.height<=height);
    if(width<=900) assert.deepEqual(before.collapsed,[true,true,true]);
    await page.screenshot({path:new URL(`board-${width}.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
    if(width<=600) {
      await page.locator('#attrToggle').click();await page.waitForTimeout(350);
      const box=await page.locator('#attrBody').boundingBox();
      assert.ok(box.x>=0&&box.x+box.width<=width); assert.ok(box.height<height*.6);
      await page.screenshot({path:new URL(`panel-${width}.png`,out).pathname.replace(/^\/(\w:)/,'$1')});
      await page.locator('#talentToggle').click();
      assert.equal(await page.locator('#attrToggle').getAttribute('aria-expanded'),'false');
      await page.locator('#rollBtn').click();
      assert.equal(await page.locator('#talentToggle').getAttribute('aria-expanded'),'false');
    }
    for(const ring of ['middle','inner','secret']) {
      await page.evaluate(ring=>{
        const r=ring==='secret'?qaBoard.cfg.board.hiddenFinalRing:qaBoard.cfg.board.rings.find(r=>r.id===ring);
        if(!r) return;
        qaBoard.setVisibleRing(ring);qaBoard.setPiecePos(r.cells[0].id);
      },ring);
      await page.waitForTimeout(200);
      assert.equal(await page.locator('.cell.current').count(),1);
      if(ring!=='secret') assert.equal(await page.locator('.cell.current .waypoint-art').count(),1);
      assert.equal(await page.locator('.cell.ring-hidden .waypoint-art:visible').count(),0);
      if(width===1440||width===390) await page.screenshot({path:new URL(ring+'-'+width+'.png',out).pathname.replace(/^\/(\w:)/,'$1')});
    }
    await page.evaluate(()=>{
      qaBoard.setVisibleRing('outer');
      qaBoard.setPiecePos(qaBoard.routeCellId(1));
      document.documentElement.dataset.quality='low';
    });
    assert.equal(await page.locator('.cell.current').count(),1);
    assert.equal(await page.locator('.cell[aria-current="location"]').count(),1);
    const low=await page.locator('.cell.current').evaluate(e=>getComputedStyle(e).boxShadow);
    assert.notEqual(low,'none');
    if(width===390) {
      // 验证兼容名胜格，不向正式配置新增任何玩法节点。
      await page.evaluate(()=>{
        const cfg=structuredClone(qaBoard.cfg);
        const cell=cfg.board.rings[0].cells[9];
        cell.type='landmark';cell.icon='yuyuan';
        qaBoard.rebuild(cfg);qaBoard.setPiecePos(cell.id);
      });
      assert.equal(await page.locator('.cell.current .waypoint-art').count(),1);
      const overlap=await page.evaluate(()=>{
        const cell=document.querySelector('.cell.current');
        const a=cell.querySelector('.waypoint-art').getBoundingClientRect();
        return [...document.querySelectorAll('.cell:not(.ring-hidden)')].some(el=>{
          const b=el.getBoundingClientRect();
          return a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
        });
      });
      assert.equal(overlap,false,'名胜立牌不应遮挡任何可见格子');
    }
    assert.deepEqual(errors,[]);
    results.push({width,height,before,low,errors});await page.close();
  }
  fs.writeFileSync(new URL('results.json',out),JSON.stringify(results,null,2));
  console.log('PASS: motion cleanup, tier/reduced-motion/visibility changes and stage replay guard; five viewports; outer/middle/inner/secret states; waypoint visibility and landmark clearance; mobile panels, current position and low quality.');
} finally {await browser.close();}
