# Tasks: Dictionary lookup for single words

Spec `002-single-word-dictionary` · [design](design.md) · [implementation log](implement.md)

Legend: `[ ]` todo · `[~]` in progress · `[x]` done and verified · `[-]` dropped (reason in implement.md)

Rules: each task is one concern and small (about an hour or less), ordered so that typecheck and tests pass after every task, and says how to verify it.

## Tasks

- [x] **T1: Dictionary domain in `shared`**
  - Files: `packages/shared/src/dictionary.ts`, `packages/shared/src/index.ts`, `packages/shared/src/shared.test.ts`
  - Do: `Sense` (`[pos, meanings[]]`), `DictionaryFile` (`{ v, source, entries }`) types; `lookupCandidates(text)` (exact → lowercase → base-form guesses: -s, -es, -ies→y, -ed, -ing, doubled consonant, -ed/-ing + e); `findEntry(entries, text)` → `{ headword, senses } | null`, only for ≤ 4 words; `formatMeanings(senses, max = 500)` (dedupe, `; `-join, cut at a `; ` boundary). No top-level await.
  - Verify: `pnpm --filter @vocab-os/shared test` covers "massive", "Massive", "running"→"run", "studies"→"study", "look up", 5-word text → null, dedupe, 500-char cap; `pnpm --filter @vocab-os/shared build`

- [x] **T2: Dictionary build script**
  - Files: `apps/extension/scripts/build-dictionary.mjs`, `apps/extension/scripts/fixtures/kaikki-sample.jsonl`, `apps/extension/scripts/build-dictionary.test.mjs`, `apps/extension/public/dict/NOTICE`
  - Do: read a kaikki.org English JSONL dump (path argument), keep `translations` with `lang_code: "vi"`, group by lowercase headword and part of speech, drop empty/duplicate meanings, cap meanings per sense, write `public/dict/en-vi.json` in the design's format and print entry count + byte size. Export the pure transform for the test. NOTICE carries the Wiktionary CC BY-SA 4.0 attribution.
  - Verify: `pnpm --filter @vocab-os/extension exec vitest run scripts/build-dictionary.test.mjs` turns the fixture into the expected entries

- [x] **T3: Offscreen dictionary engine**
  - Files: `apps/extension/src/offscreen/dictionary.ts` (+ `.test.ts`), `apps/extension/src/offscreen/translator.ts`, `apps/extension/src/lib/messages.ts`
  - Do: lazy-load `dict/<src>-<tgt>.json` via `fetch(chrome.runtime.getURL(...))`, cache in memory, missing/broken file → `null` (logged once). `translate()` tries `findEntry` first and returns `{ translation: formatMeanings(senses), engine: "dictionary", senses, headword? }`; otherwise Chrome API → opus-mt unchanged. `TranslateResult` gains `"dictionary"`, `senses?`, `headword?`; `TranslatorStatus` gains `dictionary: { entries: number; source: string } | null`.
  - Verify: dictionary test with a stubbed `fetch` + fixture: hit, base-form hit, miss falls through, missing file falls through; `pnpm --filter @vocab-os/extension typecheck && pnpm --filter @vocab-os/extension test`

- [x] **T4: Inline card shows senses**
  - Files: `apps/extension/src/content/index.ts`
  - Do: when `result.senses` exists, render one row per part of speech (uppercase POS label + meanings joined with ` · `, display capped at 3 POS × 5 meanings), a "from *headword*" note when set, and "Dictionary" instead of "Translated on this device". Save still sends `result.translation`.
  - Verify: `pnpm --filter @vocab-os/extension typecheck && pnpm --filter @vocab-os/extension build`; manual check in T7

- [x] **T5: Options shows the dictionary**
  - Files: `apps/extension/src/options/main.tsx`
  - Do: in the translator section, show "Dictionary en → vi · N words" (or "No dictionary for this pair") and the "Wiktionary, CC BY-SA 4.0" credit link.
  - Verify: `pnpm --filter @vocab-os/extension typecheck && pnpm --filter @vocab-os/extension build`

- [ ] **T6: Build the real en→vi data file**
  - Files: `apps/extension/public/dict/en-vi.json`, `implement.md`
  - Do: download the kaikki.org English extract (needs network, see design open question), run the script, commit the output. Record entry count, raw/gzipped size and a spot check of ~20 common words (e.g. massive, run, book, light, look up) in the log. If coverage is poor, stop and ask.
  - Verify: file loads in the T3 test path; sizes and spot check logged

- [x] **T7: Docs and full check**
  - Files: `.ai/context/architecture.md` (Translation section, known limitation), `.ai/context/conventions.md` (recipe: add a dictionary pair), `CLAUDE.md` (translation bullet)
  - Do: document the dictionary-first chain, data file location, build script and license.
  - Verify: `pnpm typecheck && pnpm test && pnpm build`

- [ ] **T8 (added): Manual check with the real dictionary**
  - Files: none (log only)
  - Do: after T6, load `apps/extension/dist` unpacked in Chrome (needs a human, or a session with network access): select "massive" offline → meanings by POS → Save → card translation holds all meanings; select "running" → "from run"; select a sentence → machine translation (Chrome API or opus-mt) as before.
  - Verify: results logged in implement.md

## Done when

- [ ] Every acceptance criterion in design.md is met
- [ ] `pnpm typecheck && pnpm test && pnpm build` passes
- [ ] `.ai/context/*` updated if a documented fact changed; ADR added if an architectural decision was made
