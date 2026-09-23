import { useEffect, useState } from "react";
import { SIGNED_OUT_EVENT, api, session } from "./api";
import { useRoute } from "./hooks";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ReviewPage } from "./pages/ReviewPage";
import { WordsPage } from "./pages/WordsPage";
import { Mark } from "./ui";

const PAGES = [
  { path: "/", label: "Today", element: <DashboardPage /> },
  { path: "/words", label: "Words", element: <WordsPage /> },
  { path: "/review", label: "Review", element: <ReviewPage /> }
];

export function App() {
  const [signedIn, setSignedIn] = useState(() => Boolean(session.token()));
  const [email, setEmail] = useState<string | null>(null);
  const route = useRoute();

  useEffect(() => {
    const onSignOut = () => setSignedIn(false);
    window.addEventListener(SIGNED_OUT_EVENT, onSignOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignOut);
  }, []);

  useEffect(() => {
    if (signedIn) void api.me().then((user) => setEmail(user.email), () => undefined);
  }, [signedIn]);

  if (!signedIn) {
    return <LoginPage onSignedIn={() => setSignedIn(true)} />;
  }

  const page = PAGES.find((candidate) => candidate.path === route) ?? PAGES[0]!;
  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-4 px-4 sm:gap-10 sm:px-10">
          <a href="#/" className="flex items-center gap-2.5 no-underline">
            <Mark />
            <span className="hidden font-serif text-xl font-semibold tracking-tight sm:inline">Vocabulary</span>
          </a>
          <nav className="flex gap-1">
            {PAGES.map((item) => (
              <a
                key={item.path}
                href={`#${item.path}`}
                aria-current={item === page ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-sm ${item === page ? "bg-paper-2 font-semibold text-ink" : "font-medium text-ink-2 hover:text-ink"}`}
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3.5 text-[13px] text-ink-2">
            {email && <span className="hidden md:inline">{email}</span>}
            <button className="btn h-9 bg-transparent" onClick={() => session.clear()}>Sign out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 py-10 sm:px-10">{page.element}</main>
    </div>
  );
}
