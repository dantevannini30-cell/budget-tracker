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

import {
  DEFAULT_FILTERS,
  applyFilters,
  applySort,
  SORT_OPTIONS,
} from "./TransactionsTab";

export default function BudgetDashboard({
  budgetId,
  onClearBudget,
}) {
  const [summary, setSummary] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] = useState("");

  const [transactions, setTransactions] =
    useState([]);

  const [txLoading, setTxLoading] =
    useState(true);

  const [search, setSearch] = useState("");

  const [filters, setFilters] =
    useState(DEFAULT_FILTERS);

  const [sort, setSort] =
    useState("date_desc");

  const [editingTxn, setEditingTxn] =
    useState(null);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
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
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--muted2)", fontSize: 11, marginTop: 6 }}>Created {created_at.slice(0, 10)} · {transaction_count} transactions</div>
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

        {!txLoading && filteredTransactions.length > 0 && (
          <div style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)", borderTop: "1px solid var(--border)" }}>
            {filteredTransactions.length} transactions
          </div>
        )}
      </div>
    </div>
  );
}