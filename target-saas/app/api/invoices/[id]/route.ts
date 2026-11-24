import { NextRequest, NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/session";
import { findInvoiceById } from "@/lib/store";

// ============================================================================
// OWNERSHIP CHECK ENFORCED — patched via the TenantFence closed loop.
//
// This handler originally authenticated the caller but returned ANY
// invoice by id without an ownership check (BOLA/IDOR). TenantFence
// proved the exposure with Kane CLI browser sessions and an HTTP probe
// (see artifacts/evidence/finding-bundle.json), the fix below was
// applied from artifacts/evidence/muse-patch-prompt.md, and the loop
// re-verified: cross-tenant requests now receive 403 while owners keep
// full access to their own invoices.
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

  // Tenant isolation: an invoice is only visible to the tenant that
  // owns it. Any other authenticated tenant gets 403, with no invoice
  // fields in the response.
  if (invoice.tenantId !== tenant.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ invoice });
}
