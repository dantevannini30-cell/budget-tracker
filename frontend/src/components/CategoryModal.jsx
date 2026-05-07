import { useState } from "react";

export default function CategoryModal({
  transactions,
  onSubmit,
  onClose,
}) {
  const [editValue, setEditValue] = useState("");

  const allCategories = [
    ...new Set(
      transactions.map((t) => t.category).filter(Boolean)
    ),
  ].sort();

  const filteredCategories = editValue.trim()
    ? allCategories.filter((cat) =>
        cat.toLowerCase().includes(editValue.toLowerCase())
      )
    : allCategories;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 24,
          width: "100%",
          maxWidth: 300,
          boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 12,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--muted2)",
            marginBottom: 16,
          }}
        >
          Select or create category
        </div>

        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder="Type or search category..."
          autoFocus
          style={{
            width: "100%",
            background: "var(--surface2)",
            border: "1px solid var(--border2)",
            borderRadius: 2,
            padding: "10px 12px",
            color: "var(--text)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            marginBottom: 12,
            boxSizing: "border-box",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && editValue.trim()) {
              onSubmit(editValue.trim());
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
        />

        <div
          style={{
            maxHeight: 200,
            overflowY: "auto",
            marginBottom: 12,
            border: "1px solid var(--border2)",
            borderRadius: 2,
          }}
        >
          {filteredCategories.length === 0 && editValue.trim() ? (
            <div
              style={{
                padding: "12px",
                color: "var(--text)",
                fontSize: 12,
                background: "var(--surface2)",
                cursor: "pointer",
              }}
              onClick={() => onSubmit(editValue.trim())}
            >
              + Create "{editValue.trim()}"
            </div>
          ) : filteredCategories.length === 0 ? (
            <div
              style={{
                padding: "12px",
                color: "var(--muted2)",
                fontSize: 11,
                textAlign: "center",
              }}
            >
              No categories
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <div
                key={cat}
                style={{
                  padding: "10px 12px",
                  color: "var(--text)",
                  fontSize: 12,
                  borderBottom: "1px solid var(--border2)",
                  cursor: "pointer",
                  background: "transparent",
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
                onClick={() => onSubmit(cat)}
              >
                {cat}
              </div>
            ))
          )}
        </div>

        {editValue.trim() &&
          !filteredCategories.includes(editValue.trim()) && (
            <button
              onClick={() => onSubmit(editValue.trim())}
              style={{
                width: "100%",
                background: "var(--accent)",
                color: "var(--bg)",
                border: "none",
                borderRadius: 2,
                padding: "10px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Create "{editValue.trim()}"
            </button>
          )}

        <button
          onClick={onClose}
          style={{
            width: "100%",
            background: "var(--surface2)",
            color: "var(--text)",
            border: "1px solid var(--border2)",
            borderRadius: 2,
            padding: "10px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            cursor: "pointer",
            marginTop: 8,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}