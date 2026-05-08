import { useState } from "react";

import useSavingGoals from "./hooks/useSavingGoals";

import {
  cardStyle,
  inputStyle,
  primaryBtn,
} from "@/shared/styles/ui";

export default function SavingGoalsSection({
  budgetId,
}) {
  const {
    goals,
    form,
    setForm,
    handleSubmit,
    handleUpdate,
    resetForm,
    loading,
  } = useSavingGoals(budgetId);

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

  const openEditModal = (goal) => {
    setForm({
      name: goal.name || "",
      target_amount: String(goal.target_amount ?? ""),
      current_amount: String(goal.current_amount ?? ""),
      start_date: (goal.start_date || "").slice(0, 10),
    });
    setEditingId(goal.id);
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
          Saving Goals
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
              {editingId ? "Edit Saving Goal" : "Add Saving Goal"}
            </div>

            <input
              placeholder="Goal name"
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
              placeholder="Target amount"
              value={form.target_amount}
              onChange={(e) =>
                setForm({
                  ...form,
                  target_amount: e.target.value,
                })
              }
              style={inputStyle}
              required
            />

            <input
              type="number"
              placeholder="Current amount (optional)"
              value={form.current_amount}
              onChange={(e) =>
                setForm({
                  ...form,
                  current_amount: e.target.value,
                })
              }
              style={inputStyle}
            />

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

            <button type="submit" style={primaryBtn} disabled={loading}>
              {loading ? "Saving..." : editingId ? "Save Goal" : "Add Goal"}
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
        {goals.length === 0 ? (
          <div
            style={{
              padding: 20,
              color: "var(--muted2)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            No saving goals yet
          </div>
        ) : goals.map((goal) => {
          const current = goal.current_amount || 0;
          const target = goal.target_amount || 0;
          const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
          const displayPct = Math.round(pct);
          const startDate = goal.start_date;

          return (
            <div
              onClick={() => openEditModal(goal)}
              key={goal.id}
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
                  {goal.name}
                </div>

                <div
                  style={{
                    color: "var(--muted2)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  {displayPct}% · ${current.toFixed(2)} / ${target.toFixed(2)}
                </div>
              </div>

              <div
                style={{
                  height: 12,
                  background: "var(--surface2)",
                  overflow: "hidden",
                  border: "1px solid var(--border2)",
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: "var(--accent)",
                  }}
                />
              </div>

              {startDate && (
                <div
                  style={{
                    color: "var(--muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    marginTop: 7,
                    textTransform: "uppercase",
                  }}
                >
                  From {startDate.slice(0, 10)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
