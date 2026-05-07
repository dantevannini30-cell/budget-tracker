import useApi from "@/hooks/useApi";
import Skel from "@/components/Skel";
import StatCard from "@/components/StatCard";

export default function SummaryStats() {
  const { data, loading } = useApi("/api/transactions");

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: 1,
              minWidth: 150,
              height: 100,
            }}
          >
            <Skel h={100} />
          </div>
        ))}
      </div>
    );
  }

  if (!data?.length) return null;

  const expenses = data.filter((t) => t.amount < 0);
  const income = data.filter((t) => t.amount > 0);

  const totalSpent = expenses.reduce(
    (s, t) => s + Math.abs(t.amount),
    0
  );

  const totalIn = income.reduce(
    (s, t) => s + t.amount,
    0
  );

  const net = totalIn - totalSpent;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <StatCard
        label="Total Spent"
        value={`$${totalSpent.toFixed(0)}`}
        sub={`${expenses.length} transactions`}
      />

      <StatCard
        label="Total In"
        value={`$${totalIn.toFixed(0)}`}
        sub={`${income.length} transactions`}
      />

      <StatCard
        label="Net"
        value={`${
          net >= 0 ? "+" : ""
        }$${Math.abs(net).toFixed(0)}`}
        sub={net >= 0 ? "surplus" : "deficit"}
        accent={net >= 0}
      />

      <StatCard
        label="Loaded"
        value={data.length}
        sub="recent transactions"
      />
    </div>
  );
}