# Conventions

## General

- TypeScript everywhere, strict mode, `noUncheckedIndexedAccess`.
- **Domain logic goes in `packages/shared`**: anything that must behave the same in the extension, web and API, such as scheduling, merging, stats and validation. Apps only do I/O and UI.
- Prefer a few clear files over many tiny ones. A NestJS module, its controller and a small service may share one file (see `sync/sync.module.ts`); split only when a file gets hard to read.
- No new dependencies without a reason written in the spec's `design.md`.
- User-facing errors are plain sentences ("Cannot reach the server…"), not codes.
- Tests: Vitest. Put pure logic in `shared` and test it there. Extension tests use happy-dom + fake-indexeddb.

## Recipes

### Change the Card shape

1. `packages/shared/src/card.ts` (type, `createCard`) and `api.ts` (`cardSchema`).
2. `apps/api/prisma/schema.prisma`, then `pnpm db:migrate` (from the root) to create the migration. Update `cards/card.mapper.ts`.
3. The extension stores whole cards; if a new field needs an index, add a new `this.version(n)` in `apps/extension/src/lib/db.ts` (never edit an existing version).
4. Old clients may send cards without the new field; make it optional or give it a default in `cardSchema`.

### Add an API endpoint

1. Put the request schema and response type in `packages/shared/src/api.ts`.
2. Add the route in the relevant module (`apps/api/src/<module>/`). Validate the body with `@Body(new ZodPipe(schema))`. Routes are authenticated by default; use `@Public()` to opt out.
3. Call it from `apps/web/src/api.ts` and/or `apps/extension/src/background/*`.

### Add an extension message

1. Add `name: { input; output }` to `Messages` in `apps/extension/src/lib/messages.ts`.
2. Add the handler to `handlers` in `apps/extension/src/background/index.ts` (TypeScript errors until you do).
3. Call it with `await send("name", input)` from the content script, popup or options page.

### Add an offline translation pair

Add `"src>tgt": "Xenova/opus-mt-src-tgt"` to `LOCAL_MODELS` in `apps/extension/src/offscreen/translator.ts`. Check that the model exists on the Hub with ONNX weights.

### Add or rebuild a dictionary

1. Download the two kaikki.org extracts: Vietnamese Wiktionary `https://kaikki.org/viwiktionary/raw-wiktextract-data.jsonl.gz` (~34 MB) and English Wiktionary `https://kaikki.org/dictionary/English/kaikki.org-dictionary-English.jsonl` (~3 GB; `curl … | grep -F '"vi"' > en-vi-lines.jsonl` keeps only the ~600 MB that can matter).
2. `cd apps/extension && node scripts/build-dictionary.mjs --vi <vi .jsonl.gz> --en <English .jsonl> [--out public/dict/<src>-<tgt>.json]`. It prints headword count, form pointers and sizes. The target language is `TARGET_LANGUAGE` in the script (`vi`).
3. For a new pair, add `"src>tgt": "dict/<src>-<tgt>.json"` to `DICTIONARIES` in `apps/extension/src/offscreen/dictionary.ts`.
4. Commit the JSON. Keep `public/dict/NOTICE` (CC BY-SA 4.0 attribution) next to it.

## Commands

Run from the repo root (use `corepack pnpm …` if `pnpm` is not installed globally):

```bash
pnpm install          # also builds packages/shared (postinstall)
pnpm db:up            # Postgres in Docker
pnpm db:migrate       # apply/create Prisma migrations
pnpm dev              # shared (watch) + api :3000 + web :5173 + extension (watch → apps/extension/dist)
pnpm typecheck && pnpm test && pnpm build
```

Single test: `pnpm --filter @vocab-os/extension exec vitest run src/lib/db.test.ts -t "revives"`.

After changing `packages/shared`, the API picks the change up automatically in `pnpm dev` (shared runs `tsc --watch`). Otherwise run `pnpm --filter @vocab-os/shared build`.
