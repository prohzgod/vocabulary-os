import {
  cardId,
  cardSchema,
  createCard,
  gradeCard,
  isDue,
  markDeleted,
  mergeRemote,
  type Card,
  type Grade,
  type NewCardInput
} from "@vocab-os/shared";
import Dexie, { type Table } from "dexie";

/** A card plus a flag telling sync it has local changes the server has not seen. */
export type StoredCard = Card & { dirty: 0 | 1 };

class Database extends Dexie {
  cards!: Table<StoredCard, string>;

  constructor() {
    super("vocabulary-os");
    this.version(1).stores({ cards: "id, dueAt, createdAt, dirty" });
  }
}

export const db = new Database();

const strip = ({ dirty: _dirty, ...card }: StoredCard): Card => card;
const alive = (card: Card) => !card.deletedAt;

export async function saveCard(input: NewCardInput): Promise<{ card: Card; duplicate: boolean }> {
  const existing = await db.cards.get(cardId(input.word, input.targetLanguage));
  if (existing && alive(existing)) {
    return { card: strip(existing), duplicate: true };
  }
  const card = createCard(input);
  await db.cards.put({ ...card, dirty: 1 });
  return { card, duplicate: false };
}

export async function listCards(): Promise<Card[]> {
  const cards = await db.cards.orderBy("createdAt").reverse().filter(alive).toArray();
  return cards.map(strip);
}

export async function dueCards(limit = 50): Promise<Card[]> {
  const now = new Date();
  const cards = await db.cards
    .where("dueAt")
    .belowOrEqual(now.toISOString())
    .filter((card) => isDue(card, now))
    .limit(limit)
    .toArray();
  return cards.map(strip);
}

export async function allCards(): Promise<Card[]> {
  return (await db.cards.toArray()).map(strip);
}

export async function grade(id: string, value: Grade): Promise<Card> {
  const card = await db.cards.get(id);
  if (!card || !alive(card)) {
    throw new Error("This word no longer exists.");
  }
  const next = gradeCard(strip(card), value);
  await db.cards.put({ ...next, dirty: 1 });
  return next;
}

export async function deleteCard(id: string): Promise<void> {
  const card = await db.cards.get(id);
  if (card && alive(card)) {
    await db.cards.put({ ...markDeleted(strip(card)), dirty: 1 });
  }
}

export async function countDirty(): Promise<number> {
  return db.cards.where("dirty").equals(1).count();
}

export async function takeDirty(limit: number): Promise<Card[]> {
  return (await db.cards.where("dirty").equals(1).limit(limit).toArray()).map(strip);
}

/** Merge cards returned by the server (last write wins on `updatedAt`). */
export async function applyRemote(remote: Card[]): Promise<void> {
  await db.transaction("rw", db.cards, async () => {
    for (const card of remote) {
      const local = await db.cards.get(card.id);
      const action = mergeRemote(local && strip(local), card);
      if (action === "take") await db.cards.put({ ...card, dirty: 0 });
      if (action === "clean") await db.cards.update(card.id, { dirty: 0 });
    }
  });
}

/** Import an exported JSON array. Invalid rows are skipped; newer versions win. */
export async function importCards(payload: unknown): Promise<{ imported: number; skipped: number }> {
  const rows = Array.isArray(payload) ? payload : [];
  let imported = 0;
  await db.transaction("rw", db.cards, async () => {
    for (const row of rows) {
      const parsed = cardSchema.safeParse(row);
      if (!parsed.success) continue;
      const local = await db.cards.get(parsed.data.id);
      if (mergeRemote(local && strip(local), parsed.data) === "take") {
        await db.cards.put({ ...parsed.data, dirty: 1 });
        imported += 1;
      }
    }
  });
  return { imported, skipped: rows.length - imported };
}
