import { API } from "@/shared/api/client";

async function handleResponse(res, msg) {
  if (!res.ok) throw new Error(await res.text() || msg);
  return res.json();
}

export async function getCategories() {
  const res = await fetch(`${API}/api/categories`);
  return handleResponse(res, "Failed to load categories");
}

export async function getCategoryTransactions(category) {
  const res = await fetch(
    `${API}/api/categories/${encodeURIComponent(category)}/transactions`
  );
  return handleResponse(res, "Failed to load category transactions");
}

export async function setCategoryRecurring(category, active) {
  const res = await fetch(`${API}/api/categories/recurring`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category, active }),
  });

  return handleResponse(res, "Failed to update recurring category");
}
