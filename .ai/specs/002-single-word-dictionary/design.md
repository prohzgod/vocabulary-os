# Dictionary lookup for single words

- Spec: 002-single-word-dictionary
- Status: In progress
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

- **Source:** English Wiktionary, via the kaikki.org JSON extract (English entries' `translations` where `lang_code = "vi"`). License CC BY-SA 4.0: attribution in Options and a `NOTICE` next to the data file.
- **File format** (`public/dict/en-vi.json`), keyed by lowercase headword:
  ```json
  { "v": 1, "source": "Wiktionary (CC BY-SA 4.0)", "entries": { "massive": [["adj", ["to lớn", "đồ sộ"]]] } }
  ```
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
- **OVDP / FreeDict en-vi**: possibly larger coverage, but licensing is unclear; Wiktionary is clearly licensed. Kept as a fallback if coverage is too low.

## Risks and open questions

- [ ] **Coverage and size are unmeasured.** Estimate: 15–30k headwords, 1–3 MB gzipped. Measure when building; if coverage of common words is poor, revisit the source.
- [ ] **This cloud container has no network access to kaikki.org**, so the data file must be built on a machine that has it (or the host allowed in the environment's network policy). The script and extension code can be done and tested with a small fixture file first.
- [x] Should the dictionary win over Chrome's Translator API for single words? Yes: dictionary first (approved with the design).
- [x] Is a setting to turn the dictionary off needed? No, until someone asks (approved with the design).
- [ ] CC BY-SA share-alike: bundling the derived data file is fine with attribution; confirm there is no concern about distributing it on the Chrome Web Store.

## Acceptance criteria

- [ ] Selecting a single word that is in the dictionary shows its meanings grouped by part of speech, with engine "dictionary", offline and logged out.
- [ ] Saving it stores all shown meanings, `; `-joined, ≤ 500 chars.
- [ ] An inflected form ("running") falls back to the base form and says so; the card word stays as selected.
- [ ] Sentences and unknown words still use Chrome API → opus-mt, unchanged.
- [ ] `lookupCandidates` and `formatMeanings` have unit tests in `shared`; the offscreen lookup has a test with a fixture dictionary.
- [ ] Options shows the dictionary (pair, entry count) and the Wiktionary CC BY-SA attribution.
- [ ] `pnpm typecheck && pnpm test && pnpm build` passes.
