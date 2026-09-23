import type { Card } from "@vocab-os/shared";
import { useState, type FormEvent } from "react";
import { api } from "../api";
import { useLoad } from "../hooks";

export function WordsPage() {
  const { data: cards, error, setData: setCards } = useLoad(api.cards);
  const [query, setQuery] = useState("");

  if (error) return <p className="error">{error}</p>;
  if (!cards) return <p className="text-slate-500">Loading…</p>;

  const replace = (card: Card) => setCards(cards.map((existing) => (existing.id === card.id ? card : existing)));
  const q = query.trim().toLowerCase();
  const visible = cards.filter(
    (card) => !q || card.word.toLowerCase().includes(q) || card.translation.toLowerCase().includes(q) || card.tags.some((tag) => tag.includes(q))
  );

  return (
    <div className="space-y-4">
      <AddWord onAdded={(card) => setCards([card, ...cards])} />
      <input className="input" placeholder={`Search ${cards.length} words, translations or tags`} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="space-y-2">
        {visible.map((card) => (
          <WordRow key={card.id} card={card} onSaved={replace} onDeleted={() => setCards(cards.filter((existing) => existing.id !== card.id))} />
        ))}
        {visible.length === 0 && <p className="text-sm text-slate-500">No words yet. Save words with the browser extension or add one above.</p>}
      </div>
    </div>
  );
}

function AddWord({ onAdded }: { onAdded: (card: Card) => void }) {
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      onAdded(await api.createCard({ word, translation, sourceLanguage: "en", targetLanguage: "vi" }));
      setWord("");
      setTranslation("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add the word.");
    }
  };

  return (
    <form onSubmit={submit} className="panel space-y-2">
      <div className="flex flex-wrap gap-2">
        <input className="input flex-1" placeholder="Word (English)" required value={word} onChange={(event) => setWord(event.target.value)} />
        <input className="input flex-1" placeholder="Translation (Vietnamese)" required value={translation} onChange={(event) => setTranslation(event.target.value)} />
        <button className="btn-primary">Add word</button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function WordRow({ card, onSaved, onDeleted }: { card: Card; onSaved: (card: Card) => void; onDeleted: () => void }) {
  const [editing, setEditing] = useState(false);
  const [translation, setTranslation] = useState(card.translation);
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
      onSaved(await api.updateCard(card.id, { translation, tags: tags.split(",") }));
      setEditing(false);
    });

  const remove = () =>
    run(async () => {
      if (!window.confirm(`Delete "${card.word}"?`)) return;
      await api.deleteCard(card.id);
      onDeleted();
    });

  return (
    <div className="panel py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div>
            <span className="font-semibold">{card.word}</span>
            {!editing && <span className="text-slate-600"> · {card.translation}</span>}
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{card.state}</span>
            {card.tags.map((tag) => (
              <span key={tag} className="ml-1 rounded-full bg-violet-50 px-2 py-0.5 text-xs text-violet-700">{tag}</span>
            ))}
          </div>
          {card.context && <p className="mt-1 text-sm text-slate-500">{card.context}</p>}
          {card.sourceUrl && (
            <a className="text-xs text-violet-700 hover:underline" href={card.sourceUrl} target="_blank" rel="noreferrer">
              {card.sourceTitle || card.sourceUrl}
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setEditing(!editing)}>{editing ? "Cancel" : "Edit"}</button>
          <button className="btn text-red-700" onClick={() => void remove()}>Delete</button>
        </div>
      </div>
      {editing && (
        <div className="mt-3 flex flex-wrap gap-2">
          <input className="input flex-1" value={translation} onChange={(event) => setTranslation(event.target.value)} />
          <input className="input flex-1" placeholder="tags, comma separated" value={tags} onChange={(event) => setTags(event.target.value)} />
          <button className="btn-primary" onClick={() => void save()}>Save</button>
        </div>
      )}
      {error && <p className="error mt-2">{error}</p>}
    </div>
  );
}
