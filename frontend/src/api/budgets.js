import { API } from "./constants";

export async function getBudgets() {
  const res = await fetch(`${API}/api/budgets`);

  if (!res.ok) {
    throw new Error("Failed to load budgets");
  }

  return res.json();
}

export async function createBudget(payload) {
  const res = await fetch(`${API}/api/budgets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to create budget");
  }

  return res.json();
}

export async function deleteBudget(id) {
  const res = await fetch(`${API}/api/budgets/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error("Failed to delete budget");
  }

  return res.json();
}