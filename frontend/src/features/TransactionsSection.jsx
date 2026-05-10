import { useState } from "react";

import CategoriesTab from "@/features/CategoriesTab";
import TransactionsTab from "@/features/TransactionsTab";

const SUBTABS = [
  { value: "transactions", label: "Transactions" },
  { value: "categories", label: "Categories" },
];

export default function TransactionsSection() {
  const [subtab, setSubtab] = useState("transactions");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {SUBTABS.map((tab) => {
          const active = subtab === tab.value;

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSubtab(tab.value)}
              style={{
                border: active ? "1px solid var(--accent)" : "1px solid var(--border2)",
                background: active ? "var(--accent)" : "var(--surface)",
                color: active ? "var(--bg)" : "var(--text)",
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                padding: "9px 12px",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {subtab === "transactions" && <TransactionsTab />}
      {subtab === "categories" && <CategoriesTab />}
    </div>
  );
}
