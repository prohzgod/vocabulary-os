export interface Settings {
  sourceLanguage: string;
  targetLanguage: string;
  /** Show the translate button when text is selected. */
  inlineEnabled: boolean;
  /** Highlight saved words on pages you read. */
  highlightEnabled: boolean;
  /** Hostnames where the extension stays quiet, e.g. "mail.google.com". */
  disabledSites: string[];
  apiUrl: string;
  dashboardUrl: string;
}

/**
 * Build the extension with VITE_API_URL and VITE_DASHBOARD_URL set to ship it
 * pointing at your deployed server. Users can still change both in Options,
 * and settings they already saved keep their old values.
 */
export const DEFAULT_SETTINGS: Settings = {
  sourceLanguage: "en",
  targetLanguage: "vi",
  inlineEnabled: true,
  highlightEnabled: true,
  disabledSites: [],
  apiUrl: import.meta.env.VITE_API_URL ?? "http://localhost:3000",
  dashboardUrl: import.meta.env.VITE_DASHBOARD_URL ?? "http://localhost:5173"
};

const KEY = "settings";

export async function getSettings(): Promise<Settings> {
  const stored = (await chrome.storage.local.get(KEY))[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export function isSiteDisabled(settings: Settings, hostname: string): boolean {
  return settings.disabledSites.some((site) => hostname === site || hostname.endsWith(`.${site}`));
}

/**
 * Pages that belong to Vocabulary OS itself: the extension's own pages and the
 * web dashboard. Saved words are not highlighted there — the dashboard already
 * shows them, so highlighting only adds noise.
 */
export function isOwnSurface(settings: Settings, url: string | URL): boolean {
  try {
    const target = new URL(url);
    if (target.protocol === "chrome-extension:" || target.protocol === "moz-extension:") {
      return true;
    }
    return Boolean(settings.dashboardUrl.trim()) && target.origin === new URL(settings.dashboardUrl).origin;
  } catch {
    return false;
  }
}
