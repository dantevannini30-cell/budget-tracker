import { useState, useEffect } from "react";

import { API } from "@/api/constants";
import SpendingOverviewSection from "./SpendingOverviewSection";
import SpendingTargetsSection from "./goals/SpendingTargetsSection";
import SavingGoalsSection from "./goals/SavingGoalsSection";
import NetWorthProjectionSection from "./NetWorthProjectionSection";
import DebtsSection from "./debts/DebtsSection";
import RecurringCashflowSection from "./RecurringCashflowSection";

export default function Dashboard() {
  // Initialize with last week by default
  const getDefaultDates = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
      startDate: sevenDaysAgo.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
    };
  };

  const [dateRange, setDateRange] = useState(() => {
    // Try to load from localStorage
    const stored = localStorage.getItem("dashboardDateRange");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return getDefaultDates();
      }
    }
    return getDefaultDates();
  });

  const [allTransactions, setAllTransactions] = useState([]);

  // Fetch all transactions once for the category dropdown
  useEffect(() => {
    fetch(`${API}/api/transactions`)
      .then(r => r.json())
      .then(data => setAllTransactions(data))
      .catch(() => setAllTransactions([]));
  }, []);

  // Save to localStorage whenever date range changes
  useEffect(() => {
    localStorage.setItem("dashboardDateRange", JSON.stringify(dateRange));
  }, [dateRange]);

  const handleDateChange = (startDate, endDate) => {
    setDateRange({ startDate, endDate });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Spending Overview Section */}
      <SpendingOverviewSection
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        onDateChange={handleDateChange}
      />

      <RecurringCashflowSection />

      <NetWorthProjectionSection />

      {/* Spending Targets Section */}
      <SpendingTargetsSection transactions={allTransactions} />

      <DebtsSection transactions={allTransactions} />

      {/* Saving Goals Section */}
      <SavingGoalsSection />
    </div>
  );
}
