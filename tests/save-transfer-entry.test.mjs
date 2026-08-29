// save-transfer-entry.test.mjs —— 存档迁移入口与职责边界静态回归
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
const album = fs.readFileSync(new URL('../js/ui/album.js', import.meta.url), 'utf8');

// 主菜单：选流派页必须有独立入口并绑定完整存档弹窗。
assert.match(app, /data-save-transfer>存档码（导入／导出）/);
assert.match(app, /schoolEl\.querySelector\('\[data-save-transfer\]'\).*openSaveTransfer/s);

// 局内菜单：必须有独立入口，且导出前强制保存当前瞬时对局状态。
assert.match(app, /menu-item" data-save-transfer>存档码（导入／导出）/);
assert.match(app, /beforeExport:\s*\(\)\s*=>\s*\{[^}]*forceSaveRun\(game\)/s);

// 独立存档码 UI 不再依附传世名篇页，且明确为全量内容。
assert.match(album, /openSaveTransfer\(opts = \{\}\)/);
assert.match(album, /<h2>存 档 码<\/h2>/);
assert.match(album, /data-export>导出存档码/);
assert.match(album, /data-import>导入存档码/);
assert.match(album, /累计战绩与传世名篇图鉴、图鉴阁（对手／文心／羁绊／天象）进度、传承火种，以及自动／手动进行中对局/);
assert.match(album, /Album\.exportCode/);
assert.match(album, /Album\.importCode/);

console.log('save-transfer-entry.test.mjs: main / in-game / full-save entry passed');
