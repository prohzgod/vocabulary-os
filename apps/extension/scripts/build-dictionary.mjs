/**
 * Builds the bundled en→vi dictionary (public/dict/en-vi.json) from two
 * Wiktionary extracts published by kaikki.org (wiktextract JSONL, CC BY-SA 4.0):
 *
 *   --vi  Vietnamese Wiktionary: Vietnamese glosses of English words (main source)
 *         https://kaikki.org/viwiktionary/raw-wiktextract-data.jsonl.gz
 *   --en  English Wiktionary: English words' Vietnamese translations (adds phrases)
 *         https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl
 *
 *   node scripts/build-dictionary.mjs --vi vi.jsonl.gz --en english.jsonl [--out public/dict/en-vi.json]
 *
 * Inputs may be gzipped, or /dev/stdin. The output is committed, so normal
 * builds never need the network. Keep public/dict/NOTICE next to it.
 */
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { createGunzip, gzipSync } from "node:zlib";

export const TARGET_LANGUAGE = "vi";
export const MAX_MEANINGS_PER_SENSE = 8;
/** Longer glosses are explanations, not translations; they would crowd the card. */
export const MAX_MEANING_LENGTH = 120;
const SOURCE = "Vietnamese and English Wiktionary via kaikki.org (CC BY-SA 4.0)";

/**
 * Vietnamese Wiktionary glosses that only say "<inflection> of <word>", e.g.
 * "Số nhiều của child", "động từ quá khứ của go.", "So sánh hơn của good".
 */
const FORM_OF_GLOSS = /^(?:dạng\s+)?(?:động từ chia ở ngôi thứ ba số ít|(?:động từ\s+)?quá khứ(?: đơn)?(?: và phân từ quá khứ)?|phân từ (?:hiện tại|quá khứ)|số nhiều|so sánh (?:hơn|nhất))\s+của\s+(.+?)\.?$/iu;

/**
 * Turn wiktextract entries into the `DictionaryFile` shape from @vocab-os/shared:
 * `{ v, source, entries: { headword: [[pos, meanings[]], …] | "base word" } }`,
 * keyed by lowercase headword. Vietnamese Wiktionary meanings come first.
 */
export function buildDictionary({ vi = [], en = [] }, targetLanguage = TARGET_LANGUAGE) {
  /** headword → pos → Set of meanings, in insertion order. */
  const words = new Map();
  /** headword → base words it is an inflection of. */
  const formsOf = new Map();

  const add = (word, pos, meanings) => {
    const headword = clean(word).toLocaleLowerCase();
    if (!headword) return;
    if (!words.has(headword)) words.set(headword, new Map());
    const byPos = words.get(headword);
    const key = clean(pos) || "other";
    if (!byPos.has(key)) byPos.set(key, new Set());
    const set = byPos.get(key);
    // A meaning already said inside a gloss ("quan trọng" in "quan trọng, trọng đại") is not repeated.
    const seen = new Set([...set].flatMap(parts));
    for (const meaning of meanings) {
      if (set.size >= MAX_MEANINGS_PER_SENSE) break;
      if (!meaning || meaning.length > MAX_MEANING_LENGTH || seen.has(meaning.toLocaleLowerCase())) continue;
      for (const part of parts(meaning)) seen.add(part);
      set.add(meaning);
    }
  };

  for (const entry of vi) {
    if (!entry?.word || entry.lang_code !== "en") continue;
    const meanings = [];
    for (const sense of entry.senses ?? []) {
      const gloss = sense.glosses?.[0];
      const base = sense.form_of?.[0]?.word ?? (typeof gloss === "string" ? gloss.trim().match(FORM_OF_GLOSS)?.[1] : undefined);
      if (base) {
        const headword = clean(entry.word).toLocaleLowerCase();
        if (!formsOf.has(headword)) formsOf.set(headword, []);
        formsOf.get(headword).push(clean(base).toLocaleLowerCase());
      } else if (typeof gloss === "string") {
        meanings.push(cleanGloss(gloss));
      }
    }
    if (meanings.length) add(entry.word, entry.pos, meanings);
  }

  for (const entry of en) {
    if (!entry?.word || (entry.lang_code && entry.lang_code !== "en")) continue;
    // Newer extracts put translations on the entry, older ones inside each sense.
    const translations = [...(entry.translations ?? []), ...(entry.senses ?? []).flatMap((sense) => sense.translations ?? [])];
    const meanings = translations
      .filter((translation) => (translation.lang_code ?? translation.code) === targetLanguage)
      .map((translation) => clean(translation.word));
    if (meanings.some(Boolean)) add(entry.word, entry.pos, meanings);
  }

  const entries = {};
  for (const headword of [...new Set([...words.keys(), ...formsOf.keys()])].sort()) {
    const own = words.get(headword);
    const base = (formsOf.get(headword) ?? []).find((word) => word !== headword && words.has(word));
    if (!own && base) {
      // Pure inflection: point at the base word so the card can say "from go".
      entries[headword] = base;
    } else if (own) {
      // Mixed ("running" is a noun and a form of "run"): its own meanings, then the base word's.
      if (base) for (const [pos, set] of words.get(base)) add(headword, pos, [...set]);
      entries[headword] = [...own].map(([pos, set]) => [pos, [...set]]).filter(([, meanings]) => meanings.length);
    }
  }
  return { v: 1, source: SOURCE, entries };
}

