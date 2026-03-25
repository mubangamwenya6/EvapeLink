import { API } from "./api.js";

let currentUser = null;
let currentRole = null;   // FIX: null until login tells us the real role

export function getUser()  { return currentUser; }
export function getRole()  { return currentRole; }
export function setRole(r) { currentRole = r; }  // still used for UI role picker on login screen

export async function login(email, password) {
  const res  = await fetch(`${API}/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  currentUser = data;
  currentRole = data.role;   // FIX: role now comes from the server, not the UI button
  return data;
}

export async function logout() {
  await fetch(`${API}/logout`, { method: "POST", credentials: "include" });
  currentUser = null;
  currentRole = null;
}

export async function restoreSession() {
  const res  = await fetch(`${API}/session`, { credentials: "include" });
  const data = await res.json();
  if (data.email) {
    currentUser = data;
    currentRole = data.role;  // FIX: restore role from server session
    return data;
  }
  return null;
}
