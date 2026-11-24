import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
        TenantFence · target SaaS
      </p>
      <h1 className="mt-3 text-4xl font-bold">InvoiceFlow</h1>
      <p className="mt-4 leading-relaxed text-slate-300">
        A small multi-tenant invoicing app. Every tenant sees only its own
        invoices — that is the promise. InvoiceFlow is the application
        TenantFence verifies with Kane CLI against the ownership contract in{" "}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm">
          specs/ownership.manifest.json
        </code>
        .
      </p>
      <div className="mt-8 flex gap-3">
        <Link
          href="/login"
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold hover:bg-blue-500"
        >
          Log in
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg border border-slate-700 px-5 py-2.5 font-semibold hover:bg-slate-800"
        >
          Dashboard
        </Link>
      </div>
      <p className="mt-10 text-sm text-slate-400">
        Demo accounts (fixtures, not real credentials):{" "}
        <code>finance@alpha.test</code> and <code>finance@beta.test</code> —
        passwords are on the login page.
      </p>
    </main>
  );
}
