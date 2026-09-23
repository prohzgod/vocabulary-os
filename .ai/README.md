# .ai — project knowledge for humans and AI agents

Tool-agnostic docs. Claude Code, Cursor, Antigravity, Codex, or a new teammate should all be able to start here.

| Path | What it holds | When to read it |
| --- | --- | --- |
| `context/architecture.md` | How the apps fit together, data flow, sync and translation design | Before touching more than one app |
| `context/conventions.md` | Code style, recipes (add an endpoint, a message, a migration) | Before writing code |
| `context/deployment.md` | Hosting the API, web and extension; env vars; costs | When shipping to production |
| `decisions/` | Architecture decision records (ADRs), numbered, never rewritten | When you wonder "why is it like this?" |
| `specs/` | One folder per feature: `design.md`, `task.md`, `implement.md` | Before building a feature, and while building it |

Agent-specific wiring lives elsewhere and points back here:

- `CLAUDE.md` and `.claude/skills/spec/` for Claude Code (`/spec`)
- `.agent/` for other agents (rules and workflows)

Keep these docs short and true. If the code changes a fact written here, update the doc in the same change.
