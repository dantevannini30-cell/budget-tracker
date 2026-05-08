import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  getSavingGoals,
  getSavingGoalProgress,
  createSavingGoal,
} from "@/api/goals";

export default function useSavingGoals() {
  const [goals, setGoals] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "",
  });

  // prevents stale async overwrites
  const requestIdRef = useRef(0);

  const loadGoals = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);

      const data = await getSavingGoals();

      // ignore stale response
      if (requestId !== requestIdRef.current) {
        return;
      }

      const safeGoals = data || [];

      setGoals(safeGoals);

      // load all progress in parallel
      const progressEntries = await Promise.all(
        safeGoals
          .filter((g) => g?.id || g?._id)
          .map(async (goal) => {
            const id = goal.id || goal._id;

            const p =
              await getSavingGoalProgress(id);

            return [id, p];
          })
      );

      if (requestId !== requestIdRef.current) {
        return;
      }

      setProgress(
        Object.fromEntries(progressEntries)
      );
    } catch (err) {
      console.error(
        "Failed loading saving goals:",
        err
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);

      const newGoal = await createSavingGoal({
        name: form.name,
        target_amount: Number(
          form.target_amount
        ),
        current_amount: Number(
          form.current_amount || 0
        ),
      });

      // reset form immediately
      setForm({
        name: "",
        target_amount: "",
        current_amount: "",
      });

      // optimistic update
      setGoals((prev) => [
        ...prev,
        newGoal,
      ]);

      // fetch only new progress
      if (newGoal?.id || newGoal?._id) {
        const id = newGoal.id || newGoal._id;

        const p =
          await getSavingGoalProgress(id);

        setProgress((prev) => ({
          ...prev,
          [id]: p,
        }));
      }
    } catch (err) {
      console.error(
        "Failed creating saving goal:",
        err
      );
    } finally {
      setLoading(false);
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