import { useState } from "react";

import useSpendingTargets from "./hooks/useSpendingTargets";

import CategoryDropdown from "@/components/CategoryDropdown";

import {
  cardStyle,
  inputStyle,
  primaryBtn,
} from "@/shared/styles/ui";

export default function SpendingTargetsSection({
  budgetId,
  transactions = [],
}) {
  const {
    targets,
    form,
    setForm,
    handleSubmit,
    handleUpdate,
    resetForm,
    loading,
  } = useSpendingTargets(budgetId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const submitAndClose = async (e) => {
    e.preventDefault();

    if (editingId) {
      await handleUpdate(editingId);
    } else {
      await handleSubmit(e);
    }

    setEditingId(null);
    setModalOpen(false);
  };

  const openCreateModal = () => {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  };

  const openEditModal = (target) => {
    setForm({
      name: target.name || "",
      amount: String(target.amount ?? ""),
      period: target.period || "monthly",
      start_date: (target.start_date || target.period_start || "").slice(0, 10),
      categories: target.categories || [],
    });
    setEditingId(target.id);
    setModalOpen(true);
  };

  const closeModal = () => {
    resetForm();
    setEditingId(null);
    setModalOpen(false);
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
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "18px 20px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
          }}
        >
          Spending Targets
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          style={primaryBtn}
        >
          Add
        </button>
      </div>

      {modalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={submitAndClose}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...cardStyle,
              width: "100%",
              maxWidth: 420,
              padding: 22,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 18px 48px rgba(0,0,0,0.42)",
            }}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 28,
                height: 28,
                border: "1px solid var(--border2)",
                borderRadius: 2,
                background: "var(--surface2)",
                color: "var(--muted2)",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: "24px",
              }}
            >
              ×
            </button>

            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 24,
                marginBottom: 4,
              }}
            >
              {editingId ? "Edit Spending Target" : "Add Spending Target"}
            </div>

            <input
              placeholder="Target name"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name: e.target.value,
                })
              }
              style={inputStyle}
              required
            />

            <input
              type="number"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) =>
                setForm({
                  ...form,
                  amount: e.target.value,
                })
              }
              style={inputStyle}
              required
            />

            <select
              value={form.period}
              onChange={(e) =>
                setForm({
                  ...form,
                  period: e.target.value,
                })
              }
              style={inputStyle}
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="budget">Entire Budget</option>
            </select>

            <input
              type="date"
              value={form.start_date}
              onChange={(e) =>
                setForm({
                  ...form,
                  start_date: e.target.value,
                })
              }
              style={inputStyle}
              required
            />

            <CategoryDropdown
              transactions={transactions}
              selectedCategories={form.categories}
              onChange={(categories) =>
                setForm({
                  ...form,
                  categories,
                })
              }
              placeholder="Select categories..."
            />

            <button
              type="submit"
              style={primaryBtn}
              disabled={loading}
            >
              {loading ? "Saving..." : editingId ? "Save Target" : "Add Target"}
            </button>
          </form>
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        {targets.length === 0 ? (
          <div
            style={{
              padding: 20,
              color: "var(--muted2)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            No spending targets yet
          </div>
        ) : targets.map((target) => {
          const pct = target.progress_pct || 0;
          const displayPct = Math.round(pct);
          const barPct = Math.min(pct, 100);
          const spent = target.current_spent || 0;
          const isOver = pct > 100 || target.is_over;
          const startDate = target.period_start || target.start_date;

          return (
            <div
              onClick={() => openEditModal(target)}
              key={target.id}
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    minWidth: 0,
                  }}
                >
                  {target.name}
                </div>

                <div
                  style={{
                    color: isOver ? "var(--red)" : "var(--muted2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  {displayPct}% · ${spent.toFixed(2)} / ${Number(target.amount).toFixed(2)}
                </div>
              </div>

              <div
                style={{
                  height: 12,
                  background: "var(--surface2)",
                  overflow: "hidden",
                  border: "1px solid var(--border2)",
                  borderRadius: 2,
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    width: `${barPct}%`,
                    height: "100%",
                    background: isOver ? "var(--red)" : "var(--accent)",
                  }}
                />
              </div>

              <div
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  marginTop: 7,
                  textTransform: "uppercase",
                }}
              >
                {target.period}
                {startDate ? ` · from ${startDate.slice(0, 10)}` : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
