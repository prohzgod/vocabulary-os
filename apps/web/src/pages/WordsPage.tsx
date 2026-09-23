import { REVIEW_STATES, formatInterval, isDue, type Card, type ReviewState } from "@vocab-os/shared";
import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useLoad } from "../hooks";
import { Highlighted, Icon, StateGlyph } from "../ui";

type Filter = "all" | "due" | ReviewState;

export function WordsPage() {
  const { data: cards, error, setData: setCards } = useLoad(api.cards);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  if (error) return <p className="error">{error}</p>;
  if (!cards) return <p className="text-ink-2">Loading…</p>;

  const now = new Date();
  const replace = (card: Card) => setCards(cards.map((existing) => (existing.id === card.id ? card : existing)));
  const q = query.trim().toLowerCase();
  const matchesFilter = (card: Card) => filter === "all" || (filter === "due" ? isDue(card, now) : card.state === filter);
  const visible = cards.filter(
    (card) =>
      matchesFilter(card) &&
      (!q || card.word.toLowerCase().includes(q) || card.translation.toLowerCase().includes(q) || card.tags.some((tag) => tag.includes(q)))
  );
  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: cards.length },
    { value: "due", label: "Due", count: cards.filter((card) => isDue(card, now)).length },
    ...REVIEW_STATES.map((state) => ({ value: state, label: state[0]!.toUpperCase() + state.slice(1), count: cards.filter((card) => card.state === state).length }))
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-serif text-[38px] font-medium tracking-[-0.02em]">
          Words <span className="font-normal text-ink-3">{cards.length}</span>
        </h1>
        <label className="flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-card px-3.5 text-ink-3 focus-within:border-ink sm:w-[300px]">
          <Icon name="search" />
          <span className="sr-only">Search</span>
          <input
            type="search"
            className="h-full flex-grow bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
            placeholder="Search words, meanings, tags"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <AddWord onAdded={(card) => setCards([card, ...cards])} />

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
            className={`flex h-[34px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium ${filter === item.value ? "border-ink bg-ink text-paper" : "border-line-2 text-ink hover:border-ink-3"}`}
          >
            {item.value !== "all" && item.value !== "due" && <StateGlyph state={item.value} size={11} />}
            {item.label} {item.count}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card">
        <div className="hidden grid-cols-[260px_minmax(0,1fr)_130px_88px] px-4 pb-2.5 pt-3.5 md:grid">
          <span className="eyebrow">Word</span>
          <span className="eyebrow">Where you found it</span>
          <span className="eyebrow">Next review</span>
          <span className="sr-only">Actions</span>
        </div>
        {visible.map((card) => (
          <WordRow key={card.id} card={card} onSaved={replace} onDeleted={() => setCards(cards.filter((existing) => existing.id !== card.id))} />
        ))}
        {visible.length === 0 && (
          <p className="border-t border-line p-4 text-sm text-ink-2">
            {cards.length === 0 ? "No words yet. Save words with the browser extension or add one above." : "No word matches."}
          </p>
        )}
      </div>
    </div>
  );
}

function AddWord({ onAdded }: { onAdded: (card: Card) => void }) {
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [context, setContext] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      onAdded(await api.createCard({ word, translation, context, sourceLanguage: "en", targetLanguage: "vi" }));
      setWord("");
      setTranslation("");
      setContext("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add the word.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border border-line bg-card p-4">
      <div className="grid gap-2.5 md:grid-cols-[220px_240px_minmax(0,1fr)_auto] md:items-end">
        <label className="grid gap-1.5 text-xs font-medium text-ink-2">
          English word
          <input className="input font-serif text-[15px]" required value={word} onChange={(event) => setWord(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-ink-2">
          Vietnamese
          <input className="input" required value={translation} onChange={(event) => setTranslation(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-ink-2">
          Example sentence (optional)
          <input className="input" placeholder="Where did you see it?" value={context} onChange={(event) => setContext(event.target.value)} />
        </label>
        <button className="btn-primary h-11">
          <Icon name="plus" />
          Add
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function WordRow({ card, onSaved, onDeleted }: { card: Card; onSaved: (card: Card) => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [translation, setTranslation] = useState(card.translation);
  const [context, setContext] = useState(card.context ?? "");
  const [tags, setTags] = useState(card.tags.join(", "));
  const [error, setError] = useState("");

  const run = async (action: () => Promise<void>) => {
    setError("");
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.");
    }
  };

  const save = () =>
    run(async () => {
      onSaved(await api.updateCard(card.id, { translation, context, tags: tags.split(",") }));
      setEditing(false);
    });

  const remove = () =>
    run(async () => {
      if (!window.confirm(`Delete "${card.word}"?`)) return;
      await api.deleteCard(card.id);
      onDeleted();
    });

  const due = isDue(card);
  return (
    <div className="group border-t border-line px-4 py-4 hover:bg-paper">
      <div className="grid gap-2 md:grid-cols-[260px_minmax(0,1fr)_130px_88px] md:gap-0">
        <div className="flex items-baseline gap-2.5 md:pr-4">
          <StateGlyph state={card.state} />
          <div className="grid min-w-0 gap-0.5">
            <span className="break-words font-serif text-[19px] font-medium">{card.word}</span>
            {!editing && <span className="text-sm text-ink-2">{card.translation}</span>}
          </div>
        </div>
        {!editing && (
          <div className="grid content-start gap-1 text-sm md:pr-4">
            {card.context ? (
              <span className="leading-normal text-body"><Highlighted text={card.context} word={card.word} /></span>
            ) : (
              <span className="text-ink-3">{card.sourceUrl ? "No sentence saved" : "Added by hand"}</span>
            )}
            <div className="flex flex-wrap items-center gap-1.5">
              {card.sourceUrl && (
                <a className="text-xs text-ink-2 underline-offset-[3px] hover:underline" href={card.sourceUrl} target="_blank" rel="noreferrer">
                  {card.sourceTitle || card.sourceUrl}
                </a>
              )}
              {card.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-paper-2 px-2 py-0.5 text-xs text-ink-2">{tag}</span>
              ))}
            </div>
          </div>
        )}
        {editing && (
          <div className="grid gap-2 md:col-span-2 md:pr-4">
            <label className="grid gap-1.5 text-xs font-medium text-ink-2">Vietnamese<input className="input" value={translation} onChange={(event) => setTranslation(event.target.value)} /></label>
            <label className="grid gap-1.5 text-xs font-medium text-ink-2">Sentence<input className="input" value={context} onChange={(event) => setContext(event.target.value)} /></label>
            <label className="grid gap-1.5 text-xs font-medium text-ink-2">Tags<input className="input" placeholder="comma separated" value={tags} onChange={(event) => setTags(event.target.value)} /></label>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => void save()}>Save</button>
              <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        )}
        {!editing && (
          <span className={`text-sm ${due ? "font-semibold" : "text-ink-2"}`}>
            {due ? "Due now" : `In ${formatInterval(Date.parse(card.dueAt) - Date.now())}`}
          </span>
        )}
        <div className="flex justify-end gap-1 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
          {!editing && (
            <button className="btn-icon" aria-label={`Edit ${card.word}`} title="Edit" onClick={() => setEditing(true)}>
              <Icon name="edit" />
            </button>
          )}
          <button className="btn-icon text-rust" aria-label={`Delete ${card.word}`} title="Delete" onClick={() => void remove()}>
            <Icon name="trash" />
          </button>
        </div>
      </div>
      {error && <p className="error mt-2">{error}</p>}
    </div>
  );
}
