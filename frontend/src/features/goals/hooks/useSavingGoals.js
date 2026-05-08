import { useEffect, useState } from "react";

import {
  getSpendingTargets,
  getSpendingTargetProgress,
  createSpendingTarget,
} from "@/api/goals";

export default function useSavingGoals(budgetId) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "",
  });

  useEffect(() => {
    if (!budgetId) return;

    let active = true;

    async function load() {
      try {
        setLoading(true);

        const data = await getSpendingTargets(budgetId);

        const goalsWithProgress = await Promise.all(
          (data || []).map(async (goal) => {
            const id = goal.id ?? goal._id;

            if (!id) {
              return { ...goal, progress: null };
            }

            const progress = await getSpendingTargetProgress(
              budgetId,
              id
            );

            return {
              ...goal,
              progress,
            };
          })
        );

        if (!active) return;

        setGoals(goalsWithProgress);
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

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        name: form.name,
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount || 0),
      };

      const newGoal = await createSpendingTarget(
        budgetId,
        payload
      );

      setGoals((prev) => [newGoal, ...prev]);

      setForm({
        name: "",
        target_amount: "",
        current_amount: "",
      });
    } catch (err) {
      console.error("Failed to create goal:", err);
    }
  };

  return {
    goals,
    form,
    setForm,
    handleSubmit,
    loading,
  };
}