/** battle.js —— 「挥毫论道」全屏对决台，六步流程 + 五项逐条弹出累加 */
import { ATTR_NAMES, STYLE_NAMES, ATTR_KEYS, BATTLE_COEF } from '../engine/rules.js?v=20260829-sidequest-npcs';
import { talentEffectText, goldBurst, signed, DEFAULT_SECONDS } from './modals.js';
import { createCountdown } from './timer.js';
import { play } from './audio.js';
import { intentHint, weaknessHint, settleLines } from './mechHints.js?v=20260829-sidequest-npcs';
import { SCHOLAR_PORTRAIT } from './svg.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

export class BattleStage {
  /** @param {HTMLElement} el @param {object} cfg - 全量配置，用于文案取值 */
  constructor(el, cfg) {
    this.el = el;
    this.cfg = cfg || {};
    this.seconds = DEFAULT_SECONDS;
  }

  attrsRow(a) {
    return ATTR_KEYS.map(k => `<span>${ATTR_NAMES[k]}<b> ${a[k] || 0}</b></span>`).join('');
  }

  /** 驱动一场战斗；session 由 engine 提供。返回 resolve 结果 */
  async run(session) {
    const el = this.el;
    const step = index => (Array.isArray(session.stepLabels) && session.stepLabels[index]) || ['遭遇', '审题', '选文体', '选风格', '掷灵感骰', '算分对决'][index];
    const focusKey = session.npc && (session.npc.focusAttr || (!STYLE_NAMES[session.npc.style] && session.npc.style));
    const opponentFocus = focusKey ? `重${ATTR_NAMES[focusKey] || focusKey}` : `偏${STYLE_NAMES[session.npc.style] || ''}`;
    el.classList.add('on');
    el.innerHTML = `
      <div class="bt-banner">
        <div class="sm">${esc(session.label)}</div>
        <div class="bg2" id="btTopic">—</div>
        <div class="th" id="btTheme"></div>
      </div>
      <div class="bt-countdown" id="btTimerSlot"></div>
      <div class="bt-arena">
        <div class="fighter self">
          <div class="fighter-head"><div class="fighter-portrait" aria-hidden="true">${SCHOLAR_PORTRAIT.self}</div><div class="fighter-meta">
            <div class="fname"><span class="seal">應試</span><span>${esc(session.playerName) || '在下'}</span></div>
            <div class="fsub" id="selfPick">待审题</div>
            <div class="fattrs">${this.attrsRow(session.playerAttrs)}</div>
          </div></div>
          <div class="score-lines" id="selfLines"></div>
          <div class="score-total" id="selfTotal"><span>作品得分</span><b>—</b></div>
        </div>
        <div class="vs-badge">對</div>
        <div class="fighter opp">
          <div class="fighter-head"><div class="fighter-portrait" aria-hidden="true">${SCHOLAR_PORTRAIT.opponent}</div><div class="fighter-meta">
            <div class="fname"><span class="seal">對手</span><span>${esc(session.npc.fullName || session.npc.name)}</span>${session.npc.style ? `<span class="opp-style">${esc(opponentFocus)}</span>` : ''}</div>
            <div class="fsub">${esc(session.npc.title || '')}</div>
            <div class="fattrs">${this.attrsRow(session.npc.attrs)}</div>
          </div></div>
          <div class="score-lines" id="oppLines"></div>
          <div class="score-total" id="oppTotal"><span>作品得分</span><b>—</b></div>
        </div>
      </div>
      <div class="bt-panel" id="btPanel"><div class="ph">① ${esc(step(0))}</div></div>`;

    const panel = el.querySelector('#btPanel');

    /* 首次论战先讲清六步流程，随后才进入遭遇，避免教学被倒计时打断。 */
    if (session.tutorialFirstBattle && session.tutorialFirstBattleText) {
      panel.innerHTML = `<div class="ph">论战六步</div><div style="font-size:14px;line-height:1.9;white-space:pre-line;color:var(--mo-2)">${esc(session.tutorialFirstBattleText)}</div>`;
      const guideBtn = document.createElement('button');
      guideBtn.className = 'pick meet-confirm';
      guideBtn.textContent = '开始第一场论战 →';
      await new Promise(resolve => {
        guideBtn.addEventListener('click', () => { guideBtn.disabled = true; resolve(); });
        panel.appendChild(guideBtn);
      });
    }

    /* ① 遭遇：介绍弹窗，等待玩家「开始对决」确认后再推进（不再自动快跳） */
    panel.innerHTML = `<div class="ph">① ${esc(step(0))}</div>
       <div style="font-size:17px;line-height:1.8">「${esc(session.npc.fullName || session.npc.name)}」${esc(session.npc.title || '')}拦路请教，愿以文会友。${session.npc.style ? `<span style="color:var(--zhu)">（此人${esc(opponentFocus)}）</span>` : ''}</div>`;

    /* ①½ 研判卡：机制 NPC 的意图行藏 + 长短可读提示（阶段 B），一并展示后统一确认 */
    const mechCtx = { styleNames: STYLE_NAMES, mannerNames: session.mannerNames || {} };
    if (session.npc && session.npc.mech) {
      const hints = intentHint(session.npc, session.intentLocked, mechCtx);
      if (hints.length) {
        const card = hints.map(h =>
          `<div class="jt-card"><span class="jt-tag">${esc(h.tag)}</span>
             <span class="jt-title">${esc(h.title)}</span>
             <span class="jt-body">${esc(h.body)}</span></div>`).join('');
        panel.insertAdjacentHTML('beforeend', `<div class="ph" style="margin-top:8px">硏 判 <span style="font-size:11px;color:var(--mo-3)">交手可明彼之长短</span></div>
          <div class="jt-row">${card}</div>`);
      }
    }
    /* 介绍 + 研判卡全部展示后，挂「开始对决」确认按钮，点击才放行进入审题 */
    await new Promise(resolve => {
      const btn = document.createElement('button');
      btn.className = 'pick meet-confirm';
      btn.textContent = '开始对决 →';
      btn.addEventListener('click', () => { btn.disabled = true; resolve(); });
      panel.appendChild(btn);
    });

    /* ② 审题 */
    el.querySelector('#btTopic').textContent = session.topic;
    el.querySelector('#btTheme').textContent = `题材 · ${session.themeName}`;
    const zg = session.zeitgeist;
    let info = '';
    if (zg) {
      const hot = (session.themeNames && session.themeNames[zg.theme]) || zg.theme;
      const fash = (session.mannerNames && session.mannerNames[zg.manner]) || zg.manner;
      const cur = (session.themeName === hot) ? '（本题即热点！）' : '';
      info += `<div style="margin-top:8px;font-size:13px;color:var(--mo-2)">当朝风潮 · 热点题材「<b>${esc(hot)}</b>${cur}」、得势文体「<b>${esc(fash)}</b>」</div>`;
    }
    if (session.schoolHomeName && session.homeBonus > 0) {
      info += `<div style="margin-top:4px;font-size:13px;color:var(--mo-2)">本门文风 · ${esc(session.schoolHomeName)}（用本门风格额外 +${Math.round(session.homeBonus * 100)}%）</div>`;
    }
    const syn = session.synergies || [];
    if (syn.length) {
      info += `<div style="margin-top:4px;font-size:13px;color:var(--jin)">文心羁绊 · ${syn.map(sy => esc(sy.name)).join('、')}</div>`;
    }
    panel.innerHTML = `<div class="ph">② ${esc(step(1))}</div>
      <div style="font-size:17px;line-height:1.8">题目「<b>${esc(session.topic)}</b>」，题材为<b style="color:var(--zhu)">${session.themeName}</b>。</div>${info}`;
    await sleep(950);

    /* ③ 选文体（联力 <8 禁选联） */
    session._stepStyleLabel = step(2);
    session._stepMannerLabel = step(3);
    session._stepDiceLabel = step(4);
    const style = await this.pickStyle(panel, session);
    el.querySelector('#selfPick').textContent = `文体：${STYLE_NAMES[style]}`;

    /* ④ 选风格 */
    const manner = await this.pickManner(panel, session);
    el.querySelector('#selfPick').textContent =
      `文体：${STYLE_NAMES[style]}　风格：${session.mannerNames[manner]}`;

    /* ⑤ 掷灵感骰 */
    const dice = await this.rollDice(panel, session, style);

    /* ⑥ 算分对决（决策已毕，撤去倒计时） */
    const slot = el.querySelector('#btTimerSlot');
    if (slot) slot.innerHTML = '';
    const out = session.resolve(style, manner, dice);
    panel.innerHTML = `<div class="ph">⑥ ${esc(step(5))}　<span style="font-size:12px;color:var(--mo-3)">
      ${session.tutorialFirstBattle ? '先看五项来源，再看最终作品得分　·　' : ''}
      对手以「${STYLE_NAMES[out.npcStyle]}·${esc(out.npcMannerName)}」应战，掷出 ${out.npcDice} 点</span></div>
      <div style="font-size:14px;color:var(--mo-2);line-height:1.8" id="btNarrate">正在逐项计分……</div>`;

    await this.revealScores(out);
    await this.revealMech(out, session);
    await this.revealInsight(session);
    await this.showVerdict(out, session);

    el.classList.remove('on');
    el.innerHTML = '';
    return out;
  }

