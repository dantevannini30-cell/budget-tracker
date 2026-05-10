import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import useSavingGoals from "./hooks/useSavingGoals";
import { getSavingGoalAccountHistory } from "@/api/goals";

import {
  cardStyle,
  inputStyle,
  primaryBtn,
} from "@/shared/styles/ui";

const HISTORY_PERIODS = [
  { value: "weekly", label: "Weeks" },
  { value: "monthly", label: "Months" },
  { value: "yearly", label: "Years" },
];
const HISTORY_COUNTS_BY_PERIOD = {
  weekly: [5, 12, 26, 52, 104],
  monthly: [5, 12, 24],
  yearly: [1, 2, 3, 5],
};

function getWeeklyPointCount(period, count) {
  if (period === "yearly") return count * 52;
  if (period === "monthly") return Math.ceil(count * (52 / 12));
  return count;
}

function getDefaultCountForPeriod(period) {
  if (period === "yearly") return 5;
  if (period === "monthly") return 5;
  return 5;
}

function formatAxisTick(value, period) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  if (period === "yearly") return String(date.getFullYear());

  if (period === "monthly") {
    return date.toLocaleDateString("en-NZ", {
      month: "short",
      year: "2-digit",
    });
  }

  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
  });
}

function getPeriodKey(value, period) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  if (period === "yearly") return String(date.getFullYear());
  if (period === "monthly") return `${date.getFullYear()}-${date.getMonth()}`;
  return value.slice(0, 10);
}

function getAxisTicks(points, period) {
  const seen = new Set();
  const ticks = [];

  points.forEach((point) => {
    const key = getPeriodKey(point.end_date, period);
    if (seen.has(key)) return;
    seen.add(key);
    ticks.push(point.end_date);
  });

  return ticks;
}

