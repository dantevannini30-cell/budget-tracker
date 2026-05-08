import { API } from "@/shared/api/client";

export async function getDashboard(start_date, end_date) {
  const params = new URLSearchParams();

  if (start_date) params.append("start_date", start_date);
  if (end_date) params.append("end_date", end_date);

  const res = await fetch(
    `${API}/api/dashboard?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error("Failed to load dashboard");
  }

  return res.json();
}