  /**
   * 30 秒倒计时条：挂在战斗台顶部（审题栏下方），最后 5 秒转红预警。
   * 超时触发 onTimeout（由本层自动代打）；返回停止函数。
   */
  startTimer(panel, onTimeout, total) {
    const slot = this.el.querySelector('#btTimerSlot');
    const cd = createCountdown(total ?? this.seconds, onTimeout);
    if (slot) { slot.innerHTML = ''; slot.appendChild(cd.el); }
    return () => cd.stop();
  }

  pickStyle(panel, session) {
    return new Promise(resolve => {
      let done = false, stop = () => {};
      const finish = s => { if (done) return; done = true; stop(); resolve(s); };
      const cards = ['shi', 'ci', 'lian'].map(s => {
        const can = session.canUseStyle(s);
        const hint = session.styleHint(s);
        return `<button class="pick" data-s="${s}" ${can ? '' : 'disabled'}>
          <div class="pn">${STYLE_NAMES[s]}</div>
          <div class="pv">${ATTR_NAMES[s]} ${session.playerAttrs[s] || 0}　格律分 ${typeof session.styleScore === 'function' ? session.styleScore(s) : (session.playerAttrs[s] || 0) * BATTLE_COEF.styleMult}</div>
          ${hint ? `<div class="pv">${hint}</div>` : ''}
        </button>`;
      }).join('');
      panel.innerHTML = `<div class="ph">③ ${esc(session._stepStyleLabel || '选文体')}　<span style="font-size:12px;color:var(--mo-3)">三体共通 ×7 ＋ 本体专精 ×3　·　限时 ${this.seconds} 秒</span></div>
        <div style="font-size:12px;line-height:1.7;color:var(--mo-3);margin:4px 2px 7px">三体共通是诗力、词力、联力的平均功底；本体专精是你本场选择的文体属性。属性最高不一定永远是答案，还要看风潮、文风、对手和灵感。</div>
        <div class="pick-row">${cards}</div>${this.weaknessTip(session)}${this.activeRow(session)}`;
      this.bindActive(panel, session);
      panel.querySelectorAll('[data-s]').forEach(b =>
        b.addEventListener('click', () => finish(b.dataset.s)));
      stop = this.startTimer(panel, () => {
        const usable = ['shi', 'ci', 'lian'].filter(s => session.canUseStyle(s));
        const fallback = usable.includes(session.lastStyle) ? session.lastStyle : usable[0];
        this.flash(`时限已到，${session.lastStyle ? '沿用上一场' : '以默认'}文体「${STYLE_NAMES[fallback]}」应试`);
        finish(fallback);
      });
    });
  }

