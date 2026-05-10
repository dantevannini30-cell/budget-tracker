import { useState } from "react";

export default function TransactionRow({
  txn,
  i = 0,
  onEditCategory,
  onUpdateDescription,
  onAcceptCategory,
}) {
  const [hov, setHov] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(txn.description || "");
  const [savingDescription, setSavingDescription] = useState(false);

  const startDescriptionEdit = () => {
    setDescriptionDraft(txn.description || "");
    setEditingDescription(true);
  };

  const cancelDescriptionEdit = () => {
    setDescriptionDraft(txn.description || "");
    setEditingDescription(false);
  };

  const saveDescription = async () => {
    const nextDescription = descriptionDraft.trim();
    const currentDescription = txn.description || "";

    if (nextDescription === currentDescription) {
      setEditingDescription(false);
      return;
    }

    try {
      setSavingDescription(true);
      await onUpdateDescription(txn, nextDescription);
      setEditingDescription(false);
    } finally {
      setSavingDescription(false);
    }
  };

  return (
    <div
      className="fade-up"
      style={{
        animationDelay: `${i * 25}ms`,
        display: "grid",
        gridTemplateColumns: "90px 90px 120px 1.4fr 1.4fr",
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        background: hov ? "var(--surface2)" : "transparent",
        transition: "background 0.12s",
        cursor: "default",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted2)" }}>
        {txn.date?.slice(0, 10) || "-"}
      </span>

      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          color: txn.amount < 0 ? "var(--red)" : "var(--green)",
        }}
      >
        {txn.amount < 0 ? "-" : "+"}${Math.abs(txn.amount).toFixed(2)}
      </span>

      <span
        onClick={() => onEditCategory(txn)}
        style={{
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          color: txn.category ? "var(--text)" : "var(--muted2)",
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: 3,
          background: "var(--surface)",
          border: "1px solid var(--border2)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        <span>{txn.category || "Add category"}</span>
        {txn.category_status === "suggested" && onAcceptCategory && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onAcceptCategory(txn);
            }}
            title="Accept suggested category"
            style={{
              marginLeft: 6,
              border: "none",
              background: "var(--accent)",
              color: "var(--bg)",
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 10,
              padding: "1px 4px",
            }}
          >
            ok
          </button>
        )}
      </span>

      {editingDescription ? (
        <input
          autoFocus
          value={descriptionDraft}
          disabled={savingDescription}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={saveDescription}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              cancelDescriptionEdit();
            }
          }}
          style={{
            minWidth: 0,
            width: "100%",
            fontSize: 12,
            color: "var(--text)",
            padding: "4px 6px",
            borderRadius: 3,
            background: "var(--surface2)",
            border: "1px solid var(--accent)",
          }}
        />
      ) : (
        <button
          type="button"
          onClick={startDescriptionEdit}
          style={{
            minWidth: 0,
            fontSize: 12,
            color: txn.description ? "var(--text)" : "var(--muted2)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            cursor: "text",
            padding: "4px 6px",
            borderRadius: 3,
            background: "var(--surface)",
            border: "1px solid var(--border2)",
            textAlign: "left",
          }}
        >
          {savingDescription ? "Saving..." : txn.description || "Add description"}
        </button>
      )}

      <span style={{ fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
        {txn.statement || "-"}
      </span>
    </div>
  );
}
