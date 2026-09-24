import { normalizeWord } from "./card.js";

/** One part of speech and its meanings, e.g. `["adj", ["to lớn", "đồ sộ"]]`. */
export type Sense = [partOfSpeech: string, meanings: string[]];

/**
 * A bundled bilingual dictionary (`apps/extension/public/dict/<src>-<tgt>.json`),
 * keyed by lowercase headword. Built by `apps/extension/scripts/build-dictionary.mjs`.
 * A string entry is an inflected form pointing at its base word ("went" → "go").
 */
export interface DictionaryFile {
  v: 1;
  source: string;
  entries: Record<string, Sense[] | string>;
}

export interface DictionaryMatch {
  /** The entry that matched; differs from the selection when a base form was used ("running" → "run"). */
  headword: string;
  senses: Sense[];
}

/** Longer selections are sentences and go to machine translation. */
export const MAX_LOOKUP_WORDS = 4;

/**
 * Keys to try for a selection, best first: as written, lowercase, then guesses
 * at the base form of the first word ("running" → "run", "looking up" → "look up").
 * The guesses are cheap string rules, not a real lemmatizer; wrong guesses only
 * cost a lookup miss.
 */
export function lookupCandidates(text: string): string[] {
  const written = text.trim().replace(/\s+/g, " ");
  const lower = normalizeWord(written);
  if (!lower || lower.split(" ").length > MAX_LOOKUP_WORDS) return [];

  const [first = "", ...rest] = lower.split(" ");
  const tail = rest.length ? ` ${rest.join(" ")}` : "";
  const forms = baseForms(first).map((form) => form + tail);
  return [...new Set([written, lower, ...forms])];
}

/** The first candidate present in the dictionary, following a form pointer once, or null. */
export function findEntry(entries: DictionaryFile["entries"], text: string): DictionaryMatch | null {
  // hasOwn, so "constructor" or "__proto__" never hit Object.prototype.
  const get = (key: string) => (Object.hasOwn(entries, key) ? entries[key] : undefined);
  for (const key of lookupCandidates(text)) {
    let headword = key;
    let entry = get(key);
    if (typeof entry === "string") {
      headword = entry;
      entry = get(entry);
    }
    const senses = (Array.isArray(entry) ? entry : []).filter(([, meanings]) => meanings.some((meaning) => meaning.trim()));
    if (senses.length) return { headword, senses };
  }
  return null;
}

/**
 * Every meaning, deduplicated and joined with "; ", cut at a meaning boundary so
 * it fits a card's translation (max 500 characters in `newCardSchema`).
 */
export function formatMeanings(senses: Sense[], max = 500): string {
  const seen = new Set<string>();
  let result = "";
  for (const [, meanings] of senses) {
    for (const raw of meanings) {
      const meaning = raw.trim().replace(/\s+/g, " ");
      const key = meaning.toLocaleLowerCase();
      if (!meaning || seen.has(key)) continue;
      seen.add(key);
      const next = result ? `${result}; ${meaning}` : meaning;
      if (next.length > max) return result || meaning.slice(0, max);
      result = next;
    }
  }
  return result;
}

function baseForms(word: string): string[] {
  const forms: string[] = [];
  const stem = (suffix: string) => (word.length > suffix.length + 1 && word.endsWith(suffix) ? word.slice(0, -suffix.length) : null);
  const undouble = (value: string) => (/([bdgklmnprtz])\1$/.test(value) ? value.slice(0, -1) : null);

  const ies = stem("ies") ?? stem("ied");
  if (ies) forms.push(`${ies}y`);
  const ying = stem("ying");
  if (ying) forms.push(`${ying}ie`);
  const es = stem("es");
  if (es) forms.push(es);
  const s = stem("s");
  if (s && !word.endsWith("ss")) forms.push(s);
  for (const suffix of ["ing", "ed", "er", "est"]) {
    const base = stem(suffix);
    if (!base) continue;
    const single = undouble(base);
    if (single) forms.push(single);
    forms.push(base, `${base}e`);
  }
  return forms;
}
