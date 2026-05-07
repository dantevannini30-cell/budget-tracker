import { useState } from "react";
import useApi from "@/hooks/useApi";
import Skel from "@/components/Skel";

const COLORS = [
  "#00d4aa",
  "#0099ff",
  "#ffd166",
  "#ff4d6d",
  "#a78bfa",
  "#fb923c",
  "#34d399",
  "#f472b6",
  "#60a5fa",
  "#facc15",
];

export default function CategoryBars() {
  const { data, loading } = useApi(
    "/api/summary/by-category"
  );

  const [hovered, setHovered] = useState(null);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {[80, 60, 45, 35, 25].map((w, i) => (
          <Skel key={i} w={`${w}%`} h={28} />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p
        style={{
          color: "var(--muted2)",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
        }}
      >
        No data yet
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {data.map((row, i) => (
        <div key={row.category} className="fade-up" style={{ animationDelay: `${i * 55}ms` }}
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: hovered === i ? "var(--text)" : "var(--muted2)", transition: "color 0.15s" }}>
              {row.category}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: COLORS[i % COLORS.length] }}>
              ${row.total} <span style={{ color: "var(--muted)", fontSize: 10 }}>({row.pct}%)</span>
            </span>
          </div>
          <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${row.pct}%`,
              background: COLORS[i % COLORS.length], borderRadius: 2,
              animation: `barGrow 0.8s cubic-bezier(0.16,1,0.3,1) forwards`,
              animationDelay: `${i * 55 + 200}ms`,
              opacity: hovered === i ? 1 : 0.65, transition: "opacity 0.15s",
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}