  pickManner(panel, session) {
    return new Promise(resolve => {
      let done = false, stop = () => {};
      const finish = m => { if (done) return; done = true; stop(); resolve(m); };
      const cards = session.manners.map(m => {
        const isHome = session.homeResolved && m === session.homeResolved;
        const mom = session.momentumPre(m);
        const momTxt = mom > 0 ? `<div class="mom">气势连捷 +${Math.round(mom * 100)}%</div>` : '';
        const homeTxt = isHome && session.homeBonus > 0 ? `<div class="home">本门 +${Math.round(session.homeBonus * 100)}%</div>` : '';
        return `<button class="pick" data-m="${m}">
          <div class="pn">${session.mannerNames[m]}</div>
          ${homeTxt}${momTxt}
        </button>`;
      }).join('');
      panel.innerHTML = `<div class="ph">④ ${esc(session._stepMannerLabel || '选风格')}　<span style="font-size:12px;color:var(--mo-3)">限时 ${this.seconds} 秒</span></div>
        <div class="pick-row">${cards}</div>
        <div style="font-size:12px;color:var(--mo-3);margin:6px 2px 0">文风会影响题材相性、当朝风潮和连续取胜的气势连捷；当前题材与风潮加成已在上方审题阶段标出。</div>
        ${this.weaknessTip(session)}
        ${this.activeRow(session)}`;
      this.bindActive(panel, session);
      panel.querySelectorAll('[data-m]').forEach(b =>
        b.addEventListener('click', () => finish(b.dataset.m)));
      stop = this.startTimer(panel, () => {
        let best = session.manners[0];
        for (const m of session.manners) if (session.affinityOf(m) > session.affinityOf(best)) best = m;
        this.flash(`时限已到，自动以「${session.mannerNames[best]}」落笔`);
        finish(best);
      });
    });
  }

