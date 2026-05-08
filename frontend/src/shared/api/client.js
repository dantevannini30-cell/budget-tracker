import { API } from "@/api/constants";
export { API };
export const api = {
  get: async (url) => {
    const res = await fetch(`${API}${url}`);
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  post: async (url, body) => {
    const res = await fetch(`${API}${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  put: async (url, body) => {
    const res = await fetch(`${API}${url}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};