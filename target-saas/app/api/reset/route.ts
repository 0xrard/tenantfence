import { NextResponse } from "next/server";
import { resetStore } from "@/lib/store";

// Verification support: restore the in-memory store to its seed state so
// every TenantFence run starts from identical data.
export async function POST() {
  const store = resetStore();
  return NextResponse.json({
    ok: true,
    tenants: store.tenants.length,
    invoices: store.invoices.length,
  });
}
