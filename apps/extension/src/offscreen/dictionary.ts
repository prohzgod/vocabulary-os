import { findEntry, formatMeanings, normalizeWord, type DictionaryFile, type Sense } from "@vocab-os/shared";
import type { TranslateResult, TranslatorStatus } from "../lib/messages.js";
import type { LanguagePair } from "./translator.js";

/**
 * Bundled dictionaries in public/dict/, keyed "source>target". Words and short
 * phrases found here skip machine translation. To add a pair, build its file
 * with scripts/build-dictionary.mjs and list it here.
 */
const DICTIONARIES: Record<string, string> = {
  "en>vi": "dict/en-vi.json"
};

/** The inline card shows at most this much, and the card saves exactly what is shown. */
const MAX_PARTS_OF_SPEECH = 3;
const MAX_MEANINGS = 5;

const loaded = new Map<string, Promise<DictionaryFile | null>>();

/** The pair's dictionary, loaded once and kept in memory; null if there is none or it cannot be read. */
export function loadDictionary(pair: LanguagePair): Promise<DictionaryFile | null> {
  const key = `${pair.sourceLanguage}>${pair.targetLanguage}`;
  const path = DICTIONARIES[key];
  if (!path) return Promise.resolve(null);
  if (!loaded.has(key)) {
    loaded.set(key, fetch(chrome.runtime.getURL(path))
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const file = (await response.json()) as DictionaryFile;
        if (file?.v !== 1 || typeof file.entries !== "object" || !file.entries) throw new Error("unknown format");
        return file;
      })
      .catch((error: unknown) => {
        // A missing or broken file only means machine translation is used instead.
        console.warn(`Vocabulary OS: dictionary ${path} is unavailable:`, error);
        return null;
      }));
  }
  return loaded.get(key)!;
}

/** Dictionary meanings for a word or short phrase, or null to fall through to machine translation. */
export async function lookup(text: string, pair: LanguagePair): Promise<TranslateResult | null> {
  const dictionary = await loadDictionary(pair);
  const match = dictionary && findEntry(dictionary.entries, text);
  if (!match) return null;
  const senses = match.senses.slice(0, MAX_PARTS_OF_SPEECH).map(([pos, meanings]): Sense => [pos, meanings.slice(0, MAX_MEANINGS)]);
  return {
    translation: formatMeanings(senses),
    engine: "dictionary",
    senses,
    ...(match.headword.toLocaleLowerCase() !== normalizeWord(text) ? { headword: match.headword } : {})
  };
}

export async function dictionaryStatus(pair: LanguagePair): Promise<TranslatorStatus["dictionary"]> {
  const dictionary = await loadDictionary(pair);
  return dictionary && { entries: Object.keys(dictionary.entries).length, source: dictionary.source };
}
