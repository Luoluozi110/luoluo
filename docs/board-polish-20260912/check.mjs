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
    await page.goto('http://127.0.0.1:8087/');
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
    const before=await page.evaluate(()=>({
      collapsed:['attrPanel','talentBar','inspBar'].map(id=>document.getElementById(id).classList.contains('collapsed')),
      current:document.querySelectorAll('.cell.current').length,
      scroll:document.documentElement.scrollWidth, width:innerWidth,
      shadow:getComputedStyle(document.querySelector('.cell')).boxShadow,
      tile:getComputedStyle(document.querySelector('.cell')).backgroundImage,
      scene:getComputedStyle(document.querySelector('#scene')).backgroundImage
    }));
    assert.equal(before.current,1);assert.ok(before.scroll<=width);
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
    await page.evaluate(()=>{
      qaBoard.setPiecePos(qaBoard.routeCellId(1));
      document.documentElement.dataset.quality='low';
    });
    assert.equal(await page.locator('.cell.current').count(),1);
    assert.equal(await page.locator('.cell[aria-current="location"]').count(),1);
    const low=await page.locator('.cell.current').evaluate(e=>getComputedStyle(e).boxShadow);
    assert.notEqual(low,'none');
    assert.deepEqual(errors,[]);
    results.push({width,height,before,low,errors});await page.close();
  }
  fs.writeFileSync(new URL('results.json',out),JSON.stringify(results,null,2));
  console.log('PASS: five viewports, mobile saved-state/accordion/roll, current-cell movement and low-quality highlight.');
} finally {await browser.close();}
