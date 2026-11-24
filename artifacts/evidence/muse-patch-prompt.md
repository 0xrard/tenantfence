# TenantFence patch task — fix CROSS_TENANT_DATA_EXPOSURE

TenantFence (Kane CLI + HTTP probe evidence) has PROVEN a cross-tenant
data exposure in the InvoiceFlow target app. Your job: apply the smallest
correct authorization fix so the closed loop can re-verify.

## What was proven

Target: https://tenantfence.vercel.app (commit a22e9821b3a9a22ab8c7f1555684b71f351c3aea)

### INV-1001 — owned by `tenant-alpha`

- Accessor (attacker in this test): **finance@beta.test** (`tenant-beta`)
- API probe result: HTTP **200** on `GET /api/invoices/INV-1001` with the accessor's session cookie
- Sensitive markers leaked: `CONFIDENTIAL-ALPHA-9921`, `$15,000`
- Observed via: api, browser
- Kane CLI evidence:
  - artifacts/evidence/run-before/kane/output-cross-tenant-beta-inv-1001/.internal/execution.json
  - artifacts/evidence/run-before/kane/output-cross-tenant-beta-inv-1001/.internal/meta.json
  - artifacts/evidence/run-before/kane/output-cross-tenant-beta-inv-1001/.internal/steps/1-c793dacc/flows/0/actions.ndjson
  - artifacts/evidence/run-before/kane/output-cross-tenant-beta-inv-1001/.internal/steps/2-4c50f627/flows/0/actions.ndjson
  - artifacts/evidence/run-before/kane/output-cross-tenant-beta-inv-1001/.internal/steps/3-914b28c3/flows/0/actions.ndjson
  - artifacts/evidence/run-before/kane/output-cross-tenant-beta-inv-1001/Result.md
  - artifacts/evidence/run-before/kane/cross-tenant-beta-inv-1001.ndjson.log
  - artifacts/evidence/run-before/kane/cross-tenant-beta-inv-1001_test.md

### INV-2001 — owned by `tenant-beta`

- Accessor (attacker in this test): **finance@alpha.test** (`tenant-alpha`)
- API probe result: HTTP **200** on `GET /api/invoices/INV-2001` with the accessor's session cookie
- Sensitive markers leaked: `CONFIDENTIAL-BETA-4410`, `$8,000`
- Observed via: api, browser
- Kane CLI evidence:
  - artifacts/evidence/run-before/kane/output-cross-tenant-alpha-inv-2001/.internal/execution.json
  - artifacts/evidence/run-before/kane/output-cross-tenant-alpha-inv-2001/.internal/meta.json
  - artifacts/evidence/run-before/kane/output-cross-tenant-alpha-inv-2001/.internal/steps/1-61d535a6/flows/0/actions.ndjson
  - artifacts/evidence/run-before/kane/output-cross-tenant-alpha-inv-2001/.internal/steps/2-953af601/flows/0/actions.ndjson
  - artifacts/evidence/run-before/kane/output-cross-tenant-alpha-inv-2001/.internal/steps/3-84979a04/flows/0/actions.ndjson
  - artifacts/evidence/run-before/kane/output-cross-tenant-alpha-inv-2001/Result.md
  - artifacts/evidence/run-before/kane/cross-tenant-alpha-inv-2001.ndjson.log
  - artifacts/evidence/run-before/kane/cross-tenant-alpha-inv-2001_test.md

Full structured bundle: `artifacts/evidence/finding-bundle.json`.

## The vulnerable file

`target-saas/app/api/invoices/[id]/route.ts` currently authenticates the
caller but never checks that the invoice belongs to the caller's tenant:

```ts
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

```

## Required fix

In the `GET` handler, after loading the invoice and before returning it:

1. Compare `invoice.tenantId` with the authenticated caller's tenant id
   (`tenant.tenantId` from `getSessionTenant(req)` in the current code).
2. If they differ, return **HTTP 403** with a JSON body such as
   `{ "error": "Forbidden" }`. Do not include any invoice fields.
3. Keep the existing behavior otherwise: 401 when logged out, 404 when
   the invoice does not exist, 200 with the invoice for its owner.

Do not change any other file. Do not rename routes or alter the session
mechanism. After saving the change, commit and push so Vercel redeploys —
TenantFence is polling `/api/health` for the new commit SHA and will
re-run the full verification automatically.
