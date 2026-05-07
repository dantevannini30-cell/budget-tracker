import { useEffect, useState } from "react";

import {
  getSpendingTargets,
  getSpendingTargetProgress,
  createSpendingTarget,
} from "@/api/goals";

export default function useSpendingTargets(
  budgetId
) {
  const [targets, setTargets] = useState([]);
  const [progress, setProgress] = useState({});

  const [form, setForm] = useState({
    name: "",
    amount: "",
    period: "monthly",
    categories: "",
  });

  async function loadTargets() {
    try {
      const data = await getSpendingTargets(
        budgetId
      );

      setTargets(data);

      const progressMap = {};

      for (const target of data) {
        progressMap[target.id] =
          await getSpendingTargetProgress(
            budgetId,
            target.id
          );
      }

      setProgress(progressMap);
    } catch (err) {
      console.error(err);
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
  };
}