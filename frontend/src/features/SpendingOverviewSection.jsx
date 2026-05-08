import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { API } from "@/api/constants";
import StatCard from "@/components/StatCard";
import Skel from "@/components/Skel";

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

const PieChartWrapper = ({ data = [], title }) => (
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
        No data
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
                fill={
                  PIE_COLORS[index % PIE_COLORS.length]
                }
              />
            ))}
          </Pie>

          <Tooltip
            formatter={(value) =>
              `$${Number(value).toFixed(2)}`
            }
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
          <span
            style={{
              color:
                PIE_COLORS[i % PIE_COLORS.length],
            }}
          >
            ● {item.name}
          </span>
          <span>
            ${Number(item.value).toFixed(2)}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export default function SpendingOverviewSection({
  startDate,
  endDate,
  onDateChange,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const params = new URLSearchParams();

        if (startDate)
          params.append("start_date", startDate);
        if (endDate)
          params.append("end_date", endDate);

        const res = await fetch(
          `${API}/api/dashboard?${params.toString()}`
        );

        if (!res.ok)
          throw new Error("Failed to load dashboard");

        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [startDate, endDate]);

  const summary = data?.summary ?? [];
  const incomeSummary = data?.income_summary ?? [];
  const incomeData = incomeSummary.map((i) => ({
    name: i.category,
    value: i.total,
  }));

  const spendingData = summary.map((i) => ({
    name: i.category,
    value: i.total,
  }));

  const incomeTotal = incomeSummary.reduce(
    (acc, i) => acc + (i.total || 0),
    0
  );

  const expenseTotal = summary.reduce(
    (acc, i) => acc + (i.total || 0),
    0
  );

  const net = incomeTotal - expenseTotal;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {/* Date Filter Buttons */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--muted2)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Period:
        </span>

        {["Last Week", "Last Month", "Last Year"].map(
          (label) => {
            const now = new Date();
            const today = now
              .toISOString()
              .split("T")[0];

            let start, end;

            if (label === "Last Week") {
              start = new Date(
                now.getTime() -
                  7 * 24 * 60 * 60 * 1000
              )
                .toISOString()
                .split("T")[0];
              end = today;
            } else if (label === "Last Month") {
              start = new Date(
                now.getFullYear(),
                now.getMonth() - 1,
                now.getDate()
              )
                .toISOString()
                .split("T")[0];
              end = today;
            } else {
              start = new Date(
                now.getFullYear() - 1,
                now.getMonth(),
                now.getDate()
              )
                .toISOString()
                .split("T")[0];
              end = today;
            }

            const active =
              startDate === start && endDate === end;

            return (
              <button
                key={label}
                onClick={() =>
                  onDateChange(start, end)
                }
                style={{
                  background: active
                    ? "var(--accent)"
                    : "var(--surface2)",
                  border: active
                    ? "1px solid var(--accent)"
                    : "1px solid var(--border2)",
                  color: active
                    ? "var(--bg)"
                    : "var(--text)",
                  padding: "6px 12px",
                  borderRadius: 2,
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          }
        )}
      </div>

      {/* Stats */}
      {loading ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skel key={i} h={80} />
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <StatCard
            label="In"
            value={`$${incomeTotal.toFixed(2)}`}
            color="var(--green)"
          />
          <StatCard
            label="Out"
            value={`$${expenseTotal.toFixed(2)}`}
            color="var(--red)"
          />
          <StatCard
            label="Net"
            value={`$${net.toFixed(2)}`}
            color={
              net >= 0
                ? "var(--green)"
                : "var(--red)"
            }
          />
          <StatCard
            label="Balance"
            value={`$${net.toFixed(2)}`}
            color="var(--accent)"
          />
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div style={{ display: "flex", gap: 16 }}>
          <Skel h={300} />
          <Skel h={300} />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <PieChartWrapper
            data={incomeData}
            title="Income by Category"
          />
          <PieChartWrapper
            data={spendingData}
            title="Spending by Category"
          />
        </div>
      )}

    </div>
  );
}
