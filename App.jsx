import { useState, useEffect } from "react";

const API = "http://localhost:8000"; // FastAPI runs here

// ---------------------------
// Reusable fetch hook
// ---------------------------
function useApi(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API}${endpoint}`)
      .then((res) => res.json())
      .then((data) => { setData(data); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [endpoint]);

  return { data, loading, error };
}

// ---------------------------
// Component 1 — Hello test
// Calls /api/hello, shows the response
// ---------------------------
function HelloTest() {
  const { data, loading } = useApi("/api/hello");

  return (
    <div style={styles.card}>
      <h2>Test 1 — /api/hello</h2>
      <p style={styles.muted}>Just proves FastAPI is reachable from React</p>
      {loading ? <p>Loading...</p> : (
        <pre style={styles.pre}>{JSON.stringify(data, null, 2)}</pre>
      )}
    </div>
  );
}

// ---------------------------
// Component 2 — Transactions table
// Calls /api/transactions, renders a table
// ---------------------------
function TransactionsTable() {
  const { data, loading } = useApi("/api/transactions");

  return (
    <div style={styles.card}>
      <h2>Test 2 — /api/transactions</h2>
      <p style={styles.muted}>Real data from your SQLite database</p>
      {loading ? <p>Loading...</p> : (
        <table style={styles.table}>
          <thead>
            <tr>
              {["Date", "Description", "Amount", "Category"].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((txn) => (
              <tr key={txn.id}>
                <td style={styles.td}>{txn.date?.slice(0, 10)}</td>
                <td style={styles.td}>{txn.description}</td>
                <td style={{ ...styles.td, color: txn.amount < 0 ? "#e74c3c" : "#2ecc71" }}>
                  ${Math.abs(txn.amount).toFixed(2)}
                </td>
                <td style={styles.td}>{txn.category || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------
// Component 3 — Category summary
// Calls /api/summary/by-category, renders a simple bar chart
// ---------------------------
function CategorySummary() {
  const { data, loading } = useApi("/api/summary/by-category");

  return (
    <div style={styles.card}>
      <h2>Test 3 — /api/summary/by-category</h2>
      <p style={styles.muted}>Python calculated the percentages, React just draws bars</p>
      {loading ? <p>Loading...</p> : (
        <div>
          {data.map((row) => (
            <div key={row.category} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>{row.category}</span>
                <span style={styles.muted}>${row.total} ({row.pct}%)</span>
              </div>
              <div style={styles.barBg}>
                <div style={{ ...styles.bar, width: `${row.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------
// Main App
// ---------------------------
export default function App() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Budget App — API Test</h1>
      <p style={styles.muted}>Three components, each calling a different FastAPI endpoint</p>
      <HelloTest />
      <TransactionsTable />
      <CategorySummary />
    </div>
  );
}

// ---------------------------
// Styles
// ---------------------------
const styles = {
  page: { maxWidth: 900, margin: "0 auto", padding: "40px 20px", fontFamily: "monospace", background: "#0f0f0f", minHeight: "100vh", color: "#f0f0f0" },
  title: { fontSize: 28, marginBottom: 4 },
  muted: { color: "#888", fontSize: 13, marginBottom: 16 },
  card: { background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: 24, marginBottom: 24 },
  pre: { background: "#0f0f0f", padding: 12, borderRadius: 4, fontSize: 13, color: "#2ecc71" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #333", color: "#888" },
  td: { padding: "8px 12px", borderBottom: "1px solid #1f1f1f" },
  barBg: { height: 8, background: "#333", borderRadius: 4, overflow: "hidden" },
  bar: { height: "100%", background: "#3b82f6", borderRadius: 4, transition: "width 0.6s ease" },
};
