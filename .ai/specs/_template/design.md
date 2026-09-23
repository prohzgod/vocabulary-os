# <Feature name>

- Spec: NNN-slug
- Status: Draft <!-- Draft → Approved → In progress → Done (or Dropped) -->
- Created: YYYY-MM-DD

## Problem

Who has what problem, and why it matters now. 2–5 sentences.

## Goals

- …

## Non-goals

- … (what this deliberately does not do, to keep scope honest)

## User flow

1. The user …
2. They see …

## Design

### Affected parts

| Part | Change |
| --- | --- |
| `packages/shared` | |
| `apps/api` | |
| `apps/web` | |
| `apps/extension` | |

### Data and contracts

Changes to `Card`, zod schemas, Prisma schema (migration?), extension `Messages`, settings.
Backward compatibility: what happens with old clients and existing data.

### Edge cases and failure modes

- Offline / logged out / server down:
- Empty and huge data:
- …

## Alternatives considered

- **Option** — why not.

## Risks and open questions

- [ ] Question for the user …

## Acceptance criteria

- [ ] Observable, testable statement …
