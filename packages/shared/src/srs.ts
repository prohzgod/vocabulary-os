import type { Card, Grade, ReviewState } from "./card.js";

const MIN_EASE = 1.3;
const MASTERED_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const AGAIN_DELAY_MS = 10 * 60 * 1000;

/**
 * Simplified SM-2. This is the only scheduler in the system: the extension,
 * the web app (through the API) and the server all call it.
 */
export function gradeCard(card: Card, grade: Grade, now = new Date()): Card {
  const reviewedAt = now.toISOString();
  const previousInterval = Math.max(1, card.intervalDays);
  const base = { ...card, lastReviewedAt: reviewedAt, updatedAt: reviewedAt };

  if (grade === "again") {
    return {
      ...base,
      state: "learning",
      ease: Math.max(MIN_EASE, card.ease - 0.2),
      intervalDays: 0,
      repetitions: 0,
      lapses: card.lapses + 1,
      dueAt: new Date(now.getTime() + AGAIN_DELAY_MS).toISOString()
    };
  }

  let ease = card.ease;
  let intervalDays: number;

  if (grade === "hard") {
    ease = Math.max(MIN_EASE, card.ease - 0.15);
    intervalDays = Math.ceil(previousInterval * 1.2);
  } else if (grade === "good") {
    intervalDays = card.repetitions === 0 ? 1 : card.repetitions === 1 ? 3 : Math.ceil(previousInterval * ease);
  } else {
    ease = card.ease + 0.15;
    intervalDays = card.repetitions === 0 ? 3 : Math.ceil(previousInterval * ease * 1.3);
  }

  const repetitions = card.repetitions + 1;
  return {
    ...base,
    state: grade === "hard" ? "learning" : stateFor(repetitions, intervalDays),
    ease,
    intervalDays,
    repetitions,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS).toISOString()
  };
}

export function isDue(card: Card, now = new Date()): boolean {
  return !card.deletedAt && Date.parse(card.dueAt) <= now.getTime();
}

function stateFor(repetitions: number, intervalDays: number): ReviewState {
  if (intervalDays >= MASTERED_AFTER_DAYS) {
    return "mastered";
  }
  return repetitions >= 2 ? "review" : "learning";
}
