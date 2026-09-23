# ADR-0002: Spring Boot backend for accounts and sync

- Status: Superseded by ADR-0003 (2026-09-18)
- Context: Phase 4 added accounts, cloud vocabulary and multi-device sync, and a JVM backend looked more production-ready.
- Decision (at the time): a Java 17 / Spring Boot 3 / Flyway backend in `apps/backend`, alongside the old Fastify API.
- What happened: the system ended up with two backends, two databases and duplicated domain logic (the SRS scheduler lived in both Java and TypeScript), and the Java service grew to about 150 files. Sync reset review progress on pulled cards, because schedules were not part of the sync payload.
- The code is preserved outside the repo in `../vocabulary-os-legacy-20260918/apps/backend` and in the backup tarball.
