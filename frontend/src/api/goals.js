import { API } from "@/shared/api/client";

async function handleResponse(res, msg) {
  if (!res.ok) throw new Error(await res.text() || msg);
  return res.json();
}

// ─── Spending Targets ─────────────────────────────

export async function getSpendingTargets() {
  const res = await fetch(`${API}/api/spending-targets`);
  return handleResponse(res, "Failed to load spending targets");
}

export async function createSpendingTarget(payload) {
  const res = await fetch(`${API}/api/spending-targets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to create spending target");
}

export async function updateSpendingTarget(id, payload) {
  const res = await fetch(`${API}/api/spending-targets/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to update spending target");
}

// ─── Saving Goals ────────────────────────────────

export async function getSavingGoals() {
  const res = await fetch(`${API}/api/saving-goals`);
  return handleResponse(res, "Failed to load saving goals");
}

export async function createSavingGoal(payload) {
  const res = await fetch(`${API}/api/saving-goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to create saving goal");
}

export async function updateSavingGoal(id, payload) {
  const res = await fetch(`${API}/api/saving-goals/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to update saving goal");
}
