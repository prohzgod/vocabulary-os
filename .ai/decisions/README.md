# Decisions (ADRs)

One file per decision, numbered, append-only. To change a decision, write a new ADR that supersedes the old one and update the old file's `Status` line only.

Template:

```markdown
# ADR-NNNN: <decision in a few words>

- Status: Proposed | Accepted (YYYY-MM-DD) | Superseded by ADR-XXXX
- Spec: .ai/specs/<id>/ (if any)

## Context
## Decision
## Consequences
```

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-mvp-typescript-monorepo.md) | MVP as a TypeScript monorepo | Partly superseded |
| [0002](0002-spring-boot-backend.md) | Spring Boot backend | Superseded by 0003 |
| [0003](0003-v0.2-simplify.md) | v0.2: NestJS, on-device translation, word-keyed cards | Accepted |
