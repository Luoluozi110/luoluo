import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const gameIndex = read('../feihuaqi-playable/index.html');
const gameApp = read('../feihuaqi-playable/js/ui/app.js');
const gameAlbum = read('../feihuaqi-playable/js/ui/album.js');
const gameAlbumEngine = read('../feihuaqi-playable/js/engine/album.js');
const editorIndex = read('../feihua-editors/index.html');
const editorCloud = read('../feihua-editors/assets/js/cloud.js');
const qbank = read('../qbank-editor/index.html');
const multiplayerDemo = read('../feihuaqi-multiplayer/client/demo.html');

assert.match(gameIndex, /<title>文心棋<\/title>/, '线上游戏网页标题统一为文心棋');
assert.match(gameIndex, /application-name" content="文心棋"/, '线上游戏应用名称统一为文心棋');
// 缓存版本戳每次部署都会统一 bump，故只断言「存在且格式合法」，不钉死具体值
// （历史教训：钉死 20260824wenxindice1 / 20260824brand1 导致部署后误报失败）。
const V = String.raw`\?v=[A-Za-z0-9_-]+`;
assert.match(gameIndex, new RegExp(String.raw`app\.js${V}`), '游戏入口使用独立缓存版本');
assert.match(gameApp, new RegExp(String.raw`album\.js${V}`), '名篇 UI 使用独立缓存版本');
assert.match(gameApp, new RegExp(String.raw`engine/album\.js${V}`), '存档模块使用独立缓存版本');
assert.ok(gameApp.includes('文 心 棋'), '游戏内流派选择页展示文心棋名称');
assert.ok(gameAlbum.includes('文心棋成绩_'), '成绩图导出文件名使用文心棋');
assert.ok(gameAlbumEngine.includes('有效的文心棋存档'), '存档错误提示使用文心棋');

assert.match(editorIndex, /<title>文心棋 · 内容编辑器/, '内容编辑器网页标题统一为文心棋');
assert.match(editorIndex, /WENXINQI · CONTENT STUDIO/, '内容编辑器品牌标识统一为文心棋');
assert.match(editorIndex, new RegExp(String.raw`cloud\.js${V}`), '编辑器云端发布模块使用独立缓存版本');
// Gist 描述改由本机 gh 发布桥接服务端生成（cloud.js 只调 /publish），故断言指向桥接脚本。
const editorBridge = read('../scripts/serve-editor-bridge.mjs');
assert.ok(editorBridge.includes('文心棋自定义配置'), '云端 Gist 描述使用文心棋');

assert.match(qbank, /<title>文心棋 · 题库编辑器<\/title>/, '题库编辑器标题统一为文心棋');
assert.match(multiplayerDemo, /<title>文心棋 · 多人连接 Demo<\/title>/, '多人演示标题统一为文心棋');
assert.ok(multiplayerDemo.includes("name: '文心棋房'"), '多人默认房间名使用文心棋');

console.log('branding.test.mjs: 网页标题、游戏内反馈、编辑器与多人演示品牌统一通过');
