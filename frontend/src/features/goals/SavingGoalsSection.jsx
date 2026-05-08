import GoalProgressChart from "./GoalProgressChart";
import useSavingGoals from "./hooks/useSavingGoals";
import { buildSavingGoalChartData } from "./utils/chartUtils";

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
    loading,
  } = useSavingGoals(budgetId);

  const chartData =
    buildSavingGoalChartData(
      goals
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

        <button type="submit" style={primaryBtn} disabled={loading}>
          {loading ? "Adding..." : "Add Saving Goal"}
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
          const current = goal.current_amount || 0;
          const target = goal.target_amount || 0;
          const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

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
                  marginBottom: 12,
                }}
              >
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
                  ${current.toFixed(2)} / ${target.toFixed(2)}
                </div>
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
                    background: "#00d4aa",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  color: "var(--muted2)",
                }}
              >
                {pct.toFixed(1)}% complete
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
