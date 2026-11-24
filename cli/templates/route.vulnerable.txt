import { NextRequest, NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/session";
import { findInvoiceById } from "@/lib/store";

// ============================================================================
// CONTROLLED VULNERABILITY — DELIBERATE, DO NOT "FIX" IN TAHAP 1.
//
// This handler authenticates the caller (401 when logged out) but then
// returns ANY invoice by id without checking that
// `invoice.tenantId === user.tenantId`. That missing ownership check is a
// textbook BOLA/IDOR flaw, planted on purpose: TenantFence exists to catch
// exactly this class of bug with Kane CLI, prove it with the ownership
// manifest in specs/, and (Tahap 2) drive the patch loop. The fix lands
// later as the product's own demo — not before the catch is recorded.
// ============================================================================

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = getSessionTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const { id } = await params;
  const invoice = findInvoiceById(id);
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  // BOLA/IDOR: no ownership validation here — see the banner above.
  return NextResponse.json({ invoice });
}
