import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  getAccounts,
  getSavingGoals,
  createSavingGoal,
  updateSavingGoal,
} from "@/api/goals";

const today = () => new Date().toISOString().slice(0, 10);
const blankForm = () => ({
  name: "",
  target_amount: "",
  current_amount: "",
  start_date: today(),
  account_id: "",
});

export default function useSavingGoals() {
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(blankForm);

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

  const loadAccounts = useCallback(async () => {
    try {
      const data = await getAccounts();
      setAccounts(data || []);
    } catch (err) {
      console.error("Failed loading accounts:", err);
      setAccounts([]);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadGoals();
      loadAccounts();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadAccounts, loadGoals]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);

      await createSavingGoal({
        name: form.name,
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount || 0),
        start_date: form.start_date,
        account_id: form.account_id || null,
      });

      setForm(blankForm());

      // 🔥 CRITICAL FIX: re-fetch from backend instead of appending
      await loadGoals();
    } catch (err) {
      console.error("Failed creating saving goal:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id) {
    try {
      setLoading(true);

      await updateSavingGoal(id, {
        name: form.name,
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount || 0),
        start_date: form.start_date,
        account_id: form.account_id || null,
      });

      setForm(blankForm());
      await loadGoals();
    } catch (err) {
      console.error("Failed updating saving goal:", err);
    } finally {
      setLoading(false);
    }
  }

  return {
    goals,
    accounts,
    form,
    setForm,
    handleSubmit,
    handleUpdate,
    resetForm: () => setForm(blankForm()),
    reloadGoals: loadGoals,
    loading,
  };
}
