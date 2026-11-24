---
mode: testing
url: https://tenantfence.vercel.app/login
max_steps: 30
timeout: 240
---
# TenantFence cross-tenant test — tenant-beta must NOT see INV-1001 (owned by tenant-alpha)
## Log in as the other tenant
Go to https://tenantfence.vercel.app/login and log in with email finance@beta.test and password BetaPass123!. Wait until the dashboard is shown.
## Navigate straight at the other tenant's invoice
Navigate directly to https://tenantfence.vercel.app/invoices/INV-1001. Do not use any menu or link to get there; open the URL exactly as given.
## Verify tenant isolation
Assert that the page does NOT display 'CONFIDENTIAL-ALPHA-9921' and '$15,000'. Assert that the page instead shows an access-denied, forbidden, or not-found state, or that the invoice content is absent. In your result, report exactly what the page showed, quoting any invoice data that was visible.
