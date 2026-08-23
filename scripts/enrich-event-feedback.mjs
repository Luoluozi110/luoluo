#!/usr/bin/env node
/** 补齐奇遇结算回声，并同步生成编辑器默认种子。脚本幂等，可作为内容完整性审计重复执行。 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const eventPath = path.join(root, 'feihuaqi-playable', 'config', 'events.json');
const seedPath = path.join(root, 'feihua-editors', 'assets', 'js', 'seed-events.js');

const direct = {
  E001: '晨光透进驿窗时，梦中花影已经散去，笔尖却仍像含着一瓣春色。你试写数行，字句竟自行舒展开来。',
  E002: '抄书人从门前排到巷口，你昨日还压在箱底的旧稿，今日已在满城人的案头翻响。纸价涨了，署名也再藏不住。',
  E004: '老者长揖而去，留下一句「谪仙」在风里。你低头再看近作，墨色未变，胸中那点自疑却轻了许多。',
  E008: '铁杵仍在石上来回，细屑一点点落入溪水。你回到案前，把搁置已久的篇章重新从第一字磨起。',
  E009: '墙缝里那线灯光窄得只够照亮半页。鸡鸣时你合上书，眼睛酸涩，昨夜不懂的章句却已在心中接成一片。',
  E010: '丝竹声里，小令被一席席传下去。待纸页回到手中，角上已沾了酒痕，也多了几处旁人写下的称赏。',
  E016: '十日将尽，你把抄本归还藏楼。指节的薄茧尚未褪去，那函书却已不再属于邻家，而是留在了你的记忆里。',
  E017: '柳枝系上行舟，转眼只剩江面一点青色。你把没有说出口的话收进词尾，最后一韵随水送得很远。',
  E020: '下联落定，山风恰从石面掠过。淡去的旧墨与新字一明一暗，像隔着年月互相应了一声。',
  E021: '最后一页抄完时，砚中薄冰已化又结。你搓热僵硬的手指，闭眼仍能从头背出那一段文义。',
  E022: '孩子们拖长声音，把「雪对风」一路背出巷口。你听着错落童声，才发现熟极的联语也能重新变得鲜活。',
  E023: '钟声越过水面，一记比一记远。待余音完全沉入夜色，胸中原本纠缠的念头也终于各自落定。',
  E026: '妇人的话随着桑叶沙响留在身后。你重新上路，行囊没有变重，脚步却比歇脚前更不敢虚掷。',
  E027: '道人收起最后一枚棋子，只笑你输在急处。下山未半，那篇策论的开头忽然在步伐间一层层展开。',
  E028: '你没有折菊，也没有急着成诗，只带回衣袖上的淡香。铺纸之后，南山自然而然走进了第一句。',
  E033: '旧友把赠言折好收入怀中，许久才拱手作别。车轮渐远时，你明白几句真话确实比满箱礼物更能随人上路。',
  E034: '灯下比勘到三更，残碑上的断句终于与古籍严丝合缝。失落多年的半篇旧文，从十几个苔痕字里重新有了来处。',
  E036: '两位老者挑担远去，仍在争论前朝旧事。江风吹过，你忽觉功名也只是他们闲话里翻过的一页。',
  E037: '秋声穿过庭树，时疏时密，仿佛一阕没有题名的长调。你熄灯静听，直到第一片落叶擦过窗纸。',
  E038: '第三十个「永」字收笔，砚面还泛着油亮墨光。横竖点画各归其位，你腕下的迟涩也被新砚一点点磨开。',
  E039: '笛声转过最后一个折柳调，邻院重新安静。你没有推窗，只在暗处把忽然涌来的故园写进词中。',
  E040: '月上东山时，你荷锄随众人归来。腰背虽酸，粗饭入口却格外香甜，半日尘土也把胸中浮躁压实了。'
};

const challenge = {
  E003: {
    winText: '第三只酒觞沿曲水停在面前，你提笔便成。满座将三首连读一遍，随后有人郑重为你在兰亭诗卷上留出一席。',
    failText: '酒觞又停在面前时，你的句子终于慢了半拍。罚酒入喉，满座笑声并无恶意；你记住了那一处未能接上的韵。'
  },
  E005: {
    winText: '三场诗酒皆尽，你伏案写完最后一篇，抬头才发现酒肆已经挤满听客。狂客们拍案大笑，替你又温了一壶。',
    failText: '诗意终究没能追上杯数。你枕着未干的诗稿醒来，三位狂客早已散去，桌上只留一行待续的残句。'
  },
  E011: {
    winText: '两联应声而成，你提笔在雁塔壁上写下姓名。墨迹尚新，塔外长安已经在暮色里一盏盏亮起。',
    failText: '第二联终究差了一字。你没有在壁上强留姓名，只把空处的尺寸记下，约定来日再带一副完整联语回来。'
  },
  E029: {
    winText: '下联一出，围观者齐声称好。掌柜将药与酒一并递来，连门前招牌都像因这一对声律端正了几分。',
    failText: '人群里很快有人接出更妥的下联。你让开门前位置，捧着自己的草稿又看一遍，终于找出声律绊住的地方。'
  },
  E031: {
    winText: '限韵诗成，席间有人将那张只署「客」字的花笺推回给你。此番落款多了一行：愿与君再会。',
    failText: '更漏将尽，你的末韵仍未稳妥。主人没有催促，只替你添了一盏茶；那张花笺最终夹进了未完的诗稿。'
  },
  E041: {
    winText: '送别之作读罢，客舍中一时无人举杯。窗外新柳沾雨，你替满座把那句最难说的珍重写了出来。',
    failText: '同席佳作珠玉在前，你的篇章未能夺席。临散时却有人抄走其中一句，说它恰像自己未出口的离情。'
  }
};

const events = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
if (!Array.isArray(events)) throw new Error('events.json 根必须是数组');

for (const event of events) {
  if (event.kind === 'direct') event.resultText = direct[event.id] || event.resultText || '';
  if (event.kind === 'challenge') Object.assign(event.challenge || (event.challenge = {}), challenge[event.id] || {});
}

const missing = [];
for (const event of events) {
  if (event.kind === 'direct' && !String(event.resultText || '').trim()) missing.push(`${event.id}.resultText`);
  if (event.kind === 'choice') (event.choices || []).forEach((choice, i) => {
    if (!String(choice.resultText || '').trim()) missing.push(`${event.id}.choices[${i}].resultText`);
  });
  if (event.kind === 'challenge') {
    if (!String(event.challenge?.winText || '').trim()) missing.push(`${event.id}.challenge.winText`);
    if (!String(event.challenge?.failText || '').trim()) missing.push(`${event.id}.challenge.failText`);
  }
}
if (missing.length) throw new Error(`仍有奇遇回声缺失：${missing.join('、')}`);

fs.writeFileSync(eventPath, `${JSON.stringify(events, null, 2)}\n`, 'utf8');
const header = '/* 飞花棋游戏原始奇遇（config/events.json）。作为编辑器默认种子数据。请勿手工改动 —— 在编辑器内管理后导出即可覆盖。 */\n';
fs.writeFileSync(seedPath, `${header}window.GAME_EVENTS = ${JSON.stringify(events, null, 2)};\n`, 'utf8');
console.log(`已补齐 ${Object.keys(direct).length} 条直接回声、${Object.keys(challenge).length * 2} 条挑战回声，并同步编辑器种子。`);
