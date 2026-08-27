/* 为 12 张传世名篇的 24 条升级路线（branch）注入 desc 效果说明。
 * 同时更新两处镜像：
 *   - feihuaqi-playable/config/album.json
 *   - feihua-editors/assets/js/seed-album.js (window.GAME_ALBUM)
 * 校验：JSON 合法、24 条 branch 全覆盖、字段顺序 id/name/minLevel/desc/effects。
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ALBUM_JSON = path.join(root, 'feihuaqi-playable', 'config', 'album.json');
const SEED_JS = path.join(root, 'feihua-editors', 'assets', 'js', 'seed-album.js');

// 效果说明：键 = `${cardId}|${branchId}`
const DESC = {
  'A001|bold': '以诗立身，开局灵感与诗体战力层层拔高，越战越酣。',
  'A001|swift': '稿页与灵感随身，胜平皆有所获，落笔即成篇。',
  'A002|proofread': '开局心得，答题与平局皆增益，校书如琢玉。',
  'A002|teach': '增研修位，败中亦能求师，旁通百家之长。',
  'A003|saveInk': '守灵感上限，败局少损、残稿留痕，后手不断。',
  'A003|recover': '稿页与灵感回血，败中复得神思，平局成稿。',
  'A004|rank': '殿试专项强化，灵感上限与殿试得分、稿本齐飞。',
  'A004|streak': '筹策与连胜加成，殿试一路高歌，捷报传世。',
  'A005|mentor': '心得为主轴，授业答题皆进，阶段再加研修位。',
  'A005|garden': '稿本为主轴，胜平败皆有稿，佳作相传四方。',
  'A006|draft': '筹策开道，下笔成章，诗体技法与灵感速盈。',
  'A006|plot': '心得与平局蓄势，败中藏策，阶段谋篇增益。',
  'A007|travel': '稿页打底，奇遇入卷、触景生情，万里成法。',
  'A007|roam': '灵感上限与见闻并进，平局游兴、入景换境。',
  'A008|grind': '灵感上限护体，败中磨出心得稿页，再磨一寸。',
  'A008|focus': '研修位加成，日课不辍，功到自然成稿进阶。',
  'A009|polish': '稿页开道，词体加成、平局吟安，句眼成法。',
  'A009|cycle': '灵感与回环余韵，词体平胜皆悟，新调入卷。',
  'A010|parallel': '开局筹策，工对加成，联体平局与传承皆强。',
  'A010|echo': '心得起手，联体获胜平局皆得，广结文友研修。',
  'A011|copy': '稿页翻倍起手，传抄入市添灵感，名篇广传。',
  'A011|publish': '灵感上限大涨，刊行有酬、读者回响，新卷频出。',
  'A012|deep': '心得扎实起手，读书得气，平局与阶段皆入法。',
  'A012|wide': '研修位加成，群书旁通、触类旁通，学以成文。',
};

function withDesc(card) {
  const branches = (card.branches || []).map(b => {
    const key = `${card.id}|${b.id}`;
    const desc = DESC[key];
    if (desc == null) throw new Error(`缺少 ${key} 的 desc 说明`);
    // 重新排序字段：id / name / minLevel / desc / effects
    return {
      id: b.id,
      name: b.name,
      minLevel: b.minLevel,
      desc,
      effects: b.effects,
    };
  });
  return { ...card, branches };
}

// ---- config/album.json ----
const album = JSON.parse(fs.readFileSync(ALBUM_JSON, 'utf8'));
const albumOut = album.map(withDesc);
fs.writeFileSync(ALBUM_JSON, JSON.stringify(albumOut, null, 2) + '\n', 'utf8');
console.log(`album.json: ${albumOut.length} 张，共 ${albumOut.reduce((n, c) => n + c.branches.length, 0)} 条 branch 已注入 desc`);

// ---- seed-album.js (window.GAME_ALBUM = [...]) ----
const raw = fs.readFileSync(SEED_JS, 'utf8');
const m = raw.match(/window\.GAME_ALBUM\s*=\s*(\[[\s\S]*\])\s*;\s*$/);
if (!m) throw new Error('seed-album.js 结构无法识别');
const seed = new Function('return ' + m[1])();
const seedOut = seed.map(withDesc);
const body = JSON.stringify(seedOut, null, 2);
fs.writeFileSync(SEED_JS, `/* 传世名篇种子数据，与 feihuaqi-playable/config/album.json 对齐。 */\nwindow.GAME_ALBUM = ${body};\n`, 'utf8');
console.log(`seed-album.js: ${seedOut.length} 张，共 ${seedOut.reduce((n, c) => n + c.branches.length, 0)} 条 branch 已注入 desc`);

// ---- 校验：24 条全覆盖且非空 ----
let count = 0, empty = 0;
for (const c of albumOut) for (const b of c.branches) { count++; if (!b.desc || !b.desc.trim()) empty++; }
if (count !== 24) throw new Error(`branch 数量异常：${count}（应 24）`);
if (empty) throw new Error(`存在空 desc 的 branch：${empty} 条`);
console.log(`校验通过：24 条 branch 全部含非空 desc`);
