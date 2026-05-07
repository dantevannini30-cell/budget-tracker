import { useState, useEffect } from "react";

import { API } from "@/api/constants";

import Skel from "@/components/Skel";
import CreateBudgetModal from "@/components/modals/CreateBudgetModal";

import {
  getBudgets,
  createBudget,
  deleteBudget,
} from "@/api/budgets";

import useSavingGoals from "./goals/hooks/useSavingGoals";

export default function BudgetsTab({ onSelectBudget }) {
  const [budgets, setBudgets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [showModal, setShowModal] = useState(false); // ✅ MOVE HERE
  
  const handleCreateBudget = async (payload) => {
    setSaving(true);

    try {
      const budget = await createBudget(payload);

      setBudgets((prev) =>
        prev ? [budget, ...prev] : [budget]
      );

      setShowModal(false);
      setMessage(`Created ${budget.name}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };
  useEffect(() => {
    let active = true;

    setLoading(true);

    getBudgets()
      .then((data) => {
        if (!active) return;
        setBudgets(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      active = false;
    };
  }, []);

  return (
    
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      {showModal && (
      <CreateBudgetModal
        saving={saving}
        onClose={() =>
          setShowModal(false)
        }
        onSubmit={
          handleCreateBudget
        }
      />
    )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--muted2)" }}>Budgets</div>
          <div style={{ marginTop: 4, fontSize: 24, fontFamily: "var(--font-display)" }}>Saved budget periods</div>
        </div>
        <button onClick={() => setShowModal(true)} disabled={saving} style={{
          background: "var(--accent)", color: "var(--bg)", border: "none",
          borderRadius: 2, padding: "10px 18px", cursor: "pointer",
          fontFamily: "var(--font-mono)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em"
        }}>
          {saving ? "Saving..." : "New budget"}
        </button>
      </div>

      {message && <div style={{ color: "var(--accent)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{message}</div>}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1,2,3].map(i => <Skel key={i} h={18} />)}
        </div>
      ) : !budgets?.length ? (
        <p style={{ color: "var(--muted2)", fontFamily: "var(--font-mono)", fontSize: 12 }}>No budgets yet. Create one to store transactions from a start date.</p>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 140px 120px", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontFamily: "var(--font-mono)", fontSize: 10, textTransform: "uppercase" }}>
            <span>Budget ID</span>
            <span>Start date</span>
            <span>Created</span>
            <span style={{ textAlign: "right" }}>Transactions</span>
          </div>
          {budgets.map((budget, index) => (
            <div key={budget.id} onClick={() => onSelectBudget(budget.id)} style={{ cursor: "pointer", display: "grid", gridTemplateColumns: "1fr 120px 140px 120px", gap: 12, padding: "12px 0", borderBottom: index + 1 === budgets.length ? "none" : "1px solid var(--border)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{budget.id}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{budget.start_date}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11 }}>{budget.created_at.slice(0, 10)}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, textAlign: "right" }}>{budget.transaction_count}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}