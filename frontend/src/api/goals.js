import { API } from "@/shared/api/client";

// ─── Spending Targets ─────────────────────────────────────

export async function getSpendingTargets(budgetId) {
  const res = await fetch(
    `${API}/api/budgets/${budgetId}/spending-targets`
  );

  if (!res.ok) {
    throw new Error("Failed to load spending targets");
  }

  return res.json();
}

export async function createSpendingTarget(budgetId, payload) {
  const res = await fetch(
    `${API}/api/budgets/${budgetId}/spending-targets`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to create spending target");
  }

  return res.json();
}

export async function getSpendingTargetProgress(budgetId, targetId) {
  if (!targetId) {
    console.warn("Missing targetId in getSpendingTargetProgress");
    return null;
  }

  const res = await fetch(
    `${API}/api/budgets/${budgetId}/spending-targets/${targetId}/progress`
  );

  if (!res.ok) {
    throw new Error("Failed to load spending progress");
  }

  return res.json();
}

// ─── Saving Goals ─────────────────────────────────────────

export async function getSavingGoals(budgetId) {
  const res = await fetch(
    `${API}/api/budgets/${budgetId}/saving-goals`
  );

  if (!res.ok) {
    throw new Error("Failed to load saving goals");
  }

  return res.json();
}

export async function createSavingGoal(budgetId, payload) {
  const res = await fetch(
    `${API}/api/budgets/${budgetId}/saving-goals`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    throw new Error("Failed to create saving goal");
  }

  return res.json();
}

export async function getSavingGoalProgress(budgetId, goalId) {
  const res = await fetch(
    `${API}/api/budgets/${budgetId}/saving-goals/${goalId}/progress`
  );

  if (!res.ok) {
    throw new Error("Failed to load saving goal progress");
  }

  return res.json();
}