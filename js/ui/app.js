/**
 * app.js —— 主控制器：装配 引擎(Game) + 表现层(BoardView/Hud/Modals/BattleStage/AlbumUI)
 * 并实现 game.js 所需的 ui 适配器接口，
 * 串起「选流派 → 装配名篇 → 对局 → 新解锁 → 结算」全流程。
 */
import { loadConfig, configSource, applyProjectOverride, loadCloudUrl } from '../engine/config.js';
import { Game } from '../engine/game.js';
import { BoardView } from './board.js';
import { Hud, radarSVG } from './hud.js';
import { Modals } from './modals.js';
import { BattleStage } from './battle.js';
import { AlbumUI } from './album.js';
import { CodexUI } from './codex.js';
import { SCHOOL_EMBLEM, ensureDefs } from './svg.js';
import { initQuality, getTier, setTier } from './quality.js';
import { ATTR_NAMES } from '../engine/rules.js';
import * as Album from '../engine/album.js';
import * as Codex from '../engine/codex.js';
import { initAudio } from './audio.js';
import { setScene, setTension, setStage } from './music.js';
import { saveRun, loadRun, hasRun, clearRun, deserializeRun, loadBestRun, listRuns, RUN_SAVE_MANUAL_KEY } from '../engine/save.js';
import { Leaderboard } from './leaderboard.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

let cfg, board, hud, modals, battle, schoolEl, resultEl, albumUI, codexUI;
let game = null;
let rolling = false;
let menuEl = null;
let menuOv = null;
let customConfigActive = false;
let cloudConfigUrl = '';     // 云端配置地址（部署级 cloud.json 或本机 localStorage 覆盖）
let cloudConfigActive = false;

/** index.html 已带静态骨架；缺失时补建，保证 app.js 单独引用也能跑 */
function ensureSkeleton() {
  if ($('#scene')) return;
  $('#app').innerHTML = `
    <div id="scene"></div>
    <div id="hud"></div>
    <div id="modalLayer"></div>
    <div id="battleStage"></div>
    <div id="schoolScreen"></div>
    <div id="loadout-screen"></div>
    <div id="album-screen"></div>
    <div id="codex-screen"></div>
    <div id="resultScreen"></div>
    <div id="topLayer"></div>
    <button id="soundToggle" type="button"></button>`;
}

async function boot() {
  ensureSkeleton();
  initQuality();  // 尽早定档：在 <html> 写 data-quality，board 构建前生效
  ensureDefs();   // 共享体积资源：格子图标/名胜/流派徽记引用

  // 音效：挂解锁钩子（首次交互后才建 AudioContext）+ 全局点击音 + 静音开关
  initAudio($('#soundToggle'));
  // 配乐：待机/标题界面 BGM（首次交互后真正起播）
  setScene('idle');

  // 云端自动同步必须发生在 BoardView / Modals / BattleStage 创建之前。
  // 旧顺序先创建 BoardView 再拉云端：cfg 虽被覆盖，但 BoardView 仍持有旧 board，
  // 因而地图编辑器的名称/图标/格子效果不会反映到画面。
  try {
    cloudConfigUrl = localStorage.getItem('feihua_cloud_config_url') || (await loadCloudUrl()) || '';
    if (cloudConfigUrl) {
      const proj = await fetchCloudConfig(cloudConfigUrl);
      if (proj) {
        cfg = applyProjectOverride(cfg, proj);
        cloudConfigActive = true;
      }
    }
  } catch (_) { /* 云端不可用不阻断启动 */ }

  board = new BoardView(cfg, $('#scene'));
  hud = new Hud($('#hud'));
  if (cloudConfigActive) hud.toast('已从云端同步最新配置');
  modals = new Modals($('#modalLayer'), cfg);
  Leaderboard.init(modals).catch(() => {});   // 云端排行榜：读取配置并加载 Supabase 客户端（失败不阻断启动）
  battle = new BattleStage($('#battleStage'), cfg);
  schoolEl = $('#schoolScreen');
  resultEl = $('#resultScreen');
  albumUI = new AlbumUI({
    loadoutEl: $('#loadout-screen'),
    albumEl: $('#album-screen'),
    layerEl: $('#modalLayer'),
    topEl: $('#topLayer'),
    cards: cfg.album || []
  });
  codexUI = new CodexUI({ el: $('#codex-screen'), cfg });
  if (cfg.inspiration && cfg.inspiration.lowWarning) hud.lowWarning = cfg.inspiration.lowWarning;
  // 点击 HUD 中文心格 → 查看已拥有文心的属性 / 效果
  hud.onTalent = t => modals.showTalentDetail(t);

  // 掷骰按钮只绑定一次，用 rolling 标志防止重入
  hud.onRoll(onRoll);

  buildMenu();
  openSchoolScreen();
}

