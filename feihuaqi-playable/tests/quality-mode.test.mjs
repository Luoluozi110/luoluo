import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { BUDGETS } from '../js/ui/quality.js';
import { mapTextureProfile } from '../js/ui/board.js';

const boardSource = await readFile(new URL('../js/ui/board.js', import.meta.url), 'utf8');
const boardCss = await readFile(new URL('../css/board.css', import.meta.url), 'utf8');

test('省电档预算明确降低动态特效与画布精度', () => {
  assert.equal(BUDGETS.high.mapTexture, 'full');
  assert.equal(BUDGETS.low.mapTexture, 'lite');
  assert.ok(BUDGETS.low.petals < BUDGETS.high.petals, '省电档花瓣更少');
  assert.equal(BUDGETS.low.ambientNoise, false, '省电档关闭全屏噪点');
  assert.equal(BUDGETS.low.blur, false, '省电档关闭遮罩模糊');
  assert.equal(BUDGETS.low.precision, 'low', '省电档锁定 1x 画布精度');
});

test('省电档地图中心图固定 640px 贴图，并可运行时切回高档', () => {
  const lite = mapTextureProfile('low');
  const full = mapTextureProfile('high');
  assert.equal(lite.tier, 'lite');
  assert.match(lite.srcset, /peach-academy-island-v1-640\.webp 640w/);
  assert.doesNotMatch(lite.srcset, /peach-academy-island-v1\.webp 960w/);
  assert.equal(full.tier, 'full');
  assert.match(full.srcset, /640\.webp 640w/);
  assert.match(full.srcset, /\.webp 960w/);
  assert.match(boardSource, /this\.applyMapTexture\(\)/, '运行时切档会替换地图贴图');
  assert.match(boardSource, /data-texture-tier="\$\{mapTexture\.tier\}"/, '棋盘记录当前贴图档位');
  assert.match(boardCss, /html\[data-quality="low"\] \.world-art img\s+\{ filter: none/s, '省电档移除地图贴图滤镜');
});

console.log('quality-mode.test.mjs: 省电档特效预算与地图低清贴图通过');
