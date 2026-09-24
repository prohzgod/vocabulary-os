# Dictionary lookup for single words

- Spec: 002-single-word-dictionary
- Status: Done
- Created: 2026-09-24

## Problem

Most selections are one word, and the offline model (opus-mt) is poor at isolated words: "massive" → "chứa" ([000 open risk](../000-v0.2-revamp/design.md#risks-and-open-questions)). A wrong translation gets saved into a card and then drilled by spaced repetition, so the learner memorizes a mistake. Chrome's Translator API is better but returns only one sense and is not available everywhere.

## Goals

- Single words and short fixed phrases ("look up", "give in") get dictionary meanings, grouped by part of speech, fully offline from install.
- The saved card's translation holds all shown meanings.
- Sentences and words missing from the dictionary behave exactly as today (Chrome API → opus-mt).

## Non-goals

- Lemmatizing card identity ("running" and "run" stay separate cards; the lookup only *falls back* to the base form).
- Pronunciation, IPA, example sentences, definitions in English.
- Pairs other than en→vi (the format supports more; adding one is a data task).
- Dictionary lookup in the web dashboard or API (the web "Add word" form stays manual).
- A user-facing setting to turn the dictionary off (see open questions).

## User flow

1. The user selects "massive" and clicks **V**.
2. The card shows the meanings instantly, grouped by part of speech:
   `ADJ  to lớn · đồ sộ · nặng`, with a small "Dictionary" note instead of "Translated on this device".
3. **Save word** stores the card with `translation = "to lớn; đồ sộ; nặng"`.
4. Selecting "running" finds no entry, falls back to "run", and shows its meanings with a note "from *run*". The card is still saved as "running".
5. Selecting a sentence, or a word not in the dictionary, shows the machine translation as today.

## Design

### Affected parts

| Part | Change |
| --- | --- |
| `packages/shared` | New `dictionary.ts`: `DictionaryEntry`/`Sense` types, `lookupCandidates(text)` (exact → lowercase → base-form guesses: -s, -es, -ies→y, -ed, -ing, doubled consonant), `formatMeanings(senses, max = 500)` (dedupe, `; `-joined, capped to fit `newCardSchema`'s 500-char translation), tests |
| `apps/api` | N/A |
| `apps/web` | N/A |
| `apps/extension` | Bundled data file `public/dict/en-vi.json`; offscreen `dictionary.ts` loads it lazily with `fetch(chrome.runtime.getURL(...))` and keeps it in memory; `translator.ts` tries it first for selections of ≤ 4 words; content card renders senses; Options shows dictionary size + attribution |
| `apps/extension/scripts/` | New `build-dictionary.mjs`: turns the upstream dump into the compact JSON. Run by hand, output committed, so normal builds need no network |

### Data and contracts

- **Sources** (both CC BY-SA 4.0, both from kaikki.org; attribution in Options and a `NOTICE` next to the data file), merged per headword and part of speech:
  1. **Vietnamese Wiktionary** (`kaikki.org/viwiktionary`, ~133k English entries): its Vietnamese glosses of English words come first. Added after T6 showed English Wiktionary alone covers too few common words (see [log](implement.md)).
  2. **English Wiktionary** (`kaikki.org/dictionary/English`): `translations` with `lang_code = "vi"`, appended after (adds phrases like "take off").
- **File format** (`public/dict/en-vi.json`), keyed by lowercase headword. A string value is an inflected form pointing at its base word (from Wiktionary's "form of" data: went → go, children → child):
  ```json
  { "v": 1, "source": "Wiktionary (CC BY-SA 4.0)", "entries": { "massive": [["adj", ["to lớn, đồ sộ; chắc nặng", "thô"]]], "went": "go" } }
  ```
  `findEntry` follows one pointer and reports the base word as `headword`, so the card says "from *go*". Expected size: ~120k headwords, ~11 MB raw, ~3 MB gzipped, parsed once in the offscreen document.
- **`TranslateResult`** (`src/lib/messages.ts`): `engine` gains `"dictionary"`; new optional `senses?: Sense[]` and `headword?: string` (set when a base-form fallback matched). `translation` is always filled (`formatMeanings`), so callers that ignore `senses` still work.
- **Card, zod schemas, Prisma, sync:** no change. The translation is a plain string ≤ 500 chars, as today.
- **Backward compatibility:** existing cards untouched. Old popup/options code keeps working because `translation` is unchanged in meaning.

### Edge cases and failure modes

- Offline / logged out: works; the file ships with the extension.
- Word not in dictionary, or selection > 4 words: falls through to Chrome API → opus-mt.
- Pair without a dictionary (settings changed to e.g. en→fr): dictionary skipped.
- Many meanings: display capped (e.g. 3 parts of speech × 5 meanings); saved string capped at 500 chars at a `; ` boundary.
- Proper nouns / capitalized selections: try exact case first, then lowercase.
- Base-form guess hits the wrong word ("sing" from "singed"): acceptable; the "from *sing*" note makes it visible and the user can still edit the translation later.
- Dictionary file fails to load: log once, fall through to machine translation.

## Alternatives considered

- **Download on first use** (like opus-mt): smaller install, but offline lookups fail until then. User chose bundling.
- **Show one meaning, let the user pick**: considered; user chose saving all meanings.
- **Look up in the background service worker**: it restarts often, so the file would be re-parsed repeatedly. The offscreen document already stays alive for the model.
- **Remote dictionary API**: breaks the on-device, offline promise.
- **OVDP / FreeDict en-vi**: licensing unclear; Vietnamese Wiktionary gives the coverage with a clear license.
- **English Wiktionary only**: small (0.26 MB gz) but missed "massive", "however", "consider", "went", "children".
- **Copy the base word's meanings into each inflected form** instead of a pointer: no format change, but loses the "from *go*" note and adds a few MB.

## Risks and open questions

- [x] **Coverage and size.** English Wiktionary alone: 16.7k headwords, 17/26 common words. Merged with Vietnamese Wiktionary (user's choice): see the T6 log for final numbers.
- [x] **Network access to kaikki.org**: allowed in the environment's network policy.
- [x] Should the dictionary win over Chrome's Translator API for single words? Yes: dictionary first (approved with the design).
- [x] Is a setting to turn the dictionary off needed? No, until someone asks (approved with the design).
- [ ] CC BY-SA share-alike: bundling the derived data file is fine with attribution; confirm there is no concern about distributing it on the Chrome Web Store.

## Acceptance criteria

- [x] Selecting a single word that is in the dictionary shows its meanings grouped by part of speech, with engine "dictionary", offline and logged out.
- [x] Saving it stores all shown meanings, `; `-joined, ≤ 500 chars.
- [x] An inflected form ("running") falls back to the base form and says so; the card word stays as selected.
- [x] Sentences and unknown words still use Chrome API → opus-mt, unchanged.
- [x] `lookupCandidates` and `formatMeanings` have unit tests in `shared`; the offscreen lookup has a test with a fixture dictionary.
- [x] Options shows the dictionary (pair, entry count) and the Wiktionary CC BY-SA attribution.
- [x] `pnpm typecheck && pnpm test && pnpm build` passes.
