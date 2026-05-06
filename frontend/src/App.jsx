import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts";

const API = "http://localhost:8000";

// ─── Google Fonts ─────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap";
document.head.appendChild(fontLink);

// ─── Global styles ────────────────────────────────────────────────────────────
const globalStyle = document.createElement("style");
globalStyle.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #080a0e;
    --surface: #0e1117;
    --surface2: #151922;
    --border: #1e2530;
    --border2: #2a3345;
    --text: #e8edf5;
    --muted: #4a5568;
    --muted2: #6b7a96;
    --accent: #00d4aa;
    --red: #ff4d6d;
    --green: #00d4aa;
    --font-display: 'Bebas Neue', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --font-mono: 'DM Mono', monospace;
  }
  html, body, #root { height: 100%; }
  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-body);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 2px; }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  @keyframes barGrow { from { width: 0; } }
  .fade-up { opacity: 0; animation: fadeUp 0.45s ease forwards; }
  .skeleton {
    background: linear-gradient(90deg, var(--surface) 25%, var(--surface2) 50%, var(--surface) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 3px;
  }
  input:focus { outline: none; border-color: var(--accent) !important; }
`;
document.head.appendChild(globalStyle);

// ─── Hooks ────────────────────────────────────────────────────────────────────
function useApi(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}${endpoint}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [endpoint]);
  return { data, setData, loading };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skel({ w = "100%", h = 14 }) {
  return <div className="skeleton" style={{ width: w, height: h }} />;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, delay = 0 }) {
  return (
    <div className="fade-up" style={{
      animationDelay: `${delay}ms`,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderTop: `2px solid ${accent ? "var(--accent)" : "var(--border)"}`,
      padding: "20px 24px",
      borderRadius: 2,
      flex: 1,
      minWidth: 150,
    }}>
      <div style={{ color: "var(--muted2)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 38, letterSpacing: "0.02em", color: accent ? "var(--accent)" : "var(--text)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ color: "var(--muted2)", fontSize: 11, marginTop: 6, fontFamily: "var(--font-mono)" }}>{sub}</div>}
    </div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────
function SummaryStats() {
  const { data, loading } = useApi("/api/transactions");
  if (loading) return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, minWidth: 150, height: 100 }}><Skel h={100} /></div>)}
    </div>
  );
  if (!data?.length) return null;
  const expenses = data.filter(t => t.amount < 0);
  const income = data.filter(t => t.amount > 0);
  const totalSpent = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalIn = income.reduce((s, t) => s + t.amount, 0);
  const net = totalIn - totalSpent;
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <StatCard label="Total Spent" value={`$${totalSpent.toFixed(0)}`} sub={`${expenses.length} transactions`} delay={0} />
      <StatCard label="Total In" value={`$${totalIn.toFixed(0)}`} sub={`${income.length} transactions`} delay={80} />
      <StatCard label="Net" value={`${net >= 0 ? "+" : ""}$${Math.abs(net).toFixed(0)}`} sub={net >= 0 ? "surplus" : "deficit"} accent={net >= 0} delay={160} />
      <StatCard label="Loaded" value={data.length} sub="recent transactions" delay={240} />
    </div>
  );
}

// ─── Category Bars ────────────────────────────────────────────────────────────
const COLORS = ["#00d4aa","#0099ff","#ffd166","#ff4d6d","#a78bfa","#fb923c","#34d399","#f472b6","#60a5fa","#facc15"];

function CategoryBars() {
  const { data, loading } = useApi("/api/summary/by-category");
  const [hovered, setHovered] = useState(null);
  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{[80,60,45,35,25].map((w,i) => <Skel key={i} w={`${w}%`} h={28} />)}</div>;
  if (!data?.length) return <p style={{ color: "var(--muted2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>No data yet</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((row, i) => (
        <div key={row.category} className="fade-up" style={{ animationDelay: `${i * 55}ms` }}
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: hovered === i ? "var(--text)" : "var(--muted2)", transition: "color 0.15s" }}>
              {row.category}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: COLORS[i % COLORS.length] }}>
              ${row.total} <span style={{ color: "var(--muted)", fontSize: 10 }}>({row.pct}%)</span>
            </span>
          </div>
          <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${row.pct}%`,
              background: COLORS[i % COLORS.length], borderRadius: 2,
              animation: `barGrow 0.8s cubic-bezier(0.16,1,0.3,1) forwards`,
              animationDelay: `${i * 55 + 200}ms`,
              opacity: hovered === i ? 1 : 0.65, transition: "opacity 0.15s",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Recent Activity ──────────────────────────────────────────────────────────
function RecentActivity() {
  const { data, loading } = useApi("/api/transactions");
  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{Array.from({length:6}).map((_,i) => <Skel key={i} w={`${55+Math.random()*35}%`} />)}</div>;
  return (
    <div>
      {(data || []).slice(0, 9).map((txn, i) => (
        <div key={txn.id} className="fade-up" style={{
          animationDelay: `${i * 35}ms`,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "9px 0", borderBottom: "1px solid var(--border)",
        }}>
          <div style={{ overflow: "hidden", paddingRight: 12 }}>
            <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
              {txn.description}
            </div>
            <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
              {txn.date?.slice(0, 10)}
            </div>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, flexShrink: 0, color: txn.amount < 0 ? "var(--red)" : "var(--green)" }}>
            {txn.amount < 0 ? "−" : "+"}${Math.abs(txn.amount).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab() {
  const { data, setData, loading } = useApi("/api/transactions");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = (data || []).filter(t => {
    const normalized = search.trim().toLowerCase();
    const matchSearch = !normalized || [t.description, t.statement].some(value => value?.toLowerCase().includes(normalized));
    const matchFilter = filter === "all" || (filter === "in" && t.amount > 0) || (filter === "out" && t.amount < 0);
    return matchSearch && matchFilter;
  });

  const editTransaction = async (txn, field) => {
    const current = field === "description" ? txn.description || "" : txn.category || "";
    const promptText = field === "description" ? "Edit description:" : "Edit category:";
    const value = prompt(promptText, current);
    if (value === null) return;

    const payload = {};
    if (field === "description") payload.description = value;
    if (field === "category") payload.category = value;

    try {
      const res = await fetch(`${API}/api/transactions/${txn.id}/category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update transaction");

      setData(prev => prev.map(item => item.id === txn.id ? { ...item, ...payload } : item));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2 }}>
      {/* Controls */}
      <div style={{ display: "flex", gap: 10, padding: "16px 16px 0", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 2, padding: "7px 12px", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12, transition: "border-color 0.15s" }} />
        {["all","in","out"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter === f ? "var(--accent)" : "var(--surface2)",
            color: filter === f ? "var(--bg)" : "var(--muted2)",
            border: "1px solid var(--border2)", borderRadius: 2,
            padding: "7px 14px", fontFamily: "var(--font-mono)", fontSize: 10,
            cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em", transition: "all 0.15s",
          }}>{f}</button>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 120px 100px 1.4fr", gap: 12, padding: "14px 16px 8px", borderBottom: "1px solid var(--border2)", marginTop: 14 }}>
        {["Description","Category","Amount","Statement"].map(h => (
          <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: h === "Amount" ? "right" : "left" }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      {loading
        ? Array.from({length:10}).map((_,i) => <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}><Skel w={`${50+Math.random()*40}%`} /></div>)
        : filtered.length === 0
          ? <p style={{ color: "var(--muted2)", padding: "24px 16px", fontFamily: "var(--font-mono)", fontSize: 12 }}>No transactions found</p>
          : filtered.map((txn, i) => <TxRow key={txn.id} txn={txn} i={i} onEdit={editTransaction} />)
      }
      {!loading && filtered.length > 0 && (
        <div style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)", borderTop: "1px solid var(--border)" }}>
          {filtered.length} transactions
        </div>
      )}
    </div>
  );
}

function BudgetsTab({ onSelectBudget }) {
  const [budgets, setBudgets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`${API}/api/budgets`)
      .then(r => r.json())
      .then(data => { if (!active) return; setBudgets(data); setLoading(false); })
      .catch(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, []);

  const createBudget = async () => {
    const date = prompt("Enter budget start date (YYYY-MM-DD):");
    if (!date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      alert("Please use YYYY-MM-DD format");
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/api/budgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: date }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create budget");
      }
      const budget = await res.json();
      setBudgets(prev => prev ? [budget, ...prev] : [budget]);
      setMessage(`Created budget ${budget.id.slice(0, 8)} with ${budget.transaction_count} transactions.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)" }}>Budgets</div>
          <div style={{ marginTop: 4, fontSize: 24, fontFamily: "var(--font-display)" }}>Saved budget periods</div>
        </div>
        <button onClick={createBudget} disabled={saving} style={{
          background: "var(--accent)", color: "var(--bg)", border: "none",
          borderRadius: 2, padding: "10px 18px", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em"
        }}>
          {saving ? "Saving..." : "New budget"}
        </button>
      </div>

      {message && <div style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{message}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3].map(i => <Skel key={i} h={18} />)}
        </div>
      ) : !budgets?.length ? (
        <p style={{ color: "var(--muted2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>No budgets yet. Create one to store transactions from a start date.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 120px", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>
            <span>Budget ID</span>
            <span>Start date</span>
            <span>Created</span>
            <span style={{ textAlign: "right" }}>Transactions</span>
          </div>
          {budgets.map((budget, index) => (
            <div key={budget.id} onClick={() => onSelectBudget(budget.id)} style={{ cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 120px 140px 120px", gap: 12, padding: "12px 0", borderBottom: index + 1 === budgets.length ? "none" : "1px solid var(--border)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{budget.id}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{budget.start_date}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{budget.created_at.slice(0, 10)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right" }}>{budget.transaction_count}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function BudgetDashboard({ budgetId, onClearBudget }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!budgetId) return;
    setLoading(true);
    setError("");

    fetch(`${API}/api/budgets/${budgetId}/summary`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load budget summary");
        }
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
    const current = field === "description" ? txn.description || "" : txn.category || "";
    const promptText = field === "description" ? "Edit description:" : "Edit category:";
    const value = prompt(promptText, current);
    if (value === null) return;

    const payload = {};
    if (field === "description") payload.description = value;
    if (field === "category") payload.category = value;

    try {
      const res = await fetch(`${API}/api/transactions/${txn.id}/category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update transaction");

      setTransactions(prev => prev.map(item => item.id === txn.id ? { ...item, ...payload } : item));
      setSummary(prev => prev);
    } catch (err) {
      alert(err.message);
    }
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

  const COLORS = ["#00d4aa", "#ff4d6d", "#ffa502", "#6366f1", "#8b5cf6", "#d946ef", "#0891b2", "#06b6d4"];

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Skel h={20} /><Skel h={20} /><Skel h={20} /></div>;
  if (error) return <p style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{error}</p>;
  if (!summary) return null;

  const { start_date, created_at, transaction_count, summary: stats } = summary;
  const all = stats.all;
  const lastWeek = stats.last_week;
  const totalBalance = all.total_balance;

  const allCatsIncome = calculateCategoryTotals(transactions, true);
  const allCatsExpense = calculateCategoryTotals(transactions, false);
  const weekTxns = getLastWeekTransactions();
  const weekCatsIncome = calculateCategoryTotals(weekTxns, true);
  const weekCatsExpense = calculateCategoryTotals(weekTxns, false);

  const normalized = search.trim().toLowerCase();
  const filteredTransactions = transactions.filter(t => {
    const matchSearch = !normalized || [t.description, t.statement].some(value => value?.toLowerCase().includes(normalized));
    const matchFilter = filter === "all" || (filter === "in" && t.amount > 0) || (filter === "out" && t.amount < 0);
    return matchSearch && matchFilter;
  });

  const PieChartWrapper = ({ data, title }) => (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 16, flex: 1, minWidth: 280 }}>
      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted2)", marginBottom: 12 }}>{title}</div>
      {data.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--muted2)", padding: "40px 20px", fontSize: 12 }}>No transactions</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
              {data.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 2, color: "var(--text)" }} />
          </PieChart>
        </ResponsiveContainer>
      )}
      <div style={{ marginTop: 12, fontSize: 10 }}>
        {data.map((item, i) => (
          <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "var(--muted2)" }}>
            <span style={{ color: COLORS[i % COLORS.length] }}>● {item.name}</span>
            <span>${item.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
          { ["all","in","out"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "var(--accent)" : "var(--surface2)",
              color: filter === f ? "var(--bg)" : "var(--muted2)",
              border: "1px solid var(--border2)", borderRadius: 2,
              padding: "7px 14px", fontFamily: "var(--font-mono)", fontSize: 10,
              cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em", transition: "all 0.15s",
            }}>{f}</button>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 120px 100px 1.4fr", gap: 12, padding: "14px 16px 8px", borderBottom: "1px solid var(--border2)", marginTop: 14 }}>
          {["Description","Category","Amount","Statement"].map(h => (
            <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: h === "Amount" ? "right" : "left" }}>{h}</span>
          ))}
        </div>

        {txLoading ? (
          Array.from({length:10}).map((_,i) => <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}><Skel w={`${50+Math.random()*40}%`} /></div>)
        ) : filteredTransactions.length === 0 ? (
          <p style={{ color: "var(--muted2)", padding: "24px 16px", fontFamily: "var(--font-mono)", fontSize: 12 }}>No transactions found</p>
        ) : filteredTransactions.map((txn, i) => <TxRow key={txn.id} txn={txn} i={i} onEdit={editTransaction} />)}

        {!txLoading && filteredTransactions.length > 0 && (
          <div style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)", borderTop: "1px solid var(--border)" }}>
            {filteredTransactions.length} transactions
          </div>
        )}
      </div>
    </div>
  );
}

function TxRow({ txn, i, onEdit }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="fade-up" style={{
      animationDelay: `${i * 25}ms`,
      display: "grid", gridTemplateColumns: "1.6fr 120px 100px 1.4fr", gap: 12,
      padding: "10px 16px", borderBottom: "1px solid var(--border)",
      background: hov ? "var(--surface2)" : "transparent", transition: "background 0.12s", cursor: "default",
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <span onClick={() => onEdit(txn, "description")} title="Click to edit description" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", padding: "4px 6px", borderRadius: 3, background: "var(--surface)", border: "1px solid var(--border2)" }}>
        {txn.description ? txn.description : <span style={{ color: "var(--muted2)" }}>Add description</span>}
      </span>
      <span onClick={() => onEdit(txn, "category")} title="Click to edit category" style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: txn.category ? "var(--text)" : "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", padding: "4px 6px", borderRadius: 3, background: "var(--surface)", border: "1px solid var(--border2)" }}>
        {txn.category || "Add category"}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: txn.amount < 0 ? "var(--red)" : "var(--green)", textAlign: "right", alignSelf: "center" }}>
        {txn.amount < 0 ? "−" : "+"}${Math.abs(txn.amount).toFixed(2)}
      </span>
      <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)", alignSelf: "center" }}>
        {txn.statement || "—"}
      </span>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [selectedBudgetId, setSelectedBudgetId] = useState(null);

  const handleSelectBudget = (id) => {
    setSelectedBudgetId(id);
    setTab("dashboard");
  };

  const clearSelectedBudget = () => setSelectedBudgetId(null);
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "0 32px", display: "flex", alignItems: "center", gap: 36, height: 52, background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.1em", color: "var(--accent)" }}>BUDGET</div>
        <nav style={{ display: "flex" }}>
          {["dashboard","budgets"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "0 16px", height: 52,
              fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em",
              color: tab === t ? "var(--text)" : "var(--muted)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "color 0.15s",
            }}>{t}</button>
          ))}
        </nav>
        <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
          {new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {selectedBudgetId ? (
              <BudgetDashboard budgetId={selectedBudgetId} onClearBudget={clearSelectedBudget} />
            ) : (
              <>
                <SummaryStats />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 24 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)", marginBottom: 20 }}>Spending by Category</div>
                    <CategoryBars />
                  </div>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 24 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)", marginBottom: 20 }}>Recent Activity</div>
                    <RecentActivity />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {tab === "budgets" && <BudgetsTab onSelectBudget={handleSelectBudget} />}
      </main>
    </div>
  );
}