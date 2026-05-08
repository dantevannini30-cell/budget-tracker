import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  getSpendingTargets,
  createSpendingTarget,
} from "@/api/goals";

export default function useSpendingTargets() {
  const [targets, setTargets] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    amount: "",
    period: "monthly",
    categories: [],
  });

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
        categories: form.categories,
      });

      setForm({
        name: "",
        amount: "",
        period: "monthly",
        categories: [],
      });

      // 🔥 IMPORTANT: re-sync from backend (keeps enrichment correct)
      await loadTargets();
    } catch (err) {
      console.error("Failed creating spending target:", err);
    } finally {
      setLoading(false);
    }
  }

  return {
    targets,
    form,
    setForm,
    handleSubmit,
    reloadTargets: loadTargets,
    loading,
  };
}
