import { useEffect, useState } from "react";

import {
  getSpendingTargets,
  createSpendingTarget,
  getSpendingTargetProgress,
} from "@/api/goals";

export default function useSavingGoals(budgetId) {
  const [goals, setGoals] = useState([]);
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "",
  });

  // Load goals + progress
  useEffect(() => {
    if (!budgetId) return;

    let active = true;

    async function load() {
      try {
        setLoading(true);

        const [goalData, progressData] = await Promise.all([
          getSpendingTargets(budgetId),
          getSpendingTargetProgress(budgetId),
        ]);

        if (!active) return;

        setGoals(goalData || []);
        setProgress(progressData || []);
      } catch (err) {
        console.error("Failed to load saving goals:", err);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [budgetId]);

  // Create new goal
  const handleSubmit = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    if (!budgetId) return;

    try {
      const payload = {
        budget_id: budgetId,
        name: form.name,
        target_amount: parseFloat(form.target_amount),
        current_amount: parseFloat(form.current_amount || 0),
      };

      const newGoal = await createSpendingTarget(payload);

      setGoals((prev) => [newGoal, ...prev]);

      setForm({
        name: "",
        target_amount: "",
        current_amount: "",
      });
    } catch (err) {
      console.error("Failed to create goal:", err);
      alert(err.message);
    }
  };

  return {
    goals,
    progress,
    form,
    setForm,
    handleSubmit,
    loading,
  };
}