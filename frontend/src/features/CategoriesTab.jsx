import { useCallback, useEffect, useState } from "react";

import { API } from "@/api/constants";
import {
  getCategories,
  getCategoryTransactions,
  setCategoryIncome,
  setCategoryRecurring,
} from "@/api/categories";
import CategoryModal from "@/components/CategoryModal";
import TransactionRow from "@/components/TransactionRow";
import { cardStyle } from "@/shared/styles/ui";

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

const UNCATEGORISED_CATEGORY = "Uncategorised";
const UNCATEGORISED_ROW = {
  category: UNCATEGORISED_CATEGORY,
  transaction_count: 0,
  expense_total: 0,
  income_total: 0,
  is_income: false,
  is_recurring: false,
};

function TransactionRows({
  transactions,
  onEditCategory,
  onUpdateDescription,
  onAcceptCategory,
}) {
  if (!transactions.length) {
    return (
      <div
        style={{
          color: "var(--muted2)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          padding: "12px 0 0",
        }}
      >
        No transactions in this category
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 7,
        paddingTop: 12,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr",
          gap: 12,
          padding: "0 16px 8px",
          borderBottom: "1px solid var(--border2)",
        }}
      >
        {["Date", "Amount", "Category", "Description", "Statement"].map((h) => (
          <span
            key={h}
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              color: "var(--muted)",
              textTransform: "uppercase",
            }}
          >
            {h}
          </span>
        ))}
      </div>
      {transactions.map((txn, i) => (
        <TransactionRow
          key={txn.id}
          txn={txn}
          i={i}
          onEditCategory={onEditCategory}
          onUpdateDescription={onUpdateDescription}
          onAcceptCategory={onAcceptCategory}
        />
      ))}
    </div>
  );
}

