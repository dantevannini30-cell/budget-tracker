import GoalProgressChart from "./GoalProgressChart";
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
    loading,
  } = useSpendingTargets(budgetId);

  // backend already provides everything → NO LOOKUPS
  const chartData = targets.map((t) => ({
    name: t.name,
    target: t.amount,
    current: t.current_spent || 0,
  }));

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

      {/* FORM */}
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
          {loading ? "Adding..." : "Add Spending Target"}
        </button>
      </form>

      {/* CHART */}
      <GoalProgressChart
        title="Spending Progress"
        data={chartData}
        color="#ff4d6d"
      />

      {/* LIST */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 20,
        }}
      >
        {targets.map((target) => {
          const pct = target.progress_pct || 0;

          return (
            <div
              key={target.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: 16,
              }}
            >
              <div style={{ marginBottom: 12 }}>
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

              {/* SINGLE SOURCE OF TRUTH */}
              <div style={{ marginBottom: 6, fontSize: 12 }}>
                ${target.current_spent || 0} / ${target.amount}
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
                    background: target.is_over ? "#ff4d6d" : "#00d4aa",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}