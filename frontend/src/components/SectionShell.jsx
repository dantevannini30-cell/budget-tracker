import { useState } from "react";

import { cardStyle } from "@/shared/styles/ui";

function SummaryPill({ label, value, tone }) {
  const color =
    tone === "good"
      ? "var(--green)"
      : tone === "bad"
        ? "var(--red)"
        : tone === "accent"
          ? "var(--accent)"
          : "var(--text)";

  return (
    <div
      style={{
        border: "1px solid var(--border2)",
        background: "var(--surface2)",
        borderRadius: 4,
        padding: "9px 11px",
        minWidth: 118,
      }}
    >
      <div
        style={{
          color: "var(--muted2)",
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color,
          fontFamily: "var(--font-mono)",
          fontSize: 13,
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default function SectionShell({
  title,
  description,
  summary = [],
  action,
  children,
  defaultExpanded = true,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <section style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 16,
          alignItems: "start",
          padding: "18px 20px",
          borderBottom: expanded ? "1px solid var(--border)" : "none",
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          style={{
            border: "none",
            background: "transparent",
            color: "var(--text)",
            cursor: "pointer",
            textAlign: "left",
            minWidth: 0,
            padding: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
                transition: "transform 0.15s ease",
              }}
            >
              &gt;
            </span>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                lineHeight: 1,
              }}
            >
              {title}
            </span>
          </div>
          {description && (
            <div
              style={{
                color: "var(--muted2)",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginTop: 8,
              }}
            >
              {description}
            </div>
          )}
        </button>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {action}
        </div>
      </div>

      {summary.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(118px, 1fr))",
            gap: 10,
            padding: expanded ? "14px 20px 0" : "0 20px 18px",
          }}
        >
          {summary.map((item) => (
            <SummaryPill
              key={item.label}
              label={item.label}
              value={item.value}
              tone={item.tone}
            />
          ))}
        </div>
      )}

      {expanded && <div style={{ padding: 20 }}>{children}</div>}
    </section>
  );
}
