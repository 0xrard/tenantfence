"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Invoice {
  id: string;
  tenantId: string;
  client: string;
  amount: string;
  status: string;
  secretNote: string;
}

export default function InvoiceDetailClient({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/invoices/${encodeURIComponent(id)}`);
      setStatus(res.status);
      if (res.status === 401) {
        setError("You are not logged in.");
        return;
      }
      if (res.status === 404) {
        setError("Invoice not found.");
        return;
      }
      if (!res.ok) {
        setError("Could not load this invoice.");
        return;
      }
      const data = await res.json();
      setInvoice(data.invoice);
    })();
  }, [id]);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/dashboard" className="text-sm text-blue-400 hover:underline">
        ← Back to dashboard
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Invoice {id}</h1>

      {error && (
        <div className="mt-6 rounded-xl border border-red-900 bg-red-950/40 px-5 py-4">
          <p className="text-red-300">{error}</p>
          {status === 401 && (
            <Link href="/login" className="mt-2 inline-block text-blue-400 hover:underline">
              Go to login
            </Link>
          )}
        </div>
      )}

      {invoice && (
        <dl className="mt-6 space-y-3 rounded-xl border border-slate-800 px-5 py-5">
          <div className="flex justify-between">
            <dt className="text-slate-400">Client</dt>
            <dd className="font-semibold">{invoice.client}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Amount</dt>
            <dd className="font-semibold text-emerald-300">{invoice.amount}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Status</dt>
            <dd>{invoice.status}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Owner tenant</dt>
            <dd>
              <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm">
                {invoice.tenantId}
              </code>
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-400">Internal note</dt>
            <dd className="font-mono font-semibold text-amber-300">
              {invoice.secretNote}
            </dd>
          </div>
        </dl>
      )}
    </main>
  );
}
