import type { Response } from "../lib/messages.js";
import type { OffscreenMessage } from "../offscreen/index.js";

type WithoutTarget<T> = T extends unknown ? Omit<T, "target"> : never;

let creating: Promise<void> | null = null;

async function ensureOffscreenDocument(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) {
    return;
  }
  creating ??= chrome.offscreen
    .createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.WORKERS],
      justification: "Translate selected text on-device without slowing down the page."
    })
    .finally(() => {
      creating = null;
    });
  await creating;
}

/** Send a request to the offscreen translator, creating the document on first use. */
export async function callOffscreen<T>(message: WithoutTarget<OffscreenMessage>): Promise<T> {
  await ensureOffscreenDocument();
  const response = (await chrome.runtime.sendMessage({ ...message, target: "offscreen" })) as Response<T> | undefined;
  if (!response) {
    throw new Error("Translator is not available.");
  }
  if (!response.ok) {
    throw new Error(response.error);
  }
  return response.value;
}
