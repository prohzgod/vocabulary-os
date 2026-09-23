import { formatInterval, gradeIntervals, isDue, type Card, type Grade, type Stats } from "@vocab-os/shared";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send, type AccountState } from "../lib/messages.js";
import { Highlighted, Icon, Mark, StateGlyph } from "../ui/parts.js";
import "../ui/styles.css";

const GRADE_BUTTONS: { grade: Grade; label: string }[] = [
  { grade: "again", label: "Again" },
  { grade: "hard", label: "Hard" },
  { grade: "good", label: "Good" },
  { grade: "easy", label: "Easy" }
];

function Popup() {
  const [tab, setTab] = useState<"review" | "words">("review");
  const [stats, setStats] = useState<Stats | null>(null);
  const [account, setAccount] = useState<AccountState | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => {
    void send("stats").then(setStats);
  }, []);

  useEffect(() => {
    refresh();
    void send("account").then((state) => {
      setAccount(state);
      // Pull changes from other devices whenever the popup opens.
      if (state.email) {
        void send("syncNow").then((synced) => {
          setAccount(synced);
          refresh();
          setVersion((value) => value + 1);
        });
      }
    });
  }, [refresh]);

  return (
    <div className="popup-shell">
      <header className="header">
        <div className="brand"><Mark />Vocabulary</div>
        <div className="row" style={{ gap: 2 }}>
          <button className="icon" aria-label="Open dashboard" title="Open dashboard" onClick={() => void openDashboard()}>
            <Icon name="external" />
          </button>
          <button className="icon" aria-label="Settings" title="Settings" onClick={() => void chrome.runtime.openOptionsPage()}>
            <Icon name="settings" />
          </button>
        </div>
      </header>
      <p className="summary">
        {stats ? (
          <>
            <strong>{stats.due} due</strong> · {plural(stats.total, "word")} · {stats.streakDays}-day streak
          </>
        ) : (
          " "
        )}
      </p>
      <nav className="tabs">
        <button className={tab === "review" ? "active" : ""} aria-pressed={tab === "review"} onClick={() => setTab("review")}>Review</button>
        <button className={tab === "words" ? "active" : ""} aria-pressed={tab === "words"} onClick={() => setTab("words")}>Words</button>
      </nav>
      <main className="panel">
        {tab === "review" ? <Review key={version} onChange={refresh} /> : <Words key={version} onChange={refresh} />}
      </main>
      <Footer account={account} onSync={() => void send("syncNow").then(setAccount).then(refresh)} />
    </div>
  );
}

function Review({ onChange }: { onChange: () => void }) {
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [total, setTotal] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = queue?.[0];

  useEffect(() => {
    void send("dueCards").then((cards) => {
      setQueue(cards);
      setTotal(cards.length);
    });
  }, []);

  const grade = useCallback(
    async (value: Grade) => {
      if (!card) return;
      const updated = await send("gradeCard", { id: card.id, grade: value });
      // "Again" comes back at the end of this session; everything else leaves the queue.
      setQueue((current) => [...(current ?? []).slice(1), ...(value === "again" ? [updated] : [])]);
      if (value === "again") setTotal((count) => count + 1);
      setRevealed(false);
      onChange();
    },
    [card, onChange]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === " ") {
        event.preventDefault();
        setRevealed(true);
      }
      const grades: Record<string, Grade> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
      const picked = grades[event.key];
      if (revealed && picked) void grade(picked);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grade, revealed]);

  if (!queue) return <p className="muted">Loading…</p>;
  if (!card) return <Done />;

  const intervals = gradeIntervals(card);
  return (
    <>
      <section className={`flashcard${revealed ? " revealed" : ""}`}>
        <span className="caption">{total - queue.length + 1} of {total}</span>
        <h2 className="word">{card.word}</h2>
        {card.context && <p className="context"><Highlighted text={card.context} word={card.word} /></p>}
        {revealed ? (
          <>
            <div className="divider" />
            <div className="translation">{card.translation}</div>
          </>
        ) : (
          card.sourceUrl && <span className="caption">{hostname(card.sourceUrl)}</span>
        )}
      </section>
      {revealed ? (
        <>
          <div className="grades">
            {GRADE_BUTTONS.map(({ grade: value, label }) => (
              <button key={value} className={value === "good" ? "primary" : value === "again" ? "again" : ""} onClick={() => void grade(value)}>
                {label}
                <small>{formatInterval(intervals[value])}</small>
              </button>
            ))}
          </div>
          <p className="caption" style={{ textAlign: "center" }}>Keys 1 · 2 · 3 · 4</p>
        </>
      ) : (
        <button className="primary reveal" onClick={() => setRevealed(true)}>
          Show answer <kbd>Space</kbd>
        </button>
      )}
    </>
  );
}

