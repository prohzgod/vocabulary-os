import type { Card, Grade, Stats } from "@vocab-os/shared";
import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { send, type AccountState } from "../lib/messages.js";
import "../ui/styles.css";

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
    <>
      <div className="header">
        <div className="spread">
          <h1>Vocabulary OS</h1>
          <button className="link" onClick={() => void openDashboard()}>Dashboard ↗</button>
        </div>
        <div className="chips">
          <div className="chip"><b>{stats?.due ?? "–"}</b>due</div>
          <div className="chip"><b>{stats?.total ?? "–"}</b>words</div>
          <div className="chip"><b>{stats?.streakDays ?? "–"}</b>day streak</div>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === "review" ? "active" : ""} onClick={() => setTab("review")}>Review</button>
        <button className={tab === "words" ? "active" : ""} onClick={() => setTab("words")}>Words</button>
      </div>
      <div className="panel">
        {tab === "review" ? <Review key={version} onChange={refresh} /> : <Words key={version} onChange={refresh} />}
      </div>
      <Footer account={account} onSync={() => void send("syncNow").then(setAccount).then(refresh)} />
    </>
  );
}

function Review({ onChange }: { onChange: () => void }) {
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const card = queue?.[0];

  useEffect(() => {
    void send("dueCards").then(setQueue);
  }, []);

  const grade = useCallback(
    async (value: Grade) => {
      if (!card) return;
      const updated = await send("gradeCard", { id: card.id, grade: value });
      // "Again" comes back at the end of this session; everything else leaves the queue.
      setQueue((current) => [...(current ?? []).slice(1), ...(value === "again" ? [updated] : [])]);
      setRevealed(false);
      onChange();
    },
    [card, onChange]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
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
  if (!card) return <p className="muted">Nothing to review. Select a word on any page and save it to start.</p>;

  return (
    <div>
      <div className="flashcard">
        <div className="word">{card.word}</div>
        {card.context && <p className="context">{card.context}</p>}
        {revealed && <div className="translation">{card.translation}</div>}
      </div>
      {revealed ? (
        <div className="grades">
          {(["again", "hard", "good", "easy"] as const).map((value, index) => (
            <button key={value} className={value === "good" ? "primary" : ""} onClick={() => void grade(value)}>
              {index + 1}. {value}
            </button>
          ))}
        </div>
      ) : (
        <button className="primary" style={{ width: "100%", marginTop: 12 }} onClick={() => setRevealed(true)}>
          Show answer (Space)
        </button>
      )}
      <p className="muted" style={{ marginTop: 8 }}>{queue.length} left</p>
    </div>
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
    <div>
      <input placeholder={`Search ${cards.length} words`} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="list">
        {visible.map((card) => (
          <div key={card.id} className="item spread">
            <div>
              <b>{card.word}</b> · {card.translation}
              <div className="muted">{card.state}</div>
            </div>
            <button className="link" title="Delete" onClick={() => void remove(card.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Footer({ account, onSync }: { account: AccountState | null; onSync: () => void }) {
  if (!account) return null;
  if (!account.email) {
    return (
      <div className="footer spread">
        <span className="muted">Saved on this device only</span>
        <button className="link" onClick={() => void chrome.runtime.openOptionsPage()}>Sign in to sync</button>
      </div>
    );
  }
  return (
    <div className="footer spread">
      <span className={account.lastError ? "error" : "muted"}>
        {account.lastError ?? (account.lastSyncedAt ? `Synced ${new Date(account.lastSyncedAt).toLocaleTimeString()}` : "Not synced yet")}
        {account.pendingChanges > 0 && ` · ${account.pendingChanges} pending`}
      </span>
      <button className="link" onClick={onSync}>Sync now</button>
    </div>
  );
}

async function openDashboard() {
  const { dashboardUrl } = await send("getSettings");
  await chrome.tabs.create({ url: dashboardUrl });
}

createRoot(document.getElementById("root")!).render(<Popup />);
