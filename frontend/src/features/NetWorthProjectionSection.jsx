import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getNetWorthProjection } from "@/api/netWorth";
import { cardStyle, inputStyle } from "@/shared/styles/ui";

const PERIODS = [
  { value: "weekly", label: "Weekly", historyWeeks: 6, futureWeeks: 5 },
  { value: "monthly", label: "Monthly", historyWeeks: 23, futureWeeks: 22 },
  { value: "yearly", label: "Yearly", historyWeeks: 261, futureWeeks: 260 },
];

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function getPeriodConfig(period) {
  return PERIODS.find((option) => option.value === period) || PERIODS[1];
}

function formatAxisTick(value, period) {
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  if (period === "yearly") {
    return String(date.getFullYear());
  }

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

function Metric({ label, value, color }) {
  return (
    <div
      style={{
        border: "1px solid var(--border2)",
        background: "var(--surface2)",
        padding: 12,
      }}
    >
      <div
        style={{
          color: "var(--muted2)",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color,
          fontFamily: "var(--font-mono)",
          fontSize: 15,
          fontWeight: 600,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function NetWorthProjectionSection() {
  const [period, setPeriod] = useState("monthly");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProjection() {
      try {
        setLoading(true);
        const config = getPeriodConfig(period);
        const projection = await getNetWorthProjection({
          period,
          historyCount: config.historyWeeks,
          futureCount: config.futureWeeks,
        });
        if (!cancelled) setData(projection);
      } catch (err) {
        console.error("Failed loading net worth projection:", err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProjection();

    return () => {
      cancelled = true;
    };
  }, [period]);

  const points = (data?.points || []).map((point) => ({
    ...point,
    balance: Number(point.balance || 0),
    actualBalance: point.projected ? null : Number(point.balance || 0),
    projectedBalance: point.projected ? Number(point.balance || 0) : null,
  }));
  const firstProjectedIndex = points.findIndex((point) => point.projected);
  if (firstProjectedIndex > 0) {
    points[firstProjectedIndex - 1].projectedBalance = points[firstProjectedIndex - 1].balance;
  }
  const firstProjected = firstProjectedIndex >= 0 ? points[firstProjectedIndex] : null;
  const axisTicks = getAxisTicks(points, period);

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
          Net Worth Projection
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          style={{
            ...inputStyle,
            width: 130,
          }}
        >
          {PERIODS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div style={{ padding: 20, display: "grid", gap: 16 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          <Metric
            label="Current net worth"
            value={loading ? "-" : formatMoney(data?.current_balance)}
            color="var(--accent)"
          />
          <Metric
            label="Account balance"
            value={loading ? "-" : formatMoney(data?.current_account_balance)}
            color="var(--green)"
          />
          <Metric
            label="Investments"
            value={loading ? "-" : formatMoney(data?.current_investment_value)}
            color="var(--accent)"
          />
          <Metric
            label="Debt remaining"
            value={loading ? "-" : formatMoney(data?.current_debt_remaining)}
            color="var(--red)"
          />
          <Metric
            label={`Average ${period} income`}
            value={loading ? "-" : formatMoney(data?.average_income)}
            color="var(--green)"
          />
          <Metric
            label={`Average ${period} spend`}
            value={loading ? "-" : formatMoney(data?.average_spending)}
            color="var(--red)"
          />
          <Metric
            label={`Average ${period} net`}
            value={loading ? "-" : formatMoney(data?.average_net)}
            color={Number(data?.average_net || 0) >= 0 ? "var(--green)" : "var(--red)"}
          />
          <Metric
            label="Projected weekly net"
            value={loading ? "-" : formatMoney(data?.weekly_net)}
            color={Number(data?.weekly_net || 0) >= 0 ? "var(--green)" : "var(--red)"}
          />
        </div>

        <div
          style={{
            height: 300,
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
              Loading projection...
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
                textAlign: "center",
                padding: 20,
              }}
            >
              No balance history found yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 4, right: 18, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="end_date"
                  ticks={axisTicks}
                  tickFormatter={(value) => formatAxisTick(value, period)}
                  tick={{ fill: "#6b7a96", fontSize: 10, fontFamily: "DM Mono" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fill: "#6b7a96", fontSize: 10, fontFamily: "DM Mono" }}
                  axisLine={false}
                  tickLine={false}
                  width={68}
                  tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
                />
                <Tooltip
                  formatter={(value) => [formatMoney(value), "Balance"]}
                  labelFormatter={(_, payload) => {
                    const point = payload?.[0]?.payload;
                    return point?.projected
                      ? `${point.end_date} projected`
                      : point?.end_date || "";
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
                {firstProjected && (
                  <ReferenceLine
                    x={firstProjected.end_date}
                    stroke="var(--muted2)"
                    strokeDasharray="4 4"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="actualBalance"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 2, strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="projectedBalance"
                  stroke="var(--muted2)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 2, strokeWidth: 1 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                  connectNulls={false}
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
          Recurring excluded: {(data?.recurring_expense_categories || []).join(", ") || "none selected"}
        </div>
      </div>
    </div>
  );
}
