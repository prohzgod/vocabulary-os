import { useCallback, useEffect, useState } from "react";

/** Load data on mount (and when `deps` change). `reload` re-runs the loader. */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    setError(null);
    load().then(setData, (caught: unknown) => setError(caught instanceof Error ? caught.message : "Something went wrong."));
  }, deps);

  useEffect(reload, [reload]);
  return { data, error, reload, setData };
}

/** Minimal hash router: "#/words" → "/words". */
export function useRoute(): string {
  const read = () => window.location.hash.replace(/^#/, "") || "/";
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
