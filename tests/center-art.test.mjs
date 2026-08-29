import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const boardSource = await readFile(new URL('js/ui/board.js', root), 'utf8');
const boardCss = await readFile(new URL('css/board.css', root), 'utf8');
const devServerSource = await readFile(new URL('../../scripts/serve-playable.mjs', import.meta.url), 'utf8');

test('中央桃花书院岛保留母版并提供两档透明 WebP', async () => {
  const png = await readFile(new URL('assets/art/peach-academy-island-v1.png', root));
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(png.readUInt32BE(16), 1254);
  assert.equal(png.readUInt32BE(20), 1254);

  for (const name of ['peach-academy-island-v1.webp', 'peach-academy-island-v1-640.webp']) {
    const file = new URL(`assets/art/${name}`, root);
    const head = await readFile(file);
    assert.equal(head.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(head.subarray(8, 12).toString('ascii'), 'WEBP');
    assert.ok((await stat(file)).size > 100_000);
  }
  assert.match(devServerSource, /'\.webp':\s*'image\/webp'/);
});

test('中心图替换旧 SVG，且保留 2.5D ground / billboard 分层接口', () => {
  assert.match(boardSource, /class="world-art world-ground"/);
  assert.match(boardSource, /class="world-billboards"/);
  assert.match(boardSource, /peach-academy-island-v1-640\.webp/);
  assert.match(boardSource, /peach-academy-island-v1\.png/);
  assert.doesNotMatch(boardSource, /CENTER_GARDEN_ART/);
  assert.doesNotMatch(boardSource, /className = 'island-title'/);
});

test('中心图限制在 74% 安全区且不会接收格子事件', () => {
  assert.match(boardCss, /\.world-scene\s*\{[^}]*pointer-events:\s*none/s);
  assert.match(boardCss, /\.world-art\s*\{[^}]*width:\s*74%/s);
  assert.match(boardCss, /\.world-art img\s*\{[^}]*object-fit:\s*contain/s);
});
