import { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  cardStyle,
  inputStyle,
  primaryBtn,
} from "@/shared/styles/ui";

import useInvestments from "./useInvestments";

const today = () => new Date().toISOString().slice(0, 10);

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatAxisDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

function buildInvestmentHistory(investment) {
  return [...(investment.values || [])]
    .sort((a, b) => new Date(a.value_date) - new Date(b.value_date))
    .map((value) => ({
      label: value.value_date?.slice(0, 10) || "",
      amount: Number(value.amount || 0),
      source: value.source || "manual",
      note: value.note || "Value update",
    }));
}

function InvestmentValueChart({ investment }) {
  const data = buildInvestmentHistory(investment);

  if (data.length === 0) {
    return (
      <div
        style={{
          height: 150,
          border: "1px solid var(--border2)",
          background: "var(--surface2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted2)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
        }}
      >
        Add a value to start charting this investment
      </div>
    );
  }

  return (
    <div
      style={{
        height: 190,
        border: "1px solid var(--border2)",
        background: "var(--surface2)",
        padding: "14px 8px 8px",
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 18, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="label"
            tickFormatter={formatAxisDate}
            tick={{ fill: "#6b7a96", fontSize: 10, fontFamily: "DM Mono" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: "#6b7a96", fontSize: 10, fontFamily: "DM Mono" }}
            axisLine={false}
            tickLine={false}
            width={58}
            tickFormatter={(value) => `$${Number(value).toFixed(0)}`}
          />
          <Tooltip
            formatter={(value) => [formatMoney(value), "Value"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 2,
              color: "var(--text)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
            }}
          />
          <Line
            type="monotone"
            dataKey="amount"
            stroke="var(--accent)"
            strokeWidth={2}
            dot={{ r: 2, strokeWidth: 1 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ValueForm({ investment, onAddValue, loading }) {
  const [amount, setAmount] = useState("");
  const [valueDate, setValueDate] = useState(today());
  const [note, setNote] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    await onAddValue(investment.id, {
      amount: Number(amount || 0),
      value_date: valueDate,
      note,
      source: "manual",
    });
    setAmount("");
    setValueDate(today());
    setNote("");
  };

  return (
    <form
      onSubmit={submit}
      style={{
        display: "grid",
        gridTemplateColumns: "120px 150px minmax(0, 1fr) auto",
        gap: 8,
      }}
    >
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="Value"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={inputStyle}
        required
      />
      <input
        type="date"
        value={valueDate}
        onChange={(e) => setValueDate(e.target.value)}
        style={inputStyle}
        required
      />
      <input
        placeholder="Note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={inputStyle}
      />
      <button type="submit" style={primaryBtn} disabled={loading}>
        Add
      </button>
    </form>
  );
}

export default function InvestmentsSection({
  embedded = false,
  createRequest = 0,
}) {
  const {
    investments,
    form,
    setForm,
    handleSubmit,
    handleUpdate,
    handleDelete,
    handleAddValue,
    handleDeleteValue,
    resetForm,
    loading,
  } = useInvestments();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const lastCreateRequestRef = useRef(createRequest);

  const openCreateModal = () => {
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  };

  useEffect(() => {
    if (createRequest === lastCreateRequestRef.current) return;
    lastCreateRequestRef.current = createRequest;
    resetForm();
    setEditingId(null);
    setModalOpen(true);
  }, [createRequest, resetForm]);

  const openEditModal = (investment) => {
    setForm({
      name: investment.name || "",
      type: investment.type || "",
      start_date: (investment.start_date || "").slice(0, 10),
      active: Boolean(investment.active),
    });
    setEditingId(investment.id);
    setModalOpen(true);
  };

  const closeModal = () => {
    resetForm();
    setEditingId(null);
    setModalOpen(false);
  };

  const submitAndClose = async (e) => {
    e.preventDefault();

    if (editingId) {
      await handleUpdate(editingId);
    } else {
      await handleSubmit(e);
    }

    closeModal();
  };

  const deleteAndClose = async () => {
    if (!editingId) return;
    await handleDelete(editingId);
    closeModal();
  };

  const selectedInvestment = investments.find((investment) => investment.id === expandedId);

  return (
    <div style={{ ...(embedded ? {} : cardStyle), padding: 0 }}>
      {!embedded && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ fontFamily: "var(--font-display)", fontSize: 28 }}>
            Investments
          </div>

          <button type="button" onClick={openCreateModal} style={primaryBtn}>
            Add
          </button>
        </div>
      )}

      {modalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.58)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <form
            onSubmit={submitAndClose}
            onClick={(e) => e.stopPropagation()}
            style={{
              ...cardStyle,
              width: "100%",
              maxWidth: 440,
              padding: 22,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              boxShadow: "0 18px 48px rgba(0,0,0,0.42)",
            }}
          >
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close"
              style={{
                position: "absolute",
                top: 10,
                right: 10,
                width: 28,
                height: 28,
                border: "1px solid var(--border2)",
                borderRadius: 2,
                background: "var(--surface2)",
                color: "var(--muted2)",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: "24px",
              }}
            >
              x
            </button>

            <div style={{ fontFamily: "var(--font-display)", fontSize: 24 }}>
              {editingId ? "Edit Investment" : "Add Investment"}
            </div>

            <input
              placeholder="Investment name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
              required
            />

            <input
              placeholder="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              style={inputStyle}
            />

            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              style={inputStyle}
              required
            />

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: "var(--muted2)",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            >
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>

            <button type="submit" style={primaryBtn} disabled={loading}>
              {loading ? "Saving..." : editingId ? "Save Investment" : "Add Investment"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={deleteAndClose}
                style={{
                  ...primaryBtn,
                  background: "transparent",
                  color: "var(--red)",
                  border: "1px solid var(--border2)",
                }}
                disabled={loading}
              >
                Delete
              </button>
            )}
          </form>
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {investments.length === 0 ? (
          <div
            style={{
              padding: 20,
              color: "var(--muted2)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            No investments yet
          </div>
        ) : (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {investments.map((investment) => {
                const selected = expandedId === investment.id;

                return (
                  <div
                    key={investment.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(selected ? null : investment.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setExpandedId(selected ? null : investment.id);
                      }
                    }}
                    style={{
                      border: selected ? "1px solid var(--accent)" : "1px solid var(--border2)",
                      borderTop: selected ? "2px solid var(--accent)" : "1px solid var(--border2)",
                      background: "var(--surface2)",
                      borderRadius: 6,
                      padding: "15px 16px",
                      minWidth: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      opacity: investment.active ? 1 : 0.58,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          color: "var(--muted2)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {investment.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Edit ${investment.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(investment);
                        }}
                        style={{
                          width: 28,
                          height: 28,
                          border: "1px solid var(--border2)",
                          borderRadius: 2,
                          background: "var(--surface)",
                          color: "var(--muted2)",
                          cursor: "pointer",
                          fontSize: 18,
                          lineHeight: "24px",
                          marginLeft: "auto",
                          textAlign: "center",
                          flexShrink: 0,
                        }}
                      >
                        ...
                      </button>
                    </div>

                    <div
                      style={{
                        color: "var(--accent)",
                        fontFamily: "var(--font-display)",
                        fontSize: 34,
                        lineHeight: 1,
                      }}
                    >
                      {formatMoney(investment.latest_value)}
                    </div>

                    <div
                      style={{
                        color: "var(--muted)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        marginTop: 8,
                        textTransform: "uppercase",
                      }}
                    >
                      {investment.type || "Investment"}
                      {investment.latest_value_date ? ` from ${investment.latest_value_date.slice(0, 10)}` : " no values yet"}
                      {!investment.active ? " paused" : ""}
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedInvestment && (
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  borderTop: "1px solid var(--border)",
                  padding: "16px 0 0",
                  display: "grid",
                  gap: 14,
                }}
              >
                <InvestmentValueChart investment={selectedInvestment} />

                <ValueForm
                  investment={selectedInvestment}
                  onAddValue={handleAddValue}
                  loading={loading}
                />

                {selectedInvestment.values.length > 0 && (
                  <div style={{ display: "grid", gap: 6 }}>
                    {selectedInvestment.values.map((value) => (
                      <div
                        key={value.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "92px 90px 80px 1fr auto",
                          gap: 10,
                          alignItems: "center",
                          color: "var(--muted2)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                        }}
                      >
                        <span>{value.value_date?.slice(0, 10)}</span>
                        <span>{formatMoney(value.amount)}</span>
                        <span>{value.source || "manual"}</span>
                        <span>{value.note || "Value update"}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteValue(selectedInvestment.id, value.id)}
                          style={{
                            border: "1px solid var(--border2)",
                            background: "var(--surface2)",
                            color: "var(--red)",
                            cursor: "pointer",
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            padding: "4px 8px",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
