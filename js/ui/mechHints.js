/**
 * mechHints.js —— NPC 三机制的人类可读文案生成（阶段 B·交互反馈）。
 *
 * 职责：把引擎产出的机制数据（npc.mech、session.intentLocked、out.mech）翻译成
 * 贴合古风、可读、可解释的界面文案。**不触碰任何算分逻辑**，只做展示层翻译。
 *
 * 设计纪律：
 *  - 文案主体优先取自配置里已人工写好的字段（mech.signature.name / weakness.name /
 *    intent.description），保留作者原意，避免 UI 侧二次硬编码漂移；
 *  - 披露层级（disclosure）决定研判卡上能看到多少：'full' 明牌意图 / 'category'
 *    只给方向 / 未披露则仅给身份级提示；
 *  - 所有函数为无副作用纯函数，可直接被 Node 单元测试消费。
 */

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * 取一个 mech 对象里「主招牌」或「副招牌」的签名配置段。
 * 兼容两种书写：
 *   signature: { name, template, ... }                       扁平（仅主招牌）
 *   signature: { main: {...}, weak: {...}, ... }             主/副分离（如欧阳翰）
 */
export function signatureBlocks(mech) {
  const sig = (mech && mech.signature) || {};
  if (sig && sig.main) return { main: sig.main, weak: sig.weak || null, flat: sig };
  return { main: sig, weak: null, flat: sig };
}

/** 取主招牌的人类可读名（无则给通用称谓） */
export function signatureName(mech) {
  const { main, weak } = signatureBlocks(mech);
  if (main && main.name) return main.name;
  return '招牌';
}

export function weaknessName(mech) {
  const w = mech && mech.weakness;
  return (w && w.name) ? w.name : '破绽';
}

/** 意图模板 id 缺省名映射（rollIntention 未披露模板名时兜底） */
const INTENT_TEMPLATE_DISPLAY = {
  int_preferred_style: '偏好文体',
  int_manner_theme: '文风立意',
  int_steady: '稳守',
  int_dice_response: '伺机而动',
  int_copycat: '仿作',
  int_palace_adapt: '跨场适应'
};

export function intentTemplateName(template) {
  return INTENT_TEMPLATE_DISPLAY[template] || '打法';
}

/**
 * 研判卡文案。贴在战斗开场/遭遇阶段。
 * 尊重 intentLocked 的 styleDisclosed / mannerDisclosed：
 *  - styleDisclosed：能挑明「拟用某体」（教学型 / 立文体意图）
 *  - 仅 mannerDisclosed（文风立意型）：只给文风方向
 *  - 都未披露：只给身份级提示（该 NPC 技艺上有可被针对之处）
 * @param {object} npc    会话中的 npc（含 .mech / .name）
 * @param {object} intentLocked  session.intentLocked（可空）
 * @param {object} ctx   { styleNames, mannerNames }
 * @returns {{tag:string, title:string, body:string}[]} 研判断言数组
 */
export function intentHint(npc, intentLocked, ctx) {
  const mech = (npc && npc.mech) || {};
  if (!mech || !Object.keys(mech).length) return [];
  const styleNames = ctx && ctx.styleNames || {};
  const mannerNames = ctx && ctx.mannerNames || {};
  const sigName = signatureName(mech);
  const weaName = weaknessName(mech);
  const out = [];

  // — 意图披露 —
  if (intentLocked) {
    const sN = styleNames[intentLocked.style];
    if (intentLocked.styleDisclosed && sN) {
      out.push({
        tag: '行藏',
        title: `似欲用「${sN}」体`,
        body: `${intentLocked.mannerDisclosed && mannerNames[intentLocked.manner]
          ? `并重${mannerNames[intentLocked.manner]}一路` : '锋芒内敛'}，招式可期。`
      });
    } else if (intentLocked.mannerDisclosed && mannerNames[intentLocked.manner]) {
      out.push({
        tag: '立意',
        title: `重${mannerNames[intentLocked.manner]}`,
        body: '不重体例之变，而在意境高下。'
      });
    }
  }

  // — 招牌 / 破绽 的存在提示（身份级，无论披露与否都能读） —
  out.push({
    tag: '所长',
    title: `成于「${sigName}」`,
    body: '久练之下自成气象，需防其拿手好戏。'
  });
  out.push({
    tag: '所短',
    title: `露于「${weaName}」`,
    body: '盛名之下必有可击之处，观其形迹自见破绽。'
  });

  return out;
}

/**
 * 定策期破绽提示（选文体 / 选风格阶段出现）。
 * 根据 weakness.template 给出方向性反制建议，不泄露引擎判定细节，
 * 但要让玩家能据以做决策。
 * @param {object} mech
 * @param {object} ctx { styleNames, mannerNames }
 * @returns {string|null} 破绽提示文案（null 表示无机制）
 */
