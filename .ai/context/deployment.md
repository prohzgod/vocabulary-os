# Deployment

Three pieces, deployed separately:

| Piece | Type | Where it can run |
| --- | --- | --- |
| `apps/api` | Node server + Postgres | Render, Railway, Fly.io, any VPS (Dockerfile included) |
| `apps/web` | Static files | Cloudflare Pages, Vercel, Netlify (free) |
| `apps/extension` | Zipped `dist/` | Chrome Web Store ($5 one-time), or loaded unpacked |

Order: database → API → web → rebuild the extension pointing at the API → publish the extension.

## What never goes in git

`node_modules/`, `dist/`, `apps/api/.env`. All three are already in `.gitignore`. Everything else — source, lockfile, `prisma/migrations/`, `.ai/`, `.agent/` — belongs in the repo.

## 1. API

Environment variables:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `JWT_SECRET` | 32+ random characters. Changing it signs everyone out. |
| `PORT` | Usually set by the host |

Requires **Node ≥ 22.12** (the API is CommonJS and loads the ESM `shared` package through `require(esm)`).

### Render (simplest; `render.yaml` in the repo root)

New → Blueprint → pick the repo. It creates the web service and a Postgres database, and generates `JWT_SECRET`. Free plan caveats: the service sleeps after 15 minutes idle (first request ~30 s) and the free database is deleted after 30 days. The paid tiers are about $7/month each.

### Any container host (Fly.io, Railway, Cloudflare Containers, VPS)

```bash
docker build -f apps/api/Dockerfile -t vocabulary-os-api .    # from the repo root
docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_SECRET=... vocabulary-os-api
```

The container runs `prisma migrate deploy` at start-up, then the server.

### Plain Node host

```bash
pnpm install --frozen-lockfile
pnpm --filter @vocab-os/api build
pnpm --filter @vocab-os/api db:deploy
node apps/api/dist/main.js
```

### Managed Postgres (Neon)

Create a project at [neon.tech](https://neon.tech) and copy the **direct** connection string — the host has no `-pooler` in it — into `DATABASE_URL`:

```
postgresql://user:password@ep-something.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

Use the direct string, not the pooled one: the API is a single long-running process that does not need PgBouncer, and `prisma migrate deploy` takes advisory locks that transaction pooling breaks. Only switch to the pooled string (keeping the direct one in `directUrl` in `schema.prisma`) if the API ever runs serverless or across many instances.

Free-tier behaviour: the database sleeps after ~5 minutes idle, so the first query afterwards takes a second or two. Supabase and Render Postgres work the same way, except Render's free database is deleted after 30 days.

Apply the schema either by deploying (the Render build and the Docker image both run `prisma migrate deploy`), or locally:

```bash
# with the connection string in apps/api/.env
pnpm --filter @vocab-os/api db:deploy
```

## 2. Web dashboard

Hash routing (`#/words`) means no SPA rewrite rules are needed.

**Cloudflare Pages:** Build command `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @vocab-os/web build`, output directory `apps/web/dist`, environment variables `VITE_API_URL=https://your-api` and `NODE_VERSION=22.23.2`.

**Vercel:** `vercel.json` in the repo root already sets the install, build and output settings. Add `VITE_API_URL` in project settings.

`VITE_API_URL` is baked in at build time, so changing it needs a redeploy.

## 3. Extension

Build it pointing at production:

```bash
VITE_API_URL=https://your-api VITE_DASHBOARD_URL=https://your-dashboard pnpm --filter @vocab-os/extension build
```

On Windows PowerShell: `$env:VITE_API_URL="https://your-api"; pnpm --filter @vocab-os/extension build`.

Zip the **contents** of `apps/extension/dist` (manifest.json at the top level) and upload it at the [Chrome Web Store dashboard](https://chrome.google.com/webstore/devconsole) ($5 one-time fee).

Review notes:

- The store asks why the extension needs access to all sites. The honest reason: the content script shows a translate button on text the user selects on any page.
- Declare data use: words and translations are stored locally, and sent to the user's own server only if they sign in. Translation itself never leaves the device.
- The package is about 22 MB (the ONNX Runtime WASM). Well under the 2 GB limit.
- Users who installed an earlier build keep their saved settings, including the old localhost server URL. They change it in Options.

## Costs

Free path: Neon or Render free Postgres + Render free API + Cloudflare Pages = $0, with a sleeping API. A comfortable setup is roughly $7/month (always-on API) plus $5 once for the store.

## After deploying

- `GET https://your-api/health` returns `{"ok":true}`.
- Register a user in the web app, save a word in the extension, and check that it appears on the dashboard.
- Rate limits: 300 requests/minute per IP overall, 10/minute on `/auth/*`.
