# Mobile apps (Android ML Kit, iOS Translation)

- Spec: 001-mobile-apps
- Status: Draft
- Created: 2026-09-18

## Problem

Learners review in short moments during the day, mostly on their phones, but today reviewing needs a desktop browser. Saving words also happens only in Chrome on desktop.

## Goals

- Review due cards on the phone, synced with the extension and web app.
- Translate and save a word on the phone (typed or shared from another app), on-device and free.

## Non-goals

- Reading-mode highlighting inside other apps.
- Push notifications (possible follow-up).

## User flow

1. Sign in with the same account.
2. The home screen shows due count and streak; **Review** runs the same flashcard flow (again / hard / good / easy).
3. **Add word**: type, or use the system "Share → Vocabulary OS" action with selected text. The app shows an on-device translation → **Save**.

## Design

### Affected parts

| Part | Change |
| --- | --- |
| `packages/shared` | None, if the app is TypeScript. Native apps must re-implement `gradeCard`, `mergeRemote`, `cardId` exactly; add golden test vectors (JSON) to `shared` that both sides test against. |
| `apps/api` | None. Reuse `/auth/*`, `/sync`, `/stats`. |
| `apps/mobile` (new) | See the options below |

### Translation on-device

- **Android:** ML Kit Translation (`com.google.mlkit:translate`). About 30 MB per language model, downloaded once, free.
- **iOS:** Apple Translation framework (iOS 17.4+ / 18 for `TranslationSession`). System-managed models, free.

### Data and contracts

The phone stores cards locally (SQLite) with the same `dirty` + LWW sync as the extension, against the same `POST /sync`.

## Alternatives considered

- **Native Kotlin + Swift:** direct access to ML Kit and the Translation framework, but two more codebases and a re-implemented `shared` domain in two languages.
- **Expo / React Native (TypeScript):** reuses `@vocab-os/shared` as-is; translation needs small native modules (Expo Modules API) wrapping ML Kit and the Translation framework. **Leaning this way** because it keeps one language and one domain package.

## Risks and open questions

- [ ] Native (Kotlin/Swift) or Expo? (affects everything)
- [ ] Android only first, or both platforms?
- [ ] Minimum iOS version (the Translation framework needs 17.4+)
- [ ] App store distribution or sideloading at first?

## Acceptance criteria

- [ ] A card reviewed on the phone shows the new due date in the extension after sync, and the reverse.
- [ ] Translate + save works in airplane mode after models are downloaded.
- [ ] Scheduling matches the shared golden test vectors exactly.
