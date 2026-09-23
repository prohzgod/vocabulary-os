# ADR-0001: MVP as a TypeScript monorepo

- Status: Accepted (2026-06), partly superseded by ADR-0003
- Context: prove the core loop quickly (select, translate, save, review) with a Chrome extension, a web app and an API sharing contracts.
- Decision: pnpm monorepo; Chrome MV3 extension (React + Vite); React web app; Fastify API with Prisma/Postgres; shared TypeScript packages; IndexedDB (Dexie) for local-first storage.
- Consequences: fast iteration and shared types. The Fastify API was later replaced (ADR-0002, then ADR-0003).
