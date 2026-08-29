/** modals.js —— 题卡 / 奇遇卡 / 文心卡 / 支线选择 / 天象 / 名胜 */
import { ATTR_NAMES } from '../engine/rules.js';
import { PASSIVE_MAX, ACTIVE_MAX } from '../engine/game.js';
import { LANDMARK_ART, EVENT_VIGNETTE, QUIZ_MARK } from './svg.js';
import { createCountdown } from './timer.js';
import { play } from './audio.js';
import { personalize, normalizeName } from './namefmt.js';

const RARITY_CN = { common: '普通', rare: '稀有', legend: '传说' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 带符号的数值文案：-1 → 「−1」，+3 → 「+3」（用全角减号，排版更整） */
export const signed = n => (Number(n) > 0 ? '+' : '−') + Math.abs(Number(n) || 0);

/** 限时默认秒数：引擎未指定时的兜底，UI 各处倒计时文案统一引用此常量 */
export const DEFAULT_SECONDS = 30;

/**
 * 开局 / 阶段切换弹窗的纯叙事文案默认值。
 * 与 config/narrative.json 对齐；编辑器改 narrative.json 后由 cfg.narrative 覆盖，
 * 缺字段时回退到这里，保证不破坏现有表现。绝不在此硬编码数值/公式。
 */
const NARRATIVE_DEFAULTS = {
  tutorial: {
    kickoff: {
      title: '起步札记',
      text: '每回合先掷“移动骰”，决定你在棋盘上前进几格。\n\n落到不同格子会触发奇遇、问答或论战。先看看右侧的灵感与文心，再点击“掷骰”出发。',
      button: '明白，开始第一回合'
    },
    battle: {
      title: '论战六步',
      text: '① 遭遇：先看对手是否有招牌与破绽\n② 审题：确认题目题材，并留意当朝风潮\n③ 选文体：看属性底盘与本体专精\n④ 选风格：看题材、文风和连捷加成\n⑤ 掷灵感骰：决定临场发挥，可花灵感追加\n⑥ 算分对决：逐项揭示格律、意象、立意、骰子和修正\n\n记住：先看题，再选体；先算资源，再决定要不要追加。',
      button: '开始第一场论战'
    }
  },
  prologue: {
    title: '初入科场',
    text: '你有这么一段模糊的记忆：你来自于所谓的“现代世界”，你或许曾富甲一方，却感到生活寡淡无味，于是抛尽家财，出海寻访；也或许一贫如洗，为虚无缥缈的救赎凭片板到海上流浪；又或许只过着柴米油盐的生活，却在某日下定决心，去寻找那个世外仙源——总之，共同点是，你最终来到了『桃花岛』。岛上的仙人听你说明来意，默然无言，只往你头上一点，你便感觉周围的景物变成万千碎片，万千尘埃，像被狂风割裂，吹散，又重组成了新的场景。“待到种种妄念破灭，自可殿试见我，可涤尔灵台。”你到了蒙学馆，变成了一个小童生。其后十年潜心，你逐渐分不清那段模糊的记忆是真实存在，还只是一段怪谈般的梦境。总之，眼前科举将启，十载寒窗已到迎来回报的时刻，只待踏上征途，一上科场，便一鸣惊人。',
    button: '踏上征途'
  },
  zeitgeist: {
    kind: '当 朝 文 风',
    title: '风 潮 既 起',
    lead: '本局科场，文运所钟于二事。临场择题用体，可顺势而行：',
    note: '若某场题目恰为热点题材、又用得势文体，二者叠加生效。文运在手，善用之可事半功倍。',
    button: '谨记于心'
  },
  stageChange: {
    kind: '科 场 叙 事',
    names: { xiucai: '秀才', juren: '举人', jinshi: '进士' },
    titleTpl: '{name}阶段 · 晋阶试',
    buttonTpl: '进入{name}阶段',
    default: '基础功名已立。接下来的道路会逐渐收紧，先前积下的文心与选择，将在新的试场中显出分量。',
    middle: '外圈的试炼已尽。你将踏入中圈，补给不再唾手可得，真正的论战与奇遇正在前方等候。',
    inner: '中圈的取舍已经定稿。内圈只给成熟的构筑留下位置，每一场论战都将逼你证明为何能走到这里。'
  },
  lap2Intro: {
    title: '会试圈 · 再入科场',
    text: '童生圈的试炼渐远，你已不再只是初入科场的稚子。\n\n棋盘上的路重新展开，题目更深，对手也将换作秀才与举人之间的较量。前方的每一步，都在检验十年寒窗积下的根基。\n\n收束心神，继续向前；待绕过会试圈，金殿之门便会在尽头开启。',
    button: '进入会试圈'
  },
  hiddenFinal: {
    invite: {
      kind: '桃 源 终 卷', title: '金榜之外，尚有一问',
      text: '殿门外桃花逆风而开，一条从未见过的小径浮出水面。桃花仙人陈之微正在终圈等你交最后一卷。',
      enterButton: '循花入终圈', declineButton: '止步金榜'
    },
    victory: {
      kind: '桃 花 仙 人', title: '此心已过万重山',
      text: '陈之微收起终卷：“能收万卷于胸中，又不为万卷所役，方算真正走出桃源。”',
      button: '携一枝桃花归去'
    },
    defeat: {
      kind: '桃 源 留 问', title: '终卷未竟',
      text: '陈之微并未收走你的金榜：“此问不必今日作答。”终圈仍在那里，等下一次更从容的来路。',
      button: '记下此问'
    }
  }
};

/** 合并 config.narrative 与默认值（浅合并各块，stageChange.names 单独深合并）。 */
function narrativeOf(cfg) {
  const src = (cfg && cfg.narrative) || {};
  const d = NARRATIVE_DEFAULTS;
  return {
    tutorial: {
      kickoff: Object.assign({}, d.tutorial.kickoff, (src.tutorial || {}).kickoff || {}),
      battle: Object.assign({}, d.tutorial.battle, (src.tutorial || {}).battle || {})
    },
    prologue: Object.assign({}, d.prologue, src.prologue || {}),
    zeitgeist: Object.assign({}, d.zeitgeist, src.zeitgeist || {}),
    stageChange: Object.assign({}, d.stageChange, src.stageChange || {}, {
      names: Object.assign({}, d.stageChange.names, (src.stageChange || {}).names || {})
    }),
    lap2Intro: Object.assign({}, d.lap2Intro, src.lap2Intro || {}),
    hiddenFinal: {
      invite: Object.assign({}, d.hiddenFinal.invite, (src.hiddenFinal || {}).invite || {}),
      victory: Object.assign({}, d.hiddenFinal.victory, (src.hiddenFinal || {}).victory || {}),
      defeat: Object.assign({}, d.hiddenFinal.defeat, (src.hiddenFinal || {}).defeat || {})
    }
  };
}

/** 从 grades.json 里取某维某项加成的分值，供 UI 文案使用，避免硬编码 */
export function bonusScore(grades, dimKey, bonusId, fallback) {
  const dim = ((grades || {}).dimensions || []).find(d => d.key === dimKey);
  const b = ((dim || {}).bonuses || []).find(x => x.id === bonusId);
  return b && b.score != null ? b.score : fallback;
}

export class Modals {
  /** @param {HTMLElement} layer @param {object} cfg - 全量配置，用于文案取值 */
  constructor(layer, cfg) {
    this.layer = layer;
    this.cfg = cfg || {};
    this.playerName = '';   // 由 app.js 在对局开始时写入；留空则叙事维持「你」
    this.game = null;       // 由 app.js 在对局开始时注入（升级文心需要调用引擎）
  }

  open(html, cls) {
    const ov = document.createElement('div');
    ov.className = 'overlay ' + (cls || '');
    ov.innerHTML = html;
    this.layer.appendChild(ov);

    // 软键盘/动态视口变化时，把弹窗中当前聚焦的输入控件带回可视区。
    const keepFocusedControlVisible = () => {
      const active = document.activeElement;
      if (active && ov.contains(active) && typeof active.scrollIntoView === 'function') {
        active.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      }
    };
    ov.addEventListener('focusin', () => requestAnimationFrame(keepFocusedControlVisible));
    if (window.visualViewport) {
      let frame = 0;
      const onViewportResize = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => { frame = 0; keepFocusedControlVisible(); });
      };
      window.visualViewport.addEventListener('resize', onViewportResize);
      ov._removeViewportListener = () => window.visualViewport.removeEventListener('resize', onViewportResize);
    }
    return ov;
  }
  close(ov) {
    if (!ov) return;
    if (ov._removeViewportListener) ov._removeViewportListener();
    ov.style.transition = 'opacity .2s';
    ov.style.opacity = '0';
    setTimeout(() => {
      if (ov._removeViewportListener) ov._removeViewportListener();
      ov.remove();
    }, 210);
  }

  /* ---------------------------------------------------- 考题格 */
  showQuiz(q, opt) {
    return new Promise(resolve => {
      const isChoice = q.type === 'choice';
      const stars = '★'.repeat(q.difficulty || 1) + '☆'.repeat(3 - (q.difficulty || 1));
      const catCN = { shi: '诗', ci: '词', lian: '联', mix: '综合' }[q.category] || '综合';
      // 柔性答题：knowledge 题若配了 scenario / optionActs，就以「情境 + 可做之事」呈现；
      // 缺字段时自动退回原来的「题面 + 选项原文」，旧题零影响。
      const stemText = q.scenario ? q.scenario : q.stem;
      const optTextOf = (o, i) => isChoice
        ? o.text
        : (q.optionActs && q.optionActs[i] != null ? q.optionActs[i] : o);
      const opts = (q.options || []).map((o, i) => {
        const text = optTextOf(o, i);
        return `<button class="opt" data-i="${i}"><span class="idx">${'ABCD'[i]}</span>
          <span>${esc(personalize(text, this.playerName))}</span></button>`;
      }).join('');

      const total = (opt && opt.seconds) || DEFAULT_SECONDS;

      const ov = this.open(`
        <div class="modal scroll-frame paper quiz-modal">
          <div class="quiz-heading">
            <div class="quiz-emblem" aria-hidden="true">${QUIZ_MARK}</div>
            <div class="quiz-heading-copy"><div class="mtitle">
              <h2>${isChoice ? '创作抉择' : '知识考课'}</h2>
              <span class="mtag">${catCN}</span><span class="mtag">难度 ${stars}</span>
            </div><div class="quiz-kicker">研墨 · 审题 · 落笔</div></div>
          </div>
          <div class="cd-slot"></div>
          <hr class="hr-ink"/>
          <div class="quiz-stem${q.scenario ? ' is-scenario' : ''}">${esc(personalize(stemText, this.playerName))}</div>
          <div class="opt-list">${opts}</div>
        </div>`);

      let done = false;
      const finish = (index, timedOut) => {
        if (done) return; done = true;
        cd.stop();
        this._quizOv = ov; this._quizChoice = index;
        resolve({ index, timedOut, remain: cd.left });
      };

      // 倒计时挂在题卡顶部，最后 5 秒转红预警；超时交由引擎判错
      const cd = createCountdown(total, () => finish(-1, true));
      cd.el.classList.add('top');
      ov.querySelector('.cd-slot').appendChild(cd.el);

      ov.querySelectorAll('.opt').forEach(b =>
        b.addEventListener('click', () => finish(Number(b.dataset.i), false)));
    });
  }

  /** 展示判定结果与解析（答错必出解析） */
  async showQuizResult(q, ans, ok, choiceFeedback = null) {
    const ov = this._quizOv;
    if (!ov) return;
    const isChoice = q.type === 'choice';
    ov.querySelectorAll('.opt').forEach((b, i) => {
      b.disabled = true;
      if (isChoice) { if (i === ans.index) b.classList.add('right'); else b.classList.add('dim'); }
      else {
        if (i === q.answer) b.classList.add('right');
        else if (i === ans.index) b.classList.add('wrong');
        else b.classList.add('dim');
      }
    });
    const box = document.createElement('div');
    box.className = 'analysis pop-in';
    // 答错的灵感惩罚一律读配置 inspiration.quizWrong，不再硬编码
    const insp = this.cfg.inspiration || {};
    const wrongTxt = `灵感 ${signed(insp.quizWrong ?? -1)}`;
    // 情境化题目答错时，回显「正确的那一件事」而非裸答案；未配 optionActs 的旧题仍回显选项原文
    const correctAct = (q.optionActs && q.optionActs[q.answer] != null)
      ? q.optionActs[q.answer]
      : q.options[q.answer];
    const head = isChoice
      ? (ans.timedOut
          ? `<b>超时未决</b>　未及落笔，灵感 ${signed(insp.quizWrong ?? -1)}`
          : `<b>诗无达诂</b>　选中「${esc((q.options[ans.index] || q.options[0]).text)}」`)
      : ok
        ? `<b>答对了</b>`
        : `<b>${ans.timedOut ? '超时' : '答错了'}</b>　${q.scenario ? '当如是' : '正确答案'}：${'ABCD'[q.answer]}．${esc(personalize(correctAct, this.playerName))}　${wrongTxt}`;
    // 选择按钮先给轻拨弦，结果页再落一枚“印章”；两层紧邻时合成一次完整落笔反馈。
    if (isChoice) play(ans.timedOut ? 'wrong' : 'confirm', { timedOut: !!ans.timedOut });
    else play(ok ? 'right' : 'wrong', { timedOut: !!ans.timedOut });
    const choiceDetail = isChoice && !ans.timedOut && choiceFeedback
      ? `<div class="quiz-choice-feedback"><b>${esc(choiceFeedback.resultText || '')}</b><br/><span>${esc(choiceFeedback.rewardText || '')}</span></div>`
      : '';
    box.innerHTML = `${head}${choiceDetail}<br/>${esc(q.analysis || '（本题暂无解析）')}
      <div style="margin-top:12px;text-align:right"><button class="btn btn-sm btn-ink" data-ok>知道了</button></div>`;
    ov.querySelector('.modal').appendChild(box);
    const cdEl = ov.querySelector('.countdown');
    if (cdEl) cdEl.style.display = 'none';

    await new Promise(res => box.querySelector('[data-ok]').addEventListener('click', res));
    this.close(ov);
    this._quizOv = null;
  }

  /* ---------------------------------------------------- 博闻抉择 */
  showBowenChoice() {
    return new Promise(resolve => {
      const options = [
        { id: 'focus', title: '专攻一体', desc: '选择诗、词或联之一，获得该文体 +3。' },
        { id: 'broad', title: '兼收并蓄', desc: '诗、词、联各 +1，并获得一次小型奇遇。' },
        { id: 'battle', title: '以学驭战', desc: '学力 +2、灵感 +2，下一场论战更从容。' }
      ];
      const ov = this.open(`<div class="modal scroll-frame paper bowen-choice"><div class="mtitle"><h2>博闻抉择</h2><span class="mtag">知识已成其用</span></div><div class="dianggu">腹笥既广，今当择其所用。</div><div class="opt-list">${options.map(o => `<button class="opt" data-id="${o.id}"><b>${o.title}</b><span>${o.desc}</span></button>`).join('')}</div></div>`);
      ov.querySelectorAll('[data-id]').forEach(btn => btn.addEventListener('click', () => { const id = btn.dataset.id; this.close(ov); resolve(id); }));
    });
  }

  /* ---------------------------------------------------- 方案 B · 三功 */
  showAbilityPanel(game) {
    const ov = this.open(`<div class="modal scroll-frame paper ability-panel" style="width:min(680px,calc(100vw - 24px))"></div>`);
    const box = ov.querySelector('.ability-panel');
    const render = (notice = '') => {
      const a = game.ensureAbilityState();
      const mc = game.abilityConfig().manuscript || {};
      const tc = game.techniqueConfig();
      const focus = new Set(a.study.focus || []);
      const nextFocus = new Set(a.study.nextFocus || a.study.focus || []);
      const plans = game.strategyPlans();
      const currentPlan = plans[a.strategy.plan] || {};
      const fb = game.abilityFeedback();
      const fmt = n => Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
      const attrs = ['shi', 'ci', 'lian', 'bi', 'xue', 'si'];
      const attrNames = { shi: '诗力', ci: '词力', lian: '联力', bi: '笔力', xue: '学力', si: '思力' };
      const latestMarks = (Array.isArray(game.s.choiceHistory) ? game.s.choiceHistory : []).slice(-3).reverse();
      const inkHighlights = typeof game.choiceInkHighlights === 'function' ? game.choiceInkHighlights(2) : [];
      const inkHighlightsBlock = inkHighlights.length ? `<h3>本局·主要倾向</h3><div class="dianggu">${inkHighlights.map((item, i) => {
        const mark = item.representative || {};
        const choice = mark.optionText || mark.questionId || '这一笔选择';
        return `<b>${i + 1}. ${esc(item.dominant)}</b> · ${esc(item.label)}<br/><span style="color:var(--mo-3)">代表选择：「${esc(choice)}」</span>`;
      }).join('<br/><br/>')}</div>` : '';
      const conversion = typeof game.talentConversionStatus === 'function' ? game.talentConversionStatus() : null;
      const conversionBlock = conversion && conversion.enabled ? `
        <hr class="hr-ink"/><h3>流派·问心转化</h3>
        <div class="dianggu"><b>${esc(conversion.rule.label || '问心转化')}</b>：${esc(conversion.rule.desc || '以流派专属资源叩问文心。')}<br/>消耗 ${conversion.resourceName} ${conversion.cost}，${Math.round(conversion.chance * 100)}% 概率获得一次三选一机会；本局 ${conversion.record.attempts}/${conversion.maxAttempts} 次，本阶段 ${conversion.phaseUsed}/${conversion.phaseLimit} 次。</div>
        <div class="opt-list"><button class="opt" data-talent-conversion ${conversion.available ? '' : 'disabled'}><b>${esc(conversion.rule.label || '问心转化')}</b><span>${conversion.available ? `投入 ${conversion.resourceName} ${conversion.cost}，叩问文心` : esc(conversion.reason)}</span></button></div>` : '';
      box.innerHTML = `<div class="mtitle"><h2>三功修习</h2><span class="mtag">成长 · 调度 · 沉淀</span></div>
        ${notice ? `<div class="analysis">${esc(notice)}</div>` : ''}
        <div class="dianggu"><b>心得 ${a.insight}/${fb.insightCap}</b>　构思 ${a.strategy.charges}/${fb.strategyCap}　稿页 ${a.manuscript.pages}/${fb.manuscriptCap}　残页 ${fmt(a.manuscript.fragments)}</div>
        <div class="dianggu" style="color:var(--mo-3)">学力管研修：安排属性成长方向，下一阶段生效。思力管章法：储存构思，按条件自动发动。笔力管稿本：积累稿页与残页，用于润色、刊行和定卷。</div>
        <div class="dianggu" style="color:var(--mo-3)">学力：研修 +${fmt(fb.studyRate)}/场、${fb.studySlots} 个研修位　思力：构思 +${fmt(fb.strategyIncome)}/阶段、余思 ${fmt(fb.strategyRemainder)}　笔力：残页 +${fmt(fb.manuscriptFragmentRate)}/战</div>
        <hr class="hr-ink"/><h3>思力·行文章法</h3>
        <div class="dianggu">当前：<b>${esc(currentPlan.name || '未定章法')}</b>。章法满足条件时自动发动，不中断回合；此处选择将在下阶段生效。</div>
        <div class="opt-list">${Object.entries(plans).map(([id, p]) => `<button class="opt" data-strategy-plan="${id}"><b>${a.strategy.nextPlan === id ? '✓ ' : ''}${esc(p.name || id)}</b><span>${esc(p.desc || '')}${a.strategy.plan === id ? ' · 当前生效' : ''}</span></button>`).join('')}</div>
        <h3>学力·研修位 ${a.study.focus.length}/${game.studySlots()}</h3>
        <div class="dianggu">当前研修：${a.study.focus.map(k => attrNames[k]).join('、')}。调整只在下阶段生效，既有进度会原样保留。</div>
        <div class="opt-list">${attrs.map(k => `<button class="opt" data-focus="${k}"><b>${nextFocus.has(k) ? '✓ ' : ''}${attrNames[k]}</b><span>进度 ${Number(a.study.progress[k]) || 0}/${Number((game.abilityConfig().study || {}).progressNeed) || 3}${focus.has(k) ? ' · 当前在修' : ''}</span></button>`).join('')}</div>
        <h3>分配心得</h3><div class="opt-list">${attrs.map(k => `<button class="opt" data-insight="${k}" ${a.insight < game.insightCost(k) ? 'disabled' : ''}><b>${attrNames[k]} +1</b><span>消耗 ${game.insightCost(k)} 心得</span></button>`).join('')}</div>
        ${conversionBlock}
        ${inkHighlightsBlock}
        ${latestMarks.length ? `<h3>墨痕·最近修习</h3><div class="dianggu">${latestMarks.map(mark => `「${esc(mark.optionText || mark.questionId)}」→ ${esc(attrNames[mark.target] || mark.target)}${mark.inkTags && mark.inkTags.length ? ` · ${esc(mark.inkTags.join('、'))}` : ''}`).join('<br/>')}</div>` : ''}
        <h3>笔力·稿本</h3><div class="opt-list">
          <button class="opt" data-manuscript="polish"><b>润色</b><span>下一场首次追加少耗 ${Number(mc.polishDiscount) || 2} 灵感</span></button>
          <button class="opt" data-manuscript="publish"><b>刊行</b><span>恢复 ${Number(mc.publishInspiration) || 4} 灵感</span></button>
          <button class="opt" data-manuscript="volume"><b>定卷</b><span>终局文采 +${Number(mc.volumeScore) || 60}（${a.manuscript.volumes}/${Number(mc.volumeCap) || 2}）</span></button>
        </div>
        <h3>技法筹备（方案 C）</h3><div class="dianggu">${['shi','ci','lian'].map(k => `${attrNames[k]}技法经验 ${Number(a.technique.xp[k]) || 0} · 阶 ${Number(a.technique.level[k]) || 0}/${(tc.thresholds || []).length}`).join('　')}</div>
        <div class="btn-row"><button class="btn btn-primary" data-close>收卷</button></div>`;
      box.querySelectorAll('[data-focus]').forEach(b => b.addEventListener('click', () => {
        const ok = game.toggleStudyFocus(b.dataset.focus); render(ok ? '下阶段研修方向已更新。' : '至少保留一个方向，且不能超过研修位上限。');
      }));
      box.querySelectorAll('[data-strategy-plan]').forEach(b => b.addEventListener('click', () => {
        const ok = game.setNextStrategyPlan(b.dataset.strategyPlan);
        render(ok ? '下阶段章法已更新；当前阶段仍按原章法执行。' : '章法不可用。');
      }));
      box.querySelectorAll('[data-insight]').forEach(b => b.addEventListener('click', () => {
        const r = game.spendInsight(b.dataset.insight); render(r.ok ? '心得已经兑现。' : r.reason);
      }));
      box.querySelectorAll('[data-manuscript]').forEach(b => b.addEventListener('click', () => {
        const r = game.spendManuscript(b.dataset.manuscript); render(r.ok ? '稿本已经付梓。' : r.reason);
      }));
      box.querySelector('[data-talent-conversion]')?.addEventListener('click', async () => {
        const r = await game.attemptSchoolTalentConversion();
        render(r.ok ? (r.reason || (r.talent ? `已收入「${r.talent.name}」。` : '问心转化已结算。')) : r.reason);
      });
      box.querySelector('[data-close]').addEventListener('click', () => this.close(ov));
    };
    render();
  }

  /* ---------------------------------------------------- 奇遇格 */
  showEvent(ev) {
    return new Promise(resolve => {
      const isChoice = ev.kind === 'choice';
      const btns = isChoice
        ? (ev.choices || []).map((c, i) => {
            const sub = effectBrief(c.effect);
            return `<button class="opt" data-i="${i}"><span class="idx">${i + 1}</span><span>${esc(personalize(c.text, this.playerName))}
              ${sub ? `<div class="sub">${sub}</div>` : ''}</span></button>`;
          }).join('')
        : `<div style="text-align:center;margin-top:18px">
             <button class="btn btn-primary" data-i="0">${ev.kind === 'challenge' ? '接下挑战' : '欣然领受'}</button></div>`;

      const ov = this.open(`
        <div class="event-card-wrap">
          <div class="event-card paper r-${ev.rarity}">
            <span class="rarity-tag r-${ev.rarity}">${RARITY_CN[ev.rarity] || '普通'}奇遇</span>
            <div class="event-illustration" aria-hidden="true">${EVENT_VIGNETTE[isChoice ? 'choice' : (ev.kind === 'challenge' ? 'challenge' : 'encounter')]}</div>
            <h3>${esc(ev.name)}</h3>
            <div class="etext">${esc(personalize(ev.text, this.playerName))}</div>
            ${!isChoice && ev.kind !== 'challenge' && effectBrief(ev.effect) ? `<div class="etext" style="margin-top:10px;color:#8a5a12">${effectBrief(ev.effect)}</div>` : ''}
            ${ev.kind === 'challenge' && effectBrief(ev.challenge.winAll) ? `<div class="etext" style="margin-top:10px;color:#b23a2e">连战 ${ev.challenge.battles} 场，全胜可得：${effectBrief(ev.challenge.winAll)}</div>` : ''}
            <div class="opt-list">${isChoice ? btns : ''}</div>
            ${isChoice ? '' : btns}
          </div>
        </div>`);

      if (ev.rarity === 'legend') goldBurst(ov);

      ov.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
        this.close(ov);
        resolve(Number(b.dataset.i));
      }));
    });
  }

  /* ---------------------------------------------------- 布局谋篇·地图移动骰 */
  showPlannedMovePrompt(game) {
    return new Promise(resolve => {
      const t = game && game.s && game.s.active && game.s.active.find(x => (x.effect || {}).type === 'planned_dice');
      if (!t) { resolve(false); return; }
      const ef = t.effect || {};
      const cost = typeof game.plannedMoveCost === 'function' ? game.plannedMoveCost() : Math.max(1, Number(ef.baseCost ?? t.cost) || 1);
      const afford = Number(game.s.inspiration) >= cost;
      const max = Math.max(1, Number(ef.maxValue) || 6);
      const options = Array.from({ length: max }, (_, i) => `<option value="${i + 1}">${i + 1} 格</option>`).join('');
      const ov = this.open(`<div class="modal paper compact-modal">
        <div class="mtitle"><h2>布局谋篇</h2><span class="mtag">回合移动定策</span></div>
        <div class="dianggu">胸中先有丘壑，落笔方能从容。定策后，点「掷骰」即按此点数移动。</div>
        <div style="text-align:center;margin:16px 0"><select data-move-dice aria-label="指定本回合移动骰">${options}</select></div>
        <div style="text-align:center;color:var(--mo-3);font-size:13px">本局第 ${Number((game.s.talentState && game.s.talentState.activeUses && game.s.talentState.activeUses[t.id]) || 0) + 1} 次使用，消耗灵感 ${cost}</div>
        <div class="btn-row"><button class="btn btn-primary" data-plan ${afford ? '' : 'disabled'}>定策</button><button class="btn btn-ink" data-skip>暂不</button></div>
      </div>`, 'planned-move-modal');
      const finish = ok => { this.close(ov); resolve(ok); };
      ov.querySelector('[data-plan]')?.addEventListener('click', () => {
        const value = Number(ov.querySelector('[data-move-dice]')?.value) || max;
        finish(game.planMoveDice(value));
      });
      ov.querySelector('[data-skip]')?.addEventListener('click', () => finish(false));
    });
  }

  /* ---------------------------------------------------- 文心卡 */
  async showTalentGain(t) {
    const ov = this.open(`
      <div class="talent-card paper ${t.kind === 'active' ? 'act' : ''}">
        <div class="kind">${t.kind === 'active' ? `主动文心　消耗灵感 ${t.cost || 1}` : '被动文心　常驻生效'}</div>
        <h3>${esc(t.name)}</h3>
        <div class="efx">${talentEffectText(t)}</div>
        <div class="dianggu">${esc(personalize(t.text || '', this.playerName))}</div>
        <div class="dianggu" style="margin-top:10px;color:var(--mo-3)">获得后可在右侧“文心”栏查看；点击已有文心，可查看当前等级、下一级效果与升级所需灵感。</div>
        <div style="text-align:center;margin-top:16px"><button class="btn btn-primary" data-ok>收入囊中</button></div>
      </div>`);
    play('talent');
    await new Promise(r => ov.querySelector('[data-ok]').addEventListener('click', r));
    this.close(ov);
  }

  /**
   * 查看已拥有文心的属性 / 效果；并在此处直接升级。
   * 升级操作：玩家点开「文心」（HUD 文心栏点击）即可在此花费灵感提升该文心等级，
   * 实时展示当前等级效果、下一级预览与成本，灵感不足/已满级时按钮禁用并说明原因。
   */
  showTalentDetail(t) {
    const id = t.id;
    const up = (this.cfg.talentUpgradeById && this.cfg.talentUpgradeById.get(id)) || null;
    const QLABEL = { common: '普通', rare: '稀有', epic: '史诗', legend: '传说' };
    const heldTalent = () => {
      const s = this.game && this.game.s;
      return (s && [...(s.passive || []), ...(s.active || [])].find(x => x.id === id)) || t;
    };
    const lvlOf = () => (this.game && this.game.s.talentLevels[id]) || 1;

    const render = () => {
      // HUD 会在升级时重绘并替换槽位数组；详情页必须每次从 game.s 取当前持有副本，
      // 不能继续使用打开弹窗时传入的旧对象，否则 effect/cost 会停在升级前。
      const current = heldTalent();
      const level = lvlOf();
      const max = up ? up.maxLevel : 1;
      const insp = this.game ? this.game.s.inspiration : Infinity;
      const isActive = current.kind === 'active';
      const kindLine = isActive
        ? `主动文心　消耗灵感 ${current.cost != null ? current.cost : 1}`
        : '被动文心　常驻生效';
      const lvlLine = up ? `　·　${QLABEL[up.quality] || up.quality}　Lv ${level}/${max}` : '';

      let nextHtml = '';
      let btnHtml = `<div class="btn-row"><button class="btn btn-ink" data-ok>知道了</button></div>`;
      if (up && level < max) {
        const nextEntry = up.levels[level] || {};
        const nEff = JSON.parse(JSON.stringify(nextEntry.effect || current.effect || {}));
        const nCost = up.upCost[level - 1];
        const can = insp >= nCost;
        const nextActiveCost = isActive && nextEntry.cost != null ? `　·　发动消耗 ${nextEntry.cost}` : '';
        nextHtml = `
          <div class="up-next">
            <div class="up-next-h">下一级（Lv${level + 1}）· 升级消耗灵感 ${nCost}${nextActiveCost}</div>
            <div class="efx up-next-efx">${talentEffectText({ ...current, effect: nEff, cost: nextEntry.cost ?? current.cost })}</div>
          </div>`;
        const disabled = can ? '' : 'disabled style="opacity:.45;cursor:not-allowed"';
        const label = can ? `升级（消耗灵感 ${nCost}）` : `灵感不足（需 ${nCost}）`;
        btnHtml = `
          <div class="btn-row">
            <button class="btn btn-primary" data-up="1" ${disabled}>${label}</button>
            <button class="btn btn-ink" data-ok>知道了</button>
          </div>`;
      } else if (up && level >= max) {
        nextHtml = `<div class="up-next"><div class="up-next-h" style="color:var(--zhu)">已达满级（Lv${max}）</div></div>`;
      }

      return `
        <div class="talent-card paper ${isActive ? 'act' : ''}">
          <div class="kind">${kindLine}${lvlLine}</div>
          <h3>${esc(current.name)}${up ? `　<span class="lvbadge">Lv ${level}/${max}</span>` : ''}</h3>
          <div class="efx">${talentEffectText(current)}</div>
          ${nextHtml}
          <div class="dianggu">${esc(personalize(current.text || '', this.playerName))}</div>
          <div class="dianggu" style="margin-top:10px;color:var(--mo-3)">升级只消耗灵感；主动文心需在论战中发动，被动文心会常驻生效。</div>
          ${btnHtml}
        </div>`;
    };

    const ov = this.open(render(), 'talent-detail');
    let done = false;
    const fin = () => { if (!done) { done = true; this.close(ov); } };
    const rebind = () => {
      ov.querySelector('[data-ok]')?.addEventListener('click', fin);
      ov.querySelector('[data-up]')?.addEventListener('click', async () => {
        if (!this.game) return;
        const res = await this.game.upgradeTalent(id);
        if (res.ok) {
          this.game.ui.onState(this.game.s);                 // 刷新 HUD（灵感/属性/上限/文心槽）
          // 原地重渲染弹窗内容（保留不关闭），并重新读取当前副本，支持连续升级。
          const card = ov.querySelector('.talent-card');
          if (card) card.outerHTML = render().trim();
          rebind();
          const current = heldTalent();
          if (this.game.ui.toast) this.game.ui.toast(`「${current.name}」精进至 Lv${res.level}`);
        } else {
          if (this.game.ui.toast) this.game.ui.toast(res.reason || '无法升级');
        }
      });
    };
    rebind();
    return new Promise(resolve => {
      // 仅「知道了」关闭弹窗；升级成功后保持打开以便连续升级
      const obs = new MutationObserver(() => { if (!ov.isConnected) { obs.disconnect(); resolve(); } });
      obs.observe(this.layer, { childList: true });
    });
  }

  /** 超限替换弹窗；返回被替换下标，null = 放弃新卡 */
  askReplaceTalent(nw, list) {
    return new Promise(resolve => {
      const ov = this.open(`
        <div class="modal scroll-frame paper" style="width:min(560px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px))">
          <div class="mtitle"><h2>文心已满</h2><span class="mtag">${nw.kind === 'active' ? `主动上限 ${ACTIVE_MAX}` : `被动上限 ${PASSIVE_MAX}`}</span></div>
          <hr class="hr-ink"/>
          <div style="font-size:16px;line-height:1.8">新得「<b style="color:var(--zhu)">${esc(nw.name)}</b>」——${talentEffectText(nw)}<br/>
            <span style="font-size:13px;color:var(--mo-3)">请选择要替换下去的一枚，或放弃新文心。</span></div>
          <div class="replace-list">
            ${list.map((t, i) => `<button class="replace-item" data-i="${i}">
              <b>${esc(t.name)}</b><p>${talentEffectText(t)}</p></button>`).join('')}
          </div>
          <div class="btn-row"><button class="btn btn-ink" data-i="-1">放弃新文心</button></div>
        </div>`);
      ov.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
        const i = Number(b.dataset.i);
        this.close(ov);
        resolve(i < 0 ? null : i);
      }));
    });
  }

  /* ---------------------------------------------------- 名胜格·访胜抽签 */
  askScenic(cell, cost = 8, curInsp = Infinity, sideQuestMeta = {}) {
    return new Promise(resolve => {
      const canDraw = curInsp >= cost;
      const journal = sideQuestMeta && sideQuestMeta.sideQuest;
      const activeRoute = journal && journal.route;
      const offerPending = !!(journal && journal.state && journal.state.talentOfferGenerated && !journal.state.talentClaimedId && !journal.state.talentOfferExpired);
      const canStartSideQuest = !!(sideQuestMeta && sideQuestMeta.canStartSideQuest);
      const name = String(cell && cell.name || '');
      const artKey = /玉门|边关|关/.test(name) ? 'biansai'
        : (/桃花|山水|源/.test(name) ? 'shanshui'
          : (/白鹿|书院|堂|洞/.test(name) ? 'shuyuan' : 'yuyuan'));
      const ov = this.open(`
        <div class="modal scroll-frame paper branch-modal">
          <div class="mtitle" style="justify-content:center"><h2>${esc(cell.name)}</h2></div>
          <hr class="hr-ink"/>
          <div class="bimg" aria-hidden="true">${LANDMARK_ART[artKey] || LANDMARK_ART.yuyuan}</div>
          <div style="font-size:17px;line-height:1.9">驻足名胜，可焚香祈愿、抽签问文心，也可由此另启一段行路。</div>
          <div class="rewards">访胜问心：消耗灵感 ${cost} 点，随机抽取一枚尚未拥有的文心</div>
          <div class="warn" style="color:#b23a2e">${canDraw ? '抽签后灵感将减少，请斟酌' : '当前灵感不足，无法抽签'}</div>
          ${activeRoute ? `<div class="dianggu" style="margin-top:10px;text-align:left"><b>行卷 · ${esc(activeRoute.name)}</b><br/>当前：${esc((journal.state || {}).stage || '进行中')}。名胜不会更换你的路线。</div>` : ''}
          <div class="btn-row">
            <button class="btn btn-primary" data-go="draw" ${canDraw ? '' : 'disabled style="opacity:.45;cursor:not-allowed"'}>访胜问心</button>
            ${canStartSideQuest ? '<button class="btn btn-ink" data-go="sidequest">入世另行</button>' : ''}
            ${activeRoute ? '<button class="btn btn-ink" data-go="journal">查看行卷</button>' : ''}
            ${offerPending ? '<button class="btn btn-primary" data-go="talent">行路凝心</button>' : ''}
            <button class="btn btn-ink" data-go="leave">览胜离开</button>
          </div>
        </div>`);
      ov.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
        if (b.disabled) return;
        this.close(ov); resolve(b.dataset.go);
      }));
    });
  }

  chooseSideQuest(routes, cell) {
    const list = Array.isArray(routes) ? routes.filter(Boolean) : [];
    return new Promise(resolve => {
      if (!list.length) { resolve(''); return; }
      const ov = this.open(`
        <div class="modal scroll-frame paper scenic-pick-modal">
          <div class="mtitle" style="justify-content:center"><h2>入 世 另 行</h2></div><hr class="hr-ink"/>
          <div class="scenic-pick-intro">此行将锁定一条支线，并放弃本次文心抽取。不是另开地图，而是让之后的一次取舍与一场论战照见你的来路。</div>
          <div class="scenic-pick-list">${list.map(route => `<button class="scenic-pick-card talent-card paper" data-route="${esc(route.id)}" type="button"><h3>${esc(route.name)}</h3><span class="efx">${esc((route.axis || []).join(' ↔ '))}</span><span class="dianggu">${esc(route.intro || '')}</span><span class="scenic-pick-keep">以此道启程</span></button>`).join('')}</div>
          <div class="btn-row"><button class="btn btn-ink" data-cancel type="button">暂不承诺</button></div>
        </div>`, 'sidequest-route');
      const finish = value => { this.close(ov); resolve(value); };
      ov.querySelectorAll('[data-route]').forEach(btn => btn.addEventListener('click', () => finish(btn.dataset.route)));
      ov.querySelector('[data-cancel]')?.addEventListener('click', () => finish(''));
    });
  }

  showSideQuestAct(route, act, opts = {}) {
    const choices = Array.isArray(act && act.options) ? act.options : [];
    return new Promise(resolve => {
      if (!choices.length) { resolve(-1); return; }
      const ov = this.open(`
        <div class="modal scroll-frame paper" style="width:min(620px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px));text-align:center">
          <div class="kind">${esc(route && route.name || '行卷')}</div><div class="title-ink" style="font-size:34px">${esc(act.title || '行路抉择')}</div><hr class="hr-ink"/>
          <div style="font-size:16px;line-height:2;text-align:left;white-space:pre-line">${esc(act.text || '')}</div>
          ${opts.late ? '<div class="warn" style="margin-top:10px">终局将近：此选择只留下立场，不再补发即时收益。</div>' : ''}
          <div class="pick-row" style="margin-top:16px">${choices.map((option, i) => `<button class="pick" data-choice="${i}" type="button"><div class="pn">${esc(option.label || option.id)}</div><div class="pv">${esc(option.axis || '')}</div></button>`).join('')}</div>
        </div>`, 'sidequest-act');
      const finish = value => { this.close(ov); resolve(value); };
      ov.querySelectorAll('[data-choice]').forEach(btn => btn.addEventListener('click', () => finish(Number(btn.dataset.choice))));
    });
  }

  async showSideQuestComplete(route, state) {
    const won = state && state.climaxResult === 'win';
    const ov = this.open(`
      <div class="modal scroll-frame paper" style="width:min(560px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px));text-align:center">
        <div class="kind">行 卷 已 成</div><div class="title-ink" style="font-size:36px">${esc(route && route.name || '支线')}</div><hr class="hr-ink"/>
        <div style="font-size:17px;line-height:2">${won ? '此道已应验，得路线功业 2。' : '此道虽未竟，仍得路线功业 1。'}<br/>终局前，你可选择携此道赴问，或放下此道换回从容。</div>
        <div class="btn-row"><button class="btn btn-primary" data-ok>收进行卷</button></div>
      </div>`, 'sidequest-complete');
    await new Promise(resolve => ov.querySelector('[data-ok]').addEventListener('click', resolve));
    this.close(ov);
  }

  showSideQuestJournal(journal = {}) {
    const route = journal.route || {};
    const state = journal.state || {};
    const rows = (journal.choices || []).map(choice => `<div class="dianggu" style="margin-top:8px;text-align:left">${esc(choice.actId || '行路')}：${esc(choice.axis || choice.optionId || '未定')}</div>`).join('') || '<div class="dianggu">尚未落笔。</div>';
    const offer = Array.isArray(journal.talentOffer) ? journal.talentOffer : [];
    const offerText = offer.length ? `<div class="dianggu" style="margin-top:10px;text-align:left"><b>行路凝心候选</b>：${offer.map(t => esc(t.name)).join('、')}<br/>${state.talentClaimedId ? '已收入一枚限定文心。' : (state.talentOfferExpired ? '候选已随终战散去。' : `可于任一名胜支付 ${Number(state.talentClaimCost) || 6} 灵感领取一枚。`)}</div>` : '';
    return new Promise(resolve => {
      const ov = this.open(`<div class="modal scroll-frame paper" style="width:min(560px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px));text-align:center"><div class="kind">行 卷</div><div class="title-ink" style="font-size:34px">${esc(route.name || '未入支线')}</div><hr class="hr-ink"/><div style="color:var(--mo-2)">当前幕次：${esc(state.stage || 'none')}　功业：${Number(state.merit) || 0}</div>${rows}${offerText}<div class="btn-row"><button class="btn btn-primary" data-ok>合卷</button></div></div>`, 'sidequest-journal');
      ov.querySelector('[data-ok]').addEventListener('click', () => { this.close(ov); resolve(); });
    });
  }

  askSideQuestFinal(meta = {}) {
    const route = meta.route || {};
    const merit = Math.max(1, Number(meta.merit) || 1);
    return new Promise(resolve => {
      const carryText = meta.canCarry ? `灵感 -${meta.cost}，本场最终作品得分 +${merit === 2 ? 10 : 6}%` : (meta.lateNoCarry ? '此行来得太晚，只能留下回声' : `灵感需保留至少 ${Number(meta.cost) + 1} 点`);
      const ov = this.open(`<div class="modal scroll-frame paper" style="width:min(620px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px));text-align:center"><div class="kind">终 局 问 心</div><div class="title-ink" style="font-size:36px">${esc(route.finalLabel || route.name || '终问')}</div><hr class="hr-ink"/><div style="font-size:16px;line-height:1.95">你此前走过的路，要成为此刻的锋芒，还是成为放下锋芒后的余裕？</div><div class="pick-row" style="margin-top:16px"><button class="pick" data-final="carry" ${meta.canCarry ? '' : 'disabled style="opacity:.45"'}><div class="pn">携道赴问</div><div class="pv">${esc(carryText)}</div></button><button class="pick" data-final="release"><div class="pn">放下此道</div><div class="pv">恢复灵感 ${merit === 2 ? 4 : 2}，不获终战得分加成</div></button></div></div>`, 'sidequest-final');
      const finish = value => { this.close(ov); resolve(value); };
      ov.querySelectorAll('[data-final]').forEach(btn => btn.addEventListener('click', () => { if (!btn.disabled) finish(btn.dataset.final); }));
    });
  }

  /** 名胜格三选一：候选仅供查看，返回下标；取消返回 -1。 */
  chooseScenicTalent(candidates, meta = {}) {
    const list = Array.isArray(candidates) ? candidates.filter(Boolean) : [];
    return new Promise(resolve => {
      if (!list.length) { resolve(-1); return; }
      const count = list.length;
      const cards = list.map((t, i) => `
        <button class="scenic-pick-card talent-card paper ${t.kind === 'active' ? 'act' : ''}" data-i="${i}" type="button">
          <span class="scenic-pick-no">${i + 1}</span>
          <span class="kind">${t.kind === 'active' ? `主动文心　消耗灵感 ${t.cost || 1}` : '被动文心　常驻生效'}</span>
          <h3>${esc(t.name)}</h3>
          <span class="efx">${talentEffectText(t)}</span>
          <span class="dianggu">${esc(personalize(t.text || '', this.playerName))}</span>
          <span class="scenic-pick-keep">选择此枚</span>
        </button>`).join('');
      const ov = this.open(`
        <div class="modal scroll-frame paper scenic-pick-modal">
          <div class="mtitle" style="justify-content:center"><h2>${esc(meta.title || '访 胜 · 三签择一')}</h2></div>
          <hr class="hr-ink"/>
          <div class="scenic-pick-intro">${esc(meta.intro || (count === 3 ? '三张文心已现，请择一收入囊中；其余两张将自动弃置。' : `当前文心池仅余 ${count} 张，择一收入囊中；未选文心将自动弃置。`))}</div>
          <div class="scenic-pick-cost">${esc(meta.costText || `确认选择后消耗灵感 ${Number(meta.cost) || 0} 点`)}</div>
          <div class="scenic-pick-list">${cards}</div>
          <div class="btn-row"><button class="btn btn-ink" data-cancel type="button">${esc(meta.cancelText || '暂不取签')}</button></div>
        </div>`, 'scenic-pick');
      let done = false;
      const finish = value => {
        if (done) return;
        done = true;
        this.close(ov);
        resolve(value);
      };
      ov.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => finish(Number(b.dataset.i))));
      ov.querySelector('[data-cancel]')?.addEventListener('click', () => finish(-1));
    });
  }

  /* ---------------------------------------------------- 天象 */
  /** 天象弹窗：展示卡面；若配置了应势选项，玩家须择其一或「顺其自然」（resolve 值为 choiceId 或 null）。 */
  async showSky(card) {
    const choices = Array.isArray(card && card.choices) ? card.choices.filter(c => c && c.id) : [];
    const hasChoices = choices.length > 0;
    const isOnce = (card.effect || {}).type === 'next_battle_pct';
    const choiceList = hasChoices ? `
        <div class="sky-choice-title">应势一念 · 请择其一</div>
        <div class="sky-choice-list">${choices.map(c => `
          <button class="sky-choice" data-choice="${esc(c.id)}" type="button">
            <b>${esc(c.name || c.id)}</b><span>${esc(c.desc || '')}</span>${Number(c.effect && c.effect.cost) > 0 ? `<em class="sky-choice-cost">消耗构思 ${Number(c.effect.cost)}</em>` : ''}
          </button>`).join('')}</div>` : '';
    const buttons = hasChoices
      ? '<button class="btn btn-ink" data-cancel>顺其自然</button>'
      : '<button class="btn btn-ink" data-ok>观星毕</button>';
    const ov = this.open(`
      <div class="talent-card paper" style="border-color:#7f95cf;box-shadow:0 16px 40px rgba(0,0,0,.5),0 0 34px rgba(127,149,207,.55)">
        <div class="kind">天象　${isOnce ? '下一场论战 · 一次性' : `持续 ${card.turns || 6} 回合`}</div>
        <div class="sky-ico" style="font-size:46px;text-align:center;line-height:1.15">${card.icon ? esc(card.icon) : '✦'}</div>
        <h3>${esc(card.name)}</h3>
        <div class="dianggu" style="background:rgba(76,102,168,.13);border-left-color:#4a5a80">${esc(personalize(card.text || '', this.playerName))}</div>
        <div class="efx" style="color:#3a4a80">${skyEffectText(card)}</div>
        ${choiceList}
        <div class="btn-row" style="margin-top:14px;justify-content:center">${buttons}</div>
      </div>`);
    play('sky');
    return new Promise(resolve => {
      let done = false;
      const finish = value => { if (done) return; done = true; this.close(ov); resolve(value); };
      ov.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => finish(b.dataset.choice)));
      ov.querySelector('[data-cancel]')?.addEventListener('click', () => finish(null));
      ov.querySelector('[data-ok]')?.addEventListener('click', () => finish(null));
    });
  }

  /* ---------------------------------------------------- 开局序章 / 阶段叙事 */
  /** 第0回合前显示的开局序章；点击确认后才进入首回合。文案来自 config/narrative.prologue。 */
  async showPrologue() {
    const N = narrativeOf(this.cfg);
    return this.showStageIntro(N.prologue.title, N.prologue.text, N.prologue.button);
  }
  async showKickoffTutorial() {
    const N = narrativeOf(this.cfg);
    return this.showStageIntro(N.tutorial.kickoff.title, N.tutorial.kickoff.text, N.tutorial.kickoff.button);
  }
  async showBattleTutorial() {
    const N = narrativeOf(this.cfg);
    return this.showStageIntro(N.tutorial.battle.title, N.tutorial.battle.text, N.tutorial.battle.button);
  }
  /** 阶段变化说明：会试圈 / 殿试由引擎在相应节点调用。 */
  async showStageIntro(title, text, button = '谨记于心') {
    const kind = (narrativeOf(this.cfg).stageChange.kind) || '科 场 叙 事';
    const ov = this.open(`
      <div class="modal scroll-frame paper stage-intro" style="width:min(680px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px))">
        <div class="kind">${esc(kind)}</div>
        <div class="title-ink" style="font-size:38px;text-align:center">${esc(title)}</div>
        <hr class="hr-ink"/>
        <div class="stage-story" style="font-size:16px;line-height:2.05;letter-spacing:.04em;text-align:left;white-space:pre-line;overflow:auto;padding:0 8px">${esc(text)}</div>
        <div class="btn-row"><button class="btn btn-primary" data-ok>${esc(button)}</button></div>
      </div>`, 'stage-intro');
    play('stage');
    await new Promise(r => ov.querySelector('[data-ok]').addEventListener('click', r));
    this.close(ov);
  }
  async showLap2Intro() {
    const N = narrativeOf(this.cfg);
    return this.showStageIntro(N.lap2Intro.title, N.lap2Intro.text, N.lap2Intro.button);
  }
  /** 阶段晋阶弹窗（外圈→中圈 / 中圈→内圈 / 基础功名已立）；文案来自 config/narrative.stageChange。 */
  async showStageChange(gate = {}) {
    const N = narrativeOf(this.cfg);
    const names = N.stageChange.names;
    const name = names[gate.phase] || gate.phase || '新阶段';
    const tpl = N.stageChange;
    const text = gate.transition === 'middle'
      ? tpl.middle
      : gate.transition === 'inner'
        ? tpl.inner
        : tpl.default;
    const title = (tpl.titleTpl || '{name}阶段 · 晋阶试').replace(/\{name\}/g, name);
    const button = (tpl.buttonTpl || '进入{name}阶段').replace(/\{name\}/g, name);
    const ink = String(gate.inkSummary || '').trim();
    const tactics = Array.isArray(gate.chapterTactics) ? gate.chapterTactics : [];
    const echoes = Array.isArray(gate.echoes) ? gate.echoes : [];
    const relations = Array.isArray(gate.relations) ? gate.relations : [];
    const cards = (items, kind) => items.map(item => `
      <div class="dianggu" style="margin-top:9px;text-align:left">
        <b style="letter-spacing:.08em">${esc(item.title || kind)}</b>
        <div style="margin-top:3px;line-height:1.75">${esc(item.text || '')}</div>
      </div>`).join('');
    const tacticCards = tactics.map(item => ({ title: `${item.axisLabel} · ${item.title}`, text: item.text }));
    const ov = this.open(`
      <div class="modal scroll-frame paper" style="width:min(620px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px));text-align:center">
        <div class="kind">${esc(tpl.kind || '科 场 叙 事')}</div>
        <div class="title-ink" style="font-size:40px">${esc(title)}</div>
        <hr class="hr-ink"/>
        <p style="white-space:pre-line;font-size:15px;line-height:1.9;color:var(--mo-2);margin:0">${esc(text)}</p>
        ${ink ? `<div class="dianggu" style="margin-top:12px;text-align:left">${esc(ink)}</div>` : ''}
        ${tacticCards.length ? `<div style="margin-top:14px;font-size:14px;letter-spacing:.16em;color:var(--mo-2)">行 卷 章 法</div>${cards(tacticCards, '章法')}` : ''}
        ${echoes.length ? `<div style="margin-top:14px;font-size:14px;letter-spacing:.16em;color:var(--mo-2)">旧 选 回 声</div>${cards(echoes, '回声')}` : ''}
        ${relations.length ? `<div style="margin-top:14px;font-size:14px;letter-spacing:.16em;color:var(--mo-2)">故 人 来 笺</div>${cards(relations, '来笺')}` : ''}
        <div class="btn-row"><button class="btn btn-primary" data-ok>${esc(button)}</button></div>
      </div>`, 'stage-change');
    const ok = ov.querySelector('[data-ok]');
    setTimeout(() => ok.focus(), 30);
    await new Promise(r => ok.addEventListener('click', r));
    this.close(ov);
  }

  /* ---------------------------------------------------- 当朝文风（风潮） */
  /** 首回合开始前弹窗：说明本局当朝文风（风潮）及其效果 */
  async showZeitgeist(z) {
    const af = this.cfg.affinity || {};
    const themeNames = af.themeNames || {};
    const mannerNames = af.mannerNames || {};
    const themeBonus = Math.round((af.zeitgeistThemeBonus ?? 0) * 100);
    const mannerBonus = Math.round((af.zeitgeistMannerBonus ?? 0) * 100);
    const themeName = themeNames[(z && z.theme)] || (z && z.theme) || '某题材';
    const mannerName = mannerNames[(z && z.manner)] || (z && z.manner) || '某文体';
    const N = narrativeOf(this.cfg).zeitgeist;
    const ov = this.open(`
      <div class="modal scroll-frame paper zg-card" style="width:min(560px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px));text-align:center">
        <div class="kind">${esc(N.kind)}</div>
        <div class="title-ink" style="font-size:38px">${esc(N.title)}</div>
        <hr class="hr-ink"/>
        <p style="font-size:15px;line-height:1.9;color:var(--mo-2);margin:0 0 12px">${esc(N.lead)}</p>
        <div class="zg-row">
          <div class="zg-k">热点题材</div>
          <div class="zg-v">「${esc(themeName)}」</div>
          <div class="zg-d">凡涉此题材之论战，不论用何文体，得分 <b class="up">+${themeBonus}%</b></div>
        </div>
        <div class="zg-row">
          <div class="zg-k">得势文体</div>
          <div class="zg-v">「${esc(mannerName)}」</div>
          <div class="zg-d">无论何题材，凡用此文体者，得分 <b class="up">+${mannerBonus}%</b></div>
        </div>
        <div class="zg-note">${esc(N.note)}</div>
        <div class="btn-row"><button class="btn btn-primary" data-ok>${esc(N.button)}</button></div>
      </div>`, 'zeitgeist-intro');
    await new Promise(r => ov.querySelector('[data-ok]').addEventListener('click', r));
    this.close(ov);
  }

  /* ---------------------------------------------------- 殿试开场 */
  async showPalaceIntro(themes, names, inkSummary = '', questions = [], echoes = [], sideQuestFinal = null) {
    // 圈数、殿试场次、金榜奖励分全部从配置读取；殿试题材由主考官配置决定
    const boardCfg = this.cfg.board || {};
    const isSpiral = boardCfg.layout === 'concentric_spiral';
    const laps = isSpiral ? 3 : (boardCfg.laps ?? 2);
    const grades = this.cfg.grades;
    const dim = ((grades || {}).dimensions || []).find(d => d.key === 'yuanman');
    const jb = ((dim || {}).bonuses || []).find(x => x.id === 'jinbangtiming');
    const sweepN = isSpiral ? 1 : ((themes && themes.length) ? themes.length : (((jb || {}).cond || {}).value ?? 3));
    const sweepScore = bonusScore(grades, 'yuanman', 'jinbangtiming', 200);
    const themeLabels = (names && names.length) ? names : (themes || ['咏物', '送别', '怀古']);
    const questionCards = (Array.isArray(questions) ? questions : []).map((item, index) => `
      <div class="dianggu" style="margin-top:8px;text-align:left">
        <b>${index + 1}. ${esc(item.examiner || '主考官')} · ${esc(item.key || '问')}</b>
        <div style="margin-top:3px;line-height:1.7">${esc(item.prompt || '')}</div>
        ${item.reading ? `<div style="margin-top:4px;color:var(--mo-2);line-height:1.7">${esc(item.reading)}</div>` : ''}
      </div>`).join('');
    const echoCards = (Array.isArray(echoes) ? echoes : []).map(item => `<div class="dianggu" style="margin-top:8px;text-align:left"><b>${esc(item.title || '旧选回声')}</b><div style="margin-top:3px;line-height:1.7">${esc(item.text || '')}</div></div>`).join('');
    const ov = this.open(`
      <div class="modal scroll-frame paper" style="text-align:center;width:min(600px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px))">
        <div class="title-ink" style="font-size:46px">${esc(sideQuestFinal && sideQuestFinal.route && sideQuestFinal.route.finalLabel || '金 殿 對 策')}</div>
        <hr class="hr-ink"/>
        <div style="font-size:17px;line-height:2">${laps} 圈科举路已尽，今登金殿。<br/>
          主考官出题 ${sweepN} 道：<b>${themeLabels.join('</b>、<b>')}</b>${isSpiral ? '，一场定榜。' : '，须连场应对。'}<br/>
          <span style="color:var(--zhu)">${isSpiral ? '此场取胜' : `${sweepN} 场全胜`}，可得「${esc((jb || {}).name || '金榜题名')}」圆满分 +${sweepScore}。</span></div>
        ${sideQuestFinal ? `<div class="dianggu" style="margin-top:12px;text-align:left"><b>行卷 · ${esc(sideQuestFinal.route.name)}</b><br/>${sideQuestFinal.state.finalChoice === 'carry' ? `携道赴问：本场作品得分将获得路线功业加成。` : '放下此道：你以从容进入终问。'}</div>` : ''}
        ${String(inkSummary || '').trim() ? `<div class="dianggu" style="margin-top:12px;text-align:left">${esc(String(inkSummary).trim())}</div>` : ''}
        ${questionCards ? `<div style="margin-top:14px;font-size:14px;letter-spacing:.16em;color:var(--mo-2)">殿 试 三 问</div>${questionCards}` : ''}
        ${echoCards ? `<div style="margin-top:14px;font-size:14px;letter-spacing:.16em;color:var(--mo-2)">旧 选 回 声</div>${echoCards}` : ''}
        <div class="btn-row"><button class="btn btn-primary" data-ok>整冠入殿</button></div>
      </div>`, 'palace-intro');
    goldBurst(ov, 40);
    const ok = ov.querySelector('[data-ok]');
    setTimeout(() => ok.focus(), 30);
    await new Promise(r => ok.addEventListener('click', r));
    this.close(ov);
  }

  /* ---------------------------------------------------- 隐藏终圈 */
  /**
   * 三项条件全部达成后才会调用，因此这里不承担信息侦测，只把玩家已经完成的
   * 收集、造诣与殿试分数重新列明，并给出一次明确选择。
   */
  askHiddenFinal(meta = {}) {
    const N = narrativeOf(this.cfg).hiddenFinal.invite;
    const ratio = Number(meta.scoreRatioNeed) || 2;
    const rows = [
      `传世名篇 ${Number(meta.albumCount) || 0}/${Number(meta.albumTotal) || 0}`,
      `本局流派造诣 Lv${Number(meta.masteryLevel) || 1}（要求 Lv${Number(meta.masteryNeed) || 5}）`,
      `殿试 ${Number(meta.playerScore) || 0} 分 / 主考官 ${Number(meta.opponentScore) || 0} 分（要求 ≥ ${ratio} 倍）`
    ];
    return new Promise(resolve => {
      const ov = this.open(`
        <div class="modal scroll-frame paper hidden-final-invite" style="text-align:center;width:min(600px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px))">
          <div class="kind">${esc(N.kind)}</div>
          <div class="title-ink" style="font-size:42px">${esc(N.title)}</div>
          <hr class="hr-ink"/>
          <div style="font-size:16px;line-height:2;white-space:pre-line">${esc(personalize(N.text, this.playerName))}</div>
          <div style="margin:16px auto 2px;max-width:470px;text-align:left;border:1px solid rgba(139,94,60,.24);border-radius:10px;padding:10px 14px;background:rgba(255,250,232,.42)">
            ${rows.map(x => `<div style="line-height:1.9;color:var(--mo-2)">✓ ${esc(x)}</div>`).join('')}
          </div>
          <div class="btn-row">
            <button class="btn btn-ink" data-decline>${esc(N.declineButton)}</button>
            <button class="btn btn-primary" data-enter>${esc(N.enterButton)}</button>
          </div>
        </div>`, 'hidden-final-invite');
      goldBurst(ov, 24);
      const finish = value => { this.close(ov); resolve(value); };
      const enter = ov.querySelector('[data-enter]');
      enter.addEventListener('click', () => finish(true));
      ov.querySelector('[data-decline]').addEventListener('click', () => finish(false));
      setTimeout(() => enter.focus(), 30);
    });
  }

  async showHiddenFinalOutcome(kind, out, npc) {
    const N = narrativeOf(this.cfg).hiddenFinal[kind];
    const won = kind === 'victory';
    const selfScore = Number(out && out.selfCalc && out.selfCalc.total) || 0;
    const foeScore = Number(out && out.oppCalc && out.oppCalc.total) || 0;
    const foeName = npc && npc.name ? npc.name : '陈之微';
    const foeTitle = npc && npc.title ? npc.title : '桃花仙人';
    const ov = this.open(`
      <div class="modal scroll-frame paper hidden-final-outcome" style="text-align:center;width:min(620px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px))">
        <div class="kind">${esc(N.kind)}</div>
        <div class="title-ink" style="font-size:42px">${esc(N.title)}</div>
        <div style="margin-top:7px;color:var(--mo-3);letter-spacing:.1em">${esc(foeTitle)} · ${esc(foeName)}</div>
        <hr class="hr-ink"/>
        <div style="font-size:16px;line-height:2.05;white-space:pre-line;text-align:left">${esc(personalize(N.text, this.playerName))}</div>
        <div style="margin-top:14px;color:${won ? 'var(--zhu)' : 'var(--mo-3)'}">终卷论战：${selfScore} 比 ${foeScore}</div>
        <div class="btn-row"><button class="btn btn-primary" data-ok>${esc(N.button)}</button></div>
      </div>`, `hidden-final-${kind}`);
    if (won) goldBurst(ov, 52);
    const ok = ov.querySelector('[data-ok]');
    setTimeout(() => ok.focus(), 30);
    await new Promise(r => ok.addEventListener('click', r));
    this.close(ov);
  }

  showHiddenFinalVictory(out, npc) { return this.showHiddenFinalOutcome('victory', out, npc); }
  showHiddenFinalDefeat(out, npc) { return this.showHiddenFinalOutcome('defeat', out, npc); }

  /* ---------------------------------------------------- 开局起名 */
  /**
   * 开局起名弹窗：玩家为自己起一个名号，留空则叙事维持第二人称「你」。
   * @param {string} [defaultName] 续玩或改名时的初始值（本作无此需求，预留）
   * @returns {Promise<string|null>} 返回（已规整的）名字；点「返回」返回 null
   */
  showNamePrompt(defaultName = '') {
    return new Promise(resolve => {
      const ov = this.open(`
        <div class="modal paper name-prompt" style="width:min(440px,calc(100vw - var(--safe-left) - var(--safe-right) - 24px));text-align:center">
          <div class="mtitle"><h2>為 自 己 起 名</h2></div>
          <hr class="hr-ink"/>
          <div style="font-size:15px;line-height:1.95;color:var(--mo-3)">
            科场之路，先有一名号。<br/>留空不填，则叙事仍以「你」自称。</div>
          <div style="
            margin-top:14px;padding:11px 14px;border-radius:10px;
            border:1px dashed rgba(120,100,70,.42);background:rgba(255,250,232,.28);
            font-family:var(--font-kai);font-size:13.5px;line-height:1.9;color:var(--mo-2);
            letter-spacing:.08em;text-align:center">
            古人起名，往往与<span style="color:var(--zhu);font-weight:600">「流派」</span>相映<br/>
            <span style="color:#4a6fa5">博闻</span>士&emsp;·&emsp;<span style="color:#7a5c8a">奇士</span>&emsp;·&emsp;<span style="color:#8b5e3c">辞宗</span><br/>
            <span style="font-size:12px;color:var(--mo-3);letter-spacing:.06em">或依师门、或缘志向、或取自所好——只求一个你的名字</span>
          </div>
          <input id="nameInput" class="name-input" type="text" maxlength="12" autocomplete="off"
            placeholder="例如：青莲居士（最多 12 字）" value="${esc(defaultName)}"
            style="width:100%;box-sizing:border-box;margin-top:14px;padding:11px 14px;font-size:18px;
              font-family:var(--font-kai);text-align:center;border:1px solid var(--mo-3);
              border-radius:10px;background:rgba(255,255,255,.72);color:var(--mo)" />
          <div style="display:flex;justify-content:space-between;align-items:center;
            margin-top:7px;padding:0 4px;font-size:12px;color:var(--mo-3);letter-spacing:.04em">
            <span>回车即可开局</span>
            <span id="nameCount" style="font-family:var(--font-song);font-variant-numeric:tabular-nums">0 / 12</span>
          </div>
          <div class="btn-row" style="margin-top:16px">
            <button class="btn btn-ink" data-back>返回</button>
            <button class="btn btn-primary" data-go>就此开局</button>
          </div>
        </div>`, 'namePrompt');

      const input = ov.querySelector('#nameInput');
      const counter = ov.querySelector('#nameCount');
      const finish = v => { this.close(ov); resolve(v); };
      const updateCount = () => {
        if (!counter) return;
        const len = [...input.value].length;                        // 用展开计数 Unicode 字符（Emoji/生僻字各占 1）
        counter.textContent = `${len} / 12`;
        counter.style.color = len >= 12 ? 'var(--zhu)' : '';
      };
      setTimeout(() => { input.focus(); updateCount(); }, 50);
      input.addEventListener('input', updateCount);
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); finish(normalizeName(input.value)); }
      });
      ov.querySelector('[data-go]').addEventListener('click', () => finish(normalizeName(input.value)));
      ov.querySelector('[data-back]').addEventListener('click', () => finish(null));
    });
  }
}