  rollDice(panel, session, style) {
    return new Promise(resolve => {
      let done = false;
      let timerStop = null;
      const dicePct = Number(this.cfg?.inspiration?.dicePct) || BATTLE_COEF.dicePct;
      const pips = [];                                  // 已掷出的灵感骰点数（可叠加）
      const hasFixed = () => session.usedActive.some(t => (t.effect || {}).type === 'fixed_dice');
      const blocksExtra = () => session.usedActive.some(t => (t.effect || {}).type === 'dice_transform' && (t.effect || {}).mode === 'first_floor');
      const stopTimer = () => { if (timerStop) { timerStop(); timerStop = null; } };
      const armTimer = (onExpire) => { stopTimer(); timerStop = this.startTimer(panel, onExpire, this.seconds); };

      const finish = () => { if (done) return; done = true; stopTimer(); resolve(pips); };

      const doRoll = async (auto) => {
        if (done || pips.length > 0) return;
        const n = session.plannedDice != null
          ? Math.max(1, Math.min(6, Number(session.plannedDice) || 6))
          : 1 + Math.floor(Math.random() * 6);
        pips.push(n);
        play('dice', { value: n });
        const planned = session.plannedDice != null;
        session.plannedDice = null;
        panel.innerHTML = `<div class="ph">⑤ ${esc(session._stepDiceLabel || '掷灵感骰')}${auto ? '　<span style="font-size:12px;color:var(--mo-3)">时限已到，代掷</span>' : ''}</div>
          <div style="text-align:center"><div style="display:inline-block;font-size:62px;letter-spacing:.1em;color:var(--zhu)" class="pop-in">${'一二三四五六'[n - 1]}</div>
          <div style="font-size:14px;color:var(--mo-3)">${planned ? '布局谋篇定策，' : ''}掷出 ${n} 点</div></div>`;
        await sleep(760);
        if (done) return;
        renderExtra();
        armTimer(() => finish());                       // 进入追加阶段：再给一整段时限，超时自动结算
      };

      const extraCap = this.cfg && this.cfg.inspiration ? (Number(this.cfg.inspiration.maxExtraDice) || 2) : 2;
      const renderExtra = () => {
        const total = pips.reduce((a, b) => a + b, 0);
        const extraCount = Math.max(0, pips.length - 1);
        const preview = typeof session.previewDiceScore === 'function' ? session.previewDiceScore(style, pips) : { score: 0, pct: total * dicePct };
        const score = Number(preview.score) || 0;
        const pctLabel = preview.pct != null
          ? `临场乘区 +${Math.round(Number(preview.pct) * 100)}%`
          : `临场发挥 ${score} 分`;
        const extraPct = typeof session.extraDicePct === 'function'
          ? session.extraDicePct(extraCount)
          : extraCount * (Number(this.cfg?.inspiration?.extraDicePct) || 0);
        const extraCost = typeof session.extraDiceCost === 'function' ? session.extraDiceCost(style, pips.length, pips) : (Number(this.cfg?.inspiration?.extraDiceCost) || 5);
        const canExtra = !hasFixed() && !blocksExtra() && session.inspiration >= extraCost && extraCount < extraCap;
        const polarize = (session.activeTalents || []).find(t => (t.effect || {}).type === 'dice_transform' && (t.effect || {}).mode === 'polarize' && !session.usedActive.some(x => x.id === t.id));
        const polarizeCost = polarize && typeof session.activeCost === 'function' ? session.activeCost(polarize.id) : (polarize && polarize.cost);
        const canPolarize = polarize && pips.length >= Math.max(2, Number((polarize.effect || {}).minDice) || 2) && session.inspiration >= polarizeCost;
        const pipHtml = pips.map(n => `<span class="dice-pip">${'①②③④⑤⑥'[n - 1]}</span>`).join('');
        const extraHint = extraPct > 0 ? ` · 作品乘区 +${Math.round(extraPct * 100)}%` : '';
        panel.innerHTML = `<div class="ph">⑤ ${esc(session._stepDiceLabel || '掷灵感骰')}　<span style="font-size:12px;color:var(--mo-3)">已掷 ${pips.length} 枚 · 共 ${total} 点 → ${pctLabel}${extraHint}${hasFixed() ? '（固定灵感骰已用，追加无效）' : ''}</span></div>
          <div style="font-size:12px;line-height:1.7;color:var(--mo-3);margin:4px 2px 7px">当前骰点已经转为作品乘区；继续追加会消耗灵感，收笔则以当前骰数结算。${session._extraDiceChainNote ? `<br><span style="color:var(--zhu)">${session._extraDiceChainNote}</span>` : ''}${preview.pctDetail ? `<br><span style="color:var(--zhu)">${preview.pctDetail}</span>` : ''}</div>
          <div class="dice-pips">${pipHtml}</div>
          <div class="pick-row">
            ${canExtra
              ? `<button class="pick" id="btExtra" data-sfx="none"><div class="pn">多掷一枚</div><div class="pv">消耗灵感 ${extraCost} · 增加一段临场发挥</div></button>`
              : `<button class="pick" disabled><div class="pn">${hasFixed() ? '固定骰·不可叠' : '灵感不足'}</div></button>`}
            ${canPolarize ? `<button class="pick" id="btPolarize"><div class="pn">${esc(polarize.name)}</div><div class="pv">灵感 -${polarizeCost} · 化一最低骰与一最高骰</div></button>` : ''}
            <button class="pick" id="btConfirm"><div class="pn">收笔结算</div><div class="pv">以当前 ${pips.length} 枚骰子完成作品</div></button>
          </div>`;
        if (canExtra) panel.querySelector('#btExtra').addEventListener('click', () => addExtra());
        if (canPolarize) panel.querySelector('#btPolarize').addEventListener('click', () => { if (session.useActive(polarize.id)) { play('talent'); renderExtra(); } });
        panel.querySelector('#btConfirm').addEventListener('click', () => finish());
      };

      const addExtra = () => {
        const extraCost = typeof session.extraDiceCost === 'function' ? session.extraDiceCost(style, pips.length, pips) : (Number(this.cfg?.inspiration?.extraDiceCost) || 5);
        if (done || session.inspiration < extraCost || hasFixed() || blocksExtra() || pips.length - 1 >= extraCap) return;
        if (typeof session.spendExtraDice === 'function') session.spendExtraDice(extraCost);
        else session.spendInspiration(extraCost, '追加灵感骰');
        const n = 1 + Math.floor(Math.random() * 6);
        pips.push(n);
        play('spend', { amount: extraCost });
        play('dice', { value: n, delay: 0.09 });
        // 一气呵成的第二笔不再弹出一次交互：付出首枚续掷后直接自动落骰。
        const chain = pips.length === 2 && pips.length - 1 < extraCap && typeof session.useExtraDiceChain === 'function'
          ? session.useExtraDiceChain() : null;
        if (chain) {
          const chained = 1 + Math.floor(Math.random() * 6);
          pips.push(chained);
          session._extraDiceChainNote = `文心·${chain.name}续章：自动掷出 ${chained} 点`;
          play('dice', { value: chained, delay: 0.18 });
        }
        renderExtra();
        armTimer(() => finish());
      };

      const firstCost = typeof session.extraDiceCost === 'function' ? session.extraDiceCost(style, 1, pips) : (Number(this.cfg?.inspiration?.extraDiceCost) || 5);
      const extraPctPerDie = typeof session.extraDicePct === 'function'
        ? session.extraDicePct(1)
        : (Number(this.cfg?.inspiration?.extraDicePct) || 0);
      panel.innerHTML = `<div class="ph">⑤ ${esc(session._stepDiceLabel || '掷灵感骰')}　<span style="font-size:12px;color:var(--mo-3)">普通骰每点进入作品乘区 +${Math.round(dicePct * 100)}%；首次追加耗 ${firstCost} 灵感，额外作品乘区 +${Math.round(extraPctPerDie * 100)}%，最多可追加 ${extraCap} 枚　·　限时 ${this.seconds} 秒</span></div>
        <div class="pick-row"><button class="pick battle-roll" id="btRoll" data-sfx="none"><div class="pn">掷 骰</div>
        <div class="pv">听天由命，也听人事</div></button></div>`;
      panel.querySelector('#btRoll').addEventListener('click', () => doRoll(false));
      armTimer(() => doRoll(true));
    });
  }