function SavingHistoryPanel({
  goal,
  count,
  period,
  onCountChange,
  onPeriodChange,
}) {
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadHistory() {
      if (!goal.account_id) {
        setHistory([]);
        return;
      }

      try {
        setLoadingHistory(true);
        const data = await getSavingGoalAccountHistory(goal.id, {
          period: "weekly",
          count: getWeeklyPointCount(period, count),
        });
        if (!cancelled) setHistory(data.points || []);
      } catch (err) {
        console.error("Failed loading saving goal account history:", err);
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [count, goal.account_id, goal.id, period]);

  const chartData = history
    .filter((point) => point.balance !== null && point.balance !== undefined)
    .map((point) => ({
      ...point,
      balance: Number(point.balance),
    }));
  const hasAccount = Boolean(goal.account_id);
  const countOptions = HISTORY_COUNTS_BY_PERIOD[period] || HISTORY_COUNTS_BY_PERIOD.weekly;
  const axisTicks = getAxisTicks(chartData, period);

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
          Weekly account value history
        </div>

        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <select
            value={period}
            onChange={(e) => {
              const nextPeriod = e.target.value;
              onPeriodChange(nextPeriod);
              onCountChange(getDefaultCountForPeriod(nextPeriod));
            }}
            style={{
              ...inputStyle,
              padding: "5px 8px",
              width: 102,
            }}
          >
            {HISTORY_PERIODS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={count}
            onChange={(e) => onCountChange(Number(e.target.value))}
            style={{
              ...inputStyle,
              padding: "5px 8px",
              width: 88,
            }}
          >
            {countOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!hasAccount || (!loadingHistory && chartData.length === 0) ? (
        <div
          style={{
            height: 150,
            border: "1px solid var(--border2)",
            background: "var(--surface2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textAlign: "center",
          }}
        >
          {hasAccount
            ? "No balance history found for this account yet."
            : "Link this goal to an account to chart its value over time."}
        </div>
      ) : (
        <div
          style={{
            height: 180,
            border: "1px solid var(--border2)",
            background: "var(--surface2)",
            padding: "14px 8px 8px",
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
              />
              <XAxis
                dataKey="end_date"
                ticks={axisTicks}
                tickFormatter={(value) => formatAxisTick(value, period)}
                axisLine={false}
                tickLine={false}
                interval={0}
                tick={{
                  fill: "#6b7a96",
                  fontSize: 10,
                  fontFamily: "DM Mono",
                }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                width={56}
                tick={{
                  fill: "#6b7a96",
                  fontSize: 10,
                  fontFamily: "DM Mono",
                }}
              />
              <Tooltip
                formatter={(value) => [`$${Number(value).toFixed(2)}`, "Balance"]}
                labelFormatter={(_, payload) => {
                  const point = payload?.[0]?.payload;
                  return point?.balance_date || point?.label || "";
                }}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 2,
                  color: "var(--text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="var(--accent)"
                strokeWidth={2}
                dot={{ r: 2, strokeWidth: 1 }}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function SavingGoalsSection({
  budgetId,
  embedded = false,
  createRequest = 0,
}) {
  const {
    goals,
    accounts,
    form,
    setForm,
    handleSubmit,
    handleUpdate,
    resetForm,
    loading,
  } = useSavingGoals(budgetId);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [historyCounts, setHistoryCounts] = useState({});
  const [historyPeriods, setHistoryPeriods] = useState({});
  const lastCreateRequestRef = useRef(createRequest);

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

  useEffect(() => {
    if (createRequest === lastCreateRequestRef.current) return;
    lastCreateRequestRef.current = createRequest;
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  }, [createRequest, resetForm]);

  const openEditModal = (goal) => {
    setForm({
      name: goal.name || "",
      target_amount: String(goal.target_amount ?? ""),
      current_amount: String(goal.current_amount ?? ""),
      start_date: (goal.start_date || "").slice(0, 10),
      account_id: goal.account_id || "",
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
        ...(embedded ? {} : cardStyle),
        padding: 0,
      }}
    >
      {!embedded && (
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
      )}

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
              placeholder={form.account_id ? "Current amount from account" : "Current amount (optional)"}
              value={form.current_amount}
              onChange={(e) =>
                setForm({
                  ...form,
                  current_amount: e.target.value,
                })
              }
              style={inputStyle}
              disabled={Boolean(form.account_id)}
            />

            {accounts.length > 0 && (
              <select
                value={form.account_id}
                onChange={(e) =>
                  setForm({
                    ...form,
                    account_id: e.target.value,
                  })
                }
                style={inputStyle}
              >
                <option value="">Manual balance</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · ${Number(account.latest_balance || 0).toFixed(2)}
                  </option>
                ))}
              </select>
            )}

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
          const accountLabel = goal.account_name || goal.account_id;
          const expanded = expandedId === goal.id;
          const historyPeriod = historyPeriods[goal.id] || "weekly";
          const historyCount = historyCounts[goal.id] || HISTORY_COUNTS_BY_PERIOD[historyPeriod][0];

          return (
            <div
              onClick={() => setExpandedId(expanded ? null : goal.id)}
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
                  {goal.name}
                </div>

                <button
                  type="button"
                  aria-label={`Edit ${goal.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(goal);
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
                  color: "var(--muted2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  marginBottom: 8,
                }}
              >
                {displayPct}% · ${current.toFixed(2)} / ${target.toFixed(2)}
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

              {(startDate || accountLabel) && (
                <div
                  style={{
                    color: "var(--muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    marginTop: 7,
                    textTransform: "uppercase",
                  }}
                >
                  {startDate ? `From ${startDate.slice(0, 10)}` : ""}
                  {accountLabel ? ` · ${accountLabel}` : ""}
                </div>
              )}

              {expanded && (
                <SavingHistoryPanel
                  goal={goal}
                  count={historyCount}
                  period={historyPeriod}
                  onCountChange={(count) =>
                    setHistoryCounts((prev) => ({
                      ...prev,
                      [goal.id]: count,
                    }))
                  }
                  onPeriodChange={(period) =>
                    setHistoryPeriods((prev) => ({
                      ...prev,
                      [goal.id]: period,
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