/* ---------------------------------------------------- 阶段 → 配乐移调 */

/**
 * 把游戏进度(0..1)映射为科考阶段 0..4，驱动配乐「五声调式内移调」。
 * 阈值与 config/npcs.json 的 tier.range 对齐：童生[0,0.25)→0，秀才[0.25,0.5)→1，
 * 举人[0.5,0.75)→2，进士[0.75,1)→3，主考官(殿试,=1)→4。
 */
function stageFromProgress(p) {
  if (p >= 1) return 4;
  if (p >= 0.75) return 3;
  if (p >= 0.5) return 2;
  if (p >= 0.25) return 1;
  return 0;
}

/* ---------------------------------------------------- 选流派屏 */
function openSchoolScreen() {
  maybeResyncCloud();   // 返回主菜单时静默重新拉取云端配置（若已开启）
  showMenuButton(false);
  setScene('idle');            // 返回待机/标题界面：恢复待机配乐
  setStage(game ? stageFromProgress(game.progress()) : 0); // 待机主题按当前所处阶段移调
  clearRunIfFinished();
  buildSchoolScreen();
  resultEl.classList.remove('on');
  albumUI.closeLoadout();
  albumUI.closeAlbum();
  codexUI.close();
  schoolEl.classList.add('on');
}

/** 本局已结束时，清理「继续上局」入口（逐槽检查，只清已结束的槽） */
function clearRunIfFinished() {
  for (const r of listRuns()) if (r.over) clearRun(r.slot);
}

/* ------------------------------------------------ 存档管线（v2） */
let lastAutoSave = 0;

/** 把自动保存挂到引擎的「安全保存点」回调上 */
function wireGameSaves(g) {
  g.onSavePoint = () => autoSaveRun(g);
  // 升级等「玩家主动推进」操作调用：立即落盘，避免升级后到下一存档点前重载导致回退。
  // 同步手动槽（若存在且未结束），保证「继续上局」从自动/手动任一槽读都反映最新进度。
  g.onForceSave = () => forceSaveRun(g);
}

/**
 * 强制落盘（升级等主动推进时调用）：写入自动槽，并同步手动槽（若存在且未结束）。
 * 与 autoSaveRun 的区别：跳过防抖、且把手动槽一并刷新，确保「继续上局」无论读哪个槽都拿到最新进度。
 */
function forceSaveRun(g) {
  if (!g || !g.s || g.s.over) return;
  const a = saveRun(g, RUN_SAVE_KEY);
  const m = loadRun(RUN_SAVE_MANUAL_KEY);
  if (m && !m.__corrupt && m.state && !m.state.over) saveRun(g, RUN_SAVE_MANUAL_KEY);
  if (a.where !== 'local') hud.toast('本地存储不可用，本次进度仅暂存于内存/会话（关闭页面将丢失）');
  else if (a.tooBig) hud.toast('存档体积较大，建议及时结算本局');
}

/**
 * 自动存档（写入自动槽）。带 300ms 防抖：殿试等流程一回合内可能触发多次保存点。
 * force=true 时跳过防抖（开局首存）。
 */
function autoSaveRun(g, force = false) {
  if (!g || !g.s || g.s.over) return;
  const now = Date.now();
  if (!force && now - lastAutoSave < 300) return;
  lastAutoSave = now;
  const r = saveRun(g);
  if (!r.ok) return;
  if (r.where !== 'local') hud.toast('本地存储不可用，本次进度仅暂存于内存/会话（关闭页面将丢失）');
  else if (r.tooBig) hud.toast('存档体积较大，建议及时结算本局');
}

