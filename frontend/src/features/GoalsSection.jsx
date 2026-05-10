import { useEffect, useState } from "react";

import { API } from "@/api/constants";
import SectionShell from "@/components/SectionShell";
import SavingGoalsSection from "@/features/goals/SavingGoalsSection";
import SpendingTargetsSection from "@/features/goals/SpendingTargetsSection";
import useSavingGoals from "@/features/goals/hooks/useSavingGoals";
import useSpendingTargets from "@/features/goals/hooks/useSpendingTargets";

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function averageProgress(items, currentKey, targetKey) {
  if (!items.length) return 0;
  const total = items.reduce((sum, item) => {
    const target = Number(item[targetKey] || 0);
    const current = Number(item[currentKey] || 0);
    return sum + (target > 0 ? Math.min((current / target) * 100, 100) : 0);
  }, 0);
  return Math.round(total / items.length);
}

export default function GoalsSection() {
  const [transactions, setTransactions] = useState([]);
  const [targetCreateRequest, setTargetCreateRequest] = useState(0);
  const [goalCreateRequest, setGoalCreateRequest] = useState(0);
  const { targets } = useSpendingTargets();
  const { goals } = useSavingGoals();

  useEffect(() => {
    let cancelled = false;

    async function loadTransactions() {
      try {
        const res = await fetch(`${API}/api/transactions`);
        if (!res.ok) throw new Error("Failed to load transactions");
        const data = await res.json();
        if (!cancelled) setTransactions(data || []);
      } catch (err) {
        console.error("Failed loading transactions for goals:", err);
        if (!cancelled) setTransactions([]);
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, []);

  const targetOvers = targets.filter((target) => target.is_over).length;
  const targetBudgeted = targets.reduce(
    (sum, target) => sum + Number(target.amount || 0),
    0
  );
  const savedTotal = goals.reduce(
    (sum, goal) => sum + Number(goal.current_amount || 0),
    0
  );
  const savingProgress = averageProgress(goals, "current_amount", "target_amount");

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <SectionShell
        title="Spending Targets"
        description="Budget guardrails and historical performance"
        summary={[
          { label: "Targets", value: targets.length },
          { label: "Budgeted", value: formatMoney(targetBudgeted), tone: "accent" },
          { label: "Over", value: targetOvers, tone: targetOvers > 0 ? "bad" : "good" },
        ]}
        action={
          <button
            type="button"
            onClick={() => setTargetCreateRequest((value) => value + 1)}
            style={{
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 4,
              padding: "8px 11px",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Add
          </button>
        }
      >
        <SpendingTargetsSection
          transactions={transactions}
          embedded
          createRequest={targetCreateRequest}
        />
      </SectionShell>

      <SectionShell
        title="Saving Goals"
        description="Progress, account history, and future momentum"
        defaultExpanded={false}
        summary={[
          { label: "Goals", value: goals.length },
          { label: "Saved", value: formatMoney(savedTotal), tone: "accent" },
          { label: "Avg progress", value: `${savingProgress}%`, tone: "good" },
        ]}
        action={
          <button
            type="button"
            onClick={() => setGoalCreateRequest((value) => value + 1)}
            style={{
              background: "var(--accent)",
              color: "var(--bg)",
              border: "none",
              borderRadius: 4,
              padding: "8px 11px",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Add
          </button>
        }
      >
        <SavingGoalsSection embedded createRequest={goalCreateRequest} />
      </SectionShell>
    </div>
  );
}
