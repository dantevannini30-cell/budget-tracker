import { useState, useEffect, useMemo } from "react";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

const API = "http://localhost:8000/api";

// ─── Fonts ────────────────────────────────────────────────────────────────────
const fontLink = document.createElement("link");
fontLink.rel = "stylesheet";
fontLink.href =
  "https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&family=DM+Sans:wght@300;400;500&display=swap";

document.head.appendChild(fontLink);

// ─── Global styles ────────────────────────────────────────────────────────────
const globalStyle = document.createElement("style");

globalStyle.textContent = `
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --bg: #080a0e;
  --surface: #0e1117;
  --surface2: #151922;
  --border: #1e2530;
  --border2: #2a3345;
  --text: #e8edf5;
  --muted: #4a5568;
  --muted2: #6b7a96;
  --accent: #00d4aa;
  --red: #ff4d6d;
  --green: #00d4aa;
  --font-display: 'Bebas Neue', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --font-mono: 'DM Mono', monospace;
}

html, body, #root {
  height: 100%;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

::-webkit-scrollbar {
  width: 4px;
}

::-webkit-scrollbar-track {
  background: var(--bg);
}

::-webkit-scrollbar-thumb {
  background: var(--border2);
  border-radius: 2px;
}

input:focus,
select:focus {
  outline: none;
  border-color: var(--accent) !important;
}

button {
  transition: all 0.15s ease;
}

button:hover {
  opacity: 0.92;
}
`;

document.head.appendChild(globalStyle);

// ─── Shared Styles ────────────────────────────────────────────────────────────
const primaryBtn = {
  background: "var(--accent)",
  color: "var(--bg)",
  border: "none",
  borderRadius: 2,
  padding: "10px 14px",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const secondaryBtn = {
  background: "var(--surface2)",
  color: "var(--text)",
  border: "1px solid var(--border2)",
  borderRadius: 2,
  padding: "10px 14px",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const inputStyle = {
  width: "100%",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: 2,
  padding: "10px 12px",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
};

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 4,
};

// ─── API ──────────────────────────────────────────────────────────────────────
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, options);

  if (!res.ok) {
    throw new Error("API request failed");
  }

  return res.json();
}

const getBudgets = () => api("/budgets");

const createBudget = (start_date) =>
  api("/budgets", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ start_date }),
  });

const getBudgetSummary = (budgetId) =>
  api(`/budgets/${budgetId}/summary`);

const getBudgetTransactions = (budgetId) =>
  api(`/budgets/${budgetId}/transactions`);

const getSpendingTargets = (budgetId) =>
  api(`/budgets/${budgetId}/spending-targets`);

const getSpendingTargetProgress = (budgetId, targetId) =>
  api(`/budgets/${budgetId}/spending-targets/${targetId}/progress`);

const createSpendingTarget = (budgetId, payload) =>
  api(`/budgets/${budgetId}/spending-targets`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

const getSavingGoals = (budgetId) =>
  api(`/budgets/${budgetId}/saving-goals`);

const getSavingGoalProgress = (budgetId, goalId) =>
  api(`/budgets/${budgetId}/saving-goals/${goalId}/progress`);

const createSavingGoal = (budgetId, payload) =>
  api(`/budgets/${budgetId}/saving-goals`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });


const deleteBudget = (budgetId) =>
  api(`/budgets/${budgetId}`, {
    method: "DELETE",
  });


// ─── Hooks ────────────────────────────────────────────────────────────────────
function useApi(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}${endpoint}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [endpoint]);
  return { data, setData, loading };
}


// ─── Components ───────────────────────────────────────────────────────────────
function SummaryCard({ title, value }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: 20,
      }}
    >
      <div
        style={{
          color: "var(--muted2)",
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 34,
          fontFamily: "var(--font-display)",
          letterSpacing: "0.03em",
        }}
      >
        ${Number(value || 0).toFixed(2)}
      </div>
    </div>
  );
}

