import { API } from "@/shared/api/client";

export async function getNetWorthProjection({
  period = "monthly",
  historyCount = 52,
  futureCount = 52,
} = {}) {
  const params = new URLSearchParams({
    period,
    history_count: String(historyCount),
    future_count: String(futureCount),
  });

  const res = await fetch(`${API}/api/net-worth/projection?${params}`);

  if (!res.ok) {
    throw new Error(await res.text() || "Failed to load net worth projection");
  }

  return res.json();
}