function buildSchoolScreen() {
  const cards = cfg.schools.map(sch => {
    const tal = (cfg.talents || []).find(t => t.id === sch.talent);
    return `
      <button class="school-card" data-id="${sch.id}">
        <div class="emblem">${SCHOOL_EMBLEM[sch.attr] || ''}</div>
        <h3>${sch.name}</h3>
        <div class="bonus">入门 ${ATTR_NAMES[sch.attr]} +${cfg.attrs.schoolBonus ?? 3}</div>
        <div class="tal">初授文心：${tal ? tal.name : '—'}</div>
        <div class="desc">${sch.desc || ''}</div>
      </button>`;
  }).join('');

  const src = Object.entries(configSource).map(([k, v]) => `${k}←${v}`).join('　');
  const store = Album.loadStore();
  const canContinue = hasRun();
  // 续玩存档摘要：槽位（手动/自动）+ 回合 + 时间
  const contRun = canContinue
    ? (listRuns().filter(r => !r.over).find(r => r.manual) || listRuns().filter(r => !r.over)[0])
    : null;
  const contInfo = contRun
    ? `${contRun.manual ? '手动存档' : '自动存档'} · 第 ${contRun.turn} 回合 · ${contRun.savedAt ? new Date(contRun.savedAt).toLocaleTimeString('zh-CN', { hour12: false }) : ''}`
    : '检测到未完成的存档，可从中断处续玩';

  // 图鉴阁入口：展示已邂逅对手数（跨局累计）
  const npcs = cfg.npcs || [];
  const foesTotal = npcs.reduce((a, t) => a + ((t.npcs || []).length || 0), 0);
  const foesGot = npcs.reduce((a, t) =>
    a + (t.npcs || []).filter(n => Codex.hasFoe(t.id, n.name)).length, 0);

  schoolEl.innerHTML = `
    <div class="school-inner scroll-frame paper" style="max-width:min(1080px,94vw);border-radius:14px">
      <div class="title-ink" style="font-size:40px;text-align:center">選 擇 流 派</div>
      <div class="subtitle" style="text-align:center;margin-top:6px">五子各有所长，落子无悔，且赴科场。</div>
      ${canContinue ? `<div style="text-align:center;margin:10px 0 4px"><button class="btn btn-primary" data-continue style="font-size:18px;padding:12px 30px;letter-spacing:.12em">▶ 继续上局</button>
        <div style="font-size:12px;color:var(--mo-3);margin-top:6px">${contInfo}</div></div>` : ''}
      <div class="school-grid">${cards}</div>
      <div class="school-actions" style="text-align:center;margin-top:16px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <button class="btn btn-ink" data-album>传世名篇（已解锁 ${store.unlocked.length}/${(cfg.album || []).length}）</button>
        <button class="btn btn-ink" data-codex>图鉴阁（已邂逅 ${foesGot}/${foesTotal}）</button>
        <button class="btn btn-ink" data-save-transfer>存档码（导入／导出）</button>
      </div>
      <div style="font-size:12px;color:var(--mo-3);letter-spacing:.08em;margin-top:8px;text-align:center">
        择定流派后，可于「装配名篇」中携带至多 ${Album.LOADOUT_MAX} 张图鉴卡入局。
      </div>
      <div style="text-align:center;font-size:11px;color:var(--mo-3);letter-spacing:.1em;margin-top:12px">
        配置来源：${src}
      </div>
    </div>`;

  schoolEl.querySelectorAll('.school-card').forEach(b =>
    b.addEventListener('click', () => openLoadout(b.dataset.id)));
  schoolEl.querySelector('[data-album]').addEventListener('click', () =>
    albumUI.openAlbum({ onBack: () => { buildSchoolScreen(); } }));
  schoolEl.querySelector('[data-codex]')?.addEventListener('click', () => codexUI.open('foes'));
  schoolEl.querySelector('[data-save-transfer]')?.addEventListener('click', () => albumUI.openSaveTransfer());
  const cont = schoolEl.querySelector('[data-continue]');
  if (cont) cont.addEventListener('click', () => loadGame());
}

/* ---------------------------------------------------- 装配屏 */
function openLoadout(schoolId) {
  const school = cfg.schools.find(s => s.id === schoolId) || cfg.schools[0];
  schoolEl.classList.remove('on');
  setScene('menu');           // 装配名篇：菜单配乐
  albumUI.openLoadout({
    schoolName: school.name,
    onStart: picked => openNameScreen(schoolId, picked),
    onBack: () => openSchoolScreen(),
    onAlbum: () => albumUI.openAlbum({ onBack: () => {} })
  });
}

/* ---------------------------------------------------- 开局起名屏 */
/** 装配名篇后、真正开局前，让玩家为自己的角色起名；点「返回」回装配屏 */
async function openNameScreen(schoolId, loadout) {
  albumUI.closeLoadout();   // 收起装配屏，名号弹窗独占画面
  const name = await modals.showNamePrompt('');
  if (name === null) { openLoadout(schoolId); return; }
  startGame(schoolId, loadout, name);
}

