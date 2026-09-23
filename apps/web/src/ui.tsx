import type { ReviewState } from "@vocab-os/shared";
import type { ReactNode } from "react";

/** The app mark: a lowercase v over a highlighter stroke. */
export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect x="1" y="1" width="62" height="62" rx="15" fill="#FFFEFB" stroke="#D6CFC2" strokeWidth="2" />
      <rect x="12" y="33" width="40" height="14" rx="3" fill="#FFD84D" transform="rotate(-6 32 40)" />
      <path d="M19 18L32 45L45 18" fill="none" stroke="#1C1A17" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FILLS: Record<ReviewState, ReactNode> = {
  new: null,
  learning: <path d="M6 6V1.25A4.75 4.75 0 0 1 10.75 6Z" fill="currentColor" />,
  review: <path d="M6 1.25A4.75 4.75 0 0 1 6 10.75Z" fill="currentColor" />,
  mastered: <circle cx="6" cy="6" r="4.75" fill="currentColor" />
};

/** A circle that fills in as a word moves from new to mastered. */
export function StateGlyph({ state, size = 12 }: { state: ReviewState; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" role="img" aria-label={state} className="shrink-0">
      <circle cx="6" cy="6" r="4.75" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {FILLS[state]}
    </svg>
  );
}

const PATHS = {
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>,
  trash: <path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  plus: <path d="M12 5v14M5 12h14" />
};

export function Icon({ name, size = 16 }: { name: keyof typeof PATHS; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

/** The sentence with the saved word marked in highlighter yellow. */
export function Highlighted({ text, word }: { text: string; word: string }) {
  const index = text.toLowerCase().indexOf(word.toLowerCase());
  if (index < 0 || !word) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + word.length)}</mark>
      {text.slice(index + word.length)}
    </>
  );
}

export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
