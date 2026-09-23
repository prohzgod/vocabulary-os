import { dueCards } from "../lib/db.js";

export const BADGE_ALARM = "badge";

/** Show how many words are due on the toolbar icon; nothing at zero. */
export async function updateBadge(): Promise<void> {
  const due = (await dueCards(100)).length;
  await chrome.action.setBadgeBackgroundColor({ color: "#1C1A17" });
  await chrome.action.setBadgeTextColor({ color: "#FFD84D" });
  await chrome.action.setBadgeText({ text: due === 0 ? "" : due > 99 ? "99+" : String(due) });
}