export function weaknessHint(mech, ctx) {
  const w = mech && mech.weakness;
  if (!w || !w.template) return null;
  const styleNames = ctx && ctx.styleNames || {};
  const mannerNames = ctx && ctx.mannerNames || {};
  const sigName = signatureName(mech);
  const weaName = w.name || '破绽';

  switch (w.template) {
    case 'wea_use_other_style': {
      const full = Array.isArray(w.fullClose) && w.fullClose[0] !== '*'
        ? w.fullClose.map(s => styleNames[s]).filter(Boolean).join('、') : null;
      const npcS = w.npcStyle && styleNames[w.npcStyle];
      const pr = w.partialReduction;
      if (full) return `临题有人言：「${weaName}」——若弃${npcS || '其所长'}体不用、改作${full}，其「${sigName}」或可尽废。`;
      if (pr && pr.style) return `临题有人言：「${weaName}」——绕开${npcS || ''}体、转作${pr.style.map(s => styleNames[s]).join('、')}，其「${sigName}」当见颓势。`;
      return `临题有人言：「${weaName}」——勿随其常用文体落笔，另辟蹊径或可制之。`;
    }
    case 'wea_switch_style':
      return `临题有人言：「${weaName}」——此人善记旧章，若能当场换成与上场不同的文体，其「${sigName}」便无可凭依。`;
    case 'wea_base_dice_only':
      return `临题有人言：「${weaName}」——此人欺人心性，若以本分之骰对之、不事铺张，其「${sigName}」自会落空。`;
    case 'wea_style_manner_combo': {
      const sS = w.style && styleNames[w.style];
      const ms = (w.manners || []).map(m => mannerNames[m]).filter(Boolean).join('、');
      const raw = Number(w.retention ?? 0.5);
      const pct = Math.round(Math.max(0, Math.min(1, raw)) * 100);
      return `临题有人言：「${weaName}」——若以${sS || '某'}体并辅以${ms || '相性相合'}一路，其「${sigName}」最多可剩 ${pct}% 之威。`;
    }
    case 'wea_crushing_win':
      return `临题有人言：「${weaName}」——此人恃才，须以大分数压服之，方能使「${sigName}」无从施展。`;
    case 'wea_harmonious_manner': {
      const ms = (w.manners || []).map(m => mannerNames[m]).filter(Boolean).join('、');
      return `临题有人言：「${weaName}」——其文胜于势而词或涩，若以${ms || '相得题材之文风'}相济，可破其「${sigName}」。`;
    }
    case 'wea_counter_intent':
      return `临题有人言：「${weaName}」——既知其意在${intentHint({ mech }, { styleDisclosed: true, mannerDisclosed: false }, ctx)[0]?.title || '某处'}，公开反制之，「${sigName}」自衰。`;
    case 'wea_cross_battle_shift':
      return `临题有人言：「${weaName}」——其计跨场而设，若本场改弦更张、与上场异辙，「${sigName}」之积威自减。`;
    default:
      return `临题有人言：「${weaName}」——观其招数，有可乘之隙。`;
  }
}

/** 保留两位小数百分比的简易格式 */
const pctStr = v => `${Math.round((Number(v) || 0) * 100)}%`;
const signed = v => (Number(v) >= 0 ? '+' : '') + Number(v);

/**
 * 结算明细行（B3）。在 revealScores 后追加展示，把引擎 out.mech 翻译成
 * 「招牌/破绽/修正」三段式对人类可见的解释。
 * @param {object} npc
 * @param {object} mechOut  out.mech = { tri, wea, mods }
 * @param {object} ctx { styleNames, mannerNames }
 * @returns {{tone:'sig'|'weaHit'|'weaMiss'|'res', label:string, body:string}[]}
 */
export function settleLines(npc, mechOut, ctx) {
  if (!mechOut || !mechOut.tri || mechOut.tri.level === null) return [];
  const mech = (npc && npc.mech) || {};
  const tri = mechOut.tri || {};
  const wea = mechOut.wea || {};
  const mods = mechOut.mods || {};
  const sigName = tri.key || signatureName(mech) || '招牌';
  const weaName = mech.weakness && mech.weakness.name || '破绽';
  const styleNames = ctx && ctx.styleNames || {};
  const lines = [];

  // ① 招牌是否被摊薄（破绽先于招牌：retention<1 说明被针对）
  let retLabel = '';
  if (wea.hit) {
    if (wea.shutdownLevel === 'full') retLabel = `「${sigName}」被尽数压制`;
    else if (wea.shutdownLevel === 'partial') retLabel = `「${sigName}」至多发挥${pctStr(wea.retention)}`;
    else retLabel = `「${sigName}」见势而衰`;
  } else if (wea.hit === false && (tri.level === 'main' || tri.level === 'weak')) {
    retLabel = `「${sigName}」未遭针对，全力施展`;
  }

  if (retLabel) lines.push({ tone: tri.level === 'weak' ? 'sigWeak' : 'sig', label: signatureName(mech) || '招牌', body: retLabel });

  // ② 破绽本场状态
  if (wea.hit) {
    const why = wea.reason || '';
    lines.push({
      tone: 'weaHit',
      label: weaName,
      body: `正中破绽。${why || '制住了其拿手好戏'}` +
        (mods.refundInsp ? `，返还灵感 ${mods.refundInsp}` : '') +
        (mods.playerBonusPct ? `，己方作品 +${pctStr(mods.playerBonusPct)}` : '')
    });
  } else if (mods.infoBonus) {
    lines.push({ tone: 'weaMiss', label: weaName, body: '虽有心得，未全制其机。' });
  }

  // ③ 修正生效明细（mods.pct/flat 已知 source:npcSign/npcWeak）
  const eff = [];
  for (const m of mods.pct || []) eff.push(`${m.label} ${pctStr(m.value)}`);
  for (const m of mods.flat || []) {
    const val = signed(m.value);
    eff.push(`${m.label} ${val} 分${m.source === 'npcWeak' ? '（失稳）' : ''}`);
  }
  if (eff.length) {
    lines.push({ tone: 'score', label: '修正生效', body: eff.join('；') });
  }

  return lines;
}

export default { intentHint, weaknessHint, settleLines, signatureName, weaknessName };
