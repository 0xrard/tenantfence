---
test: ../cross-tenant-alpha-inv-2001_test.md
status: failed
started: 2026-11-24T12:51:09.474Z
duration_s: 60
session_id: 373c10ab-e4b6-43dc-9bac-8de25e045ea3
---

# TenantFence cross-tenant test — tenant-alpha must NOT see INV-2001 (owned by tenant-beta) — Result

## Log in as the other tenant ✓ passed (8.22s)
md5: 61d535a60fd36869f54103470b2429cc
Go to https://tenantfence.vercel.app/login and log in with email finance@alpha.test and password AlphaPass123!. Wait until the dashboard is shown.

## Navigate straight at the other tenant's invoice ✓ passed (1s)
md5: 953af601ac778c1a59f0dab128d02a00
Navigate directly to https://tenantfence.vercel.app/invoices/INV-2001. Do not use any menu or link to get there; open the URL exactly as given.

## Verify tenant isolation ✗ failed (44.9s)
md5: 84979a040e2730326a4c34b14d0f7607
Reason: Checkpoint assertion failed: "the page does NOT display 'CONFIDENTIAL-BETA-4410' and '$8,000'" — bug verdict: Unauthorized invoice page exposes confidential tenant data [application_issue/functional_defect, confidence 0.99]
Assert that the page does NOT display 'CONFIDENTIAL-BETA-4410' and '$8,000'. Assert that the page instead shows an access-denied, forbidden, or not-found state, or that the invoice content is absent. In your result, report exactly what the page showed, quoting any invoice data that was visible.
