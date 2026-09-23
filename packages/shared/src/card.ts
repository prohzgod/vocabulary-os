export const GRADES = ["again", "hard", "good", "easy"] as const;
export type Grade = (typeof GRADES)[number];

export const REVIEW_STATES = ["new", "learning", "review", "mastered"] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

/**
 * One saved word. The same shape is stored in the extension (IndexedDB),
 * sent over the API, and persisted by the server.
 *
 * `id` is derived from the word itself (see `cardId`), so saving the same
 * word on two devices produces the same card and sync never creates duplicates.
 *
 * `updatedAt` is the last-write-wins clock for sync. Every edit must bump it.
 */
export interface Card {
  id: string;
  word: string;
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  context: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
  tags: string[];
  state: ReviewState;
  ease: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  dueAt: string;
  lastReviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NewCardInput {
  word: string;
  translation: string;
  sourceLanguage?: string;
  targetLanguage: string;
  context?: string | null;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  tags?: string[];
}

/** Fields a user may edit after saving. Changing the word itself means delete + re-add. */
export interface CardPatch {
  translation?: string;
  context?: string | null;
  tags?: string[];
}

export function normalizeWord(word: string): string {
  return word.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function cardId(word: string, targetLanguage: string): string {
  return `${targetLanguage.trim().toLowerCase()}:${normalizeWord(word)}`;
}

export function createCard(input: NewCardInput, now = new Date()): Card {
  const timestamp = now.toISOString();
  return {
    id: cardId(input.word, input.targetLanguage),
    word: input.word.trim().replace(/\s+/g, " "),
    translation: input.translation.trim(),
    sourceLanguage: input.sourceLanguage?.trim() || "en",
    targetLanguage: input.targetLanguage.trim().toLowerCase(),
    context: clean(input.context),
    sourceUrl: clean(input.sourceUrl),
    sourceTitle: clean(input.sourceTitle),
    tags: cleanTags(input.tags),
    state: "new",
    ease: 2.5,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: timestamp,
    lastReviewedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null
  };
}

export function applyPatch(card: Card, patch: CardPatch, now = new Date()): Card {
  return {
    ...card,
    translation: patch.translation !== undefined ? patch.translation.trim() : card.translation,
    context: patch.context !== undefined ? clean(patch.context) : card.context,
    tags: patch.tags !== undefined ? cleanTags(patch.tags) : card.tags,
    updatedAt: now.toISOString()
  };
}

export function markDeleted(card: Card, now = new Date()): Card {
  const timestamp = now.toISOString();
  return { ...card, deletedAt: timestamp, updatedAt: timestamp };
}

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function cleanTags(tags: string[] | undefined): string[] {
  return [...new Set((tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean))];
}
