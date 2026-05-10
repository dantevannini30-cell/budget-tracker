import { API } from "@/shared/api/client";

async function handleResponse(res, msg) {
  if (!res.ok) throw new Error(await res.text() || msg);
  return res.json();
}

export async function getAllocations() {
  const res = await fetch(`${API}/api/allocations`);
  return handleResponse(res, "Failed to load allocations");
}

export async function createAllocation(payload) {
  const res = await fetch(`${API}/api/allocations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return handleResponse(res, "Failed to create allocation");
}

export async function deleteAllocation(id) {
  const res = await fetch(`${API}/api/allocations/${id}`, {
    method: "DELETE",
  });

  return handleResponse(res, "Failed to delete allocation");
}
