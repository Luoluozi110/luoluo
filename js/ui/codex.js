/**
 * codex.js（UI 层）—— 图鉴阁。
 * 三个分页：对手图鉴 / 传世名篇 / 文心。
 *   · 对手图鉴：按「档」分组列出具名对手；邂逅过的显示真容，未遇者留剪影。
 *   · 传世名篇：复用 Album 的解锁与条件逻辑（剪影 / 进度）。
 *   · 文心：复用 modals.talentEffectText；获得过的显真容，未获者留剪影。
 * 所有「已解锁 / 已邂逅 / 已获得」进度均来自持久化存储，跨局累计。
 */
import * as Codex from '../engine/codex.js';
import * as Album from '../engine/album.js';
import { talentEffectText, skyEffectText } from './modals.js';
import * as Mech from './mechHints.js';
import { ATTR_NAMES } from '../engine/rules.js';

const ATTR_KEYS = ['shi', 'ci', 'lian', 'bi', 'xue', 'si'];
const STYLE_NAMES = { shi: '诗', ci: '词', lian: '联', bi: '笔', xue: '学', si: '思' };
const QUALITY_NAMES = { common: '普通', rare: '稀有', epic: '史诗', legend: '传说' };

/** 该 NPC 在引擎结算中使用的稳定标识：机制 NPC 用具名 id，普通 NPC 用档位 id */
function foeId(tier, npc) {
  return (npc && npc.mech && npc.id) ? npc.id : (tier.id);
}

/** 四级认知的进阶描述（跨局，随交锋与破绽累计推进） */
function cognitionText(cog) {
  const lv = (cog && Number(cog.level)) || 0;
  const name = (Codex.FOE_LEVEL_NAMES && Codex.FOE_LEVEL_NAMES[lv]) || '未识';
  return { lv, name };
}

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 取典故第一句，卡面上只放一句 */
function firstSentence(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const i = t.indexOf('。');
  return i >= 0 ? t.slice(0, i + 1) : t;
}

export class CodexUI {
  constructor({ el, cfg }) {
    this.el = el;
    this.cfg = cfg;
    this.tab = 'foes';
  }

  open(tab = 'foes') {
    this.tab = tab || 'foes';
    this._render();
    this.el.classList.add('on');
  }

  close() { this.el.classList.remove('on'); }

  /* ================================================ 渲染外壳 */

  _render() {
    const c = Codex.loadCodex();
    const store = Album.loadStore();
    const ab = this.cfg.album || [];
    const tal = this.cfg.talents || [];
    const npcs = this.cfg.npcs || [];

    const foesTotal = npcs.reduce((a, t) => a + ((t.npcs || []).length || 0), 0);
    const foesGot = npcs.reduce((a, t) =>
      a + (t.npcs || []).filter(n => Codex.hasFoe(t.id, n.name)).length, 0);
    const abGot = ab.filter(x => store.unlocked.includes(x.id)).length;
    const talGot = tal.filter(t => c.talents.includes(t.id)).length;
    const syn = this.cfg.synergies || [];
    const synGot = syn.filter(s => c.synergies.includes(s.id)).length;
    const sky = this.cfg.sky || [];
    const skyGot = sky.filter(s => Codex.hasSky(s.id)).length;

    this.el.innerHTML = `
      <div class="cx-inner scroll-frame paper">
        <div class="cx-head">
          <button class="btn btn-ink btn-sm panel-back" data-back>关闭</button>
          <div class="title-ink" style="font-size:30px;text-align:center">圖 鑑 閣</div>
          <div class="cx-tabs">
            <button class="cx-tab ${this.tab === 'foes' ? 'on' : ''}" data-tab="foes">对手图鉴 <span class="cx-ct">${foesGot}/${foesTotal}</span></button>
            <button class="cx-tab ${this.tab === 'album' ? 'on' : ''}" data-tab="album">传世名篇 <span class="cx-ct">${abGot}/${ab.length}</span></button>
            <button class="cx-tab ${this.tab === 'tal' ? 'on' : ''}" data-tab="tal">文心 <span class="cx-ct">${talGot}/${tal.length}</span></button>
            <button class="cx-tab ${this.tab === 'syn' ? 'on' : ''}" data-tab="syn">羁绊 <span class="cx-ct">${synGot}/${syn.length}</span></button>
            <button class="cx-tab ${this.tab === 'sky' ? 'on' : ''}" data-tab="sky">天象 <span class="cx-ct">${skyGot}/${sky.length}</span></button>
          </div>
        </div>
        <div class="cx-scroll">
          <div class="cx-wrap" id="cxWrap">${this._body(store, c)}</div>
        </div>
        <div class="cx-foot">
          <div class="cx-bar">
            <span class="cx-hint">已邂逅 / 已解锁的内容会跨局累计，存于本机浏览器。</span>
            <button class="btn btn-primary" data-back>关闭</button>
          </div>
        </div>
      </div>`;

    this.el.querySelectorAll('[data-back]').forEach(b =>
      b.addEventListener('click', () => this.close()));
    this.el.querySelectorAll('.cx-tab').forEach(b =>
      b.addEventListener('click', () => { this.tab = b.dataset.tab; this._render(); }));

    // 已邂逅对手卡 → 点开详情（胜率 / 风格 / 六维）
    this.el.querySelectorAll('[data-foe-view]').forEach(el =>
      el.addEventListener('click', () => this._openFoeDetail(el.dataset.tier, el.dataset.name)));
  }

