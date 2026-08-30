import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const localContract = 'assets/js/feihua-contract.js';
const common = 'assets/js/common.js';
const runtimeContract = join(root, '..', 'feihuaqi-playable', 'js', 'engine', 'config-contract.js');

// 编辑器自包含本地契约：file:// / 本地 http / GitHub Pages 子目录部署均无跨目录 404
assert.ok(html.includes(`<script src="${localContract}`), '编辑器从自身 assets/js/feihua-contract.js 加载契约（自包含）');
assert.ok(existsSync(join(root, localContract)), '本地契约文件已存在，可被内联与线上加载');
assert.equal(readFileSync(join(root, localContract), 'utf8').replace(/\r\n/g, '\n'),
  readFileSync(runtimeContract, 'utf8').replace(/\r\n/g, '\n'),
  '编辑器契约必须与游戏运行时契约逐字一致，避免格式与状态校验漂移');
// 不再依赖跨目录静态路径 + document.write 回退（仅线上扁平布局触发、无头测试无法复现）
assert.ok(!html.includes('../feihuaqi-playable/js/engine/config-contract.js'), '已移除跨目录源码工作区契约路径');
assert.ok(!/document\.write\(/.test(html), '已移除 document.write 回退（仅注释提及不算）');
const contractAt = html.indexOf(localContract);
const commonAt = html.indexOf(common);
assert.ok(contractAt > 0 && commonAt > 0 && contractAt < commonAt, '契约脚本必须先于 common.js 执行');
assert.match(html, /window\.GAME_CONTENT_VERSION\s*=\s*4/, '编辑器页面必须注入当前云端工程版本，阻止旧缓存发布');

console.log('config-contract-loader.test.mjs: 编辑器契约静态优先 + 线上回退加载顺序通过');
