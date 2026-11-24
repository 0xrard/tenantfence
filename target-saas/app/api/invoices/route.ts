import { NextRequest, NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/session";
import { invoicesForTenant } from "@/lib/store";

// List endpoint — correctly scoped: a tenant only ever sees its own
// invoices here. (Contrast with GET /api/invoices/[id].)
export async function GET(req: NextRequest) {
  const tenant = getSessionTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  return NextResponse.json({ invoices: invoicesForTenant(tenant.tenantId) });
}
