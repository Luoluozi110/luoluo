import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
assert.match(source, /askScenic:\s*\(cell, cost, curInsp, sideQuestMeta\)\s*=>\s*modals\.askScenic\(cell, cost, curInsp, sideQuestMeta\)/,
  '名胜 UI 适配层必须完整转发支线元数据，才能显示支线入口');
console.log('sidequest-ui-wiring.test.mjs: 名胜支线元数据接线 ✓');
