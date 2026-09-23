# Architecture

Vocabulary OS turns reading into long-term memory:

```
select a word → translate on-device → save with its sentence → review with spaced repetition → see progress
```

## Pieces

```
packages/shared   Card type, SRS scheduler, sync merge rules, stats, zod API schemas
      ▲  ▲  ▲       (the only place domain logic lives; everything below imports it)
      │  │  └──────────────────────────────┐
      │  └───────────────┐                 │
apps/extension         apps/web          apps/api
Chrome MV3             React + Vite      NestJS + Prisma + Postgres
local-first            talks to API      auth, cards, review, stats, sync
IndexedDB (Dexie)      only
```

- The **extension** is the main product and works fully offline and logged out.
- The **web** dashboard is online-only and reads and writes through the API.
- The **API** stores cards per user and merges changes from any number of devices.

## The Card

Everything is a `Card` (`packages/shared/src/card.ts`): the word, its translation and context, plus SRS fields (`state`, `ease`, `intervalDays`, `repetitions`, `lapses`, `dueAt`).

- **Identity is the word.** `id = "<targetLanguage>:<normalized word>"`, e.g. `vi:look up`. The same word saved on two devices is the same card, so sync can never create duplicates. Editing the word text means delete and re-add. Translation, context and tags can be edited.
- **`updatedAt` is the version.** Every change (edit, review, delete) sets it to "now" on the device that made the change.
- **Deletes are tombstones** (`deletedAt` set). Saving a deleted word again revives it as a fresh card.

## Spaced repetition

`gradeCard(card, grade)` in `packages/shared/src/srs.ts` is a simplified SM-2 and the only scheduler anywhere. The extension grades locally; the web app grades through `POST /cards/:id/review`, which calls the same function on the server.

| Grade | Effect |
| --- | --- |
| again | back in 10 min, ease −0.2, repetitions reset, lapse +1 |
| hard | interval ×1.2, ease −0.15, state `learning` |
| good | 1 day → 3 days → interval × ease |
| easy | 3 days → interval × ease × 1.3, ease +0.15 |

A card is `mastered` once its interval reaches 30 days.

## Sync (extension ↔ API)

Last-write-wins per card, one endpoint: `POST /sync { cursor, changes }` → `{ cursor, changes }`.

1. The extension marks every local change `dirty: 1` (IndexedDB) and sends dirty cards in batches of up to 500.
2. The server accepts an incoming card only if `incoming.updatedAt > stored.updatedAt` (`shouldAcceptIncoming`).
3. The server returns every card whose server-side `syncedAt` is newer than the cursor, **plus** the stored copy of every pushed card.
4. The client merges each returned card with `mergeRemote`: `take` (newer), `clean` (same version, clear dirty) or `keep` (local is newer and stays dirty).

Why it is safe:

- **Cursors use the server clock** (`Card.syncedAt`), never client clocks. The server re-sends a 60 s overlap window to cover in-flight writes; re-sent cards are harmless no-ops.
- **Returning pushed cards** means a rejected push still gets the winning version back, so nothing stays dirty forever.
- **Signing in** marks all local cards dirty, so words saved while logged out upload once. The server then keeps whichever version is newer.

Sync runs 2 s after any local change (debounced), whenever the popup opens, and on "Sync now". Failures are stored and shown, and never block saving or reviewing.

## Translation (extension only, on-device)

```
content script ──translate──▶ background worker ──▶ offscreen document
                                                    1. Chrome Translator API (if "available")
                                                    2. transformers.js + Xenova/opus-mt-en-vi (q8, WASM)
```

- The work runs in an **offscreen document** (`offscreen.html`), so the page being read never lags. The loaded model also survives service-worker restarts.
- **Chrome's built-in Translator API** (Chrome 138+) is preferred: tiny and fast. Its model downloads only after a user click, so the Options page has a "Download" button.
- The **offline model** (~100 MB) downloads from the Hugging Face Hub on first use and is then cached in Cache Storage. Measured on this machine: first run 11.8 s (download and load), cold start from cache 3.7 s, then about 0.2 s per translation.
- **MV3 forbids remote code.** The ONNX Runtime WASM is bundled by Vite, and `translator.ts` clears transformers.js's default CDN `wasmPaths` so the bundled copy is used. The manifest CSP adds `'wasm-unsafe-eval'`.
- **Language pairs:** Chrome's API supports many. The offline model only supports pairs listed in `LOCAL_MODELS` (currently `en>vi`).
- **Known limitation:** opus-mt is weak on isolated single words (e.g. "massive" → "chứa"). Sentences are good. Chrome's API is better for single words.

## Extension internals

| File | Role |
| --- | --- |
| `src/lib/messages.ts` | Typed message map: every request the background answers, with input/output types, plus `send()` |
| `src/background/index.ts` | Message router (`handlers` object, type-checked against `Messages`) |
| `src/background/sync.ts` | Account, token storage, sync loop |
| `src/background/offscreen.ts` | Creates the offscreen document and forwards translation calls |
| `src/offscreen/translator.ts` | Engine chain (Chrome API → transformers.js) |
| `src/lib/db.ts` | Dexie store: save, grade, delete, dirty tracking, merge |
| `src/content/*` | Selection button, inline popup (Shadow DOM), saved-word highlighting, DOM safety rules |
| `src/popup`, `src/options` | React UIs |
| `src/lib/legacy-import.ts` | One-time import from the v0.1 IndexedDB database (can be removed once no v0.1 users remain) |

The content script is built separately as one IIFE (`vite.content.config.ts`) because content scripts cannot be ES modules. `build.mjs` runs both builds.

## API internals

NestJS modules, one folder each: `auth` (register, login, JWT guard applied globally, `@Public()` to opt out), `cards` (CRUD, review, stats), `sync`, `prisma`. Request bodies are validated with the zod schemas from `@vocab-os/shared` through `ZodPipe`.

Auth is a single 30-day JWT (no refresh tokens) sent as a bearer token, so CORS can allow any origin. Trade-off: tokens cannot be revoked before expiry; rotating `JWT_SECRET` signs everyone out.
