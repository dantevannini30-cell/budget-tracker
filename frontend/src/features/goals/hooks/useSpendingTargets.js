import { useEffect, useState } from "react";

import {
  getSpendingTargets,
  getSpendingTargetProgress,
  createSpendingTarget,
} from "@/api/goals";

export default function useSpendingTargets(budgetId) {
  const [targets, setTargets] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    amount: "",
    period: "monthly",
    categories: "",
  });

  async function loadTargets() {
    if (!budgetId) return;

    try {
      setLoading(true);

      const data = await getSpendingTargets(budgetId);

      setTargets(data || []);

      const progressEntries = await Promise.all(
        (data || [])
          .filter((t) => t && (t.id || t._id)) // 👈 important guard
          .map(async (target) => {
            const id = target.id || target._id;

            const p = await getSpendingTargetProgress(
              budgetId,
              id
            );

            return [id, p];
          })
      );

      const progressMap = Object.fromEntries(progressEntries);

      setProgress(progressMap);
    } catch (err) {
      console.error("Failed loading targets:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTargets();
  }, [budgetId]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      await createSpendingTarget(budgetId, {
        name: form.name,
        amount: Number(form.amount),
        period: form.period,
        categories: form.categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
      });

      setForm({
        name: "",
        amount: "",
        period: "monthly",
        categories: "",
      });

      loadTargets();
    } catch (err) {
      console.error(err);
    }
  }

  return {
    targets,
    progress,
    form,
    setForm,
    handleSubmit,
    reloadTargets: loadTargets,
    loading,
  };
}