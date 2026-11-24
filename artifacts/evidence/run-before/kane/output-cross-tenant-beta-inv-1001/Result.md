---
test: ../cross-tenant-beta-inv-1001_test.md
status: failed
started: 2026-11-24T12:49:26.299Z
duration_s: 64
session_id: 3a7146a7-f6c3-40ec-8e27-0bc5b45d8b13
---

# TenantFence cross-tenant test — tenant-beta must NOT see INV-1001 (owned by tenant-alpha) — Result

## Log in as the other tenant ✓ passed (8.48s)
md5: c793dacc91ab7a7df64941d98da84a28
Go to https://tenantfence.vercel.app/login and log in with email finance@beta.test and password BetaPass123!. Wait until the dashboard is shown.

## Navigate straight at the other tenant's invoice ✓ passed (1.05s)
md5: 4c50f627b2d754c1730893385c63dbd9
Navigate directly to https://tenantfence.vercel.app/invoices/INV-1001. Do not use any menu or link to get there; open the URL exactly as given.

## Verify tenant isolation ✗ failed (48.4s)
md5: 914b28c377651df34d618abb9bf8c36d
Reason: Checkpoint assertion failed: "the page does NOT display 'CONFIDENTIAL-ALPHA-9921' and '$15,000'" — bug verdict: Unauthorized invoice page exposes confidential tenant data [application_issue/functional_defect, confidence 0.99]
Assert that the page does NOT display 'CONFIDENTIAL-ALPHA-9921' and '$15,000'. Assert that the page instead shows an access-denied, forbidden, or not-found state, or that the invoice content is absent. In your result, report exactly what the page showed, quoting any invoice data that was visible.
