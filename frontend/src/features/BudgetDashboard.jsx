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
import CategoryModal from "@/components/CategoryModal";
import FilterDropdown from "@/components/FilterDropdown";
import SortDropdown from "@/components/SortDropdown";


import SpendingTargetsSection from "./goals/SpendingTargetsSection";
import SavingGoalsSection from "./goals/SavingGoalsSection";


// Import the logic shared with the Transactions Tab
import {
  DEFAULT_FILTERS,
  applyFilters,
  applySort,
} from "./TransactionsTab";

// --- Constants & Sub-components ---
const PIE_COLORS = ["#00d4aa", "#ff4d6d", "#ffa502", "#6366f1", "#8b5cf6", "#d946ef", "#0891b2", "#06b6d4"];

const PieChartWrapper = ({ data, title }) => (
  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 16, flex: 1, minWidth: 280 }}>
    <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted2)", marginBottom: 12 }}>{title}</div>
    {data.length === 0 ? (
      <div style={{ textAlign: "center", color: "var(--muted2)", padding: "40px 20px", fontSize: 12 }}>No transactions</div>
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

// Note: You should also paste your TxRow component here if it's not exported elsewhere
function TxRow({ txn, i, onEdit }) {
  const isInc = txn.amount > 0;
  return (
    <div className="fade-up" style={{ 
      display: "grid", 
      gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr", 
      gap: 12, 
      padding: "12px 16px", 
      borderBottom: "1px solid var(--border)",
      animationDelay: `${i * 0.03}s`,
      alignItems: "center"
    }}>
      <span style={{ fontSize: 11, color: "var(--muted2)", fontFamily: "var(--font-mono)" }}>{txn.date}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: isInc ? "var(--green)" : "var(--red)", fontFamily: "var(--font-mono)" }}>
        {isInc ? "+" : ""}{txn.amount.toFixed(2)}
      </span>
      <span 
        onClick={() => onEdit(txn, "category")}
        style={{ fontSize: 11, color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
      >
        {txn.category || "Uncategorized"}
      </span>
      <span 
        onClick={() => onEdit(txn, "description")}
        style={{ fontSize: 12, color: "var(--text)", cursor: "pointer" }}
      >
        {txn.description || "—"}
      </span>
      <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {txn.statement_description}
      </span>
    </div>
  );
}

// --- Main Component ---
export default function BudgetDashboard({ budgetId, onClearBudget }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("date_desc");
  const [editingTxn, setEditingTxn] = useState(null);

  useEffect(() => {
    if (!budgetId) return;
    setLoading(true);
    setError("");
    fetch(`${API}/api/budgets/${budgetId}/summary`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load budget summary");
        return res.json();
      })
      .then(data => { setSummary(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [budgetId]);

  useEffect(() => {
    if (!budgetId) return;
    setTxLoading(true);
    fetch(`${API}/api/budgets/${budgetId}/transactions`)
      .then(r => r.json())
      .then(data => { setTransactions(data); setTxLoading(false); })
      .catch(() => setTxLoading(false));
  }, [budgetId]);

  const editTransaction = async (txn, field) => {
    if (field === "category") {
      setEditingTxn(txn);
    } else {
      const value = prompt("Edit description:", txn.description || "");
      if (value === null) return;
      try {
        const res = await fetch(`${API}/api/transactions/${txn.id}/category`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: value }),
        });
        if (!res.ok) throw new Error("Failed to update transaction");
        setTransactions(prev => prev.map(item => item.id === txn.id ? { ...item, description: value } : item));
      } catch (err) { alert(err.message); }
    }
  };

  const submitCategoryEdit = async (newCategory) => {
    if (!editingTxn) return;
    try {
      const res = await fetch(`${API}/api/transactions/${editingTxn.id}/category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });
      if (!res.ok) throw new Error("Failed to update transaction");
      setTransactions(prev => prev.map(item => item.id === editingTxn.id ? { ...item, category: newCategory } : item));
      setEditingTxn(null);
    } catch (err) { alert(err.message); }
  };

  const calculateCategoryTotals = (txns, isIncome = true) => {
    const filtered = txns.filter(t => (isIncome && t.amount > 0) || (!isIncome && t.amount < 0));
    const totals = {};
    filtered.forEach(t => {
      const cat = t.category || "Uncategorized";
      totals[cat] = (totals[cat] || 0) + Math.abs(t.amount);
    });
    return Object.entries(totals).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) })).sort((a, b) => b.value - a.value);
  };

  const getLastWeekTransactions = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return transactions.filter(t => new Date(t.date) >= sevenDaysAgo);
  };

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Skel h={20} /><Skel h={20} /><Skel h={20} /></div>;
  if (error) return <p style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{error}</p>;
  if (!summary) return null;

  const { start_date, created_at, transaction_count, summary: stats } = summary;
  const rawStats = stats?.all ?? stats ?? summary;
  const all = {
    total_in: rawStats.total_in ?? 0,
    total_out: rawStats.total_out ?? 0,
    net: rawStats.net ?? 0,
    total_balance: rawStats.total_balance ?? ((rawStats.total_in ?? 0) - (rawStats.total_out ?? 0)),
  };

  const weekTxns = getLastWeekTransactions();
  const lastWeek = stats?.last_week ?? rawStats.last_week ?? {
    total_in: weekTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0),
    total_out: weekTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
    net: weekTxns.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0) - weekTxns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0),
  };
  const totalBalance = all.total_balance;

  const allCatsIncome = calculateCategoryTotals(transactions, true);
  const allCatsExpense = calculateCategoryTotals(transactions, false);
  const weekCatsIncome = calculateCategoryTotals(weekTxns, true);
  const weekCatsExpense = calculateCategoryTotals(weekTxns, false);
  const filteredTransactions = applySort(applyFilters(transactions, search, filters), sort);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {editingTxn && (
        <CategoryModal
          transactions={transactions}
          onSubmit={submitCategoryEdit}
          onClose={() => setEditingTxn(null)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)" }}>Budget Analytics</div>
            <div style={{ marginTop: 4, fontSize: 24, fontFamily: "var(--font-display)" }}>Since {start_date}</div>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--muted2)", fontSize: 11, marginTop: 6 }}>Created {created_at?.slice(0, 10)} · {transaction_count} transactions</div>
          </div>
          <button onClick={onClearBudget} style={{
            background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 2,
            padding: "10px 18px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em"
          }}>
            View overall dashboard
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <StatCard label="Total Balance" value={`$${totalBalance.toFixed(2)}`} sub="Current balance" accent delay={0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <StatCard label="Total In" value={`$${all.total_in.toFixed(2)}`} sub="Since budget start" delay={0} />
        <StatCard label="Total Out" value={`$${all.total_out.toFixed(2)}`} sub="Since budget start" delay={80} />
        <StatCard label="Net" value={`${all.net >= 0 ? "+" : ""}$${all.net.toFixed(2)}`} sub="Since budget start" accent={all.net >= 0} delay={160} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <PieChartWrapper data={allCatsIncome} title="Income by Category" />
        <PieChartWrapper data={allCatsExpense} title="Expenses by Category" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <StatCard label="Last 7d In" value={`$${lastWeek.total_in.toFixed(2)}`} sub="Last week" delay={0} />
        <StatCard label="Last 7d Out" value={`$${lastWeek.total_out.toFixed(2)}`} sub="Last week" delay={80} />
        <StatCard label="Last 7d Net" value={`${lastWeek.net >= 0 ? "+" : ""}$${lastWeek.net.toFixed(2)}`} sub="Last week" accent={lastWeek.net >= 0} delay={160} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <PieChartWrapper data={weekCatsIncome} title="Last 7d Income by Category" />
        <PieChartWrapper data={weekCatsExpense} title="Last 7d Expenses by Category" />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2, minmax(0, 1fr))",
          gap: 16,
        }}
      >
        <SpendingTargetsSection
          budgetId={budgetId}
        />

        <SavingGoalsSection
          budgetId={budgetId}
        />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)", marginBottom: 20 }}>Budget Transactions</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..."
            style={{ flex: 1, minWidth: 220, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 2, padding: "7px 12px", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12, transition: "border-color 0.15s" }} />
          <FilterDropdown filters={filters} onChange={setFilters} />
          <SortDropdown value={sort} onChange={setSort} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr", gap: 12, padding: "14px 16px 8px", borderBottom: "1px solid var(--border2)", marginTop: 14 }}>
          {["Date","Amount","Category","Description","Statement"].map(h => (
            <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</span>
          ))}
        </div>

        {txLoading
          ? Array.from({length:10}).map((_,i) => <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}><Skel w={`${50+Math.random()*40}%`} /></div>)
          : filteredTransactions.length === 0
            ? <p style={{ color: "var(--muted2)", padding: "24px 16px", fontFamily: "var(--font-mono)", fontSize: 12 }}>No transactions found</p>
            : filteredTransactions.map((txn, i) => <TxRow key={txn.id} txn={txn} i={i} onEdit={editTransaction} />)
        }
      </div>
    </div>
  );
}