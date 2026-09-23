import { REVIEW_STATES, type Card, type ReviewState } from "./card.js";
import { isDue } from "./srs.js";

export interface Stats {
  total: number;
  due: number;
  addedToday: number;
  reviewedToday: number;
  streakDays: number;
  byState: Record<ReviewState, number>;
}

/**
 * Stats are derived from cards only (createdAt / lastReviewedAt), so the
 * extension (offline) and the server compute exactly the same numbers.
 * A "day" is a calendar day in the given IANA time zone.
 */
export function computeStats(cards: Card[], now = new Date(), timeZone = "UTC"): Stats {
  const active = cards.filter((card) => !card.deletedAt);
  const today = dayKey(now, timeZone);
  const activeDays = new Set<string>();
  const byState = Object.fromEntries(REVIEW_STATES.map((state) => [state, 0])) as Record<ReviewState, number>;
  let addedToday = 0;
  let reviewedToday = 0;

  for (const card of active) {
    byState[card.state] += 1;
    const created = dayKey(new Date(card.createdAt), timeZone);
    activeDays.add(created);
    if (created === today) addedToday += 1;
    if (card.lastReviewedAt) {
      const reviewed = dayKey(new Date(card.lastReviewedAt), timeZone);
      activeDays.add(reviewed);
      if (reviewed === today) reviewedToday += 1;
    }
  }

  return {
    total: active.length,
    due: active.filter((card) => isDue(card, now)).length,
    addedToday,
    reviewedToday,
    streakDays: streak(activeDays, now, timeZone),
    byState
  };
}

/** YYYY-MM-DD in the given time zone. */
export function dayKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

function streak(activeDays: Set<string>, now: Date, timeZone: string): number {
  // A streak is still alive if today has no activity yet but yesterday did.
  let cursor = now.getTime();
  if (!activeDays.has(dayKey(now, timeZone))) {
    cursor -= 24 * 60 * 60 * 1000;
  }
  let days = 0;
  while (activeDays.has(dayKey(new Date(cursor), timeZone))) {
    days += 1;
    cursor -= 24 * 60 * 60 * 1000;
  }
  return days;
}
