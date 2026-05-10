import { useEffect, useState } from "react";

import {
  getCategories,
  getCategoryTransactions,
  setCategoryRecurring,
} from "@/api/categories";
import { cardStyle } from "@/shared/styles/ui";

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function TransactionRows({ transactions }) {
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
      {transactions.map((txn) => (
        <div
          key={txn.id}
          style={{
            display: "grid",
            gridTemplateColumns: "92px 90px minmax(0, 1fr)",
            gap: 12,
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        >
          <span>{txn.date?.slice(0, 10) || "-"}</span>
          <span style={{ color: Number(txn.amount) < 0 ? "var(--red)" : "var(--green)" }}>
            {Number(txn.amount) < 0 ? "-" : "+"}
            {formatMoney(Math.abs(Number(txn.amount || 0)))}
          </span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {txn.statement || txn.description || "Transaction"}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function CategoriesTab() {
  const [categories, setCategories] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [transactionsByCategory, setTransactionsByCategory] = useState({});
  const [loading, setLoading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        setLoading(true);
        const data = await getCategories();
        if (!cancelled) setCategories(data || []);
      } catch (err) {
        console.error("Failed loading categories:", err);
        if (!cancelled) setCategories([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggleExpanded = async (category) => {
    if (expanded === category) {
      setExpanded(null);
      return;
    }

    setExpanded(category);

    if (transactionsByCategory[category]) return;

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

  return (
    <div
      style={{
        ...cardStyle,
        padding: 0,
      }}
    >
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
          Tick recurring labels
        </div>
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
      ) : categories.length === 0 ? (
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
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {categories.map((item) => {
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
                    gridTemplateColumns: "28px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: 12,
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
                      marginLeft: 40,
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
                      <TransactionRows transactions={transactions} />
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