/* ------------------------------------------------------- 文本化 */
export function effectText(ef) {
  if (!ef || !Object.keys(ef).length) return '（无额外收益）';
  const p = [];
  for (const [k, v] of Object.entries(ef.attrs || {})) p.push(`${ATTR_NAMES[k] || k} ${v > 0 ? '+' : ''}${v}`);
  if (ef.inspiration) p.push(`灵感 ${ef.inspiration > 0 ? '+' : ''}${ef.inspiration}`);
  if (ef.inspirationMax) p.push(`灵感上限 +${ef.inspirationMax}`);
  if (ef.talent) p.push('获得文心');
  if (ef.item) p.push(`道具「${ef.item}」`);
  return p.length ? p.join('　') : '（无额外收益）';
}

/** 事件卡用：在选择前完整展示已配置的收益，避免属性奖励成为不可见信息。 */
export function effectBrief(ef) {
  if (!ef || !Object.keys(ef).length) return '';
  const p = [];
  for (const [k, v] of Object.entries(ef.attrs || {})) p.push(`${ATTR_NAMES[k] || k} ${v > 0 ? '+' : ''}${v}`);
  if (ef.inspiration) p.push(`灵感 ${ef.inspiration > 0 ? '+' : ''}${ef.inspiration}`);
  if (ef.inspirationMax) p.push(`灵感上限 +${ef.inspirationMax}`);
  if (ef.talent) p.push('获得文心');
  if (ef.item) p.push(`道具「${ef.item}」`);
  return p.join('　');
}

