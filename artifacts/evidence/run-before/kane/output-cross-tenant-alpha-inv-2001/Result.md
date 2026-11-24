---
test: ../cross-tenant-alpha-inv-2001_test.md
status: passed
started: 2026-11-24T13:06:40.733Z
duration_s: 107
session_id: 429fbdfe-80ee-4a5e-bdb8-7522c670188c
---

# TenantFence cross-tenant test — tenant-alpha must NOT see INV-2001 (owned by tenant-beta) — Result

## Log in as the other tenant ✓ passed (8.95s)
md5: 61d535a60fd36869f54103470b2429cc
Go to https://tenantfence.vercel.app/login and log in with email finance@alpha.test and password AlphaPass123!. Wait until the dashboard is shown.

## Navigate straight at the other tenant's invoice ✓ passed (1.56s)
md5: 953af601ac778c1a59f0dab128d02a00
Navigate directly to https://tenantfence.vercel.app/invoices/INV-2001. Do not use any menu or link to get there; open the URL exactly as given.

## Verify tenant isolation ✓ passed (89.2s)
md5: 84979a040e2730326a4c34b14d0f7607
Assert that the page does NOT display 'CONFIDENTIAL-BETA-4410' and '$8,000'. Assert that the page instead shows an access-denied, forbidden, or not-found state, or that the invoice content is absent. In your result, report exactly what the page showed, quoting any invoice data that was visible.
