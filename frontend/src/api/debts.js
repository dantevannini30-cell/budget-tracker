import { API } from "@/shared/api/client";

async function handleResponse(res, msg) {
  if (!res.ok) throw new Error(await res.text() || msg);
  return res.json();
}

export async function getDebts() {
  const res = await fetch(`${API}/api/debts`);
  return handleResponse(res, "Failed to load debts");
}

export async function createDebt(payload) {
  const res = await fetch(`${API}/api/debts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to create debt");
}

export async function updateDebt(id, payload) {
  const res = await fetch(`${API}/api/debts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to update debt");
}

export async function deleteDebt(id) {
  const res = await fetch(`${API}/api/debts/${id}`, {
    method: "DELETE",
  });

  return handleResponse(res, "Failed to delete debt");
}

export async function createDebtPayment(id, payload) {
  const res = await fetch(`${API}/api/debts/${id}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to add debt payment");
}

export async function deleteDebtPayment(debtId, paymentId) {
  const res = await fetch(`${API}/api/debts/${debtId}/payments/${paymentId}`, {
    method: "DELETE",
  });

  return handleResponse(res, "Failed to delete debt payment");
}