  _body(store, c) {
    if (this.tab === 'album') return this._album(store);
    if (this.tab === 'tal') return this._talents(c);
    if (this.tab === 'syn') return this._synergies(c);
    if (this.tab === 'sky') return this._sky(c);
    return this._foes(c);
  }

  /* ================================================ 对手图鉴 */

  _foes(c) {
    const npcs = this.cfg.npcs || [];
    if (!npcs.length) return `<div class="cx-empty">尚无对手数据</div>`;
    let html = '';
    for (const tier of npcs) {
      const pool = tier.npcs || [];
      if (!pool.length) continue;
      html += `<div class="cx-tier">
        <div class="cx-tier-h">${esc(tier.tier || tier.name || '对手')}<span class="cx-tier-sub">${esc(tier.desc || '')}</span></div>
        <div class="album-grid">`;
      for (const npc of pool) {
        if (Codex.hasFoe(tier.id, npc.name)) {
          const sum = ATTR_KEYS.reduce((a, k) => a + (Number(npc.attrs && npc.attrs[k]) || 0), 0);
          const chips = ATTR_KEYS.map(k =>
            `<span class="chip">${ATTR_NAMES[k]}${Number(npc.attrs && npc.attrs[k]) || 0}</span>`).join('');
          const styleBadge = npc.style ? `<span class="opp-style">偏${STYLE_NAMES[npc.style] || npc.style}</span>` : '';
          // 四级认知徽标（阶段 B）：已交手者按认知等级标记
          const cog = cognitionText(Codex.getFoeCognition(foeId(tier, npc)));
          const cogBadge = cog.lv > 0
            ? `<span class="cog-badge lv${cog.lv}">识·${esc(cog.name)}</span>` : '';
          html += `<div class="album-card unlocked foe-card" data-foe-view data-tier="${esc(tier.id)}" data-name="${esc(npc.name)}">
            <div class="ac-name">${esc(npc.name)}${styleBadge}${cogBadge}</div>
            <div class="ac-reward">${esc(npc.title || '')}</div>
            <div class="cx-chips">${chips}</div>
            <div class="ac-cond done">六维总和 Σ${sum}</div>
          </div>`;
        } else {
          html += `<div class="album-card locked">
            <div class="ac-silhouette">？</div>
            <div class="ac-name" style="font-size:14px;letter-spacing:.2em">未 邂 逅</div>
            <div class="ac-cond">擂台相逢，方入此册</div>
          </div>`;
        }
      }
      html += `</div></div>`;
    }
    return html;
  }

  /* ================================================ 传世名篇 */

