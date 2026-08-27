import fs from 'fs';
import path from 'path';
import { applyProjectOverride } from '../js/engine/config.js';

// 契约落地后 applyProjectOverride 会对合并结果做完整 assertConfig，
// 最小化 fixture 会因缺少必需配置块被拒。这里以真实 config 为基底，仅覆盖棋盘，
// 与运行时「云端工程合并」的实际路径一致，覆盖语义断言保持不变。
const CFG_DIR = path.join(process.cwd(), 'config');
function load(n) {
  try { return JSON.parse(fs.readFileSync(path.join(CFG_DIR, n + '.json'), 'utf8')); }
  catch (e) { return n === 'talent-upgrade' ? {} : []; }
}
const base = {};
for (const n of ['attrs', 'inspiration', 'board', 'questions', 'events', 'talents', 'schools', 'affinity', 'npcs', 'sky', 'grades', 'album', 'talent-upgrade', 'synergies']) {
  base[n] = load(n);
}
base.questions = (base.questions || []).filter(q => q.enabled !== false);
base.events = (base.events || []).filter(e => e.enabled !== false);
base.affinity.themeNames = base.affinity.themeNames || {};
base.affinity.mannerNames = base.affinity.mannerNames || {};
base.affinity.matrix = base.affinity.matrix || {};
base.talentUpgradeById = new Map(Object.entries(base['talent-upgrade'] || {}));
const savedHidden = base.board.hiddenFinalRing;

const project = {
  board: {
    laps: 3,
    sides: [{ id: 'xiangshi', name: '乡试新路', range: [0, 19], season: 'spring' }],
    mainRing: [
      { id: 0, type: 'start', name: '童生铺', icon: 'sky', effect: { inspiration: 2, talent: 'T001' } },
      { id: 1, type: 'ping', name: '蒙学巷', effect: { attrs: { shi: 3 } } },
      { id: 2, type: 'quiz', name: '新格' }
    ]
  }
};

const next = applyProjectOverride(base, project);
const ring = next.board.mainRing;
console.assert(next.board.laps === 3, 'laps override');
console.assert(ring[0].icon === 'sky', 'icon preserved');
console.assert(ring[0].effect.inspiration === 2, 'effect inspiration');
console.assert(ring[0].effect.talent === 'T001', 'effect talent');
console.assert(ring[1].effect.attrs.shi === 3, 'effect attr');
console.assert(ring.find(c => c.id === 2).name === '新格', 'new cell');
console.assert(next.board.cellById.get(0).icon === 'sky', 'normalize keeps icon');
console.assert(next.board.cellById.get(1).effect.attrs.shi === 3, 'normalize keeps effect');
console.assert(savedHidden && next.board.hiddenFinalRing && next.board.hiddenFinalRing.id === savedHidden.id,
  '旧工程未携带时保留本地隐藏终圈');
console.log('board override tests passed');
