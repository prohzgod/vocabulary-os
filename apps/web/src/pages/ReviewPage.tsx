import { GRADES, formatInterval, gradeIntervals, type Card, type Grade } from "@vocab-os/shared";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { useLoad } from "../hooks";
import { Highlighted } from "../ui";

const KEYS: Record<string, Grade> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
const LABELS: Record<Grade, string> = { again: "Again", hard: "Hard", good: "Good", easy: "Easy" };

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
  if (!queue) return <p className="text-ink-2">Loading…</p>;
  if (!card) {
    return (
      <div className="mx-auto flex max-w-[680px] flex-col items-center gap-3 py-16 text-center">
        <h1 className="font-serif text-4xl font-medium tracking-[-0.02em]">{done > 0 ? "Session done." : "All caught up."}</h1>
        <p className="text-ink-2">
          {done > 0 ? `${done} ${done === 1 ? "review" : "reviews"}. ` : ""}Come back later, or save new words while you read.
        </p>
        <a className="btn mt-3" href="#/">Back to today</a>
      </div>
    );
  }

  const total = queue.length + done;
  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-5">
      <div className="flex items-center gap-4">
        <span className="whitespace-nowrap text-[13px] text-ink-2">{done + 1} of {total}</span>
        <div className="h-1 flex-grow overflow-hidden rounded-full bg-line">
          <div className="h-1 bg-ink transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <a href="#/" className="whitespace-nowrap text-[13px] font-medium underline underline-offset-[3px]">End session</a>
      </div>
      <Flashcard card={card} revealed={revealed} />
      {revealed ? (
        <Grades card={card} onGrade={(value) => void grade(value)} />
      ) : (
        <button className="btn-primary h-14 rounded-2xl text-base" onClick={() => setRevealed(true)}>
          Show answer <kbd className="rounded-[5px] border border-current px-1.5 text-[11px] font-medium opacity-70">Space</kbd>
        </button>
      )}
      <p className="text-center text-[13px] text-ink-3">Space shows the answer · 1–4 grades it</p>
      {gradeError && <p className="error text-center">{gradeError}</p>}
    </div>
  );
}

function Grades({ card, onGrade }: { card: Card; onGrade: (grade: Grade) => void }) {
  const intervals = gradeIntervals(card);
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {GRADES.map((value, index) => (
        <button
          key={value}
          onClick={() => onGrade(value)}
          className={`flex h-[76px] flex-col items-center justify-center gap-1 rounded-[14px] border ${value === "good" ? "border-ink bg-ink text-paper" : "border-line bg-card hover:border-ink-3"}`}
        >
          <span className={`text-base font-semibold ${value === "again" ? "text-rust" : ""}`}>{LABELS[value]}</span>
          <span className={`text-xs ${value === "good" ? "text-line-2" : "text-ink-3"}`}>
            {formatInterval(intervals[value])} · {index + 1}
          </span>
        </button>
      ))}
    </div>
  );
}

function Flashcard({ card, revealed }: { card: Card; revealed: boolean }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-3xl border border-line bg-card px-8 py-12 text-center sm:px-14">
      <h1 className="break-words font-serif text-5xl font-medium leading-none tracking-[-0.03em] sm:text-6xl">{card.word}</h1>
      {card.context && (
        <p className="max-w-[460px] text-lg leading-relaxed text-body"><Highlighted text={card.context} word={card.word} /></p>
      )}
      {card.sourceUrl && (
        <a className="text-[13px] text-ink-2 underline underline-offset-[3px]" href={card.sourceUrl} target="_blank" rel="noreferrer">
          {card.sourceTitle || card.sourceUrl}
        </a>
      )}
      {revealed && (
        <>
          <div className="mb-1.5 mt-3.5 w-20 border-t border-dashed border-line-2" />
          <div className="font-serif text-[38px] font-medium leading-tight tracking-[-0.01em]">{card.translation}</div>
        </>
      )}
    </section>
  );
}
