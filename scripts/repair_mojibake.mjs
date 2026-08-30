// 修复 feihua-content.json 中的乱码（U+FFFD）：保留本地完整结构，仅替换损坏的字符串。
// 干净值来源优先级：① main 版（线上最新、0 乱码，但缺 sky/schools/grades/narrative 等块）
//                   ② feihuaqi-playable/config/*.json（全部 0 乱码）
// 数组按 id / name 对齐，对象按键对齐；只替换「本地含 U+FFFD 而候选干净」的字符串。
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = 'C:/Users/77522/WorkBuddy/2026-08-01-00-57-25/';
const D = ROOT + '_merge_diff/';
const BAD = /�/;

const local = JSON.parse(readFileSync(ROOT + 'feihua-content.json', 'utf8'));
const main = JSON.parse(readFileSync(D + 'main__feihua-content.json', 'utf8'));

const cfgCache = new Map();
const cfg = (name) => {
  if (!cfgCache.has(name)) {
    try { cfgCache.set(name, JSON.parse(readFileSync(ROOT + 'feihuaqi-playable/config/' + name + '.json', 'utf8'))); }
    catch (e) { cfgCache.set(name, undefined); }
  }
  return cfgCache.get(name);
};

const isObj = (v) => v && typeof v === 'object';
const keyOf = (v) => (isObj(v) && !Array.isArray(v) ? (v.id ?? v.name ?? v.key) : undefined);

let fixed = 0, unresolved = [];
const samples = [];

function pick(localVal, cands) {
  if (typeof localVal !== 'string' || !BAD.test(localVal)) return localVal;
  for (const c of cands) {
    if (typeof c === 'string' && !BAD.test(c) && c.length > 0) {
      fixed++;
      if (samples.length < 8) samples.push(`${localVal.slice(0, 28)}  ->  ${c.slice(0, 28)}`);
      return c;
    }
  }
  unresolved.push(localVal.slice(0, 60));
  return localVal;
}

function repair(node, mNode, cNode, path) {
  if (typeof node === 'string') {
    return pick(node, [mNode, cNode]);
  }
  if (Array.isArray(node)) {
    const mArr = Array.isArray(mNode) ? mNode : [];
    const cArr = Array.isArray(cNode) ? cNode : [];
    return node.map((item, i) => {
      const k = keyOf(item);
      let m2 = mArr[i], c2 = cArr[i];
      if (k !== undefined) {
        const mHit = mArr.find((x) => keyOf(x) === k);
        const cHit = cArr.find((x) => keyOf(x) === k);
        if (mHit !== undefined) m2 = mHit;
        if (cHit !== undefined) c2 = cHit;
      }
      return repair(item, m2, c2, path + '[' + (k ?? i) + ']');
    });
  }
  if (isObj(node)) {
    const out = {};
    for (const k of Object.keys(node)) {
      out[k] = repair(node[k], isObj(mNode) ? mNode[k] : undefined, isObj(cNode) ? cNode[k] : undefined, path + '.' + k);
    }
    return out;
  }
  return node;
}

// 顶层逐块修复：main 对应块 + config 对应块 作为候选源
const out = { ...local };
for (const k of Object.keys(local)) {
  if (k.startsWith('_')) continue;
  if (typeof local[k] === 'string') { out[k] = pick(local[k], [main[k], cfg(k)]); continue; }
  out[k] = repair(local[k], main[k], cfg(k), k);
}

// 递增 _version，确保云端合并时新内容胜出
out._version = (Number(local._version) || 1) + 1;

writeFileSync(ROOT + 'feihua-content.json', JSON.stringify(out, null, 2) + '\n', 'utf8');

const after = readFileSync(ROOT + 'feihua-content.json', 'utf8');
console.log('修复字符串数:', fixed);
console.log('剩余 U+FFFD:', (after.match(/�/g) || []).length);
console.log('_version:', local._version, '->', out._version);
console.log('\n示例替换:');
samples.forEach((s) => console.log('  ' + s));
if (unresolved.length) {
  console.log('\n未能找到干净来源的字符串 (' + unresolved.length + ' 条):');
  [...new Set(unresolved)].slice(0, 10).forEach((s) => console.log('  ! ' + s));
}