function GoalProgressChart({ title, data, color }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--muted2)",
          marginBottom: 16,
        }}
      >
        {title}
      </div>

      {!data.length ? (
        <div
          style={{
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            padding: "24px 0",
          }}
        >
          No goals yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} barGap={-28}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
            />

            <XAxis
              dataKey="name"
              tick={{
                fill: "#6b7a96",
                fontSize: 10,
                fontFamily: "DM Mono",
              }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              tick={{
                fill: "#6b7a96",
                fontSize: 10,
                fontFamily: "DM Mono",
              }}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              formatter={(v) => `$${Number(v).toFixed(2)}`}
              contentStyle={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 2,
              }}
            />

            <Bar
              dataKey="target"
              fill={`${color}44`}
              radius={[3, 3, 0, 0]}
              maxBarSize={42}
            />

            <Bar
              dataKey="current"
              fill={color}
              radius={[3, 3, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

const updateTransaction = (id, payload) =>
  api(`/transactions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });


const PIE_COLORS = [
  "#00d4aa",
  "#ff4d6d",
  "#ffa502",
  "#6366f1",
  "#8b5cf6",
  "#d946ef",
  "#0891b2",
  "#06b6d4",
];
function PieChartWrapper({ data, title }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 2,
        padding: 16,
        flex: 1,
        minWidth: 280,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily: "var(--font-mono)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--muted2)",
          marginBottom: 12,
        }}
      >
        {title}
      </div>

      {data.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "var(--muted2)",
            padding: "40px 20px",
            fontSize: 12,
          }}
        >
          No transactions
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={40}
              outerRadius={60}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value) => `$${value.toFixed(2)}`}
              contentStyle={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                color: "var(--text)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}

      <div style={{ marginTop: 12, fontSize: 10 }}>
        {data.map((item, i) => (
          <div
            key={item.name}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "2px 0",
              color: "var(--muted2)",
            }}
          >
            <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>
              ● {item.name}
            </span>

            <span>${item.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── Dashboard Page ───────────────────────────────────────────────────────────
function DashboardPage() {
  const [budgets, setBudgets] = useState([]);
  const [startDate, setStartDate] = useState("");
  const [loading, setLoading] = useState(true);

  const navigate = useNavigate();

  async function loadBudgets() {
    setLoading(true);

    try {
      const data = await getBudgets();
      setBudgets(data);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadBudgets();
  }, []);

  async function handleCreateBudget(e) {
    e.preventDefault();

    if (!startDate) return;

    try {
      const budget = await createBudget(startDate);

      setStartDate("");

      navigate(`/budget/${budget.id}`);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          height: 56,
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            color: "var(--accent)",
            letterSpacing: "0.08em",
          }}
        >
          BUDGET
        </div>
      </header>

      <main
        style={{
          padding: "32px",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 48,
              letterSpacing: "0.04em",
            }}
          >
            Budgets
          </div>

          <div
            style={{
              marginTop: 4,
              color: "var(--muted2)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            Create and manage budgeting periods
          </div>
        </div>

        {/* Create Budget */}
        <div
          style={{
            ...cardStyle,
            padding: 24,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              marginBottom: 16,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--muted2)",
            }}
          >
            Create Budget
          </div>

          <form
            onSubmit={handleCreateBudget}
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "end",
            }}
          >
            <div style={{ minWidth: 240 }}>
              <div
                style={{
                  marginBottom: 6,
                  fontSize: 11,
                  color: "var(--muted2)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                Start Date
              </div>

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>

            <button type="submit" style={primaryBtn}>
              Create Budget
            </button>
          </form>
        </div>

        {/* Budgets Grid */}
        {loading ? (
          <div>Loading budgets...</div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}
          >
            {budgets.map((budget) => {
              const totalBalance = budget.balances
                ? Object.values(budget.balances).reduce(
                    (a, b) => a + b,
                    0
                  )
                : 0;

              return (
                <div
                  key={budget.id}
                  style={{
                    ...cardStyle,
                    padding: 22,
                    cursor: "pointer",
                  }}
                >
                  {/* Header row with click + delete */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 20,
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Clickable area (open budget) */}
                    <div
                      onClick={() =>
                        navigate(`/budget/${budget.id}`)
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 28,
                        }}
                      >
                        Budget
                      </div>

                      <div
                        style={{
                          color: "var(--muted2)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                        }}
                      >
                        Started {budget.start_date}
                      </div>
                    </div>

                    {/* Delete button */}
                    <button
                      style={{
                        ...secondaryBtn,
                        borderColor: "var(--red)",
                        color: "var(--red)",
                      }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        await deleteBudget(budget.id);
                        loadBudgets();
                      }}
                    >
                      Delete
                    </button>
                  </div>

                  {/* Stats */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "var(--muted2)" }}>
                        Transactions
                      </span>

                      <span>{budget.transaction_count}</span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span style={{ color: "var(--muted2)" }}>
                        Balance
                      </span>

                      <span>${totalBalance.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Spending Targets Section ─────────────────────────────────────────────────
function SpendingTargetsSection({
  budgetId,
  categories,
}) {
  const [targets, setTargets] = useState([]);
  const [progress, setProgress] = useState({});

  const [form, setForm] = useState({
    name: "",
    amount: "",
    period: "monthly",
    categories: "",
  });

  async function loadTargets() {
    try {
      const data = await getSpendingTargets(budgetId);

      setTargets(data);

      const progressMap = {};

      for (const target of data) {
        progressMap[target.id] =
          await getSpendingTargetProgress(
            budgetId,
            target.id
          );
      }

      setProgress(progressMap);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadTargets();
  }, [budgetId]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await createSpendingTarget(budgetId, {
        name: form.name,
        amount: Number(form.amount),
        period: form.period,
        categories: form.categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      });

      setForm({
        name: "",
        amount: "",
        period: "monthly",
        categories: "",
      });

      loadTargets();
    } catch (err) {
      console.error(err);
    }
  }

  const chartData = targets.map((target) => {
    const data = progress[target.id];

    return {
      name: target.name,
      target: target.amount,
      current:
        data?.periods?.[0]?.spent || 0,
    };
  });

  return (
    <div
      style={{
        ...cardStyle,
        padding: 22,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          marginBottom: 18,
        }}
      >
        Spending Targets
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 24,
        }}
      >
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
          placeholder="Categories (comma separated)"
          value={form.categories}
          onChange={(e) =>
            setForm({
              ...form,
              categories: e.target.value,
            })
          }
          style={inputStyle}
        />

        <button type="submit" style={primaryBtn}>
          Add Spending Target
        </button>
      </form>

      <GoalProgressChart
        title="Spending Progress"
        data={chartData}
        color="#ff4d6d"
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 20,
        }}
      >
        {targets.map((target) => {
          const data = progress[target.id];

          return (
            <div
              key={target.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 16,
              }}
            >
              <div
                style={{
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 4,
                  }}
                >
                  {target.name}
                </div>

                <div
                  style={{
                    color: "var(--muted2)",
                    fontSize: 12,
                  }}
                >
                  ${target.amount} · {target.period}
                </div>
              </div>

              {data?.periods?.map((period) => {
                const pct = Math.min(
                  (period.spent / period.limit) * 100,
                  100
                );

                return (
                  <div
                    key={period.label}
                    style={{ marginBottom: 12 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 6,
                        fontSize: 12,
                      }}
                    >
                      <span>{period.label}</span>

                      <span>
                        ${period.spent.toFixed(2)} / $
                        {period.limit.toFixed(2)}
                      </span>
                    </div>

                    <div
                      style={{
                        height: 10,
                        background: "var(--surface2)",
                        borderRadius: 999,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: "var(--red)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Saving Goals Section ─────────────────────────────────────────────────────
function SavingGoalsSection({ budgetId }) {
  const [goals, setGoals] = useState([]);
  const [progress, setProgress] = useState({});

  const [form, setForm] = useState({
    name: "",
    target: "",
    by_date: "",
  });

  async function loadGoals() {
    try {
      const data = await getSavingGoals(budgetId);

      setGoals(data);

      const progressMap = {};

      for (const goal of data) {
        progressMap[goal.id] =
          await getSavingGoalProgress(
            budgetId,
            goal.id
          );
      }

      setProgress(progressMap);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadGoals();
  }, [budgetId]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await createSavingGoal(budgetId, {
        name: form.name,
        target: Number(form.target),
        by_date: form.by_date || null,
      });

      setForm({
        name: "",
        target: "",
        by_date: "",
      });

      loadGoals();
    } catch (err) {
      console.error(err);
    }
  }

  const chartData = goals.map((goal) => {
    const data = progress[goal.id];

    return {
      name: goal.name,
      target: data?.target || goal.target,
      current: data?.saved || 0,
    };
  });

  return (
    <div
      style={{
        ...cardStyle,
        padding: 22,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 28,
          marginBottom: 18,
        }}
      >
        Saving Goals
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          marginBottom: 24,
        }}
      >
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
        />

        <input
          type="number"
          placeholder="Target amount"
          value={form.target}
          onChange={(e) =>
            setForm({
              ...form,
              target: e.target.value,
            })
          }
          style={inputStyle}
        />

        <input
          type="date"
          value={form.by_date}
          onChange={(e) =>
            setForm({
              ...form,
              by_date: e.target.value,
            })
          }
          style={inputStyle}
        />

        <button type="submit" style={primaryBtn}>
          Add Saving Goal
        </button>
      </form>

      <GoalProgressChart
        title="Saving Progress"
        data={chartData}
        color="#00d4aa"
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 20,
        }}
      >
        {goals.map((goal) => {
          const data = progress[goal.id];

          if (!data) return null;

          const pct = Math.min(
            data.progress_pct || 0,
            100
          );

          return (
            <div
              key={goal.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    {goal.name}
                  </div>

                  <div
                    style={{
                      color: "var(--muted2)",
                      fontSize: 12,
                    }}
                  >
                    ${data.saved?.toFixed(2)} / $
                    {data.target?.toFixed(2)}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: "var(--muted2)",
                  }}
                >
                  {pct.toFixed(0)}%
                </div>
              </div>

              <div
                style={{
                  height: 10,
                  background: "var(--surface2)",
                  borderRadius: 999,
                  overflow: "hidden",
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: "var(--green)",
                  }}
                />
              </div>

              {data.projection && (
                <div
                  style={{
                    fontSize: 12,
                    color: data.projection.on_track
                      ? "var(--green)"
                      : "var(--red)",
                  }}
                >
                  {data.projection.on_track
                    ? "On track"
                    : "Behind target"}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



const DEFAULT_FILTERS = { showIn: true, showOut: true, showCategorised: true, showUncategorised: true };
const SORT_OPTIONS = [
  { key: "date_desc",   label: "Date (newest first)" },
  { key: "date_asc",    label: "Date (oldest first)" },
  { key: "amount_desc", label: "Amount (highest first)" },
  { key: "amount_asc",  label: "Amount (lowest first)" },
];

function applyFilters(transactions, search, filters) {
  const normalized = search.trim().toLowerCase();
  return transactions.filter(t => {
    if (normalized && ![t.description, t.statement].some(v => v?.toLowerCase().includes(normalized))) return false;
    if (t.amount > 0 && !filters.showIn) return false;
    if (t.amount < 0 && !filters.showOut) return false;
    if (t.category && !filters.showCategorised) return false;
    if (!t.category && !filters.showUncategorised) return false;
    return true;
  });
}

function applySort(transactions, sortKey) {
  const arr = [...transactions];
  if (sortKey === "date_desc") return arr.sort((a, b) => new Date(b.date) - new Date(a.date));
  if (sortKey === "date_asc")  return arr.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortKey === "amount_desc") return arr.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  if (sortKey === "amount_asc")  return arr.sort((a, b) => Math.abs(a.amount) - Math.abs(b.amount));
  return arr;
}

function SortDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const active = value !== "date_desc";
  const label = SORT_OPTIONS.find(o => o.key === value)?.label ?? "Sort";

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: active ? "var(--accent)" : "var(--surface2)",
        color: active ? "var(--bg)" : "var(--muted2)",
        border: "1px solid var(--border2)", borderRadius: 2,
        padding: "7px 14px", fontFamily: "var(--font-mono)", fontSize: 10,
        cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
        display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
      }}>
        Sort
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
            background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 4,
            minWidth: 210, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
          }}>
            {SORT_OPTIONS.map(opt => (
              <div key={opt.key} onClick={() => { onChange(opt.key); setOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", transition: "background 0.1s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: `1px solid ${value === opt.key ? "var(--accent)" : "var(--border2)"}`,
                  background: value === opt.key ? "var(--accent)" : "transparent",
                  flexShrink: 0, transition: "all 0.1s",
                }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{opt.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const FILTER_OPTIONS = [
  { key: "showIn", label: "Income" },
  { key: "showOut", label: "Expenses" },
  { key: "showCategorised", label: "Categorised" },
  { key: "showUncategorised", label: "Uncategorised" },
];

function FilterDropdown({ filters, onChange }) {
  const [open, setOpen] = useState(false);
  const active = Object.values(filters).some(v => !v);
  const activeCount = Object.values(filters).filter(v => v).length;

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: active ? "var(--accent)" : "var(--surface2)",
        color: active ? "var(--bg)" : "var(--muted2)",
        border: "1px solid var(--border2)", borderRadius: 2,
        padding: "7px 14px", fontFamily: "var(--font-mono)", fontSize: 10,
        cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
        display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
      }}>
        Filters {activeCount < 4 && `(${activeCount})`}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
            background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 4,
            minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
          }}>
            {FILTER_OPTIONS.map(opt => (
              <div key={opt.key} onClick={() => onChange(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", transition: "background 0.1s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: 2,
                  border: `1px solid ${filters[opt.key] ? "var(--accent)" : "var(--border2)"}`,
                  background: filters[opt.key] ? "var(--accent)" : "transparent",
                  flexShrink: 0, transition: "all 0.1s",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {filters[opt.key] && (
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3L3 5L7 1" stroke="var(--bg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{opt.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skel({ w = "100%", h = 14 }) {
  return <div className="skeleton" style={{ width: w, height: h }} />;
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent, delay = 0 }) {
  return (
    <div className="fade-up" style={{
      animationDelay: `${delay}ms`,
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderTop: `2px solid ${accent ? "var(--accent)" : "var(--border)"}`,
      padding: "20px 24px",
      borderRadius: 2,
      flex: 1,
      minWidth: 150,
    }}>
      <div style={{ color: "var(--muted2)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", fontFamily: "var(--font-mono)", marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 38, letterSpacing: "0.02em", color: accent ? "var(--accent)" : "var(--text)", lineHeight: 1 }}>
        {value}
      </div>
      {sub && <div style={{ color: "var(--muted2)", fontSize: 11, marginTop: 6, fontFamily: "var(--font-mono)" }}>{sub}</div>}
    </div>
  );
}

// ─── Summary Stats ───────────────────────────────────────────────────────────
function SummaryStats() {
  const { data, loading } = useApi("/api/summary");

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Skel h={20} /><Skel h={20} /><Skel h={20} /></div>;
  if (!data) return null;

  const { total_balance, total_in, total_out, net } = data;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
      <StatCard label="Total Balance" value={`$${total_balance?.toFixed(2) || "0.00"}`} sub="Current balance" accent />
      <StatCard label="Total In" value={`$${total_in?.toFixed(2) || "0.00"}`} sub="All time" />
      <StatCard label="Total Out" value={`$${total_out?.toFixed(2) || "0.00"}`} sub="All time" />
      <StatCard label="Net" value={`${net >= 0 ? "+" : ""}$${net?.toFixed(2) || "0.00"}`} sub="All time" accent={net >= 0} />
    </div>
  );
}

// ─── Category Bars ────────────────────────────────────────────────────────────
function CategoryBars() {
  const { data, loading } = useApi("/api/summary");

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Skel h={16} /><Skel h={16} /><Skel h={16} /></div>;
  if (!data) return <div style={{ color: "var(--muted2)", textAlign: "center", padding: "40px" }}>No data available</div>;

  // Simple category breakdown - you can enhance this
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ color: "var(--muted2)", fontSize: 12 }}>Category spending visualization would go here</div>
    </div>
  );
}

// ─── Recent Activity ──────────────────────────────────────────────────────────
function RecentActivity() {
  const { data, loading } = useApi("/api/transactions");

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 8 }}><Skel h={16} /><Skel h={16} /><Skel h={16} /></div>;
  if (!data || data.length === 0) return <div style={{ color: "var(--muted2)", textAlign: "center", padding: "40px" }}>No recent transactions</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.slice(0, 5).map((txn, i) => (
        <div key={txn.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--text)" }}>{txn.description || txn.statement || "Transaction"}</div>
            <div style={{ fontSize: 10, color: "var(--muted2)", fontFamily: "var(--font-mono)" }}>
              {new Date(txn.date).toLocaleDateString()}
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: txn.amount < 0 ? "var(--red)" : "var(--green)" }}>
            {txn.amount < 0 ? "-" : "+"}${Math.abs(txn.amount).toFixed(2)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Transactions Tab ─────────────────────────────────────────────────────────
function TransactionsTab() {
  const { data, setData, loading } = useApi("/api/transactions");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("date_desc");
  const [editingTxn, setEditingTxn] = useState(null);

  const filtered = applySort(applyFilters(data || [], search, filters), sort);

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

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2 }}>
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

// ─── Budgets Tab ──────────────────────────────────────────────────────────────
function BudgetsTab({ onSelectBudget }) {
  const [budgets, setBudgets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`${API}/api/budgets`)
      .then(r => r.json())
      .then(data => { if (!active) return; setBudgets(data); setLoading(false); })
      .catch(() => { if (!active) return; setLoading(false); });
    return () => { active = false; };
  }, []);

  const createBudget = async () => {
    const date = prompt("Enter budget start date (YYYY-MM-DD):");
    if (!date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      alert("Please use YYYY-MM-DD format");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/api/budgets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_date: date }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to create budget");
      }
      const budget = await res.json();
      setBudgets(prev => prev ? [budget, ...prev] : [budget]);
      setMessage(`Created budget ${budget.id.slice(0, 8)} with ${budget.transaction_count} transactions.`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)" }}>Budgets</div>
          <div style={{ marginTop: 4, fontSize: 24, fontFamily: "var(--font-display)" }}>Saved budget periods</div>
        </div>
        <button onClick={createBudget} disabled={saving} style={{
          background: "var(--accent)", color: "var(--bg)", border: "none",
          borderRadius: 2, padding: "10px 18px", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em"
        }}>
          {saving ? "Saving..." : "New budget"}
        </button>
      </div>

      {message && <div style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{message}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3].map(i => <Skel key={i} h={18} />)}
        </div>
      ) : !budgets?.length ? (
        <p style={{ color: "var(--muted2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>No budgets yet. Create one to store transactions from a start date.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 120px", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>
            <span>Budget ID</span>
            <span>Start date</span>
            <span>Created</span>
            <span style={{ textAlign: "right" }}>Transactions</span>
          </div>
          {budgets.map((budget, index) => (
            <div key={budget.id} onClick={() => onSelectBudget(budget.id)} style={{ cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 120px 140px 120px", gap: 12, padding: "12px 0", borderBottom: index + 1 === budgets.length ? "none" : "1px solid var(--border)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{budget.id}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{budget.start_date}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{budget.created_at.slice(0, 10)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right" }}>{budget.transaction_count}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── Budget Dashboard ─────────────────────────────────────────────────────────
function BudgetDashboard({ budgetId, onClearBudget }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sort, setSort] = useState("date_desc");
  const [editingTxn, setEditingTxn] = useState(null);

  useEffect(() => {
    if (!budgetId) return;
    setLoading(true);
    setError("");
    fetch(`${API}/api/budgets/${budgetId}/summary`)
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Failed to load budget summary");
        }
        return res.json();
      })
      .then(data => { setSummary(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [budgetId]);

  useEffect(() => {
    if (!budgetId) return;
    setTxLoading(true);
    fetch(`${API}/api/budgets/${budgetId}/transactions`)
      .then(r => r.json())
      .then(data => { setTransactions(data); setTxLoading(false); })
      .catch(() => setTxLoading(false));
  }, [budgetId]);

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
        setTransactions(prev => prev.map(item => item.id === txn.id ? { ...item, description: value } : item));
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
      setTransactions(prev => prev.map(item => item.id === editingTxn.id ? { ...item, category: newCategory } : item));
      setEditingTxn(null);
    } catch (err) {
      alert(err.message);
    }
  };

  const calculateCategoryTotals = (txns, isIncome = true) => {
    const filtered = txns.filter(t => (isIncome && t.amount > 0) || (!isIncome && t.amount < 0));
    const totals = {};
    filtered.forEach(t => {
      const cat = t.category || "Uncategorized";
      totals[cat] = (totals[cat] || 0) + Math.abs(t.amount);
    });
    return Object.entries(totals).map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) })).sort((a, b) => b.value - a.value);
  };

  const getLastWeekTransactions = () => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return transactions.filter(t => new Date(t.date) >= sevenDaysAgo);
  };

  const PIE_COLORS = ["#00d4aa", "#ff4d6d", "#ffa502", "#6366f1", "#8b5cf6", "#d946ef", "#0891b2", "#06b6d4"];

  if (loading) return <div style={{ display: "flex", flexDirection: "column", gap: 12 }}><Skel h={20} /><Skel h={20} /><Skel h={20} /></div>;
  if (error) return <p style={{ color: "var(--red)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{error}</p>;
  if (!summary) return null;

  const { start_date, created_at, transaction_count, summary: stats } = summary;
  const all = stats.all;
  const lastWeek = stats.last_week;
  const totalBalance = all.total_balance;

  const allCatsIncome = calculateCategoryTotals(transactions, true);
  const allCatsExpense = calculateCategoryTotals(transactions, false);
  const weekTxns = getLastWeekTransactions();
  const weekCatsIncome = calculateCategoryTotals(weekTxns, true);
  const weekCatsExpense = calculateCategoryTotals(weekTxns, false);

  const filteredTransactions = applySort(applyFilters(transactions, search, filters), sort);

  const PieChartWrapper = ({ data, title }) => (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 16, flex: 1, minWidth: 280 }}>
      <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--muted2)", marginBottom: 12 }}>{title}</div>
      {data.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--muted2)", padding: "40px 20px", fontSize: 12 }}>No transactions</div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={2} dataKey="value">
              {data.map((_, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(value) => `$${value.toFixed(2)}`} contentStyle={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 2, color: "var(--text)" }} />
          </PieChart>
        </ResponsiveContainer>
      )}
      <div style={{ marginTop: 12, fontSize: 10 }}>
        {data.map((item, i) => (
          <div key={item.name} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", color: "var(--muted2)" }}>
            <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>● {item.name}</span>
            <span>${item.value.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {editingTxn && (
        <CategoryModal
          transactions={transactions}
          onSubmit={submitCategoryEdit}
          onClose={() => setEditingTxn(null)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)" }}>Budget Analytics</div>
            <div style={{ marginTop: 4, fontSize: 24, fontFamily: "var(--font-display)" }}>Since {start_date}</div>
            <div style={{ fontFamily: "var(--font-mono)", color: "var(--muted2)", fontSize: 11, marginTop: 6 }}>Created {created_at.slice(0, 10)} · {transaction_count} transactions</div>
          </div>
          <button onClick={onClearBudget} style={{
            background: "var(--surface2)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: 2,
            padding: "10px 18px", cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em"
          }}>
            View overall dashboard
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12 }}>
        <StatCard label="Total Balance" value={`$${totalBalance.toFixed(2)}`} sub="Current balance" accent delay={0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <StatCard label="Total In" value={`$${all.total_in.toFixed(2)}`} sub="Since budget start" delay={0} />
        <StatCard label="Total Out" value={`$${all.total_out.toFixed(2)}`} sub="Since budget start" delay={80} />
        <StatCard label="Net" value={`${all.net >= 0 ? "+" : ""}$${all.net.toFixed(2)}`} sub="Since budget start" accent={all.net >= 0} delay={160} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <PieChartWrapper data={allCatsIncome} title="Income by Category" />
        <PieChartWrapper data={allCatsExpense} title="Expenses by Category" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
        <StatCard label="Last 7d In" value={`$${lastWeek.total_in.toFixed(2)}`} sub="Last week" delay={0} />
        <StatCard label="Last 7d Out" value={`$${lastWeek.total_out.toFixed(2)}`} sub="Last week" delay={80} />
        <StatCard label="Last 7d Net" value={`${lastWeek.net >= 0 ? "+" : ""}$${lastWeek.net.toFixed(2)}`} sub="Last week" accent={lastWeek.net >= 0} delay={160} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <PieChartWrapper data={weekCatsIncome} title="Last 7d Income by Category" />
        <PieChartWrapper data={weekCatsExpense} title="Last 7d Expenses by Category" />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 24 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)", marginBottom: 20 }}>Budget Transactions</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search transactions..."
            style={{ flex: 1, minWidth: 220, background: "var(--surface2)", border: "1px solid var(--border2)", borderRadius: 2, padding: "7px 12px", color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12, transition: "border-color 0.15s" }} />
          <FilterDropdown filters={filters} onChange={setFilters} />
          <SortDropdown value={sort} onChange={setSort} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr", gap: 12, padding: "14px 16px 8px", borderBottom: "1px solid var(--border2)", marginTop: 14 }}>
          {["Date","Amount","Category","Description","Statement"].map(h => (
            <span key={h} style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</span>
          ))}
        </div>

        {txLoading
          ? Array.from({length:10}).map((_,i) => <div key={i} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}><Skel w={`${50+Math.random()*40}%`} /></div>)
          : filteredTransactions.length === 0
            ? <p style={{ color: "var(--muted2)", padding: "24px 16px", fontFamily: "var(--font-mono)", fontSize: 12 }}>No transactions found</p>
            : filteredTransactions.map((txn, i) => <TxRow key={txn.id} txn={txn} i={i} onEdit={editTransaction} />)
        }

        {!txLoading && filteredTransactions.length > 0 && (
          <div style={{ padding: "10px 16px", color: "var(--muted)", fontSize: 10, fontFamily: "var(--font-mono)", borderTop: "1px solid var(--border)" }}>
            {filteredTransactions.length} transactions
          </div>
        )}
      </div>
    </div>
  );
}

// ─── TxRow ────────────────────────────────────────────────────────────────────
const TxRow = ({ txn, i, onEdit }) => {
  const [hov, setHov] = useState(false);
  return (
    <div className="fade-up" style={{
      animationDelay: `${i * 25}ms`,
      display: "grid", gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr", gap: 12,
      padding: "10px 16px", borderBottom: "1px solid var(--border)",
      background: hov ? "var(--surface2)" : "transparent", transition: "background 0.12s", cursor: "default",
    }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--muted2)" }}>
        {new Date(txn.date).toLocaleDateString("en-NZ", { day: "2-digit", month: "short" })}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: txn.amount < 0 ? "var(--red)" : "var(--green)", textAlign: "right" }}>
        {txn.amount < 0 ? "−" : "+"}${Math.abs(txn.amount).toFixed(2)}
      </span>
      <span onClick={() => onEdit(txn, "category")} title="Click to edit category" style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: txn.category ? "var(--text)" : "var(--muted2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", padding: "4px 6px", borderRadius: 3, background: "var(--surface)", border: "1px solid var(--border2)" }}>
        {txn.category || "Add category"}
      </span>
      <span onClick={() => onEdit(txn, "description")} title="Click to edit description" style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", padding: "4px 6px", borderRadius: 3, background: "var(--surface)", border: "1px solid var(--border2)" }}>
        {txn.description ? txn.description : <span style={{ color: "var(--muted2)" }}>Add description</span>}
      </span>
      <span style={{ fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--muted)" }}>
        {txn.statement || "—"}
      </span>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [selectedBudgetId, setSelectedBudgetId] = useState(null);

  const handleSelectBudget = (id) => {
    setSelectedBudgetId(id);
    setTab("dashboard");
  };

  const clearSelectedBudget = () => setSelectedBudgetId(null);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "0 32px", display: "flex", alignItems: "center", gap: 36, height: 52, background: "var(--surface)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 24, letterSpacing: "0.1em", color: "var(--accent)" }}>BUDGET</div>
        <nav style={{ display: "flex" }}>
          {["dashboard","transactions","budgets"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "none", border: "none", cursor: "pointer", padding: "0 16px", height: 52,
              fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em",
              color: tab === t ? "var(--text)" : "var(--muted)",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              transition: "color 0.15s",
            }}>{t}</button>
          ))}
        </nav>
        <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>
          {new Date().toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
        </div>
      </header>

      {/* Content */}
      <main style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {selectedBudgetId ? (
              <BudgetDashboard budgetId={selectedBudgetId} onClearBudget={clearSelectedBudget} />
            ) : (
              <>
                <SummaryStats />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 24 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)", marginBottom: 20 }}>Spending by Category</div>
                    <CategoryBars />
                  </div>
                  <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 2, padding: 24 }}>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)", marginBottom: 20 }}>Recent Activity</div>
                    <RecentActivity />
                  </div>
                </div>
              </>
            )}
          </div>
        )}
        {tab === "transactions" && <TransactionsTab />}
        {tab === "budgets" && <BudgetsTab onSelectBudget={handleSelectBudget} />}
      </main>
    </div>
  );
}

const tableHeaderStyle = {
  textAlign: "left",
  padding: "14px 10px",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "var(--muted2)",
};

const tableCellStyle = {
  padding: "14px 10px",
  fontSize: 13,
};
