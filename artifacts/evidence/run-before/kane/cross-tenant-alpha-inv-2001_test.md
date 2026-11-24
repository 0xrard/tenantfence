---
mode: testing
url: https://tenantfence.vercel.app/login
max_steps: 30
timeout: 240
---
# TenantFence cross-tenant test — tenant-alpha must NOT see INV-2001 (owned by tenant-beta)
## Log in as the other tenant
Go to https://tenantfence.vercel.app/login and log in with email finance@alpha.test and password AlphaPass123!. Wait until the dashboard is shown.
## Navigate straight at the other tenant's invoice
Navigate directly to https://tenantfence.vercel.app/invoices/INV-2001. Do not use any menu or link to get there; open the URL exactly as given.
## Verify tenant isolation
Assert that the page does NOT display 'CONFIDENTIAL-BETA-4410' and '$8,000'. Assert that the page instead shows an access-denied, forbidden, or not-found state, or that the invoice content is absent. In your result, report exactly what the page showed, quoting any invoice data that was visible.
