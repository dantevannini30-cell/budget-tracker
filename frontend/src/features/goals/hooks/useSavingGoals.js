import { useEffect, useState } from "react";

import {
  getSavingGoals,
  getSavingGoalProgress,
  createSavingGoal,
} from "@/api/goals";

export default function useSavingGoals(budgetId) {
  const [goals, setGoals] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "",
  });

  async function loadGoals() {
    if (!budgetId) return;

    try {
      setLoading(true);

      const data = await getSavingGoals(budgetId);

      setGoals(data || []);

      const progressEntries = await Promise.all(
        (data || [])
          .filter((g) => g && (g.id || g._id))
          .map(async (goal) => {
            const id = goal.id || goal._id;

            const p = await getSavingGoalProgress(
              budgetId,
              id
            );

            return [id, p];
          })
      );

      const progressMap = Object.fromEntries(progressEntries);

      setProgress(progressMap);
    } catch (err) {
      console.error("Failed loading goals:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoals();
  }, [budgetId]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await createSavingGoal(budgetId, {
        name: form.name,
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount || 0),
      });

      setForm({
        name: "",
        target_amount: "",
        current_amount: "",
      });

      loadGoals();
    } catch (err) {
      console.error(err);
    }
  }

  return {
    goals,
    progress,
    form,
    setForm,
    handleSubmit,
    reloadGoals: loadGoals,
    loading,
  };
}