  _album(store) {
    const ab = this.cfg.album || [];
    if (!ab.length) return `<div class="cx-empty">尚无名篇数据</div>`;
    // 横排三列图鉴（cols-3，窄屏降两列/单列，见 ui.css）
    return `<div class="album-grid cols-3">` + ab.map(card => {
      const got = store.unlocked.includes(card.id);
      if (got) {
        return `<div class="album-card unlocked">
          <div class="ac-name">${esc(card.name)}</div>
          <div class="ac-reward">${esc(card.rewardDesc || '（无数值加成）')}</div>
          <div class="ac-text">${esc(firstSentence(card.text))}</div>
          <div class="ac-cond done">${esc(Album.conditionText(card, store.stats))} ✓</div>
        </div>`;
      }
      const prog = Album.progressOf(card, store.stats);
      const pct = Math.min(100, Math.round(100 * prog.cur / prog.need));
      return `<div class="album-card locked">
        <div class="ac-silhouette">？</div>
        <div class="ac-name" style="font-size:14px;letter-spacing:.2em">未 解 鎖</div>
        <div class="ac-cond">${esc(Album.conditionText(card, store.stats))}</div>
        <div class="ac-prog"><i style="width:${pct}%"></i></div>
      </div>`;
    }).join('') + `</div>`;
  }

  /* ================================================ 文心 */

  _talents(c) {
    const tal = this.cfg.talents || [];
    if (!tal.length) return `<div class="cx-empty">尚无文心数据</div>`;
    return tal.map(t => {
      const got = c.talents.includes(t.id);
      if (got) {
        const up = (this.cfg['talent-upgrade'] || {})[t.id];
        let upHtml = '';
        if (up) {
          const q = QUALITY_NAMES[up.quality] || up.quality || '未知';
          const lvMax = Number(up.maxLevel) || (up.levels ? up.levels.length : 1);
          const badge = `<span class="rarity-tag r-${up.quality}">${esc(q)}</span>`;
          const head = `<div class="cx-up-head">${badge}<span class="cx-up-lv">可升至 Lv${lvMax}</span></div>`;
          const levels = (up.levels || []).slice(1); // 跳过 Lv1（= 基础效果）
          const lvlHtml = levels.length ? `<div class="cx-up-levels">` + levels.map((lv, i) => {
            const n = i + 2;
            const cost = (up.upCost && up.upCost[i] != null) ? `耗灵感 ${up.upCost[i]}` : '';
            return `<div class="cx-up-lv-row"><span class="cx-up-lv-n">Lv${n}</span>` +
              `<span class="cx-up-lv-ef">${talentEffectText({ effect: lv.effect })}</span>` +
              (cost ? `<span class="cx-up-lv-cost">${esc(cost)}</span>` : '') + `</div>`;
          }).join('') + `</div>` : '';
          upHtml = head + lvlHtml;
        }
        return `<div class="album-card unlocked">
          <div class="ac-name">${esc(t.name)} <span class="ac-badge">${t.kind === 'active' ? '主动' : '被动'}</span></div>
          <div class="efx cx-efx">${talentEffectText(t)}</div>
          ${upHtml}
          <div class="ac-text">${esc(firstSentence(t.text))}</div>
        </div>`;
      }
      return `<div class="album-card locked">
        <div class="ac-silhouette">？</div>
        <div class="ac-name" style="font-size:14px;letter-spacing:.2em">未 獲 得</div>
        <div class="ac-cond">${esc(t.acquireText || '于局中获取，方入此册')}</div>
      </div>`;
    }).join('');
  }

  /* ================================================ 文心羁绊 */

  _synergyEffectText(ef) {
    if (!ef || !ef.type) return "（无效果）";
    switch (ef.type) {
      case "syn_pct": return "论战得分 +" + Math.round((ef.value || 0) * 100) + "%";
      case "on_win_bonus": return "以" + (STYLE_NAMES[ef.style] || ef.style || "任意体") + "出战获胜 +" + (ef.value || 0);
      case "dice_plus": return "灵感骰 +" + (ef.value || 0);
      case "extra_dice_pct": return "每枚追加骰得分 +" + Math.round((ef.value || 0) * 100) + "%";
      case "dice_transform": return ef.mode === "first_floor" ? "首骰最低视为 " + (ef.floor || 4) + " 点" : ef.mode === "lowest_to" ? "最低骰化为 " + (ef.target || 6) + " 点" : "低点骰抬高 " + (ef.value || 1) + " 点";
      case "dice_pattern": return ef.pattern === "six" ? "最终六点骰形成联动" : ef.pattern === "distinct" ? "不同点数组形成联动" : ef.pattern === "single" ? "单骰收笔形成联动" : ef.pattern === "all_high" ? "全骰高点形成联动" : ef.pattern === "pair" ? "同点骰形成联动" : "骰组条件形成联动";
      case "style_switch_pct": return "换用不同文体，得分与心得增加";
      case "manuscript_pct": return "稿本越厚，论战得分越高";
      case "crit": return Math.round((ef.chance || 0) * 100) + "% 概率得分 ×" + (ef.mult || 0);
      default: return ef.type;
    }
  }

