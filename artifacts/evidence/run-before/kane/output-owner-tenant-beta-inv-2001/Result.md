---
test: ../owner-tenant-beta-inv-2001_test.md
status: passed
started: 2026-11-24T12:17:48.155Z
duration_s: 91
session_id: 2c9fe16c-21a4-4ec6-bc6b-16dc94ba79ab
---

# TenantFence positive control — tenant-beta opens its own INV-2001 — Result

## Log in as the owner ✓ passed (48.7s)
md5: c793dacc91ab7a7df64941d98da84a28
Go to https://tenantfence.vercel.app/login and log in with email finance@beta.test and password BetaPass123!. Wait until the dashboard is shown.

## Open the owned invoice ✓ passed (8.5s)
md5: 3b38c9b8933764b53ccf2718a6321819
Navigate directly to https://tenantfence.vercel.app/invoices/INV-2001.

## Verify the owner can see the invoice ✓ passed (28.4s)
md5: 7797a8ed1d5271cd78f6817e070bca7b
Assert that the page shows the invoice INV-2001 including 'CONFIDENTIAL-BETA-4410' and '$8,000'. Report exactly which of these values are visible on the page.
