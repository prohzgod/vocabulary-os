import { REVIEW_STATES, isDue } from "@vocab-os/shared";
import { api } from "../api";
import { useLoad } from "../hooks";
import { Highlighted, StateGlyph, hostname, plural } from "../ui";

export function DashboardPage() {
  const { data: stats, error } = useLoad(api.stats);
  const { data: cards } = useLoad(api.cards);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="text-ink-2">Loading…</p>;

  const now = new Date();
  const upNext = (cards ?? []).filter((card) => isDue(card, now)).slice(0, 3);
  const recent = [...(cards ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const today = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <section className="grid gap-6 md:grid-cols-[1.55fr_1fr]">
        <div className="panel flex flex-col gap-4 p-8 sm:px-10 sm:py-9">
          <span className="text-[13px] text-ink-3">{today}</span>
          <h1 className="font-serif text-4xl font-medium leading-[1.08] tracking-[-0.025em] sm:text-[46px]">
            {stats.due > 0 ? `${plural(stats.due, "word")} ${stats.due === 1 ? "is" : "are"} waiting.` : "All caught up."}
          </h1>
          {stats.due > 0 && upNext.length > 0 ? (
            <p className="text-[15px] leading-relaxed text-ink-2">
              Up next:{" "}
              {upNext.map((card, index) => (
                <span key={card.id}>
                  {index > 0 && ", "}
                  <mark>{card.word}</mark>
                </span>
              ))}
              {stats.due > upNext.length && ` and ${stats.due - upNext.length} more`}.
            </p>
          ) : (
            <p className="text-[15px] leading-relaxed text-ink-2">Save new words while you read. They show up here when they're due.</p>
          )}
          {stats.due > 0 && (
            <div className="flex flex-wrap items-center gap-4 pt-1.5">
              <a className="btn-primary h-12 rounded-xl px-6 text-[15px]" href="#/review">Start review</a>
              <span className="text-[13px] text-ink-3">Short daily reviews beat long occasional ones.</span>
            </div>
          )}
        </div>
        <div className="panel flex flex-col gap-3 p-8">
          <div className="flex items-baseline gap-2.5">
            <span className="font-serif text-[46px] font-medium leading-none">{stats.streakDays}</span>
            <span className="text-[15px] font-medium">day streak</span>
          </div>
          <p className="text-[13px] leading-relaxed text-ink-2">
            {stats.reviewedToday > 0 || stats.addedToday > 0
              ? "Today counts. Come back tomorrow to keep it going."
              : `Review or save a word today to make it ${stats.streakDays + 1}.`}
          </p>
          <p className="mt-auto text-[13px] text-ink-2">
            {stats.addedToday} added today · {stats.reviewedToday} reviewed today
          </p>
        </div>
      </section>

      <section className="panel flex flex-col gap-4 px-8 py-7">
        <h2 className="text-base font-semibold">{plural(stats.total, "word")}</h2>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-paper-2">
          {REVIEW_STATES.map((state) => (
            <div key={state} className={STATE_FILLS[state]} style={{ width: `${stats.total ? (stats.byState[state] / stats.total) * 100 : 0}%` }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] text-body">
          {REVIEW_STATES.map((state) => (
            <span key={state} className="flex items-center gap-2">
              <StateGlyph state={state} />
              {state} <strong className="font-semibold">{stats.byState[state]}</strong>
            </span>
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Recently saved</h2>
            <a href="#/words" className="text-[13px] font-medium underline underline-offset-[3px]">All words</a>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {recent.map((card) => (
              <article key={card.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-5 py-5">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-serif text-[22px] font-medium">{card.word}</span>
                  <span className="text-sm text-ink-2">{card.translation}</span>
                </div>
                {card.context && <p className="text-sm leading-normal text-body"><Highlighted text={card.context} word={card.word} /></p>}
                <span className="mt-auto text-xs text-ink-3">
                  {card.sourceUrl ? `${hostname(card.sourceUrl)} · ` : ""}
                  {new Date(card.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                </span>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// Shades of ink rather than a rainbow: darker means better known.
const STATE_FILLS = {
  new: "bg-line",
  learning: "bg-[#C9BFAE]",
  review: "bg-[#7D7466]",
  mastered: "bg-ink"
} as const;