  _synergies(c) {
    const syn = this.cfg.synergies || [];
    if (!syn.length) return `<div class="cx-empty">尚无羁绊数据</div>`;
    const talMap = new Map((this.cfg.talents || []).map(t => [t.id, t]));
    const talName = id => (talMap.get(id) && talMap.get(id).name) || id;
    return syn.map(s => {
      const got = c.synergies.includes(s.id);
      const mem = (s.members || []).map(m => `<span class="chip">${esc(talName(m))}</span>`).join("");
      const eff = (s.effects || []).map(e => this._synergyEffectText(e)).join("　");
      if (got) {
        return `<div class="album-card unlocked">
          <div class="ac-name">${esc(s.name)} <span class="ac-badge">羁绊</span></div>
          <div class="q-tags">${mem}</div>
          <div class="efx cx-efx">${esc(eff)}</div>
          <div class="ac-text">${esc(firstSentence(s.desc))}</div>
        </div>`;
      }
      return `<div class="album-card locked">
        <div class="ac-silhouette">？</div>
        <div class="ac-name" style="font-size:14px;letter-spacing:.2em">未 达 成</div>
        <div class="ac-cond">集齐成员「${esc((s.members || []).map(talName).join("、"))}」方入此册</div>
      </div>`;
    }).join("");
  }

  /* ================================================ 天象 */

  _sky(c) {
    const sky = this.cfg.sky || [];
    if (!sky.length) return `<div class="cx-empty">尚无天象数据</div>`;
    return sky.map(card => {
      if (Codex.hasSky(card.id)) {
        const icon = card.icon || '✦';
        const dur = card.turns || card.duration || '?';
        const scope = card.scope === 'self' ? '仅己身' : '全盘';
        return `<div class="album-card unlocked sky-card">
          <div class="sky-icon">${esc(icon)}</div>
          <div class="ac-name">${esc(card.name)}</div>
          <div class="efx cx-efx">${skyEffectText(card)}</div>
          <div class="ac-text">${esc(firstSentence(card.text))}</div>
          <div class="ac-cond done">持续 ${dur} 回合　·　${scope}</div>
        </div>`;
      }
      return `<div class="album-card locked">
        <div class="ac-silhouette">？</div>
        <div class="ac-name" style="font-size:14px;letter-spacing:.2em">未 邂 逅</div>
        <div class="ac-cond">于局中逢此天象，方入此册</div>
      </div>`;
    }).join('');
  }

  /* ================================================ 对手详情浮层 */

  /** 认知深浅区块（阶段 B）：四级进度 + 交手/破绽统计 + 附机制战术注释 */
  _cognitionHtml(tier, npc) {
    const cog = Codex.getFoeCognition(foeId(tier, npc));
    const { lv, name } = cognitionText(cog);
    const steps = (Codex.FOE_LEVEL_NAMES || ['未识', '相识', '察意', '破招']).map((n, i) =>
      `<span class="cog-step ${i === lv ? 'cur' : ''} ${i < lv ? 'done' : ''}">${n}</span>`).join('');
    const stat =
      `<div class="cx-cog-stat"><span>交手 <b>${cog.meets}</b> 次</span>
       <span>破其招 <b>${cog.weaknessHits}</b> 次</span></div>`;
    const tip = lv <= 0
      ? '尚未交锋——此册只记你亲眼所见。'
      : lv === 1
        ? '初识其面，但知其有拿手好戏与可乘之隙，尚无实证。'
        : lv === 2
          ? '已通晓其长短，破绽反制之法了然于胸——击败此僚后，克制之策尽显于图鉴。'
          : '已亲手破其拿手好戏，破绽所在与克制之法皆心中有数。';
    return `<div class="cx-cog"><div class="cx-cog-track">${steps}</div>${stat}
      <div class="cx-hint2">${esc(tip)}</div></div>`;
  }

