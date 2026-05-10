import { API } from "@/shared/api/client";

export async function getRecurringCashflowHistory({
  period = "monthly",
  count = 12,
} = {}) {
  const params = new URLSearchParams({
    period,
    count: String(count),
  });

  const res = await fetch(`${API}/api/recurring-cashflow/history?${params}`);

  if (!res.ok) {
    throw new Error(await res.text() || "Failed to load recurring cashflow");
  }

  return res.json();
}