function startGame(schoolId, loadout, playerName) {
  schoolEl.classList.remove('on');
  resultEl.classList.remove('on');
  albumUI.closeLoadout();
  albumUI.closeAlbum();
  board.setPiecePos(0);
  board.clearHint();
  board.cellEls.forEach(e => e.classList.remove('active'));

  game = new Game(cfg, makeUi(), Math.random);
  wireGameSaves(game);
  game.onVictory = (nm, sc) => Leaderboard.submit(nm, sc).catch(() => {});   // 通关 → 提交云端排行榜
  const cards = loadout || [];
  const s = game.start(schoolId, { loadout: cards, name: playerName || '' });
  modals.playerName = s.playerName || '';   // 叙事文本据此替换「你」
  modals.game = game;                       // 文心升级：详情弹窗调用引擎 upgradeTalent
  if (cards.length) hud.toast(`行囊生效：${cards.map(c => `「${c.name}」`).join('')}`);
  hud.render(s);
  showMenuButton(true);
  setScene('board');          // 进入对局：行进配乐
  setTension(0);
  setStage(stageFromProgress(game.progress())); // 按当前科考阶段移调（宫→商→角→徵→羽）
  autoSaveRun(game, true); // 开局即存（跳过防抖），关闭后可从「继续上局」恢复
  hud.toast('手机端可拖动棋盘平移、双指缩放；随时点右上角菜单存档');
  enableRoll();
}

/* ---------------------------------------------------- ui 适配器 */
function makeUi() {
  return {
    floatAttrs(out) {
      const txt = Object.entries(out)
        .map(([k, v]) => `${ATTR_NAMES[k]} ${v > 0 ? '+' : ''}${v}`).join('　');
      if (txt) board.float(txt, 'ink-up');
    },
    floatInspiration(real) {
      board.float(`灵感 ${real > 0 ? '+' : ''}${real}`, real >= 0 ? 'ink-up' : 'ink-down');
    },
    showTalentGain: t => modals.showTalentGain(t),
    askReplaceTalent: (t, list) => modals.askReplaceTalent(t, list),
    onState(s) { hud.render(s); },
    skyExpired(card) { hud.toast(`${card.name} 之效已散`); },
    showDice: d => board.showDice(d),
    movePiece: s => board.movePiece(s),
    toast: t => hud.toast(t),
    highlightCell: c => board.highlight(c),
    showQuiz: (q, opt) => modals.showQuiz(q, opt),
    showQuizResult: (q, ans, ok) => modals.showQuizResult(q, ans, ok),
    showEvent: ev => modals.showEvent(ev),
    showSky: c => modals.showSky(c),
    showZeitgeist: z => modals.showZeitgeist(z),
    askScenic: (cell, cost, curInsp) => modals.askScenic(cell, cost, curInsp),
    runBattle: async sess => {
      setScene('battle');     // 挥毫论战：切 combat 配乐
      setTension(0.7);
      const out = await battle.run(sess);
      setScene('board');      // 战后回到对局配乐
      setTension(0);
      setStage(stageFromProgress(game.progress())); // 战后阶段可能已进阶，重新移调
      return out;
    },
    showPalaceIntro: () => modals.showPalaceIntro(),
    showResult: sum => showResult(sum)
  };
}

function enableRoll() {
  if (!game || game.s.over) return;
  board.hintRange(game.s);
  hud.setRollEnabled(true, '掷骰');
}

async function onRoll() {
  if (!game || game.s.over || rolling) return;
  rolling = true;
  hud.setRollEnabled(false);
  board.clearHint();
  try {
    await game.playTurn();
  } catch (e) {
    console.error(e);
    hud.toast('对局异常：' + (e && e.message || e));
  }
  rolling = false;
  if (game && !game.s.over) enableRoll();
  // 每回合的自动落盘已改由引擎「安全保存点」回调（onSavePoint）触发，此处不再重复存档
}

/* ---------------------------------------------------- 菜单 / 随时存档 */
const MENU_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2.4" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="2.4" fill="currentColor" stroke="none"/><circle cx="8" cy="18" r="2.4" fill="currentColor" stroke="none"/></svg>`;

function buildMenu() {
  if (menuEl) return;
  const btn = document.createElement('button');
  btn.id = 'menuBtn';
  btn.type = 'button';
  btn.title = '菜单 / 存档';
  btn.setAttribute('aria-label', '菜单');
  btn.innerHTML = MENU_ICON;
  btn.style.display = 'none';
  btn.addEventListener('click', toggleMenu);
  document.body.appendChild(btn);
  menuEl = btn;
}

function showMenuButton(on) {
  if (menuEl) menuEl.style.display = on ? 'flex' : 'none';
}

function toggleMenu() {
  if (menuOv) { closeMenu(); return; }
  showMenu();
}

