import { useState, useEffect } from "react";

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
  return { data, loading };
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
  const { data, loading } = useApi("/api/transactions");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const filtered = (data || []).filter(t => {
    const matchSearch = t.description?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "in" && t.amount > 0) || (filter === "out" && t.amount < 0);
    return matchSearch && matchFilter;
  });

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
      <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 100px 90px", gap: 12, padding: "14px 16px 8px", borderBottom: "1px solid var(--border2)", marginTop: 14 }}>
        {["Date","Description","Amount","Category"].map(h => (
          <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em", textAlign: h === "Amount" ? "right" : "left" }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      {loading
        ? Array.from({length:10}).map((_,i) => <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}><Skel w={`${50+Math.random()*40}%`} /></div>)
        : filtered.length === 0
          ? <p style={{ color: "var(--muted2)", padding: "24px 16px", fontFamily: "var(--font-mono)", fontSize: 12 }}>No transactions found</p>
          : filtered.map((txn, i) => <TxRow key={txn.id} txn={txn} i={i} />)
      }
      {!loading && filtered.length > 0 && (
        <div style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)", borderTop: "1px solid var(--border)" }}>
          {filtered.length} transactions
        </div>
      )}
    </div>
  );
}

function TxRow({ txn, i }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="fade-up" style={{
      animationDelay: `${i * 25}ms`,
      display: "grid", gridTemplateColumns: "90px 1fr 100px 90px", gap: 12,
      padding: "10px 16px", borderBottom: "1px solid var(--border)",
      background: hov ? "var(--surface2)" : "transparent", transition: "background 0.12s", cursor: "default",
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)", paddingTop: 1 }}>{txn.date?.slice(0,10)}</span>
      <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{txn.description}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: txn.amount < 0 ? "var(--red)" : "var(--green)", textAlign: "right" }}>
        {txn.amount < 0 ? "−" : "+"}${Math.abs(txn.amount).toFixed(2)}
      </span>
      <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", textAlign: "right", background: "var(--border)", borderRadius: 2, padding: "2px 6px", alignSelf: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {txn.category || "—"}
      </span>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "0 32px", display: "flex", alignItems: "center", gap: 36, height: 52, background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.1em", color: "var(--accent)" }}>BUDGET</div>
        <nav style={{ display: "flex" }}>
          {["dashboard","transactions"].map(t => (
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
          </div>
        )}
        {tab === "transactions" && <TransactionsTab />}
      </main>
    </div>
  );
}