  activeRow(session) {
    if (!session.activeTalents.length) return '';
    const btns = session.activeTalents.filter(t => (t.effect || {}).type !== 'planned_dice' && !((t.effect || {}).type === 'dice_transform' && (t.effect || {}).mode === 'polarize')).map(t => {
      const used = session.usedActive.some(x => x.id === t.id);
      const repeatable = (t.effect || {}).type === 'planned_dice';
      const cost = typeof session.activeCost === 'function' ? session.activeCost(t.id) : (t.cost || 1);
      const afford = session.inspiration >= cost;
      const choice = repeatable ? `<select class="planned-dice-choice" data-planned-for="${t.id}" ${used || !afford ? 'disabled' : ''} aria-label="${esc(t.name)}指定骰点">${[1, 2, 3, 4, 5, 6].map(n => `<option value="${n}">${n}点</option>`).join('')}</select>` : '';
      return `${choice}<button class="at-btn ${used ? 'used' : ''}" data-t="${t.id}" ${used || !afford ? 'disabled' : ''}
        title="${esc(talentEffectText(t))}">${esc(t.name)}<span class="cost">灵感 -${cost}${repeatable ? '（递增）' : ''}</span></button>`;
    }).join('');
    return `<div class="active-talents"><span class="lb">主动文心</span>${btns}</div>`;
  }

