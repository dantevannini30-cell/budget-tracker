import GoalProgressChart from "./GoalProgressChart";

import useSpendingTargets from "./hooks/useSpendingTargets";

import { buildSpendingTargetChartData } from "./utils/chartUtils";

import {
  cardStyle,
  inputStyle,
  primaryBtn,
} from "@/shared/styles/ui";

export default function SpendingTargetsSection({
  budgetId,
}) {
  const {
    targets,
    progress,
    form,
    setForm,
    handleSubmit,
    loading,
  } = useSpendingTargets(budgetId);

  const chartData =
    buildSpendingTargetChartData(
      targets,
      progress
    );

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

        <button type="submit" style={primaryBtn} disabled={loading}>
          {loading ? "Adding..." : "Add Spending Target"}
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
                          background: "#ff4d6d",
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