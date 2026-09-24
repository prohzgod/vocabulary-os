import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { send, type AccountState, type TranslatorStatus } from "../lib/messages.js";
import type { Settings } from "../lib/settings.js";
import { Icon, Mark } from "../ui/parts.js";
import "../ui/styles.css";

const LANGUAGES = { en: "English", vi: "Tiếng Việt", fr: "Français", de: "Deutsch", es: "Español", ja: "日本語", ko: "한국어", zh: "中文" };

function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const update = async (patch: Partial<Settings>) => setSettings(await send("updateSettings", patch));

  useEffect(() => {
    void send("getSettings").then(setSettings);
  }, []);

  if (!settings) return null;
  return (
    <div className="page">
      <header className="page-title">
        <Mark size={36} />
        <h1>Settings</h1>
      </header>
      <AccountSection settings={settings} update={update} />
      <TranslationSection settings={settings} update={update} />
      <ReadingSection settings={settings} update={update} />
      <DataSection />
    </div>
  );
}

type SectionProps = { settings: Settings; update: (patch: Partial<Settings>) => Promise<void> };

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {description && <p className="muted">{description}</p>}
      </div>
      <div className="section-body">{children}</div>
    </section>
  );
}

function AccountSection({ settings, update }: SectionProps) {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingServer, setEditingServer] = useState(false);

  useEffect(() => {
    void send("account").then(setAccount);
  }, []);

  const run = async (action: () => Promise<AccountState>) => {
    setBusy(true);
    setError("");
    try {
      setAccount(await action());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (createAccount: boolean) => (event?: FormEvent) => {
    event?.preventDefault();
    void run(() => send("signIn", { email, password, createAccount }));
  };

  return (
    <Section title="Account" description="Optional. Signed out, your words stay on this device. Signed in, they sync to the dashboard and your other browsers.">
      {account?.email ? (
        <div className="row" style={{ gap: 14 }}>
          <span className="avatar" aria-hidden="true">{account.email[0]}</span>
          <div style={{ flexGrow: 1, display: "grid", gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 500, overflowWrap: "anywhere" }}>{account.email}</span>
            <span className={`row ${account.lastError ? "error" : "muted"}`} style={{ gap: 6 }}>
              <span className={`dot${account.lastError ? " warn" : ""}`} />
              {account.lastError ?? (account.lastSyncedAt ? `Synced ${new Date(account.lastSyncedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : "Not synced yet")}
              {account.pendingChanges > 0 && ` · ${account.pendingChanges} waiting`}
            </span>
          </div>
          <button disabled={busy} onClick={() => void run(() => send("syncNow"))}>Sync now</button>
          <button className="quiet" onClick={() => void run(() => send("signOut"))}>Sign out</button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit(false)}>
          {account?.lastError && <p className="error">{account.lastError}</p>}
          <div className="grid2">
            <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Password<input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          </div>
          <div className="row">
            <button className="primary" type="submit" disabled={busy}>Sign in</button>
            <button type="button" disabled={busy} onClick={submit(true)}>Create account</button>
          </div>
        </form>
      )}
      {error && <p className="error">{error}</p>}
      <div className="box">
        {editingServer ? (
          <div className="box-row" style={{ display: "grid", gap: 12 }}>
            <label>Server URL<input value={settings.apiUrl} onChange={(event) => void update({ apiUrl: event.target.value })} /></label>
            <label>Dashboard URL<input value={settings.dashboardUrl} onChange={(event) => void update({ dashboardUrl: event.target.value })} /></label>
            <div><button onClick={() => setEditingServer(false)}>Done</button></div>
          </div>
        ) : (
          <div className="box-row" style={{ paddingBlock: 10 }}>
            <span className="muted" style={{ flexGrow: 1, overflowWrap: "anywhere" }}>
              Server <span style={{ color: "var(--ink)", fontWeight: 500 }}>{host(settings.apiUrl)}</span>
            </span>
            <button className="link" onClick={() => setEditingServer(true)}>Change</button>
          </div>
        )}
      </div>
    </Section>
  );
}

function TranslationSection({ settings, update }: SectionProps) {
  const [status, setStatus] = useState<TranslatorStatus | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const load = () => void send("translatorStatus").then(setStatus).catch(() => undefined);
    load();
    const timer = setInterval(load, 1500);
    return () => clearInterval(timer);
  }, [settings.sourceLanguage, settings.targetLanguage]);

  // Chrome only downloads its built-in model after a click on an extension page.
  const downloadChromeModel = async () => {
    const api = (globalThis as { Translator?: { create(pair: object): Promise<unknown> } }).Translator;
    setNote("Downloading Chrome's translator…");
    try {
      await api?.create({ sourceLanguage: settings.sourceLanguage, targetLanguage: settings.targetLanguage });
      setNote("Chrome's translator is ready.");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Chrome could not download the translator.");
    }
  };

  return (
    <Section title="Translation" description="Runs on your device. Nothing you read is sent anywhere.">
      <div className="pair">
        <label>
          From
          <select value={settings.sourceLanguage} onChange={(event) => void update({ sourceLanguage: event.target.value })}>
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <span className="arrow" aria-hidden="true">→</span>
        <label>
          To
          <select value={settings.targetLanguage} onChange={(event) => void update({ targetLanguage: event.target.value })}>
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
      </div>
      {status && (
        <div className="box">
          <div className="box-row">
            <div className="text">
              <span className="title">Dictionary</span>
              <span className="muted">
                {status.dictionary ? (
                  <>
                    Every meaning of a word or short phrase. Built in, used first. {status.dictionary.entries.toLocaleString()} words from{" "}
                    <a href="https://en.wiktionary.org/" target="_blank" rel="noreferrer">Wiktionary</a>,{" "}
                    <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.
                  </>
                ) : (
                  "No dictionary for this pair yet, so words are machine-translated."
                )}
              </span>
            </div>
            <span className={`status-chip${status.dictionary ? " ready" : ""}`}>
              {status.dictionary && <span className="dot" />}
              {status.dictionary ? "Ready" : "Not for this pair"}
            </span>
          </div>
          <div className="box-row">
            <div className="text">
              <span className="title">Chrome translator</span>
              <span className="muted">Built into Chrome. Used for sentences and words not in the dictionary.</span>
            </div>
            {status.chrome === "downloadable" ? (
              <button onClick={() => void downloadChromeModel()}>Download</button>
            ) : (
              <span className={`status-chip${status.chrome === "available" ? " ready" : ""}`}>
                {status.chrome === "available" && <span className="dot" />}
                {CHROME_LABELS[status.chrome]}
              </span>
            )}
          </div>
          <div className="box-row">
            <div className="text">
              <span className="title">Offline backup</span>
              <span className="muted">For when Chrome's translator isn't available. About 100 MB, downloaded once.</span>
              {status.local.state === "loading" && (
                <div className="progress" style={{ marginTop: 8 }}><div style={{ width: `${status.local.progress}%` }} /></div>
              )}
              {status.local.error && <p className="error">{status.local.error}</p>}
            </div>
            {status.local.state === "idle" || status.local.state === "error" ? (
              <button onClick={() => void send("downloadLocalModel").then(setStatus)}>{status.local.state === "error" ? "Try again" : "Download"}</button>
            ) : (
              <span className={`status-chip${status.local.state === "ready" ? " ready" : ""}`}>
                {status.local.state === "ready" && <span className="dot" />}
                {status.local.state === "loading" ? `${status.local.progress}%` : LOCAL_LABELS[status.local.state]}
              </span>
            )}
          </div>
        </div>
      )}
      {note && <p className="muted">{note}</p>}
    </Section>
  );
}

const CHROME_LABELS: Record<TranslatorStatus["chrome"], string> = {
  unsupported: "Not in this Chrome",
  unavailable: "Not for this pair",
  downloadable: "Needs a download",
  downloading: "Downloading…",
  available: "Ready"
};

const LOCAL_LABELS: Record<TranslatorStatus["local"]["state"], string> = {
  unsupported: "Not for this pair",
  idle: "Not downloaded",
  loading: "Loading",
  ready: "Ready",
  error: "Failed"
};

function ReadingSection({ settings, update }: SectionProps) {
  const [site, setSite] = useState("");

  const addSite = (event: FormEvent) => {
    event.preventDefault();
    const value = site.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (value && !settings.disabledSites.includes(value)) void update({ disabledSites: [...settings.disabledSites, value] });
    setSite("");
  };

  return (
    <Section title="While reading">
      <label className="switch-row">
        <span className="text">
          <span className="title" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Show the translate mark when I select text</span>
          <span className="muted">A small mark appears next to your selection.</span>
        </span>
        <input type="checkbox" className="switch" checked={settings.inlineEnabled} onChange={(event) => void update({ inlineEnabled: event.target.checked })} />
      </label>
      <label className="switch-row">
        <span className="text">
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>Highlight words I've saved</span>
          <span className="muted">A yellow underline, like <mark style={{ color: "var(--ink)" }}>this</mark>. Hover to see the meaning.</span>
        </span>
        <input type="checkbox" className="switch" checked={settings.highlightEnabled} onChange={(event) => void update({ highlightEnabled: event.target.checked })} />
      </label>
      <div className="stack" style={{ gap: 10, paddingTop: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Turn off on these sites</span>
        {settings.disabledSites.length > 0 && (
          <div className="chips">
            {settings.disabledSites.map((value) => (
              <span key={value} className="chip">
                {value}
                <button aria-label={`Remove ${value}`} onClick={() => void update({ disabledSites: settings.disabledSites.filter((other) => other !== value) })}>
                  <Icon name="close" size={12} />
                </button>
              </span>
            ))}
          </div>
        )}
        <form className="row" onSubmit={addSite}>
          <label style={{ flexGrow: 1 }}>
            <span className="vh">Site to turn off</span>
            <input placeholder="example.com" value={site} onChange={(event) => setSite(event.target.value)} />
          </label>
          <button type="submit">Add</button>
        </form>
      </div>
    </Section>
  );
}

function DataSection() {
  const [note, setNote] = useState("");

  const exportJson = async () => {
    const blob = new Blob([JSON.stringify(await send("exportCards"), null, 2)], { type: "application/json" });
    const link = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(blob),
      download: `vocabulary-os-${new Date().toISOString().slice(0, 10)}.json`
    });
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const importJson = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { imported, skipped } = await send("importCards", JSON.parse(await file.text()));
      setNote(`Imported ${imported} words, skipped ${skipped}.`);
    } catch {
      setNote("That file is not a Vocabulary OS export.");
    }
  };

  return (
    <Section title="Your data" description="Every word and its review schedule, as one JSON file.">
      <div className="row">
        <button onClick={() => void exportJson()}>Export</button>
        <label className="button">
          Import…
          <input type="file" accept="application/json" hidden onChange={(event) => void importJson(event.target.files?.[0])} />
        </label>
      </div>
      {note && <p className="muted">{note}</p>}
    </Section>
  );
}

function host(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

createRoot(document.getElementById("root")!).render(<Options />);
