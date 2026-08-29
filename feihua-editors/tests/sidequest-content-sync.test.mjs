import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sandbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('../assets/js/seed-sidequests.js', import.meta.url), 'utf8'), sandbox);
assert.equal(sandbox.window.GAME_SIDEQUESTS.routes.length, 3, '编辑器需保存三条支线路线');
assert.equal(sandbox.window.GAME_SIDEQUEST_TALENTS.length, 12, '编辑器需同步 12 枚限定文心');
assert.deepEqual([...sandbox.window.GAME_SIDEQUEST_TALENTS.map(t => t.id)].sort(), ['T041','T042','T043','T044','T045','T046','T047','T048','T049','TA09','TA10','TA11'].sort());
assert.match(readFileSync(new URL('../assets/js/common.js', import.meta.url), 'utf8'), /project\.sidequests = global\.GAME_SIDEQUESTS/, '导出工程必须携带支线 NPC 与路线');
console.log('sidequest-content-sync.test.mjs: 编辑器支线内容同步 ✓');
