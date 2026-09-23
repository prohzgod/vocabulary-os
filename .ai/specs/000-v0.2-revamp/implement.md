# Implementation log: v0.2 revamp

Spec `000-v0.2-revamp` · [design](design.md) · [tasks](task.md)

## Summary

- Shipped: NestJS API, rewritten extension and web app, shared domain package, on-device translation, LWW sync, spec workflow.
- Deviations from design: none in scope. Tooling details are below.
- Follow-ups: spec 001 (mobile); better single-word translations; review history for accurate streaks; token revocation if needed; automated browser E2E.

## Log

### 2026-09-18: T1 legacy removal

- Deleting in place was blocked by a safety check, so the legacy code was **moved** to `../vocabulary-os-legacy-20260918/` (reversible), after taking a tarball backup.

### 2026-09-18: T2–T4 shared + API

- Versions pinned to majors verified here (see ADR-0003). pnpm run via `corepack pnpm` (not installed globally), so the root `postinstall` calls `tsc` directly instead of `pnpm --filter`.
- The API is CommonJS and imports the ESM `shared` build via `require(esm)` (Node ≥ 22.12). Types resolve with `module: nodenext` (TS 5.8+).
- The Docker DB is named `vocabulary_os` so it does not collide with older `vocab_os`/`vocab_os_backend` databases in an existing volume.
- Verified: curl smoke tests (health, 401, zod 400, register/login/me, create, 409 duplicate, review, patch, stats, bad time zone 400) and a two-device sync script, 10/10 PASS.

### 2026-09-18: T5–T7 extension

- Content scripts cannot be ES modules, so they are built separately as an IIFE (`vite.content.config.ts`); `build.mjs` runs both builds and supports `--watch`.
- transformers.js sets ONNX `wasmPaths` to jsDelivr by default, which MV3 CSP blocks. Setting it to `undefined` makes onnxruntime-web use the WASM Vite already bundled. An earlier approach that copied the files ourselves shipped the 21 MB WASM twice and was dropped.
- `pipeline()` overload types made TS fail with "union type too complex"; wrapped in a narrowly typed helper.
- Bug caught by tests: `regex.test` moved `lastIndex`, so `matchAll` skipped the first match. Reset before `matchAll`.
- Verified in Chrome via a harness page built from `translator.ts`. Chrome's Translator API was present and reported `downloadable` for en→vi. Offline model: first run 11.8 s (download and load), cached cold start 3.7 s, about 0.2 s per call. "The quick brown fox jumps over the lazy dog." → "Con cáo nhanh chóng nhảy lên con chó lười." Single word "massive" → "chứa" (poor; see design risks).

### 2026-09-18: T8–T9 web + docs

- Web: hash router, `useLoad` hook, Tailwind; pages Login / Dashboard / Words / Review.
- Docs: `.ai/` (context, decisions, specs), `.agent/` (rules, spec workflow), `.claude/skills/spec`, `CLAUDE.md`, `README.md`.
