#!/usr/bin/env node
/** 在指定子项目目录执行 Node 测试，统一根入口同时兼容依赖 cwd 的历史测试。 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [suiteDir, ...patterns] = process.argv.slice(2);
if (!suiteDir || !patterns.length) {
  console.error('用法：node scripts/run-test-suite.mjs <suiteDir> <testPattern...>');
  process.exit(2);
}

const run = spawnSync(process.execPath, ['--test', ...patterns], {
  cwd: path.resolve(root, suiteDir),
  stdio: 'inherit'
});
if (run.error) throw run.error;
process.exit(run.status ?? 1);
