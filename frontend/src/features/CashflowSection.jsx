import { useEffect, useState } from "react";

import { API } from "@/api/constants";
import SectionShell from "@/components/SectionShell";
import NetWorthProjectionSection from "@/features/NetWorthProjectionSection";
import RecurringCashflowSection from "@/features/RecurringCashflowSection";
import SpendingOverviewSection from "@/features/SpendingOverviewSection";

function getDefaultDates() {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return {
    startDate: sevenDaysAgo.toISOString().split("T")[0],
    endDate: now.toISOString().split("T")[0],
  };
}

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

export default function CashflowSection() {
  const [dateRange, setDateRange] = useState(() => {
    const stored = localStorage.getItem("dashboardDateRange");
    if (!stored) return getDefaultDates();

    try {
      return JSON.parse(stored);
    } catch {
      return getDefaultDates();
    }
  });
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    localStorage.setItem("dashboardDateRange", JSON.stringify(dateRange));
  }, [dateRange]);

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const params = new URLSearchParams();
        if (dateRange.startDate) params.append("start_date", dateRange.startDate);
        if (dateRange.endDate) params.append("end_date", dateRange.endDate);

        const res = await fetch(`${API}/api/dashboard?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load cashflow summary");
        const data = await res.json();
        if (!cancelled) setSummary(data);
      } catch (err) {
        console.error("Failed loading cashflow summary:", err);
        if (!cancelled) setSummary(null);
      }
    }

    loadSummary();

    return () => {
      cancelled = true;
    };
  }, [dateRange]);

  const incomeTotal = (summary?.income_summary || []).reduce(
    (sum, item) => sum + Number(item.total || 0),
    0
  );
  const expenseTotal = (summary?.summary || []).reduce(
    (sum, item) => sum + Number(item.total || 0),
    0
  );
  const net = incomeTotal - expenseTotal;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <SectionShell
        title="Spending"
        description="Income, expenses, and category mix"
        summary={[
          { label: "Income", value: summary ? formatMoney(incomeTotal) : "-", tone: "good" },
          { label: "Out", value: summary ? formatMoney(expenseTotal) : "-", tone: "bad" },
          { label: "Net", value: summary ? formatMoney(net) : "-", tone: net >= 0 ? "good" : "bad" },
        ]}
      >
        <SpendingOverviewSection
          startDate={dateRange.startDate}
          endDate={dateRange.endDate}
          onDateChange={(startDate, endDate) => setDateRange({ startDate, endDate })}
          showAccounts={false}
        />
      </SectionShell>

      <SectionShell
        title="Recurring Cashflow"
        description="Recurring income and expense trend"
        defaultExpanded={false}
        summary={[
          { label: "View", value: "Weekly-monthly-yearly" },
          { label: "Includes", value: "Recurring labels" },
        ]}
      >
        <RecurringCashflowSection />
      </SectionShell>

      <SectionShell
        title="Net Worth"
        description="Actual balances and projection"
        defaultExpanded={false}
        summary={[
          { label: "Forecast", value: "Projected" },
          { label: "Inputs", value: "Income, spend, debts" },
        ]}
      >
        <NetWorthProjectionSection />
      </SectionShell>
    </div>
  );
}
