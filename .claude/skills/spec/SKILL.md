---
name: spec
description: Spec mode for Vocabulary OS. Plans and builds a feature through .ai/specs/<NNN-slug>/ with design.md, task.md and implement.md. Use when the user runs /spec, asks to spec, plan or design a new feature, or asks to continue or implement an existing spec.
argument-hint: "[list | new <idea> | <NNN> [design|tasks|implement|done]]"
---

# /spec

Arguments: `$ARGUMENTS`

1. Read `.agent/workflows/spec.md` in full. It is the single source of truth for the phases, arguments, file formats and stopping points. Follow it exactly.
2. Templates are in `.ai/specs/_template/`; the index is `.ai/specs/README.md`.
3. Claude Code specifics:
   - In DESIGN, use `AskUserQuestion` only for product decisions that block the design. Record everything else as open questions in `design.md`.
   - When a phase says **Stop**, end your turn with a short summary and the question. Do not continue into the next phase in the same turn.
   - In IMPLEMENT, keep `task.md` checkboxes and `implement.md` current after every task (not in a batch at the end), so an interrupted session can resume from the files alone.
   - Never commit unless the user asks.
