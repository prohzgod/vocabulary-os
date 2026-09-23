import { createCard } from "@vocab-os/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { applyRemote, countDirty, db, deleteCard, dueCards, grade, importCards, listCards, saveCard, takeDirty } from "./db.js";

const input = { word: "Massive", translation: "to lớn", targetLanguage: "vi" };

describe("local card store", () => {
  beforeEach(async () => {
    await db.cards.clear();
  });

  it("saves once and reports duplicates by word + target language", async () => {
    expect((await saveCard(input)).duplicate).toBe(false);
    expect((await saveCard({ ...input, word: " massive " })).duplicate).toBe(true);
    expect(await listCards()).toHaveLength(1);
    expect(await countDirty()).toBe(1);
  });

  it("revives a deleted word as a fresh card", async () => {
    const { card } = await saveCard(input);
    await deleteCard(card.id);
    expect(await listCards()).toHaveLength(0);
    expect((await saveCard(input)).duplicate).toBe(false);
  });

  it("removes a graded card from the due list", async () => {
    const { card } = await saveCard(input);
    expect(await dueCards()).toHaveLength(1);
    await grade(card.id, "good");
    expect(await dueCards()).toHaveLength(0);
  });

  it("merges server cards by updatedAt and clears the dirty flag", async () => {
    const { card } = await saveCard(input);
    const [pushed] = await takeDirty(10);
    await applyRemote([pushed!]);
    expect(await countDirty()).toBe(0);

    const newer = { ...card, translation: "khổng lồ", updatedAt: new Date(Date.now() + 1000).toISOString() };
    await applyRemote([newer]);
    expect((await listCards())[0]?.translation).toBe("khổng lồ");

    const older = { ...card, translation: "cũ", updatedAt: new Date(0).toISOString() };
    await applyRemote([older]);
    expect((await listCards())[0]?.translation).toBe("khổng lồ");
  });

  it("imports valid cards from an export and skips junk", async () => {
    const result = await importCards([createCard({ word: "grow", translation: "lớn lên", targetLanguage: "vi" }), { nope: true }]);
    expect(result).toEqual({ imported: 1, skipped: 1 });
  });
});
