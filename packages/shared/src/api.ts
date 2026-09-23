import { z } from "zod";
import { GRADES, REVIEW_STATES, type Card } from "./card.js";
import type { Stats } from "./stats.js";

/**
 * HTTP contract between the API and its clients (web, extension).
 * The server validates request bodies with these schemas; clients import the
 * same types, so a contract change is a compile error everywhere at once.
 */

const isoDate = z.string().datetime({ offset: true });
const optionalText = (max: number) => z.string().max(max).nullish();

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(200)
});
export type Credentials = z.infer<typeof credentialsSchema>;

export const newCardSchema = z.object({
  word: z.string().trim().min(1).max(120),
  translation: z.string().trim().min(1).max(500),
  sourceLanguage: z.string().min(2).max(10).optional(),
  targetLanguage: z.string().min(2).max(10),
  context: optionalText(1000),
  sourceUrl: optionalText(2000),
  sourceTitle: optionalText(500),
  tags: z.array(z.string().max(40)).max(20).optional()
});

export const cardPatchSchema = z.object({
  translation: z.string().trim().min(1).max(500).optional(),
  context: optionalText(1000),
  tags: z.array(z.string().max(40)).max(20).optional()
});

export const gradeSchema = z.object({ grade: z.enum(GRADES) });

export const cardSchema = z.object({
  id: z.string().min(3).max(140),
  word: z.string().min(1).max(120),
  translation: z.string().min(1).max(500),
  sourceLanguage: z.string().min(2).max(10),
  targetLanguage: z.string().min(2).max(10),
  context: z.string().max(1000).nullable(),
  sourceUrl: z.string().max(2000).nullable(),
  sourceTitle: z.string().max(500).nullable(),
  tags: z.array(z.string().max(40)).max(20),
  state: z.enum(REVIEW_STATES),
  ease: z.number().min(1).max(10),
  intervalDays: z.number().int().min(0).max(36500),
  repetitions: z.number().int().min(0),
  lapses: z.number().int().min(0),
  dueAt: isoDate,
  lastReviewedAt: isoDate.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  deletedAt: isoDate.nullable()
}) satisfies z.ZodType<Card>;

export const SYNC_BATCH_LIMIT = 500;

export const syncRequestSchema = z.object({
  /** Cursor returned by the previous sync, or null for the first sync. */
  cursor: isoDate.nullable(),
  /** Local cards changed since the last successful sync. */
  changes: z.array(cardSchema).max(SYNC_BATCH_LIMIT)
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export interface SyncResponse {
  cursor: string;
  /** Server copies of every card changed since `cursor`, plus every card that was pushed. */
  changes: Card[];
}

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type { Stats };
