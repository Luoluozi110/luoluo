// 引擎搬运脚本
// 把 H5 工程的纯逻辑引擎搬进小程序，保持 ES Module 语法不变。
//
// 只做三件事：
//  1. 剥离 import 路径上的 ?v=xxx 缓存戳 —— 那是浏览器破缓存用的，小程序路径不支持。
//  2. 排除 content-test.js —— 内容自检工具，属于本地工具链，不进包体。
//  3. 把主包配置编译成 engine/embed-config.js —— 避免 require(JSON) 与 import 混用。
//
// 用法：node scripts/build-engine.mjs
// 注意：本脚本对同一份源多次运行是幂等的。

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mpRoot = resolve(here, '..');
const h5Root = resolve(mpRoot, '..', 'feihuaqi-playable');
const srcEngine = join(h5Root, 'js', 'engine');
const outEngine = join(mpRoot, 'engine');

// content-test 是内容作者自检工具；config-contract 虽只用于校验，
// 但 config.js 依赖其副作用安装 globalThis.FeihuaConfigContract，必须保留。
const EXCLUDE_FILES = ['content-test.js'];

function stripVersionQuery(code) {
  return code.replace(/(\.\.\.?\/|\.\/)?([A-Za-z0-9_.-]+)\.js\?v=[A-Za-z0-9_.-]+/g, (m, prefix, name) => {
    return `${prefix || './'}${name}.js`;
  });
}

function copyEngine() {
  if (!existsSync(srcEngine)) {
    console.error(`找不到引擎源目录：${srcEngine}`);
    process.exit(1);
  }
  mkdirSync(outEngine, { recursive: true });
  let count = 0;
  let stripped = 0;
  for (const name of readdirSync(srcEngine)) {
    if (!name.endsWith('.js') || EXCLUDE_FILES.includes(name)) continue;
    const code = readFileSync(join(srcEngine, name), 'utf8');
    const next = stripVersionQuery(code);
    if (next !== code) stripped++;
    writeFileSync(join(outEngine, name), next, 'utf8');
    count++;
  }
  console.log(`引擎文件 ${count} 个 -> engine/（其中 ${stripped} 个含待剥离的缓存戳）`);
}

function buildEmbedConfig() {
  const cfgDir = join(mpRoot, 'config');
  if (!existsSync(cfgDir)) {
    console.error('缺少 config/，请先运行 scripts/sync-config.mjs');
    process.exit(1);
  }
  const bag = {};
  for (const name of readdirSync(cfgDir)) {
    if (!name.endsWith('.json')) continue;
    const key = name.replace(/\.json$/, '');
    bag[key] = JSON.parse(readFileSync(join(cfgDir, name), 'utf8'));
  }
  // album 在 pkg-codex 分包，主包先给空数组占位，进入图鉴时再合并。
  if (!bag.album) bag.album = [];

  const banner =
    '// 自动生成，请勿手改。\n' +
    '// 来源：feihuaqi-playable/config/*.json，经 scripts/sync-config.mjs 按包体拆分，\n' +
    '// 再由 scripts/build-engine.mjs 编译为 ES Module。\n' +
    '// 重新生成：node scripts/sync-config.mjs && node scripts/build-engine.mjs\n\n';
  const body = `export const RAW_CONFIG = ${JSON.stringify(bag)};\n\nexport default RAW_CONFIG;\n`;
  writeFileSync(join(outEngine, 'embed-config.js'), banner + body, 'utf8');

  const kb = Buffer.byteLength(body, 'utf8') / 1024;
  console.log(`配置已编译 engine/embed-config.js（${Object.keys(bag).length} 个键，${kb.toFixed(1)}KB）`);
}

console.log('搬运引擎与配置：');
copyEngine();
buildEmbedConfig();
console.log('完成。');
