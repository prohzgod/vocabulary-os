---
description: Spec mode. Plan, then build, a feature through .ai/specs/<NNN-slug>/{design,task,implement}.md
---

# Spec workflow

This is the canonical spec workflow for any agent. Claude Code runs it through `/spec` (`.claude/skills/spec/SKILL.md`).

A spec moves through phases, and **each phase ends by stopping for the user**, except IMPLEMENT, which runs task by task until done or blocked.

```
NEW → DESIGN ──(user approves)──▶ TASKS ──(user says go)──▶ IMPLEMENT ──▶ DONE
```

The phase is stored in `design.md` → `Status:` (`Draft`, `Approved`, `In progress`, `Done`, `Dropped`).

## Arguments

| Input | Action |
| --- | --- |
| `list` or empty | Print the index from `.ai/specs/README.md`, with each spec's status and unchecked task count. Stop. |
| `new <idea>` or free text that does not match a spec | NEW, then DESIGN |
| `<NNN>` or `<slug>` | Continue that spec from its current phase (see "Resume" below) |
| `<NNN> design\|tasks\|implement\|done` | Jump to that phase explicitly |

**Resume** (by status): `Draft` → DESIGN, revising if a design already exists. `Approved` with no tasks → TASKS. `Approved` with tasks, or `In progress` → IMPLEMENT, starting at the first unchecked task. `Done` → summarize and stop.

## Phase NEW

1. Next number = highest `NNN` in `.ai/specs/` + 1 (3 digits). Slug = 2–5 kebab-case words from the idea.
2. Copy `.ai/specs/_template/*` to `.ai/specs/NNN-slug/`, and fill in the name, spec id and date in all three headers.
3. Add a row to the index in `.ai/specs/README.md` with status `Draft`.

## Phase DESIGN (writes design.md only, no code)

1. Read `.ai/context/architecture.md`, `.ai/context/conventions.md`, related ADRs in `.ai/decisions/`, and the code the feature touches. Base the design on the code as it is, not on assumptions.
2. Fill in every section of `design.md`. Keep it short: a reader should grasp it in about 3 minutes. Delete template hints. Mark sections that do not apply "N/A".
3. The design must respect the architecture: domain logic in `packages/shared`, the extension stays local-first (works offline and logged out), every card change bumps `updatedAt`, and contract changes go through zod schemas in `shared`.
4. Put real unknowns under **Risks and open questions** as checkboxes. Do not invent answers to product questions.
5. **Stop.** Show the user a short summary (goal, approach, affected parts, open questions) and ask them to approve or give feedback. On feedback, revise and stop again. On approval, set `Status: Approved`.

## Phase TASKS (writes task.md only)

1. Break the design into ordered tasks (T1, T2, …). Each has **Files / Do / Verify**, is one concern, and leaves the build green. Usual order: shared types/logic + tests → API (+ migration) → extension/web → docs.
2. Map every acceptance criterion to at least one task's Verify step.
3. **Stop.** Show the task list and ask whether to start implementing.

## Phase IMPLEMENT (code + task.md + implement.md)

Set `Status: In progress`. Then, for each unchecked task in order:

1. Mark it `[~]`, do the work, and run its Verify step.
2. When verified, mark it `[x]` and append a log entry to `implement.md`: what changed, any decision and why, and the verification command with its result.
3. If reality disagrees with the design, do not quietly change course. Make the smallest reasonable fix, record the deviation in `implement.md`, and update `design.md`. If the change is significant (scope, UX or data model), **stop and ask**.
4. New work discovered along the way is added as a new task with "(added)" in its title, not done silently. Dropped tasks become `[-]`, with the reason logged.
5. If blocked (failing checks you cannot fix, missing credentials, a product question), stop and report what is blocked and what you tried.

## Phase DONE

1. Every box in task.md is `[x]` or `[-]`. `pnpm typecheck && pnpm test && pnpm build` passes (paste the result into the log).
2. Update `.ai/context/*` if a documented fact changed. Add an ADR in `.ai/decisions/` if an architectural decision was made.
3. Fill in the **Summary** in `implement.md`, set `Status: Done`, and update the index row.
4. Report to the user: what shipped, deviations, follow-ups.

## Writing rules

- The spec files are the source of truth for the feature's intent and history. Code comments explain code; specs explain why the feature is shaped this way.
- Be concise: bullets over prose, no filler, no restating the template.
- Use relative links between the three files, and `path:line` references to code where useful.
