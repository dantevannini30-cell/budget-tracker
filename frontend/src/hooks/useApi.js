import { useState, useEffect } from "react";
import { api } from "@/shared/api/client";

export default function useApi(endpoint) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${api}${endpoint}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [endpoint]);

  return { data, setData, loading };
}