function closeMenu() {
  if (menuOv) { modals.close(menuOv); menuOv = null; }
  if (menuEl) menuEl.classList.remove('on');
}

function showMenu() {
  const canSave = !!(game && !game.s.over);
  const canLoad = hasRun();
  // 存档摘要：优先手动槽（保留关键节点），其次自动槽
  const runs = listRuns().filter(r => !r.over);
  const best = runs.find(r => r.manual) || runs[0] || null;
  const fmt = t => t ? new Date(t).toLocaleTimeString('zh-CN', { hour12: false }) : '';
  const loadLabel = best
    ? `读取存档（${best.manual ? '手动' : '自动'} · 第${best.turn}回合 · ${fmt(best.savedAt)}）`
    : '没有可用存档';
  const html = `
    <div class="modal paper" style="width:min(360px,90vw)">
      <div class="mtitle"><h2>桃 花 棋 · 菜 单</h2></div>
      <div class="menu-list">
        <button class="btn btn-ink menu-item" data-save ${canSave ? '' : 'disabled'}>${canSave ? '保存当前进度（手动存档）' : '暂无进行中的对局'}</button>
        <button class="btn btn-ink menu-item" data-load ${canLoad ? '' : 'disabled'}>${loadLabel}</button>
        <button class="btn btn-ink menu-item" data-save-transfer>存档码（导入／导出）</button>
        <button class="btn btn-ink menu-item" data-codex>图鉴阁</button>
        <button class="btn btn-ink menu-item" data-leaderboard>☁ 云端排行榜</button>
        <button class="btn btn-ink menu-item" data-custom>载入自定义配置（高级）</button>
        <button class="btn btn-ink menu-item" data-restart>返回主菜单</button>
        <button class="btn btn-ink menu-item" data-quality>${getTier() === 'low' ? '切换高画质' : '切换省电档'}</button>
        <button class="btn btn-ink menu-item" data-close>关闭</button>
      </div>
      <div style="font-size:12px;color:var(--mo-3);text-align:center;margin-top:12px;letter-spacing:.05em;line-height:1.7">
        每回合结束自动存档；「保存当前进度」另存为手动档，不被覆盖。<br/>
        关闭页面后，可从「主菜单 · 继续上局」恢复（读取时手动档优先）。
      </div>
    </div>`;
  const ov = modals.open(html, 'gameMenu');
  menuOv = ov;
  if (menuEl) menuEl.classList.add('on');
  ov.querySelector('[data-save]')?.addEventListener('click', () => { saveGame(); closeMenu(); });
  ov.querySelector('[data-load]')?.addEventListener('click', () => { closeMenu(); loadGame(); });
  ov.querySelector('[data-save-transfer]')?.addEventListener('click', () => {
    closeMenu();
    albumUI.openSaveTransfer({
      // 局内导出前把当前瞬时状态强制写入自动槽，避免导出上一个安全存档点。
      beforeExport: () => { if (game && game.s && !game.s.over) forceSaveRun(game); }
    });
  });
  ov.querySelector('[data-codex]')?.addEventListener('click', () => { closeMenu(); codexUI.open('foes'); });
  ov.querySelector('[data-leaderboard]')?.addEventListener('click', () => { closeMenu(); Leaderboard.openModal(); });
  ov.querySelector('[data-custom]')?.addEventListener('click', () => { closeMenu(); openCustomConfig(); });
  ov.querySelector('[data-restart]')?.addEventListener('click', () => { closeMenu(); openSchoolScreen(); });
  ov.querySelector('[data-quality]')?.addEventListener('click', () => {
    const next = getTier() === 'low' ? 'high' : 'low';
    setTier(next);
    if (board && board.applyQuality) board.applyQuality();   // 花瓣按新档重生成
    closeMenu(); showMenu();                                  // 重开菜单刷新标签
  });
  ov.querySelector('[data-close]')?.addEventListener('click', () => closeMenu());
  ov.addEventListener('click', e => { if (e.target === ov) closeMenu(); });
}

/* ------------------------------------------------------ 云端自动同步（编辑器发布 → 所有玩家共享） */

/** 拉取云端配置（带缓存击穿），返回解析后的工程对象或 null */
async function fetchCloudConfig(url) {
  try {
    const sep = url.includes('?') ? '&' : '?';
    const res = await fetch(url + sep + '_cb=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) {
      if (hud && hud.toast) hud.toast('云端配置拉取失败（HTTP ' + res.status + '）');
      return null;
    }
    const obj = await res.json();
    if (!obj || typeof obj !== 'object') return null;
    return obj;
  } catch (e) {
    if (hud && hud.toast) hud.toast('云端配置拉取失败：' + e.message);
    return null;
  }
}

