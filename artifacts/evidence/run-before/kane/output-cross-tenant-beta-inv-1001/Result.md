---
test: ../cross-tenant-beta-inv-1001_test.md
status: passed
started: 2026-11-24T13:04:40.163Z
duration_s: 64
session_id: c74267d2-c296-4b16-894d-b302d4d44d98
---

# TenantFence cross-tenant test — tenant-beta must NOT see INV-1001 (owned by tenant-alpha) — Result

## Log in as the other tenant ✓ passed (8.11s)
md5: c793dacc91ab7a7df64941d98da84a28
Go to https://tenantfence.vercel.app/login and log in with email finance@beta.test and password BetaPass123!. Wait until the dashboard is shown.

## Navigate straight at the other tenant's invoice ✓ passed (1.09s)
md5: 4c50f627b2d754c1730893385c63dbd9
Navigate directly to https://tenantfence.vercel.app/invoices/INV-1001. Do not use any menu or link to get there; open the URL exactly as given.

## Verify tenant isolation ✓ passed (50s)
md5: 914b28c377651df34d618abb9bf8c36d
Assert that the page does NOT display 'CONFIDENTIAL-ALPHA-9921' and '$15,000'. Assert that the page instead shows an access-denied, forbidden, or not-found state, or that the invoice content is absent. In your result, report exactly what the page showed, quoting any invoice data that was visible.
