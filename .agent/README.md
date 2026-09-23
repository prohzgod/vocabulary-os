# .agent — rules and workflows for AI coding agents

Agent-facing instructions in a tool-neutral format (Markdown with a small frontmatter; the layout Antigravity-style agents read natively). Other tools can be pointed here.

| Path | Purpose |
| --- | --- |
| `rules/project.md` | Always-on rules for this repo |
| `workflows/spec.md` | Spec mode: design → tasks → implement, stored in `.ai/specs/` |

Knowledge (architecture, conventions, decisions, specs) lives in [`.ai/`](../.ai/README.md). This folder only says how to work.

Claude Code uses `CLAUDE.md` and `.claude/skills/spec/` (`/spec`), which point to the same files.
