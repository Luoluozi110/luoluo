import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../js/ui/battle.js', import.meta.url), 'utf8');
assert.match(source, /const isExperimental = m === 'experimental'/, '实验风格须单独识别');
assert.match(source, /结果将在结算时揭示/, '实验风格选择前不应显示具体数值');
assert.match(source, /!isExperimental && mom > 0/, '实验风格不得泄露气势数值');
console.log('experimental-manner-ui.test.mjs: 实验风格数值展示已屏蔽 ✓');