/** 返回主菜单时静默重新拉取（若已开启云端同步），使中途的发布在下一局生效 */
function maybeResyncCloud() {
  if (!cloudConfigUrl) return;
  fetchCloudConfig(cloudConfigUrl).then(proj => {
    if (proj) { cfg = applyProjectOverride(cfg, proj); cloudConfigActive = true; }
  }).catch(() => {});
}

/* ------------------------------------------------------ 载入自定义配置（编辑器导出 → 本机生效） */
function openCustomConfig() {
  const cur = localStorage.getItem('feihua_custom_config');
  const html = `
    <div class="modal paper" style="width:min(620px,94vw)">
      <div class="mtitle"><h2>载 入 自 定 义 配 置</h2></div>
      <div style="font-size:13px;color:var(--mo-3);line-height:1.85;margin:4px 2px 12px">
        把「内容编辑器」导出的 <code>feihua-content.json</code> 粘贴或上传到此处，<br/>
        即可让<b>当前浏览器里的游戏</b>立即使用你改过的题库 / 奇遇 / 文心 / NPC / 相性——<b>无需重新部署</b>。<br/>
        配置仅存于本机（刷新仍生效）；点「恢复默认配置」可清除。
      </div>
      <textarea id="cfgTA" class="cfg-ta" placeholder="在此粘贴 feihua-content.json 的内容…"></textarea>
      <div class="modal-actions" style="margin-top:12px">
        <label class="btn" style="cursor:pointer">上传文件<input type="file" id="cfgFile" accept=".json,application/json" style="display:none"/></label>
        <button class="btn primary" id="cfgApply">应用配置</button>
        <button class="btn" id="cfgReset">恢复默认配置</button>
        <button class="btn" id="cfgClose">关闭</button>
      </div>
      <div id="cfgMsg" style="font-size:12px;margin-top:10px;min-height:16px"></div>

      <hr style="border:none;border-top:1px dashed var(--mo-4);margin:16px 0 12px" />
      <div style="font-size:13px;color:var(--mo-2);line-height:1.8">
        <b>云端自动同步（所有玩家共享）</b><br/>
        填入「内容编辑器」发布后给出的云端地址；保存后<b>本机及所有玩家启动时自动拉取</b>，无需手动载入。
      </div>
      <div style="display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap">
        <input id="cloudUrlInput" class="cfg-url" style="flex:1;min-width:220px"
          placeholder="https://raw.githubusercontent.com/.../feihua-content.json" value="${esc(cloudConfigUrl)}" />
        <button class="btn primary" id="cloudSave">保存并同步</button>
        <button class="btn" id="cloudClear">清除</button>
      </div>
      <div id="cloudMsg" style="font-size:12px;margin-top:8px;min-height:16px"></div>
    </div>`;
  const ov = modals.open(html, 'customConfig');
  const ta = ov.querySelector('#cfgTA');
  if (cur) { try { ta.value = JSON.stringify(JSON.parse(cur), null, 2); } catch (_) { ta.value = cur; } }
  ov.querySelector('#cfgFile').addEventListener('change', e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { ta.value = r.result; };
    r.readAsText(f); e.target.value = '';
  });
  const setMsg = (t, bad) => { const m = ov.querySelector('#cfgMsg'); m.textContent = t; m.style.color = bad ? 'var(--bad)' : 'var(--mo-2)'; };
  const setCloudMsg = (t, bad) => { const m = ov.querySelector('#cloudMsg'); m.textContent = t; m.style.color = bad ? 'var(--bad)' : 'var(--mo-2)'; };
  ov.querySelector('#cfgClose').addEventListener('click', () => modals.close(ov));
  ov.querySelector('#cfgReset').addEventListener('click', () => {
    localStorage.removeItem('feihua_custom_config'); customConfigActive = false;
    modals.close(ov); hud.toast('已恢复默认配置');
  });
  ov.querySelector('#cfgApply').addEventListener('click', () => {
    let obj;
    try { obj = JSON.parse(ta.value); }
    catch (err) { setMsg('JSON 解析失败：' + err.message, true); return; }
    const proj = (obj && typeof obj === 'object') ? obj : null;
    const keys = ['questions', 'events', 'talents', 'npcs', 'affinity', 'synergies', 'board', 'sky', 'album'].filter(k => proj && proj[k] !== undefined);
    if (!keys.length) { setMsg('文件中未找到 questions / events / talents / npcs / affinity / synergies / board / sky / album 任一键。', true); return; }
    try { cfg = applyProjectOverride(cfg, proj); }
    catch (err) { setMsg('合并失败：' + err.message, true); return; }
    localStorage.setItem('feihua_custom_config', JSON.stringify(proj));
    customConfigActive = true;
    modals.close(ov);
    hud.toast(`已载入自定义配置（${keys.join('/')}），下一局起生效`);
  });
  // 云端同步地址：保存即拉取一次，持久化到本机
  ov.querySelector('#cloudSave').addEventListener('click', async () => {
    const url = ov.querySelector('#cloudUrlInput').value.trim();
    if (!url) { setCloudMsg('请先填入云端地址。', true); return; }
    setCloudMsg('正在同步…');
    const proj = await fetchCloudConfig(url);
    if (!proj) { setCloudMsg('拉取失败，请检查地址或网络。', true); return; }
    try { cfg = applyProjectOverride(cfg, proj); }
    catch (err) { setCloudMsg('合并失败：' + err.message, true); return; }
    localStorage.setItem('feihua_cloud_config_url', url);
    cloudConfigUrl = url; cloudConfigActive = true;
    setCloudMsg('已同步并保存云端地址，所有玩家启动即生效。');
    hud.toast('云端配置已同步');
  });
  ov.querySelector('#cloudClear').addEventListener('click', () => {
    localStorage.removeItem('feihua_cloud_config_url');
    cloudConfigUrl = ''; cloudConfigActive = false;
    ov.querySelector('#cloudUrlInput').value = '';
    setCloudMsg('已清除云端同步地址。');
  });
  ov.addEventListener('click', e => { if (e.target === ov) modals.close(ov); });
}

