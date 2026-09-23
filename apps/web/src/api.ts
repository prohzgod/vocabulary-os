import type { AuthResponse, Card, CardPatch, Credentials, Grade, NewCardInput, Stats, User } from "@vocab-os/shared";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const TOKEN_KEY = "vocab-os-token";
export const SIGNED_OUT_EVENT = "vocab-os:signed-out";

export const session = {
  token: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  }
};

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = session.token();
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body)
  }).catch(() => {
    throw new Error(`Cannot reach the server at ${API_URL}.`);
  });

  if (response.status === 401 && token) {
    session.clear();
  }
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: unknown };
    throw new Error(typeof data.message === "string" ? data.message : `Request failed (${response.status})`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

const cardPath = (id: string) => `/cards/${encodeURIComponent(id)}`;
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export const api = {
  register: (credentials: Credentials) => request<AuthResponse>("POST", "/auth/register", credentials),
  login: (credentials: Credentials) => request<AuthResponse>("POST", "/auth/login", credentials),
  me: () => request<User>("GET", "/auth/me"),
  cards: () => request<Card[]>("GET", "/cards"),
  dueCards: () => request<Card[]>("GET", "/cards/due?limit=100"),
  createCard: (input: NewCardInput) => request<Card>("POST", "/cards", input),
  updateCard: (id: string, patch: CardPatch) => request<Card>("PATCH", cardPath(id), patch),
  reviewCard: (id: string, grade: Grade) => request<Card>("POST", `${cardPath(id)}/review`, { grade }),
  deleteCard: (id: string) => request<void>("DELETE", cardPath(id)),
  stats: () => request<Stats>("GET", `/stats?timeZone=${encodeURIComponent(timeZone)}`)
};
