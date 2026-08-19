import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import '../feihuaqi-playable/js/engine/config-contract.js';

const root = resolve('feihuaqi-playable/config');
const arrayOptional = new Set(['album', 'synergies']);
const keys = [
  ...globalThis.FeihuaConfigContract.REQUIRED_CONFIG_KEYS,
  'album', 'synergies', 'npc-mechanics', 'talent-upgrade', 'narrative'
];
const config = {};

for (const key of keys) {
  try {
    const raw = await readFile(resolve(root, `${key}.json`), 'utf8');
    config[key] = JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    if (globalThis.FeihuaConfigContract.REQUIRED_CONFIG_KEYS.includes(key)) {
      console.error(`${key}: 无法读取或解析（${error.message}）`);
      process.exitCode = 1;
    } else config[key] = arrayOptional.has(key) ? [] : {};
  }
}

if (!process.exitCode) {
  const result = globalThis.FeihuaConfigContract.validateConfig(config);
  for (const issue of result.errors) console.error(`错误 ${issue.path}: ${issue.message}`);
  for (const issue of result.warnings) console.warn(`警告 ${issue.path}: ${issue.message}`);
  if (!result.ok) process.exitCode = 1;
  else console.log(`配置契约校验通过：${keys.length} 个配置块，0 个错误，${result.warnings.length} 个警告`);
}
