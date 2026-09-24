/**
 * Builds the bundled en→vi dictionary (public/dict/en-vi.json) from the
 * English Wiktionary extract published by kaikki.org (wiktextract JSONL).
 *
 *   curl -O https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl
 *   node scripts/build-dictionary.mjs kaikki.org-dictionary-English.jsonl
 *
 * The output is committed, so normal builds never need the network.
 * Wiktionary content is CC BY-SA 4.0; keep public/dict/NOTICE next to the file.
 */
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export const TARGET_LANGUAGE = "vi";
export const MAX_MEANINGS_PER_SENSE = 8;
const SOURCE = "English Wiktionary via kaikki.org (CC BY-SA 4.0)";

/**
 * Turn wiktextract entries into the `DictionaryFile` shape from @vocab-os/shared:
 * `{ v, source, entries: { headword: [[pos, meanings[]], …] } }`, keyed by lowercase headword.
 */
export function buildDictionary(entries, targetLanguage = TARGET_LANGUAGE) {
  /** headword → pos → Set of meanings, in first-seen order. */
  const words = new Map();

  for (const entry of entries) {
    if (!entry?.word || (entry.lang_code && entry.lang_code !== "en")) continue;
    // Newer extracts put translations on the entry, older ones inside each sense.
    const translations = [...(entry.translations ?? []), ...(entry.senses ?? []).flatMap((sense) => sense.translations ?? [])];
    const meanings = translations
      .filter((translation) => (translation.lang_code ?? translation.code) === targetLanguage)
      .map((translation) => clean(translation.word))
      .filter(Boolean);
    if (!meanings.length) continue;

    const headword = clean(entry.word).toLocaleLowerCase();
    const pos = clean(entry.pos) || "other";
    if (!words.has(headword)) words.set(headword, new Map());
    const byPos = words.get(headword);
    if (!byPos.has(pos)) byPos.set(pos, new Set());
    const set = byPos.get(pos);
    for (const meaning of meanings) {
      if (set.size >= MAX_MEANINGS_PER_SENSE) break;
      set.add(meaning);
    }
  }

  const sorted = [...words.keys()].sort();
  return {
    v: 1,
    source: SOURCE,
    entries: Object.fromEntries(sorted.map((headword) => [headword, [...words.get(headword)].map(([pos, set]) => [pos, [...set]])]))
  };
}

function clean(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

async function* readJsonLines(path) {
  const lines = createInterface({ input: createReadStream(path, "utf8"), crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    try {
      yield JSON.parse(line);
    } catch {
      // Skip a malformed line rather than failing a multi-GB run.
    }
  }
}

async function main() {
  const [input, output = fileURLToPath(new URL("../public/dict/en-vi.json", import.meta.url))] = process.argv.slice(2);
  if (!input) {
    console.error("Usage: node scripts/build-dictionary.mjs <kaikki English .jsonl> [output.json]");
    process.exit(1);
  }
  // The dump is several GB, so keep only the few fields we need from entries with a Vietnamese translation.
  const entries = [];
  for await (const entry of readJsonLines(input)) {
    const slim = { word: entry.word, pos: entry.pos, lang_code: entry.lang_code, translations: entry.translations, senses: entry.senses?.map((sense) => ({ translations: sense.translations })) };
    if (buildDictionary([slim]).entries[clean(entry.word).toLocaleLowerCase()]) entries.push(slim);
  }
  const json = JSON.stringify(buildDictionary(entries));
  await writeFile(output, json);
  const count = Object.keys(JSON.parse(json).entries).length;
  console.log(`${output}: ${count} headwords, ${(json.length / 1e6).toFixed(2)} MB raw, ${(gzipSync(json).length / 1e6).toFixed(2)} MB gzipped`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