  bindActive(panel, session) {
    panel.querySelectorAll('[data-t]').forEach(b => b.addEventListener('click', () => {
      const t = session.activeTalents.find(x => x.id === b.dataset.t);
      const repeatable = (t && t.effect || {}).type === 'planned_dice';
      const selector = repeatable ? panel.querySelector(`[data-planned-for="${b.dataset.t}"]`) : null;
      const plannedValue = selector ? Number(selector.value) : 6;
      if (session.useActive(b.dataset.t, plannedValue)) {
        play('talent');
        b.classList.add('used'); b.disabled = true;
        if (selector) selector.disabled = true;
        this.flash(`文心「${t.name}」已发动${repeatable ? `，下次掷骰定为 ${plannedValue} 点` : ''}`);
      }
    }));
  }

  flash(text) {
    const d = document.createElement('div');
    d.className = 'toast';
    Object.assign(d.style, { position: 'absolute', left: '50%', top: '12px', transform: 'translateX(-50%)', zIndex: 90 });
    d.textContent = text;
    this.el.appendChild(d);
    setTimeout(() => d.remove(), 1700);
  }

  /** 定策期破绽提示（阶段 B）：机制 NPC 在选文体/选风格时给出方向性反制提示 */
  weaknessTip(session) {
    const mech = session.npc && session.npc.mech;
    if (!mech || !mech.weakness) return '';
    const tip = weaknessHint(mech, { styleNames: STYLE_NAMES, mannerNames: session.mannerNames || {} });
    if (!tip) return '';
    return `<div class="jt-tip" style="margin:4px 2px 0"><span class="jt-tag">机</span>${esc(tip)}</div>`;
  }