  /**
   * 对手三机制展示（依据四级认知逐级披露）：
   *   lv1 相识：仅披露招牌名 / 破绽名（知其有，无实证）
   *   lv2 察意：加披露意图方向 + 破绽反制方向（临题有人言）
   *   lv3 破招：同察意，并标记「已破招」
   * 无 mech 的对手：平铺说明，无机制可循。
   */
  _foeMechHtml(tier, npc) {
    const st = Codex.getFoeStats(tier.id, npc.name);
    const defeated = !!(st && st.w > 0);
    const defeatedBadge = defeated ? `<span class="cog-badge lv2">已击败</span>` : '';
    if (!npc.mech) {
      const tac = defeated
        ? `<div class="cx-weakness-explain"><div class="cx-we-title">战术 · 明确说明<span class="cx-we-tag">已击败</span></div>
             <div class="cx-we-body">此僚虽无招牌破绽，然其以所长立身——宜攻其短，或避其锋芒、另辟蹊径。</div></div>`
        : '';
      return `<div class="cx-hint2">此人不具特殊机制，唯凭才学取胜，无招牌破绽可循。${defeated ? ' 已击败。' : ''}</div>${tac}`;
    }
    const lv = Codex.getFoeCognition(foeId(tier, npc)).level;
    const mech = npc.mech;
    const sig = mech.signature || {};
    const wea = mech.weakness || {};
    const intent = mech.intent || {};
    const ctx = { styleNames: STYLE_NAMES, mannerNames: (this.cfg.affinity && this.cfg.affinity.mannerNames) || {} };
    const rows = [];
    rows.push(`<div class="cx-mech-row"><span class="cx-mech-k">招牌</span><span class="cx-mech-v">${esc(sig.name || '招牌')}</span></div>`);
    rows.push(`<div class="cx-mech-row"><span class="cx-mech-k">破绽</span><span class="cx-mech-v">${esc(wea.name || '破绽')}${defeatedBadge}</span></div>`);
    if (lv >= 2) {
      const intentText = intent.description || Mech.intentTemplateName(intent.template) || '打法';
      rows.push(`<div class="cx-mech-row"><span class="cx-mech-k">意图</span><span class="cx-mech-v">${esc(intentText)}</span></div>`);
    } else {
      rows.push(`<div class="cx-mech-row cx-mech-locked"><span class="cx-mech-k">意图</span><span class="cx-mech-v">？？（需更深交手方知其打法）</span></div>`);
    }
    // lv2 起（击败或交锋≥3）：明示破绽反制之法——即「弱点的明确说明」
    let explain = '';
    if (lv >= 2) {
      const hint = Mech.weaknessHint(mech, ctx);
      if (hint) {
        const tag = defeated ? '已击败 · 克制之法已明' : '交手已深 · 克制之法已明';
        explain = `<div class="cx-weakness-explain">
            <div class="cx-we-title">破绽 · 明确说明<span class="cx-we-tag">${esc(tag)}</span></div>
            <div class="cx-we-body">${esc(hint)}</div>
          </div>`;
      }
    }
    const broken = lv >= 3 ? `<span class="cog-badge lv3">已破招</span>` : '';
    return `<div class="cx-mech">${rows.join('')}${explain}${broken}</div>`;
  }

  /** 在配置里按 tierId + name 定位对手（两者组合唯一） */
  _findFoe(tierId, name) {
    for (const tier of (this.cfg.npcs || [])) {
      const npc = (tier.npcs || []).find(n => n.name === name);
      if (npc && tier.id === tierId) return { tier, npc };
    }
    return null;
  }

  _openFoeDetail(tierId, name) {
    const found = this._findFoe(tierId, name);
    if (!found) return;
    const prev = this.el.querySelector('[data-detail]');
    if (prev) prev.remove();
    const ov = document.createElement('div');
    ov.className = 'cx-detail-overlay';
    ov.setAttribute('data-detail', '');
    ov.innerHTML = `<div class="cx-detail paper">${this._foeDetailHtml(found.tier, found.npc)}</div>`;
    this.el.appendChild(ov);
    ov.querySelector('[data-detail-close]').addEventListener('click', () => ov.remove());
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  }

