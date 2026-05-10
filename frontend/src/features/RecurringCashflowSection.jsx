import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getRecurringCashflowHistory } from "@/api/recurringCashflow";
import { cardStyle, inputStyle } from "@/shared/styles/ui";

const PERIODS = [
  { value: "weekly", label: "Weekly", count: 12 },
  { value: "monthly", label: "Monthly", count: 12 },
  { value: "yearly", label: "Yearly", count: 5 },
];

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function periodConfig(period) {
  return PERIODS.find((option) => option.value === period) || PERIODS[1];
}

export default function RecurringCashflowSection() {
  const [period, setPeriod] = useState("monthly");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const config = periodConfig(period);
        const result = await getRecurringCashflowHistory({
          period,
          count: config.count,
        });
        if (!cancelled) setData(result);
      } catch (err) {
        console.error("Failed loading recurring cashflow:", err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [period]);

  const points = (data?.points || []).map((point) => ({
    ...point,
    income: Number(point.income || 0),
    expenses: Number(point.expenses || 0),
    net: Number(point.net || 0),
  }));

  return (
    <div style={{ ...cardStyle, padding: 0 }}>
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
        <div style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>
          Recurring Cashflow
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{ ...inputStyle, width: 130 }}
        >
          {PERIODS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ padding: 20, display: "grid", gap: 14 }}>
        <div
          style={{
            height: 280,
            border: "1px solid var(--border2)",
            background: "var(--surface2)",
            padding: "16px 8px 8px",
          }}
        >
          {loading ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted2)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              Loading recurring cashflow...
            </div>
          ) : points.length === 0 ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted2)",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
              }}
            >
              No recurring categories selected yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 4, right: 18, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#6b7a96", fontSize: 10, fontFamily: "DM Mono" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#6b7a96", fontSize: 10, fontFamily: "DM Mono" }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                  tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                />
                <Tooltip
                  formatter={(value, name) => [formatMoney(value), name]}
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.end_date || ""}
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
                  dataKey="expenses"
                  name="Recurring expenses"
                  stroke="var(--red)"
                  strokeWidth={2}
                  dot={{ r: 2, strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  name="Recurring income"
                  stroke="var(--green)"
                  strokeWidth={2}
                  dot={{ r: 2, strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  name="Net"
                  stroke="var(--muted2)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 2, strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div
          style={{
            color: "var(--muted2)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            textTransform: "uppercase",
          }}
        >
          Income: {(data?.income_categories || []).join(", ") || "none selected"} ·
          Expenses: {(data?.recurring_expense_categories || []).join(", ") || "none selected"}
        </div>
      </div>
    </div>
  );
}