  /** 五项逐条弹出累加——玩家要能看懂为什么赢 */
  async revealScores(out) {
    const selfBox = this.el.querySelector('#selfLines');
    const oppBox = this.el.querySelector('#oppLines');
    const selfT = this.el.querySelector('#selfTotal');
    const oppT = this.el.querySelector('#oppTotal');
    let sAcc = 0, oAcc = 0;

    for (let i = 0; i < out.selfCalc.items.length; i++) {
      const si = out.selfCalc.items[i];
      const oi = out.oppCalc.items[i];
      sAcc += si.value; oAcc += oi.value;
      selfBox.appendChild(lineEl(si));
      oppBox.appendChild(lineEl(oi));
      selfT.innerHTML = `<span>累计</span><b>${sAcc}</b>`;
      oppT.innerHTML = `<span>累计</span><b>${oAcc}</b>`;
      play('score', { index: i, lead: Math.sign(sAcc - oAcc) });
      await sleep(620);
    }
    if (out.selfCalc.breakdown.critMult !== 1) {
      selfBox.appendChild(lineEl({ key: 'mods', label: '神来之笔', value: out.selfCalc.total - sAcc, detail: `全场得分 ×${out.selfCalc.breakdown.critMult}` }));
      goldBurst(this.el, 26);
      await sleep(620);
    }
    selfT.innerHTML = `<span>作品得分</span><b>${out.selfCalc.total}</b>`;
    oppT.innerHTML = `<span>作品得分</span><b>${out.oppCalc.total}</b>`;
    // 平局时不加类；classList.add('') 会抛 DOMTokenList 异常
    const selfCls = out.result === 'win' ? 'win' : out.result === 'lose' ? 'lose' : '';
    const oppCls = out.result === 'lose' ? 'win' : out.result === 'win' ? 'lose' : '';
    if (selfCls) selfT.classList.add(selfCls);
    if (oppCls) oppT.classList.add(oppCls);
    await sleep(420);
  }

  /** 结算明细·机制段（阶段 B）：招牌被压制与否 / 破绽本场状态 / 修正生效逐条解释 */
  async revealMech(out, session) {
    if (!out.mech || !session.npc || !session.npc.mech) return;
    const lines = settleLines(session.npc, out.mech, { styleNames: STYLE_NAMES, mannerNames: session.mannerNames || {} });
    if (!lines.length) return;
    const box = document.createElement('div');
    box.className = 'mech-result scroll-frame';
    box.innerHTML = `<div class="ph">机制结算　<span style="font-size:11px;color:var(--mo-3)">招牌 · 破绽 · 修正</span></div>` +
      lines.map(l => `<div class="mech-line tone-${l.tone}">
        <span class="lb">${esc(l.label)}</span><span class="bd">${esc(l.body)}</span></div>`).join('');
    this.el.querySelector('#btPanel').appendChild(box);
    await sleep(700);
  }

