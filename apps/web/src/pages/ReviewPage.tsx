import { GRADES, type Card, type Grade } from "@vocab-os/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useLoad } from "../hooks";

const KEYS: Record<string, Grade> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };

export function ReviewPage() {
  const { data: queue, error, setData: setQueue } = useLoad(api.dueCards);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [gradeError, setGradeError] = useState("");
  const card = queue?.[0];

  const grade = useCallback(
    async (value: Grade) => {
      if (!card || !queue) return;
      setGradeError("");
      try {
        const updated = await api.reviewCard(card.id, value);
        // "Again" comes back at the end of this session; everything else leaves the queue.
        setQueue([...queue.slice(1), ...(value === "again" ? [updated] : [])]);
        setRevealed(false);
        setDone((count) => count + 1);
      } catch (caught) {
        setGradeError(caught instanceof Error ? caught.message : "Could not save the review.");
      }
    },
    [card, queue, setQueue]
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      if (event.key === " ") {
        event.preventDefault();
        setRevealed(true);
      } else if (revealed && KEYS[event.key]) {
        void grade(KEYS[event.key]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [grade, revealed]);

  if (error) return <p className="error">{error}</p>;
  if (!queue) return <p className="text-slate-500">Loading…</p>;
  if (!card) {
    return (
      <div className="panel text-center">
        <h2 className="text-lg font-semibold">{done > 0 ? `Session done: ${done} reviews 🎉` : "Nothing due right now"}</h2>
        <p className="mt-1 text-sm text-slate-500">Come back later, or save new words while you read.</p>
        <a className="btn mt-4" href="#/">Back to dashboard</a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <p className="text-sm text-slate-500">{queue.length} left · {done} done</p>
      <Flashcard card={card} revealed={revealed} />
      {revealed ? (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((value, index) => (
            <button key={value} className={value === "good" ? "btn-primary" : "btn"} onClick={() => void grade(value)}>
              {index + 1} · {value}
            </button>
          ))}
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={() => setRevealed(true)}>Show answer (Space)</button>
      )}
      {gradeError && <p className="error">{gradeError}</p>}
    </div>
  );
}

function Flashcard({ card, revealed }: { card: Card; revealed: boolean }) {
  return (
    <div className="panel py-10 text-center">
      <div className="text-3xl font-bold">{card.word}</div>
      {card.context && <p className="mt-4 text-slate-600">{card.context}</p>}
      {revealed && <div className="mt-6 text-2xl font-semibold text-violet-700">{card.translation}</div>}
    </div>
  );
}
