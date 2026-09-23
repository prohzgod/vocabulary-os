import { useState, type FormEvent } from "react";
import { api, session } from "../api";
import { Mark } from "../ui";

export function LoginPage({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await (mode === "login" ? api.login : api.register)({ email, password });
      session.set(token);
      onSignedIn();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-5 p-8">
        <div className="space-y-3">
          <Mark size={40} />
          <h1 className="font-serif text-3xl font-medium tracking-[-0.02em]">{mode === "login" ? "Welcome back." : "Make an account."}</h1>
          <p className="text-sm text-ink-2">Translate, save, review, remember.</p>
        </div>
        <label className="grid gap-1.5 text-xs font-medium text-ink-2">
          Email
          <input className="input" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-ink-2">
          Password
          <input
            className="input"
            type="password"
            placeholder="8+ characters"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn-primary h-11 w-full" disabled={busy}>{mode === "login" ? "Sign in" : "Create account"}</button>
        <button type="button" className="w-full text-sm font-medium underline underline-offset-[3px]" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
