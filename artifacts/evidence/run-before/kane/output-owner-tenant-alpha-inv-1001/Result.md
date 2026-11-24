---
test: ../owner-tenant-alpha-inv-1001_test.md
status: passed
started: 2026-11-24T12:13:18.005Z
duration_s: 102
session_id: 7753cceb-40ab-4504-9198-429c52ca38ec
---

# TenantFence positive control — tenant-alpha opens its own INV-1001 — Result

## Log in as the owner ✓ passed (41.2s)
md5: 61d535a60fd36869f54103470b2429cc
Go to https://tenantfence.vercel.app/login and log in with email finance@alpha.test and password AlphaPass123!. Wait until the dashboard is shown.

## Open the owned invoice ✓ passed (10.4s)
md5: 9aad9f07a221101503c9b7647c9a5c1f
Navigate directly to https://tenantfence.vercel.app/invoices/INV-1001.

## Verify the owner can see the invoice ✓ passed (30.8s)
md5: afcc6e9fbd321bf5e2f48d3214e5063e
Assert that the page shows the invoice INV-1001 including 'CONFIDENTIAL-ALPHA-9921' and '$15,000'. Report exactly which of these values are visible on the page.