export default function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);
  const [transactionsByCategory, setTransactionsByCategory] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(null);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getCategories();
      setCategories(data || []);
    } catch (err) {
      console.error("Failed loading categories:", err);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadCategoryTransactions = useCallback(async (category) => {
    try {
      setLoadingTransactions(category);
      const data = await getCategoryTransactions(category);
      setTransactionsByCategory((prev) => ({
        ...prev,
        [category]: data || [],
      }));
    } catch (err) {
      console.error("Failed loading category transactions:", err);
      setTransactionsByCategory((prev) => ({
        ...prev,
        [category]: [],
      }));
    } finally {
      setLoadingTransactions(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!cancelled) await loadCategories();
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [loadCategories]);

  const toggleExpanded = async (category) => {
    if (expanded === category) {
      setExpanded(null);
      return;
    }

    setExpanded(category);

    if (transactionsByCategory[category]) return;
    await loadCategoryTransactions(category);
  };

  const updateCachedTransaction = (id, patch) => {
    setTransactionsByCategory((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([category, txns]) => [
          category,
          txns.map((txn) => (txn.id === id ? { ...txn, ...patch } : txn)),
        ])
      )
    );
  };

  const editCategory = (txn) => {
    if (!txn?.id) {
      console.warn("Skipping transaction with missing id:", txn);
      return;
    }

    setEditingTxn(txn);
  };

  const updateDescription = async (txn, description) => {
    if (!txn?.id) {
      console.warn("Skipping transaction with missing id:", txn);
      return;
    }

    try {
      const res = await fetch(`${API}/api/transactions/${txn.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      if (!res.ok) throw new Error("Failed to update transaction");

      updateCachedTransaction(txn.id, { description });
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

      updateCachedTransaction(editingTxn.id, {
        category: newCategory,
        category_source: "human",
        category_status: nextStatus,
      });
      setEditingTxn(null);

      await loadCategories();
      if (expanded) await loadCategoryTransactions(expanded);
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

      updateCachedTransaction(txn.id, {
        category_source: "human",
        category_status: "accepted",
      });
    } catch (err) {
      alert(err.message);
    }
  };

  const toggleRecurring = async (category, active) => {
    setCategories((prev) =>
      prev.map((item) =>
        item.category === category ? { ...item, is_recurring: active } : item
      )
    );

    try {
      const updated = await setCategoryRecurring(category, active);
      setCategories((prev) =>
        prev.map((item) =>
          item.category === category ? { ...item, ...updated } : item
        )
      );
    } catch (err) {
      console.error("Failed updating recurring category:", err);
      setCategories((prev) =>
        prev.map((item) =>
          item.category === category ? { ...item, is_recurring: !active } : item
        )
      );
    }
  };

  const toggleIncome = async (category, active) => {
    setCategories((prev) =>
      prev.map((item) =>
        item.category === category ? { ...item, is_income: active } : item
      )
    );

    try {
      const updated = await setCategoryIncome(category, active);
      setCategories((prev) =>
        prev.map((item) =>
          item.category === category ? { ...item, ...updated } : item
        )
      );
    } catch (err) {
      console.error("Failed updating income category:", err);
      setCategories((prev) =>
        prev.map((item) =>
          item.category === category ? { ...item, is_income: !active } : item
        )
      );
    }
  };

  const orderedCategories = [
    categories.find((item) => item.category === UNCATEGORISED_CATEGORY) || UNCATEGORISED_ROW,
    ...categories.filter((item) => item.category !== UNCATEGORISED_CATEGORY),
  ];

  const filteredCategories = orderedCategories.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return item.category.toLowerCase().includes(q);
  });

  const categoryModalTransactions = orderedCategories.map((item) => ({
    id: item.category,
    category: item.category,
  }));

  return (
    <div
      style={{
        ...cardStyle,
        padding: 0,
      }}
    >
      {editingTxn && (
        <CategoryModal
          transactions={categoryModalTransactions}
          onSubmit={submitCategoryEdit}
          onClose={() => setEditingTxn(null)}
        />
      )}

      <div
        style={{
          padding: "18px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
          }}
        >
          Categories
        </div>
        <div
          style={{
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
          }}
        >
          Tick income and recurring labels
        </div>
      </div>

      <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search categories..."
          style={{
            width: "100%",
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            borderRadius: 2,
            padding: "9px 12px",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        />
      </div>

      {loading ? (
        <div
          style={{
            padding: 20,
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          Loading categories...
        </div>
      ) : orderedCategories.length === 0 ? (
        <div
          style={{
            padding: 20,
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          No categories yet
        </div>
      ) : filteredCategories.length === 0 ? (
        <div
          style={{
            padding: 20,
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
          }}
        >
          No categories match your search
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {filteredCategories.map((item) => {
            const isExpanded = expanded === item.category;
            const transactions = transactionsByCategory[item.category] || [];

            return (
              <div
                key={item.category}
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "80px 96px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "var(--muted2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      textTransform: "uppercase",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(item.is_income)}
                      aria-label={`Mark ${item.category} as income`}
                      onChange={(e) =>
                        toggleIncome(item.category, e.target.checked)
                      }
                    />
                    Income
                  </label>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      color: "var(--muted2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      textTransform: "uppercase",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(item.is_recurring)}
                      aria-label={`Mark ${item.category} as recurring`}
                      onChange={(e) =>
                        toggleRecurring(item.category, e.target.checked)
                      }
                    />
                    Recurring
                  </label>

                  <button
                    type="button"
                    onClick={() => toggleExpanded(item.category)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--text)",
                      cursor: "pointer",
                      textAlign: "left",
                      minWidth: 0,
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        display: "block",
                      }}
                    >
                      {item.category}
                    </span>
                  </button>

                  <div
                    style={{
                      color: "var(--muted2)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      textAlign: "right",
                    }}
                  >
                    {item.transaction_count} txns · out {formatMoney(item.expense_total)}
                    {Number(item.income_total) > 0 ? ` · in ${formatMoney(item.income_total)}` : ""}
                  </div>
                </div>

                {isExpanded && (
                  <div
                    style={{
                      marginLeft: 188,
                      marginTop: 10,
                      paddingTop: 10,
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    {loadingTransactions === item.category ? (
                      <div
                        style={{
                          color: "var(--muted2)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                        }}
                      >
                        Loading transactions...
                      </div>
                    ) : (
                      <TransactionRows
                        transactions={transactions}
                        onEditCategory={editCategory}
                        onUpdateDescription={updateDescription}
                        onAcceptCategory={acceptCategory}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
