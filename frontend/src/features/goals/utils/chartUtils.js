export function buildSpendingTargetChartData(
  targets,
  progress
) {
  return targets.map((target) => {
    const data = progress[target.id];

    return {
      name: target.name,
      target: target.amount,
      current:
        data?.periods?.[0]?.spent || 0,
    };
  });
}

export function buildSavingGoalChartData(
  goals,
  progress
) {
  return goals.map((goal) => {
    const data = progress[goal.id];

    return {
      name: goal.name,
      target: data?.target || goal.target,
      current: data?.saved || 0,
    };
  });
}