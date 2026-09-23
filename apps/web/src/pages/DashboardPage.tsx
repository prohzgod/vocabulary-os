import { REVIEW_STATES } from "@vocab-os/shared";
import { api } from "../api";
import { useLoad } from "../hooks";

export function DashboardPage() {
  const { data: stats, error } = useLoad(api.stats);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="text-slate-500">Loading…</p>;

  const tiles = [
    { label: "Due now", value: stats.due },
    { label: "Words saved", value: stats.total },
    { label: "Day streak", value: stats.streakDays },
    { label: "Added today", value: stats.addedToday },
    { label: "Reviewed today", value: stats.reviewedToday }
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="panel">
            <div className="text-2xl font-bold">{tile.value}</div>
            <div className="text-sm text-slate-500">{tile.label}</div>
          </div>
        ))}
      </div>

      <div className="panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">{stats.due > 0 ? `${stats.due} words are waiting for review` : "You're all caught up"}</h2>
          <p className="text-sm text-slate-500">Short daily reviews beat long occasional ones.</p>
        </div>
        {stats.due > 0 && <a className="btn-primary" href="#/review">Start review</a>}
      </div>

      <div className="panel">
        <h2 className="mb-3 font-semibold">Progress</h2>
        <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
          {REVIEW_STATES.map((state) => (
            <div key={state} className={STATE_COLORS[state]} style={{ width: `${stats.total ? (stats.byState[state] / stats.total) * 100 : 0}%` }} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-600">
          {REVIEW_STATES.map((state) => (
            <span key={state} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${STATE_COLORS[state]}`} />
              {state} {stats.byState[state]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

const STATE_COLORS = {
  new: "bg-slate-300",
  learning: "bg-amber-400",
  review: "bg-violet-500",
  mastered: "bg-emerald-500"
} as const;
