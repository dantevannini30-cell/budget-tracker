import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  getSpendingTargets,
  createSpendingTarget,
  updateSpendingTarget,
} from "@/api/goals";

const today = () => new Date().toISOString().slice(0, 10);
const blankForm = () => ({
  name: "",
  amount: "",
  period: "monthly",
  start_date: today(),
  categories: [],
});

export default function useSpendingTargets() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState(blankForm);

  const requestIdRef = useRef(0);

  const loadTargets = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);

      const data = await getSpendingTargets();

      if (requestId !== requestIdRef.current) return;

      setTargets(data || []);
    } catch (err) {
      console.error("Failed loading spending targets:", err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadTargets();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadTargets]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);

      await createSpendingTarget({
        name: form.name,
        amount: Number(form.amount),
        period: form.period,
        start_date: form.start_date,
        categories: form.categories,
      });

      setForm(blankForm());

      // 🔥 IMPORTANT: re-sync from backend (keeps enrichment correct)
      await loadTargets();
    } catch (err) {
      console.error("Failed creating spending target:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id) {
    try {
      setLoading(true);

      await updateSpendingTarget(id, {
        name: form.name,
        amount: Number(form.amount),
        period: form.period,
        start_date: form.start_date,
        categories: form.categories,
      });

      setForm(blankForm());
      await loadTargets();
    } catch (err) {
      console.error("Failed updating spending target:", err);
    } finally {
      setLoading(false);
    }
  }

  return {
    targets,
    form,
    setForm,
    handleSubmit,
    handleUpdate,
    resetForm: () => setForm(blankForm()),
    reloadTargets: loadTargets,
    loading,
  };
}
