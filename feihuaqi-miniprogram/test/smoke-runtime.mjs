// 装配层自检：直接跑小程序 utils/engine-runtime.js 这条真实链路。
//
// 与前一份 smoke-run 的区别：那份直接拼装 Game，这份走页面实际会调用的
// listSchools / startGame / playTurn / project / projectSummary，
// 验证的是马上要进包的同一批文件。
//
// 用法：node test/smoke-runtime.mjs

import { stage } from './_stage.mjs';

const loader = await stage();
const runtime = await loader.load('utils/engine-runtime.js');
console.log('装配层加载成功\n');

const schools = runtime.listSchools();
console.log(`流派 ${schools.length} 个：${schools.map((s) => s.name).join(' / ')}`);
if (!schools.length) {
  console.error('没有流派，配置可能未同步');
  process.exit(1);
}

let battles = 0;
let toasts = 0;
let summary = null;
const sink = (evt) => {
  if (evt.type === 'request' && evt.key === 'battle') battles++;
  else if (evt.type === 'toast') toasts++;
  else if (evt.type === 'result') summary = evt.summary;
};

const { game } = runtime.startGame({
  schoolId: schools[0].id,
  playerName: '小程序试笔',
  sink,
});

const vm0 = runtime.project(game);
console.log('\n开局视图模型：');
console.log(`  流派=${vm0.schoolName}  灵感=${vm0.inspiration}/${vm0.inspirationMax}  回合=${vm0.turn}`);
console.log(`  六维=${vm0.attrRows.map((r) => `${r.name}${r.value}`).join(' ')}`);
console.log(`  落点=${vm0.cellName}(${vm0.cellType})`);

let guard = 0;
while (guard < 400) {
  const running = await runtime.playTurn(game);
  guard++;
  if (!running) break;
}

const vmEnd = runtime.project(game);
console.log('\n终局视图模型：');
console.log(`  回合=${vmEnd.turn}  阶段=${vmEnd.phase}  over=${vmEnd.over}  endReason=${vmEnd.endReason}`);
console.log(`  战绩=胜${vmEnd.battle.win} 平${vmEnd.battle.draw} 负${vmEnd.battle.loss}`);
console.log(`  日志末条=${vmEnd.logRows.length ? vmEnd.logRows[vmEnd.logRows.length - 1].text : '(空)'}`);

const px = runtime.projectSummary(summary);
console.log('\n结算投影：');
console.log(`  总分=${px ? px.total : '(无)'}  结局=${px ? px.reasonText : '(无)'}  段位=${px && px.grade ? px.grade.name : '(无)'}`);

const ok = !!(px && px.total > 0 && vmEnd.over);
console.log(`\n论战=${battles} 提示=${toasts} —— ${ok ? '第一周闭环通过。' : '闭环未完成，需排查。'}`);
if (!ok) process.exit(1);
