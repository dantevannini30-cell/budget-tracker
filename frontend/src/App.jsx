import { useState } from "react";

import Dashboard from "@/features/Dashboard";
import TransactionsTab from "@/features/TransactionsTab";

/*
KEEP TEMPORARILY:

- font link injection
- globalStyle injection
- :root variables
- @keyframes
*/
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


export default function App() {
  const [tab, setTab] = useState("dashboard");

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "0 32px", display: "flex", alignItems: "center", gap: 36, height: 52, background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.1em", color: "var(--accent)" }}>BUDGET</div>
        <nav style={{ display: "flex" }}>
          {["dashboard", "transactions"].map(t => (
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

      <main
        style={{
          padding: "28px 32px",
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {tab === "dashboard" && <Dashboard />}
        {tab === "transactions" && <TransactionsTab />}
      </main>
    </div>
  );
}