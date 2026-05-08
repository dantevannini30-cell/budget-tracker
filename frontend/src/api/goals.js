import { API } from "@/shared/api/client";

// ─── Spending Targets ─────────────────────────────────────

export async function getSpendingTargets(budgetId) {
  const endpoint = budgetId 
    ? `${API}/api/budgets/${budgetId}/spending-targets`
    : `${API}/api/spending-targets`;
  
  const res = await fetch(endpoint);

  if (!res.ok) {
    throw new Error("Failed to load spending targets");
  }

  return res.json();
}

export async function createSpendingTarget(budgetId, payload) {
  const endpoint = budgetId 
    ? `${API}/api/budgets/${budgetId}/spending-targets`
    : `${API}/api/spending-targets`;
  
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

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

  const endpoint = budgetId 
    ? `${API}/api/budgets/${budgetId}/spending-targets/${targetId}/progress`
    : `${API}/api/spending-targets/${targetId}/progress`;

  const res = await fetch(endpoint);

  if (!res.ok) {
    throw new Error("Failed to load spending progress");
  }

  return res.json();
}

// ─── Saving Goals ─────────────────────────────────────────

export async function getSavingGoals(budgetId) {
  const endpoint = budgetId 
    ? `${API}/api/budgets/${budgetId}/saving-goals`
    : `${API}/api/saving-goals`;
  
  const res = await fetch(endpoint);

  if (!res.ok) {
    throw new Error("Failed to load saving goals");
  }

  return res.json();
}

export async function createSavingGoal(budgetId, payload) {
  const endpoint = budgetId 
    ? `${API}/api/budgets/${budgetId}/saving-goals`
    : `${API}/api/saving-goals`;
  
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to create saving goal");
  }

  return res.json();
}

export async function getSavingGoalProgress(budgetId, goalId) {
  const endpoint = budgetId 
    ? `${API}/api/budgets/${budgetId}/saving-goals/${goalId}/progress`
    : `${API}/api/saving-goals/${goalId}/progress`;
  
  const res = await fetch(endpoint);

  if (!res.ok) {
    throw new Error("Failed to load saving goal progress");
  }

  return res.json();
}