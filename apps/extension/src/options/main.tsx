import { useEffect, useState, type FormEvent } from "react";
import { createRoot } from "react-dom/client";
import { send, type AccountState, type TranslatorStatus } from "../lib/messages.js";
import type { Settings } from "../lib/settings.js";
import "../ui/styles.css";

const LANGUAGES = { en: "English", vi: "Vietnamese", fr: "French", de: "German", es: "Spanish", ja: "Japanese", ko: "Korean", zh: "Chinese" };

function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const update = async (patch: Partial<Settings>) => setSettings(await send("updateSettings", patch));

  useEffect(() => {
    void send("getSettings").then(setSettings);
  }, []);

  if (!settings) return null;
  return (
    <div className="page">
      <h1>Vocabulary OS settings</h1>
      <AccountSection settings={settings} update={update} />
      <TranslationSection settings={settings} update={update} />
      <ReadingSection settings={settings} update={update} />
      <DataSection />
    </div>
  );
}

type SectionProps = { settings: Settings; update: (patch: Partial<Settings>) => Promise<void> };

function AccountSection({ settings, update }: SectionProps) {
  const [account, setAccount] = useState<AccountState | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
    <section className="section">
      <h2>Account & sync</h2>
      <p className="muted">Optional. Without an account, words stay on this device. With one, they sync to the web dashboard and your other browsers.</p>
      <label>
        Server URL
        <input value={settings.apiUrl} onChange={(event) => void update({ apiUrl: event.target.value })} />
      </label>
      <label>
        Dashboard URL
        <input value={settings.dashboardUrl} onChange={(event) => void update({ dashboardUrl: event.target.value })} />
      </label>
      {account?.email ? (
        <div className="stack">
          <div className="spread">
            <span>Signed in as <b>{account.email}</b></span>
            <button onClick={() => void run(() => send("signOut"))}>Sign out</button>
          </div>
          <div className="spread">
            <span className={account.lastError ? "error" : "muted"}>
              {account.lastError ?? (account.lastSyncedAt ? `Last synced ${new Date(account.lastSyncedAt).toLocaleString()}` : "Not synced yet")}
              {account.pendingChanges > 0 && ` · ${account.pendingChanges} changes waiting`}
            </span>
            <button disabled={busy} onClick={() => void run(() => send("syncNow"))}>Sync now</button>
          </div>
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
    </section>
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
    <section className="section">
      <h2>Translation</h2>
      <p className="muted">Everything runs on your device. Chrome's built-in translator is used when available; otherwise an offline model (~100 MB, downloaded once) is used.</p>
      <div className="grid2">
        <label>
          From
          <select value={settings.sourceLanguage} onChange={(event) => void update({ sourceLanguage: event.target.value })}>
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
        <label>
          To
          <select value={settings.targetLanguage} onChange={(event) => void update({ targetLanguage: event.target.value })}>
            {Object.entries(LANGUAGES).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
        </label>
      </div>
      {status && (
        <div className="stack">
          <div className="spread">
            <span>Chrome translator: <b>{CHROME_LABELS[status.chrome]}</b></span>
            {status.chrome === "downloadable" && <button onClick={() => void downloadChromeModel()}>Download</button>}
          </div>
          <div className="spread">
            <span>
              Offline model: <b>{LOCAL_LABELS[status.local.state]}</b>
              {status.local.state === "loading" && ` ${status.local.progress}%`}
            </span>
            {(status.local.state === "idle" || status.local.state === "error") && (
              <button onClick={() => void send("downloadLocalModel").then(setStatus)}>Load now</button>
            )}
          </div>
          {status.local.error && <p className="error">{status.local.error}</p>}
        </div>
      )}
      {note && <p className="muted">{note}</p>}
    </section>
  );
}

const CHROME_LABELS: Record<TranslatorStatus["chrome"], string> = {
  unsupported: "not supported in this Chrome",
  unavailable: "not available for this language pair",
  downloadable: "needs a one-time download",
  downloading: "downloading…",
  available: "ready"
};

const LOCAL_LABELS: Record<TranslatorStatus["local"]["state"], string> = {
  unsupported: "no offline model for this language pair",
  idle: "loads on first translation",
  loading: "loading",
  ready: "ready",
  error: "failed to load"
};

function ReadingSection({ settings, update }: SectionProps) {
  return (
    <section className="section">
      <h2>While reading</h2>
      <label className="check">
        <input type="checkbox" checked={settings.inlineEnabled} onChange={(event) => void update({ inlineEnabled: event.target.checked })} />
        Show the translate button when I select text
      </label>
      <label className="check">
        <input type="checkbox" checked={settings.highlightEnabled} onChange={(event) => void update({ highlightEnabled: event.target.checked })} />
        Highlight words I have saved
      </label>
      <label>
        Turn off on these sites (one per line)
        <textarea
          rows={3}
          defaultValue={settings.disabledSites.join("\n")}
          onBlur={(event) => void update({ disabledSites: event.target.value.split("\n").map((site) => site.trim()).filter(Boolean) })}
        />
      </label>
    </section>
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
    <section className="section">
      <h2>Your data</h2>
      <div className="row">
        <button onClick={() => void exportJson()}>Export JSON</button>
        <label className="button">
          Import JSON
          <input type="file" accept="application/json" hidden onChange={(event) => void importJson(event.target.files?.[0])} />
        </label>
      </div>
      {note && <p className="muted">{note}</p>}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(<Options />);
