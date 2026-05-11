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

import CategoryDropdown from "@/components/CategoryDropdown";
import {
  cardStyle,
  inputStyle,
  primaryBtn,
} from "@/shared/styles/ui";

import useDebts from "./useDebts";

const today = () => new Date().toISOString().slice(0, 10);

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatAxisDate(value) {
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-NZ", { day: "numeric", month: "short" });
}

function buildDebtHistory(debt) {
  const startDate = debt.start_date?.slice(0, 10) || today();
  const initialAmount = Number(debt.initial_amount || 0);
  const payments = [
    ...(debt.manual_payments || []).map((payment) => ({
      ...payment,
      kind: "Manual",
      payment_date: payment.payment_date?.slice(0, 10) || startDate,
    })),
    ...(debt.linked_payments || []).map((payment) => ({
      ...payment,
      kind: "Category",
      payment_date: payment.payment_date?.slice(0, 10) || startDate,
    })),
  ].sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

  let paid = 0;
  const points = [
    {
      label: startDate,
      remaining: initialAmount,
      paid,
    },
  ];

  payments.forEach((payment) => {
    paid += Number(payment.amount || 0);
    points.push({
      label: payment.payment_date,
      remaining: Math.max(initialAmount - paid, 0),
      paid,
      kind: payment.kind,
      note: payment.note || payment.statement || payment.description || payment.category || "Payment",
    });
  });

  return points;
}

function DebtProgressChart({ debt }) {
  const data = buildDebtHistory(debt);

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
            formatter={(value, name) => [formatMoney(value), name === "remaining" ? "Remaining" : "Paid"]}
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
            dataKey="remaining"
            stroke="var(--red)"
            strokeWidth={2}
            dot={{ r: 2, strokeWidth: 1 }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="paid"
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

function PaymentForm({ debt, onAddPayment, loading }) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(today());
  const [note, setNote] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    await onAddPayment(debt.id, {
      amount: Number(amount || 0),
      payment_date: paymentDate,
      note,
    });
    setAmount("");
    setPaymentDate(today());
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
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={inputStyle}
        required
      />
      <input
        type="date"
        value={paymentDate}
        onChange={(e) => setPaymentDate(e.target.value)}
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

export default function DebtsSection({
  transactions = [],
  embedded = false,
  createRequest = 0,
}) {
  const {
    debts,
    form,
    setForm,
    handleSubmit,
    handleUpdate,
    handleDelete,
    handleAddPayment,
    handleDeletePayment,
    resetForm,
    loading,
  } = useDebts();

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

  const openEditModal = (debt) => {
    setForm({
      name: debt.name || "",
      initial_amount: String(debt.initial_amount ?? ""),
      category: debt.category || "",
      start_date: (debt.start_date || "").slice(0, 10),
      active: Boolean(debt.active),
    });
    setEditingId(debt.id);
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
            Debts
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
              {editingId ? "Edit Debt" : "Add Debt"}
            </div>

            <input
              placeholder="Debt name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={inputStyle}
              required
            />

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Debt amount"
              value={form.initial_amount}
              onChange={(e) =>
                setForm({ ...form, initial_amount: e.target.value })
              }
              style={inputStyle}
              required
            />

            <CategoryDropdown
              transactions={transactions}
              selectedCategories={form.category ? [form.category] : []}
              onChange={(categories) =>
                setForm({
                  ...form,
                  category: categories[categories.length - 1] || "",
                })
              }
              placeholder="Payment category..."
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
              {loading ? "Saving..." : editingId ? "Save Debt" : "Add Debt"}
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

      <div style={{ display: "flex", flexDirection: "column" }}>
        {debts.length === 0 ? (
          <div
            style={{
              padding: 20,
              color: "var(--muted2)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
            }}
          >
            No debts yet
          </div>
        ) : debts.map((debt) => {
          const pct = Math.min(Number(debt.progress_pct || 0), 100);
          const expanded = expandedId === debt.id;

          return (
            <div
              key={debt.id}
              onClick={() => setExpandedId(expanded ? null : debt.id)}
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                cursor: "pointer",
                opacity: debt.active ? 1 : 0.58,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <div style={{ fontWeight: 600, minWidth: 0 }}>{debt.name}</div>
                <button
                  type="button"
                  aria-label={`Edit ${debt.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditModal(debt);
                  }}
                  style={{
                    width: 28,
                    height: 28,
                    border: "1px solid var(--border2)",
                    borderRadius: 2,
                    background: "var(--surface2)",
                    color: "var(--muted2)",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: "18px",
                    marginLeft: "auto",
                  }}
                >
                  ...
                </button>
              </div>

              <div
                style={{
                  color: "var(--muted2)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  marginBottom: 8,
                }}
              >
                {Math.round(pct)}% paid · {formatMoney(debt.remaining_amount)} left / {formatMoney(debt.initial_amount)}
              </div>

              <div
                style={{
                  height: 12,
                  background: "var(--surface2)",
                  overflow: "hidden",
                  border: "1px solid var(--border2)",
                  borderRadius: 2,
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: "var(--accent)",
                  }}
                />
              </div>

              <div
                style={{
                  color: "var(--muted)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  marginTop: 7,
                  textTransform: "uppercase",
                }}
              >
                {debt.category ? `Category: ${debt.category}` : "Manual payments only"}
                {debt.start_date ? ` · from ${debt.start_date.slice(0, 10)}` : ""}
                {!debt.active ? " · paused" : ""}
              </div>

              {expanded && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    marginTop: 14,
                    paddingTop: 14,
                    borderTop: "1px solid var(--border)",
                    display: "grid",
                    gap: 14,
                  }}
                >
                  <DebtProgressChart debt={debt} />

                  <PaymentForm debt={debt} onAddPayment={handleAddPayment} loading={loading} />

                  {debt.manual_payments.length > 0 && (
                    <div style={{ display: "grid", gap: 6 }}>
                      {debt.manual_payments.map((payment) => (
                        <div
                          key={payment.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "92px 90px 1fr auto",
                            gap: 10,
                            alignItems: "center",
                            color: "var(--muted2)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                          }}
                        >
                          <span>{payment.payment_date?.slice(0, 10)}</span>
                          <span>{formatMoney(payment.amount)}</span>
                          <span>{payment.note || "Manual payment"}</span>
                          <button
                            type="button"
                            onClick={() => handleDeletePayment(debt.id, payment.id)}
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

                  {debt.linked_payments.length > 0 && (
                    <div style={{ display: "grid", gap: 6 }}>
                      {debt.linked_payments.map((payment) => (
                        <div
                          key={payment.id}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "92px 90px minmax(0, 1fr)",
                            gap: 10,
                            color: "var(--muted2)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                          }}
                        >
                          <span>{payment.payment_date?.slice(0, 10)}</span>
                          <span>{formatMoney(payment.amount)}</span>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {payment.statement || payment.description || payment.category}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
