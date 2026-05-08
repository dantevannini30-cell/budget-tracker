import { useState } from "react";
const SORT_OPTIONS = [
  { key: "date_desc",   label: "Date (newest first)" },
  { key: "date_asc",    label: "Date (oldest first)" },
  { key: "amount_desc", label: "Amount (highest first)" },
  { key: "amount_asc",  label: "Amount (lowest first)" },
];

export default function SortDropdown({
  value,
  onChange,
}) {
  const [open, setOpen] = useState(false);

  const active = value !== "date_desc";

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: active ? "var(--accent)" : "var(--surface2)",
        color: active ? "var(--bg)" : "var(--muted2)",
        border: "1px solid var(--border2)", borderRadius: 2,
        padding: "7px 14px", fontFamily: "var(--font-mono)", fontSize: 10,
        cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
        display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
      }}>
        Sort
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
            background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 4,
            minWidth: 210, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
          }}>
            {SORT_OPTIONS.map(opt => (
              <div key={opt.key} onClick={() => { onChange(opt.key); setOpen(false); }} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", cursor: "pointer", transition: "background 0.1s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{
                  width: 14, height: 14, borderRadius: "50%",
                  border: `1px solid ${value === opt.key ? "var(--accent)" : "var(--border2)"}`,
                  background: value === opt.key ? "var(--accent)" : "transparent",
                  flexShrink: 0, transition: "all 0.1s",
                }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{opt.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
