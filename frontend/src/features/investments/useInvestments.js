import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createInvestment,
  createInvestmentValue,
  deleteInvestment,
  deleteInvestmentValue,
  getInvestments,
  updateInvestment,
} from "@/api/investments";

const today = () => new Date().toISOString().slice(0, 10);

const blankForm = () => ({
  name: "",
  type: "",
  start_date: today(),
  active: true,
});

export default function useInvestments() {
  const [investments, setInvestments] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const loadInvestments = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      const data = await getInvestments();
      if (requestId === requestIdRef.current) setInvestments(data || []);
    } catch (err) {
      console.error("Failed loading investments:", err);
      if (requestId === requestIdRef.current) setInvestments([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadInvestments, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadInvestments]);

  const payload = () => ({
    name: form.name,
    type: form.type || null,
    start_date: form.start_date,
    active: Boolean(form.active),
  });

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      await createInvestment(payload());
      setForm(blankForm());
      await loadInvestments();
    } catch (err) {
      console.error("Failed creating investment:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id) {
    try {
      setLoading(true);
      await updateInvestment(id, payload());
      setForm(blankForm());
      await loadInvestments();
    } catch (err) {
      console.error("Failed updating investment:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      setLoading(true);
      await deleteInvestment(id);
      await loadInvestments();
    } catch (err) {
      console.error("Failed deleting investment:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddValue(id, value) {
    try {
      setLoading(true);
      await createInvestmentValue(id, value);
      await loadInvestments();
    } catch (err) {
      console.error("Failed adding investment value:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteValue(investmentId, valueId) {
    try {
      setLoading(true);
      await deleteInvestmentValue(investmentId, valueId);
      await loadInvestments();
    } catch (err) {
      console.error("Failed deleting investment value:", err);
    } finally {
      setLoading(false);
    }
  }

  return {
    investments,
    form,
    setForm,
    handleSubmit,
    handleUpdate,
    handleDelete,
    handleAddValue,
    handleDeleteValue,
    resetForm: () => setForm(blankForm()),
    loading,
  };
}
