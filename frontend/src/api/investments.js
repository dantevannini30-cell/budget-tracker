import { API } from "@/shared/api/client";

async function handleResponse(res, msg) {
  if (!res.ok) throw new Error(await res.text() || msg);
  return res.json();
}

export async function getInvestments() {
  const res = await fetch(`${API}/api/investments`);
  return handleResponse(res, "Failed to load investments");
}

export async function createInvestment(payload) {
  const res = await fetch(`${API}/api/investments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to create investment");
}

export async function updateInvestment(id, payload) {
  const res = await fetch(`${API}/api/investments/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to update investment");
}

export async function deleteInvestment(id) {
  const res = await fetch(`${API}/api/investments/${id}`, {
    method: "DELETE",
  });

  return handleResponse(res, "Failed to delete investment");
}

export async function createInvestmentValue(id, payload) {
  const res = await fetch(`${API}/api/investments/${id}/values`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to add investment value");
}

export async function deleteInvestmentValue(investmentId, valueId) {
  const res = await fetch(`${API}/api/investments/${investmentId}/values/${valueId}`, {
    method: "DELETE",
  });

  return handleResponse(res, "Failed to delete investment value");
}
