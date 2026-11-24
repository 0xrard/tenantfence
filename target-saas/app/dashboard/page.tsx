"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Me {
  email: string;
  tenantId: string;
  name: string;
}

interface Invoice {
  id: string;
  tenantId: string;
  client: string;
  amount: string;
  status: string;
  secretNote: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const meRes = await fetch("/api/me");
      if (!meRes.ok) {
        router.push("/login");
        return;
      }
      setMe(await meRes.json());
      const invRes = await fetch("/api/invoices");
      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(data.invoices || []);
      } else {
        setError("Could not load invoices.");
      }
    })();
  }, [router]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
  }

  if (!me) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-2 text-slate-300">
            Logged in as <strong>{me.email}</strong> · tenant{" "}
            <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm">
              {me.tenantId}
            </code>
          </p>
        </div>
        <button
          onClick={logout}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-800"
        >
          Log out
        </button>
      </div>

      <h2 className="mt-10 text-xl font-semibold">Your invoices</h2>
      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      <ul className="mt-4 divide-y divide-slate-800 rounded-xl border border-slate-800">
        {invoices.map((inv) => (
          <li key={inv.id} className="flex items-center justify-between px-5 py-4">
            <div>
              <Link href={`/invoices/${inv.id}`} className="font-semibold text-blue-400 hover:underline">
                {inv.id}
              </Link>
              <p className="text-sm text-slate-400">{inv.client}</p>
            </div>
            <span className="font-semibold text-emerald-300">{inv.amount}</span>
          </li>
        ))}
        {invoices.length === 0 && (
          <li className="px-5 py-4 text-slate-400">No invoices yet.</li>
        )}
      </ul>
    </main>
  );
}
