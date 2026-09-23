import { SYNC_BATCH_LIMIT, type AuthResponse, type Credentials, type SyncRequest, type SyncResponse } from "@vocab-os/shared";
import { applyRemote, countDirty, db, takeDirty } from "../lib/db.js";
import type { AccountState } from "../lib/messages.js";
import { updateBadge } from "./badge.js";
import { getSettings } from "../lib/settings.js";

interface Account {
  token: string;
  email: string;
}

interface SyncMeta {
  cursor: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
}

const ACCOUNT_KEY = "account";
const SYNC_KEY = "syncMeta";
const EMPTY_META: SyncMeta = { cursor: null, lastSyncedAt: null, lastError: null };

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function api<T>(path: string, body: unknown, token?: string): Promise<T> {
  const { apiUrl } = await getSettings();
  const response = await fetch(`${apiUrl.replace(/\/+$/, "")}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body)
  }).catch(() => {
    throw new ApiError(`Cannot reach ${apiUrl}. Words are still saved on this device.`, 0);
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { message?: unknown };
    throw new ApiError(typeof data.message === "string" ? data.message : `Server error ${response.status}`, response.status);
  }
  return (await response.json()) as T;
}

async function getAccount(): Promise<Account | null> {
  return ((await chrome.storage.local.get(ACCOUNT_KEY))[ACCOUNT_KEY] as Account | undefined) ?? null;
}

async function getMeta(): Promise<SyncMeta> {
  return { ...EMPTY_META, ...((await chrome.storage.local.get(SYNC_KEY))[SYNC_KEY] as Partial<SyncMeta> | undefined) };
}

async function setMeta(patch: Partial<SyncMeta>): Promise<void> {
  await chrome.storage.local.set({ [SYNC_KEY]: { ...(await getMeta()), ...patch } });
}

export async function accountState(): Promise<AccountState> {
  const [account, meta, pendingChanges] = await Promise.all([getAccount(), getMeta(), countDirty()]);
  return { email: account?.email ?? null, lastSyncedAt: meta.lastSyncedAt, lastError: meta.lastError, pendingChanges };
}

export async function signIn(input: Credentials & { createAccount: boolean }): Promise<AccountState> {
  const { token, user } = await api<AuthResponse>(input.createAccount ? "/auth/register" : "/auth/login", {
    email: input.email,
    password: input.password
  });
  await chrome.storage.local.set({ [ACCOUNT_KEY]: { token, email: user.email } satisfies Account, [SYNC_KEY]: EMPTY_META });
  // Upload every local word to this account; the server keeps whichever version is newer.
  await db.cards.toCollection().modify({ dirty: 1 });
  return syncNow();
}

export async function signOut(): Promise<AccountState> {
  // Local words stay on this device.
  await chrome.storage.local.remove([ACCOUNT_KEY, SYNC_KEY]);
  return accountState();
}

let running: Promise<AccountState> | null = null;

/** Push local changes and pull remote ones. Safe to call any time; never throws. */
export function syncNow(): Promise<AccountState> {
  running ??= runSync().finally(() => {
    running = null;
  });
  return running;
}

async function runSync(): Promise<AccountState> {
  const account = await getAccount();
  if (!account) {
    return accountState();
  }
  try {
    let { cursor } = await getMeta();
    // Each round pushes up to one batch; loop until nothing is left (bounded as a safety net).
    for (let round = 0; round < 20; round += 1) {
      const changes = await takeDirty(SYNC_BATCH_LIMIT);
      const response = await api<SyncResponse>("/sync", { cursor, changes } satisfies SyncRequest, account.token);
      await applyRemote(response.changes);
      cursor = response.cursor;
      if (changes.length < SYNC_BATCH_LIMIT) break;
    }
    await setMeta({ cursor, lastSyncedAt: new Date().toISOString(), lastError: null });
    await updateBadge();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await signOut();
      await setMeta({ lastError: "Your session expired. Sign in again to keep syncing." });
    } else {
      await setMeta({ lastError: error instanceof Error ? error.message : "Sync failed." });
    }
  }
  return accountState();
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Sync shortly after local edits, batching bursts of saves or reviews. */
export function scheduleSync(): void {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), 2000);
}
