export default function StatCard({
  label,
  value,
  sub,
  accent,
  delay = 0,
}) {
  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${delay}ms`,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderTop: `2px solid ${
          accent ? "var(--accent)" : "var(--border)"
        }`,
        padding: "20px 24px",
        borderRadius: 2,
        flex: 1,
        minWidth: 150,
      }}
    >
      <div
        style={{
          color: "var(--muted2)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          fontFamily: "var(--font-mono)",
          marginBottom: 10,
        }}
      >
        {label}
      </div>

      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 38,
          letterSpacing: "0.02em",
          color: accent ? "var(--accent)" : "var(--text)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      {sub && (
        <div
          style={{
            color: "var(--muted2)",
            fontSize: 11,
            marginTop: 6,
            fontFamily: "var(--font-mono)",
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}