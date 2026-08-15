import assert from 'node:assert/strict';
import fs from 'node:fs';
const app = fs.readFileSync(new URL('../js/ui/app.js', import.meta.url), 'utf8');
assert.match(app, /async function startGame[^\n]*\{\s*await ensureGameUi\(\)/, 'startGame 先等待棋盘/云端就绪');
console.log('SINGLE_LINE_PASS');
