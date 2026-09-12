import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'file:///C:/Users/77522/.workbuddy/binaries/node/workspace/node_modules/jsdom/lib/api.js';
import { mountAbilityGuide } from '../js/ui/abilityGuide.js';

function panel(html) {
  const dom = new JSDOM(`<div class="ability-panel"><div class="ability-body">${html}</div></div>`, { pretendToBeVisual: true });
  return dom.window.document.querySelector('.ability-panel');
}

test('研修与心得分开引导，定位不执行消费且可以键盘继续操作', () => {
  const box = panel('<button data-focus="shi">诗力</button><button data-insight="shi">消耗心得</button>');
  let spends = 0;
  box.querySelector('[data-insight]').addEventListener('click', () => spends++);
  mountAbilityGuide(box);
  assert.equal(box.querySelectorAll('.ability-guide-jump').length, 2);
  assert.match(box.textContent, /下阶段生效/);
  assert.match(box.textContent, /立即扣除心得/);
  box.querySelectorAll('.ability-guide-jump')[1].click();
  assert.equal(spends, 0);
  assert.ok(box.querySelector('[data-insight]').classList.contains('ability-guide-target'));
  assert.equal(box.ownerDocument.activeElement, box.querySelector('.ability-guide-arrow'));
});

test('资源不足仍可定位解释，不使不可用按钮变成可用', () => {
  const box = panel('<button data-manuscript="polish" disabled>稿页不足</button>');
  mountAbilityGuide(box);
  box.querySelector('.ability-guide-jump').click();
  assert.match(box.querySelector('.ability-guide-arrow').textContent, /当前不可用/);
  assert.equal(box.querySelector('[data-manuscript]').disabled, true);
});

test('重新渲染及切换分区不重复引导，保留收起偏好', () => {
  const box = panel('<button data-focus="shi">诗力</button>');
  mountAbilityGuide(box);
  box.dataset.abilityGuideOpen = 'false';
  box.querySelector('.ability-body').innerHTML = '<button data-strategy-plan="steady">稳守</button>';
  mountAbilityGuide(box);
  mountAbilityGuide(box);
  assert.equal(box.querySelectorAll('.ability-guide').length, 1);
  assert.equal(box.ownerDocument.querySelectorAll('[data-ability-guide-style]').length, 1);
  assert.equal(box.querySelector('.ability-guide').open, false);
  assert.match(box.textContent, /下阶段自动发动/);
  assert.doesNotMatch(box.textContent, /分配心得/);
});

test('纯记录页不显示无效引导入口', () => {
  const box = panel('<p>暂无修习记录。</p>');
  mountAbilityGuide(box);
  assert.equal(box.querySelector('.ability-guide'), null);
});
