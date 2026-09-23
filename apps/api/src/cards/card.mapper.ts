import type { Card as CardRow, Prisma } from "@prisma/client";
import type { Card, ReviewState } from "@vocab-os/shared";

export function toCard(row: CardRow): Card {
  return {
    id: row.id,
    word: row.word,
    translation: row.translation,
    sourceLanguage: row.sourceLanguage,
    targetLanguage: row.targetLanguage,
    context: row.context,
    sourceUrl: row.sourceUrl,
    sourceTitle: row.sourceTitle,
    tags: row.tags,
    state: row.state as ReviewState,
    ease: row.ease,
    intervalDays: row.intervalDays,
    repetitions: row.repetitions,
    lapses: row.lapses,
    dueAt: row.dueAt.toISOString(),
    lastReviewedAt: row.lastReviewedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null
  };
}

/** Row data for an upsert. Stamps `syncedAt` with the server clock on every write. */
export function toRow(userId: string, card: Card): Prisma.CardUncheckedCreateInput {
  return {
    ...card,
    userId,
    dueAt: new Date(card.dueAt),
    lastReviewedAt: card.lastReviewedAt ? new Date(card.lastReviewedAt) : null,
    createdAt: new Date(card.createdAt),
    updatedAt: new Date(card.updatedAt),
    deletedAt: card.deletedAt ? new Date(card.deletedAt) : null,
    syncedAt: new Date()
  };
}
