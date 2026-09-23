# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vocabulary OS: select a word while reading in Chrome → translate it **on-device** → save it with its sentence → review with spaced repetition → optionally sync to a web dashboard. A pnpm monorepo, TypeScript everywhere:

- `packages/shared`: the domain. `Card` type, SRS scheduler (`gradeCard`), sync merge rules, stats, zod API schemas. **All domain logic goes here**; the apps only do I/O and UI.
- `apps/extension`: Chrome MV3, local-first (Dexie/IndexedDB), works offline and logged out.
- `apps/api`: NestJS + Prisma + Postgres. Auth (30-day JWT), cards, review, stats, `POST /sync`.
- `apps/web`: React + Vite + Tailwind dashboard; talks only to the API.

Read `.ai/context/architecture.md` before cross-app work, and `.ai/context/conventions.md` for recipes (add an endpoint, an extension message, a Card field, a translation pair).

## Commands

pnpm may not be installed globally; `corepack pnpm <cmd>` works the same.

```bash
pnpm install                 # postinstall builds packages/shared
cp apps/api/.env.example apps/api/.env
pnpm db:up && pnpm db:migrate   # Postgres in Docker (:5432, db vocabulary_os) + Prisma migrations
pnpm dev                     # shared tsc --watch, api :3000, web :5173, extension build --watch
pnpm typecheck && pnpm test && pnpm build
pnpm --filter @vocab-os/extension exec vitest run src/lib/db.test.ts -t "revives"   # single test
```

Load the extension from `apps/extension/dist` (chrome://extensions → Developer mode → Load unpacked), then reload it after rebuilds.

## Things that are easy to get wrong

- **Card identity is the word:** `id = "<targetLanguage>:<normalized word>"` (`cardId`). Never generate UUIDs for cards. The word text cannot be edited (delete and re-add).
- **Every card change must bump `updatedAt`.** Sync is last-write-wins on it. Use the `shared` helpers (`gradeCard`, `applyPatch`, `markDeleted`), which do this. Deletes are tombstones (`deletedAt`).
- **Sync pull cursors use the server's `syncedAt`**, never client clocks. `/sync` also returns the stored copy of every pushed card; clients rely on that to clear `dirty`.
- **`packages/shared` must be built** (`dist/`) for the API and Vite to see changes. `pnpm dev` watches it; otherwise run `pnpm --filter @vocab-os/shared build`.
- **The API is CommonJS** importing ESM `shared` via Node's `require(esm)`, so it needs Node ≥ 22.12. Keep `shared` free of top-level await.
- **The content script is built separately** as a single IIFE (`vite.content.config.ts`, run by `build.mjs`); it cannot share chunks with other entries.
- **Translation runs in the offscreen document** (`src/offscreen/translator.ts`): Chrome's Translator API if `available`, else transformers.js `Xenova/opus-mt-en-vi` (q8, WASM). `env.backends.onnx.wasm.wasmPaths` is cleared on purpose, because the default CDN path is blocked by MV3 CSP and the Vite-bundled WASM is used instead. The manifest CSP needs `'wasm-unsafe-eval'`.
- **Extension messages are typed:** add to `Messages` in `src/lib/messages.ts`, then to `handlers` in `src/background/index.ts`.
- **API routes are authenticated by default** (global `AuthGuard`); mark public ones `@Public()`. Validate bodies with `@Body(new ZodPipe(schema))` using schemas from `shared`.
- **Dexie schema changes** need a new `version(n)`; Prisma changes need `pnpm db:migrate`.
- Dependency majors are pinned on purpose (ADR-0003); upgrading one is its own spec.

## Spec mode

Non-trivial features use `/spec` (`.claude/skills/spec/SKILL.md` → `.agent/workflows/spec.md`). Each feature gets `.ai/specs/NNN-slug/{design,task,implement}.md`: design (stop for approval) → tasks (stop) → implement (update checkboxes and log after every task). The index is `.ai/specs/README.md`; decisions go in `.ai/decisions/`.

## Deployment

`.ai/context/deployment.md` has the full guide. In short: API on any Node 22.12+ host (`render.yaml` blueprint, or `apps/api/Dockerfile` for containers), web as static files on Cloudflare Pages or Vercel (`vercel.json`), extension zipped from `dist/` to the Chrome Web Store. The extension's production URLs are baked in at build time with `VITE_API_URL` and `VITE_DASHBOARD_URL`.

## Legacy

v0.1 (Spring Boot backend, Fastify API, LibreTranslate, gamification, server-side AI) was removed in the v0.2 revamp; see `.ai/specs/000-v0.2-revamp/` and ADR-0003. The old code is no longer on disk. Do not port anything back without a spec.
