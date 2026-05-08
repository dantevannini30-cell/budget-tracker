import useApi from "@/hooks/useApi";
import Skel from "@/components/Skel";

export default function RecentActivity() {
  const { data, loading } = useApi("/api/transactions");

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Skel
            key={i}
            w={`${55 + Math.random() * 35}%`}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {(data || []).slice(0, 9).map((txn, i) => (
          <div key={txn.id} className="fade-up" style={{
            animationDelay: `${i * 35}ms`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "9px 0", borderBottom: "1px solid var(--border)",
          }}>
            <div style={{ overflow: "hidden", paddingRight: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
                {txn.description}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                {txn.date?.slice(0, 10)}
              </div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, flexShrink: 0, color: txn.amount < 0 ? "var(--red)" : "var(--green)" }}>
              {txn.amount < 0 ? "−" : "+"}${Math.abs(txn.amount).toFixed(2)}
            </span>
          </div>
        ))}
    </div>
  );
}