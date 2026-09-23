import { useState, type FormEvent } from "react";
import { api, session } from "../api";

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
    <div className="grid min-h-screen place-items-center bg-slate-50 px-4">
      <form onSubmit={submit} className="panel w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-bold text-violet-700">Vocabulary OS</h1>
          <p className="text-sm text-slate-500">Translate, save, review, remember.</p>
        </div>
        <input className="input" type="email" placeholder="Email" required value={email} onChange={(event) => setEmail(event.target.value)} />
        <input
          className="input"
          type="password"
          placeholder="Password (8+ characters)"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {error && <p className="error">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{mode === "login" ? "Sign in" : "Create account"}</button>
        <button type="button" className="w-full text-sm text-violet-700" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
