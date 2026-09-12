/** 修习说明与定位：只移动视线和焦点，不代替玩家选择或消费。 */
export function mountAbilityGuide(box) {
  const doc = box.ownerDocument;
  if (!doc.querySelector('[data-ability-guide-style]')) {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('../../css/ability-guide.css', import.meta.url).href;
    link.dataset.abilityGuideStyle = '';
    doc.head.append(link);
  }
  box.querySelector('.ability-guide')?.remove();
  const body = box.querySelector('.ability-body') || box;
  const sections = [
    {
      selector: '[data-focus]', title: '安排研修 → 下阶段生效',
      text: '选方向 → 自动保存 → 进入下一阶段 → 论战后累积进度，满额自动提升属性。当前阶段仍修原方向，已有进度保留。勾选表示下阶段安排，不是属性已经增加；至少保留一项，最多安排研修位上限。'
    },
    {
      selector: '[data-insight]', title: '分配心得 → 立即成长',
      text: '看清属性变化和心得消耗 → 点击想提升的属性 → 立即扣除心得并提升属性，无须再领取。灰色按钮表示心得不足，继续游戏积累后再来分配。'
    },
    {
      selector: '[data-strategy-plan]', title: '选章法 → 下阶段自动发动',
      text: '查看章法条件 → 选择下阶段安排 → 自动保存。进入下阶段后，满足条件且构思足够时自动发动，不用在论战中手动点。构思在阶段开始时补充，上阶段未用点数不累计；换算余量会保留。'
    },
    {
      selector: '[data-manuscript]', title: '用稿页 → 按用途消费',
      text: '论战积累成稿进度 → 满额自动转为稿页 → 查看消耗再点击。润色用于抵扣首次追加骰费用；刊行恢复灵感；定卷增加终局文采。点击用途按钮即消费，灰色按钮的限制见其下方说明。'
    },
    {
      selector: '[data-talent-conversion]', title: '问心转化 → 先看概率与限次',
      text: '先看资源消耗、成功概率和剩余次数，再决定是否投入。获得的是文心选择机会，并非每次必得；不可用原因显示在操作按钮中。'
    }
  ].filter(item => box.querySelector(item.selector));
  if (!sections.length) return;
  const guide = doc.createElement('details');
  guide.className = 'ability-guide';
  guide.open = box.dataset.abilityGuideOpen !== 'false';
  const summary = doc.createElement('summary');
  summary.textContent = '修习怎么用 · 操作指引';
  guide.append(summary);
  guide.addEventListener('toggle', () => { if (guide.isConnected) box.dataset.abilityGuideOpen = String(guide.open); });
  for (const item of sections) {
    const row = doc.createElement('section');
    const title = doc.createElement('b');
    title.textContent = item.title;
    const text = doc.createElement('p');
    text.textContent = item.text;
    const jump = doc.createElement('button');
    jump.type = 'button';
    jump.className = 'ability-guide-jump';
    jump.textContent = '↓ 箭头定位操作区';
    jump.setAttribute('aria-label', `定位：${item.title}`);
    jump.addEventListener('click', () => {
      box.querySelectorAll('.ability-guide-target').forEach(el => el.classList.remove('ability-guide-target'));
      box.querySelectorAll('.ability-guide-arrow').forEach(el => el.remove());
      const targets = [...box.querySelectorAll(item.selector)];
      const target = targets.find(el => !el.disabled) || targets[0];
      const arrow = doc.createElement('p');
      arrow.className = 'ability-guide-arrow';
      arrow.textContent = target.disabled ? '↓ 操作在此；当前不可用，请先查看资源与限制。' : '↓ 操作在此；按自己的需要选择，定位不会替你执行。';
      arrow.setAttribute('role', 'status');
      arrow.tabIndex = -1;
      target.before(arrow);
      target.classList.add('ability-guide-target');
      arrow.scrollIntoView?.({ block: 'center', behavior: 'instant' });
      arrow.focus({ preventScroll: true });
    });
    row.append(title, text, jump);
    guide.append(row);
  }
  body.prepend(guide);
}
