/** modals.js —— 题卡 / 奇遇卡 / 文心卡 / 支线选择 / 天象 / 名胜 */
import { ATTR_NAMES } from '../engine/rules.js';
import { PASSIVE_MAX, ACTIVE_MAX } from '../engine/game.js';
import { LANDMARK_ART } from './svg.js';
import { createCountdown } from './timer.js';
import { play } from './audio.js';
import { sting } from './music.js';
import { personalize, normalizeName } from './namefmt.js';

const RARITY_CN = { common: '普通', rare: '稀有', legend: '传说' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 带符号的数值文案：-1 → 「−1」，+3 → 「+3」（用全角减号，排版更整） */
export const signed = n => (Number(n) > 0 ? '+' : '−') + Math.abs(Number(n) || 0);

/** 限时默认秒数：引擎未指定时的兜底，UI 各处倒计时文案统一引用此常量 */
export const DEFAULT_SECONDS = 30;

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
    return ov;
  }
  close(ov) {
    ov.style.transition = 'opacity .2s';
    ov.style.opacity = '0';
    setTimeout(() => ov.remove(), 210);
  }

  /* ---------------------------------------------------- 考题格 */
  showQuiz(q, opt) {
    return new Promise(resolve => {
      const isChoice = q.type === 'choice';
      const stars = '★'.repeat(q.difficulty || 1) + '☆'.repeat(3 - (q.difficulty || 1));
      const catCN = { shi: '诗', ci: '词', lian: '联', mix: '综合' }[q.category] || '综合';
      const opts = (q.options || []).map((o, i) => {
        const text = isChoice ? o.text : o;
        return `<button class="opt" data-i="${i}"><span class="idx">${'ABCD'[i]}</span>
          <span>${esc(personalize(text, this.playerName))}</span></button>`;
      }).join('');

      const total = (opt && opt.seconds) || DEFAULT_SECONDS;

      const ov = this.open(`
        <div class="modal scroll-frame paper">
          <div class="mtitle">
            <h2>${isChoice ? '创作抉择' : '知识考课'}</h2>
            <span class="mtag">${catCN}</span><span class="mtag">难度 ${stars}</span>
          </div>
          <div class="cd-slot"></div>
          <hr class="hr-ink"/>
          <div style="font-size:20px;line-height:1.85;letter-spacing:.04em">${esc(personalize(q.stem, this.playerName))}</div>
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
  async showQuizResult(q, ans, ok) {
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
    const head = isChoice
      ? (ans.timedOut
          ? `<b>超时未决</b>　未及落笔，灵感 ${signed(insp.quizWrong ?? -1)}`
          : `<b>诗无达诂</b>　选中「${esc((q.options[ans.index] || q.options[0]).text)}」`)
      : ok
        ? `<b>答对了</b>`
        : `<b>${ans.timedOut ? '超时' : '答错了'}</b>　正确答案：${'ABCD'[q.answer]}．${esc(q.options[q.answer])}　${wrongTxt}`;
    play(isChoice || ok ? 'right' : 'wrong');
    sting('reveal');         // 答题揭晓配乐：编钟 + 宫音
    box.innerHTML = `${head}<br/>${esc(q.analysis || '（本题暂无解析）')}
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

  /* ---------------------------------------------------- 文心卡 */
  async showTalentGain(t) {
    const ov = this.open(`
      <div class="talent-card paper ${t.kind === 'active' ? 'act' : ''}">
        <div class="kind">${t.kind === 'active' ? `主动文心　消耗灵感 ${t.cost || 1}` : '被动文心　常驻生效'}</div>
        <h3>${esc(t.name)}</h3>
        <div class="efx">${talentEffectText(t)}</div>
        <div class="dianggu">${esc(personalize(t.text || '', this.playerName))}</div>
        <div style="text-align:center;margin-top:16px"><button class="btn btn-primary" data-ok>收入囊中</button></div>
      </div>`);
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
    const lvlOf = () => (this.game && this.game.s.talentLevels[id]) || 1;

    const render = () => {
      const level = lvlOf();
      const max = up ? up.maxLevel : 1;
      const insp = this.game ? this.game.s.inspiration : Infinity;
      const isActive = t.kind === 'active';
      const kindLine = isActive
        ? `主动文心　消耗灵感 ${t.cost != null ? t.cost : 1}`
        : '被动文心　常驻生效';
      const lvlLine = up ? `　·　${QLABEL[up.quality] || up.quality}　Lv ${level}/${max}` : '';

      let nextHtml = '';
      let btnHtml = `<div class="btn-row"><button class="btn btn-ink" data-ok>知道了</button></div>`;
      if (up && level < max) {
        const nEff = JSON.parse(JSON.stringify(up.levels[level].effect));
        const nCost = up.upCost[level - 1];
        const can = insp >= nCost;
        nextHtml = `
          <div class="up-next">
            <div class="up-next-h">下一级（Lv${level + 1}）· 消耗灵感 ${nCost}</div>
            <div class="efx up-next-efx">${talentEffectText({ ...t, effect: nEff })}</div>
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
          <h3>${esc(t.name)}${up ? `　<span class="lvbadge">Lv ${level}/${max}</span>` : ''}</h3>
          <div class="efx">${talentEffectText(t)}</div>
          ${nextHtml}
          <div class="dianggu">${esc(personalize(t.text || '', this.playerName))}</div>
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
          this.game.ui.onState(this.game.s);                 // 刷新 HUD（灵感/属性/上限）
          // 原地重渲染弹窗内容（保留不关闭），让玩家看到新等级与下一级预览
          const card = ov.querySelector('.talent-card');
          if (card) card.outerHTML = render().trim();
          rebind();
          if (this.game.ui.toast) this.game.ui.toast(`「${esc(t.name)}」精进至 Lv${res.level}`);
        } else {
          if (this.game.ui.toast) this.game.ui.toast(res.reason || '无法升级');
        }
      });
    };
    rebind();
    return new Promise(resolve => {
      // 仅「知道了」关闭弹窗；升级成功后保持打开以便连续升级
      const obs = new MutationObserver(() => { if (!ov.isConnected) resolve(); });
      obs.observe(this.layer, { childList: true });
    });
  }

  /** 超限替换弹窗；返回被替换下标，null = 放弃新卡 */
  askReplaceTalent(nw, list) {
    return new Promise(resolve => {
      const ov = this.open(`
        <div class="modal scroll-frame paper" style="width:min(560px,90vw)">
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
  askScenic(cell, cost = 8, curInsp = Infinity) {
    return new Promise(resolve => {
      const canDraw = curInsp >= cost;
      const ov = this.open(`
        <div class="modal scroll-frame paper branch-modal">
          <div class="mtitle" style="justify-content:center"><h2>${esc(cell.name)}</h2></div>
          <hr class="hr-ink"/>
          <div style="font-size:17px;line-height:1.9">驻足名胜，可焚香祈愿、抽签问文心。</div>
          <div class="rewards">消耗灵感 ${cost} 点，随机抽取一枚尚未拥有的文心</div>
          <div class="warn" style="color:#b23a2e">${canDraw ? '抽签后灵感将减少，请斟酌' : '当前灵感不足，无法抽签'}</div>
          <div class="btn-row">
            <button class="btn btn-primary" data-go="1" ${canDraw ? '' : 'disabled style="opacity:.45;cursor:not-allowed"'}>抽签访胜</button>
            <button class="btn btn-ink" data-go="0">径直离开</button>
          </div>
        </div>`);
      ov.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
        if (b.disabled) return;
        this.close(ov); resolve(b.dataset.go === '1');
      }));
    });
  }

  /* ---------------------------------------------------- 天象 */
  async showSky(card) {
    const ov = this.open(`
      <div class="talent-card paper" style="border-color:#7f95cf;box-shadow:0 16px 40px rgba(0,0,0,.5),0 0 34px rgba(127,149,207,.55)">
        <div class="kind">天象　${(card.effect || {}).type === 'next_battle_pct' ? '下一场论战 · 一次性' : `持续 ${card.turns || 6} 回合`}</div>
        <div class="sky-ico" style="font-size:46px;text-align:center;line-height:1.15">${card.icon ? esc(card.icon) : '✦'}</div>
        <h3>${esc(card.name)}</h3>
        <div class="dianggu" style="background:rgba(76,102,168,.13);border-left-color:#4a5a80">${esc(personalize(card.text || '', this.playerName))}</div>
        <div class="efx" style="color:#3a4a80">${skyEffectText(card)}</div>
        <div style="text-align:center;margin-top:16px"><button class="btn btn-ink" data-ok>观星毕</button></div>
      </div>`);
    play('sky');
    sting('sky');            // 天象切换配乐：羽音清钟
    await new Promise(r => ov.querySelector('[data-ok]').addEventListener('click', r));
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
    const ov = this.open(`
      <div class="modal scroll-frame paper zg-card" style="width:min(560px,92vw);text-align:center">
        <div class="kind">当 朝 文 风</div>
        <div class="title-ink" style="font-size:38px">风 潮 既 起</div>
        <hr class="hr-ink"/>
        <p style="font-size:15px;line-height:1.9;color:var(--mo-2);margin:0 0 12px">本局科场，文运所钟于二事。临场择题用体，可顺势而行：</p>
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
        <div class="zg-note">若某场题目恰为热点题材、又用得势文体，二者<b>叠加</b>生效。文运在手，善用之可事半功倍。</div>
        <div class="btn-row"><button class="btn btn-primary" data-ok>谨记于心</button></div>
      </div>`, 'zeitgeist-intro');
    await new Promise(r => ov.querySelector('[data-ok]').addEventListener('click', r));
    this.close(ov);
  }

  /* ---------------------------------------------------- 殿试开场 */
  async showPalaceIntro(themes, names) {
    // 圈数、殿试场次、金榜奖励分全部从配置读取；殿试题材由主考官配置决定
    const laps = (this.cfg.board || {}).laps ?? 2;
    const grades = this.cfg.grades;
    const dim = ((grades || {}).dimensions || []).find(d => d.key === 'yuanman');
    const jb = ((dim || {}).bonuses || []).find(x => x.id === 'jinbangtiming');
    const sweepN = (themes && themes.length) ? themes.length : (((jb || {}).cond || {}).value ?? 3);
    const sweepScore = bonusScore(grades, 'yuanman', 'jinbangtiming', 200);
    const themeLabels = (names && names.length) ? names : (themes || ['咏物', '送别', '怀古']);
    const ov = this.open(`
      <div class="modal scroll-frame paper" style="text-align:center;width:min(600px,92vw)">
        <div class="title-ink" style="font-size:46px">金 殿 對 策</div>
        <hr class="hr-ink"/>
        <div style="font-size:17px;line-height:2">${laps} 圈科举路已尽，今登金殿。<br/>
          主考官出题 ${sweepN} 道：<b>${themeLabels.join('</b>、<b>')}</b>，须连场应对。<br/>
          <span style="color:var(--zhu)">${sweepN} 场全胜，可得「${esc((jb || {}).name || '金榜题名')}」圆满分 +${sweepScore}。</span></div>
        <div class="btn-row"><button class="btn btn-primary" data-ok>整冠入殿</button></div>
      </div>`, 'palace-intro');
    goldBurst(ov, 40);
    await new Promise(r => ov.querySelector('[data-ok]').addEventListener('click', r));
    this.close(ov);
  }

  /* ---------------------------------------------------- 开局起名 */
  /**
   * 开局起名弹窗：玩家为自己起一个名号，留空则叙事维持第二人称「你」。
   * @param {string} [defaultName] 续玩或改名时的初始值（本作无此需求，预留）
   * @returns {Promise<string|null>} 返回（已规整的）名字；点「返回」返回 null
   */
  showNamePrompt(defaultName = '') {
    return new Promise(resolve => {
      const ov = this.open(`
        <div class="modal paper name-prompt" style="width:min(440px,92vw);text-align:center">
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
              border-radius:10px;background:rgba(255,255,255,.06);color:var(--ink)" />
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
  if (ef.talent) p.push('获得文心');
  if (ef.item) p.push(`道具「${ef.item}」`);
  return p.length ? p.join('　') : '（无额外收益）';
}

/** 事件卡用：只展示非属性收益（灵感 / 文心 / 道具），不剧透属性变化 */
function effectBrief(ef) {
  if (!ef || !Object.keys(ef).length) return '';
  const p = [];
  if (ef.inspiration) p.push(`灵感 ${ef.inspiration > 0 ? '+' : ''}${ef.inspiration}`);
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
    case 'dice_mult': return `本场灵感骰倍率 ×${e.value}（高风险高回报）`;
    case 'dice_plus': return `灵感骰点数 +${e.value}`;
    case 'copy_affinity': return '复制对手本场风格的相性加成';
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
    case 'insp_on_quiz': return `答对/完成抉择额外 +${e.value || 0} 灵感（每局最多 ${e.maxTriggers || 0} 次）`;
    case 'insp_battle_recover': return `战后灵感 ≤${e.threshold || 0} 时恢复 ${e.value || 0}（每局最多 ${e.maxTriggers || 0} 次）`;
    case 'insp_max': return `获得时，本局灵感上限永久 +${e.value || 0}（同类扩容互斥）`;
    case 'reincarnate': return `殿试结算时若剩余灵感 ≥ ${Number(e.inspThreshold) || 0}，下一局继承本局属性的 ${Math.round((Number(e.attrRatio) || 0) * 100)}%`;
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
