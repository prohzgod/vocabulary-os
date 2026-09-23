import { computeStats, newCardSchema } from "@vocab-os/shared";
import * as cards from "../lib/db.js";
import { importLegacyWords } from "../lib/legacy-import.js";
import type { MessageName, Messages, Request, TranslatorStatus } from "../lib/messages.js";
import { getSettings, updateSettings } from "../lib/settings.js";
import { callOffscreen } from "./offscreen.js";
import { accountState, scheduleSync, signIn, signOut, syncNow } from "./sync.js";

type Handlers = { [K in MessageName]: (input: Messages[K]["input"]) => Promise<Messages[K]["output"]> };

async function languagePair() {
  const { sourceLanguage, targetLanguage } = await getSettings();
  return { sourceLanguage, targetLanguage };
}

/** Run a local change, then sync it in the background if signed in. */
async function mutate<T>(change: Promise<T>): Promise<T> {
  const result = await change;
  scheduleSync();
  return result;
}

const handlers: Handlers = {
  translate: async ({ text }) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > 500) throw new Error("Select up to 500 characters to translate.");
    return callOffscreen({ type: "translate", text: trimmed, pair: await languagePair() });
  },
  translatorStatus: async () => callOffscreen<TranslatorStatus>({ type: "status", pair: await languagePair() }),
  downloadLocalModel: async () => callOffscreen<TranslatorStatus>({ type: "preload", pair: await languagePair() }),

  saveCard: async (input) => {
    const parsed = newCardSchema.safeParse(input);
    if (!parsed.success) throw new Error("This selection cannot be saved (too long or empty).");
    return mutate(cards.saveCard(parsed.data));
  },
  listCards: () => cards.listCards(),
  dueCards: () => cards.dueCards(),
  gradeCard: ({ id, grade }) => mutate(cards.grade(id, grade)),
  deleteCard: ({ id }) => mutate(cards.deleteCard(id)),
  stats: async () => computeStats(await cards.allCards(), new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone),
  highlightWords: async () =>
    (await cards.listCards()).slice(0, 1000).map(({ word, translation, state }) => ({ word, translation, state })),
  exportCards: () => cards.allCards(),
  importCards: (payload) => mutate(cards.importCards(payload)),

  getSettings: () => getSettings(),
  updateSettings: (patch) => updateSettings(patch),

  account: () => accountState(),
  signIn: (input) => signIn(input),
  signOut: () => signOut(),
  syncNow: () => syncNow()
};

chrome.runtime.onMessage.addListener((message: Request & { target?: string }, _sender, sendResponse) => {
  if (message?.target === "offscreen" || !(message?.type in handlers)) {
    return false;
  }
  const handler = handlers[message.type] as (input: unknown) => Promise<unknown>;
  handler(message.input).then(
    (value) => sendResponse({ ok: true, value }),
    (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Something went wrong." })
  );
  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  void importLegacyWords().then((count) => count > 0 && scheduleSync());
});
