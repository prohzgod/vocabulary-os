import type { Card, Credentials, Grade, NewCardInput, Sense, Stats } from "@vocab-os/shared";
import type { Settings } from "./settings.js";

export type TranslationEngine = "dictionary" | "chrome" | "local";

export interface TranslateResult {
  /** What gets saved on the card. For the dictionary, every meaning joined with "; ". */
  translation: string;
  engine: TranslationEngine;
  /** Dictionary meanings by part of speech (dictionary engine only). */
  senses?: Sense[];
  /** The dictionary entry used when it differs from the selection, e.g. "run" for "running". */
  headword?: string;
}

export interface TranslatorStatus {
  /** Chrome's built-in Translator API for the current language pair. */
  chrome: "unsupported" | "unavailable" | "downloadable" | "downloading" | "available";
  /** The bundled opus-mt model run with transformers.js. */
  local: { state: "unsupported" | "idle" | "loading" | "ready" | "error"; progress: number; error?: string };
  /** The bundled dictionary for the current language pair, or null if there is none. */
  dictionary: { entries: number; source: string } | null;
}

export interface AccountState {
  email: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  pendingChanges: number;
}

export interface HighlightWord {
  word: string;
  translation: string;
  state: Card["state"];
}

/**
 * Every message the background worker answers: name → input and output.
 * Add a message here, then add its handler in background/index.ts. TypeScript
 * flags any handler that is missing or has the wrong shape.
 */
export interface Messages {
  translate: { input: { text: string }; output: TranslateResult };
  translatorStatus: { input: void; output: TranslatorStatus };
  downloadLocalModel: { input: void; output: TranslatorStatus };
  saveCard: { input: NewCardInput; output: { card: Card; duplicate: boolean } };
  listCards: { input: void; output: Card[] };
  dueCards: { input: void; output: Card[] };
  gradeCard: { input: { id: string; grade: Grade }; output: Card };
  deleteCard: { input: { id: string }; output: void };
  stats: { input: void; output: Stats };
  highlightWords: { input: void; output: HighlightWord[] };
  exportCards: { input: void; output: Card[] };
  importCards: { input: unknown; output: { imported: number; skipped: number } };
  getSettings: { input: void; output: Settings };
  updateSettings: { input: Partial<Settings>; output: Settings };
  account: { input: void; output: AccountState };
  signIn: { input: Credentials & { createAccount: boolean }; output: AccountState };
  signOut: { input: void; output: AccountState };
  syncNow: { input: void; output: AccountState };
}

export type MessageName = keyof Messages;
export type Request = { [K in MessageName]: { type: K; input: Messages[K]["input"] } }[MessageName];
export type Response<T> = { ok: true; value: T } | { ok: false; error: string };

/** Call the background worker from a content script, the popup or the options page. */
export async function send<K extends MessageName>(
  type: K,
  ...args: Messages[K]["input"] extends void ? [] : [Messages[K]["input"]]
): Promise<Messages[K]["output"]> {
  const response = (await chrome.runtime.sendMessage({ type, input: args[0] })) as Response<Messages[K]["output"]> | undefined;
  if (!response) {
    throw new Error("Vocabulary OS is not responding. Reload the extension.");
  }
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.value;
}
