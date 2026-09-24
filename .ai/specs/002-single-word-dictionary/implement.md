# Implementation log: Dictionary lookup for single words

Spec `002-single-word-dictionary` · [design](design.md) · [tasks](task.md)

Append-only while building; newest entry at the bottom. Record what the code alone will not tell a future reader: decisions, deviations from the design, surprises, and how things were verified.

## Summary

_Fill in when the spec is Done._

- Shipped:
- Deviations from design:
- Follow-ups (new specs or issues):

## Log

### YYYY-MM-DD: T1 <title>

- Changed:
- Why / decisions:
- Verified:

### 2026-09-24: T1 Dictionary domain in `shared`

- Changed: `packages/shared/src/dictionary.ts` (`Sense`, `DictionaryFile`, `lookupCandidates`, `findEntry`, `formatMeanings`, `MAX_LOOKUP_WORDS = 4`), exported from `index.ts`; 5 tests in `shared.test.ts`.
- Why / decisions:
  - Base-form guesses also cover `-er`/`-est` (not in the design list; same cost, e.g. "bigger" → "big"). Only the first word of a phrase is inflected, so "looking up" → "look up".
  - `findEntry` uses `Object.hasOwn`, so selections like "constructor" or "__proto__" never match `Object.prototype`. Entries with only blank meanings count as misses.
  - `formatMeanings` dedupes case-insensitively and cuts at a `; ` boundary; a single meaning over 500 chars is truncated.
- Verified: `pnpm --filter @vocab-os/shared test` → 14 passed; `pnpm --filter @vocab-os/shared build` → no errors.

### 2026-09-24: T2 Dictionary build script

- Changed: `apps/extension/scripts/build-dictionary.mjs` (exports `buildDictionary`; CLI `node scripts/build-dictionary.mjs <dump.jsonl> [out.json]`), fixture `scripts/fixtures/kaikki-sample.jsonl`, test `scripts/build-dictionary.test.mjs`, `public/dict/NOTICE` (CC BY-SA 4.0 attribution).
- Why / decisions:
  - Test is `.mjs`, not `.ts` as planned: the script is plain Node ESM, and the extension's `tsconfig` only covers `src/`. It runs in the `node` vitest environment (happy-dom's `URL` rejects `file:` URLs).
  - Reads translations from both the entry and its senses, and both `lang_code` and the older `code` key, so older and newer wiktextract dumps work. Non-English entries and malformed lines are skipped.
  - The dump is several GB, so the CLI streams it line by line and keeps only entries that have a Vietnamese translation.
  - Headwords are lowercased (`findEntry` tries lowercase after the exact text); meanings are merged across etymologies per part of speech and capped at 8.
- Verified: `pnpm --filter @vocab-os/extension exec vitest run scripts/build-dictionary.test.mjs` → 1 passed.

### 2026-09-24: T3 Offscreen dictionary engine

- Changed: `apps/extension/src/offscreen/dictionary.ts` (`loadDictionary`, `lookup`, `dictionaryStatus`) + `dictionary.test.ts` (5 tests); `translator.ts` calls `lookup` before Chrome API → opus-mt and adds `dictionary` to `status()`; `messages.ts`: `TranslationEngine` gains `"dictionary"`, `TranslateResult` gains `senses?`/`headword?`, `TranslatorStatus` gains `dictionary`.
- Why / decisions:
  - Available dictionaries are listed in a `DICTIONARIES` map (like `LOCAL_MODELS`), so pairs without a file never trigger a failing fetch.
  - A load failure is cached as `null` for the life of the offscreen document (the file is bundled, so it will not appear later) and warned once.
  - `headword` is only set when it differs from the normalized selection, so "Massive" → "massive" shows no "from" note.
- Verified: `pnpm --filter @vocab-os/extension typecheck` → ok; `pnpm --filter @vocab-os/extension test` → 7 files, 29 passed.

### 2026-09-24: T4 Inline card shows senses

- Changed: `apps/extension/src/content/index.ts`: `senseList()` renders one row per part of speech (uppercase label + meanings joined with ` · `, first row larger), a "from *headword*" note, and "From the dictionary" in the footer. `offscreen/dictionary.ts` now caps senses at 3 parts of speech × 5 meanings (+1 test).
- Why / decisions: the cap moved from the card UI to `lookup()`, so `translation` is built from exactly the senses shown. That keeps the acceptance criterion "saving stores all *shown* meanings" true; otherwise the card would save meanings the user never saw.
- Verified: extension typecheck ok; `pnpm --filter @vocab-os/extension test` → 30 passed; `pnpm --filter @vocab-os/extension build` ok (`dist/dict/NOTICE` copied). Visual check is part of the manual test in T7.

### 2026-09-24: T5 Options shows the dictionary

- Changed: `apps/extension/src/options/main.tsx`: a "Dictionary" row first in the translator box (word count, Wiktionary + CC BY-SA 4.0 links, Ready / Not for this pair chip); the Chrome row now says it is used for sentences and words not in the dictionary.
- Why / decisions: phrased as a sentence ("… 12,345 words from Wiktionary, CC BY-SA 4.0") rather than the planned "Dictionary en → vi · N words", to match the other rows; the pair is already shown by the selects above.
- Verified: extension typecheck + build ok. **Browser check:** loaded the built `dist/` (with a 2-word sample `dict/en-vi.json`, not committed) unpacked into the preinstalled Chromium through Playwright:
  - "massive" → card shows `ADJ to lớn · đồ sộ · nặng` / `NOUN khối lớn`, "From the dictionary"; Save stored `translation = "to lớn; đồ sộ; nặng; khối lớn"` in IndexedDB, and the popup showed it due for review.
  - "running" → `VERB chạy · vận hành · điều hành` / `NOUN cuộc chạy`, "from *run*".
  - Options shows "Dictionary … 2 words from Wiktionary, CC BY-SA 4.0 · Ready".

### 2026-09-24: T6 Build the real en→vi data file (blocked)

- Not done. The environment's network policy denies `kaikki.org` (and `huggingface.co`): `curl` gets `CONNECT tunnel failed, response 403`. Until the file exists, `loadDictionary` warns once and every lookup falls through to machine translation, so shipping without it changes nothing for users.
- To unblock: on a machine with network access, run the recipe in `.ai/context/conventions.md` ("Add or rebuild a dictionary"), then commit `apps/extension/public/dict/en-vi.json`. Or allow `kaikki.org` in this environment's network policy and ask me to continue with `/spec 002`.

### 2026-09-24: T7 Docs and full check

- Changed: `.ai/context/architecture.md` (engine chain, dictionary paragraph, internals table, known limitation), `.ai/context/conventions.md` (recipe "Add or rebuild a dictionary"), `CLAUDE.md` (translation bullet).
- Why / decisions: the manual Chrome check moved to a new task T8 (added). The UI part was already checked in Chromium with a sample file (T5 log), but the real-data check and the sentence → machine-translation path need T6 and network access (the opus-mt download is blocked here too).
- Verified: `pnpm typecheck && pnpm test && pnpm build` → all pass (shared 14 tests, extension 30 tests, api/web no tests; every package builds).
