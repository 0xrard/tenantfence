import { Suspense } from "react";
import InvoiceDetailClient from "./InvoiceDetailClient";

async function InvoiceDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InvoiceDetailClient id={id} />;
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-3xl px-6 py-16">
          <p className="text-slate-400">Loading…</p>
        </main>
      }
    >
      <InvoiceDetail params={params} />
    </Suspense>
  );
}
