import { NextRequest, NextResponse } from "next/server";
import { findTenantByEmail } from "@/lib/store";
import { setSessionCookie } from "@/lib/session";

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const tenant = findTenantByEmail(email);

  if (!tenant || tenant.password !== body.password) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const res = NextResponse.json({
    ok: true,
    email: tenant.email,
    tenantId: tenant.tenantId,
    name: tenant.name,
  });
  setSessionCookie(res, { email: tenant.email, tenantId: tenant.tenantId });
  return res;
}
