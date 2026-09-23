import { preloadLocal, status, translate, type LanguagePair } from "./translator.js";

/**
 * The offscreen document hosts the translation models so heavy work never
 * runs on the page being read, and the loaded model survives service worker
 * restarts. It only answers messages from background/offscreen.ts.
 */
export type OffscreenMessage =
  | { target: "offscreen"; type: "translate"; text: string; pair: LanguagePair }
  | { target: "offscreen"; type: "status"; pair: LanguagePair }
  | { target: "offscreen"; type: "preload"; pair: LanguagePair };

chrome.runtime.onMessage.addListener((message: OffscreenMessage, _sender, sendResponse) => {
  if (message?.target !== "offscreen") {
    return false;
  }
  handle(message).then(
    (value) => sendResponse({ ok: true, value }),
    (error: unknown) => sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
  );
  return true;
});

function handle(message: OffscreenMessage) {
  switch (message.type) {
    case "translate":
      return translate(message.text, message.pair);
    case "status":
      return status(message.pair);
    case "preload":
      return preloadLocal(message.pair);
  }
}