function clean(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** "To lớn, đồ sộ; chắc nặng." → "to lớn, đồ sộ; chắc nặng". Keeps inner capitals ("Pháp") and all-caps words ("TV"). */
function cleanGloss(gloss) {
  const text = clean(gloss).replace(/[.。]+$/u, "");
  return /^\p{Lu}(?!\p{Lu})/u.test(text) ? text[0].toLocaleLowerCase() + text.slice(1) : text;
}

/** The whole meaning and its comma/semicolon-separated parts, lowercased. */
function parts(meaning) {
  const lower = meaning.toLocaleLowerCase();
  return [lower, ...lower.split(/[,;]/).map((part) => part.trim()).filter(Boolean)];
}

async function* readJsonLines(path) {
  const input = createReadStream(path);
  const stream = path.endsWith(".gz") ? input.pipe(createGunzip()) : input;
  const lines = createInterface({ input: stream.setEncoding("utf8"), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // Skip a malformed line rather than failing a multi-GB run.
    }
  }
}

/** Only the fields buildDictionary reads, and only from English entries, so multi-GB dumps fit in memory. */
async function readEntries(path, keep) {
  const entries = [];
  if (!path) return entries;
  for await (const entry of readJsonLines(path)) {
    if (entry.lang_code && entry.lang_code !== "en") continue;
    const slim = {
      word: entry.word,
      pos: entry.pos,
      lang_code: entry.lang_code,
      translations: entry.translations,
      senses: entry.senses?.map((sense) => ({ glosses: sense.glosses, form_of: sense.form_of, translations: sense.translations }))
    };
    if (keep(slim)) entries.push(slim);
  }
  return entries;
}

async function main() {
  const { values } = parseArgs({ options: { vi: { type: "string" }, en: { type: "string" }, out: { type: "string" } } });
  if (!values.vi && !values.en) {
    console.error("Usage: node scripts/build-dictionary.mjs --vi <viwiktionary .jsonl[.gz]> --en <English .jsonl[.gz]> [--out file.json]");
    process.exit(1);
  }
  const output = values.out ?? fileURLToPath(new URL("../public/dict/en-vi.json", import.meta.url));
  const vi = await readEntries(values.vi, (entry) => entry.lang_code === "en");
  const en = await readEntries(values.en, (entry) => Object.keys(buildDictionary({ en: [entry] }).entries).length > 0);
  const dictionary = buildDictionary({ vi, en });
  const json = JSON.stringify(dictionary);
  await writeFile(output, json);
  const values_ = Object.values(dictionary.entries);
  const pointers = values_.filter((entry) => typeof entry === "string").length;
  console.log(
    `${output}: ${values_.length} headwords (${pointers} form pointers), ${(Buffer.byteLength(json) / 1e6).toFixed(2)} MB raw, ${(gzipSync(json).length / 1e6).toFixed(2)} MB gzipped`
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
