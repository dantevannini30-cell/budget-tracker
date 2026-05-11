import { useEffect, useState } from "react";

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

  useEffect(() => {
    localStorage.setItem("dashboardDateRange", JSON.stringify(dateRange));
  }, [dateRange]);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <SectionShell
        title="Spending"
        description="Income, expenses, and category mix"
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
      >
        <RecurringCashflowSection embedded />
      </SectionShell>

      <SectionShell
        title="Net Worth"
        description="Actual balances and projection"
        defaultExpanded={false}
      >
        <NetWorthProjectionSection embedded />
      </SectionShell>
    </div>
  );
}
