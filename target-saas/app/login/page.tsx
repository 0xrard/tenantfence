"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const FIXTURES = [
  { label: "Fill Alpha credentials", email: "finance@alpha.test", password: "AlphaPass123!" },
  { label: "Fill Beta credentials", email: "finance@beta.test", password: "BetaPass123!" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Login failed");
        return;
      }
      router.push("/dashboard");
    } catch {
      setError("Network error — is the server running?");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-bold">Log in to InvoiceFlow</h1>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm text-slate-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="finance@alpha.test"
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm text-slate-300">
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            placeholder="••••••••••"
            autoComplete="current-password"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-blue-600 px-5 py-2.5 font-semibold hover:bg-blue-500 disabled:bg-slate-700"
        >
          {busy ? "Logging in…" : "Log in"}
        </button>
      </form>

      <div className="mt-8 space-y-2">
        <p className="text-sm text-slate-400">Quick fill (test fixtures):</p>
        {FIXTURES.map((f) => (
          <button
            key={f.email}
            type="button"
            onClick={() => {
              setEmail(f.email);
              setPassword(f.password);
            }}
            className="block w-full rounded-lg border border-slate-700 px-4 py-2 text-left text-sm hover:bg-slate-800"
          >
            {f.label} — <code>{f.email}</code>
          </button>
        ))}
      </div>
    </main>
  );
}
