import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { API } from "@/api/constants";
import StatCard from "@/components/StatCard";
import Skel from "@/components/Skel";

const PIE_COLORS = ["#00d4aa", "#ff4d6d", "#ffa502", "#6366f1", "#8b5cf6", "#d946ef", "#0891b2", "#06b6d4"];

const PieChartWrapper = ({ data, title }) => (
  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 16, flex: 1, minWidth: 280 }}>
    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted2)", marginBottom: 12 }}>{title}</div>
    {data.length === 0 ? (
      <div style={{ textAlign: "center", color: "var(--muted2)", padding: "40px 20px", fontSize: 12 }}>No data</div>
    ) : (
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
            {data.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
          </Pie>
          <Tooltip 
            formatter={(value) => `$${value.toFixed(2)}`} 
            contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 2, color: "var(--text)" }} 
          />
        </PieChart>
      </ResponsiveContainer>
    )}
    <div style={{ marginTop: 12, fontSize: 10 }}>
      {data.map((item, i) => (
        <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "var(--muted2)" }}>
          <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>● {item.name}</span>
          <span>${item.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  </div>
);

export default function SpendingOverviewSection({ startDate, endDate, onDateChange }) {
  const [summary, setSummary] = useState(null);
  const [incomeData, setIncomeData] = useState([]);
  const [spendingData, setSpendingData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    // Fetch summary stats
    const summaryUrl = new URL(`${API}/api/summary`);
    if (startDate) summaryUrl.searchParams.append("start_date", startDate);
    if (endDate) summaryUrl.searchParams.append("end_date", endDate);
    
    Promise.all([
      fetch(summaryUrl).then(r => r.json()),
      fetch(`${API}/api/summary/by-category/income${startDate || endDate ? `?${new URLSearchParams({ ...(startDate && { start_date: startDate }), ...(endDate && { end_date: endDate }) }).toString()}` : ""}`).then(r => r.json()),
      fetch(`${API}/api/summary/by-category${startDate || endDate ? `?${new URLSearchParams({ ...(startDate && { start_date: startDate }), ...(endDate && { end_date: endDate }) }).toString()}` : ""}`).then(r => r.json()),
    ]).then(([summaryRes, incomeRes, spendingRes]) => {
      setSummary(summaryRes);
      setIncomeData(incomeRes.map(item => ({ name: item.category, value: item.total })));
      setSpendingData(spendingRes.map(item => ({ name: item.category, value: item.total })));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [startDate, endDate]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Date Filter Buttons */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--muted2)", textTransform: "uppercase", letterSpacing: "0.1em" }}>Period:</span>
        {["Last Week", "Last Month", "Last Year"].map(label => {
          let calculatedStartDate, calculatedEndDate;
          const now = new Date();
          const today = now.toISOString().split("T")[0];
          
          if (label === "Last Week") {
            calculatedStartDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            calculatedEndDate = today;
          } else if (label === "Last Month") {
            calculatedStartDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate()).toISOString().split("T")[0];
            calculatedEndDate = today;
          } else if (label === "Last Year") {
            calculatedStartDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().split("T")[0];
            calculatedEndDate = today;
          }
          
          const isActive = startDate === calculatedStartDate && endDate === calculatedEndDate;
          
          return (
            <button
              key={label}
              onClick={() => onDateChange(calculatedStartDate, calculatedEndDate)}
              style={{
                background: isActive ? "var(--accent)" : "var(--surface2)",
                border: isActive ? "1px solid var(--accent)" : "1px solid var(--border2)",
                color: isActive ? "var(--bg)" : "var(--text)",
                padding: "6px 12px",
                borderRadius: 2,
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <Skel key={i} h={80} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          <StatCard label="In" value={`$${(summary?.total_in || 0).toFixed(2)}`} color="var(--green)" />
          <StatCard label="Out" value={`$${(summary?.total_out || 0).toFixed(2)}`} color="var(--red)" />
          <StatCard label="Net" value={`$${(summary?.net || 0).toFixed(2)}`} color={summary?.net >= 0 ? "var(--green)" : "var(--red)"} />
          <StatCard label="Balance" value={`$${(summary?.total_in - summary?.total_out || 0).toFixed(2)}`} color="var(--accent)" />
        </div>
      )}

      {/* Pie Charts */}
      {loading ? (
        <div style={{ display: "flex", gap: 16 }}>
          <Skel h={300} />
          <Skel h={300} />
        </div>
      ) : (
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <PieChartWrapper data={incomeData} title="Income by Category" />
          <PieChartWrapper data={spendingData} title="Spending by Category" />
        </div>
      )}
    </div>
  );
}
