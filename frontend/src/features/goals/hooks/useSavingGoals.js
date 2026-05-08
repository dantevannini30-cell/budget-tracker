import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  getSavingGoals,
  createSavingGoal,
} from "@/api/goals";

export default function useSavingGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    target_amount: "",
    current_amount: "",
  });

  const requestIdRef = useRef(0);

  const loadGoals = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);

      const data = await getSavingGoals();

      if (requestId !== requestIdRef.current) return;

      setGoals(data || []);
    } catch (err) {
      console.error("Failed loading saving goals:", err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadGoals();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadGoals]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);

      await createSavingGoal({
        name: form.name,
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount || 0),
      });

      setForm({
        name: "",
        target_amount: "",
        current_amount: "",
      });

      // 🔥 CRITICAL FIX: re-fetch from backend instead of appending
      await loadGoals();
    } catch (err) {
      console.error("Failed creating saving goal:", err);
    } finally {
      setLoading(false);
    }
  }

  return {
    goals,
    form,
    setForm,
    handleSubmit,
    reloadGoals: loadGoals,
    loading,
  };
}
