/**
 * Decides *when* to look for saved words on a page.
 *
 * A single pass after load is not enough: many pages render their text later
 * (lazy loading, infinite scroll, apps that hydrate late, client-side route
 * changes). So the page is watched and a pass runs shortly after it changes.
 * When passes stop finding anything, the wait doubles up to `maxDelay`, so a
 * page with constant DOM churn (ads, tickers) costs almost nothing.
 */

export interface PageWatcher {
  /** Forget changes seen so far, so our own edits do not trigger a pass. */
  drain(): void;
  stop(): void;
}

/** Calls `onChange` whenever the page changes. Swapped out in tests. */
export type WatchPage = (onChange: () => void) => PageWatcher;

export interface SchedulerOptions {
  firstDelay?: number;
  minDelay?: number;
  maxDelay?: number;
  watch?: WatchPage;
}

export interface HighlightScheduler {
  /** Run a pass now, e.g. after the user saves a word. */
  refreshNow(): void;
  stop(): void;
}

export const watchDom =
  (root: Node = document.documentElement): WatchPage =>
  (onChange) => {
    const observer = new MutationObserver(onChange);
    observer.observe(root, { childList: true, subtree: true });
    return {
      drain: () => observer.takeRecords(),
      stop: () => observer.disconnect()
    };
  };

/** `runPass` highlights the page and returns how many words it wrapped. */
export function startHighlightScheduler(runPass: () => Promise<number>, options: SchedulerOptions = {}): HighlightScheduler {
  const firstDelay = options.firstDelay ?? 800;
  const minDelay = options.minDelay ?? 600;
  const maxDelay = options.maxDelay ?? 8000;

  let timer: ReturnType<typeof setTimeout> | undefined;
  let delay = minDelay;
  let applying = false;
  let stopped = false;

  const schedule = (wait: number) => {
    clearTimeout(timer);
    timer = setTimeout(() => void pass(), wait);
  };

  const pass = async () => {
    applying = true;
    try {
      const highlighted = await runPass();
      delay = highlighted > 0 ? minDelay : Math.min(delay * 2, maxDelay);
    } finally {
      // Forget the changes our own highlighting just made, so wrapping a word
      // never schedules another pass. A page edit landing in this same window
      // is forgotten too, but the page's next edit schedules one anyway.
      watcher.drain();
      applying = false;
    }
  };

  const watcher = (options.watch ?? watchDom())(() => {
    if (!applying && !stopped) schedule(delay);
  });
  schedule(firstDelay);

  return {
    refreshNow() {
      if (stopped) return;
      delay = minDelay;
      schedule(0);
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      watcher.stop();
    }
  };
}