export function talentEffectText(t) {
  const e = t.effect || {};
  const S = { shi: '诗', ci: '词', lian: '联', any: '任意' };
  switch (e.type) {
    case 'on_win_bonus': return `${S[e.style] || e.style}战获胜，额外 +${e.value} ${ATTR_NAMES[e.style] || '对应属性'}`;
    case 'fixed_dice': return `本场灵感骰固定为 ${e.value} 分，不受运气左右`;
    case 'planned_dice': return `回合掷移动骰前可指定 1—${e.maxValue || 6} 格；本局每次使用消耗递增（首用 ${e.baseCost || 5}，每次 +${e.costStep || 2}）`;
    case 'dice_mult': return `本场普通灵感骰每点乘区 +${e.value}%（高风险高回报）`;
    case 'dice_plus': return `灵感骰点数 +${e.value}`;
    case 'extra_dice_pct': {
      const pct = `每追加 1 枚灵感骰，作品乘区额外 +${Math.round((e.value || 0) * 100)}%`;
      const discount = Number(e.firstCostDiscount) || 0;
      return discount ? `首枚追加少耗 ${discount} 灵感；${pct}` : pct;
    }
    case 'extra_dice_chain': return `支付首枚续掷后自动续得第二枚骰；若自动骰不低于首枚续骰，得分 +${Math.round((e.value || 0) * 100)}%`;
    case 'dice_transform':
      if (e.mode === 'first_floor') return `本场首枚灵感骰最低视为 ${e.floor || 4} 点，并禁止追加骰${e.value ? `；得分 +${Math.round(e.value * 100)}%` : ''}`;
      if (e.mode === 'polarize') return `至少两枚骰时，将最左最低骰化为 1、最右最高骰化为 6${e.value ? `；得分 +${Math.round(e.value * 100)}%` : ''}`;
      if (e.mode === 'lowest_to') return `将最低且不高于 ${e.maxPip || 3} 点的一骰化为 ${e.target || 6} 点`;
      return `将 ${e.count || 1} 枚不高于 ${e.threshold || 2} 点的最低骰抬高 ${e.value || 1} 点`;
    case 'dice_pattern': {
      const pct = n => `${Math.round((Number(n) || 0) * 100)}%`;
      let s = e.pattern === 'six' ? `${e.reward && e.reward.perMatch === false ? '本场首次出现最终六点骰时' : '每枚最终六点骰'}，得分 +${pct(e.value)}`
        : e.pattern === 'distinct' ? `每多一种不同点数，得分 +${pct(e.value)}${e.firstCostDiscount ? `；首枚追加少耗 ${e.firstCostDiscount} 灵感` : ''}`
        : e.pattern === 'all_distinct' ? `${e.minDice || 3} 枚骰点各不相同，得分 +${pct(e.value)}${e.firstCostDiscount ? `；首枚续掷少耗 ${e.firstCostDiscount} 灵感` : ''}`
        : e.pattern === 'low_then_high' ? `首骰 ≤${e.lowMax || 2} 后续骰 ≥${e.nextHighMin || 5}，得分 +${pct(e.value)}；低开时首枚续掷少耗 ${e.conditionalFirstCostDiscount || 0} 灵感`
        : e.pattern === 'ascending' ? `续骰逐枚递升，每次 +${pct(e.perStepValue)}；${e.fullDice || 3} 骰连升另 +${pct(e.fullValue)}`
        : e.pattern === 'first_last_equal' ? `至少两枚骰且首尾同点，得分 +${pct(e.value)}${e.firstCostDiscount ? `；首枚追加少耗 ${e.firstCostDiscount} 灵感` : ''}`
        : e.pattern === 'low_and_high' ? `骰组同时有 ≤${e.lowMax || 2} 与 ≥${e.highMin || 5} 点，得分 +${pct(e.value)}`
        : e.pattern === 'single' ? `仅以一枚骰结算，得分 +${pct(e.value)}`
        : e.pattern === 'all_high' ? `全部骰不低于 ${e.minPip || 4} 点，得分 +${pct(e.value)}`
        : e.pattern === 'pair' ? `骰组出现同点，得分 +${pct(e.value)}`
        : e.pattern === 'total' ? `骰组总点不少于 ${e.threshold || 12}，得分 +${pct(e.value)}`
        : e.pattern === 'exact_total' ? `前 ${e.diceCount || 2} 骰合计恰为 ${e.total || 7} 点，得分 +${pct(e.value)}${e.firstExtraFree ? '；首枚续掷免费' : ''}`
        : e.pattern === 'total_multiple' ? `骰组总点数为 ${e.multiple || 7} 的倍数，得分 +${pct(e.value)}（不限制骰子枚数）`
        : e.pattern === 'total_tiers' ? (e.tiers || []).map(x => `总点 ≥${x.threshold}：+${pct(x.value)}`).join('；')
        : `每枚 ≥${e.highMin || 5} 点骰 +${pct(e.highValue)}；每枚 ≤${e.lowMax || 2} 点骰 ${pct(e.lowValue)}`;
      if (e.reward && Number(e.reward.value) > 0) {
        const rn = { insight: '心得', fragment: '残页', page: '稿页', inspiration: '灵感' }[e.reward.type] || e.reward.type;
        s += `；触发后 ${rn} +${e.reward.value}${e.reward.perMatch === false ? '（每场一次）' : '（按命中数）'}`;
      }
      return s;
    }
    case 'battle_history_pct': return e.condition === 'repeat_style' ? `沿用上一场文体，得分 +${Math.round((e.value || 0) * 100)}%${e.previousWinBonus ? `；上场获胜再 +${Math.round(e.previousWinBonus * 100)}%` : ''}` : e.condition === 'switch_style' ? `换用上一场不同文体，得分 +${Math.round((e.value || 0) * 100)}%${e.previousNonWinBonus ? `；上场未胜再 +${Math.round(e.previousNonWinBonus * 100)}%` : ''}` : `上一场平或负，得分 +${Math.round((e.value || 0) * 100)}%`;
    case 'weakness_reward': return `首次命中对手公开破绽：${e.reward && e.reward.value ? `灵感 +${e.reward.value}` : ''}${e.value ? `；得分 +${Math.round(e.value * 100)}%` : ''}`;
    case 'seal_signature': return `支付灵感封住对手本场招牌；自身得分 ${Math.round((e.penalty || 0) * 100)}%`;
    case 'dice_commitment': return e.condition === 'none_paid' ? `本场不购买追加骰，得分 +${Math.round((e.value || 0) * 100)}%` : `本场恰购买一枚追加骰，得分 +${Math.round((e.value || 0) * 100)}%${e.firstCostDiscount ? `；首枚追加少耗 ${e.firstCostDiscount} 灵感` : ''}`;
    case 'restraint_pct': return `本场未发动主动文心，得分 +${Math.round((e.value || 0) * 100)}%`;
    case 'style_switch_pct': return `换用不同于上一场的文体：得分 +${Math.round((e.value || 0) * 100)}%，心得 +${e.insight || 0}`;
    case 'manuscript_pct': return `每持有 ${e.step || 2} 页稿本，得分 +${Math.round((e.value || 0) * 100)}%（上限 ${Math.round((e.cap || 0) * 100)}%）`;
    case 'copy_affinity': {
      const r = e.ratio != null ? e.ratio : 0.6;
      const parts = [`复制对手本场风格相性（${Math.round(r * 100)}%）`];
      if (e.revealIntent) parts.push('揭示对手意图');
      if (e.synergyPct) parts.push(`文风相合 +${Math.round((e.synergyPct || 0) * 100)}%`);
      if (e.themeFlat) parts.push(`通晓题材 +${Math.round((e.themeFlat || 0) * 100)}%`);
      if (e.convertPct) parts.push('相性化境');
      if (e.revealWeakness) parts.push('揭示破绽');
      return parts.join('；');
    }
    case 'borrow_signature': return `本场借对手招牌之强（${Math.round((e.fraction || 0) * 100)}%），敌愈强此招愈利`;
    case 'crit': return `${Math.round((e.chance || 0) * 100)}% 概率神来之笔，得分 ×${e.mult}`;
    case 'attr_flat': return Object.entries(e.attrs || {}).map(([k, v]) => `${ATTR_NAMES[k]} +${v}`).join('　');
    case 'unlock_lian': return '解除联力 8 点门槛';
    case 'palace_pct': return `殿试每场得分 +${Math.round((e.value || 0) * 100)}%`;
    case 'insp_on_win': return `每场论战取胜，灵感 +${e.value || 0}`;
    case 'draw_bonus': return `平分秋色时，出战文体额外 +${e.value || 0}`;
    case 'insp_on_talent': return `每获得一枚新文心，灵感 +${e.value || 0}`;
    case 'style_pct': return `以${S[e.style] || e.style}出战，得分 +${Math.round((e.value || 0) * 100)}%`;
    case 'theme_pct': return `指定题材出战，得分 +${Math.round((e.value || 0) * 100)}%`;
    case 'streak_mult': return `气势连捷收益 ×${(1 + (e.value || 0)).toFixed(2)}`;
    case 'insp_floor': return `每场结算后灵感至少为 ${e.value || 0}`;
    case 'lucky_six': return `任一灵感骰掷出六点，本场得分 ×${e.mult || 0}`;
    case 'comeback': return `灵感 ≤${e.threshold || 0} 时，本场得分 +${Math.round((e.value || 0) * 100)}%`;
    case 'armory_pct': return `每拥有 ${e.step || 0} 枚文心，六维算分属性 +${Math.round((e.value || 0) * 100)}%`;
    case 'study_bonus': return `败/平研习补偿属性额外 +${e.value || 0}`;
    case 'palace_insp': return `殿试每场开场，灵感 +${e.value || 0}`;
    case 'start_insp': return `获得时，灵感一次性 +${e.value || 0}`;
    case 'insp_turn_regen': return `持有时，每回合开始恢复灵感 +${e.value || 0}`;
    case 'insp_on_quiz': return `答对/完成抉择额外 +${e.value || 0} 灵感（每局最多 ${e.maxTriggers || 0} 次）`;
    case 'insp_battle_recover': return `战后灵感 ≤${e.threshold || 0} 时恢复 ${e.value || 0}（每局最多 ${e.maxTriggers || 0} 次）`;
    case 'insp_max': return `获得时，本局灵感上限永久 +${e.value || 0}（同类扩容互斥）`;
    case 'reincarnate': return `殿试结算时若剩余灵感 ≥ ${Number(e.inspThreshold) || 0}，下一局继承本局属性的 ${Math.round((Number(e.attrRatio) || 0) * 100)}%，并保留此文心与当前等级`;
    default: return t.desc || '效果由配置定义';
  }
}

