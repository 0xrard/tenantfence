// Minimal cookie session for the InvoiceFlow test target.
//
// The session cookie carries { email, tenantId } as base64url-encoded
// JSON. This is intentionally lightweight — InvoiceFlow is a fixture
// app for TenantFence verification runs, not a production auth system.

import type { NextRequest, NextResponse } from "next/server";
import { findTenantByEmail, type Tenant } from "./store";

export const SESSION_COOKIE = "tf_session";

export interface SessionUser {
  email: string;
  tenantId: string;
}

export function encodeSession(user: SessionUser): string {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

export function decodeSession(raw: string | undefined): SessionUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(raw, "base64url").toString("utf8")
    ) as SessionUser;
    if (typeof parsed.email === "string" && typeof parsed.tenantId === "string") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setSessionCookie(res: NextResponse, user: SessionUser): void {
  res.cookies.set(SESSION_COOKIE, encodeSession(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 hours
  });
}

export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Resolve the logged-in tenant from the request cookie, or null. */
export function getSessionTenant(req: NextRequest): Tenant | null {
  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const tenant = findTenantByEmail(session.email);
  if (!tenant || tenant.tenantId !== session.tenantId) return null;
  return tenant;
}
