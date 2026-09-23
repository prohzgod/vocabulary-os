# Vocabulary OS

Browser-native vocabulary memory: **translate, save, review, remember.**

Select a word on any page, get an on-device translation, save it with the sentence it came from, and review it with spaced repetition in the extension popup or the web dashboard.

```
apps/extension   Chrome extension (MV3). Local-first; works offline and without an account.
apps/web         Web dashboard (React). Words, review, progress.
apps/api         API (NestJS + Prisma + Postgres). Accounts and sync.
packages/shared  Card type, spaced-repetition scheduler, sync rules, API schemas.
```

## Translation, on your device

1. **Chrome's built-in Translator API** (Chrome 138+) when available. It is small and fast; enable its one-time download in the extension settings.
2. Otherwise **opus-mt-en-vi** runs locally with [transformers.js](https://huggingface.co/docs/transformers.js) (ONNX/WASM, ~100 MB). It downloads once on first use, then loads from cache.

No text leaves the browser for translation, and there is no translation server to host.

## Run locally

Requirements: Node ≥ 22.12, Docker (for Postgres), Chrome.

```bash
corepack enable                      # provides pnpm
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm db:up                           # Postgres on localhost:5432
pnpm db:migrate
pnpm dev                             # API :3000 · web :5173 · extension → apps/extension/dist (watch)
```

Load the extension: `chrome://extensions` → Developer mode → **Load unpacked** → `apps/extension/dist`.

Checks: `pnpm typecheck && pnpm test && pnpm build`.

## Deploy

Full guide: [`.ai/context/deployment.md`](.ai/context/deployment.md).

- **API** — any Node 22.12+ host with Postgres. `render.yaml` is a one-click Render blueprint; `apps/api/Dockerfile` builds a container for Fly.io, Railway or a VPS. Env: `DATABASE_URL`, `JWT_SECRET`, `PORT`.
- **Web** — static files. Cloudflare Pages or Vercel (`vercel.json` included), building with `VITE_API_URL` set.
- **Extension** — build with `VITE_API_URL` and `VITE_DASHBOARD_URL`, then zip `apps/extension/dist` for the Chrome Web Store.

## API

All routes except `/health` and `/auth/register|login` need `Authorization: Bearer <token>`.

```
GET    /health
POST   /auth/register      {email, password}  → {token, user}
POST   /auth/login         {email, password}  → {token, user}
GET    /auth/me
GET    /cards              active cards, newest first
GET    /cards/due?limit=50
POST   /cards              {word, translation, targetLanguage, …}
PATCH  /cards/:id          {translation?, context?, tags?}
POST   /cards/:id/review   {grade: again|hard|good|easy}
DELETE /cards/:id
GET    /stats?timeZone=Asia/Ho_Chi_Minh
POST   /sync               {cursor, changes[]} → {cursor, changes[]}
```

Card ids look like `vi:massive`; URL-encode them (`vi%3Amassive`).

## Working on the code

- Architecture and conventions: [`.ai/context/`](.ai/context/)
- Decisions: [`.ai/decisions/`](.ai/decisions/)
- Features are built through specs: [`.ai/specs/`](.ai/specs/). In Claude Code, run `/spec <idea>`.