  /** 知人论世揭示：把结算时写入 session._revealLines 的洞察逐条呈现 */
  async revealInsight(session) {
    const lines = (session && session._revealLines) || [];
    if (!lines.length) return;
    const box = document.createElement('div');
    box.className = 'mech-result scroll-frame';
    box.innerHTML = `<div class="ph">知人论世　<span style="font-size:11px;color:var(--mo-3)">洞察</span></div>` +
      lines.map(l => `<div class="mech-line tone-info"><span class="lb">洞察</span><span class="bd">${esc(l)}</span></div>`).join('');
    const panel = this.el.querySelector('#btPanel');
    if (panel) panel.appendChild(box);
    await sleep(700);
  }

  /** 殿试场间评语（阶段 B）：机制主考官王侍郎的「跨场适应」叙事化 */
  palaceVerdict(out, session) {
    if (!session.isPalace || !session.npc || !session.npc.mech) return null;
    const name = session.npc.name || '主考官';
    const layers = Number(session.palaceLayers) || 0;
    const won = out.result === 'win';
    // 跨场适应招牌存在时才出评语
    const sig = session.npc.mech.signature || {};
    const main = sig.main || sig;
    if (main.template !== 'sig_palace_adapt') return null;
    if (!won && out.result !== 'draw') return `「${name}」执卷凝睇，若有所思：『卿之路数，本官已记下一程。』`;
    if (layers >= 2) return `「${name}」微微颔首：『卿连破两层，果非常人。然察变之道，方兴未艾。』`;
    return `「${name}」按卷不语，目光在案上几处批注间流转——似已记住了这一场。`;
  }

  async showVerdict(out, session) {
    const txt = { win: '勝', lose: '負', draw: '平' }[out.result];
    // 败北灵感惩罚与结算逻辑一致（含会试/殿试 Late 档与「科场风起」翻倍），由引擎预填到 session.projLoseInsp
    const loseInsp = typeof session.projLoseInspFor === 'function' ? session.projLoseInspFor(out.style)
      : session.projLoseInsp != null ? session.projLoseInsp
      : ((this.cfg.inspiration || {}).battleLoseExtra ?? -3);
    const drawPct = Math.round(BATTLE_COEF.drawRatio * 100);
    const sub = {
      win: out.upset ? '以弱胜强，一鸣惊人！' : '技高一筹，可喜可贺。',
      lose: `技不如人，灵感 ${signed(loseInsp)}。输的只是状态，不是成长。`,
      draw: `双方仅差 ${Math.abs(out.selfCalc.total - out.oppCalc.total)} 分（≤${drawPct}%），判为平局。`
    }[out.result];

    const d = document.createElement('div');
    d.className = 'bt-result ' + out.result;
    d.innerHTML = `${txt}<div style="font-size:15px;letter-spacing:.1em;margin-top:6px;color:#e9dcc0">${sub}</div>`;
    this.el.appendChild(d);

    // 殿试场间评语（阶段 B）：机制主考官王侍郎每场后据战况出语，层数越高越显「察变」
    const palaceR = this.palaceVerdict(out, session);
    if (palaceR) {
      const p = document.createElement('div');
      p.className = 'palace-remark';
      p.textContent = palaceR;
      this.el.appendChild(p);
    }

    play(out.result === 'win' ? 'win' : out.result === 'lose' ? 'lose' : 'choice');
    if (out.result === 'win') goldBurst(this.el, 34);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.marginTop = '12px';
    btn.textContent = session.isHiddenFinal ? '观终卷' : session.isPalace ? '继续殿试' : '收笔';
    this.el.appendChild(btn);
    await new Promise(r => btn.addEventListener('click', r));
  }
}

function lineEl(item) {
  const d = document.createElement('div');
  d.className = `score-line k-${item.key}`;
  d.innerHTML = `<span class="lb">${item.label}</span><span class="dt">${esc(item.detail)}</span>
    <span class="vv">${item.value >= 0 ? '+' : ''}${item.value}</span>`;
  return d;
}
