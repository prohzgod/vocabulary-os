import type { Card } from "./card.js";

/**
 * Sync is last-write-wins per card, using the card's `updatedAt`.
 * Deletes are tombstones (`deletedAt` set), so they win or lose like any other edit.
 */

/** Server side: should an incoming card overwrite what is stored? */
export function shouldAcceptIncoming(existing: Card | undefined, incoming: Card): boolean {
  return !existing || Date.parse(incoming.updatedAt) > Date.parse(existing.updatedAt);
}

/**
 * Client side: what to do with a card the server sent back.
 * - "take":  remote is newer (or unknown locally) → overwrite local, mark clean.
 * - "clean": same version as local → local change reached the server, mark clean.
 * - "keep":  local is newer → keep it dirty so the next sync pushes it.
 */
export function mergeRemote(local: Card | undefined, remote: Card): "take" | "clean" | "keep" {
  if (!local) {
    return "take";
  }
  const localTime = Date.parse(local.updatedAt);
  const remoteTime = Date.parse(remote.updatedAt);
  if (remoteTime > localTime) {
    return "take";
  }
  return remoteTime === localTime ? "clean" : "keep";
}
