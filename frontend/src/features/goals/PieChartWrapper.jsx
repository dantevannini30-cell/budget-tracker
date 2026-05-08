import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

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

export default function PieChartWrapper({
  data,
  title,
}) {
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
                  fill={
                    PIE_COLORS[
                      index % PIE_COLORS.length
                    ]
                  }
                />
              ))}
            </Pie>

            <Tooltip
              formatter={(value) =>
                `$${value.toFixed(2)}`
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
                  PIE_COLORS[
                    i % PIE_COLORS.length
                  ],
              }}
            >
              ● {item.name}
            </span>

            <span>
              ${item.value.toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}