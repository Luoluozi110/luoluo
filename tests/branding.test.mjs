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
assert.match(gameIndex, /app\.js\?v=20260824wenxindice1/, '游戏入口使用新版文心独立缓存版本');
assert.match(gameApp, /album\.js\?v=20260824brand1/, '名篇 UI 使用更新后的品牌模块');
assert.match(gameApp, /engine\/album\.js\?v=20260824brand1/, '存档模块使用更新后的品牌模块');
assert.ok(gameApp.includes('文 心 棋'), '游戏内流派选择页展示文心棋名称');
assert.ok(gameAlbum.includes('文心棋成绩_'), '成绩图导出文件名使用文心棋');
assert.ok(gameAlbumEngine.includes('有效的文心棋存档'), '存档错误提示使用文心棋');

assert.match(editorIndex, /<title>文心棋 · 内容编辑器/, '内容编辑器网页标题统一为文心棋');
assert.match(editorIndex, /WENXINQI · CONTENT STUDIO/, '内容编辑器品牌标识统一为文心棋');
assert.match(editorIndex, /cloud\.js\?v=20260824brand1/, '编辑器云端发布模块使用独立缓存版本');
assert.ok(editorCloud.includes('文心棋自定义配置'), '云端 Gist 描述使用文心棋');

assert.match(qbank, /<title>文心棋 · 题库编辑器<\/title>/, '题库编辑器标题统一为文心棋');
assert.match(multiplayerDemo, /<title>文心棋 · 多人连接 Demo<\/title>/, '多人演示标题统一为文心棋');
assert.ok(multiplayerDemo.includes("name: '文心棋房'"), '多人默认房间名使用文心棋');

console.log('branding.test.mjs: 网页标题、游戏内反馈、编辑器与多人演示品牌统一通过');
