import { useState } from "react";

export default function CreateBudgetModal({
  onClose,
  onSubmit,
  saving,
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] =
    useState("");

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: 24,
        }}
      >
        <div
          style={{
            fontFamily:
              "var(--font-display)",
            fontSize: 32,
            marginBottom: 4,
          }}
        >
          Create Budget
        </div>

        <div
          style={{
            color: "var(--muted2)",
            fontFamily:
              "var(--font-mono)",
            fontSize: 11,
            marginBottom: 20,
          }}
        >
          Start a new budgeting period
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div>
            <div
              style={{
                marginBottom: 6,
                fontSize: 10,
                textTransform:
                  "uppercase",
                letterSpacing: "0.1em",
                color: "var(--muted2)",
                fontFamily:
                  "var(--font-mono)",
              }}
            >
              Budget Name
            </div>

            <input
              value={name}
              onChange={(e) =>
                setName(e.target.value)
              }
              placeholder="e.g. Semester 2 Budget"
              style={inputStyle}
            />
          </div>

          <div>
            <div
              style={{
                marginBottom: 6,
                fontSize: 10,
                textTransform:
                  "uppercase",
                letterSpacing: "0.1em",
                color: "var(--muted2)",
                fontFamily:
                  "var(--font-mono)",
              }}
            >
              Start Date
            </div>

            <input
              type="date"
              value={startDate}
              onChange={(e) =>
                setStartDate(
                  e.target.value
                )
              }
              style={inputStyle}
            />
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 12,
            }}
          >
            <button
              onClick={() =>
                onSubmit({
                  name,
                  start_date:
                    startDate,
                })
              }
              disabled={
                !name ||
                !startDate ||
                saving
              }
              style={primaryBtn}
            >
              {saving
                ? "Creating..."
                : "Create"}
            </button>

            <button
              onClick={onClose}
              style={secondaryBtn}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "var(--surface2)",
  border: "1px solid var(--border2)",
  borderRadius: 2,
  padding: "10px 12px",
  color: "var(--text)",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
};

const primaryBtn = {
  flex: 1,
  background: "var(--accent)",
  color: "var(--bg)",
  border: "none",
  borderRadius: 2,
  padding: "10px 14px",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
};

const secondaryBtn = {
  flex: 1,
  background: "transparent",
  color: "var(--text)",
  border: "1px solid var(--border2)",
  borderRadius: 2,
  padding: "10px 14px",
  cursor: "pointer",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase",
};