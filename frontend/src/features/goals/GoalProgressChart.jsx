import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function GoalProgressChart({
  title,
  data,
  color,
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border:
          "1px solid var(--border)",
        borderRadius: 2,
        padding: 20,
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontFamily:
            "var(--font-mono)",
          textTransform:
            "uppercase",
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
            fontFamily:
              "var(--font-mono)",
            fontSize: 12,
            padding: "24px 0",
          }}
        >
          No goals yet
        </div>
      ) : (
        <ResponsiveContainer
          width="100%"
          height={260}
        >
          <BarChart
            data={data}
            barGap={-28}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
            />

            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#6b7a96",
                fontSize: 10,
                fontFamily:
                  "DM Mono",
              }}
            />

            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{
                fill: "#6b7a96",
                fontSize: 10,
                fontFamily:
                  "DM Mono",
              }}
            />

            <Tooltip
              formatter={(v) =>
                `$${Number(v).toFixed(2)}`
              }
              contentStyle={{
                background:
                  "var(--surface2)",
                border:
                  "1px solid var(--border)",
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