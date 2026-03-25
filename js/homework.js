import { API } from "./api.js";

export async function getHomework() {
  const res = await fetch(`${API}/homework`, { credentials: "include" });
  if (!res.ok) return [];
  return res.json();
}

export async function addHomework(title, due) {
  const res = await fetch(`${API}/homework`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, due })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export async function deleteHomework(id) {
  const res = await fetch(`${API}/homework/${id}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!res.ok) throw new Error("Delete failed");
}
