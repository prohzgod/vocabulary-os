---
trigger: always_on
description: Core rules for working in the Vocabulary OS repository
---

# Vocabulary OS: agent rules

- Read `.ai/context/architecture.md` and `.ai/context/conventions.md` before changing code in more than one app.
- Domain logic (SRS scheduling, sync merge, stats, validation) lives only in `packages/shared`. Apps do I/O and UI.
- The extension must keep working offline and logged out. Network failures never block translate, save or review.
- Every change to a card bumps `updatedAt` (use the helpers in `shared`: `gradeCard`, `applyPatch`, `markDeleted`).
- Prisma schema changes need a migration (`pnpm db:migrate`). Dexie schema changes need a new `version(n)`.
- Non-trivial features follow the spec workflow in `.agent/workflows/spec.md` (files in `.ai/specs/`).
- Before finishing: `pnpm typecheck && pnpm test && pnpm build`.
