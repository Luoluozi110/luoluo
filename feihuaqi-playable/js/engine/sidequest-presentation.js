/**
 * 名胜支线的展示语境。
 * 规则阶段（state.phase）继续负责题库、NPC 档位与阶段资源；本模块只派生可见文案。
 */
export const MAIN_PHASE_NAMES = Object.freeze({
  child: '童生', xiucai: '秀才', juren: '举人', jinshi: '进士', palace: '殿试',
  lap1: '乡试圈', lap2: '会试圈', secret: '桃源终卷'
});

const ACTIVE_STAGES = new Set(['decision', 'climax']);

export function mainPhaseName(phase) { return MAIN_PHASE_NAMES[phase] || MAIN_PHASE_NAMES.child; }
export function isSideQuestPresentationActive(state) { return !!(state && state.routeId && ACTIVE_STAGES.has(state.stage)); }

export function interpolateSideQuestCopy(text, values = {}) {
  return String(text || '').replace(/\{([a-zA-Z][\w]*)\}/g, (_, key) => String(values[key] ?? ''));
}

export function sideQuestPresentation(route, state, mainPhase = 'child') {
  const mainLabel = mainPhaseName(mainPhase);
  if (!route || !isSideQuestPresentationActive(state)) {
    return { active: false, routeId: '', stage: '', stageName: mainLabel, mainPhase, mainStageName: mainLabel, transition: '', battle: null };
  }
  const cfg = route.presentation || {};
  const stage = state.stage;
  const fallbackStage = stage === 'climax' ? `${route.name || '支线'}·应验` : `${route.name || '支线'}·取舍`;
  const values = {
    routeId: route.id || '', routeName: route.name || '支线', stage,
    stageName: (cfg.stageNames || {})[stage] || fallbackStage,
    mainPhase, mainStage: mainLabel,
    battleLabel: route.battleLabel || '支线论战', finalLabel: route.finalLabel || '支线终问'
  };
  return {
    active: true, routeId: route.id || '', stage, stageName: values.stageName,
    mainPhase, mainStageName: mainLabel,
    transition: interpolateSideQuestCopy((cfg.transitions || {})[stage], values),
    battle: stage === 'climax' ? sideQuestBattleCopy(route, 'climax') : null
  };
}

export function sideQuestTransition(route, stage, mainPhase = 'child') {
  const cfg = (route && route.presentation) || {};
  return interpolateSideQuestCopy((cfg.transitions || {})[stage], {
    routeId: route && route.id || '', routeName: route && route.name || '支线', stage,
    stageName: (cfg.stageNames || {})[stage] || '', mainPhase, mainStage: mainPhaseName(mainPhase),
    battleLabel: route && route.battleLabel || '支线论战', finalLabel: route && route.finalLabel || '支线终问'
  });
}

export function sideQuestBattleCopy(route, kind = 'climax') {
  if (!route) return null;
  const configured = ((((route.presentation || {}).battles || {})[kind])) || {};
  const legacySteps = Array.isArray(route.steps) ? route.steps.slice(0, 6) : null;
  const steps = Array.isArray(configured.steps) ? configured.steps.slice(0, 6) : legacySteps;
  if (!Object.keys(configured).length && !steps) return null;
  return { ...configured, steps, battleKind: kind };
}
