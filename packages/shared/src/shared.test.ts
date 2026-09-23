import { describe, expect, it } from "vitest";
import { cardId, computeStats, createCard, formatInterval, gradeCard, gradeIntervals, isDue, markDeleted, mergeRemote, shouldAcceptIncoming } from "./index.js";

const NOW = new Date("2026-09-18T08:00:00.000Z");
const later = (card: ReturnType<typeof createCard>, ms: number) => ({
  ...card,
  updatedAt: new Date(Date.parse(card.updatedAt) + ms).toISOString()
});

describe("card identity", () => {
  it("derives the same id for the same word regardless of spacing or case", () => {
    expect(cardId("  Massive ", "vi")).toBe("vi:massive");
    expect(cardId("look   UP", "VI")).toBe("vi:look up");
  });
});

describe("gradeCard", () => {
  it("schedules a new card one day out on good", () => {
    const card = gradeCard(createCard({ word: "massive", translation: "to lớn", targetLanguage: "vi" }, NOW), "good", NOW);
    expect(card.intervalDays).toBe(1);
    expect(card.state).toBe("learning");
    expect(card.dueAt).toBe("2026-09-19T08:00:00.000Z");
    expect(card.updatedAt).toBe(NOW.toISOString());
  });

  it("resets and re-shows in 10 minutes on again", () => {
    const reviewed = gradeCard(createCard({ word: "a1", translation: "x", targetLanguage: "vi" }, NOW), "good", NOW);
    const failed = gradeCard(reviewed, "again", NOW);
    expect(failed.repetitions).toBe(0);
    expect(failed.lapses).toBe(1);
    expect(failed.ease).toBeCloseTo(2.3);
    expect(failed.dueAt).toBe("2026-09-18T08:10:00.000Z");
  });

  it("reaches review then mastered with repeated good grades", () => {
    let card = createCard({ word: "grow", translation: "lớn lên", targetLanguage: "vi" }, NOW);
    card = gradeCard(card, "good", NOW);
    card = gradeCard(card, "good", NOW);
    expect(card.state).toBe("review");
    for (let i = 0; i < 3; i += 1) card = gradeCard(card, "good", NOW);
    expect(card.state).toBe("mastered");
  });

  it("treats deleted cards as never due", () => {
    const card = createCard({ word: "gone", translation: "mất", targetLanguage: "vi" }, NOW);
    expect(isDue(card, NOW)).toBe(true);
    expect(isDue(markDeleted(card, NOW), NOW)).toBe(false);
  });
});

describe("last-write-wins sync", () => {
  const base = createCard({ word: "sync", translation: "đồng bộ", targetLanguage: "vi" }, NOW);

  it("server accepts only strictly newer cards", () => {
    expect(shouldAcceptIncoming(undefined, base)).toBe(true);
    expect(shouldAcceptIncoming(base, base)).toBe(false);
    expect(shouldAcceptIncoming(base, later(base, 1))).toBe(true);
    expect(shouldAcceptIncoming(later(base, 1), base)).toBe(false);
  });

  it("client takes newer remote, cleans equal, keeps newer local", () => {
    expect(mergeRemote(undefined, base)).toBe("take");
    expect(mergeRemote(base, later(base, 1))).toBe("take");
    expect(mergeRemote(base, base)).toBe("clean");
    expect(mergeRemote(later(base, 1), base)).toBe("keep");
  });
});

describe("computeStats", () => {
  it("counts due, today activity and streak in the user's time zone", () => {
    const yesterday = new Date("2026-09-17T03:00:00.000Z");
    const cards = [
      createCard({ word: "one", translation: "một", targetLanguage: "vi" }, yesterday),
      gradeCard(createCard({ word: "two", translation: "hai", targetLanguage: "vi" }, yesterday), "good", NOW),
      markDeleted(createCard({ word: "three", translation: "ba", targetLanguage: "vi" }, NOW), NOW)
    ];
    const stats = computeStats(cards, NOW, "Asia/Ho_Chi_Minh");
    expect(stats.total).toBe(2);
    expect(stats.due).toBe(1);
    expect(stats.addedToday).toBe(0);
    expect(stats.reviewedToday).toBe(1);
    expect(stats.streakDays).toBe(2);
    expect(stats.byState).toEqual({ new: 1, learning: 1, review: 0, mastered: 0 });
  });
});

describe("gradeIntervals", () => {
  it("previews when each grade brings the card back", () => {
    const reviewed = gradeCard(createCard({ word: "scheduled", translation: "lên kế hoạch", targetLanguage: "vi" }, NOW), "good", NOW);
    const labels = Object.values(gradeIntervals(reviewed, NOW)).map(formatInterval);
    expect(labels).toEqual(["10 min", "2 days", "3 days", "4 days"]);
  });
});
