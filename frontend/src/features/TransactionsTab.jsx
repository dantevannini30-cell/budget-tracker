
import { useState } from "react";

import { API } from "@/api/constants";
import useApi from "@/hooks/useApi";

import Skel from "@/components/Skel";
import CategoryModal from "@/components/CategoryModal";
import FilterDropdown from "@/components/FilterDropdown";
import SortDropdown from "@/components/SortDropdown";

const DEFAULT_FILTERS = {
  showIn: true,
  showOut: true,
  showCategorised: true,
  showUncategorised: true,
  showHumanClassified: true,
  showBotClassified: true,
  showUnclassified: true,
};

function TxRow({ txn, i, onEditCategory, onUpdateDescription, onAcceptCategory }) {
  const [hov, setHov] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(txn.description || "");
  const [savingDescription, setSavingDescription] = useState(false);

  const startDescriptionEdit = () => {
    setDescriptionDraft(txn.description || "");
    setEditingDescription(true);
  };

  const cancelDescriptionEdit = () => {
    setDescriptionDraft(txn.description || "");
    setEditingDescription(false);
  };

  const saveDescription = async () => {
    const nextDescription = descriptionDraft.trim();
    const currentDescription = txn.description || "";

    if (nextDescription === currentDescription) {
      setEditingDescription(false);
      return;
    }

    try {
      setSavingDescription(true);
      await onUpdateDescription(txn, nextDescription);
      setEditingDescription(false);
    } finally {
      setSavingDescription(false);
    }
  };

  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${i * 25}ms`,
        display: "grid",
        gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr",
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        background: hov ? "var(--surface2)" : "transparent",
        transition: "background 0.12s",
        cursor: "default",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted2)" }}>
        {txn.date?.slice(0, 10) || "—"}
      </span>

      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: txn.amount < 0 ? "var(--red)" : "var(--green)",
      }}>
        {txn.amount < 0 ? "−" : "+"}${Math.abs(txn.amount).toFixed(2)}
      </span>

      <span
        onClick={() => onEditCategory(txn)}
        style={{
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          color: txn.category ? "var(--text)" : "var(--muted2)",
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: 3,
          background: "var(--surface)",
          border: "1px solid var(--border2)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span>{txn.category || "Add category"}</span>
        {txn.category_status === "suggested" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAcceptCategory(txn);
            }}
            title="Accept suggested category"
            style={{
              marginLeft: 6,
              border: "none",
              background: "var(--accent)",
              color: "var(--bg)",
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 10,
              padding: "1px 4px",
            }}
          >
            ✓
          </button>
        )}
      </span>

      {editingDescription ? (
        <input
          autoFocus
          value={descriptionDraft}
          disabled={savingDescription}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={saveDescription}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              cancelDescriptionEdit();
            }
          }}
          style={{
            minWidth: 0,
            width: "100%",
            fontSize: 12,
            color: "var(--text)",
            padding: "4px 6px",
            borderRadius: 3,
            background: "var(--surface2)",
            border: "1px solid var(--accent)",
          }}
        />
      ) : (
        <button
          type="button"
          onClick={startDescriptionEdit}
          style={{
            minWidth: 0,
            fontSize: 12,
            color: txn.description ? "var(--text)" : "var(--muted2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            cursor: "text",
            padding: "4px 6px",
            borderRadius: 3,
            background: "var(--surface)",
            border: "1px solid var(--border2)",
            textAlign: "left",
          }}
        >
          {savingDescription ? "Saving..." : txn.description || "Add description"}
        </button>
      )}

      <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
        {txn.statement || "—"}
      </span>
    </div>
  );
}

function applyFilters(transactions, search, filters) {
  const q = search.trim().toLowerCase();

  return (transactions || []).filter((t) => {
    if (
      q &&
      ![t.description, t.statement].some((v) =>
        v?.toLowerCase().includes(q)
      )
    ) return false;

    if (t.amount > 0 && !filters.showIn) return false;
    if (t.amount < 0 && !filters.showOut) return false;

    if (t.category && !filters.showCategorised) return false;
    if (!t.category && !filters.showUncategorised) return false;

    const source = t.category_source || "unset";
    const isHumanClassified = source === "human" || source === "legacy";
    const isBotClassified = source === "classifier";
    const isUnclassified = source === "unset" || !t.category;

    if (isHumanClassified && !filters.showHumanClassified) return false;
    if (isBotClassified && !filters.showBotClassified) return false;
    if (isUnclassified && !filters.showUnclassified) return false;

    return true;
  });
}

function applySort(transactions, sortKey) {
  const arr = [...(transactions || [])];

  switch (sortKey) {
    case "date_desc":
      return arr.sort((a, b) => new Date(b.date) - new Date(a.date));
    case "date_asc":
      return arr.sort((a, b) => new Date(a.date) - new Date(b.date));
    case "amount_desc":
      return arr.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
    case "amount_asc":
      return arr.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
    default:
      return arr;
  }
}

export default function TransactionsTab() {
  const { data, setData, loading } = useApi("/api/transactions");

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("date_desc");
  const [editingTxn, setEditingTxn] = useState(null);
  const [loadStartDate, setLoadStartDate] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [acceptingAll, setAcceptingAll] = useState(false);

  const reloadTransactions = async () => {
    const res = await fetch(`${API}/api/transactions`);
    if (!res.ok) throw new Error("Failed to reload transactions");
    const json = await res.json();
    console.log("sample", json.slice(0, 5).map(t => ({ id: t.id, category: t.category, status: t.category_status })));
    setData(json);
  };

  const editCategory = (txn) => {
    const id = txn?.id;

    if (!id) {
      console.warn("Skipping transaction with missing id:", txn);
      return;
    }

    setEditingTxn(txn);
  };

  const updateDescription = async (txn, description) => {
    const id = txn?.id;

    if (!id) {
      console.warn("Skipping transaction with missing id:", txn);
      return;
    }

    try {
      const res = await fetch(`${API}/api/transactions/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (!res.ok) throw new Error("Failed to update transaction");

      setData((prev) =>
        (prev || []).map((t) =>
          t.id === id ? { ...t, description } : t
        )
      );
    } catch (err) {
      alert(err.message);
      throw err;
    }
  };

  const submitCategoryEdit = async (newCategory) => {
    if (!editingTxn) return;

    try {
      const res = await fetch(`${API}/api/transactions/${editingTxn.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });

      if (!res.ok) throw new Error("Failed to update transaction");

      const currentStatus = editingTxn.category_status;
      const currentCategory = editingTxn.category || "";
      const nextStatus =
        currentStatus === "suggested"
          ? newCategory === currentCategory ? "accepted" : "rejected"
          : newCategory ? "accepted" : "unset";

      setData((prev) =>
        (prev || []).map((t) =>
          t.id === editingTxn.id
            ? {
                ...t,
                category: newCategory,
                category_source: "human",
                category_status: nextStatus,
              }
            : t
        )
      );

      setEditingTxn(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const acceptCategory = async (txn) => {
    try {
      const res = await fetch(`${API}/api/transactions/${txn.id}/category/accept`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to accept category");

      setData((prev) =>
        (prev || []).map((t) =>
          t.id === txn.id
            ? { ...t, category_source: "human", category_status: "accepted" }
            : t
        )
      );
    } catch (err) {
      alert(err.message);
    }
  };

  const acceptAllSuggestedCategories = async () => {
    try {
      setAcceptingAll(true);

      const res = await fetch(`${API}/api/transactions/category/accept-suggested`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to accept suggested categories");

      const json = await res.json();
      if (Array.isArray(json.transactions)) {
        setData(json.transactions);
      } else {
        await reloadTransactions();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setAcceptingAll(false);
    }
  };

  const handleLoadTransactions = async () => {
    if (!loadStartDate) {
      alert("Choose a start date first.");
      return;
    }

    try {
      setSyncing(true);

      const res = await fetch(`${API}/api/transactions/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: loadStartDate }),
      });

      if (!res.ok) throw new Error("Failed to load transactions");

      await reloadTransactions();
    } catch (err) {
      alert(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRefreshTransactions = async () => {
    try {
      setSyncing(true);

      const res = await fetch(`${API}/api/transactions/refresh`, {
        method: "POST",
      });

      if (!res.ok) throw new Error(await res.text() || "Failed to refresh transactions");

      await reloadTransactions();
    } catch (err) {
      alert(err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleClassifyTransactions = async () => {
    try {
      setClassifying(true);

      const res = await fetch(`${API}/api/transactions/classify`, {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to classify transactions");

      const json = await res.json();
      if (Array.isArray(json.transactions)) {
        setData(json.transactions);
      } else {
        await reloadTransactions();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setClassifying(false);
    }
  };

  const filtered = applySort(
    applyFilters(data, search, filters),
    sort
  );
  const suggestedCount = (data || []).filter(
    (txn) => txn.category_status === "suggested" && txn.category
  ).length;
  const busy = syncing || classifying || acceptingAll;

  return (
    <div style={{
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: 2,
    }}>
      {editingTxn && (
        <CategoryModal
          transactions={data || []}
          onSubmit={submitCategoryEdit}
          onClose={() => setEditingTxn(null)}
        />
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, padding: "16px 16px 0" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          style={{
            flex: 1,
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            borderRadius: 2,
            padding: "7px 12px",
          }}
        />

        <FilterDropdown filters={filters} onChange={setFilters} />
        <SortDropdown value={sort} onChange={setSort} />
        <input
          type="date"
          value={loadStartDate}
          onChange={(e) => setLoadStartDate(e.target.value)}
          style={{
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            borderRadius: 2,
            padding: "7px 12px",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        />
        <button
          onClick={handleLoadTransactions}
          disabled={busy}
          style={{
            padding: "7px 12px",
            border: "1px solid var(--border2)",
            background: "var(--surface2)",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            borderRadius: 2,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {syncing ? "Syncing..." : "+ Load"}
        </button>
        <button
          onClick={handleClassifyTransactions}
          disabled={busy}
          style={{
            padding: "7px 12px",
            border: "1px solid var(--border2)",
            background: "var(--surface2)",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            borderRadius: 2,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {classifying ? "Classifying..." : "Classify"}
        </button>
        <button
          onClick={acceptAllSuggestedCategories}
          disabled={busy || suggestedCount === 0}
          style={{
            padding: "7px 12px",
            border: "1px solid var(--border2)",
            background: "var(--surface2)",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            borderRadius: 2,
            cursor: busy || suggestedCount === 0 ? "not-allowed" : "pointer",
            opacity: busy || suggestedCount === 0 ? 0.7 : 1,
          }}
        >
          {acceptingAll ? "Accepting..." : `Accept all (${suggestedCount})`}
        </button>
        <button
          onClick={handleRefreshTransactions}
          disabled={busy}
          style={{
            padding: "7px 12px",
            border: "1px solid var(--accent)",
            background: "var(--accent)",
            color: "var(--bg)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            borderRadius: 2,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Header */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr",
        gap: 12,
        padding: "14px 16px 8px",
        borderBottom: "1px solid var(--border2)",
      }}>
        {["Date", "Amount", "Category", "Description", "Statement"].map((h) => (
          <span key={h} style={{
            fontSize: 10,
            fontFamily: "var(--font-mono)",
            color: "var(--muted)",
            textTransform: "uppercase",
          }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      {loading ? (
        Array.from({ length: 10 }).map((_, i) => (
          <div key={i} style={{ padding: 12 }}>
            <Skel w="60%" />
          </div>
        ))
      ) : filtered.length === 0 ? (
        <p style={{ padding: 16, color: "var(--muted2)" }}>
          No transactions found
        </p>
      ) : (
        filtered.map((txn, i) => (
          <TxRow
            key={txn.id}
            txn={txn}
            i={i}
            onEditCategory={editCategory}
            onUpdateDescription={updateDescription}
            onAcceptCategory={acceptCategory}
          />
        ))
      )}

      {!loading && filtered.length > 0 && (
        <div style={{
          padding: "10px 16px",
          fontSize: 10,
          color: "var(--muted)",
          borderTop: "1px solid var(--border)",
        }}>
          {filtered.length} transactions
        </div>
      )}
    </div>
  );
}