function Done() {
  const [next, setNext] = useState<Card | null | undefined>(undefined);

  useEffect(() => {
    void send("listCards").then((cards) => {
      const upcoming = cards.filter((card) => !isDue(card)).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
      setNext(upcoming[0] ?? null);
    });
  }, []);

  return (
    <>
      <div className="done">
        <h2>{next === null ? "No words yet." : "All caught up."}</h2>
        {next && (
          <p className="muted">
            Next up is <strong style={{ color: "var(--ink)" }}>{next.word}</strong>, in {formatInterval(Date.parse(next.dueAt) - Date.now())}.
          </p>
        )}
      </div>
      <div className="hint">
        <span className="mark"><Mark framed={false} /></span>
        <span>Select any word while you read, then tap this mark to save it.</span>
      </div>
    </>
  );
}

function Words({ onChange }: { onChange: () => void }) {
  const [cards, setCards] = useState<Card[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void send("listCards").then(setCards);
  }, []);

  const remove = async (id: string) => {
    await send("deleteCard", { id });
    setCards((current) => current.filter((card) => card.id !== id));
    onChange();
  };

  const q = query.trim().toLowerCase();
  const visible = cards.filter((card) => !q || card.word.toLowerCase().includes(q) || card.translation.toLowerCase().includes(q));

  return (
    <>
      <label className="search">
        <Icon name="search" size={16} />
        <span className="vh">Search words</span>
        <input type="search" placeholder={`Search ${plural(cards.length, "word")}`} value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <ul className="list">
        {visible.map((card) => {
          const due = isDue(card);
          return (
            <li key={card.id} className="item">
              <StateGlyph state={card.state} />
              <div className="text">
                <span className="word">{card.word}</span>
                <span className="meaning">{card.translation}</span>
              </div>
              <span className={`due${due ? " now" : ""}`}>{due ? "due now" : `in ${formatInterval(Date.parse(card.dueAt) - Date.now())}`}</span>
              <button className="delete" aria-label={`Delete ${card.word}`} title="Delete" onClick={() => void remove(card.id)}>
                <Icon name="trash" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      {cards.length > 0 && visible.length === 0 && <p className="muted">No word matches “{query}”.</p>}
      {cards.length === 0 && <p className="muted">Words you save while reading show up here.</p>}
    </>
  );
}

function Footer({ account, onSync }: { account: AccountState | null; onSync: () => void }) {
  if (!account) return null;
  if (!account.email) {
    return (
      <footer className="footer">
        <span className="status">Saved on this device only</span>
        <button className="link" onClick={() => void chrome.runtime.openOptionsPage()}>Sign in to sync</button>
      </footer>
    );
  }
  const waiting = account.pendingChanges > 0 ? ` · ${plural(account.pendingChanges, "change")} waiting` : "";
  return (
    <footer className="footer">
      <span className={`status${account.lastError ? " error" : ""}`} title={account.lastError ?? undefined}>
        <span className={`dot${account.lastError ? " warn" : ""}`} />
        {account.lastError
          ? account.lastError
          : account.lastSyncedAt
            ? `Synced ${new Date(account.lastSyncedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${waiting}`
            : `Not synced yet${waiting}`}
      </span>
      <button className="link" onClick={onSync}>Sync now</button>
    </footer>
  );
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

async function openDashboard() {
  const { dashboardUrl } = await send("getSettings");
  await chrome.tabs.create({ url: dashboardUrl });
}

createRoot(document.getElementById("root")!).render(<Popup />);
