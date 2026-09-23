# v0.2 revamp: NestJS, on-device translation, simpler sync

- Spec: 000-v0.2-revamp
- Status: Done
- Created: 2026-09-18

## Problem

v0.1 had two backends (Fastify, Spring Boot), a LibreTranslate Docker service, gamification and AI features spread over three languages and about 24k lines of source. It was slow to change and awkward to deploy. Sync also lost review progress: pulled cards had their schedules reset.

## Goals

- One language (TypeScript) and one shared domain package for extension, web and API.
- Translation on-device, with no translation server to run.
- A backend that deploys anywhere Node + Postgres runs.
- Sync that cannot duplicate words or lose review progress.

## Non-goals

- Gamification (XP, badges, levels), server-side AI features, and CSV import/export: dropped.
- Mobile apps: spec 001.
- Review history analytics: stats stay approximate (derived from cards).

## User flow

Unchanged for users: select text → **V** button → translation → **Save word** → review in the popup or web dashboard. Signing in (optional) syncs words between browsers and the dashboard.

## Design

### Affected parts

| Part | Change |
| --- | --- |
| `packages/shared` | New: `Card`, `cardId`, `gradeCard` (SRS), `mergeRemote`/`shouldAcceptIncoming` (sync), `computeStats`, zod API schemas |
| `apps/api` | New NestJS app: auth (JWT), cards CRUD + review + stats, `/sync`. Prisma: `User`, `Card` (PK `userId,id`) |
| `apps/web` | Rewritten: login, dashboard, words (search/edit/delete/add), review |
| `apps/extension` | Rewritten: typed messages, Dexie `cards` store with a dirty flag, offscreen translator (Chrome API → transformers.js opus-mt), LWW sync, one-time import of v0.1 words |
| Removed | `apps/backend` (Java), `apps/libretranslate`, old `apps/api` (Fastify), `packages/db`, `packages/srs`, `docs/`, `tmp/` (moved to `../vocabulary-os-legacy-20260918/`) |

### Data and contracts

- Card id = `targetLanguage:normalizedWord`; `updatedAt` is the LWW version; deletes are tombstones.
- `POST /sync {cursor, changes}` → `{cursor, changes}`. The cursor is the server time; the server re-sends a 60 s overlap and returns stored copies of pushed cards.
- v0.1 local data is imported once from the IndexedDB database `vocabulary-os-local-mvp`. v0.1 server data (Spring DB) is not migrated. Users sign in again and the extension re-uploads its local words.

### Edge cases and failure modes

- Offline or server down: save and review work locally; the sync error is shown and retried on the next change or popup open.
- Clock skew between devices: pull cursors use the server clock; LWW between devices still uses device clocks (accepted).
- The same word saved on two devices: same id, and the newest version wins.
- Token expired (401): the extension signs out and keeps local words; the web app returns to login.

## Alternatives considered

- **Keep Spring Boot**: two languages and duplicated logic, which is what we wanted to remove.
- **Server-generated UUIDs**: needs id mapping and duplicate merging (the v0.1 complexity).
- **CRDT sync**: overkill for single-user cards.
- **Latest majors (Nest 12, Prisma 7/8, transformers.js 4, TS 7)**: not verified for this setup yet, so pinned to known-good majors (ADR-0003).

## Risks and open questions

- [x] Does transformers.js load its WASM inside MV3 without a CDN? Yes: bundled by Vite once the default CDN `wasmPaths` is cleared (verified in Chrome).
- [ ] opus-mt single-word quality is poor ("massive" → "chứa"). Possible follow-up: dictionary lookup for single words.

## Acceptance criteria

- [x] `pnpm typecheck && pnpm test && pnpm build` passes for all packages
- [x] API: register/login, cards CRUD, review, stats, validation errors, 401 without a token
- [x] Sync: two devices converge; tombstones propagate; stale pushes are rejected and corrected; revive works; UTF-8 preserved
- [x] Offline model translates in the browser and is cached after the first download
- [ ] Manual: load `apps/extension/dist` unpacked, then select → translate → save → review → sign in → sync (needs a human in Chrome)
