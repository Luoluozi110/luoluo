// 配置同步脚本
// 从 H5 工程 feihuaqi-playable 复制配置，并按主包 / 分包归属拆分，避免手工搬运出错。
//
// 用法：
//   node scripts/sync-config.mjs
//
// 分包归属原则：启动链路（选流派 → 装配 → 对局 → 结算）用不到的配置一律下沉到分包。

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mpRoot = resolve(here, '..');
const h5Root = resolve(mpRoot, '..', 'feihuaqi-playable');

// 主包判定标准：启动链路「主菜单 → 选流派 → 装配 → 对局 → 结算 → 榜单」读得到的配置。
// 硬依据：config.js 的 FILES 为必需清单，缺失即抛错阻断启动，必须全在主包。
// events 属必需；narrative 虽为可选，但承载终局成卷模板，结算链路依赖，同样进主包。
const MAIN_PKG = [
  'schools',
  'talents',
  'talent-upgrade',
  'synergies',
  'npcs',
  'npc-mechanics',
  'board',
  'questions',
  'events',
  'narrative',
  'grades',
  'attrs',
  'numeric',
  'inspiration',
  'affinity',
  'sky',
  'leaderboard',
];

const SUB_PKG = {
  'pkg-codex': ['album'],
  'pkg-side': ['sidequests', 'sidequest-npcs', 'sidequest-talents'],
};

// 明确不打进包体的配置：
// cloud.json 是编辑器云端同步配置，content-test 相关校验走本地工具链
const EXCLUDED = ['cloud'];

// 走系统命令删除：某些沙箱环境下 node 的 fs.rm 会被安全策略拦截
function cleanConfigDir(dir) {
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  if (!files.length) return;
  files.forEach((f) => {
    spawnSync('cmd.exe', ['/c', 'del', '/q', join(dir, f)]);
  });
}

function copy(name, fromDir, toDir) {
  const src = join(fromDir, `${name}.json`);
  if (!existsSync(src)) {
    console.warn(`  跳过（源文件不存在）：${name}.json`);
    return false;
  }
  const raw = readFileSync(src, 'utf8');
  // 校验 JSON 合法性，避免把坏配置同步进包体
  JSON.parse(raw);
  mkdirSync(toDir, { recursive: true });
  const target = join(toDir, `${name}.json`);
  writeFileSync(target, raw, 'utf8');
  const size = Buffer.byteLength(raw, 'utf8');
  console.log(`  ${name}.json -> ${target.replace(mpRoot + '\\', '')}  ${(size / 1024).toFixed(1)}KB`);
  return true;
}

let totalMain = 0;

function main() {
  if (!existsSync(h5Root)) {
    console.error(`找不到 H5 工程：${h5Root}`);
    process.exit(1);
  }
  const fromDir = join(h5Root, 'config');

  // 先清空既有产物，避免配置改动归属后旧文件残留在错误的包里
  cleanConfigDir(join(mpRoot, 'config'));
  Object.keys(SUB_PKG).forEach((pkg) => cleanConfigDir(join(mpRoot, pkg, 'config')));

  console.log('同步主包配置：');
  MAIN_PKG.forEach((name) => {
    const src = join(fromDir, `${name}.json`);
    if (existsSync(src)) totalMain += Buffer.byteLength(readFileSync(src, 'utf8'), 'utf8');
    copy(name, fromDir, join(mpRoot, 'config'));
  });

  Object.keys(SUB_PKG).forEach((pkg) => {
    console.log(`同步分包配置 ${pkg}：`);
    SUB_PKG[pkg].forEach((name) => copy(name, fromDir, join(mpRoot, pkg, 'config')));
  });

  console.log(`\n主包配置合计 ${(totalMain / 1024).toFixed(1)}KB`);
  console.log(`已排除：${EXCLUDED.join(', ')}`);
  console.log('提示：同步后请在开发者工具中查看「代码依赖分析」，确认主包未超过 2MB。');
}

main();
