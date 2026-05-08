export function buildSpendingTargetChartData(
  targets = [],
  progress = {}
) {
  const safeProgress = progress || {};
  if (!Array.isArray(targets)) return [];

  return targets.map((target) => {
    const p = safeProgress[target.id];

    return {
      id: target.id,
      name: target.name,
      target: target.amount ?? 0,

      // support both old + new backend formats
      current:
        p?.current_spent ??
        p?.spent ??
        target.current_spent ??
        0,

      progress_pct:
        p?.progress_pct ??
        target.progress_pct ??
        0,
    };
  });
}

export function buildSavingGoalChartData(
  goals = [],
  progress = {}
) {
  if (!Array.isArray(goals)) return [];

  return goals.map((goal) => {
    const p = progress?.[goal.id];

    return {
      id: goal.id,
      name: goal.name,

      // backend-first, fallback to goal object
      target:
        p?.target_amount ??
        goal.target_amount ??
        goal.target ??
        0,

      current:
        p?.saved ??
        p?.current_amount ??
        goal.current_amount ??
        0,
    };
  });
}


// export function buildSpendingTargetChartData(
//   targets = [],
//   progress = {}
// ) {
//   if (!Array.isArray(targets)) return [];

//   return targets.map((target) => {
//     const p = progress?.[target.id] || {};

//     return {
//       id: target.id,
//       name: target.name,
//       target: target.amount ?? 0,
//       current: p.current_spent ?? p.spent ?? 0,
//       progress_pct: p.progress_pct ?? 0,
//     };
//   });
// }