  _foeDetailHtml(tier, npc) {
    const style = npc.style || '';
    const sum = ATTR_KEYS.reduce((a, k) => a + (Number(npc.attrs && npc.attrs[k]) || 0), 0);
    // 最擅长的文体（六维最高项），卡面与评语据此高亮
    const dom = ATTR_KEYS.reduce((m, k) =>
      (Number(npc.attrs && npc.attrs[k]) || 0) > (Number(npc.attrs && npc.attrs[m]) || 0) ? k : m, ATTR_KEYS[0]);
    const chips = ATTR_KEYS.map(k =>
      `<span class="chip ${k === dom ? 'best' : ''}">${ATTR_NAMES[k]} ${Number(npc.attrs && npc.attrs[k]) || 0}</span>`).join('');

    // 累计战绩（跨局）
    const st = Codex.getFoeStats(tier.id, npc.name);
    const tot = st.w + st.d + st.l;
    const rate = tot ? Math.round(100 * st.w / tot) : 0;
    const recHtml = tot
      ? `<div class="cx-rec-row"><span class="win">胜 ${st.w}</span><span class="draw">平 ${st.d}</span><span class="loss">负 ${st.l}</span></div>
         <div class="cx-rec-bar"><i style="width:${rate}%"></i></div>
         <div class="cx-rec-rate">胜率 ${rate}%　·　共 ${tot} 战</div>`
      : `<div class="cx-rec-none">尚未交锋——仅曾邂逅于此册</div>`;

    // 款位附加信息：殿试场次 / 擅场题材
    const thNames = (tier.themes || []).map(t =>
      (this.cfg.affinity && this.cfg.affinity.themeNames && this.cfg.affinity.themeNames[t]) || t);
    const meta = [];
    if (tier.battles) meta.push(`殿试 ${tier.battles} 场`);
    if (thNames.length) meta.push(`擅场：${thNames.join('、')}`);
    const hint = `此人以「${ATTR_NAMES[dom]}」见长（六维 ${sum} 中占 ${Number(npc.attrs && npc.attrs[dom]) || 0}），宜以所长击之，或避其锋芒、另辟蹊径。`;

    return `
      <div class="cx-detail-head">
        <button class="btn btn-ink btn-sm" data-detail-close>返回图鉴</button>
        <div class="title-ink" style="font-size:28px">${esc(npc.name)}</div>
        <div class="cx-detail-sub">${esc(tier.tier)} · ${esc(npc.title || '')}　${style ? `<span class="opp-style">偏${STYLE_NAMES[style] || style}</span>` : ''}</div>
      </div>
      <div class="cx-detail-body scroll-frame">
        <div class="cx-detail-sec">
          <div class="cx-sec-t">六维才学</div>
          <div class="cx-chips cx-chips-lg">${chips}</div>
          <div class="cx-strong">综合实力 Σ ${sum}</div>
        </div>
        <div class="cx-detail-sec">
          <div class="cx-sec-t">交锋战绩</div>
          ${recHtml}
        </div>
        <div class="cx-detail-sec">
          <div class="cx-sec-t">你所识其深浅<span class="cx-sec-sub">（未识 → 相识 → 察意 → 破招）</span></div>
          ${this._cognitionHtml(tier, npc)}
        </div>
        <div class="cx-detail-sec">
          <div class="cx-sec-t">拿手与破绽<span class="cx-sec-sub">（随认知深浅逐级披露）</span></div>
          ${this._foeMechHtml(tier, npc)}
        </div>
        <div class="cx-detail-sec">
          <div class="cx-sec-t">款位说明</div>
          <div class="cx-tier-desc">${esc(tier.desc || '')}</div>
          ${meta.length ? `<div class="cx-meta">${meta.map(m => `<span class="chip">${esc(m)}</span>`).join('')}</div>` : ''}
          <div class="cx-hint2">${hint}</div>
        </div>
      </div>`;
  }
}