export function skyEffectText(card) {
  const e = card.effect || {};
  switch (e.type) {
    case 'attr_pct': return `全员 ${ATTR_NAMES[e.attr]} 临时 +${Math.round(e.value * 100)}%`;
    case 'basic_gain_plus': return `基本功获得量 +${e.value}`;
    case 'battle_reward_mult': return `论战胜负奖惩 ×${e.value}`;
    case 'quiz_bonus': return `考题答对额外 +${e.value}`;
    case 'no_ping_recover': return '平韵格不再恢复灵感';
    case 'next_battle_pct': return `下一场论战得分 +${Math.round(e.value * 100)}%`;
    default: return '全局效果';
  }
}

/** 传说卡全屏金色粒子 */
export function goldBurst(ov, n = 60) {
  const box = document.createElement('div');
  box.className = 'gold-particles';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + '%';
    s.style.top = '-10px';
    s.style.setProperty('--dx', (Math.random() * 260 - 130) + 'px');
    s.style.setProperty('--rot', '0deg');
    s.style.animationDuration = (1.6 + Math.random() * 2.2) + 's';
    s.style.animationDelay = (Math.random() * 1.2) + 's';
    const sc = 0.5 + Math.random();
    s.style.width = s.style.height = (6 * sc) + 'px';
    box.appendChild(s);
  }
  ov.appendChild(box);
  setTimeout(() => box.remove(), 5000);
}

export { sleep };
