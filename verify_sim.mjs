// 独立复验：用项目自带的模拟库跑三档画像各 300 局
import { buildCfg, runProfile, PROFILES, GRADE_ORDER, fmt } from './extracted/flyhua/feihuaqi/tools/sim_lib.mjs';
import { Game } from './extracted/flyhua/feihuaqi/js/engine/game.js';

const cfg = buildCfg();
for (const P of PROFILES) {
  const r = await runProfile(Game, cfg, P, 300, 7000);
  console.log(`\n=== ${r.name} (N=${r.N}, 崩溃=${r.crash}) ===`);
  console.log(`封笔 ${fmt(r.fengbi)}% (目标 ${P.tFengbi}) | 中位 ${r.median} (目标 ${P.tMid}) | sd ${fmt(r.sd, 0)} | 回合 ${fmt(r.turns)}`);
  console.log(`榜眼 ${fmt(r.gradePct['榜眼'])}% | 殿试/回合上限结局: ${fmt(r.palace)}% / ${fmt(r.turnlimit)}%`);
  const dist = GRADE_ORDER.map(k => `${k}${fmt(r.gradePct[k], 0)}`).join(' ');
  console.log('分布:', dist);
}
