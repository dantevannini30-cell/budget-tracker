import { useState } from "react";

function FilterItem({ label, checked, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 14px",
        cursor: "pointer",
        transition: "background 0.1s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background =
          "var(--surface2)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background =
          "transparent")
      }
    >
      <div
        style={{
          width: 14,
          height: 14,
          border: `1px solid ${
            checked ? "var(--accent)" : "var(--border2)"
          }`,
          borderRadius: 2,
          background: checked
            ? "var(--accent)"
            : "transparent",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          transition: "all 0.1s",
        }}
      >
        {checked && (
          <svg
            width="9"
            height="7"
            viewBox="0 0 9 7"
            fill="none"
          >
            <path
              d="M1 3.5L3.5 6L8 1"
              stroke="var(--bg)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export default function FilterDropdown({
  filters,
  onChange,
}) {
  const [open, setOpen] = useState(false);

  const activeCount = [
    !filters.showIn,
    !filters.showOut,
    !filters.showCategorised,
    !filters.showUncategorised,
  ].filter(Boolean).length;

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)} style={{
        background: activeCount > 0 ? "var(--accent)" : "var(--surface2)",
        color: activeCount > 0 ? "var(--bg)" : "var(--muted2)",
        border: "1px solid var(--border2)", borderRadius: 2,
        padding: "7px 14px", fontFamily: "var(--font-mono)", fontSize: 10,
        cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.1em",
        display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s",
      }}>
        Filter{activeCount > 0 ? ` (${activeCount})` : ""}
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
            minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
          }}>
            <div style={{ padding: "8px 14px 4px", fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>Direction</div>
            <FilterItem label="Money in" checked={filters.showIn} onToggle={() => onChange({ ...filters, showIn: !filters.showIn })} />
            <FilterItem label="Money out" checked={filters.showOut} onToggle={() => onChange({ ...filters, showOut: !filters.showOut })} />
            <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
            <div style={{ padding: "8px 14px 4px", fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted)" }}>Category</div>
            <FilterItem label="Categorised" checked={filters.showCategorised} onToggle={() => onChange({ ...filters, showCategorised: !filters.showCategorised })} />
            <FilterItem label="Uncategorised" checked={filters.showUncategorised} onToggle={() => onChange({ ...filters, showUncategorised: !filters.showUncategorised })} />
            {activeCount > 0 && (
              <>
                <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />
                <div onClick={() => { onChange({ showIn: true, showOut: true, showCategorised: true, showUncategorised: true }); setOpen(false); }}
                  style={{ padding: "9px 14px", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--surface2)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  Reset filters
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
