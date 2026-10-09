// 配置自检：确认引擎实际读到的配置条目，避免「配置在包里但引擎读到空」这类静默故障。
//
// 背景：album 与 sidequests 曾被误放置于分包，主包 embed-config 里分别是空数组与缺失键，
// 表现为「支线按钮点不动、图鉴永远空」，但代码本身不报错。此脚本专门守住这类问题。
//
// 用法：node test/check-config.mjs

import { stage } from './_stage.mjs';

const loader = await stage();
const runtime = await loader.load('utils/engine-runtime.js');
const cfg = runtime.buildConfig();

const pick = (path, fn) => {
  const parts = path.split('.');
  let cur = cfg;
  for (const p of parts) {
    if (cur == null) return 0;
    cur = cur[p];
  }
  return fn ? fn(cur) : cur;
};

const rows = [
  ['流派 schools', pick('schools', (v) => v.length)],
  ['题库 questions', pick('questions', (v) => v.length)],
  ['奇遇 events', pick('events', (v) => v.length)],
  ['文心 talents', pick('talents', (v) => v.length)],
  ['羁绊 synergies', pick('synergies', (v) => v.length)],
  ['图鉴 album', pick('album', (v) => v.length)],
  ['支线 sidequests.routes', pick('sidequests.routes', (v) => v.length)],
  ['支线 NPC', pick('sidequest-npcs.routes', (v) => Object.keys(v).length)],
  ['支线文心', pick('sidequest-talents.talents', (v) => v.length)],
  ['开局句库 narrative.endScroll', pick('narrative.endScroll', (v) => Object.keys(v).length)],
  ['段位 grades', pick('grades', (v) => (Array.isArray(v) ? v.length : Object.keys(v).length))],
  ['NPC 档位', pick('npcs', (v) => v.length)],
];

console.log('引擎读到的配置：');
rows.forEach(([name, n]) => {
  const bad = !n ? '  ← 空！' : '';
  console.log(`  ${name.padEnd(28, ' ')} ${String(n).padStart(5)}${bad}`);
});

// 关键项：这些一旦为空，对应玩法会静默失效
const CRITICAL = [
  ['album', rows[5][1]],
  ['sidequests.routes', rows[6][1]],
];

const failures = CRITICAL.filter(([, n]) => !n);
if (failures.length) {
  console.error('\n以下关键配置为空，对应玩法会静默失效：');
  failures.forEach(([name]) => console.error('  ' + name));
  process.exit(1);
}

console.log('\n配置自检通过：图鉴与支线均已进入主包。');