function saveGame() {
  if (!game || game.s.over) { hud.toast('当前没有进行中的对局'); return; }
  const r = saveRun(game, RUN_SAVE_MANUAL_KEY);   // 手动槽：与每回合自动槽分离，关键节点不被覆盖
  if (!r.ok) { hud.toast('存档失败（浏览器存储不可用）'); return; }
  const t = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  hud.toast(r.where === 'local'
    ? `已存档 ✓（${t}）`
    : '已暂存（本地存储不可用，关闭页面后将丢失）');
}

async function loadGame() {
  const best = loadBestRun();
  if (!best) { hud.toast('没有可读取的存档'); return; }
  if (best.obj.__corrupt) {
    hud.toast('存档数据已损坏，无法读取');
    if (confirm('检测到存档已损坏。是否清除该存档？')) clearRun(best.slot);
    return;
  }
  const res = deserializeRun(best.obj, cfg);
  if (!res.ok) {
    hud.toast('存档无法读取：' + res.error);
    if (confirm(`存档校验未通过（${res.error}）。是否清除该存档？`)) clearRun(best.slot);
    return;
  }
  // 用存档重建一局，再覆盖运行时状态并重建派生引用
  game = new Game(cfg, makeUi(), Math.random);
  wireGameSaves(game);
  game.onVictory = (nm, sc) => Leaderboard.submit(nm, sc).catch(() => {});   // 通关 → 提交云端排行榜
  game.s = res.state;
  modals.playerName = game.s.playerName || '';   // 续玩沿用存档中的名号
  modals.game = game;                            // 文心升级：详情弹窗调用引擎 upgradeTalent
  schoolEl.classList.remove('on');
  resultEl.classList.remove('on');
  albumUI.closeLoadout();
  albumUI.closeAlbum();
  const st = game.s;
  const curCell = game.currentCell();
  board.setPiecePos(curCell ? curCell.id : st.pos);
  board.clearHint();
  board.cellEls.forEach(e => e.classList.remove('active'));
  game.rehydrate();            // 重算羁绊等派生态（内部会 hud.render）
  hud.render(st);
  showMenuButton(true);
  enableRoll();
  hud.toast('已读取存档，继续科场之路');
  for (const w of res.warnings.slice(0, 2)) hud.toast('⚠ ' + w);  // 配置变更导致的失效引用提示
}

