import { useEffect, useState } from "react";

import {
  createAllocation,
  deleteAllocation,
  getAllocations,
} from "@/api/allocations";
import { API } from "@/api/constants";
import CategoryDropdown from "@/components/CategoryDropdown";
import {
  cardStyle,
  inputStyle,
  primaryBtn,
} from "@/shared/styles/ui";

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function AllocationsTab() {
  const [transactions, setTransactions] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [form, setForm] = useState({
    from_category: "",
    to_category: "",
    amount: "",
    allocation_date: today(),
    note: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const [txnRes, allocationData] = await Promise.all([
        fetch(`${API}/api/transactions`),
        getAllocations(),
      ]);

      if (!txnRes.ok) throw new Error("Failed to load transactions");
      const txnData = await txnRes.json();
      setTransactions(txnData || []);
      setAllocations(allocationData || []);
    } catch (err) {
      console.error("Failed loading allocations tab:", err);
      setTransactions([]);
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(load, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  async function submit(e) {
    e.preventDefault();

    try {
      setSaving(true);
      await createAllocation({
        from_category: form.from_category,
        to_category: form.to_category,
        amount: Number(form.amount || 0),
        allocation_date: form.allocation_date,
        note: form.note,
      });
      setForm({
        from_category: "",
        to_category: "",
        amount: "",
        allocation_date: today(),
        note: "",
      });
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeAllocation(id) {
    try {
      setSaving(true);
      await deleteAllocation(id);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ ...cardStyle, padding: 0 }}>
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
            fontFamily: "var(--font-display)",
            fontSize: 28,
          }}
        >
          Allocations
        </div>

        <form
          onSubmit={submit}
          style={{
            padding: 20,
            display: "grid",
            gap: 12,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
              gap: 12,
            }}
          >
            <CategoryDropdown
              transactions={transactions}
              selectedCategories={form.from_category ? [form.from_category] : []}
              onChange={(categories) =>
                setForm({
                  ...form,
                  from_category: categories[categories.length - 1] || "",
                })
              }
              placeholder="Subtract from category..."
            />

            <CategoryDropdown
              transactions={transactions}
              selectedCategories={form.to_category ? [form.to_category] : []}
              onChange={(categories) =>
                setForm({
                  ...form,
                  to_category: categories[categories.length - 1] || "",
                })
              }
              placeholder="Allocate to category..."
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "160px 160px minmax(0, 1fr)",
              gap: 12,
            }}
          >
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={inputStyle}
              required
            />

            <input
              type="date"
              value={form.allocation_date}
              onChange={(e) =>
                setForm({ ...form, allocation_date: e.target.value })
              }
              style={inputStyle}
              required
            />

            <input
              placeholder="Note"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              style={inputStyle}
            />
          </div>

          <button
            type="submit"
            style={primaryBtn}
            disabled={saving || !form.from_category || !form.to_category}
          >
            {saving ? "Saving..." : "Add Allocation"}
          </button>
        </form>
      </div>

      <div style={{ ...cardStyle, padding: 0 }}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border)",
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
          }}
        >
          Existing allocations
        </div>

        {loading ? (
          <div style={{ padding: 20, color: "var(--muted2)" }}>Loading...</div>
        ) : allocations.length === 0 ? (
          <div
            style={{
              padding: 20,
              color: "var(--muted2)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            No allocations yet
          </div>
        ) : allocations.map((allocation) => (
          <div
            key={allocation.id}
            style={{
              display: "grid",
              gridTemplateColumns: "90px 90px 1fr auto",
              gap: 12,
              alignItems: "center",
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          >
            <span style={{ color: "var(--muted2)" }}>
              {(allocation.allocation_date || allocation.transaction_date)?.slice(0, 10)}
            </span>
            <span>{formatMoney(allocation.amount)}</span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {allocation.from_category} → {allocation.to_category}
              {allocation.note ? ` · ${allocation.note}` : ""}
            </span>
            <button
              type="button"
              onClick={() => removeAllocation(allocation.id)}
              disabled={saving}
              style={{
                border: "1px solid var(--border2)",
                background: "var(--surface2)",
                color: "var(--red)",
                cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                padding: "5px 9px",
              }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
