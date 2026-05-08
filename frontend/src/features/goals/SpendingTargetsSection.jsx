import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

import useSpendingTargets from "./hooks/useSpendingTargets";

import CategoryDropdown from "@/components/CategoryDropdown";

import {
  cardStyle,
  inputStyle,
  primaryBtn,
} from "@/shared/styles/ui";

const HISTORY_COUNTS = [4, 8, 12, 24];

function parseDate(value) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  next.setDate(Math.min(day, daysInMonth(next.getFullYear(), next.getMonth())));
  return next;
}

function addYears(date, years) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function incrementDate(date, period) {
  if (period === "weekly") return addDays(date, 7);
  if (period === "yearly") return addYears(date, 1);
  return addMonths(date, 1);
}

function getHistoryStart(target, count) {
  const anchor = parseDate(target.start_date || target.period_start) || new Date();
  const activeStart = parseDate(target.period_start) || anchor;
  let cursor = anchor;

  while (incrementDate(cursor, target.period) <= activeStart) {
    cursor = incrementDate(cursor, target.period);
  }

  for (let i = 1; i < count; i += 1) {
    const previous = stepBack(cursor, target.period);
    if (previous < anchor) break;
    cursor = previous;
  }

  return cursor;
}

function stepBack(date, period) {
  if (period === "weekly") return addDays(date, -7);
  if (period === "yearly") return addYears(date, -1);
  return addMonths(date, -1);
}

function buildSpendingHistory(target, transactions, count) {
  const categories = new Set(target.categories || []);
  const targetAmount = Number(target.amount) || 0;
  const start = getHistoryStart(target, count);
  const rows = [];

  let periodStart = start;

  for (let i = 0; i < count; i += 1) {
    const periodEnd = incrementDate(periodStart, target.period);
    const spent = (transactions || []).reduce((sum, txn) => {
      const txnDate = parseDate(txn.date);
      const matchesCategory = categories.has(txn.category);
      const isExpense = Number(txn.amount) < 0;

      if (
        !txnDate ||
        !matchesCategory ||
        !isExpense ||
        txnDate < periodStart ||
        txnDate >= periodEnd
      ) {
        return sum;
      }

      return sum + Math.abs(Number(txn.amount) || 0);
    }, 0);

    const pct = targetAmount ? (spent / targetAmount) * 100 : 0;

    rows.push({
      label: formatHistoryLabel(periodStart, target.period),
      start: formatDate(periodStart),
      spent,
      pct: Math.round(pct),
    });

    periodStart = periodEnd;
  }

  return rows;
}

function formatHistoryLabel(date, period) {
  if (period === "weekly") {
    return `${date.getDate()} ${date.toLocaleString("en-NZ", { month: "short" })}`;
  }

  if (period === "yearly") {
    return String(date.getFullYear());
  }

  return date.toLocaleString("en-NZ", { month: "short", year: "2-digit" });
}

function SpendingHistoryChart({ target, transactions, count, onCountChange }) {
  const data = buildSpendingHistory(target, transactions, count);

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
          }}
        >
          Progress by {target.period === "budget" ? "month" : target.period}
        </div>

        <select
          value={count}
          onChange={(e) => onCountChange(Number(e.target.value))}
          style={{
            ...inputStyle,
            padding: "5px 8px",
            width: 88,
          }}
        >
          {HISTORY_COUNTS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={data}>
          <XAxis
            dataKey="label"
            tick={{ fill: "#6b7a96", fontSize: 10, fontFamily: "DM Mono" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#6b7a96", fontSize: 10, fontFamily: "DM Mono" }}
            axisLine={false}
            tickLine={false}
            width={38}
            domain={[0, "dataMax"]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            formatter={(value, name, item) => [
              `${value}% · $${Number(item.payload.spent).toFixed(2)}`,
              "Used",
            ]}
            labelFormatter={(_, items) => items?.[0]?.payload?.start || ""}
            contentStyle={{
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              color: "var(--text)",
            }}
          />
          <ReferenceLine y={100} stroke="var(--red)" strokeDasharray="4 4" />
          <Line
            type="monotone"
            dataKey="pct"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 0, fill: "var(--accent)" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

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
  const [expandedId, setExpandedId] = useState(null);
  const [historyCounts, setHistoryCounts] = useState({});

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
          const expanded = expandedId === target.id;
          const historyCount = historyCounts[target.id] || 8;

          return (
            <div
              onClick={() => setExpandedId(expanded ? null : target.id)}
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
                  alignItems: "center",
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

                <button
                  type="button"
                  aria-label={`Edit ${target.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(target);
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    border: "1px solid var(--border2)",
                    borderRadius: 2,
                    background: "var(--surface2)",
                    color: "var(--muted2)",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: "18px",
                    flexShrink: 0,
                  }}
                >
                  ⋯
                </button>
              </div>

              <div
                style={{
                  color: isOver ? "var(--red)" : "var(--muted2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  marginBottom: 8,
                }}
              >
                {displayPct}% · ${spent.toFixed(2)} / ${Number(target.amount).toFixed(2)}
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

              {expanded && (
                <SpendingHistoryChart
                  target={target}
                  transactions={transactions}
                  count={historyCount}
                  onCountChange={(count) =>
                    setHistoryCounts((prev) => ({
                      ...prev,
                      [target.id]: count,
                    }))
                  }
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
