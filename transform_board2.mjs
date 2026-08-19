// 重构棋盘：删除支线路线，把支线路口改为名胜格，并增加天象格。
// 主环路格子总数保持 80 不变。
import fs from 'fs';

const P = 'feihuaqi-playable/config/board.json';
const raw = JSON.parse(fs.readFileSync(P, 'utf8'));

// 1) 原支线路口(branch_gate) → 名胜格 mingjing，沿用各支线名胜名
const GATE_TO_SCENIC = {
  12: '桃花源',
  27: '白鹿洞',
  42: '御花园',
  70: '玉门关'
};

// 2) 将若干普通平韵格(ping) 改为天象格(sky)，增加天象数量（主环总数不变）
const PING_TO_SKY = {
  6:  '星矅崖',
  18: '云津渡',
  34: '月华津',
  52: '风露台',
  76: '霄汉亭'
};

const mainRing = raw.mainRing.map(c => {
  const id = c.id;
  if (GATE_TO_SCENIC[id]) {
    return { id, type: 'mingjing', name: GATE_TO_SCENIC[id] };
  }
  if (PING_TO_SKY[id]) {
    return { id, type: 'sky', name: PING_TO_SKY[id] };
  }
  return c;
});

// 3) 删除支线相关字段
delete raw.branchGates;
delete raw.branches;
delete raw.branchCells;
delete raw.branchReturnAdvance;
raw.mainRing = mainRing;

fs.writeFileSync(P, JSON.stringify(raw, null, 2) + '\n');

// 自检
const types = {};
for (const c of mainRing) types[c.type] = (types[c.type] || 0) + 1;
console.log('主环路格子总数:', mainRing.length);
console.log('类型分布:', JSON.stringify(types, null, 0));
console.log('名胜格:', mainRing.filter(c => c.type === 'mingjing').map(c => c.id + ':' + c.name).join('  '));
console.log('天象格:', mainRing.filter(c => c.type === 'sky').map(c => c.id + ':' + c.name).join('  '));
console.log('已删除支线字段:', !raw.branches && !raw.branchCells && !raw.branchGates && !('branchReturnAdvance' in raw));
