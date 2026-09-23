# Tasks: v0.2 revamp

Spec `000-v0.2-revamp` · [design](design.md) · [implementation log](implement.md)

Legend: `[ ]` todo · `[~]` in progress · `[x]` done and verified · `[-]` dropped (reason in implement.md)

## Tasks

- [x] **T1: Back up and move legacy code out of the repo**
  - Files: `apps/backend`, `apps/libretranslate`, `apps/api`, `packages/db`, `packages/srs`, `docs`, `tmp`
  - Verify: tarball `../vocabulary-os-backup-before-revamp-20260918.tar.gz` (488 files); legacy moved to `../vocabulary-os-legacy-20260918/`
- [x] **T2: Shared domain package**
  - Files: `packages/shared/src/{card,srs,sync,stats,api}.ts`
  - Verify: `pnpm --filter @vocab-os/shared test` (8 tests)
- [x] **T3: NestJS API + Prisma schema + migration**
  - Files: `apps/api/**`
  - Verify: `pnpm --filter @vocab-os/api build`; curl smoke test of every route
- [x] **T4: Sync endpoint**
  - Files: `apps/api/src/sync/sync.module.ts`
  - Verify: two-device Node script (10/10 checks)
- [x] **T5: Extension core (messages, settings, Dexie store, background, sync, legacy import)**
  - Files: `apps/extension/src/{lib,background}/**`
  - Verify: `pnpm --filter @vocab-os/extension test` (db tests)
- [x] **T6: On-device translation (offscreen + Chrome Translator API + transformers.js)**
  - Files: `apps/extension/src/offscreen/**`, `offscreen.html`, `public/manifest.json`, `vite.config.ts`
  - Verify: harness page in Chrome: offline model translates; cached reload
- [x] **T7: Content script, popup, options**
  - Files: `apps/extension/src/{content,popup,options,ui}/**`, `vite.content.config.ts`, `build.mjs`
  - Verify: `pnpm --filter @vocab-os/extension build` (content.js is a single IIFE)
- [x] **T8: Web dashboard rewrite**
  - Files: `apps/web/src/**`
  - Verify: `pnpm --filter @vocab-os/web build`
- [x] **T9: Docs, .ai/.agent, /spec skill, CLAUDE.md, README**
  - Verify: files present and links resolve
- [ ] **T10: Manual end-to-end in Chrome with the unpacked extension**
  - Verify: select → translate → save → popup review → sign in → word appears on the dashboard

## Done when

- [x] `pnpm typecheck && pnpm test && pnpm build` passes
- [x] `.ai/context/*` describes the new architecture; ADR-0003 written
- [ ] T10 checked by a human
