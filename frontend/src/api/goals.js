import { API } from "@/shared/api/client";

// ─── Shared Helper ────────────────────────────────────────

async function handleResponse(res, fallbackMessage) {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || fallbackMessage);
  }

  return res.json();
}

// ─── Spending Targets ────────────────────────────────────

export async function getSpendingTargets() {
  const res = await fetch(
    `${API}/api/spending-targets`
  );

  return handleResponse(
    res,
    "Failed to load spending targets"
  );
}

export async function createSpendingTarget(payload) {
  const res = await fetch(
    `${API}/api/spending-targets`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(
    res,
    "Failed to create spending target"
  );
}

export async function getSpendingTargetProgress(targetId) {
  if (!targetId) {
    console.warn(
      "Missing targetId in getSpendingTargetProgress"
    );

    return null;
  }

  const res = await fetch(
    `${API}/api/spending-targets/${targetId}/progress`
  );

  return handleResponse(
    res,
    "Failed to load spending target progress"
  );
}

// ─── Saving Goals ────────────────────────────────────────

export async function getSavingGoals() {
  const res = await fetch(
    `${API}/api/saving-goals`
  );

  return handleResponse(
    res,
    "Failed to load saving goals"
  );
}

export async function createSavingGoal(payload) {
  const res = await fetch(
    `${API}/api/saving-goals`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  return handleResponse(
    res,
    "Failed to create saving goal"
  );
}

export async function getSavingGoalProgress(goalId) {
  if (!goalId) {
    console.warn(
      "Missing goalId in getSavingGoalProgress"
    );

    return null;
  }

  const res = await fetch(
    `${API}/api/saving-goals/${goalId}/progress`
  );

  return handleResponse(
    res,
    "Failed to load saving goal progress"
  );
}