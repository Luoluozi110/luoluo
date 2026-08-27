/**
 * 飞花棋配置契约：零依赖、无 DOM，浏览器经典脚本 / ES Module / Node 均可加载。
 * 所有入口（本地配置、云端工程、编辑器发布）必须共用本文件，禁止另写字段校验副本。
 */
(function (root) {
  'use strict';

  const REQUIRED_CONFIG_KEYS = [
    'attrs', 'inspiration', 'board', 'questions', 'events', 'talents',
    'schools', 'affinity', 'npcs', 'sky', 'grades'
  ];
  const PROJECT_KEYS = [
    'questions', 'events', 'talents', 'talent-upgrade', 'npcs', 'affinity',
    'synergies', 'board', 'sky', 'album', 'schools', 'grades', 'narrative'
  ];
const ATTR_KEYS = ['shi', 'ci', 'lian', 'bi', 'xue', 'si'];
const INK_AXES = [['逐名', '求真'], ['守法', '出新'], ['与人', '独行'], ['惜身', '燃笔']];
const INK_TAGS = new Set(INK_AXES.flat());
  const STYLE_KEYS = new Set(['shi', 'ci', 'lian']);

  class ConfigContractError extends Error {
    constructor(result, prefix = '配置契约校验失败') {
      const first = (result.errors || []).slice(0, 5).map(x => `${x.path}: ${x.message}`).join('；');
      super(`${prefix}${first ? `：${first}` : ''}`);
      this.name = 'ConfigContractError';
      this.result = result;
    }
  }

  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const finite = v => Number.isFinite(Number(v));
  const text = v => typeof v === 'string' && v.trim().length > 0;

  function validateConfig(config, options = {}) {
    const errors = [];
    const warnings = [];
    const partial = !!options.partial;
    const add = (path, message, code = 'invalid') => errors.push({ path, message, code });
    const warn = (path, message, code = 'warning') => warnings.push({ path, message, code });
    const cfg = isObj(config) ? config : {};
    if (!isObj(config)) add('$', '配置根必须是对象', 'root_type');

    if (!partial) {
      for (const key of REQUIRED_CONFIG_KEYS) if (!(key in cfg)) add(key, '缺少必需配置块', 'required');
    }

    const uniqueIds = (value, path) => {
      if (!Array.isArray(value)) { add(path, '必须是数组', 'array'); return new Set(); }
      const ids = new Set();
      value.forEach((item, i) => {
        if (!isObj(item)) { add(`${path}[${i}]`, '必须是对象', 'object'); return; }
        if (!text(item.id)) add(`${path}[${i}].id`, '必须是非空字符串', 'id');
        else if (ids.has(item.id)) add(`${path}[${i}].id`, `ID 重复：${item.id}`, 'duplicate_id');
        else ids.add(item.id);
      });
      return ids;
    };

    if ('attrs' in cfg) {
      if (!isObj(cfg.attrs)) add('attrs', '必须是对象');
      else if (!isObj(cfg.attrs.initial)) add('attrs.initial', '必须是六维初始值对象');
      else {
        for (const k of ATTR_KEYS) if (!finite(cfg.attrs.initial[k])) add(`attrs.initial.${k}`, '必须是有限数字');
        if (cfg.attrs.battleFormula != null) {
          if (!isObj(cfg.attrs.battleFormula)) add('attrs.battleFormula', '必须是对象');
          else for (const k of ['styleCommonMult', 'styleSpecialtyMult', 'basicMult']) {
            if (!finite(cfg.attrs.battleFormula[k]) || Number(cfg.attrs.battleFormula[k]) < 0) add(`attrs.battleFormula.${k}`, '必须是非负有限数字');
          }
        }
        if (cfg.attrs.abilitySystem != null) {
          if (!isObj(cfg.attrs.abilitySystem)) add('attrs.abilitySystem', '必须是对象');
          else {
            const study = cfg.attrs.abilitySystem.study;
            if (!isObj(study)) add('attrs.abilitySystem.study', '必须是对象');
            else {
              for (const k of ['baseInsightCap', 'insightCapPerXue', 'baseSlots', 'slotPerXue', 'maxSlots', 'progressNeed', 'progressPerXue']) {
                if (!finite(study[k]) || Number(study[k]) <= 0) add(`attrs.abilitySystem.study.${k}`, '必须是正数');
              }
              if (study.slotMilestones != null && (!Array.isArray(study.slotMilestones) || study.slotMilestones.some((v, i, arr) => !finite(v) || Number(v) <= 0 || (i > 0 && Number(v) <= Number(arr[i - 1]))))) {
                add('attrs.abilitySystem.study.slotMilestones', '必须是严格递增的正数数组');
              }
            }
            const strategy = cfg.attrs.abilitySystem.strategy;
            if (!isObj(strategy)) add('attrs.abilitySystem.strategy', '必须是对象');
            else {
              for (const k of ['baseCharges', 'chargePerSi', 'maxCharges', 'capPerSi', 'maxCap']) {
                if (!finite(strategy[k]) || Number(strategy[k]) <= 0) add(`attrs.abilitySystem.strategy.${k}`, '必须是正数');
              }
              if (!isObj(strategy.plans)) add('attrs.abilitySystem.strategy.plans', '必须是对象');
              else for (const id of ['steady', 'guard', 'switch']) {
                if (!isObj(strategy.plans[id])) add(`attrs.abilitySystem.strategy.plans.${id}`, '缺少必需章法');
                else if (!text(strategy.plans[id].name) || !text(strategy.plans[id].desc)) add(`attrs.abilitySystem.strategy.plans.${id}`, '必须包含章法名称和说明');
                else if (id === 'steady' && (!finite(strategy.plans[id].lowMax) || Number(strategy.plans[id].lowMax) < 1 || !finite(strategy.plans[id].fragmentGain) || Number(strategy.plans[id].fragmentGain) <= 0)) add(`attrs.abilitySystem.strategy.plans.${id}`, '徐行拾句必须配置有效的低骰范围和残页收益');
              }
              if (!text(strategy.defaultPlan) || !isObj(strategy.plans) || !strategy.plans[strategy.defaultPlan]) add('attrs.abilitySystem.strategy.defaultPlan', '必须引用已有预案');
            }
            const manuscript = cfg.attrs.abilitySystem.manuscript;
            if (!isObj(manuscript)) add('attrs.abilitySystem.manuscript', '必须是对象');
            else for (const k of ['baseCap', 'capPerBi', 'maxCap', 'fragmentPerBi', 'fragmentNeed']) {
              if (!finite(manuscript[k]) || Number(manuscript[k]) <= 0) add(`attrs.abilitySystem.manuscript.${k}`, '必须是正数');
            }
          }
        }
        const tech = cfg.attrs.techniqueSystem;
        if (tech != null) {
          if (!isObj(tech)) add('attrs.techniqueSystem', '必须是对象');
          else {
            if (!Number.isInteger(Number(tech.version)) || Number(tech.version) < 1) add('attrs.techniqueSystem.version', '必须是正整数');
            if (!Array.isArray(tech.thresholds) || tech.thresholds.some((v, i, arr) => !finite(v) || Number(v) <= 0 || (i > 0 && Number(v) <= Number(arr[i - 1])))) {
              add('attrs.techniqueSystem.thresholds', '必须是严格递增的正数数组');
            }
            if (!isObj(tech.nodes)) add('attrs.techniqueSystem.nodes', '必须是对象');
            else for (const style of STYLE_KEYS) if (!Array.isArray(tech.nodes[style])) add(`attrs.techniqueSystem.nodes.${style}`, '必须是数组');
          }
        }
      }
    }

    if ('inspiration' in cfg) {
      const v = cfg.inspiration;
      if (!isObj(v)) add('inspiration', '必须是对象');
      else {
        if (!finite(v.initial)) add('inspiration.initial', '必须是有限数字');
        if (!finite(v.max)) add('inspiration.max', '必须是有限数字');
        if (finite(v.initial) && finite(v.max) && Number(v.initial) > Number(v.max)) add('inspiration.initial', '不能大于灵感上限');
      }
    }

    let talentIds = new Set();
    if ('talents' in cfg) {
      talentIds = uniqueIds(cfg.talents, 'talents');
      if (Array.isArray(cfg.talents)) cfg.talents.forEach((t, i) => {
        if (!isObj(t)) return;
        if (!text(t.name)) add(`talents[${i}].name`, '必须是非空字符串');
        if (!['passive', 'active'].includes(t.kind)) add(`talents[${i}].kind`, '必须是 passive 或 active');
        if (!isObj(t.effect) || !text(t.effect.type)) add(`talents[${i}].effect`, '必须包含 effect.type');
      });
    }

    if ('questions' in cfg) {
      uniqueIds(cfg.questions, 'questions');
      if (Array.isArray(cfg.questions)) cfg.questions.forEach((q, i) => {
        if (!isObj(q)) return;
        const qp = `questions[${i}]`;
        if (!['knowledge', 'choice'].includes(q.type)) add(`questions[${i}].type`, '必须是 knowledge 或 choice');
        if (!text(q.stem)) add(`questions[${i}].stem`, '题干不能为空');
        if (!Array.isArray(q.options) || q.options.length < 2) add(`questions[${i}].options`, '至少需要两个选项');
        if (q.type === 'knowledge') {
          if (Array.isArray(q.options)) q.options.forEach((option, j) => {
            if (!text(option)) add(`${qp}.options[${j}]`, '知识题选项必须是非空字符串');
          });
          if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= (q.options || []).length) {
            add(`${qp}.answer`, '答案下标超出选项范围');
          }
          const hasSituational = Object.prototype.hasOwnProperty.call(q, 'scenario') ||
            Object.prototype.hasOwnProperty.call(q, 'optionActs');
          if (hasSituational) {
            const scenario = typeof q.scenario === 'string' ? q.scenario.trim() : '';
            if (scenario.length < 20 || scenario.length > 160) add(`${qp}.scenario`, '柔性题面必须是 20–160 字');
            if (scenario.includes('{name}')) add(`${qp}.scenario`, '不能使用 {name} 占位符');
            if (!Array.isArray(q.optionActs)) add(`${qp}.optionActs`, '柔性题必须提供行动文案数组');
            else {
              if (!Array.isArray(q.options) || q.optionActs.length !== q.options.length) add(`${qp}.optionActs`, '长度必须与 options 一致');
              q.optionActs.forEach((act, j) => {
                const value = typeof act === 'string' ? act.trim() : '';
                if (value.length < 5 || value.length > 60) add(`${qp}.optionActs[${j}]`, '行动文案必须是 5–60 字');
                if (value.includes('{name}')) add(`${qp}.optionActs[${j}]`, '不能使用 {name} 占位符');
              });
            }
          }
        } else if (q.type === 'choice') {
          if (Object.prototype.hasOwnProperty.call(q, 'scenario')) add(`${qp}.scenario`, '抉择题不能包含知识题柔性题面');
          if (Object.prototype.hasOwnProperty.call(q, 'optionActs')) add(`${qp}.optionActs`, '抉择题不能包含知识题行动文案');
          if (Array.isArray(q.options)) q.options.forEach((option, j) => {
            if (!isObj(option) || !text(option.text)) add(`${qp}.options[${j}]`, '抉择题选项必须是包含 text 的对象');
            if (option && Object.prototype.hasOwnProperty.call(option, 'studyTarget') && !ATTR_KEYS.includes(option.studyTarget)) {
              add(`${qp}.options[${j}].studyTarget`, '修习方向必须是诗/词/联/笔/学/思之一');
            }
            if (option && Object.prototype.hasOwnProperty.call(option, 'resultText') && !text(option.resultText)) {
              add(`${qp}.options[${j}].resultText`, '选择回声不能为空');
            }
            if (option && Object.prototype.hasOwnProperty.call(option, 'inkTags')) {
              const tags = Array.isArray(option.inkTags) ? option.inkTags : [];
              const axes = tags.map(tag => INK_AXES.findIndex(axis => axis.includes(tag)));
              if (tags.length !== 2 || tags.some(tag => !text(tag) || !INK_TAGS.has(tag)) || new Set(axes).size !== tags.length) {
                add(`${qp}.options[${j}].inkTags`, '流派倾向须为两条不同双向轴上的有效端点');
              }
            }
          });
        }
      });
    }

    if ('events' in cfg) {
      uniqueIds(cfg.events, 'events');
      if (Array.isArray(cfg.events)) cfg.events.forEach((e, i) => {
        if (!isObj(e)) return;
        if (!['direct', 'choice', 'challenge'].includes(e.kind)) add(`events[${i}].kind`, '必须是 direct、choice 或 challenge');
        if (!text(e.name)) add(`events[${i}].name`, '名称不能为空');
        if (e.kind === 'direct') {
          if (!isObj(e.effect)) add(`events[${i}].effect`, '直接事件必须包含 effect');
          if (!text(e.resultText)) add(`events[${i}].resultText`, '直接事件必须包含结算回声');
        }
        if (e.kind === 'choice') {
          if (!Array.isArray(e.choices) || e.choices.length < 2) add(`events[${i}].choices`, '选择事件至少需要两个选项');
          else e.choices.forEach((choice, j) => {
            if (!isObj(choice) || !text(choice.resultText)) add(`events[${i}].choices[${j}].resultText`, '选择事件的每个选项都必须包含回声');
          });
        }
        if (e.kind === 'challenge') {
          if (!isObj(e.challenge)) add(`events[${i}].challenge`, '挑战事件必须包含 challenge');
          else {
            if (!text(e.challenge.winText)) add(`events[${i}].challenge.winText`, '挑战事件必须包含全胜回声');
            if (!text(e.challenge.failText)) add(`events[${i}].challenge.failText`, '挑战事件必须包含未胜回声');
          }
        }
      });
    }

    if ('schools' in cfg) {
      uniqueIds(cfg.schools, 'schools');
      if (Array.isArray(cfg.schools)) cfg.schools.forEach((s, i) => {
        if (!isObj(s)) return;
        if (!ATTR_KEYS.includes(s.attr)) add(`schools[${i}].attr`, '必须是六维属性键');
        if (!text(s.name)) add(`schools[${i}].name`, '名称不能为空');
        if (text(s.talent) && talentIds.size && !talentIds.has(s.talent)) add(`schools[${i}].talent`, `引用了不存在的文心 ${s.talent}`, 'missing_ref');
      });
    }

    if ('talent-upgrade' in cfg) {
      const table = cfg['talent-upgrade'];
      if (!isObj(table)) add('talent-upgrade', '必须是以文心 ID 为键的对象');
      else for (const [id, up] of Object.entries(table)) {
        const p = `talent-upgrade.${id}`;
        if (talentIds.size && !talentIds.has(id)) add(p, `引用了不存在的文心 ${id}`, 'missing_ref');
        if (!isObj(up)) { add(p, '必须是对象'); continue; }
        const max = Number(up.maxLevel);
        if (!Number.isInteger(max) || max < 1) add(`${p}.maxLevel`, '必须是正整数');
        if (!Array.isArray(up.levels) || (Number.isInteger(max) && up.levels.length !== max)) add(`${p}.levels`, '长度必须等于 maxLevel');
        if (!Array.isArray(up.upCost) || (Number.isInteger(max) && up.upCost.length !== Math.max(0, max - 1))) add(`${p}.upCost`, '长度必须等于 maxLevel - 1');
      }
    }

    if ('board' in cfg) {
      const b = cfg.board;
      if (!isObj(b)) add('board', '必须是对象');
      else {
        const cellIds = new Set();
        if (!Array.isArray(b.mainRing)) add('board.mainRing', '必须是数组');
        else b.mainRing.forEach((cell, i) => {
          if (!isObj(cell)) { add(`board.mainRing[${i}]`, '必须是对象'); return; }
          const id = Number(cell.id);
          if (!Number.isInteger(id)) add(`board.mainRing[${i}].id`, '必须是整数');
          else if (cellIds.has(id)) add(`board.mainRing[${i}].id`, `格子 ID 重复：${id}`, 'duplicate_id');
          else cellIds.add(id);
        });
        if (Array.isArray(b.route) && b.route.length) {
          if (Array.isArray(b.mainRing) && b.route.length !== b.mainRing.length) add('board.route', '长度必须与 mainRing 一致');
          b.route.forEach((step, i) => {
            const id = Number(step && (step.cellId ?? step.id));
            if (!Number.isInteger(id) || !cellIds.has(id)) add(`board.route[${i}].cellId`, `未映射到 mainRing 格子：${id}`, 'missing_ref');
          });
        } else if (b.layout === 'concentric_spiral') add('board.route', '三圈地图必须提供 route');
        if (b.layout === 'concentric_spiral') {
          if (!Array.isArray(b.rings) || b.rings.length !== 3) add('board.rings', '三圈地图必须恰好包含三个圈层');
          if (!Array.isArray(b.phaseGates) || b.phaseGates.length < 2) add('board.phaseGates', '三圈地图至少需要两个阶段门');
          const h = b.hiddenFinalRing;
          // 增量工程允许只携带主路线；完整运行配置仍必须声明隐藏终圈。
          if (!isObj(h)) {
            if (!partial) add('board.hiddenFinalRing', '必须提供独立的隐藏终圈配置');
          } else {
            if (!text(h.id) || !text(h.name)) add('board.hiddenFinalRing', '必须包含 id 与名称');
            if (!Array.isArray(h.cells) || h.cells.length < 2 || h.cells.length > 16) add('board.hiddenFinalRing.cells', '隐藏终圈必须包含 2～16 个格子');
            else {
              const hiddenIds = new Set();
              let battles = 0;
              h.cells.forEach((cell, i) => {
                const p = `board.hiddenFinalRing.cells[${i}]`;
                const id = Number(cell && cell.id);
                if (!Number.isInteger(id)) add(`${p}.id`, '必须是整数');
                else if (hiddenIds.has(id) || cellIds.has(id)) add(`${p}.id`, `格子 ID 重复：${id}`, 'duplicate_id');
                else hiddenIds.add(id);
                if (cell && cell.type === 'battle') battles++;
                else if (!cell || cell.type !== 'secret_path') add(`${p}.type`, '除终点论战格外只能使用 secret_path');
              });
              if (battles !== 1) add('board.hiddenFinalRing.cells', '隐藏终圈必须且只能有一个论战格');
              if (!hiddenIds.has(Number(h.startCellId))) add('board.hiddenFinalRing.startCellId', '未引用隐藏终圈格子', 'missing_ref');
              if (!hiddenIds.has(Number(h.battleCellId))) add('board.hiddenFinalRing.battleCellId', '未引用隐藏终圈格子', 'missing_ref');
              const battle = h.cells.find(c => Number(c.id) === Number(h.battleCellId));
              if (!battle || battle.type !== 'battle') add('board.hiddenFinalRing.battleCellId', '必须指向唯一论战格');
            }
            const req = h.requirements;
            if (!isObj(req) || req.allAlbums !== true || Number(req.masteryLevel) !== 5 || Number(req.palaceScoreRatio) !== 2) {
              add('board.hiddenFinalRing.requirements', '隐藏资格必须要求流派 Lv5 且殿试得分达到对手 2 倍');
            }
          }
        }
      }
    }

    if ('affinity' in cfg) {
      const a = cfg.affinity;
      if (!isObj(a)) add('affinity', '必须是对象');
      else {
        if (!Array.isArray(a.themes) || !a.themes.length) add('affinity.themes', '必须是非空数组');
        if (!Array.isArray(a.manners) || !a.manners.length) add('affinity.manners', '必须是非空数组');
        if (!isObj(a.matrix)) add('affinity.matrix', '必须是对象');
        else if (Array.isArray(a.themes) && Array.isArray(a.manners)) {
          for (const m of a.manners) for (const t of a.themes) if (!finite(a.matrix[`${m}.${t}`])) add(`affinity.matrix.${m}.${t}`, '缺少有限数值');
        }
      }
    }

    if ('npcs' in cfg) {
      uniqueIds(cfg.npcs, 'npcs');
      if (Array.isArray(cfg.npcs)) {
        if (cfg.npcs.filter(tier => tier && tier.isHiddenFinal).length !== 1) add('npcs', '必须且只能提供一个隐藏终圈对手档');
        cfg.npcs.forEach((tier, i) => {
        if (!isObj(tier)) return;
        if (!Array.isArray(tier.npcs) || !tier.npcs.length) add(`npcs[${i}].npcs`, '档位必须包含对手数组');
        else {
          const seen = new Set();
          tier.npcs.forEach((npc, j) => {
            if (!isObj(npc) || !text(npc.name)) add(`npcs[${i}].npcs[${j}].name`, '对手名称不能为空');
            if (npc && text(npc.id)) {
              if (seen.has(npc.id)) add(`npcs[${i}].npcs[${j}].id`, `档位内 ID 重复：${npc.id}`);
              seen.add(npc.id);
            }
          });
          if (tier.isHiddenFinal) {
            if (tier.npcs.length !== 1) add(`npcs[${i}].npcs`, '隐藏终圈必须且只能配置一名对手');
            const npc = tier.npcs[0] || {};
            const attrs = npc.attrs || {};
            const total = ['shi','ci','lian','bi','xue','si'].reduce((n, k) => n + (Number(attrs[k]) || 0), 0);
            if (npc.name !== '陈之微' || npc.title !== '桃花仙人') add(`npcs[${i}].npcs[0]`, '隐藏终圈对手必须为「陈之微·桃花仙人」');
            if (total !== 300) add(`npcs[${i}].npcs[0].attrs`, `六维总和必须为 300，当前为 ${total}`);
          }
        }
        });
      }
    }

    if ('narrative' in cfg) {
      const hidden = cfg.narrative && cfg.narrative.hiddenFinal;
      if (!isObj(hidden)) add('narrative.hiddenFinal', '必须提供隐藏终圈邀请、胜利与失败文案');
      else for (const key of ['invite', 'victory', 'defeat']) {
        const block = hidden[key];
        if (!isObj(block) || !text(block.title) || !text(block.text)) add(`narrative.hiddenFinal.${key}`, '必须包含标题与正文');
      }
    }

    for (const key of ['sky', 'album', 'synergies']) if (key in cfg) uniqueIds(cfg[key], key);
    if ('album' in cfg && Array.isArray(cfg.album)) cfg.album.forEach((card, i) => {
      const p = `album[${i}]`;
      if (!text(card.name)) add(`${p}.name`, '名篇名称不能为空');
      if (!isObj(card.unlock) || !text(card.unlock.type) || !finite(card.unlock.min) || Number(card.unlock.min) < 1) add(`${p}.unlock`, '解锁条件必须包含 type 与正数 min');
      if (!isObj(card.reward) || !text(card.reward.type)) add(`${p}.reward`, '旧奖励字段必须保留且包含 type');
      if (card.growth != null) {
        if (!isObj(card.growth)) add(`${p}.growth`, '成长配置必须是对象');
        else for (const k of ['baseXp', 'winXp', 'drawXp', 'loseXp', 'styleXp']) if (card.growth[k] != null && (!finite(card.growth[k]) || Number(card.growth[k]) < 0)) add(`${p}.growth.${k}`, '成长经验必须是非负数字');
      }
      if (card.branches != null) {
        if (!Array.isArray(card.branches)) add(`${p}.branches`, '成长分支必须是数组');
        else if (card.branches.length > 0) {
          const branchIds = new Set();
          card.branches.forEach((branch, j) => {
            const bp = `${p}.branches[${j}]`;
            if (!isObj(branch) || !text(branch.id) || !text(branch.name)) add(bp, '分支必须包含唯一 id 与名称');
            else if (branchIds.has(branch.id)) add(`${bp}.id`, `分支 ID 重复：${branch.id}`, 'duplicate_id');
            else branchIds.add(branch.id);
            if (branch && (!finite(branch.minLevel) || Number(branch.minLevel) < 1)) add(`${bp}.minLevel`, '分支最低等级必须是正数');
            if (branch && !Array.isArray(branch.effects)) add(`${bp}.effects`, '分支必须包含 effects 数组');
            else if (branch) branch.effects.forEach((ef, k) => {
              const ep = `${bp}.effects[${k}]`;
              if (!isObj(ef) || !['start', 'battle', 'quiz', 'event', 'phase', 'score'].includes(ef.trigger)) add(`${ep}.trigger`, '效果触发点非法');
              const types = ['attr', 'inspiration', 'inspirationMax', 'insight', 'manuscript', 'strategy', 'studySlot', 'techniqueXp', 'pct'];
              if (!isObj(ef) || !types.includes(ef.type)) add(`${ep}.type`, '效果类型非法');
              if (ef && ef.style != null && !STYLE_KEYS.has(ef.style)) add(`${ep}.style`, '效果文体非法');
              if (ef && ef.result != null && !['win', 'draw', 'lose'].includes(ef.result)) add(`${ep}.result`, '效果结果条件非法');
              if (ef && ef.phase != null && !text(ef.phase)) add(`${ep}.phase`, '效果阶段条件非法');
              if (ef && ef.minLevel != null && (!Number.isInteger(Number(ef.minLevel)) || Number(ef.minLevel) < 1 || Number(ef.minLevel) < Number(branch.minLevel || 1))) add(`${ep}.minLevel`, '效果生效等级必须是不低于分支等级的正整数');
              if (ef && ef.value != null && !finite(ef.value)) add(`${ep}.value`, '效果数值必须是有限数字');
            });
          });
        }
      }
    });
    if ('grades' in cfg && !isObj(cfg.grades)) add('grades', '必须是对象');
    if ('narrative' in cfg && !isObj(cfg.narrative)) add('narrative', '必须是对象');
    if ('npc-mechanics' in cfg && !isObj(cfg['npc-mechanics'])) add('npc-mechanics', '必须是对象');

    const known = new Set([...REQUIRED_CONFIG_KEYS, ...PROJECT_KEYS, 'album', 'synergies', 'npc-mechanics']);
    if (!partial) for (const key of Object.keys(cfg)) if (!known.has(key)) warn(key, '未知配置块，将按原样保留', 'unknown_key');
    return { ok: errors.length === 0, errors, warnings };
  }

  function validateProject(project, options = {}) {
    const result = validateConfig(project, { partial: true });
    if (!isObj(project)) return result;
    if (options.requireType !== false && project._type !== 'feihua-content') {
      result.errors.unshift({ path: '_type', message: '必须是 feihua-content', code: 'project_type' });
    }
    if (options.requireComplete !== false) {
      for (const key of PROJECT_KEYS) if (!(key in project)) result.errors.push({ path: key, message: '完整工程缺少该配置块', code: 'required' });
    }
    result.ok = result.errors.length === 0;
    return result;
  }

  function assertConfig(config, options) {
    const result = validateConfig(config, options);
    if (!result.ok) throw new ConfigContractError(result);
    return result;
  }

  function assertProject(project, options) {
    const result = validateProject(project, options);
    if (!result.ok) throw new ConfigContractError(result, '工程配置契约校验失败');
    return result;
  }

  root.FeihuaConfigContract = {
    REQUIRED_CONFIG_KEYS, PROJECT_KEYS, ConfigContractError,
    validateConfig, validateProject, assertConfig, assertProject
  };
})(globalThis);
