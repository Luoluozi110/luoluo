// boot-perf.test.mjs —— 首屏加载结构静态回归
// 校验目标：首屏「菜单先可见，开局前配置一致」的启动改造不被回退：
//   1) loadConfig 同批并发所有必需/可选配置，不再先等必需、再等可选的串行往返；
//   2) boot 先显示菜单，云端同步改为「本机缓存优先 + 后台限时刷新」，不在首屏硬等远端；
//   3) 棋盘/HUD/Battle 构建延迟到真正进局（ensureGameUi），且进局前等待云端同步收尾，
//      保证 BoardView 基建在完成合并后的 cfg 上、复现地图编辑器覆盖；
//   4) 主菜单返回时后台静默重同步，避免重复请求。
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../js/engine/config.js', import.meta.url), 'utf8');

// 1) 配置并发加载：必需与可选配置同批 Promise.all，不再串行两轮。
assert.ok(config.includes('const cfg = Object.fromEntries(await Promise.all([...required, ...optional]))'),
  'loadConfig 将必需+可选同批并发');
// 不再保留「先 await required、再 await OPTIONAL_FILES」的两段式串行。
assert.ok(!/Promise\.all\(FILES[\s\S]{0,200}Object\.fromEntries\([\s\S]{0,200}Promise\.all\(OPTIONAL_FILES/.test(config),
  '不再有「先等必需、再等可选」的两段式串行');

// 2) 首屏立即显示菜单：开启局必要 UI 前不阻塞等待云端同步。
assert.match(app, /await prepareCloudConfig\(\)/, 'boot 先走云端配置准备（缓存优先）');
assert.match(app, /buildMenu\(\)/, 'boot 内立即构建主菜单');
assert.match(app, /openSchoolScreen\(\{ resync: false \}\)/, 'boot 内立即打开选流派屏，且不做首次重复重同步');
assert.ok(app.indexOf('readCloudCache(cloudConfigUrl)') > -1 && app.indexOf('applyCloudProject') > -1 && app.indexOf('fetchCloudConfig(cloudConfigUrl') > -1,
  'prepareCloudConfig 先采用本机缓存、再后台限时刷新');

// 3) 棋盘/HUD/Battle 延迟构建；确保进局前等待云端收尾。
assert.match(app, /async function ensureGameUi\(\)\s*\{[^;]*await waitForCloudBeforeGame\(\)/, 'ensureGameUi 为异步且先等待云端同步收尾');
assert.match(app, /if \(!board\) board = new BoardView\(cfg/, '棋盘仅首次进局时才构建');
// startGame 签名须为 async，且函数体先于他用调用 await ensureGameUi()。
const startIdx = app.indexOf('async function startGame(');
assert.ok(startIdx > -1, 'startGame 声明为 async 函数');
const startTail = app.slice(startIdx, startIdx + 140);
assert.ok(startTail.includes('async function startGame(') && startTail.includes('await ensureGameUi()'),
  'startGame 先等待棋盘/云端就绪');
// loadGame（继续上局）开头先补齐棋盘/HUD。
const loadIdx = app.indexOf('async function loadGame()');
assert.ok(loadIdx > -1 && app.slice(loadIdx, loadIdx + 140).includes('await ensureGameUi()'),
  'loadGame（继续上局）先补齐棋盘/HUD');

// 4) 主菜单返回时后台静默重同步，避免重复请求且不阻塞。
assert.match(app, /function maybeResyncCloud\(\)\s*\{[^;]*if \(!cloudConfigUrl \|\| cloudSyncRunning\) return/, 'maybeResyncCloud 有进行中同步时不再重复发起');

console.log('boot-perf.test.mjs: 首屏并发加载 / 云端缓存优先 / 延迟构建 / 进局前同步 全部通过');