/* ---------------------------------------------------- 结算屏 */
async function showResult(sum) {
  setScene('result');         // 科场结算：结算配乐
  // 先演「本局新解锁」，再落结算卷轴
  await albumUI.showNewUnlocks(sum.newUnlocks || []);

  // 主角名号：有则显「「名」」，否则「你」
  const pname = (game && game.s && game.s.playerName) || '';

  // 两列紧凑网格：六维一屏看全（Critic V3）。明细每维最多列 3 条，余者折为「其余 N 项」
  const PARTS_SHOWN = 3;
  const dims = sum.dims.map((d, i) => {
    const ps = d.parts || [];
    const head = ps.slice(0, PARTS_SHOWN)
      .map(p => `<div><span>${esc(p.label)}</span><span>${p.value}</span></div>`).join('');
    const restN = ps.length - PARTS_SHOWN;
    const restV = ps.slice(PARTS_SHOWN).reduce((a, p) => a + (Number(p.value) || 0), 0);
    const rest = restN > 0 ? `<div><span>其余 ${restN} 项</span><span>${restV}</span></div>` : '';
    return `
    <div class="dim-row on" style="animation-delay:${i * 0.07}s">
      <div class="dh"><span class="nm">${esc(d.name)}</span><span class="sc">${d.score}</span></div>
      <div class="parts">${head}${rest}</div>
    </div>`;
  }).join('');

  const st = sum.state || {};
  const b = st.battle || {};
  const mini = [
    `胜 ${b.win || 0}　平 ${b.draw || 0}　负 ${b.loss || 0}`,
    `最高连胜 ${b.maxStreak || 0}`,
    `奇遇 ${st.events ? st.events.total : 0} 次`,
    `文心 ${st.passive ? st.passive.length : 0} 被动 / ${st.active ? st.active.length : 0} 主动`,
    `用时 ${st.turn || 0} 回合`
  ].map(t => `<span>${t}</span>`).join('');

  const unlocks = (sum.newUnlocks || []).map(c => `
    <div class="unlock-card pop-in">
      <div class="uc-tag">图鉴点亮</div>
      <div class="uc-name">${esc(c.name)}</div>
      <div class="uc-reward">${esc(c.rewardDesc || '')}</div>
    </div>`).join('');
  const unlockBlock = unlocks
    ? `<div class="result-unlocks paper"><div style="font-size:14px;letter-spacing:.16em;color:var(--zhu);margin-bottom:6px">本局新解锁</div>
       <div class="unlock-row">${unlocks}</div></div>`
    : '';

  resultEl.innerHTML = `
    <div class="result-wrap">
      <div class="result-head">
        <div class="grade-scroll paper">
          <div class="gname">${esc(sum.grade.name)}</div>
          <div class="gtotal">总评 ${sum.total}</div>
          <div class="gcomment">${esc(sum.comment || '')}</div>
          <div class="greward">${esc(sum.reasonText || '')}</div>
          <div class="pname" style="font-size:13px;color:var(--mo-3);letter-spacing:.12em;margin-top:10px">${pname ? `主角 · ${esc(pname)}` : '主角 · 你'}</div>
        </div>
      </div>
      <div class="result-body">
        <div class="result-radar paper">
          <div style="font-size:15px;letter-spacing:.16em;color:var(--mo-2);margin-bottom:8px">六维才学</div>
          ${radarSVG(st.attrs || {})}
          <div class="mini-stats" style="margin-top:8px">${mini}</div>
        </div>
        <div class="result-dims paper">
          <div style="font-size:16px;letter-spacing:.16em;margin-bottom:6px">六维评分</div>
          <div class="dim-grid">${dims}</div>
          ${unlockBlock}
        </div>
      </div>
      <div class="result-actions">
        <button class="btn btn-ink" data-shot>生成成绩图</button>
        <button class="btn btn-ink" data-album2>传世名篇</button>
        <button class="btn btn-primary" data-again>再来一局</button>
      </div>
    </div>`;

  resultEl.classList.add('on');
  resultEl.querySelector('[data-again]').addEventListener('click', () => openSchoolScreen());
  resultEl.querySelector('[data-album2]').addEventListener('click', () =>
    albumUI.openAlbum({ onBack: () => {} }));
  resultEl.querySelector('[data-shot]').addEventListener('click', () => albumUI.openScoreCard(sum));
}

/* ------------------------------------------------------ 启动 */
(async function () {
  try {
    cfg = await loadConfig();
    // 应用上次「载入自定义配置」留下的覆盖（本机持久，刷新仍生效）
    try {
      const raw = localStorage.getItem('feihua_custom_config');
      if (raw) { cfg = applyProjectOverride(cfg, JSON.parse(raw)); customConfigActive = true; }
    } catch (_) { /* 覆盖损坏则忽略，用默认配置 */ }
  } catch (e) {
    document.body.innerHTML =
      `<div style="color:#f6f0e2;font-family:var(--font-kai);padding:40px;line-height:1.9">
       配置加载失败：${e.message}<br/>请用 <code>python -m http.server</code> 在本目录启动，
       并确保 config/ 或 config-dev/ 下存在全部 11 个 json 文件。</div>`;
    return;
  }
  boot();
})();
