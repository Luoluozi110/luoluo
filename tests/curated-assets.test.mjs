import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDir, '../assets/curated-library');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const allAssets = [...manifest.icons, ...manifest.audio];

assert.equal(manifest.icons.length, manifest.counts.icons, '图标计数应与清单摘要一致');

const productionAudio = manifest.audio.filter(
  asset => asset.status !== 'review-only-replace-with-original-wav'
);
assert.equal(
  productionAudio.length,
  manifest.counts.productionAudioCandidates,
  '生产音效候选计数应与清单摘要一致'
);
assert.equal(
  manifest.audio.length - productionAudio.length,
  manifest.counts.reviewOnlyAudio,
  '试听参考计数应与清单摘要一致'
);

const files = allAssets.map(asset => asset.file);
assert.equal(new Set(files).size, files.length, '清单不应包含重复路径');

for (const asset of allAssets) {
  const absolutePath = path.join(root, asset.file);
  assert.ok(fs.existsSync(absolutePath), `清单文件不存在：${asset.file}`);
  assert.ok(fs.statSync(absolutePath).size > 0, `素材文件为空：${asset.file}`);
}

for (const asset of manifest.icons.filter(asset => asset.file.endsWith('.svg'))) {
  const svg = fs.readFileSync(path.join(root, asset.file), 'utf8');
  assert.ok(!svg.includes('M0 0h512v512H0z'), `SVG 黑色底板未移除：${asset.file}`);
  assert.ok(svg.includes('#432C24'), `SVG 未改为项目墨色：${asset.file}`);
}

const preview = fs.readFileSync(path.join(root, 'preview.html'), 'utf8');
const scripts = [...preview.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length > 0, '预览页应包含渲染脚本');
new Function(scripts.at(-1)[1]);

console.log(JSON.stringify({
  icons: manifest.icons.length,
  productionAudio: productionAudio.length,
  reviewAudio: manifest.audio.length - productionAudio.length,
  previewScript: 'syntax-ok'
}));
