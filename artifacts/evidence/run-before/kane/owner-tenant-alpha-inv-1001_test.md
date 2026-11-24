---
mode: testing
url: https://tenantfence.vercel.app/login
max_steps: 30
timeout: 240
---
# TenantFence positive control — tenant-alpha opens its own INV-1001
## Log in as the owner
Go to https://tenantfence.vercel.app/login and log in with email finance@alpha.test and password AlphaPass123!. Wait until the dashboard is shown.
## Open the owned invoice
Navigate directly to https://tenantfence.vercel.app/invoices/INV-1001.
## Verify the owner can see the invoice
Assert that the page shows the invoice INV-1001 including 'CONFIDENTIAL-ALPHA-9921' and '$15,000'. Report exactly which of these values are visible on the page.
