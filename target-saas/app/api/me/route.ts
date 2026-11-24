import { NextRequest, NextResponse } from "next/server";
import { getSessionTenant } from "@/lib/session";

export async function GET(req: NextRequest) {
  const tenant = getSessionTenant(req);
  if (!tenant) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  return NextResponse.json({
    email: tenant.email,
    tenantId: tenant.tenantId,
    name: tenant.name,
  });
}
