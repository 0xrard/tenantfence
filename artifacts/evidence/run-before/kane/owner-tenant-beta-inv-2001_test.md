---
mode: testing
url: https://tenantfence.vercel.app/login
max_steps: 30
timeout: 240
---
# TenantFence positive control — tenant-beta opens its own INV-2001
## Log in as the owner
Go to https://tenantfence.vercel.app/login and log in with email finance@beta.test and password BetaPass123!. Wait until the dashboard is shown.
## Open the owned invoice
Navigate directly to https://tenantfence.vercel.app/invoices/INV-2001.
## Verify the owner can see the invoice
Assert that the page shows the invoice INV-2001 including 'CONFIDENTIAL-BETA-4410' and '$8,000'. Report exactly which of these values are visible on the page.
