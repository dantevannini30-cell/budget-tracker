import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";

import {
  getSpendingTargets,
  getSpendingTargetProgress,
  createSpendingTarget,
} from "@/api/goals";

export default function useSpendingTargets() {
  const [targets, setTargets] = useState([]);
  const [progress, setProgress] = useState({});
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    amount: "",
    period: "monthly",
    categories: [],
  });

  // prevents stale async overwrites
  const requestIdRef = useRef(0);

  const loadTargets = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);

      const data = await getSpendingTargets();

      // ignore stale response
      if (requestId !== requestIdRef.current) {
        return;
      }

      const safeTargets = data || [];

      setTargets(safeTargets);

      // fetch all progress in parallel
      const progressEntries = await Promise.all(
        safeTargets
          .filter((t) => t?.id || t?._id)
          .map(async (target) => {
            const id = target.id || target._id;

            const p =
              await getSpendingTargetProgress(id);

            return [id, p];
          })
      );

      // ignore stale response
      if (requestId !== requestIdRef.current) {
        return;
      }

      setProgress(
        Object.fromEntries(progressEntries)
      );
    } catch (err) {
      console.error(
        "Failed loading spending targets:",
        err
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);

      const newTarget =
        await createSpendingTarget({
          name: form.name,
          amount: Number(form.amount),
          period: form.period,
          categories: form.categories,
        });

      // reset form immediately
      setForm({
        name: "",
        amount: "",
        period: "monthly",
        categories: [],
      });

      // optimistic update
      setTargets((prev) => [
        ...prev,
        newTarget,
      ]);

      // fetch only new progress
      if (newTarget?.id || newTarget?._id) {
        const id =
          newTarget.id || newTarget._id;

        const p =
          await getSpendingTargetProgress(id);

        setProgress((prev) => ({
          ...prev,
          [id]: p,
        }));
      }
    } catch (err) {
      console.error(
        "Failed creating spending target:",
        err
      );
    } finally {
      setLoading(false);
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