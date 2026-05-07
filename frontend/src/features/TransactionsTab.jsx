import { useState } from "react";

import { API } from "@/api/constants";
import useApi from "@/hooks/useApi";

import Skel from "@/components/Skel";
import CategoryModal from "@/components/CategoryModal";
import FilterDropdown from "@/components/FilterDropdown";
import SortDropdown from "@/components/SortDropdown";

export const DEFAULT_FILTERS = {
  showIn: true,
  showOut: true,
  showCategorised: true,
  showUncategorised: true,
};

export const SORT_OPTIONS = [
  {
    key: "date_desc",
    label: "Date (newest first)",
  },
  {
    key: "date_asc",
    label: "Date (oldest first)",
  },
  {
    key: "amount_desc",
    label: "Amount (highest first)",
  },
  {
    key: "amount_asc",
    label: "Amount (lowest first)",
  },
];

function TxRow({ txn, i, onEdit }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="fade-up" style={{
      animationDelay: `${i * 25}ms`,
      display: "grid", gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr", gap: 12,
      padding: "10px 16px", borderBottom: "1px solid var(--border)",
      background: hov ? "var(--surface2)" : "transparent", transition: "background 0.12s", cursor: "default",
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted2)", alignSelf: "center" }}>
        {txn.date?.slice(0, 10) || "—"}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: txn.amount < 0 ? "var(--red)" : "var(--green)", alignSelf: "center" }}>
        {txn.amount < 0 ? "−" : "+"}${Math.abs(txn.amount).toFixed(2)}
      </span>
      <span onClick={() => onEdit(txn, "category")} title="Click to edit category" style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: txn.category ? "var(--text)" : "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", padding: "4px 6px", borderRadius: 3, background: "var(--surface)", border: "1px solid var(--border2)" }}>
        {txn.category || "Add category"}
      </span>
      <span onClick={() => onEdit(txn, "description")} title="Click to edit description" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", padding: "4px 6px", borderRadius: 3, background: "var(--surface)", border: "1px solid var(--border2)" }}>
        {txn.description ? txn.description : <span style={{ color: "var(--muted2)" }}>Add description</span>}
      </span>
      <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)", alignSelf: "center" }}>
        {txn.statement || "—"}
      </span>
    </div>
  );
}

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
      setData(prev => prev.map(item => item.id === txn.id ? { ...item, description: value } : item));
    } catch (err) {
      alert(err.message);
    }
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
    setData(prev => prev.map(item => item.id === editingTxn.id ? { ...item, category: newCategory } : item));
    setEditingTxn(null);
  } catch (err) {
    alert(err.message);
  }
};
  
export function applyFilters(
  transactions,
  search,
  filters
) {
  const normalized = search.trim().toLowerCase();

  return transactions.filter((t) => {
    if (
      normalized &&
      ![t.description, t.statement].some((v) =>
        v?.toLowerCase().includes(normalized)
      )
    ) {
      return false;
    }

    if (t.amount > 0 && !filters.showIn) return false;
    if (t.amount < 0 && !filters.showOut)
      return false;

    if (
      t.category &&
      !filters.showCategorised
    )
      return false;

    if (
      !t.category &&
      !filters.showUncategorised
    )
      return false;

    return true;
  });
}

export function applySort(
  transactions,
  sortKey
) {
  const arr = [...transactions];

  if (sortKey === "date_desc") {
    return arr.sort(
      (a, b) =>
        new Date(b.date) - new Date(a.date)
    );
  }

  if (sortKey === "date_asc") {
    return arr.sort(
      (a, b) =>
        new Date(a.date) - new Date(b.date)
    );
  }

  if (sortKey === "amount_desc") {
    return arr.sort(
      (a, b) =>
        Math.abs(b.amount) -
        Math.abs(a.amount)
    );
  }

  if (sortKey === "amount_asc") {
    return arr.sort(
      (a, b) =>
        Math.abs(a.amount) -
        Math.abs(b.amount)
    );
  }

  return arr;
}

export default function TransactionsTab() {
  const { data, setData, loading } =
    useApi("/api/transactions");

  const [search, setSearch] = useState("");
  const [filters, setFilters] =
    useState(DEFAULT_FILTERS);

  const [sort, setSort] =
    useState("date_desc");

  const [editingTxn, setEditingTxn] =
    useState(null);

  const filtered = applySort(
    applyFilters(
      data || [],
      search,
      filters
    ),
    sort
  );

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 2,
      }}
    >
      {editingTxn && (
        <CategoryModal
          transactions={data || []}
          onSubmit={submitCategoryEdit}
          onClose={() => setEditingTxn(null)}
        />
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, padding: "16px 16px 0", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
          style={{ flex: 1, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 2, padding: "7px 12px", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12, transition: "border-color 0.15s" }} />
        <FilterDropdown filters={filters} onChange={setFilters} />
        <SortDropdown value={sort} onChange={setSort} />
      </div>

      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr", gap: 12, padding: "14px 16px 8px", borderBottom: "1px solid var(--border2)", marginTop: 14 }}>
        {["Date","Amount","Category","Description","Statement"].map(h => (
          <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</span>
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