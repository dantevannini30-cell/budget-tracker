import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  createDebt,
  createDebtPayment,
  deleteDebt,
  deleteDebtPayment,
  getDebts,
  updateDebt,
} from "@/api/debts";

const today = () => new Date().toISOString().slice(0, 10);

const blankForm = () => ({
  name: "",
  initial_amount: "",
  category: "",
  start_date: today(),
  active: true,
});

export default function useDebts() {
  const [debts, setDebts] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  const loadDebts = useCallback(async () => {
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      const data = await getDebts();
      if (requestId === requestIdRef.current) setDebts(data || []);
    } catch (err) {
      console.error("Failed loading debts:", err);
      if (requestId === requestIdRef.current) setDebts([]);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadDebts, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadDebts]);

  const payload = () => ({
    name: form.name,
    initial_amount: Number(form.initial_amount || 0),
    category: form.category || null,
    start_date: form.start_date,
    active: Boolean(form.active),
  });

  async function handleSubmit(e) {
    e.preventDefault();

    try {
      setLoading(true);
      await createDebt(payload());
      setForm(blankForm());
      await loadDebts();
    } catch (err) {
      console.error("Failed creating debt:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(id) {
    try {
      setLoading(true);
      await updateDebt(id, payload());
      setForm(blankForm());
      await loadDebts();
    } catch (err) {
      console.error("Failed updating debt:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    try {
      setLoading(true);
      await deleteDebt(id);
      await loadDebts();
    } catch (err) {
      console.error("Failed deleting debt:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddPayment(id, payment) {
    try {
      setLoading(true);
      await createDebtPayment(id, payment);
      await loadDebts();
    } catch (err) {
      console.error("Failed adding debt payment:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePayment(debtId, paymentId) {
    try {
      setLoading(true);
      await deleteDebtPayment(debtId, paymentId);
      await loadDebts();
    } catch (err) {
      console.error("Failed deleting debt payment:", err);
    } finally {
      setLoading(false);
    }
  }

  return {
    debts,
    form,
    setForm,
    handleSubmit,
    handleUpdate,
    handleDelete,
    handleAddPayment,
    handleDeletePayment,
    resetForm: () => setForm(blankForm()),
    loading,
  };
}
