# ADR-0004: Bundled Wiktionary dictionary before machine translation

- Status: Accepted (2026-09-24)
- Spec: `.ai/specs/002-single-word-dictionary/`

## Context

Most selections are single words, and the offline model (opus-mt) is poor at them ("massive" → "chứa"). Chrome's Translator API is better but returns one meaning and is only on desktop Chrome 138+ after a download. Learners want every meaning of a word, and a wrong translation saved on a card gets drilled by spaced repetition.

## Decision

1. **A third, first engine:** a bilingual dictionary answers words and phrases of up to 4 words; misses and sentences fall through to Chrome's API, then opus-mt. Lookup rules live in `shared` (`findEntry`, `formatMeanings`); the extension loads the file once in the offscreen document.
2. **Bundled, not downloaded:** `apps/extension/public/dict/en-vi.json` (~10 MB, ~2.6 MB gzipped) ships in the extension, so lookups work offline from install.
3. **Data from Wiktionary (CC BY-SA 4.0)** via kaikki.org, Vietnamese Wiktionary first and English Wiktionary appended, built by hand with `scripts/build-dictionary.mjs` and committed. Builds never need the network. Attribution: `public/dict/NOTICE` and the Options page.
4. **Inflected forms are pointers** in the file ("went" → "go"), plus rule-based base-form guesses at lookup time. Card identity is unchanged: the card keeps the selected word.

## Consequences

- The extension grows by ~10 MB unpacked; the offscreen document parses the file once (~0.1 s, ~45 MB heap).
- The derived data file is CC BY-SA 4.0 and must keep its attribution.
- Coverage and quality follow Wiktionary: some glosses are long or odd; phrasal verbs are thin ("give in" is missing). Rebuilding picks up upstream improvements.
- Adding a language pair is a data task: build a file and list it in `DICTIONARIES`.
