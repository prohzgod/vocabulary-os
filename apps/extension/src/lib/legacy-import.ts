import { cardId, REVIEW_STATES, type Card, type ReviewState } from "@vocab-os/shared";
import Dexie from "dexie";
import { db } from "./db.js";

/**
 * One-time copy of words saved by extension v0.1 (IndexedDB "vocabulary-os-local-mvp")
 * into the v0.2 database. The old database is left untouched.
 */
const OLD_DB = "vocabulary-os-local-mvp";
const DONE_KEY = "legacyImportDone";

interface OldRecord {
  word: string;
  translation: string;
  contextSentence?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceLanguage?: string;
  targetLanguage: string;
  tags?: string[];
  reviewState?: string;
  easeFactor?: number;
  intervalDays?: number;
  repetitions?: number;
  lapses?: number;
  nextReviewAt?: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export async function importLegacyWords(): Promise<number> {
  if ((await chrome.storage.local.get(DONE_KEY))[DONE_KEY] || !(await Dexie.exists(OLD_DB))) {
    return 0;
  }

  const old = new Dexie(OLD_DB);
  await old.open();
  const records = old.tables.some((table) => table.name === "vocabularies")
    ? ((await old.table("vocabularies").toArray()) as OldRecord[])
    : [];
  old.close();

  const cards = records.filter((record) => record.word && record.translation && !record.deletedAt).map(toCard);
  await db.transaction("rw", db.cards, async () => {
    for (const card of cards) {
      if (!(await db.cards.get(card.id))) await db.cards.put({ ...card, dirty: 1 });
    }
  });
  await chrome.storage.local.set({ [DONE_KEY]: true });
  return cards.length;
}

function toCard(record: OldRecord): Card {
  const state = (REVIEW_STATES as readonly string[]).includes(record.reviewState ?? "")
    ? (record.reviewState as ReviewState)
    : "review";
  return {
    id: cardId(record.word, record.targetLanguage),
    word: record.word.trim(),
    translation: record.translation.trim(),
    sourceLanguage: record.sourceLanguage ?? "en",
    targetLanguage: record.targetLanguage,
    context: record.contextSentence ?? null,
    sourceUrl: record.sourceUrl ?? null,
    sourceTitle: record.sourceTitle ?? null,
    tags: record.tags ?? [],
    state: record.repetitions ? state : "new",
    ease: record.easeFactor ?? 2.5,
    intervalDays: record.intervalDays ?? 0,
    repetitions: record.repetitions ?? 0,
    lapses: record.lapses ?? 0,
    dueAt: record.nextReviewAt ?? record.createdAt,
    lastReviewedAt: record.lastReviewedAt ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: null
  };
}
