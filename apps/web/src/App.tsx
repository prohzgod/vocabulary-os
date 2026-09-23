import { useEffect, useState } from "react";
import { SIGNED_OUT_EVENT, session } from "./api";
import { useRoute } from "./hooks";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ReviewPage } from "./pages/ReviewPage";
import { WordsPage } from "./pages/WordsPage";

const PAGES = [
  { path: "/", label: "Dashboard", element: <DashboardPage /> },
  { path: "/words", label: "Words", element: <WordsPage /> },
  { path: "/review", label: "Review", element: <ReviewPage /> }
];

export function App() {
  const [signedIn, setSignedIn] = useState(() => Boolean(session.token()));
  const route = useRoute();

  useEffect(() => {
    const onSignOut = () => setSignedIn(false);
    window.addEventListener(SIGNED_OUT_EVENT, onSignOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignOut);
  }, []);

  if (!signedIn) {
    return <LoginPage onSignedIn={() => setSignedIn(true)} />;
  }

  const page = PAGES.find((candidate) => candidate.path === route) ?? PAGES[0]!;
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
          <span className="mr-4 font-bold text-violet-700">Vocabulary OS</span>
          {PAGES.map((item) => (
            <a
              key={item.path}
              href={`#${item.path}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${item === page ? "bg-violet-50 font-semibold text-violet-700" : "text-slate-600 hover:bg-slate-100"}`}
            >
              {item.label}
            </a>
          ))}
          <button className="btn ml-auto" onClick={() => session.clear()}>Sign out</button>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{page.element}</main>
    </div>
  );
}
