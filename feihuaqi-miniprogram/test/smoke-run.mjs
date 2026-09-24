// 无头自检：在 Node 里直接加载小程序工程内的引擎与 UI 适配器，跑完整一局。
//
// 这是第一周闭环的验收手段 —— 不必等真机，先用命令行确认
// 「选流派 → 开局 → 逐回合推进 → 结算」这条链路真的能走完。
//
// 用法：node test/smoke-run.mjs [runs]

import { stage } from './_stage.mjs';

// staging 逻辑统一由 _stage.mjs 提供，避免两套镜像实现各写一份。
const loader = await stage();
const loadModule = (rel) => loader.load(rel);

async function runOnce(mods, opts) {
  const { Game } = mods.game;
  const { normalizeConfig } = mods.config;
  const { RAW_CONFIG } = mods.embed;
  const { createUiAdapter } = mods.adapter;

  // normalizeConfig 会就地补派生结构，每次都要给干净副本，避免跨局污染
  const cfg = normalizeConfig(JSON.parse(JSON.stringify(RAW_CONFIG)));

  const school = (cfg.schools || [])[opts.schoolIndex] || { id: null, name: '未知流派' };
  if (!school.id) throw new Error('配置缺少流派，无法开局');

  const stats = { battles: 0, quizzes: 0, toasts: 0, states: 0, turns: 0, endReason: '', total: 0 };
  let summary = null;

  // 本脚本的 sink 不返回 true，即全部走适配器的自动应答兜底，
  // 因此它验的是「一个界面都没接时」链路是否仍能走完一局。
  const ui = createUiAdapter({
    sink(evt) {
      if (evt.type === 'request') {
        if (evt.key === 'battle') stats.battles++;
        else if (evt.key === 'quiz') stats.quizzes++;
      } else if (evt.type === 'toast') stats.toasts++;
      else if (evt.type === 'state') stats.states++;
      else if (evt.type === 'result') summary = evt.summary;
    },
  });

  const game = new Game(cfg, ui, opts.rand || Math.random);
  game.start(school.id, { loadout: [], name: opts.name || '试笔' });

  let guard = 0;
  const MAX_TURNS = 400; // 引擎自带 TURN_LIMIT=84，这里留足冗余防止异常死循环
  while (game.s && !game.s.over && guard < MAX_TURNS) {
    await game.playTurn();
    guard++;
  }
  stats.turns = guard;
  stats.endReason = (summary && summary.reason) || '(未结算)';
  stats.total = (summary && summary.total) || 0;
  stats.schoolName = school.name;
  stats.summary = summary;
  return stats;
}

async function main() {
  const runs = Number(process.argv[2] || 3);

  const mods = {
    game: await loadModule('engine/game.js'),
    config: await loadModule('engine/config.js'),
    embed: await loadModule('engine/embed-config.js'),
    adapter: await loadModule('utils/ui-adapter.js'),
  };
  console.log('模块加载成功\n');

  let ok = 0;
  for (let i = 0; i < runs; i++) {
    try {
      const r = await runOnce(mods, { schoolIndex: i % 3, name: `试笔${i + 1}` });
      if (r.summary) ok++;
      console.log(
        `第 ${i + 1} 局：流派=${r.schoolName}  回合=${r.turns}  论战=${r.battles}  答题=${r.quizzes}  ` +
          `结局=${r.endReason}  总分=${r.total}`
      );
    } catch (err) {
      console.error(`第 ${i + 1} 局失败：`, err && err.stack ? err.stack.split('\n').slice(0, 6).join('\n') : err);
    }
  }

  console.log(`\n${ok}/${runs} 局走完结算。${ok === runs ? '闭环通过。' : '存在未结算的对局，需排查。'}`);
  if (ok !== runs) process.exit(1);
}

main().catch((err) => {
  console.error('自检失败：', err);
  process.exit(1);
});
