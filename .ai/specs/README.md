# Feature specs

Every non-trivial feature gets a folder `NNN-slug/` with three files:

| File | Question it answers | Written when |
| --- | --- | --- |
| `design.md` | What are we building and why, and how does it fit the architecture? | Before any code; approved by the user |
| `task.md` | What are the small, ordered, verifiable steps? | After design approval |
| `implement.md` | What actually happened: decisions, deviations, verification? | During implementation (append-only) |

Workflow: [`.agent/workflows/spec.md`](../../.agent/workflows/spec.md). In Claude Code run `/spec <idea>` to start, `/spec <NNN>` to continue, `/spec list` for this table. Start new specs from [`_template/`](_template/).

Small bug fixes and copy tweaks do not need a spec.

## Index

| Spec | Title | Status |
| --- | --- | --- |
| [000](000-v0.2-revamp/design.md) | v0.2 revamp: NestJS, on-device translation, simpler sync | Done |
| [001](001-mobile-apps/design.md) | Mobile apps (Android ML Kit, iOS Translation) | Draft |
| [002](002-single-word-dictionary/design.md) | Dictionary lookup for single words | Approved |
